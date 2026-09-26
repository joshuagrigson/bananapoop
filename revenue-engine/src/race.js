// The sandbox race: every contestant room starts with a stake and one agent who tries to multiply it, and the ledger
// keeps score. Prizes go to the best score at each horizon (1 week, 30, 90 and 180 days by default).
// Pure: the reduced state and a clock in, the standings out. Nothing here invents a number. A bankroll is the stake
// plus evidenced money in minus evidenced money out, counted only between the starting gun and the last horizon.
// Holdings (stock, inventory, a coin) count at zero until they are sold, so a paper gain never wins a prize.
import { RACE_METHODS, RACE_MODELS, RACE_SCORING, defaultRaceRules } from './ledger.js';

const DAY = 86400e3;
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

export function raceBoard(state, catalog, now = Date.now(), { timeline = 160 } = {}) {
  const race = state && state.race;
  if (!race) return null;
  const rules = { ...defaultRaceRules(), ...(race.rules || {}) };
  const known = catalog.map((p) => p.id);
  const ids = race.rooms ? race.rooms.filter((id) => known.includes(id)) : known;
  const t0 = Date.parse(race.startedAt), horizons = race.horizons, last = horizons[horizons.length - 1];
  const tEnd = t0 + last * DAY, tNow = Math.max(t0, Math.min(now, tEnd));
  const elapsedDays = (tNow - t0) / DAY;
  const stakeOf = (id) => rules.stakes[id] || race.stakeUsd;
  const inWindow = (ts) => { const t = Date.parse(ts); return t >= t0 && t <= tNow; };
  const dayOf = (ts) => Math.floor((Date.parse(ts) - t0) / DAY) + 1;
  const score = (id, bankroll) => (rules.scoring === 'profit' ? r2(bankroll - stakeOf(id)) : rules.scoring === 'multiple' ? Math.round((bankroll / stakeOf(id)) * 1000) / 1000 : bankroll);

  // each room's money inside the window, oldest first
  const flows = new Map(ids.map((id) => [id, []]));
  for (const e of state.moneyIn) if (flows.has(e.path) && inWindow(e.ts)) flows.get(e.path).push({ t: Date.parse(e.ts), usd: e.usd, e, dir: 'in' });
  for (const e of state.moneyOut) if (flows.has(e.path) && inWindow(e.ts)) flows.get(e.path).push({ t: Date.parse(e.ts), usd: -e.usd, e, dir: 'out' });
  for (const f of flows.values()) f.sort((a, b) => a.t - b.t);
  const bankrollAt = (id, t) => r2(stakeOf(id) + flows.get(id).reduce((s, f) => (f.t <= t ? s + f.usd : s), 0));
  // knocked out: the first moment a bankroll falls to the knockout line; out rooms win nothing after that
  const outAt = new Map();
  if (rules.knockoutUsd !== null) for (const id of ids) {
    let b = stakeOf(id);
    for (const f of flows.get(id)) { b = r2(b + f.usd); if (b <= rules.knockoutUsd) { outAt.set(id, f.t); break; } }
  }
  // when a room's score first reached a value (the earliest tie-break)
  const reachedAt = (id, target) => {
    let b = stakeOf(id);
    if (score(id, b) >= target) return t0;
    for (const f of flows.get(id)) { b = r2(b + f.usd); if (score(id, b) >= target) return f.t; }
    return Infinity;
  };
  const playsOf = (id) => Object.values(state.plays || {}).filter((p) => p.path === id);
  const stepsOf = (id) => (state.steps || []).filter((s) => s.path === id && inWindow(s.ts));

  const lanes = ids.map((id) => {
    const f = flows.get(id), stake = stakeOf(id);
    const ins = f.filter((x) => x.dir === 'in'), outs = f.filter((x) => x.dir === 'out');
    const inUsd = sum(ins, (x) => x.usd), outUsd = sum(outs, (x) => -x.usd);
    const bankrollUsd = r2(stake + inUsd - outUsd);
    // net dollars a day: over the last 7 days, and since the gun. A window shorter than a day counts as a day.
    const w7 = Math.max(t0, tNow - 7 * DAY);
    const rate7 = r2((bankrollUsd - bankrollAt(id, w7 - 1)) / Math.max(1, (tNow - w7) / DAY));
    const rateAll = r2((bankrollUsd - stake) / Math.max(1, elapsedDays));
    const steps = stepsOf(id);
    const line = (x) => ({ ts: x.e.ts, day: dayOf(x.e.ts), usd: Math.abs(x.usd), text: x.dir === 'in' ? (x.e.item || x.e.source) : (x.e.payee || x.e.category), source: x.e.source || null, category: x.e.category || null, evidence: x.e.evidence || null, id: x.e.id });
    // the plays: every way this room tried to make money, and the business model behind each
    const plays = playsOf(id).map((p) => {
      const history = p.history.filter((h) => inWindow(h.ts));
      if (!history.length) return null;
      const mine = f.filter((x) => x.e.play === p.id), pin = mine.filter((x) => x.dir === 'in'), pout = mine.filter((x) => x.dir === 'out');
      const inP = sum(pin, (x) => x.usd), outP = sum(pout, (x) => -x.usd), from = Date.parse(history[0].ts), cur = history[history.length - 1];
      const psteps = steps.filter((s) => s.play === p.id);
      return {
        id: p.id, name: p.name, status: cur.status, plan: p.plan, why: cur.why, model: { ...(p.model || {}) },
        startedAt: history[0].ts, updatedAt: cur.ts, startedDay: dayOf(history[0].ts), daysActive: r2(Math.max(0, ((cur.status === 'dropped' ? Date.parse(cur.ts) : tNow) - from) / DAY)),
        inUsd: inP, outUsd: outP, netUsd: r2(inP - outP), sales: pin.length,
        ratePerDay: r2((inP - outP) / Math.max(1, (tNow - from) / DAY)),
        avgSaleUsd: pin.length ? r2(inP / pin.length) : null, costPerSaleUsd: pin.length && outP ? r2(outP / pin.length) : null,
        backPerDollar: outP > 0 ? r2(inP / outP) : null, firstSaleDay: pin.length ? dayOf(pin[0].e.ts) : null,
        bySource: groupBy(pin.map((x) => ({ usd: x.usd, src: x.e.source })), (x) => x.src),
        byCategory: groupBy(pout.map((x) => ({ usd: -x.usd, cat: x.e.category })), (x) => x.cat),
        history: history.map((h) => ({ ts: h.ts, day: dayOf(h.ts), status: h.status, why: h.why })),
        steps: psteps.length, stepList: psteps.slice(-60).reverse().map((s) => ({ ts: s.ts, day: dayOf(s.ts), type: s.type, text: s.text, url: s.url })),
        money: mine.slice(-50).reverse().map((x) => ({ ...line(x), dir: x.dir })),
      };
    }).filter(Boolean).sort((a, b) => b.netUsd - a.netUsd || (a.startedAt < b.startedAt ? -1 : 1));
    const named = new Set(plays.map((p) => p.id));
    const loose = f.filter((x) => !x.e.play || !named.has(x.e.play));
    const planStep = steps.filter((s) => s.type === 'plan').pop() || null;
    // the agent's latest move: a step or a play started, changed or dropped (money arriving on its own is not a move)
    const moves = [...steps, ...playsOf(id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)))];
    const latest = moves.sort(byTs).pop() || null;
    const playName = (pid) => (plays.find((p) => p.id === pid) || {}).name || null;
    // the full breakdown: every step, every play started or changed, every dollar in or out, newest first
    const items = [
      ...steps.map((s) => ({ ts: s.ts, kind: 'step', type: s.type, text: s.text, url: s.url, play: s.play, by: s.by, id: s.id })),
      ...playsOf(id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)).map((h, i) => ({ ts: h.ts, kind: 'play', status: h.status, first: i === 0, text: p.name, why: h.why, play: p.id, by: h.by, id: h.id }))),
      ...f.map((x) => ({ ...line(x), kind: x.dir, play: x.e.play || null })),
    ].map((x) => ({ ...x, day: dayOf(x.ts), playName: x.play ? playName(x.play) : null })).sort((a, b) => -byTs(a, b));
    const out = outAt.has(id) ? { ts: iso(outAt.get(id)), day: dayOf(iso(outAt.get(id))) } : null;
    return {
      id, stakeUsd: stake, bankrollUsd, inUsd, outUsd, netUsd: r2(inUsd - outUsd), profitUsd: r2(bankrollUsd - stake), multiple: r2(bankrollUsd / stake), score: score(id, bankrollUsd), rate7, rateAll,
      sales: ins.length, backPerDollar: outUsd > 0 ? r2(inUsd / outUsd) : null, model: rules.models[id] || null, out,
      // where the money came from, and where it went
      bySource: groupBy(ins.map((x) => ({ usd: x.usd, src: x.e.source })), (x) => x.src),
      byCategory: groupBy(outs.map((x) => ({ usd: -x.usd, cat: x.e.category })), (x) => x.cat),
      plays, loose: loose.length ? { inUsd: sum(loose.filter((x) => x.dir === 'in'), (x) => x.usd), outUsd: sum(loose.filter((x) => x.dir === 'out'), (x) => -x.usd), n: loose.length } : null,
      plan: planStep ? { text: planStep.text, ts: planStep.ts, day: dayOf(planStep.ts) } : null,
      // the room's latest move is saying it is stuck and needs a person: shown until it makes any other move
      blocked: latest && latest.type === 'blocked' ? { text: latest.text, ts: latest.ts, day: dayOf(latest.ts) } : null,
      // the bankroll at the end of each day so far (index 0 is the gun): what the room's chart draws
      series: Array.from({ length: Math.max(1, Math.ceil((tNow - t0) / DAY)) + 1 }, (_, i) => bankrollAt(id, Math.min(tNow, t0 + i * DAY))),
      lastAt: items.length ? items[0].ts : null,
      timeline: items.slice(0, timeline), timelineTotal: items.length,
    };
  });
  // ties share a place; a knocked-out room ranks below every room still in
  const rank = (a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || b.score - a.score;
  for (const l of lanes) l.place = 1 + lanes.filter((o) => rank(o, l) < 0).length;
  const order = lanes.slice().sort((a, b) => rank(a, b) || ids.indexOf(a.id) - ids.indexOf(b.id));

  // one prize per horizon, locked the moment it passes
  let liveSet = false;
  const standings = horizons.map((h) => {
    const tH = t0 + h * DAY, done = now >= tH, at = Math.min(now, tH);
    const ranking = ids.map((id) => { const b = bankrollAt(id, at); const o = outAt.has(id) && outAt.get(id) <= at; return { id, bankrollUsd: b, multiple: r2(b / stakeOf(id)), profitUsd: r2(b - stakeOf(id)), score: score(id, b), out: o }; })
      .sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || b.score - a.score || ids.indexOf(a.id) - ids.indexOf(b.id));
    const live = ranking.filter((r) => !r.out);
    let tie = live.length > 1 && live[0].score === live[1].score, top = live[0] || null, tieBroken = false;
    if (tie && rules.tiebreak === 'earliest') {
      const tied = live.filter((r) => r.score === live[0].score).map((r) => ({ r, t: reachedAt(r.id, r.score) })).sort((a, b) => a.t - b.t);
      if (tied.length && tied[0].t < (tied[1] ? tied[1].t : Infinity)) { top = tied[0].r; tie = false; tieBroken = true; }
    }
    const stateH = done ? 'done' : liveSet ? 'upcoming' : 'live';
    if (!done) liveSet = true;
    return {
      days: h, endsAt: iso(tH), state: stateH, daysLeft: done ? 0 : Math.ceil((tH - now) / DAY),
      ranking, leader: !tie && top ? top.id : null, winner: done && !tie && top ? top.id : null, tie, tieBroken,
    };
  });
  const sources = new Map();
  for (const l of lanes) for (const src of l.bySource) { const g = sources.get(src.key) || { key: src.key, usd: 0, n: 0, rooms: [] }; g.usd = r2(g.usd + src.usd); g.n += src.n; g.rooms.push(l.id); sources.set(src.key, g); }
  return {
    name: race.name, id: race.id, startedAt: race.startedAt, setAt: race.setAt || race.startedAt, endsAt: iso(tEnd), stakeUsd: race.stakeUsd, evidence: race.evidence, horizons, rules,
    amendments: race.amendments || [],
    started: now >= t0, startsInDays: now < t0 ? Math.ceil((t0 - now) / DAY) : 0,
    day: now < t0 ? 0 : Math.min(last, Math.floor((now - t0) / DAY) + 1), totalDays: last, elapsedDays: r2(elapsedDays), over: now >= tEnd,
    stakedUsd: sum(ids, stakeOf), potUsd: sum(lanes, (l) => l.bankrollUsd), inUsd: sum(lanes, (l) => l.inUsd), outUsd: sum(lanes, (l) => l.outUsd),
    leaderId: order.length > 1 && !order[1].out && order[0].score === order[1].score ? null : (order[0] || {}).id || null,
    // every room's income sources added up: where the race's money is coming from
    bySource: [...sources.values()].sort((a, b) => b.usd - a.usd),
    lanes, standings,
  };
}

// The brief an agent gets, written from the race's rules. Paste it into the agent's session.
export function raceBrief(board, roomId, { roomName, lead, station = 'the station' } = {}) {
  if (!board) return '';
  const r = board.rules, lane = board.lanes.find((l) => l.id === roomId);
  const stake = lane ? lane.stakeUsd : board.stakeUsd, name = roomName || roomId, usd = (v) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const hz = (d) => (d === 7 ? '1 week' : d === 180 ? '6 months' : d === 365 ? '1 year' : `${d} days`);
  const allowed = r.methods.map((m) => `  - ${RACE_METHODS[m]}`).join('\n');
  const barred = Object.keys(RACE_METHODS).filter((m) => !r.methods.includes(m)).map((m) => `  - ${RACE_METHODS[m]}`).join('\n');
  const rules = [
    'Legal, honest, and inside every platform\'s terms. No fake reviews, no pretending to be anyone, no spam, no bought followers, no scraping behind a login.',
    r.outreach === 'none' ? 'Do not contact any person, by any channel, for any reason.' : 'You never send, post or message a person yourself. Draft it, put it in the dock, and log a "blocked" step saying exactly what is waiting and why. Keep working on something else while you wait.',
    r.posting === 'none' ? 'Nothing is posted publicly under Joshua\'s name, not even as a draft.' : 'Public posts are drafts too: Joshua publishes them or drops them.',
    'Anything that needs Joshua\'s identity (an ID check, a payment account, a tax form) is logged as a "blocked" step for him.',
    `Spend only your own stake, and log every dollar out the same day with a receipt.${r.ads ? '' : ' No paid ads of any kind.'}`,
    r.maxSpendPerDayUsd !== null ? `Spend at most ${usd(r.maxSpendPerDayUsd)} in any one day.` : null,
    r.approveOverUsd !== null ? `Any single purchase over ${usd(r.approveOverUsd)} needs Joshua first: log it as "blocked" and wait.` : null,
    r.knockoutUsd !== null ? `If your bankroll falls to ${usd(r.knockoutUsd)} you are out of the race.` : null,
    `Use only these connectors: ${r.connectors.join(', ') || 'none'}.`,
    r.collab ? 'You may trade with other rooms, at fair prices, logged on both sides.' : 'Do not buy from, pay or split sales with another room.',
    'No TikTok.',
  ].filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join('\n');
  return `You are the room lead${lead ? ` (${lead})` : ''} for the ${name.toUpperCase()} room in a sandbox race run by Joshua Grigson${board.name ? `: ${board.name}` : ''}.

You start with a stake of ${usd(stake)}. Your job is to turn it into as much as you can, any allowed way you choose, using Claude${lane && lane.model ? ` (${RACE_MODELS[lane.model] || lane.model})` : ''} and your connectors. Prizes: ${RACE_SCORING[r.scoring].toLowerCase()} at ${board.horizons.map(hz).join(', ')}${r.tiebreak === 'earliest' ? '; a tie goes to whoever got there first' : ''}. A strategy that wins the first prize can lose the last, so decide what you are playing for and say so in your plan.

How you are scored: bankroll = your stake + money in - money out, logged on ${station}'s ledger since the starting gun. Money in counts only with evidence (an order number, a charge id, a payout line). Anything you bought and still hold counts as zero until you sell it. Claude is free to you; every other dollar you spend comes out of your stake.

Ways you may make money:
${allowed || '  - none (ask Joshua)'}
${barred ? `Not allowed in this race:\n${barred}\n` : ''}
Rules:
${rules}
${r.notes ? `\nMore from Joshua:\n${r.notes}\n` : ''}
Report everything on the ledger, as it happens:
- your plan, whenever it changes: race step ${roomId} --type plan --text "..."
- each way you try to make money, with its business model: race play ${roomId} <play-id> --name "..." --status trying --plan "..." --offer "what you sell" --customer "who buys" --channel "how they find it" --pricing "what it costs them" --costs "what it costs you"
- each thing you did, learned or are stuck on: race step ${roomId} --type did|learned|blocked --text "..." --play <play-id>
- every dollar: log-in / log-out --path ${roomId} --evidence "..." --play <play-id>
- change a play's status with --why when it starts working, stalls or you drop it.

Check in every ${r.everyHours === 24 ? 'day' : `${r.everyHours} hours`}. Start by reading the board (node src/cli.js race), then log your plan and your first play before you do anything else.`;
}
