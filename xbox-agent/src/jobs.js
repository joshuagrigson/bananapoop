// The six jobs. Each takes ctx = { x, cfg, state, env, now, sleep, io, log, tmp }.
// Logs never carry friend names, gamertags, or URLs: the repo and its Action logs are public.
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

// ---------- time helpers (all schedule times are local, cfg.tz) ----------

export function local(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { dateKey: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), dow };
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// Returns the date key of the scheduled slot we are inside (slot opens at `at`, stays open
// `windowMin` minutes, may cross midnight), or null. GitHub cron can run late, hence the window.
export function dueSlot(now, tz, at, days, windowMin = 180) {
  const today = local(now, tz);
  const yest = local(new Date(now.getTime() - 86400000), tz);
  const a = toMin(at);
  for (const [day, delta] of [[today, today.min - a], [yest, today.min + 1440 - a]]) {
    if (delta >= 0 && delta < windowMin && (!days || days.includes(day.dow))) return day.dateKey;
  }
  return null;
}

export function inQuiet(now, tz, [from, to]) {
  const m = local(now, tz).min, a = toMin(from), b = toMin(to);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

async function pickConsole(ctx) {
  const list = await ctx.x.consoles();
  const c = (ctx.cfg.console && list.find((d) => d.name === ctx.cfg.console || d.id === ctx.cfg.console)) || list[0];
  if (!c) throw new Error('no console on this account');
  return c;
}

// ---------- 1. clip auto-pull -> 9:16 cut -> Drive drop -> phone ping ----------

export async function clips(ctx, { force = false } = {}) {
  const { cfg, state, env, io } = ctx;
  const slot = dueSlot(ctx.now(), cfg.tz, cfg.clips.at, null, 240);
  if (!force && (!slot || state.lastRun.clips === slot)) return { skipped: true };

  const firstRun = state.seenClips.length === 0;
  const cutoff = ctx.now().getTime() - cfg.clips.backfillDays * 86400000;
  const all = await ctx.x.clips(50);
  const fresh = all
    .filter((c) => !state.seenClips.includes(c.id))
    .filter((c) => !firstRun || !c.recorded || Date.parse(c.recorded) >= cutoff)
    .reverse() // oldest first
    .slice(0, cfg.clips.max);

  const done = [], failed = [];
  if (fresh.length && env.DRIVE_DROP_URL) io.ensureFfmpeg();
  for (const c of fresh) {
    if (!c.url) { failed.push({ c, why: 'no download link yet' }); continue; }
    if (!env.DRIVE_DROP_URL) { failed.push({ c, why: 'Drive drop not set up' }); continue; }
    const raw = join(ctx.tmp, `${c.id}.mp4`), cut = join(ctx.tmp, `${c.id}-9x16.mp4`);
    try {
      await io.download(c.url, raw);
      io.vertical(raw, cut);
      const stamp = (c.recorded || new Date().toISOString()).slice(0, 16).replace(/[:T]/g, '-');
      const name = `${stamp} ${c.title || 'clip'} 9x16.mp4`.replace(/[\\/:*?"<>|]/g, '');
      const r = await io.drop(env.DRIVE_DROP_URL, env.DRIVE_DROP_KEY, { path: cut, name, folder: cfg.clips.folder });
      if (!r.ok) throw new Error(r.error || 'drop failed');
      state.seenClips.push(c.id);
      done.push({ c, link: r.url, folderUrl: r.folderUrl });
    } catch (e) {
      failed.push({ c, why: e.message });
      if (/too big/.test(e.message)) state.seenClips.push(c.id); // never fits; don't retry nightly
    } finally {
      for (const p of [raw, cut]) { try { unlinkSync(p); } catch {} }
    }
  }
  // Clips skipped by the first-run cutoff are marked seen so they never flood in later.
  if (firstRun) for (const c of all) if (!state.seenClips.includes(c.id) && !fresh.includes(c)) state.seenClips.push(c.id);
  state.seenClips = state.seenClips.slice(-500);
  if (slot) state.lastRun.clips = slot;

  if (done.length || failed.length) {
    const lines = [
      ...done.map((d) => `✓ ${d.c.title || 'clip'} (${d.c.seconds || '?'} s)`),
      ...failed.map((f) => `✗ ${f.c.title || 'clip'}: ${f.why}`),
    ];
    await io.notify(env.NTFY_TOPIC, {
      title: `${done.length} new Xbox clip${done.length === 1 ? '' : 's'} ready for TheGamerzFeed`,
      message: lines.join('\n') + (done.length ? '\nIn Drive: ' + cfg.clips.folder : ''),
      tags: ['video_game', 'scissors'],
      click: done[0] && done[0].folderUrl,
    });
  }
  ctx.log(`clips: ${done.length} delivered, ${failed.length} failed, ${fresh.length} new of ${all.length}`);
  return { done: done.length, failed: failed.length };
}

// ---------- 2. friend-online pings ----------

export async function friends(ctx) {
  const { cfg, state, env, io } = ctx;
  const people = await ctx.x.friends();
  const watch = cfg.friends.watch.map((g) => g.toLowerCase());
  const anyFav = people.some((p) => p.favorite);
  const watched = people.filter((p) =>
    watch.length ? watch.includes((p.gamertag || '').toLowerCase()) : anyFav ? p.favorite : true);

  const now = {};
  for (const p of watched) if (p.online) now[p.xuid] = p.game || '';
  const news = watched.filter((p) => p.online && p.game && state.friendsOnline[p.xuid] !== p.game);
  state.friendsOnline = now;

  if (news.length && !inQuiet(ctx.now(), cfg.tz, cfg.friends.quiet)) {
    const msg = news.slice(0, 6).map((p) => `${p.gamertag} is on ${p.game}`).join('\n');
    await io.notify(env.NTFY_TOPIC, { title: news.length === 1 ? msg : `${news.length} friends just got on`, message: msg, tags: ['busts_in_silhouette'] });
  }
  ctx.log(`friends: ${watched.length} watched, ${Object.keys(now).length} online, ${news.length} new`);
  return { pinged: news.length };
}

// ---------- 3. game-ready warmup: wake + launch before he's home ----------

export async function warmup(ctx, { force = false, game } = {}) {
  const { cfg, state, env, io } = ctx;
  const w = cfg.warmup;
  const slot = dueSlot(ctx.now(), cfg.tz, w.at, w.days, 90);
  if (!force && (!slot || state.lastRun.warmup === slot)) return { skipped: true };
  if (slot) state.lastRun.warmup = slot;

  const c = await pickConsole(ctx);
  if (c.power !== 'On') { await ctx.x.wake(c.id); await ctx.sleep(25000); }
  const want = (game || w.game).toLowerCase();
  const t = (await ctx.x.titleHistory(50)).find((x) => x.name && x.name.toLowerCase().includes(want) && x.productId);
  let launched = false;
  if (t) { await ctx.x.launch(c.id, t.productId); launched = true; }
  state.warmupAt = ctx.now().toISOString();
  state.idleTicks = 0;
  await io.notify(env.NTFY_TOPIC, {
    title: launched ? `Xbox is on and ${t.name} is loading` : 'Xbox is on',
    message: launched ? 'Updates and shaders get a head start before you sit down.' : `Couldn't find "${game || w.game}" in your recently played list to launch.`,
    tags: ['video_game'],
  });
  ctx.log(`warmup: woke=${c.power !== 'On'} launched=${launched}`);
  return { launched };
}

// ---------- 4. bedtime power-off ----------

export async function bedtime(ctx) {
  const { cfg, state, env, io } = ctx;
  for (const [i, b] of cfg.bedtime.entries()) {
    const key = `bedtime${i}`;
    const slot = dueSlot(ctx.now(), cfg.tz, b.at, b.days, 120);
    if (!slot || state.lastRun[key] === slot) continue;
    state.lastRun[key] = slot;
    const c = await pickConsole(ctx);
    if (c.power === 'On') {
      await ctx.x.turnOff(c.id);
      await io.notify(env.NTFY_TOPIC, { title: 'Bedtime: Xbox turned off', message: `Scheduled ${b.at}.`, tags: ['crescent_moon'] });
      ctx.log('bedtime: turned off');
      return { off: true };
    }
    ctx.log('bedtime: already off');
  }
  return { off: false };
}

// ---------- 5. idle-off (the cloud-side stand-in for "follow the TV") ----------
// Console On but sitting on the Home dashboard (no game, no app) for N ticks in a row -> off.

export async function idle(ctx) {
  const { cfg, state, env, io } = ctx;
  const sinceWarm = state.warmupAt ? (ctx.now() - Date.parse(state.warmupAt)) / 60000 : Infinity;
  const c = await pickConsole(ctx);
  if (c.power !== 'On') { state.idleTicks = 0; return { idle: 0 }; }
  const me = await ctx.x.myPresence();
  if (me.game) {
    state.idleTicks = 0;
    state.playLog.push({ at: ctx.now().toISOString(), game: me.game });
    state.playLog = state.playLog.filter((p) => ctx.now() - Date.parse(p.at) < 8 * 86400000);
    return { idle: 0, game: true };
  }
  if (sinceWarm < cfg.idleOff.graceMinutes) return { idle: state.idleTicks, grace: true };
  state.idleTicks += 1;
  if (state.idleTicks >= cfg.idleOff.ticks) {
    await ctx.x.turnOff(c.id);
    state.idleTicks = 0;
    await io.notify(env.NTFY_TOPIC, { title: 'Xbox was idle on Home, turned it off', message: `Nothing running for about ${cfg.idleOff.ticks * 30} min.`, tags: ['zzz'] });
    ctx.log('idle: turned off');
    return { off: true };
  }
  return { idle: state.idleTicks };
}

// ---------- 6. weekly digest ----------

export async function digest(ctx, { force = false } = {}) {
  const { cfg, state, env, io } = ctx;
  const slot = dueSlot(ctx.now(), cfg.tz, cfg.digest.at, [cfg.digest.day], 360);
  if (!force && (!slot || state.lastRun.digest === slot)) return { skipped: true };
  if (slot) state.lastRun.digest = slot;

  const week = ctx.now().getTime() - 7 * 86400000;
  const hours = {};
  for (const p of state.playLog) if (Date.parse(p.at) >= week) hours[p.game] = (hours[p.game] || 0) + 0.5;
  const titles = (await ctx.x.titleHistory(25)).filter((t) => t.lastPlayed && Date.parse(t.lastPlayed) >= week);
  const gs = await ctx.x.gamerscore();
  const gsDelta = state.gamerscoreAtDigest == null ? null : gs - state.gamerscoreAtDigest;
  state.gamerscoreAtDigest = gs;

  const lines = [];
  const hourList = Object.entries(hours).sort((a, b) => b[1] - a[1]);
  lines.push(hourList.length ? 'Time on the console (30-min samples):' : 'No play time sampled this week.');
  for (const [g, h] of hourList) lines.push(`  ${g}: ~${h} h`);
  if (titles.length) lines.push(`Played: ${titles.map((t) => t.name).join(', ')}`);
  lines.push(`Gamerscore ${gs}${gsDelta == null ? ' (baseline set)' : ` (+${gsDelta} this week)`}`);
  await io.notify(env.NTFY_TOPIC, { title: 'Your Xbox week', message: lines.join('\n'), tags: ['bar_chart'] });
  ctx.log(`digest: ${hourList.length} games sampled, ${titles.length} titles, gs delta ${gsDelta}`);
  return { lines };
}
