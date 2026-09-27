import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/ledger.js';
import { reduce } from '../src/reduce.js';
import { raceBoard, raceBrief, realRaceEvent } from '../src/race.js';
import { normalizeSpec, simulate } from '../src/sim.js';

const DAY = 86400e3, T0 = Date.parse('2026-09-01T00:00:00Z');
const at = (d) => new Date(T0 + d * DAY).toISOString();
const CAT = [{ id: 'red', name: 'Red' }, { id: 'blue', name: 'Blue' }];

test('an uncited rate is held to the benchmark; a cited one counts; same seed, same market', () => {
  const a = normalizeSpec({ channel: 'email', price: 300, volume: 40, rates: { reply: 0.5 } });
  assert.match(a.flags.join(' '), /no source cited/);
  assert.ok(a.spec.rates.reply < 0.5);
  const b = normalizeSpec({ channel: 'email', price: 300, volume: 40, rates: { reply: 0.06 }, cites: { reply: 'https://example.com/study' } });
  assert.equal(b.spec.rates.reply, 0.06);
  assert.deepEqual(simulate(b.spec, 30, 7).days, simulate(b.spec, 30, 7).days);
});

test('a simulation race counts simulated money; real money in it is a rule break; REAL MONEY starts a real race', () => {
  const events = [
    { kind: 'race', id: 'gun', ts: at(0), stakeUsd: 250, evidence: 'none, simulated', horizons: [7, 30] },
    { kind: 'sim', act: 'test', path: 'red', by: 'agent', ts: at(0.1), variants: [{ label: 'gigs', spec: { channel: 'freelance', price: 150, volume: 10 } }] },
    { kind: 'sim', act: 'launch', path: 'red', play: 'gigs', by: 'agent', ts: at(0.2), spec: { channel: 'freelance', price: 150, volume: 10 } },
    { kind: 'research', path: 'red', title: 'Upwork demand', text: 'lots of automation posts', url: 'https://example.com/r', by: 'agent', ts: at(0.3) },
    { kind: 'money.in', usd: 20, path: 'blue', source: 'someone', evidence: 'a real sale', ts: at(1) },
  ].map(validate);
  assert.ok(events[1].variants[0].result.net.length === 3, 'results are computed at the door');
  const st = reduce(events, CAT), b = raceBoard(st, CAT, T0 + 20 * DAY);
  assert.equal(b.simMode, true);
  const red = b.lanes.find((l) => l.id === 'red'), blue = b.lanes.find((l) => l.id === 'blue');
  assert.ok(red.inUsd > 0, 'the launched play earned simulated money');
  assert.equal(blue.inUsd, 0);
  assert.ok(blue.breaks.some((x) => x.rule === 'sim'));
  assert.equal(b.sim.totals.research, 1);
  assert.match(raceBrief(b, 'red'), /SIMULATION/);
  const real = validate(realRaceEvent(st, CAT, T0 + 20 * DAY, { rooms: ['red'], stakeUsd: 50, evidence: 'a $50 card' }));
  assert.equal(real.rules.moneyMode, 'real');
  assert.equal(real.fromRace, 'gun');
  assert.ok(real.forecasts.red.plays.length === 1);
});

test('race run: a replayed room researches, tests, builds and launches through its tools only', async () => {
  const { runRoom } = await import('../src/racerun.js');
  const lines = [validate({ kind: 'race', id: 'gun', ts: at(0), stakeUsd: 250, evidence: 'simulated', horizons: [7, 30] })];
  const ledger = { readAll: () => lines, append: (e) => { const x = validate(e); lines.push(x); return x; } };
  const spec = { channel: 'marketplace', price: 12, volume: 10, competition: 'high', trend: 'rising' };
  const r = await runRoom({ ledger, catalog: CAT, roomId: 'red', now: () => T0 + DAY, provider: { kind: 'replay', script: [{ calls: [
    { name: 'log_research', input: { title: 'Planner gap', text: 'buyers ask for undated ADHD planners, few sellers', url: 'https://example.com/g', topic: 'gap' } },
    { name: 'simulate', input: { variants: [{ label: 'a', spec }] } },
    { name: 'build', input: { what: 'listing', title: 'Undated planner', content: 'Listing copy' } },
    { name: 'launch', input: { play: 'planner', spec } },
  ] }] } });
  assert.equal(r.reason, 'done');
  const kinds = lines.map((e) => e.act || e.kind);
  for (const k of ['research', 'test', 'build', 'launch', 'agent.run.end']) assert.ok(kinds.includes(k), k);
});

test('sourced demand sizes the market: growth, a fair share of views, job posts cap proposals; uncited demand is ignored', () => {
  const U = 'https://example.com/source';
  const none = normalizeSpec({ channel: 'freelance', price: 45, volume: 10, demand: { growth: 1 } });
  assert.equal(none.spec.demand, null);
  assert.match(none.flags.join(' '), /no source/);
  const cap = normalizeSpec({ channel: 'freelance', price: 45, volume: 20, demand: { monthly: 30, kind: 'posts', cites: { monthly: U } } });
  const days = simulate(cap.spec, 60, 3).days;
  assert.ok(days.every((d) => d.reach <= 1), 'no more proposals than the job posts that exist');
  const fair = normalizeSpec({ channel: 'marketplace', price: 12, volume: 10, demand: { monthly: 3e6, sellers: 1000, kind: 'views', cites: { monthly: U, sellers: U } } });
  const bench = normalizeSpec({ channel: 'marketplace', price: 12, volume: 10 });
  const views = (sp) => simulate(sp, 90, 5).days.slice(60).reduce((a, d) => a + d.reach, 0);
  assert.ok(views(fair.spec) > views(bench.spec) * 2, 'a big sourced market brings far more views than the benchmark guess');
  assert.ok(fair.drivers.some((t) => /fair share/.test(t)));
  const fast = normalizeSpec({ channel: 'freelance', price: 45, volume: 10, demand: { growth: 9, cites: { growth: U } } });
  assert.equal(fast.spec.demand.growth, 2);
});

test('any way to make money: no method is barred by default, and a long shot simulates with a wide spread', () => {
  const r = validate({ kind: 'race', stakeUsd: 250, evidence: 'simulated' }).rules;
  assert.equal(r.anyMethod, true);
  const { spec } = normalizeSpec({ channel: 'venture', price: 5000, volume: 4, unitCost: 50, rates: { win: 0.03 } });
  const nets = Array.from({ length: 200 }, (_, k) => simulate(spec, 90, k).days.reduce((a, d) => a + d.netUsd, 0)).sort((a, b) => a - b);
  assert.ok(nets[20] < 0, 'most long shots lose');
  assert.ok(nets[190] > 2000, 'a few win big');
});

test('a new race keeps the last one whole: past races stay readable, and a race\'s record holds every plan', async () => {
  const { raceArchive } = await import('../src/race.js');
  const events = [
    { kind: 'race', id: 'r1', ts: at(0), stakeUsd: 250, evidence: 'simulated', horizons: [7] },
    { kind: 'play', path: 'red', play: 'shop', name: 'Planner shop', status: 'working', by: 'agent', ts: at(0.1) },
    { kind: 'sim', act: 'launch', path: 'red', play: 'shop', by: 'agent', ts: at(0.2), spec: { channel: 'freelance', price: 150, volume: 10 } },
    { kind: 'race', id: 'r2', ts: at(10), stakeUsd: 250, evidence: 'simulated', horizons: [7] },
  ].map(validate);
  const st = reduce(events, CAT);
  assert.equal(st.race.id, 'r2');
  assert.equal(st.pastRaces[0].id, 'r1');
  const old = raceBoard(st, CAT, T0 + 20 * DAY, { raceId: 'r1' });
  assert.equal(old.over, true);
  assert.equal(old.lanes.find((l) => l.id === 'red').plays[0].name, 'Planner shop');
  assert.equal(raceBoard(st, CAT, T0 + 20 * DAY).lanes.find((l) => l.id === 'red').plays.length, 0, 'the new race starts clean');
  const md = raceArchive(st, CAT, 'r1', T0 + 20 * DAY);
  assert.match(md, /Every business plan/);
  assert.match(md, /# Playbook: Planner shop/);
});

test('a room takes the name of the business it bets on; an app idea simulates with app-store fees and churn', () => {
  const events = [
    { kind: 'race', id: 'r1', ts: at(0), stakeUsd: 250, evidence: 'simulated', horizons: [7] },
    { kind: 'play', path: 'red', play: 'clips', name: 'AI clip editing', status: 'trying', by: 'agent', ts: at(0.1) },
    { kind: 'play', path: 'red', play: 'care', name: 'Caregiver app', brand: 'CareCircle', status: 'working', by: 'agent', offer: 'a caregiving app', ts: at(0.2) },
  ].map(validate);
  const red = raceBoard(reduce(events, CAT), CAT, T0 + DAY).lanes.find((l) => l.id === 'red');
  assert.equal(red.title, 'CareCircle');
  assert.equal(red.bet.offer, 'a caregiving app');
  const { spec } = normalizeSpec({ channel: 'app', price: 6, recurring: true, volume: 30, platform: 'appstore' });
  assert.equal(spec.feePct, 0.15);
  assert.equal(spec.churn, 0.1);
});
