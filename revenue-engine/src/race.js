// The sandbox race: every contestant room starts with the same stake and one agent who tries to multiply it, and the
// ledger keeps score. Prizes go to the biggest bankroll at each horizon (1 week, 30, 90 and 180 days by default).
// Pure: the reduced state and a clock in, the standings out. Nothing here invents a number. A bankroll is the stake
// plus evidenced money in minus evidenced money out, counted only between the starting gun and the last horizon.
// Holdings (stock, inventory, a coin) count at zero until they are sold, so a paper gain never wins a prize.
const DAY = 86400e3;
const r2 = (v) => Math.round(v * 100) / 100;
const iso = (t) => new Date(t).toISOString();

export function raceBoard(state, catalog, now = Date.now(), { timeline = 160 } = {}) {
  const race = state && state.race;
  if (!race) return null;
  const known = catalog.map((p) => p.id);
  const ids = race.rooms ? race.rooms.filter((id) => known.includes(id)) : known;
  const t0 = Date.parse(race.startedAt), horizons = race.horizons, last = horizons[horizons.length - 1];
  const tEnd = t0 + last * DAY, tNow = Math.max(t0, Math.min(now, tEnd));
  const stake = race.stakeUsd, elapsedDays = (tNow - t0) / DAY;
  const inWindow = (ts) => { const t = Date.parse(ts); return t >= t0 && t <= tNow; };

  // each room's money inside the window, oldest first
  const flows = new Map(ids.map((id) => [id, []]));
  for (const e of state.moneyIn) if (flows.has(e.path) && inWindow(e.ts)) flows.get(e.path).push({ t: Date.parse(e.ts), usd: e.usd, e, dir: 'in' });
  for (const e of state.moneyOut) if (flows.has(e.path) && inWindow(e.ts)) flows.get(e.path).push({ t: Date.parse(e.ts), usd: -e.usd, e, dir: 'out' });
  for (const f of flows.values()) f.sort((a, b) => a.t - b.t);
  const bankrollAt = (id, t) => r2(stake + flows.get(id).reduce((s, f) => (f.t <= t ? s + f.usd : s), 0));
  const dayOf = (ts) => Math.floor((Date.parse(ts) - t0) / DAY) + 1;

  const lanes = ids.map((id) => {
    const f = flows.get(id);
    const inUsd = r2(f.filter((x) => x.dir === 'in').reduce((s, x) => s + x.usd, 0));
    const outUsd = r2(f.filter((x) => x.dir === 'out').reduce((s, x) => s - x.usd, 0));
    const bankrollUsd = r2(stake + inUsd - outUsd);
    // net dollars a day: over the last 7 days, and since the gun. A window shorter than a day counts as a day.
    const w7 = Math.max(t0, tNow - 7 * DAY);
    const rate7 = r2((bankrollUsd - bankrollAt(id, w7 - 1)) / Math.max(1, (tNow - w7) / DAY));
    const rateAll = r2((bankrollUsd - stake) / Math.max(1, elapsedDays));
    // the plays: every way this room is trying, with the money tied to each
    const plays = Object.values(state.plays || {}).filter((p) => p.path === id).map((p) => {
      const history = p.history.filter((h) => inWindow(h.ts));
      if (!history.length) return null;
      const mine = f.filter((x) => x.e.play === p.id);
      const pin = r2(mine.filter((x) => x.dir === 'in').reduce((s, x) => s + x.usd, 0));
      const pout = r2(mine.filter((x) => x.dir === 'out').reduce((s, x) => s - x.usd, 0));
      const from = Date.parse(history[0].ts);
      const cur = history[history.length - 1];
      return {
        id: p.id, name: p.name, status: cur.status, plan: p.plan, why: cur.why, startedAt: history[0].ts, updatedAt: cur.ts, startedDay: dayOf(history[0].ts),
        inUsd: pin, outUsd: pout, netUsd: r2(pin - pout), sales: mine.filter((x) => x.dir === 'in').length,
        ratePerDay: r2((pin - pout) / Math.max(1, (tNow - from) / DAY)),
        steps: (state.steps || []).filter((s) => s.path === id && s.play === p.id && inWindow(s.ts)).length,
      };
    }).filter(Boolean).sort((a, b) => b.netUsd - a.netUsd || (a.startedAt < b.startedAt ? -1 : 1));
    const named = new Set(plays.map((p) => p.id));
    const loose = f.filter((x) => !x.e.play || !named.has(x.e.play));
    const steps = (state.steps || []).filter((s) => s.path === id && inWindow(s.ts));
    const planStep = steps.filter((s) => s.type === 'plan').pop() || null;
    // the agent's latest move: a step or a play started, changed or dropped (money arriving on its own is not a move)
    const moves = [...steps, ...Object.values(state.plays || {}).filter((p) => p.path === id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)))];
    const latest = moves.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)).pop() || null;
    const playName = (pid) => (plays.find((p) => p.id === pid) || {}).name || null;
    // the full breakdown: every step, every play started or changed, every dollar in or out, newest first
    const items = [
      ...steps.map((s) => ({ ts: s.ts, kind: 'step', type: s.type, text: s.text, url: s.url, play: s.play, by: s.by, id: s.id })),
      ...Object.values(state.plays || {}).filter((p) => p.path === id).flatMap((p) => p.history.filter((h) => inWindow(h.ts)).map((h, i) => ({ ts: h.ts, kind: 'play', status: h.status, first: i === 0, text: p.name, why: h.why, play: p.id, by: h.by, id: h.id }))),
      ...f.map((x) => ({ ts: x.e.ts, kind: x.dir, usd: Math.abs(x.usd), text: x.dir === 'in' ? (x.e.item || x.e.source) : (x.e.payee || x.e.category), source: x.e.source || null, category: x.e.category || null, evidence: x.e.evidence || null, play: x.e.play || null, id: x.e.id })),
    ].map((x) => ({ ...x, day: dayOf(x.ts), playName: x.play ? playName(x.play) : null })).sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    return {
      id, stakeUsd: stake, bankrollUsd, inUsd, outUsd, netUsd: r2(inUsd - outUsd), multiple: r2(bankrollUsd / stake), rate7, rateAll,
      sales: f.filter((x) => x.dir === 'in').length,
      plays, loose: loose.length ? { inUsd: r2(loose.filter((x) => x.dir === 'in').reduce((s, x) => s + x.usd, 0)), outUsd: r2(loose.filter((x) => x.dir === 'out').reduce((s, x) => s - x.usd, 0)), n: loose.length } : null,
      plan: planStep ? { text: planStep.text, ts: planStep.ts, day: dayOf(planStep.ts) } : null,
      // the room's latest move is saying it is stuck and needs a person: shown until it makes any other move
      blocked: latest && latest.type === 'blocked' ? { text: latest.text, ts: latest.ts, day: dayOf(latest.ts) } : null,
      // the bankroll at the end of each day so far (index 0 is the gun): what the room's chart draws
      series: Array.from({ length: Math.max(1, Math.ceil((tNow - t0) / DAY)) + 1 }, (_, i) => bankrollAt(id, Math.min(tNow, t0 + i * DAY))),
      lastAt: items.length ? items[0].ts : null,
      timeline: items.slice(0, timeline), timelineTotal: items.length,
    };
  });
  const order = lanes.slice().sort((a, b) => b.bankrollUsd - a.bankrollUsd || ids.indexOf(a.id) - ids.indexOf(b.id));
  // ties share a place: at the gun, every room is 1st
  for (const l of lanes) l.place = 1 + lanes.filter((o) => o.bankrollUsd > l.bankrollUsd).length;

  // one prize per horizon, locked the moment it passes
  let liveSet = false;
  const standings = horizons.map((h) => {
    const tH = t0 + h * DAY, done = now >= tH, at = Math.min(now, tH);
    const ranking = ids.map((id) => ({ id, bankrollUsd: bankrollAt(id, at) })).sort((a, b) => b.bankrollUsd - a.bankrollUsd || ids.indexOf(a.id) - ids.indexOf(b.id));
    ranking.forEach((r) => { r.multiple = r2(r.bankrollUsd / stake); });
    const tie = ranking.length > 1 && ranking[0].bankrollUsd === ranking[1].bankrollUsd;
    const stateH = done ? 'done' : liveSet ? 'upcoming' : 'live';
    if (!done) liveSet = true;
    return {
      days: h, endsAt: iso(tH), state: stateH, daysLeft: done ? 0 : Math.ceil((tH - now) / DAY),
      ranking, leader: tie ? null : ranking[0].id, winner: done && !tie ? ranking[0].id : null, tie,
    };
  });
  return {
    name: race.name, id: race.id, startedAt: race.startedAt, endsAt: iso(tEnd), stakeUsd: stake, evidence: race.evidence, horizons,
    day: now < t0 ? 0 : Math.min(last, Math.floor((now - t0) / DAY) + 1), totalDays: last, elapsedDays: r2(elapsedDays), over: now >= tEnd,
    stakedUsd: r2(stake * ids.length), potUsd: r2(lanes.reduce((s, l) => s + l.bankrollUsd, 0)),
    leaderId: order.length > 1 && order[0].bankrollUsd === order[1].bankrollUsd ? null : (order[0] || {}).id || null,
    lanes, standings,
  };
}
