// Offline tests: a fake Microsoft + Xbox Live behind global fetch, a fake phone, a fake Drive.
// Run: node test/run.js   (also does one real ffmpeg 9:16 cut if ffmpeg is on PATH)
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { run } from '../src/agent.js';
import * as store from '../src/state.js';
import { dueSlot, inQuiet } from '../src/jobs.js';
import { modeFrom, parseList, parseBuild } from '../src/meta.js';
import * as realIo from '../src/io.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('ok  ', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message); } };

// ---------------- fake world ----------------
const W = {
  devicePolls: 0, refreshFails: false, power: 'ConnectedStandby', myGame: null,
  commands: [], friends: [], clips: [], gs: 1000,
  titles: [
    { titleId: '1', name: 'Call of Duty®', productId: '9NCOD123', titleHistory: { lastTimePlayed: '2026-11-14T02:00:00Z' } },
    { titleId: '2', name: 'Forza Horizon 6', productId: '9NFH6', titleHistory: { lastTimePlayed: '2026-10-01T02:00:00Z' } },
  ],
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url); const body = opt.body;
  const f = typeof body === 'string' && body.includes('grant_type') ? Object.fromEntries(new URLSearchParams(body)) : null;
  if (u.host === 'wzhub.gg') {
    const tile = (tier, name, range) => `<article data-loadout-key="x" class="lo2-tile"><button type="button" aria-expanded="false" aria-label="${name}, ${range}" class="lo2-tile__toggle"></button><img src="/images/games/mw4.svg" alt="mw4" class="lo2-tile__game"></article>`;
    if (u.pathname === '/loadouts') return new Response(`<section id="lo2-group-pure_meta" class="lo2-group">${tile(0, 'CRONEN OSPREY', 'Long ranges')}${tile(0, 'VEL 46', 'Close range')}</section><section id="lo2-group-meta">${tile(0, 'HAN 86', 'Long ranges')}</section>`);
    if (u.pathname === '/mw4-loadouts') return new Response(`<section id="lo2-group-new">${tile(0, 'ISO NIGHTSHADE', 'Close range')}</section><section id="lo2-group-pure_meta">${tile(0, 'M4', 'All ranges')}</section>`);
    if (u.pathname === '/loadouts/mw4-cronen-osprey') return new Response('<ul class="lo2-details__attachments"><li><span>Optic</span> <strong>Locus PX3 Canted</strong></li><li><span>Barrel</span> <strong>IO-556 Tac 18&quot;</strong></li></ul><span>LOADOUT CODE</span> <strong>A02-2TKF8-24ZCN-11</strong>');
    return new Response('nope', { status: 404 });
  }
  if (u.pathname.endsWith('/devicecode')) return json({ device_code: 'DC', user_code: 'ABCD-1234', verification_uri: 'https://microsoft.com/link', expires_in: 900, interval: 5 });
  if (u.pathname.endsWith('/token')) {
    if (f.grant_type.includes('device_code')) return ++W.devicePolls < 2 ? json({ error: 'authorization_pending' }, 400) : json({ access_token: 'AT0', refresh_token: 'RT0' });
    if (W.refreshFails) return json({ error: 'invalid_grant', error_description: 'expired' }, 400);
    return json({ access_token: 'AT1', refresh_token: 'RT-' + Math.random().toString(36).slice(2) });
  }
  if (u.host === 'user.auth.xboxlive.com') return json({ Token: 'UT', DisplayClaims: { xui: [{ uhs: 'UHS' }] } });
  if (u.host === 'xsts.auth.xboxlive.com') return json({ Token: 'XT', NotAfter: '2030', DisplayClaims: { xui: [{ uhs: 'UHS', xid: '2535', gtg: 'XOskellington' }] } });
  assert.equal(opt.headers.Authorization, 'XBL3.0 x=UHS;XT');
  if (u.pathname === '/lists/devices') return json({ result: [{ id: 'F400', name: 'Xbox', consoleType: 'XboxSeriesX', powerState: W.power }] });
  if (u.pathname === '/commands') { const b = JSON.parse(body); W.commands.push(`${b.type}/${b.command}${b.parameters[0].oneStoreProductId ? ':' + b.parameters[0].oneStoreProductId : ''}`); if (b.command === 'WakeUp') W.power = 'On'; if (b.command === 'TurnOff') W.power = 'ConnectedStandby'; return json({ status: { errorCode: 'OK' } }); }
  if (u.host === 'userpresence.xboxlive.com') return json({ state: 'Online', devices: [{ type: 'Scarlett', titles: [{ id: '750323071', name: 'Home', placement: 'Background' }, ...(W.myGame ? [{ id: '1', name: W.myGame, placement: 'Full', activity: { richPresence: W.myDetail || '' } }] : [])] }] });
  if (u.host === 'peoplehub.xboxlive.com') return json({ people: W.friends });
  if (u.host === 'mediahub.xboxlive.com') return json({ values: W.clips });
  if (u.host === 'titlehub.xboxlive.com') return json({ titles: W.titles });
  if (u.host === 'profile.xboxlive.com') return json({ profileUsers: [{ settings: [{ id: 'Gamerscore', value: String(W.gs) }] }] });
  throw new Error('unexpected fetch ' + url);
};

const pings = [], drops = [], logs = [];
const io = {
  notify: async (topic, m) => { pings.push(m); return !!topic; },
  download: async () => 1, ensureFfmpeg: () => {}, vertical: () => 1,
  drop: async (_u, key, { name, folder }) => { drops.push({ name, folder, key }); return { ok: true, url: 'https://drive/x', folderUrl: 'https://drive/f' }; },
};
const dir = mkdtempSync(join(tmpdir(), 'xa-'));
const env = { XBOX_CLIENT_ID: 'cid', XBOX_STATE_KEY: randomBytes(32).toString('base64'), NTFY_TOPIC: 'topic', DRIVE_DROP_URL: 'https://script', DRIVE_DROP_KEY: 'k', STATE_FILE: join(dir, 'state.enc') };
const at = (iso) => () => new Date(iso);
const go = (cmd, iso, extra = {}) => run(cmd, '', { env, io, now: at(iso), sleep: async () => {}, log: (s) => logs.push(s), ...extra });
const state = () => store.load(env.STATE_FILE, env.XBOX_STATE_KEY);
const clip = (id, rec, title = 'Call of Duty®') => ({ contentId: id, titleName: title, uploadDate: rec, durationInSeconds: 30, contentLocators: [{ locatorType: 'Download', uri: `https://gameclips/${id}.mp4` }] });

// ---------------- tests ----------------
await t('schedule: slot opens at the time, crosses midnight, honours weekdays', () => {
  const tz = 'America/Chicago';
  assert.equal(dueSlot(new Date('2026-11-16T23:20:00Z'), tz, '17:15', [1], 90), '2026-11-16');   // Mon 17:20 CT
  assert.equal(dueSlot(new Date('2026-11-16T23:00:00Z'), tz, '17:15', [1], 90), null);           // 17:00, too early
  assert.equal(dueSlot(new Date('2026-11-15T23:20:00Z'), tz, '17:15', [1], 90), null);           // Sunday
  assert.equal(dueSlot(new Date('2026-11-17T06:10:00Z'), tz, '23:30', null, 120), '2026-11-16'); // 00:10 CT next day
  assert.equal(inQuiet(new Date('2026-11-17T06:10:00Z'), tz, ['23:30', '08:00']), true);
  assert.equal(inQuiet(new Date('2026-11-16T20:00:00Z'), tz, ['23:30', '08:00']), false);
});

await t('state is sealed (no refresh token readable on disk)', async () => {
  await go('login', '2026-11-13T12:00:00Z');
  const raw = readFileSync(env.STATE_FILE, 'utf8');
  assert.ok(!raw.includes('RT0'));
  assert.equal(state().refreshToken, 'RT0');
});

await t('login: code goes to the phone, never to the log', () => {
  assert.ok(pings.some((p) => p.title.includes('ABCD-1234')));
  assert.ok(pings.some((p) => p.title === 'Xbox agent is signed in'));
  assert.ok(!logs.join('\n').includes('ABCD-1234'));
});

await t('refresh token rotates on every run', async () => {
  const before = state().refreshToken;
  await go('status', '2026-11-13T12:05:00Z');
  assert.notEqual(state().refreshToken, before);
});

await t('clips: first nightly run delivers last 7 days only, marks older as seen', async () => {
  W.clips = [clip('c3', '2026-11-13T01:00:00Z'), clip('c2', '2026-11-11T01:00:00Z'), clip('old', '2026-10-01T01:00:00Z')];
  drops.length = 0; pings.length = 0;
  await go('tick', '2026-11-14T09:10:00Z'); // 03:10 CT Sat
  assert.deepEqual(drops.map((d) => d.name.includes('9x16')), [true, true]);
  assert.equal(drops[0].folder, 'TheGamerzFeed/Xbox clips');
  assert.ok(drops[0].name.startsWith('2026-11-11'), 'oldest first');
  assert.deepEqual([...state().seenClips].sort(), ['c2', 'c3', 'old']);
  assert.ok(pings.some((p) => p.title === '2 new Xbox clips ready for TheGamerzFeed'));
});

await t('clips: same night again = nothing; next night only the new one', async () => {
  drops.length = 0;
  await go('tick', '2026-11-14T09:40:00Z');
  assert.equal(drops.length, 0);
  W.clips.unshift(clip('c4', '2026-11-14T20:00:00Z'));
  await go('tick', '2026-11-15T09:10:00Z');
  assert.equal(drops.length, 1);
});

await t('clips: no Drive drop configured -> nothing marked seen, phone told why', async () => {
  W.clips.unshift(clip('c5', '2026-11-15T20:00:00Z'));
  pings.length = 0;
  await run('clips', '', { env: { ...env, DRIVE_DROP_URL: '' }, io, now: at('2026-11-15T21:00:00Z'), sleep: async () => {}, log: () => {} });
  assert.ok(!state().seenClips.includes('c5'));
  assert.ok(pings.some((p) => p.message.includes('Drive drop not set up')));
});

await t('friends: favorites only, ping on getting into a game, no repeat, names kept out of the log', async () => {
  W.friends = [
    { xuid: '1', gamertag: 'Kianni', isFavorite: true, presenceState: 'Online', presenceDetails: [{ IsGame: true, IsPrimary: true, PresenceText: 'Call of Duty' }] },
    { xuid: '2', gamertag: 'RandomGuy', isFavorite: false, presenceState: 'Online', presenceDetails: [{ IsGame: true, IsPrimary: true, PresenceText: 'Fortnite' }] },
  ];
  pings.length = 0; logs.length = 0;
  await go('tick', '2026-11-16T20:00:00Z'); // 14:00 CT
  assert.deepEqual(pings.filter((p) => p.tags?.includes('busts_in_silhouette')).map((p) => p.title), ['Kianni is on Call of Duty']);
  pings.length = 0;
  await go('tick', '2026-11-16T20:30:00Z');
  assert.equal(pings.filter((p) => p.tags?.includes('busts_in_silhouette')).length, 0);
  assert.ok(!logs.join('\n').includes('Kianni'));
});

await t('friends: quiet hours suppress the ping but still track', async () => {
  W.friends[0].presenceDetails[0].PresenceText = 'Forza Horizon 6';
  pings.length = 0;
  await go('tick', '2026-11-17T07:00:00Z'); // 01:00 CT
  assert.equal(pings.filter((p) => p.tags?.includes('busts_in_silhouette')).length, 0);
});

await t('warmup: weekday 17:15 wakes the console and launches CoD by product id', async () => {
  W.commands.length = 0; W.power = 'ConnectedStandby';
  await go('tick', '2026-11-16T23:20:00Z'); // Mon 17:20 CT
  assert.deepEqual(W.commands, ['Power/WakeUp', 'Shell/ActivationApp:9NCOD123']);
  W.commands.length = 0;
  await go('tick', '2026-11-16T23:50:00Z');
  assert.ok(!W.commands.includes('Power/WakeUp'), 'once per day');
});

await t('warmup: not on Saturday', async () => {
  W.commands.length = 0; W.power = 'ConnectedStandby';
  await go('tick', '2026-11-21T23:20:00Z');
  assert.ok(!W.commands.some((c) => c.startsWith('Shell')));
});

await t('idle-off: On + Home dashboard for 2 ticks -> off; a running game resets it', async () => {
  W.power = 'On'; W.myGame = null; W.commands.length = 0;
  await go('tick', '2026-11-18T19:00:00Z');
  assert.equal(W.commands.length, 0);
  W.myGame = 'Call of Duty®';
  await go('tick', '2026-11-18T19:30:00Z');
  W.myGame = null;
  await go('tick', '2026-11-18T20:00:00Z');
  assert.equal(W.commands.length, 0, 'counter was reset by the game');
  await go('tick', '2026-11-18T20:30:00Z');
  assert.deepEqual(W.commands, ['Power/TurnOff']);
});

await t('idle-off: grace period after warmup', async () => {
  W.power = 'ConnectedStandby'; W.myGame = null; W.commands.length = 0;
  await go('tick', '2026-11-19T23:20:00Z'); // Thu warmup
  W.commands.length = 0;
  await go('tick', '2026-11-19T23:50:00Z');
  await go('tick', '2026-11-20T00:20:00Z');
  assert.ok(!W.commands.includes('Power/TurnOff'));
});

await t('bedtime: 23:30 turns it off once', async () => {
  W.power = 'On'; W.myGame = 'Call of Duty®'; W.commands.length = 0;
  await go('tick', '2026-11-18T05:40:00Z'); // Tue 23:40 CT
  assert.deepEqual(W.commands, ['Power/TurnOff']);
  W.power = 'On'; W.commands.length = 0;
  await go('tick', '2026-11-18T06:10:00Z');
  assert.ok(!W.commands.includes('Power/TurnOff'));
});

await t('digest: Sunday 10:00 sends hours by game + gamerscore', async () => {
  pings.length = 0; W.gs = 1040;
  await go('tick', '2026-11-22T16:10:00Z'); // Sun 10:10 CT
  const d = pings.find((p) => p.title === 'Your Xbox week');
  assert.ok(d, 'sent');
  assert.match(d.message, /Call of Duty®: ~\d/);
  assert.match(d.message, /Gamerscore 1040/);
});

await t('expired sign-in: one "sign in again" ping per day, run fails loudly', async () => {
  W.refreshFails = true; pings.length = 0;
  await assert.rejects(go('tick', '2026-11-23T12:00:00Z'));
  await assert.rejects(go('tick', '2026-11-23T12:30:00Z'));
  assert.equal(pings.filter((p) => p.title.includes('sign in again')).length, 1);
  W.refreshFails = false;
});

await t('meta: mode from Xbox rich presence text', () => {
  assert.equal(modeFrom('Warzone: Resurgence Quads'), 'warzone');
  assert.equal(modeFrom('Multiplayer: Hardpoint on Shipment'), 'mp');
  assert.equal(modeFrom('DMZ: Exfil'), 'dmz');
  assert.equal(modeFrom('In the menus'), null);
});

await t('meta: Warzone ping has the top build with attachments + code; no repeat; switches with mode', async () => {
  W.refreshFails = false; W.power = 'On'; W.myGame = 'Call of Duty®'; W.myDetail = 'Warzone: Resurgence Quads';
  pings.length = 0;
  await go('tick', '2026-11-24T20:00:00Z');
  let m = pings.filter((p) => p.tags?.includes('gun'));
  assert.equal(m.length, 1);
  assert.equal(m[0].title, 'Warzone meta right now');
  assert.match(m[0].message, /CRONEN OSPREY \(Long ranges\)\n  Optic: Locus PX3 Canted · Barrel: IO-556 Tac 18"\n  Code: A02-2TKF8-24ZCN-11/);
  pings.length = 0;
  await go('tick', '2026-11-24T20:30:00Z');
  assert.equal(pings.filter((p) => p.tags?.includes('gun')).length, 0, 'same mode, same day');
  W.myDetail = 'Multiplayer: Hardpoint';
  await go('tick', '2026-11-24T21:00:00Z');
  m = pings.filter((p) => p.tags?.includes('gun'));
  assert.equal(m.length, 1);
  assert.match(m[0].message, /★ M4 \(All ranges\)/);
});

await t('meta: not playing CoD = nothing; unknown mode = Warzone list once a day, labelled', async () => {
  W.myGame = 'Forza Horizon 6'; W.myDetail = ''; pings.length = 0;
  await go('tick', '2026-11-25T20:00:00Z');
  assert.equal(pings.filter((p) => p.tags?.includes('gun')).length, 0);
  W.myGame = 'Call of Duty®'; W.myDetail = 'In the menus';
  await go('tick', '2026-11-25T20:30:00Z');
  await go('tick', '2026-11-25T21:00:00Z');
  const m = pings.filter((p) => p.tags?.includes('gun'));
  assert.equal(m.length, 1);
  assert.match(m[0].title, /couldn't read your mode/);
});

await t('meta: manual command with a mode', async () => {
  pings.length = 0;
  await run('meta', 'mp', { env, io, now: at('2026-11-25T22:00:00Z'), sleep: async () => {}, log: () => {} });
  assert.equal(pings.filter((p) => p.tags?.includes('gun'))[0].title, 'MW4 Multiplayer meta right now');
});

await t('real ffmpeg: landscape clip -> 1080x1920 vertical', () => {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { console.log('     (ffmpeg missing, skipped)'); return; }
  const src = join(dir, 'src.mp4'), dst = join(dir, 'dst.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=60:duration=3', '-f', 'lavfi', '-i', 'sine=duration=3', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', src]);
  realIo.vertical(src, dst);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', dst]).toString().trim();
  assert.equal(probe, '1080,1920,30/1');
  assert.ok(existsSync(dst));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
