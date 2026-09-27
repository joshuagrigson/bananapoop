// The sandbox race: every contestant room starts with a stake and one agent who tries to multiply it, and the ledger
// keeps score. Prizes go to the best score at each prize time: 1 week, 30, 90 and 180 days by default, or as short as
// a test race's 30 minutes, 1 hour and 2 hours. A race of two days or less reads in hours: rates per hour, a recent
// window of its last half hour to hour, a chart point every 5 minutes.
// Pure: the reduced state and a clock in, the standings out. Nothing here invents a number. A bankroll is the stake
// plus evidenced money in minus evidenced money out, counted only between the starting gun and the last horizon.
// Holdings (stock, inventory, a coin) count at zero until they are sold, so a paper gain never wins a prize.
// A simulation race (the default) counts simulated money instead: every play an agent launched runs in the simulated
// market (sim.js) from its launch, and its simulated sales and costs are the race's money. Real money moving in a
// simulation is a rule break. An agent's own model use (money out with a runId) is real, shown apart, never scored.
import { RACE_METHODS, RACE_MODELS, RACE_SCORING, RACE_PURPOSES, SIGNAL_TYPES, SIGNAL_PLURAL, SPEND_CATEGORIES, RULE_KINDS, RESEARCH_TOPICS, SIM_SPEEDS, defaultRaceRules } from './ledger.js';
import { SIM_CHANNELS, SIM_ARTIFACTS, PRIORS, liveLines, specLine, monteCarlo } from './sim.js';

const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
// 30 -> "30 min", 120 -> "2 hours", 10080 -> "1 week", 259200 -> "6 months"
export function spanLabel(m) {
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (m < 60) return `${m} min`;
  if (m < 1440) return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : pl(m / 60, 'hour');
  if (m % 1440) return `${Math.round((m / 1440) * 10) / 10} days`;
  const d = m / 1440;
  return d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 180 ? '6 months' : d === 365 ? '1 year' : pl(d, 'day');
}
const r2 = (v) => Math.round(v * 100) / 100;
const iso = (t) => new Date(t).toISOString();
const sum = (xs, f = (x) => x) => r2(xs.reduce((s, x) => s + f(x), 0));
const byTs = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
// money grouped by a key, biggest first: [{ key, usd, n }]
function groupBy(lines, key) {
  const m = new Map();
  for (const x of lines) { const k = key(x) || 'other'; const g = m.get(k) || { key: k, usd: 0, n: 0 }; g.usd += x.usd; g.n += 1; m.set(k, g); }
  return [...m.values()].map((g) => ({ ...g, usd: r2(g.usd) })).sort((a, b) => b.usd - a.usd);
}

export function raceBoard(state, catalog, now = Date.now(), { timeline = 160, raceId = null } = {}) {
  // the race on now, or (raceId) any earlier one, read exactly as it stood when the next race began
  const race = !state ? null : raceId ? (state.race && state.race.id === raceId ? state.race : (state.pastRaces || []).find((x) => x.id === raceId) || null) : state.race;
  if (!race) return null;
  const rules = { ...defaultRaceRules(), ...(race.rules || {}) };
  // a race set before check-ins were counted in minutes said everyHours
  if (race.rules && race.rules.everyMinutes === undefined && race.rules.everyHours) rules.everyMinutes = race.rules.everyHours * 60;
  // a race set before "anything they choose" existed keeps the list it was run on
  if (race.rules && race.rules.anyMethod === undefined) rules.anyMethod = false;
  if (race.rules && race.rules.spendCategories === undefined && race.rules.ads === false) rules.spendCategories = rules.spendCategories.filter((c) => c !== 'ads');
  const known = catalog.map((p) => p.id);
  const ids = race.rooms ? race.rooms.filter((id) => known.includes(id)) : known;
  const t0 = Date.parse(race.startedAt), hz = race.horizonsMin || (race.horizons || []).map((d) => d * 1440), last = hz[hz.length - 1];
  const tEnd = Math.min(t0 + last * MIN, race.endedAt ? Math.max(t0, Date.parse(race.endedAt)) : Infinity), tNow = Math.max(t0, Math.min(now, tEnd));
  const elapsed = tNow - t0;
  const short = last <= 2 * 1440, unit = short ? HOUR : DAY, floor = short ? 5 * MIN : DAY;
  const recent = short ? Math.max(15 * MIN, Math.min(HOUR, (last * MIN) / 4)) : 7 * DAY;
  const step = last <= 1440 ? 5 * MIN : last <= 14 * 1440 ? HOUR : DAY;
  // net dollars per hour (short race) or per day; a span shorter than the floor counts as the floor, so one early sale
  // is not read as a fortune a day
  const perUnit = (usd, span) => r2((usd / Math.max(floor, span)) * unit);
  const minOf = (ts) => Math.max(0, Math.floor((Date.parse(ts) - t0) / MIN));
  const stakeOf = (id) => rules.stakes[id] || race.stakeUsd;
  const inWindow = (ts) => { const t = Date.parse(ts); return t >= t0 && t <= tNow; };
  const dayOf = (ts) => Math.floor((Date.parse(ts) - t0) / DAY) + 1;
  // the race's evidence standard: money below it is shown, but not counted
  const meets = (e) => (rules.evidence === 'link' ? /https?:\/\//i.test(e.evidence || '') : rules.evidence === 'id' ? /\d/.test(e.evidence || '') : true);
  // a short simulation compresses the market: a race of under a week plays about three months of simulated trading,
  // unless the setup chose its own speed
  const sim = rules.moneyMode === 'sim', speed = Number(rules.simSpeed) > 1 ? Number(rules.simSpeed) : last < 7 * 1440 ? Math.max(1, Math.round(129600 / last)) : 1;
  // the race's own limits hold in the simulation too: no more messages or ad dollars a day than the rules allow
  const capSpec = (s) => {
    if ((s.channel === 'email' || s.channel === 'dm') && rules.maxMessagesPerDay !== null && rules.outreach !== 'none') s.volume = Math.min(s.volume, rules.maxMessagesPerDay);
    if (s.channel === 'ads' && rules.maxSpendPerDayUsd !== null) s.volume = Math.min(s.volume, rules.maxSpendPerDayUsd);
    return s;
  };

  // each room's money inside the window, oldest first
  const flows = new Map(ids.map((id) => [id, []])), uncounted = new Map(ids.map((id) => [id, []]));
  const apiUsd = new Map(ids.map((id) => [id, 0])), realInSim = new Map(ids.map((id) => [id, []]));
  const add = (e, dir) => {
    if (!flows.has(e.path) || !inWindow(e.ts)) return;
    const x = { t: Date.parse(e.ts), usd: dir === 'in' ? e.usd : -e.usd, e, dir };
    // an agent's own model use is real money, but it is the cost of running the race, not a move in it
    if (dir === 'out' && e.runId) { apiUsd.set(e.path, r2(apiUsd.get(e.path) + e.usd)); return; }
    if (sim) { realInSim.get(e.path).push(x); return; }
    (meets(e) ? flows : uncounted).get(e.path).push(x);
  };
  for (const e of state.moneyIn) add(e, 'in');
  for (const e of state.moneyOut) add(e, 'out');
  // the simulated market: each launched play, from its launch (or the gun), with every panel's read as it came in
  const simOf = new Map(ids.map((id) => [id, { plays: new Map(), signals: [] }]));
  // only this race's moves: a play launched for an earlier race does not carry into a new one
  const tSet = Math.min(t0, Date.parse(race.setAt || race.startedAt));
  const simEvents = (state.sims || []).filter((e) => simOf.has(e.path) && Date.parse(e.ts) >= tSet && Date.parse(e.ts) <= Math.min(tEnd, now));
  if (sim) {
    for (const id of ids) {
      const byPlay = new Map();
      for (const e of simEvents) if (e.path === id && e.play && ['launch', 'stop', 'panel'].includes(e.act)) (byPlay.get(e.play) || byPlay.set(e.play, []).get(e.play)).push(e);
      for (const [pid, evs] of byPlay) {
        const segs = []; let cur = null, q = 1;
        for (const e of evs.sort(byTs)) {
          const ts = iso(Math.max(t0, Date.parse(e.ts)));
          if (e.act === 'launch') { cur = { ...e.spec }; segs.push({ ts, spec: capSpec({ ...cur, quality: e.spec.quality !== 1 ? e.spec.quality : q }), ev: e }); }
          else if (e.act === 'stop') { if (cur) segs.push({ ts, stop: true, ev: e }); cur = null; }
          else if (e.act === 'panel') { q = e.quality; if (cur) segs.push({ ts, spec: capSpec({ ...cur, quality: q }), ev: e, panel: true }); }
        }
        if (!segs.length) continue;
        const L = liveLines({ raceId: race.id, room: id, play: pid, launches: segs, now: tNow, speed, until: tEnd });
        simOf.get(id).plays.set(pid, { ...L, segs });
        for (const l of L.lines) flows.get(id).push({ t: Date.parse(l.ts), usd: l.dir === 'in' ? l.usd : -l.usd, e: { ...l, path: id }, dir: l.dir });
        for (const g of L.signals) simOf.get(id).signals.push({ ...g, path: id, t: Date.parse(g.ts) });
      }
    }
  }
  for (const f of flows.values()) f.sort((a, b) => a.t - b.t);
  // a simulation counts only simulated demand: nobody real saw anything
  const sigs = new Map(ids.map((id) => [id, sim ? simOf.get(id).signals.filter((s) => s.t >= t0 && s.t <= tNow) : (state.signals || []).filter((s) => s.path === id && inWindow(s.ts)).map((s) => ({ ...s, t: Date.parse(s.ts) }))]));
  const judged = new Map(ids.map((id) => [id, (state.judges || []).filter((j) => j.path === id && inWindow(j.ts)).map((j) => ({ ...j, t: Date.parse(j.ts) }))]));
  const logged = (id) => Object.values(state.plays || {}).filter((p) => p.path === id);
  // a play launched in the simulation but never logged as a play still shows, under the name it was launched with
  const ghosts = new Map(ids.map((id) => {
    const have = new Set(logged(id).map((p) => p.id)), out = new Map();
    for (const e of simEvents) if (e.path === id && e.act === 'launch' && !have.has(e.play) && !out.has(e.play)) out.set(e.play, { path: id, id: e.play, name: e.label || e.play, status: 'trying', plan: null, why: null, model: {}, method: null, startedAt: e.ts, updatedAt: e.ts, history: [{ id: e.id, ts: e.ts, status: 'trying', why: 'launched in the simulation', by: e.by }] });
    return [id, [...out.values()]];
  }));
  const playsOf = (id) => [...logged(id), ...ghosts.get(id)];
  const stepsOf = (id) => (state.steps || []).filter((s) => s.path === id && inWindow(s.ts));
  const researchOf = (id) => (state.research || []).filter((x) => x.path === id && inWindow(x.ts));
  const simActsOf = (id) => simEvents.filter((e) => e.path === id && inWindow(e.ts));
  const movesOf = (id) => [...stepsOf(id), ...researchOf(id), ...simActsOf(id), ...playsOf(id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)))].map((m) => Date.parse(m.ts)).sort((a, b) => a - b);

  // ---- rule breaks the ledger can see: each one dated, so a penalty lands when it happened
  const usd = (v) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const allowedMethods = new Set([...rules.methods, ...rules.customMethods.map((m) => m.toLowerCase())]);
  const banned = rules.banned.map((w) => w.toLowerCase()).filter(Boolean);
  const hasBanned = (txt) => { const t = String(txt || '').toLowerCase(); return banned.find((w) => t.includes(w)) || null; };
  const clock = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
  const hm = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const quiet = (t) => { if (!rules.quietHours) return false; const m = clock(t), a = hm(rules.quietHours.from), b = hm(rules.quietHours.to); return a <= b ? m >= a && m < b : m >= a || m < b; };
  const breaksOf = (id) => {
    const out = [], brk = (t, rule, text) => out.push({ t, ts: iso(t), day: dayOf(iso(t)), min: minOf(iso(t)), rule, text });
    let spent = 0, bank = stakeOf(id);
    const perDay = new Map(), plays = playsOf(id);
    for (const f of flows.get(id)) {
      bank = r2(bank + f.usd);
      if (f.dir !== 'out') continue;
      const e = f.e, amt = -f.usd;
      // a simulated day's cost of goods sold is not a purchase anyone decides on: no approval, no spend cap
      if (e.sim && e.category === 'capital') continue;
      spent = r2(spent + amt);
      const d = Math.floor((f.t - t0) / DAY), today = r2((perDay.get(d) || 0) + amt); perDay.set(d, today);
      if (!rules.spendCategories.includes(e.category)) brk(f.t, 'category', `${usd(amt)} spent on ${SPEND_CATEGORIES[e.category] || e.category}, which this race does not allow`);
      if (rules.maxSpendPerDayUsd !== null && today > rules.maxSpendPerDayUsd && today - amt <= rules.maxSpendPerDayUsd) brk(f.t, 'dailyCap', `spent ${usd(today)} in a day, over the ${usd(rules.maxSpendPerDayUsd)} limit`);
      if (rules.maxTotalSpendUsd !== null && spent > rules.maxTotalSpendUsd && spent - amt <= rules.maxTotalSpendUsd) brk(f.t, 'totalCap', `spent ${usd(spent)} in all, over the ${usd(rules.maxTotalSpendUsd)} limit`);
      if (rules.approveOverUsd !== null && amt > rules.approveOverUsd && !e.approved && !e.sim) brk(f.t, 'approval', `a ${usd(amt)} purchase over ${usd(rules.approveOverUsd)} without Joshua's yes`);
      if (rules.reserveUsd !== null && bank < rules.reserveUsd) brk(f.t, 'reserve', `the bankroll fell to ${usd(bank)}, under the ${usd(rules.reserveUsd)} it must keep`);
      if (!rules.reinvest && spent > stakeOf(id) && spent - amt <= stakeOf(id)) brk(f.t, 'reinvest', 'spent money it made; this race allows spending only the stake');
      if (rules.requireModel && e.play) { const p = plays.find((x) => x.id === e.play); if (!p || !p.modelAt || Date.parse(p.modelAt) > f.t) brk(f.t, 'model', `spent ${usd(amt)} on a play before logging what it sells and to whom`); }
      const b = hasBanned(`${e.payee || ''} ${e.item || ''} ${e.evidence || ''}`); if (b) brk(f.t, 'banned', `money line mentions ${b}`);
    }
    // a paper race moves no real money at all, and neither does a simulation
    if (rules.moneyMode === 'paper') for (const f of flows.get(id)) brk(f.t, 'paper', `moved ${usd(Math.abs(f.usd))} of real money in a paper race`);
    if (sim) for (const f of realInSim.get(id)) brk(f.t, 'sim', `moved ${usd(Math.abs(f.usd))} of real money in a simulation`);
    for (const f of flows.get(id)) if (f.dir === 'in') { const b = hasBanned(`${f.e.item || ''} ${f.e.source || ''}`); if (b) brk(f.t, 'banned', `sale through ${b}`); }
    for (const p of plays) {
      const h0 = p.history.find((h) => inWindow(h.ts)); if (!h0) continue;
      if (!rules.anyMethod && p.method && !allowedMethods.has(String(p.method).toLowerCase())) brk(Date.parse(h0.ts), 'method', `"${p.name}" is ${RACE_METHODS[p.method] ? RACE_METHODS[p.method].split(':')[0].toLowerCase() : p.method}, which this race does not allow`);
      const b = hasBanned(`${p.name} ${Object.values(p.model || {}).join(' ')} ${p.plan || ''}`); if (b) brk(Date.parse(h0.ts), 'banned', `"${p.name}" uses ${b}`);
    }
    for (const s of stepsOf(id)) {
      const b = hasBanned(s.text); if (b) brk(Date.parse(s.ts), 'banned', `a step mentions ${b}`);
      const t = Date.parse(s.ts);
      if (s.by !== 'user' && quiet(t)) brk(t, 'quiet', `worked during quiet hours (${rules.quietHours.from}-${rules.quietHours.to})`);
      if (s.by !== 'user' && rules.weekdaysOnly && [0, 6].includes(new Date(t).getDay())) brk(t, 'weekend', 'worked on a weekend');
    }
    // a day with no step at all, when every day needs a report
    if (rules.dailyReport) { const st = stepsOf(id).map((s) => Date.parse(s.ts)); for (let d = 0; t0 + (d + 1) * DAY <= tNow; d++) if (!st.some((t) => t >= t0 + d * DAY && t < t0 + (d + 1) * DAY)) brk(t0 + (d + 1) * DAY - 1, 'report', `no report on day ${d + 1}`); }
    return out.sort((a, b) => a.t - b.t);
  };
  const breaks = new Map(ids.map((id) => [id, breaksOf(id)]));
  const finesAt = (id, t) => (rules.ruleBreak === 'fine' ? r2(breaks.get(id).filter((b) => b.t <= t).length * (rules.fineUsd || 0)) : 0);

  // ---- the score, at any moment: what the race is judged on
  const metricAt = (id, t) => {
    const f = flows.get(id).filter((x) => x.t <= t), ins = f.filter((x) => x.dir === 'in');
    const inU = sum(ins, (x) => x.usd), outU = sum(f.filter((x) => x.dir === 'out'), (x) => -x.usd), stake = stakeOf(id);
    const bank = r2(stake + inU - outU - finesAt(id, t));
    switch (rules.scoring) {
      case 'profit': return r2(bank - stake);
      case 'multiple': return Math.round((bank / stake) * 1000) / 1000;
      case 'revenue': return r2(inU - finesAt(id, t));
      case 'roi': return r2(inU / Math.max(outU, 1));
      case 'sales': return ins.length;
      case 'customers': return new Set(ins.map((x) => String(x.e.source || '').trim().toLowerCase())).size;
      case 'signals': return r2(sigs.get(id).filter((s) => s.t <= t).reduce((a, s) => a + s.count * (rules.signalWeights[s.type] ?? 0), 0));
      case 'judge': return r2(judged.get(id).filter((j) => j.t <= t).reduce((a, j) => a + j.points, 0));
      case 'firstDollar': return ins.length ? -Math.round((ins[0].t - t0) / MIN) : -1e9;
      case 'consistency': {
        const n = Math.floor((t - t0) / step); if (n < 1) return 0;
        let up = 0; for (let i = 0; i < n; i++) if (bankAt(id, t0 + (i + 1) * step) > bankAt(id, t0 + i * step)) up += 1;
        return Math.round((up / n) * 1000) / 10;
      }
      default: return bank;
    }
  };
  const bankAt = (id, t) => r2(stakeOf(id) + flows.get(id).reduce((s, f) => (f.t <= t ? s + f.usd : s), 0) - finesAt(id, t));
  const scoreText = (v) => {
    switch (rules.scoring) {
      case 'multiple': return '×' + (v >= 10 ? v.toFixed(1) : v.toFixed(2));
      case 'roi': return `$${v.toFixed(2)} per $1`;
      case 'sales': return `${v} sale${v === 1 ? '' : 's'}`;
      case 'customers': return `${v} customer${v === 1 ? '' : 's'}`;
      case 'signals': return `${v} demand`;
      case 'judge': return `${v} pts`;
      case 'consistency': return `${v}% up`;
      case 'firstDollar': return v <= -1e9 ? 'no sale yet' : `first sale ${short ? `${Math.floor(-v / 60)}:${String(-v % 60).padStart(2, '0')}` : `day ${Math.floor(-v / 1440) + 1}`}`;
      case 'profit': return (v < 0 ? '-' : '+') + usd(Math.abs(Math.round(v)));
      default: return usd(Math.round(v));
    }
  };
  // when a room's score first reached a value, how much it had spent, how many sales: the tie-breaks
  const reachedAt = (id, target) => {
    const ts = [t0, ...flows.get(id).map((f) => f.t), ...sigs.get(id).map((s) => s.t), ...judged.get(id).map((j) => j.t)].filter((t) => t <= tNow).sort((a, b) => a - b);
    for (const t of ts) if (metricAt(id, t) >= target) return t;
    return Infinity;
  };
  const spentAt = (id, t) => sum(flows.get(id).filter((x) => x.dir === 'out' && x.t <= t), (x) => -x.usd);
  const salesAt = (id, t) => flows.get(id).filter((x) => x.dir === 'in' && x.t <= t).length;

  // ---- who is out, and when: the knockout line, going quiet, a rule break (if that knocks out), last place at a prize
  const outAt = new Map(), outWhy = new Map();
  const knock = (id, t, why) => { if (!outAt.has(id) || t < outAt.get(id)) { outAt.set(id, t); outWhy.set(id, why); } };
  for (const id of ids) {
    if (rules.knockoutUsd !== null) { let b = stakeOf(id); for (const f of flows.get(id)) { b = r2(b + f.usd); if (b <= rules.knockoutUsd) { knock(id, f.t, `bankroll fell to ${usd(b)}`); break; } } }
    if (rules.idleOutMinutes) { const ts = [t0, ...movesOf(id), tNow]; for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > rules.idleOutMinutes * MIN) { knock(id, ts[i - 1] + rules.idleOutMinutes * MIN, `no move for ${spanLabel(rules.idleOutMinutes)}`); break; } }
    if (rules.ruleBreak === 'out' && breaks.get(id).length) { const b = breaks.get(id)[0]; knock(id, b.t, `broke a rule: ${b.text}`); }
  }
  const isOut = (id, t) => outAt.has(id) && outAt.get(id) <= t;
  const rankAt = (t) => ids.map((id) => ({ id, score: metricAt(id, t), bankrollUsd: bankAt(id, t), out: isOut(id, t) }))
    .map((r) => ({ ...r, multiple: r2(r.bankrollUsd / stakeOf(r.id)), profitUsd: r2(r.bankrollUsd - stakeOf(r.id)), scoreText: scoreText(r.score) }))
    .sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || b.score - a.score || ids.indexOf(a.id) - ids.indexOf(b.id));
  // among rooms tied on the score, the tie-break decides; a tie it cannot break stays a tie
  const breakTie = (tied, t) => {
    const key = rules.tiebreak === 'earliest' ? (r) => reachedAt(r.id, r.score) : rules.tiebreak === 'leastSpent' ? (r) => spentAt(r.id, t) : rules.tiebreak === 'mostSales' ? (r) => -salesAt(r.id, t) : null;
    if (!key) return null;
    const ks = tied.map((r) => ({ r, k: key(r) })).sort((a, b) => a.k - b.k);
    return ks.length > 1 && ks[0].k === ks[1].k ? null : ks[0].r;
  };

  // one prize per time limit, locked the moment it passes; the last-place room goes out there if the race says so
  let liveSet = false;
  const standings = hz.map((h, hi) => {
    const tH = t0 + h * MIN, done = now >= tH, at = Math.min(now, tH);
    const ranking = rankAt(at), live = ranking.filter((r) => !r.out);
    let tie = live.length > 1 && live[0].score === live[1].score, top = live[0] || null, tieBroken = false;
    if (tie) { const w = breakTie(live.filter((r) => r.score === live[0].score), at); if (w) { top = w; tie = false; tieBroken = true; } }
    // the podium: the top, then the next best, up to the race's number of places
    const podium = top && !tie ? [top, ...live.filter((r) => r !== top)].slice(0, rules.places).map((r) => r.id) : [];
    let eliminated = null;
    if (done && rules.eliminateLast && hi < hz.length - 1 && live.length > 1) { eliminated = live[live.length - 1].id; knock(eliminated, tH, `last place at ${spanLabel(h)}`); }
    const stateH = done ? 'done' : liveSet ? 'upcoming' : 'live';
    if (!done) liveSet = true;
    return {
      mins: h, days: h / 1440, label: spanLabel(h), endsAt: iso(tH), state: stateH, minsLeft: done ? 0 : Math.ceil((tH - now) / MIN), daysLeft: done ? 0 : Math.ceil((tH - now) / DAY),
      ranking, leader: !tie && top ? top.id : null, winner: done && !tie && top ? top.id : null, podium: done ? podium : [], tie, tieBroken, eliminated,
    };
  });

  // ---- the simulation's record for a room: variants tested (the best of them), what it built, what it found on the web
  const netAt = (r) => r.net.find((x) => x.days === 30) || r.net[r.net.length - 1];
  const slimVariant = (v) => ({ label: v.label, line: specLine(v.spec), channel: v.spec.channel, price: v.spec.price, recurring: v.spec.recurring, net: v.result.net, pProfit: v.result.pProfit, breakEvenDay: v.result.breakEvenDay, sales: v.result.sales, hours: v.result.hours, flags: v.flags, drivers: v.drivers || [], cited: v.cited, set: v.set, ts: v.ts, play: v.play, horizons: v.result.horizons, room: v.room });
  const variantsOf = (acts) => acts.filter((e) => e.act === 'test').flatMap((e) => e.variants.map((v) => ({ ...v, ts: e.ts, play: e.play || null, room: e.path })));
  const simLane = (id, acts, research) => {
    const variants = variantsOf(acts);
    const builds = acts.filter((e) => e.act === 'build').map((e) => ({ id: e.id, ts: e.ts, what: e.what, title: e.title, to: e.to || null, format: e.format || 'text', size: e.content.length, play: e.play || null })).reverse();
    return {
      tests: acts.filter((e) => e.act === 'test').length, variants: variants.length,
      top: variants.sort((a, b) => netAt(b.result).p50 - netAt(a.result).p50).slice(0, 8).map(slimVariant),
      builds: builds.slice(0, 40), buildCount: builds.length, panels: acts.filter((e) => e.act === 'panel').length,
      live: [...simOf.get(id).plays.values()].filter((L) => L.live).length,
      research: research.length, researchList: research.slice(-12).reverse().map(({ id: rid, ts, title, url, topic, text, numbers, play }) => ({ id: rid, ts, title, url, topic, text, numbers, play })),
    };
  };

  const lanes = ids.map((id) => {
    const f = flows.get(id), stake = stakeOf(id);
    const ins = f.filter((x) => x.dir === 'in'), outs = f.filter((x) => x.dir === 'out');
    const inUsd = sum(ins, (x) => x.usd), outUsd = sum(outs, (x) => -x.usd), fines = finesAt(id, tNow);
    const bankrollUsd = r2(stake + inUsd - outUsd - fines);
    // the rate: over the recent window, and since the gun
    const wR = Math.max(t0, tNow - recent);
    const rateRecent = perUnit(bankrollUsd - bankAt(id, wR - 1), tNow - wR);
    const rateAll = perUnit(bankrollUsd - stake, elapsed);
    const steps = stepsOf(id);
    const line = (x) => ({ ts: x.e.ts, day: dayOf(x.e.ts), min: minOf(x.e.ts), usd: Math.abs(x.usd), text: x.dir === 'in' ? (x.e.item || x.e.source) : (x.e.payee || x.e.category), source: x.e.source || null, category: x.e.category || null, evidence: x.e.evidence || null, id: x.e.id, ...(x.e.sim ? { sim: true } : {}) });
    const simRoom = simOf.get(id), research = researchOf(id), acts = simActsOf(id);
    const psig = (pid) => sigs.get(id).filter((s) => s.play === pid);
    // a play in the simulated market: what it runs now, how long, what it forecast when it launched
    const simPlay = (pid) => {
      const launches = acts.filter((e) => e.play === pid && e.act === 'launch');
      if (!launches.length) return null;
      const last = launches[launches.length - 1], L = simRoom.plays.get(pid), stopped = acts.filter((e) => e.play === pid && e.act === 'stop').pop();
      const live = L ? L.live : !(stopped && stopped.ts > last.ts);
      const panel = acts.filter((e) => e.play === pid && e.act === 'panel').pop();
      return {
        live, launches: launches.length, since: launches[0].ts, spec: last.spec, line: specLine(last.spec), label: last.label || null, flags: last.flags || [], drivers: last.drivers || [], cited: last.cited || 0, set: last.set || 0,
        forecast: last.forecast || null, simDays: L && L.days.length ? L.days[L.days.length - 1].simDay : 0,
        reach: L ? L.days.reduce((a, d) => a + d.reach, 0) : 0, lost: L ? L.days.reduce((a, d) => a + d.lost, 0) : 0, hours: L ? r2(L.days.reduce((a, d) => a + d.hours, 0)) : 0,
        subs: L && L.state ? L.state.subs : 0, panel: panel ? { score: panel.score, n: panel.n, quality: panel.quality, notes: panel.notes || null, ts: panel.ts } : null,
        stopped: stopped && stopped.ts > last.ts ? { ts: stopped.ts, why: stopped.why || null } : null,
      };
    };
    // the plays: every way this room tried to make money, and the business model behind each
    const plays = playsOf(id).map((p) => {
      const history = p.history.filter((h) => inWindow(h.ts));
      if (!history.length) return null;
      const mine = f.filter((x) => x.e.play === p.id), pin = mine.filter((x) => x.dir === 'in'), pout = mine.filter((x) => x.dir === 'out');
      const inP = sum(pin, (x) => x.usd), outP = sum(pout, (x) => -x.usd), from = Date.parse(history[0].ts), cur = history[history.length - 1];
      const psteps = steps.filter((s) => s.play === p.id);
      return {
        id: p.id, name: p.name, brand: p.brand || null, status: cur.status, plan: p.plan, why: cur.why, model: { ...(p.model || {}) }, method: p.method || null,
        startedAt: history[0].ts, updatedAt: cur.ts, startedDay: dayOf(history[0].ts), startedMin: minOf(history[0].ts),
        activeMin: Math.max(0, Math.round(((cur.status === 'dropped' ? Date.parse(cur.ts) : tNow) - from) / MIN)),
        inUsd: inP, outUsd: outP, netUsd: r2(inP - outP), sales: pin.length,
        rate: perUnit(inP - outP, tNow - from),
        avgSaleUsd: pin.length ? r2(inP / pin.length) : null, costPerSaleUsd: pin.length && outP ? r2(outP / pin.length) : null,
        backPerDollar: outP > 0 ? r2(inP / outP) : null, firstSaleDay: pin.length ? dayOf(pin[0].e.ts) : null, firstSaleMin: pin.length ? minOf(pin[0].e.ts) : null,
        bySource: groupBy(pin.map((x) => ({ usd: x.usd, src: x.e.source })), (x) => x.src),
        byCategory: groupBy(pout.map((x) => ({ usd: -x.usd, cat: x.e.category })), (x) => x.cat),
        signals: psig(p.id).reduce((a, s) => a + s.count, 0),
        sim: simPlay(p.id),
        history: history.map((h) => ({ ts: h.ts, day: dayOf(h.ts), min: minOf(h.ts), status: h.status, why: h.why })),
        steps: psteps.length, stepList: psteps.slice(-60).reverse().map((s) => ({ ts: s.ts, day: dayOf(s.ts), min: minOf(s.ts), type: s.type, text: s.text, url: s.url })),
        money: mine.slice(-50).reverse().map((x) => ({ ...line(x), dir: x.dir })),
      };
    }).filter(Boolean).sort((a, b) => b.netUsd - a.netUsd || (a.startedAt < b.startedAt ? -1 : 1));
    const named = new Set(plays.map((p) => p.id));
    // the business the room is betting on: its newest working play, else its newest live one in the simulation, else
    // its newest play still being tried. The room takes that business's name.
    const byNew = (a, b) => (a.updatedAt < b.updatedAt ? 1 : -1);
    const bet = plays.filter((p) => p.status === 'working').sort(byNew)[0] || plays.filter((p) => p.sim && p.sim.live).sort(byNew)[0] || plays.filter((p) => p.status === 'trying').sort(byNew)[0] || null;
    const loose = f.filter((x) => !x.e.play || !named.has(x.e.play));
    const planStep = steps.filter((s) => s.type === 'plan').pop() || null;
    // the agent's latest move: a step or a play started, changed or dropped (money arriving on its own is not a move)
    const moves = [...steps, ...research, ...acts, ...playsOf(id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)))];
    const latest = moves.sort(byTs).pop() || null;
    const playName = (pid) => (plays.find((p) => p.id === pid) || {}).name || null;
    const sg = sigs.get(id);
    // the full breakdown: every step, every play started or changed, every dollar in or out, newest first
    const items = [
      ...steps.map((s) => ({ ts: s.ts, kind: 'step', type: s.type, text: s.text, url: s.url, play: s.play, by: s.by, id: s.id })),
      ...playsOf(id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)).map((h, i) => ({ ts: h.ts, kind: 'play', status: h.status, first: i === 0, text: p.name, why: h.why, play: p.id, by: h.by, id: h.id }))),
      ...f.map((x) => ({ ...line(x), kind: x.dir, play: x.e.play || null })),
      ...sg.map((s) => ({ ts: s.ts, kind: 'signal', type: s.type, count: s.count, text: `${s.count} ${s.count === 1 ? SIGNAL_TYPES[s.type].toLowerCase() : SIGNAL_PLURAL[s.type]}`, evidence: s.evidence, play: s.play, id: s.id })),
      ...judged.get(id).map((j) => ({ ts: j.ts, kind: 'judge', points: j.points, text: j.why, play: j.play, id: j.id })),
      ...breaks.get(id).map((b) => ({ ts: b.ts, kind: 'break', rule: b.rule, text: b.text, id: 'break:' + b.rule + b.t })),
      ...research.map((x) => ({ ts: x.ts, kind: 'research', topic: x.topic, text: x.title, url: x.url, play: x.play, id: x.id })),
      ...acts.map((e) => ({ ts: e.ts, kind: 'sim', act: e.act, play: e.play || null, id: e.id,
        text: e.act === 'test' ? `tested ${e.variants.length} variant${e.variants.length === 1 ? '' : 's'}; best: ${e.variants[0].label}`
          : e.act === 'launch' ? `launched ${specLine(e.spec)}` : e.act === 'stop' ? `stopped${e.why ? `: ${e.why}` : ''}`
            : e.act === 'build' ? `built ${SIM_ARTIFACTS[e.what].toLowerCase()}: ${e.title}` : `a panel of ${e.n} read it: ${Math.round(e.score * 100)}% would act`,
        ...(e.act === 'build' ? { what: e.what } : {}) })),
    ].map((x) => ({ ...x, day: dayOf(x.ts), min: minOf(x.ts), playName: x.play ? playName(x.play) : null })).sort((a, b) => -byTs(a, b));
    const out = outAt.has(id) && outAt.get(id) <= tNow ? { ts: iso(outAt.get(id)), day: dayOf(iso(outAt.get(id))), min: minOf(iso(outAt.get(id))), why: outWhy.get(id) } : null;
    const score = metricAt(id, tNow);
    return {
      id, title: bet ? bet.brand || bet.name : null, bet: bet ? { play: bet.id, name: bet.name, brand: bet.brand, offer: bet.model.offer || null, method: bet.method } : null, stakeUsd: stake, bankrollUsd, inUsd, outUsd, netUsd: r2(inUsd - outUsd), profitUsd: r2(bankrollUsd - stake), multiple: r2(bankrollUsd / stake), score, scoreText: scoreText(score), rateRecent, rateAll,
      sales: ins.length, customers: new Set(ins.map((x) => String(x.e.source || '').trim().toLowerCase())).size, backPerDollar: outUsd > 0 ? r2(inUsd / outUsd) : null, model: rules.models[id] || null, notes: rules.roomNotes[id] || null, out, fines,
      // where the money came from, and where it went
      bySource: groupBy(ins.map((x) => ({ usd: x.usd, src: x.e.source })), (x) => x.src),
      byCategory: groupBy(outs.map((x) => ({ usd: -x.usd, cat: x.e.category })), (x) => x.cat),
      // demand shown without a sale, and the rule breaks the ledger saw
      signals: Object.entries(sg.reduce((a, s) => { a[s.type] = (a[s.type] || 0) + s.count; return a; }, {})).map(([type, n]) => ({ type, n, weight: rules.signalWeights[type] ?? 0 })).sort((a, b) => b.n * b.weight - a.n * a.weight),
      signalScore: r2(sg.reduce((a, s) => a + s.count * (rules.signalWeights[s.type] ?? 0), 0)),
      judgePoints: r2(judged.get(id).reduce((a, j) => a + j.points, 0)),
      breaks: breaks.get(id).filter((b) => b.t <= tNow).map(({ t, ...b }) => b),
      // what running this room's agent really cost (its model use): real money, never part of the score
      apiUsd: apiUsd.get(id),
      sim: sim || acts.length || research.length ? simLane(id, acts, research) : null,
      forecast: race.forecasts && race.forecasts[id] ? race.forecasts[id] : null,
      uncounted: uncounted.get(id).map((x) => ({ ...line(x), dir: x.dir })),
      plays, loose: loose.length ? { inUsd: sum(loose.filter((x) => x.dir === 'in'), (x) => x.usd), outUsd: sum(loose.filter((x) => x.dir === 'out'), (x) => -x.usd), n: loose.length } : null,
      plan: planStep ? { text: planStep.text, ts: planStep.ts, day: dayOf(planStep.ts), min: minOf(planStep.ts) } : null,
      // the room's latest move is saying it is stuck and needs a person: shown until it makes any other move
      blocked: latest && latest.type === 'blocked' ? { text: latest.text, ts: latest.ts, day: dayOf(latest.ts), min: minOf(latest.ts) } : null,
      // the bankroll at each chart step so far (index 0 is the gun): what the room's chart draws
      series: Array.from({ length: Math.max(1, Math.ceil(elapsed / step)) + 1 }, (_, i) => bankAt(id, Math.min(tNow, t0 + i * step))),
      lastAt: items.length ? items[0].ts : null,
      timeline: items.slice(0, timeline), timelineTotal: items.length,
    };
  });
  // ties share a place; a knocked-out room ranks below every room still in
  const rank = (a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || b.score - a.score;
  for (const l of lanes) l.place = 1 + lanes.filter((o) => rank(o, l) < 0).length;
  const order = lanes.slice().sort((a, b) => rank(a, b) || ids.indexOf(a.id) - ids.indexOf(b.id));
  let leaderId = order[0] && !order[0].out ? order[0].id : null;
  if (order.length > 1 && !order[1].out && order[0].score === order[1].score) { const w = breakTie(order.filter((l) => !l.out && l.score === order[0].score).map((l) => ({ id: l.id, score: l.score })), tNow); leaderId = w ? w.id : null; }
  const sources = new Map();
  for (const l of lanes) for (const src of l.bySource) { const g = sources.get(src.key) || { key: src.key, usd: 0, n: 0, rooms: [] }; g.usd = r2(g.usd + src.usd); g.n += src.n; g.rooms.push(l.id); sources.set(src.key, g); }
  return {
    name: race.name, id: race.id, startedAt: race.startedAt, setAt: race.setAt || race.startedAt, endsAt: iso(tEnd), stakeUsd: race.stakeUsd, evidence: race.evidence, rules,
    purpose: rules.purpose === 'custom' ? rules.purposeText || RACE_PURPOSES.custom : RACE_PURPOSES[rules.purpose] || '', paper: rules.moneyMode === 'paper',
    mode: rules.moneyMode, simMode: sim, apiUsd: sum(ids, (id) => apiUsd.get(id)),
    // everything the simulation found and tried, across every room: the web research, and the best ideas it has tested
    sim: sim || simEvents.length || (state.research || []).some((x) => ids.includes(x.path) && inWindow(x.ts)) ? {
      speed, speedLabel: SIM_SPEEDS[speed] || `about ${Math.round((speed * last) / 1440)} simulated days over the whole race`,
      research: (state.research || []).filter((x) => ids.includes(x.path) && inWindow(x.ts)).slice(-80).reverse().map(({ id: rid, ts, path: room, title, url, topic, text, numbers }) => ({ id: rid, ts, room, title, url, topic, topicLabel: RESEARCH_TOPICS[topic], text, numbers })),
      topIdeas: variantsOf(simEvents.filter((e) => inWindow(e.ts))).sort((a, b) => netAt(b.result).p50 - netAt(a.result).p50).slice(0, 12).map(slimVariant),
      totals: {
        research: (state.research || []).filter((x) => ids.includes(x.path) && inWindow(x.ts)).length,
        tests: simEvents.filter((e) => e.act === 'test' && inWindow(e.ts)).length,
        variants: variantsOf(simEvents.filter((e) => inWindow(e.ts))).length,
        builds: simEvents.filter((e) => e.act === 'build' && inWindow(e.ts)).length,
        live: ids.reduce((a, id) => a + [...simOf.get(id).plays.values()].filter((L) => L.live).length, 0),
      },
    } : null,
    fromSim: race.fromRace ? { raceId: race.fromRace } : null,
    horizonsMin: hz, horizons: hz.map((m) => m / 1440), short, rateUnit: short ? 'hour' : 'day', recentLabel: short ? spanLabel(recent / MIN) : '7 days', stepMin: step / MIN,
    elapsedMin: Math.floor(elapsed / MIN), totalMin: last, startsInMin: now < t0 ? Math.ceil((t0 - now) / MIN) : 0,
    amendments: race.amendments || [],
    started: now >= t0, startsInDays: now < t0 ? Math.ceil((t0 - now) / DAY) : 0,
    day: now < t0 ? 0 : Math.min(Math.ceil(last / 1440), Math.floor((now - t0) / DAY) + 1), totalDays: Math.ceil(last / 1440), elapsedDays: r2(elapsed / DAY), over: now >= tEnd,
    stakedUsd: sum(ids, stakeOf), potUsd: sum(lanes, (l) => l.bankrollUsd), inUsd: sum(lanes, (l) => l.inUsd), outUsd: sum(lanes, (l) => l.outUsd),
    leaderId, breakCount: lanes.reduce((a, l) => a + l.breaks.length, 0),
    // every room's income sources added up: where the race's money is coming from
    bySource: [...sources.values()].sort((a, b) => b.usd - a.usd),
    lanes, standings,
  };
}

// The brief an agent gets, written from the race's rules. Paste it into the agent's session. Every rule the setup
// offers lands here in plain words, so a rule Joshua picked is a rule the agent reads.
export function raceBrief(board, roomId, { roomName, lead, station = 'the station' } = {}) {
  if (!board) return '';
  const r = { ...defaultRaceRules(), ...board.rules }, lane = board.lanes.find((l) => l.id === roomId);
  const every = r.everyMinutes ?? (r.everyHours || 24) * 60;
  const stake = lane ? lane.stakeUsd : board.stakeUsd, name = roomName || roomId, usd = (v) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const paper = r.moneyMode === 'paper', sim = r.moneyMode === 'sim';
  const allowed = [...r.methods.map((m) => RACE_METHODS[m]), ...r.customMethods].map((m) => `  - ${m}`).join('\n');
  const barred = Object.keys(RACE_METHODS).filter((m) => !r.methods.includes(m)).map((m) => `  - ${RACE_METHODS[m]}`).join('\n');
  const cats = Object.keys(SPEND_CATEGORIES), noCats = cats.filter((c) => !r.spendCategories.includes(c));
  const ul = (xs) => xs.filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join('\n');
  // the house rules: the same in every race, whatever the setup says
  const house = ul([
    'Legal, honest, and inside every platform\'s terms.',
    'No fake reviews, no pretending to be anyone, no spam, no bought followers, no scraping behind a login.',
    'Money counts only with evidence. A claim without it never scores.',
    'Anything that needs Joshua\'s identity (an ID check, a payment account, a tax form) is logged as a "blocked" step for him.',
  ]);
  const people = sim ? ul([
    'Nobody real is contacted in a simulation, whatever else this brief says. Every message you would send, you write in full and build in the sandbox, addressed to the kind of person it would go to.',
    'Nothing is posted, published, listed or submitted anywhere real. Posts, pages and listings are built in the sandbox.',
    r.useName === 'never' ? 'Never use Joshua\'s name, anywhere, even in the sandbox.' : 'You may write Joshua\'s name into what you build, for the day it goes out for real.',
    'Do not open any account anywhere. Reading public pages is fine; signing up is not.',
  ]) : ul([
    r.outreach === 'none' ? 'Do not contact any person, by any channel, for any reason.'
      : r.outreach === 'direct' ? `You may message people yourself: honest, signed as an AI agent working for Joshua, with a clear way to opt out, and never the same person twice without a reply. At most ${r.maxMessagesPerDay ?? 'unlimited'} messages a day.`
      : 'You never send or message a person yourself. Draft it, put it in the dock, and log a "blocked" step saying exactly what is waiting and why. Keep working on something else while you wait.',
    r.posting === 'none' ? 'Nothing is posted publicly, not even as a draft.' : r.posting === 'direct' ? 'You may post publicly yourself, under the room\'s own name.' : 'Public posts are drafts: Joshua publishes them or drops them.',
    r.useName === 'never' ? 'Never use Joshua\'s name, anywhere.' : r.useName === 'drafts' ? 'Joshua\'s name appears only in drafts he sends himself.' : 'You may use Joshua\'s name, honestly.',
    r.personalNetwork ? 'You may reach Joshua\'s own contacts and network, through drafts he approves.' : 'Stay away from Joshua\'s own contacts, friends and family.',
    r.newAccounts === 'never' ? 'Do not open any new account anywhere.' : r.newAccounts === 'allowed' ? 'You may open new accounts you need, in the room\'s own name.' : 'A new account anywhere is a "blocked" step: ask Joshua first.',
  ]);
  const money = sim
    ? ul([
      'This is a SIMULATION: no real money moves. Never buy, sell, charge or pay for anything; a real money line breaks the rules.',
      'Your spend rules still hold for simulated spending (ads, tools, stock):',
      noCats.length ? `  never spend on: ${noCats.map((c) => SPEND_CATEGORIES[c].toLowerCase()).join(', ')}` : null,
      r.maxSpendPerDayUsd !== null ? `  at most ${usd(r.maxSpendPerDayUsd)} of simulated spend a day` : null,
      r.maxMessagesPerDay !== null && r.outreach !== 'none' ? `  at most ${r.maxMessagesPerDay} simulated messages a day` : null,
      r.knockoutUsd !== null ? `If your simulated bankroll falls to ${usd(r.knockoutUsd)} you are out of the race.` : null,
    ])
    : paper
    ? ul([
      'This is a PAPER race: no real money moves. Do not buy, sell, charge or pay for anything. A real money line breaks the rules.',
      'Prove the idea instead: what you would sell, to whom, at what price, and real demand for it (sign-ups, replies, waitlists, pre-order intent), each with evidence.',
    ])
    : ul([
      `Spend only your own stake${r.reinvest ? ' and what you make' : '; money you make is not for spending'}, and log every dollar out the same day with a receipt.`,
      noCats.length ? `Never spend on: ${noCats.map((c) => SPEND_CATEGORIES[c].toLowerCase()).join(', ')}.` : null,
      r.maxSpendPerDayUsd !== null ? `Spend at most ${usd(r.maxSpendPerDayUsd)} in any one day.` : null,
      r.maxTotalSpendUsd !== null ? `Spend at most ${usd(r.maxTotalSpendUsd)} in the whole race.` : null,
      r.approveOverUsd !== null ? `Any single purchase over ${usd(r.approveOverUsd)} needs Joshua first: log it as "blocked" and wait. Log it with --approved once he says yes.` : null,
      r.reserveUsd !== null ? `Always keep at least ${usd(r.reserveUsd)} in the bankroll.` : null,
      r.knockoutUsd !== null ? `If your bankroll falls to ${usd(r.knockoutUsd)} you are out of the race.` : null,
      r.requireModel ? 'Before a play spends anything, log what it sells and to whom (--offer and --customer).' : null,
    ]);
  const scoreLine = {
    bankroll: 'bankroll = your stake + money in - money out', profit: 'profit = money in - money out', multiple: 'multiple = bankroll / stake',
    revenue: 'money in, before anything you spend', roi: 'dollars in for every dollar spent', sales: 'number of sales', customers: 'number of different customers (by where each paid)',
    signals: `demand: ${Object.entries(r.signalWeights).filter(([, w]) => w > 0).map(([k, w]) => `${SIGNAL_TYPES[k].toLowerCase()} ${w}`).join(', ')} points each`,
    consistency: `share of ${spanLabel(board.stepMin)} periods your bankroll went up`, firstDollar: 'how soon your first evidenced sale lands', judge: 'Joshua\'s own points, given on the ledger with a reason',
  }[r.scoring];
  const outs = [
    r.knockoutUsd !== null && !paper ? `a bankroll of ${usd(r.knockoutUsd)} or less` : null,
    r.idleOutMinutes ? `${spanLabel(r.idleOutMinutes)} without a single move on the ledger` : null,
    r.eliminateLast ? 'last place at any prize time but the final one' : null,
    r.ruleBreak === 'out' ? 'breaking any rule the ledger can see' : null,
  ].filter(Boolean);
  const how = ul([
    r.tiebreak !== 'none' ? `A tie goes to ${{ earliest: 'whoever got there first', leastSpent: 'whoever spent less', mostSales: 'whoever made more sales' }[r.tiebreak]}.` : 'A tie means nobody wins that prize.',
    r.places > 1 ? `Each prize has ${r.places} places.` : null,
    outs.length ? `You are out for: ${outs.join('; ')}.` : null,
    r.ruleBreak === 'fine' ? `Each rule break the ledger sees costs you ${usd(r.fineUsd)}.` : r.ruleBreak === 'warn' ? 'A rule break is flagged on the board for everyone to see.' : null,
    { any: 'Evidence can be any note that proves it.', id: 'Evidence must carry an order, charge or payout number.', link: 'Evidence must be a link to the proof.' }[r.evidence] + ' Lines below that standard are shown but never counted.',
    paper || sim ? null : 'Anything you bought and still hold counts as zero until you sell it. Claude is free to you.',
  ]);
  const work = ul([
    every === 0 ? 'Work through the whole race in one session: keep going until the last prize time.' : `Check in every ${spanLabel(every).replace(/^1 (day|hour|week)$/, '$1')}.`,
    r.maxSessionMinutes ? `Keep each session under ${spanLabel(r.maxSessionMinutes)}.` : null,
    r.quietHours ? `Do no work between ${r.quietHours.from} and ${r.quietHours.to}.` : null,
    r.weekdaysOnly ? 'Work on weekdays only.' : null,
    r.dailyReport ? 'Log at least one step every day, even if it is "nothing moved, here is why".' : null,
    r.visibility === 'blind' ? 'Look only at your own room: do not read other rooms\' plays or steps.' : 'You may read the whole board, every room\'s plays included.',
    r.copying ? 'You may copy another room\'s idea; say so in the play\'s plan.' : 'Do not copy another room\'s play.',
    r.collab ? 'You may trade with other rooms, at fair prices, logged on both sides.' : 'Do not buy from, pay or split sales with another room.',
  ]);
  const custom = r.customRules.map((c) => `${RULE_KINDS[c.kind].toUpperCase()}: ${c.text}`);
  const purpose = r.purpose === 'custom' ? r.purposeText || '' : RACE_PURPOSES[r.purpose] || '';
  const roomNote = r.roomNotes[roomId];
  // the simulation's own section: how research, the sandbox and the market simulator work, and the channels it models
  const chanLines = Object.entries(SIM_CHANNELS).map(([k, c]) => `  - ${k}: ${c.title}. volume = ${c.unit}. Rates (typical): ${Object.entries(PRIORS[k].rates).map(([rk, b]) => `${rk} ${b.mid}`).join(', ')}.`).join('\n');
  const simBlock = sim ? `
How this simulation works:
${ul([
    'The real web is open to you, for reading. Research what is selling right now, what it sells for, who else sells it, where the buyers are, and what the platforms allow. Log every useful finding with its link (race research). A number in your plans is only as good as the page it came from.',
    'Nothing leaves this station. You never send, post, publish, list, submit, buy or sign up for anything real. Where you would, you build the real thing in the sandbox instead (race build): the full email, the full page (as HTML), the full listing, the proposal, the script. Build it to the standard you would send: the day Joshua presses REAL MONEY, what you built is what goes out.',
    'Before you commit to an idea, test it in the market simulator (race sim test): many variants at once, differing in channel, price, offer, volume and costs. The simulator starts every rate from published benchmarks. A rate better than the typical one counts only with a source (cites: { rate: url }); without one it is held to typical. So research first, then test.',
    'Launch your best variant (race sim launch). From then on the simulated market runs it on the race clock and its simulated sales and costs land on your bankroll. When you learn something, test again and relaunch with the new spec; stop what loses (race sim stop).',
    'Test widely, then go deep: dozens of variants are cheap, one launched play that works is the point.',
    'Always put at least one app idea through the simulator, even if you doubt it can work: a phone app, web app or micro-SaaS that earns while nobody works (channel "app": installs a day, the price, recurring for a subscription). Let the numbers decide.',
    'Do not game the simulator. An idea that only wins on an assumption nobody can check will be found out the day real people see it.',
  ])}
Speed: ${SIM_SPEEDS[r.simSpeed] || `${r.simSpeed} simulated days every real day`}.
Channels the simulator models:
${chanLines}
A variant file is a JSON list, e.g.
[{"label": "Etsy planner at $12", "spec": {"channel": "marketplace", "platform": "etsy", "price": 12, "volume": 10, "marketPrice": 9.5, "competition": "high", "trend": "rising", "cites": {"marketPrice": "https://..."}}},
 {"label": "Setup service by cold email", "spec": {"channel": "email", "price": 300, "volume": 40, "capacityPerDay": 1, "hoursPerSale": 3, "rates": {"reply": 0.05}, "cites": {"reply": "https://..."}}}]
Other spec fields: recurring (true for a monthly price) with churn, unitCost, feePct or platform, fixedPerMonth, capacityPerDay, hoursPerSale (a person's hours per sale), audience (how many buyers there are in all).
The market itself, from your research, is what the forecast should stand on: demand: {"monthly": attention the niche gets a month, "kind": "views"|"searches"|"posts"|"buyers", "sellers": how many compete for it, "growth": yearly growth (0.45 for +45%), "cites": {"monthly": url, "sellers": url, "growth": url}}. Monthly demand with a seller count sets your fair share of views or searches; job posts cap your proposals; buyers cap who can be reached; a sourced growth rate replaces the trend label. Uncited demand is ignored. Find these numbers first: they matter more than any other.
` : '';
  return `You are the room lead${lead ? ` (${lead})` : ''} for the ${name.toUpperCase()} room in a sandbox race run by Joshua Grigson${board.name ? `: ${board.name}` : ''}.
${purpose ? `\nWhat this race is for: ${purpose}.${r.purpose === 'idea' ? ' The winning idea is the one Joshua will run for real, so an idea only you could pull off is worth less than one a person can repeat.' : ''}\n` : ''}
You start with ${sim ? `a simulated stake of ${usd(stake)} (no real money)` : paper ? `a paper stake of ${usd(stake)} (no real money)` : `a stake of ${usd(stake)}`}. Your job is to ${r.scoring === 'signals' ? 'show as much real demand as you can' : r.scoring === 'judge' ? 'do the work Joshua will judge best' : 'turn it into as much as you can'}, any allowed way you choose, using Claude${lane && lane.model ? ` (${RACE_MODELS[lane.model] || lane.model})` : ''} and your connectors. Prizes: ${RACE_SCORING[r.scoring].split(':')[0].toLowerCase()} at ${board.horizonsMin.map(spanLabel).join(', ')} after the start. A strategy that wins the first prize can lose the last, so decide what you are playing for and say so in your plan.

How you are scored: ${sim ? 'simulated ' : ''}${scoreLine}, ${sim ? 'from the simulated market, ' : ''}logged on ${station}'s ledger since the starting gun.
${how}
${simBlock}

${r.anyMethod ? `Ways you may make money: ANY legal way your research supports. There is no list. Judge from what you find once the race starts: a steady business, a service, a product, or a high-risk, high-reward long shot if the research makes the case. Name the kind on each play with --method, in a word of your own (e.g. ${Object.keys(RACE_METHODS).slice(0, 6).join(', ')}, venture).
` : `Ways you may make money:
${allowed || '  - none (ask Joshua)'}
${r.methods.length ? `Name the kind on each play with --method: ${[...r.methods, ...r.customMethods].join(', ')}.\n` : ''}${barred ? `Not allowed in this race:\n${barred}\n` : ''}`}
Tools and connectors you may use: ${r.connectors.join(', ') || 'none'}.
${r.banned.length ? `Never use or mention: ${r.banned.join(', ')}.\n` : ''}
House rules (every race):
${house}

Money:
${money}

People and posting:
${people}

How you work:
${work}
${custom.length ? `\nJoshua's own rules:\n${custom.map((c) => `- ${c}`).join('\n')}\n` : ''}${r.notes ? `\nMore from Joshua:\n${r.notes}\n` : ''}${roomNote ? `\nFor your room only:\n${roomNote}\n` : ''}
Report everything on the ledger, as it happens:
- your plan, whenever it changes: race step ${roomId} --type plan --text "..."
${sim ? `- each finding on the web: race research ${roomId} --title "..." --text "what the page shows" --url <link> --topic ${Object.keys(RESEARCH_TOPICS).join('|')} [--number "label=value unit"] [--play <play-id>]
- variants tested in the simulator: race sim test ${roomId} --variants variants.json [--play <play-id>]
- the real thing, built in the sandbox: race build ${roomId} --what ${Object.keys(SIM_ARTIFACTS).join('|')} --title "..." --file <path> [--format html|markdown|text] [--to "who it would go to"] --play <play-id>
- a play live in the simulated market: race sim launch ${roomId} <play-id> --spec spec.json [--label "..."]; stop it: race sim stop ${roomId} <play-id> --why "..."
` : ''}- each way you try, with its business model: race play ${roomId} <play-id> --name "..." --status trying --method <kind> --plan "..." --offer "what you sell" --customer "who buys" --channel "how they find it" --pricing "what it costs them" --costs "what it costs you"
- the business you bet on to win: mark it working and give it a name with --brand "Company name". Your room takes that name on the board and the map
- each thing you did, learned or are stuck on: race step ${roomId} --type did|learned|blocked --text "..." --play <play-id>
${paper || sim ? '' : `- every dollar: log-in / log-out --path ${roomId} --evidence "..." --play <play-id>\n`}${sim ? '' : `- demand without a sale: race signal ${roomId} --type ${Object.keys(SIGNAL_TYPES).join('|')} --count N --evidence "..." --play <play-id>\n`}
- change a play's status with --why when it starts working, stalls or you drop it.

${sim ? 'Start by reading the board (node src/cli.js race), then research the web, log your plan, and test your first variants before you launch anything.' : 'Start by reading the board (node src/cli.js race), then log your plan and your first play before you do anything else.'}`;
}

// A play's playbook: everything a person needs to run the same idea for real, in the order the agent did it. Built
// from the ledger: the model it logged, every step, every status change and why, every dollar with its evidence.
export function racePlaybook(state, catalog, roomId, playId, now = Date.now(), { lead = null, station = null, raceId = null } = {}) {
  const board = raceBoard(state, catalog, now, { timeline: 0, raceId });
  const lane = board && board.lanes.find((l) => l.id === roomId);
  const p = lane && lane.plays.find((x) => x.id === playId);
  if (!p) return null;
  const t0 = Date.parse(board.startedAt), tNow = Math.min(now, Date.parse(board.endsAt));
  const inWindow = (ts) => { const t = Date.parse(ts); return t >= t0 && t <= tNow; };
  const when = (ts) => { const m = Math.max(0, Math.floor((Date.parse(ts) - t0) / MIN)); return board.short ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} in` : `day ${Math.floor(m / 1440) + 1}`; };
  const usd = (v) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const room = catalog.find((c) => c.id === roomId), unit = board.rateUnit;
  const rough = (mins) => (mins < 1440 ? spanLabel(mins) : `${Math.round(mins / 1440)} day${Math.round(mins / 1440) === 1 ? '' : 's'}`);
  const steps = (state.steps || []).filter((s) => s.path === roomId && s.play === playId && inWindow(s.ts));
  const money = [...state.moneyIn.map((e) => ({ e, dir: 'in' })), ...state.moneyOut.map((e) => ({ e, dir: 'out' }))].filter((x) => x.e.path === roomId && x.e.play === playId && inWindow(x.e.ts)).sort((a, b) => byTs(a.e, b.e));
  const hist = (Object.values(state.plays || {}).find((x) => x.path === roomId && x.id === playId) || { history: [] }).history.filter((h) => inWindow(h.ts));
  // the steps to repeat: what the agent did, where it got stuck, what it paid for, in order
  const doing = [
    ...steps.filter((s) => s.type === 'did' || s.type === 'blocked').map((s) => ({ ts: s.ts, text: s.type === 'blocked' ? `(needed a person) ${s.text}` : s.text, url: s.url })),
    ...money.filter((x) => x.dir === 'out').map((x) => ({ ts: x.e.ts, text: `Paid ${usd(x.e.usd)} for ${x.e.payee || x.e.category}${x.e.evidence ? ` (${x.e.evidence})` : ''}` })),
    ...hist.filter((h, i) => i > 0).map((h) => ({ ts: h.ts, text: `Play marked ${h.status}${h.why ? `: ${h.why}` : ''}` })),
  ].sort(byTs);
  const learned = steps.filter((s) => s.type === 'learned'), stuck = steps.filter((s) => s.type === 'blocked');
  const m = p.model || {}, line = (k, t) => `- **${t}:** ${m[k] || 'not logged'}`;
  // the simulation: the variant it ran, what it forecast, what it built (ready to use for real), the research behind it
  const sims = (state.sims || []).filter((e) => e.path === roomId && inWindow(e.ts));
  const builds = sims.filter((e) => e.act === 'build' && e.play === playId);
  const tested = sims.filter((e) => e.act === 'test' && e.play === playId).flatMap((e) => e.variants);
  const found = (state.research || []).filter((x) => x.path === roomId && inWindow(x.ts) && (x.play === playId || !x.play));
  const money$ = (v) => (v < 0 ? '-' : '') + usd(Math.abs(v));
  const range = (r) => r.net.map((n) => `${n.days} days: ${money$(n.p10)} to ${money$(n.p90)} (typical ${money$(n.p50)})`).join('; ');
  const simPart = p.sim || builds.length || tested.length ? `
## In the simulation
${p.sim ? `- Ran as: ${p.sim.line}${p.sim.live ? `, live for ${p.sim.simDays} simulated day${p.sim.simDays === 1 ? '' : 's'}` : ', stopped'}
- Forecast when it launched (${p.sim.forecast ? p.sim.forecast.runs : 0} simulated runs): ${p.sim.forecast ? range(p.sim.forecast) : 'none'}
- Chance of profit: ${p.sim.forecast ? p.sim.forecast.net.map((n, i) => `${Math.round(p.sim.forecast.pProfit[i] * 100)}% by day ${n.days}`).join(', ') : 'n/a'}
- Numbers it set with a source: ${p.sim.cited} of ${p.sim.set}${p.sim.drivers && p.sim.drivers.length ? `\n- Driven by research: ${p.sim.drivers.join('; ')}` : ''}${p.sim.flags.length ? `\n- The simulator changed: ${p.sim.flags.join('; ')}` : ''}${p.sim.panel ? `\n- A simulated panel of ${p.sim.panel.n} read the work: ${Math.round(p.sim.panel.score * 100)}% would act${p.sim.panel.notes ? ` (${p.sim.panel.notes})` : ''}` : ''}` : '- Not launched in the simulated market.'}
${tested.length ? `\nVariants it tested (${tested.length}), best first:\n${tested.slice().sort((a, b) => b.result.net[b.result.net.length - 1].p50 - a.result.net[a.result.net.length - 1].p50).slice(0, 10).map((v) => `- ${v.label}: ${specLine(v.spec)}; ${range(v.result)}`).join('\n')}\n` : ''}
Every simulated number is a forecast from published benchmarks and this play's own research, not a result. Real people decide the real one.
` : '';
  const builtPart = builds.length ? `
## What it built, ready for real
${builds.map((b) => `### ${SIM_ARTIFACTS[b.what]}: ${b.title}${b.to ? `\nFor: ${b.to}` : ''}\n\n${b.format === 'html' ? '```html\n' + b.content + '\n```' : b.content}`).join('\n\n')}
` : '';
  const foundPart = found.length ? `
## The research behind it
${found.slice(-30).map((x) => `- ${x.title}: ${x.text} (${x.url})`).join('\n')}
` : '';
  const bars = (list, name = (k) => k, what = 'sale') => (list.length ? list.map((g) => `- ${name(g.key)}: ${usd(g.usd)} (${g.n} ${what}${g.n === 1 ? '' : 's'})`).join('\n') : '- nothing yet');
  const CATS = { api: 'API use', tool: 'Tools and software', ads: 'Ads', capital: 'Stock and inventory', other: 'Fees and other' };
  return `# Playbook: ${p.name}

From the ${room ? room.name : roomId} room in ${board.name || 'the sandbox race'}${lead ? `, run by ${lead}` : ''}${lane.model ? ` on ${RACE_MODELS[lane.model] || lane.model}` : ''}. Status: ${p.status}, ${rough(Math.max(1, p.activeMin))} ${p.status === 'dropped' ? 'before it was dropped' : 'running'}.${station ? ` Station: ${station}.` : ''}

## The result
- Made ${usd(p.inUsd)} from ${p.sales} sale${p.sales === 1 ? '' : 's'}${p.firstSaleMin !== null ? `; the first came ${rough(Math.max(1, p.firstSaleMin - p.startedMin))} after it started` : ''}
- Spent ${usd(p.outUsd)}; net ${p.netUsd < 0 ? '-' : '+'}${usd(Math.abs(p.netUsd))}
- ${p.backPerDollar !== null ? `${usd(p.backPerDollar)} back for every $1 spent` : p.inUsd > 0 ? 'Nothing spent: every dollar made was profit' : 'Nothing spent, nothing made yet'}${p.avgSaleUsd !== null ? `; average sale ${usd(p.avgSaleUsd)}` : ''}${p.costPerSaleUsd !== null ? `; cost per sale ${usd(p.costPerSaleUsd)}` : ''}
- Rate: ${p.rate < 0 ? '-' : '+'}${usd(Math.abs(p.rate))} ${unit === 'hour' ? 'an hour' : 'a day'}

Where the money came from:
${bars(p.bySource)}

Where it went:
${bars(p.byCategory, (k) => CATS[k] || k, 'payment')}

## The business model
${line('offer', 'What it sells')}
${line('customer', 'Who buys')}
${line('channel', 'How they find it')}
${line('pricing', 'What it charges')}
${line('costs', 'What it costs to run')}
- **The plan:** ${p.plan || 'not logged'}
${simPart}${builtPart}${foundPart}
## Do it yourself: every step, in order
${doing.length ? doing.map((d, i) => `${i + 1}. ${when(d.ts)}: ${d.text}${d.url ? ` (${d.url})` : ''}`).join('\n') : 'No steps logged for this play.'}

## What it learned
${learned.length ? learned.map((s) => `- ${when(s.ts)}: ${s.text}`).join('\n') : '- nothing logged'}

## Where it needed a person
${stuck.length ? stuck.map((s) => `- ${when(s.ts)}: ${s.text}`).join('\n') : '- nowhere: it ran on its own'}

## Every dollar
| When | | What | Amount | Evidence |
|---|---|---|---|---|
${money.length ? money.map((x) => `| ${when(x.e.ts)} | ${x.dir === 'in' ? 'in' : 'out'} | ${String(x.dir === 'in' ? x.e.item || x.e.source : x.e.payee || x.e.category).replace(/\|/g, '/')} | ${x.dir === 'in' ? '+' : '-'}${usd(x.e.usd)} | ${String(x.e.evidence || '').replace(/\|/g, '/')} |`).join('\n') : '| | | nothing yet | | |'}

## Before you copy it
${board.simMode ? '- This play ran in a SIMULATION: every dollar above is simulated. It shows how the idea might go if the benchmarks and the research hold, not what real people did. Test it for real small first.\n' : ''}- These are the numbers one agent made in one ${board.short ? 'short ' : ''}race window, each with evidence on the ledger. Doing the same thing again is not guaranteed to make the same amount: timing, the market and luck all move it${board.short ? ', and a window this short is mostly luck' : ''}.
- Every step marked "needed a person" is something you will do yourself.
- Anything the agent bought and still holds counted as $0 in the race.
`;
}

// REAL MONEY: the switch from a simulation to a race with real money, for the rooms Joshua picks. It is a new starting
// gun: the same rules with real money, the rooms chosen, a real stake, and what the simulation forecast for each room's
// live plays over the new race's own prize times, fixed on the ledger at the moment of the switch so the forecast can
// be held against what real people actually do. Returns the race event to append; writes nothing itself.
export function realRaceEvent(state, catalog, now, { rooms, stakeUsd, horizonsMin = null, horizons = null, evidence, rules = {}, name = null } = {}) {
  const board = raceBoard(state, catalog, now, { timeline: 0 });
  if (!board) throw new Error('there is no race to take real');
  if (!board.simMode) throw new Error('this race is already using ' + (board.mode === 'paper' ? 'paper money' : 'real money') + '; REAL MONEY switches a simulation');
  const picked = rooms && rooms.length ? rooms : board.standings.find((s) => s.state !== 'upcoming')?.podium || [];
  const ids = picked.filter((id) => board.lanes.some((l) => l.id === id));
  if (!ids.length) throw new Error('pick at least one room from the simulation to take real');
  const hz = horizonsMin || (horizons ? horizons.map((d) => d * 1440) : board.horizonsMin);
  const days = [...new Set(hz.map((m) => Math.max(1, Math.min(365, Math.ceil(m / 1440)))))];
  const forecasts = {};
  for (const id of ids) {
    const lane = board.lanes.find((l) => l.id === id);
    const plays = lane.plays.filter((p) => p.sim && p.sim.live).slice(0, 6).map((p) => {
      const r = monteCarlo(p.sim.spec, { horizons: days, runs: 200, seed: `${board.id}|${id}|${p.id}|real` });
      return { play: p.id, name: p.name, line: p.sim.line, net: r.net, pProfit: r.pProfit, simNetUsd: p.netUsd };
    });
    forecasts[id] = { simBankrollUsd: lane.bankrollUsd, simPlace: lane.place, simStakeUsd: lane.stakeUsd, days, plays };
  }
  const base = { ...board.rules };
  for (const k of ['stakes', 'models', 'roomNotes']) base[k] = Object.fromEntries(Object.entries(base[k] || {}).filter(([id]) => ids.includes(id)));
  return {
    kind: 'race', stakeUsd: stakeUsd ?? board.stakeUsd, evidence, rooms: ids, name: name || `${board.name || 'Sandbox race'}: real money`.slice(0, 60),
    ...(horizonsMin ? { horizonsMin } : horizons ? { horizons } : { horizonsMin: board.horizonsMin }),
    rules: { ...base, ...rules, moneyMode: 'real' }, fromRace: board.id, forecasts,
  };
}

// A race's whole record, to keep: how it ended, every prize, and every play's playbook, best first. One markdown file
// holds all the business plans a race produced, for the race on now or any earlier one.
export function raceArchive(state, catalog, raceId = null, now = Date.now(), { leads = {} } = {}) {
  const board = raceBoard(state, catalog, now, { timeline: 0, raceId });
  if (!board) return null;
  const nm = (id) => (catalog.find((c) => c.id === id) || {}).name || id;
  const when = (ts) => new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const plays = board.lanes.flatMap((l) => l.plays.map((p) => ({ room: l.id, p }))).sort((a, b) => b.p.netUsd - a.p.netUsd);
  const head = `# ${board.name || 'Sandbox race'}: the whole record

${board.simMode ? 'A SIMULATION: every dollar below is simulated from published benchmarks and each room\'s research.' : board.paper ? 'A paper race: no real money moved.' : 'A real-money race.'}
Started ${when(board.startedAt)}; ${board.over ? `finished ${when(board.endsAt)}` : 'still running when this was saved'}. ${board.lanes.length} rooms at $${board.stakeUsd} each. Purpose: ${board.purpose || 'not set'}.

## Prizes
${board.standings.map((s) => `- ${s.label}: ${s.state === 'done' ? (s.winner ? `won by ${nm(s.winner)} (${(s.ranking.find((x) => x.id === s.winner) || {}).scoreText})${s.podium.length > 1 ? `, then ${s.podium.slice(1).map(nm).join(', ')}` : ''}` : 'tie, no winner') : s.state === 'live' ? 'still running' : 'not reached'}`).join('\n')}

## Final standings
${board.lanes.slice().sort((a, b) => a.place - b.place).map((l) => `${l.place}. ${nm(l.id)}: ${l.scoreText} (bankroll $${l.bankrollUsd.toFixed(2)}, ${l.plays.length} play${l.plays.length === 1 ? '' : 's'})`).join('\n')}

## Every business plan, best first
${plays.length ? plays.map(({ room, p }) => `- ${p.name} (${nm(room)}): net ${p.netUsd < 0 ? '-' : '+'}$${Math.abs(p.netUsd).toFixed(2)}`).join('\n') : 'No plays were logged.'}
`;
  const books = plays.map(({ room, p }) => racePlaybook(state, catalog, room, p.id, now, { raceId: board.id, lead: leads[room] || null })).filter(Boolean);
  return `${head}\n---\n\n${books.join('\n---\n\n')}`;
}
