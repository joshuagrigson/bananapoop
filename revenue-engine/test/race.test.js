import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpLedger } from './helpers.js';
import { validate, DEFAULT_HORIZONS } from '../src/ledger.js';
import { reduce } from '../src/reduce.js';
import { raceBoard } from '../src/race.js';
import { snapshot } from '../src/api.js';
import { seedRaceDemo } from '../src/demo.js';
import { fromTemplate, catalogFrom, loadCatalog, stationInfo, MODES } from '../src/rooms.js';

const DAY = 86400e3;
const T0 = Date.parse('2026-09-01T12:00:00Z');
const at = (d) => new Date(T0 + d * DAY).toISOString();
const CAT = catalogFrom(fromTemplate('race'));
const gun = (extra = {}) => ({ kind: 'race', id: 'gun', ts: at(0), stakeUsd: 250, evidence: 'eight cards', horizons: [7, 30, 90, 180], ...extra });
const sale = (room, d, usd, extra = {}) => ({ kind: 'money.in', id: `in${room}${d}${usd}`, ts: at(d), path: room, usd, source: 'buyer', evidence: 'order 1', ...extra });
const spend = (room, d, usd, extra = {}) => ({ kind: 'money.out', id: `out${room}${d}${usd}`, ts: at(d), path: room, usd, category: 'ads', evidence: 'receipt', ...extra });

test('race, play and step lines are validated like money: rules, ids and evidence', () => {
  assert.throws(() => validate({ kind: 'race', stakeUsd: 0, evidence: 'cards' }), /stakeUsd > 0/);
  assert.throws(() => validate({ kind: 'race', stakeUsd: 250 }), /where the stake money actually sits/);
  assert.throws(() => validate({ kind: 'race', stakeUsd: 250, evidence: 'cards', horizons: [0] }), /horizons/);
  const r = validate({ kind: 'race', stakeUsd: 250, evidence: 'cards' });
  assert.deepEqual(r.horizons, [...DEFAULT_HORIZONS]);
  assert.deepEqual(validate({ kind: 'race', stakeUsd: 250, evidence: 'cards', horizons: [30, 7, 30] }).horizons, [7, 30]);
  assert.throws(() => validate({ kind: 'play', path: 'red', play: 'Planner Shop', name: 'x', status: 'trying', by: 'agent' }), /play id/);
  assert.throws(() => validate({ kind: 'play', path: 'red', play: 'shop', name: 'x', status: 'winning', by: 'agent' }), /status must be one of/);
  assert.throws(() => validate({ kind: 'play', path: 'red', play: 'shop', name: 'x', status: 'trying' }), /play.by/);
  assert.equal(validate({ kind: 'step', path: 'red', text: 'built the store', by: 'agent' }).type, 'did');
  assert.throws(() => validate({ kind: 'step', path: 'red', text: 'x', type: 'bragged', by: 'agent' }), /step type/);
  assert.throws(() => validate({ kind: 'step', path: 'red', text: 'x', url: 'not a url', by: 'agent' }), /url/);
  assert.throws(() => validate({ ...sale('red', 1, 5), play: 'Bad Id' }), /play id/);
});

test('a bankroll is the stake plus evidenced money in minus money out, inside the race window only', () => {
  const events = [
    sale('red', -2, 500), // before the gun: does not count
    gun(),
    sale('red', 1, 100), spend('red', 2, 30), sale('blue', 3, 40),
    sale('red', 200, 9999), // after the last horizon: does not count
  ];
  const b = raceBoard(reduce(events, CAT), CAT, T0 + 10 * DAY);
  const red = b.lanes.find((l) => l.id === 'red'), blue = b.lanes.find((l) => l.id === 'blue'), gold = b.lanes.find((l) => l.id === 'gold');
  assert.equal(red.bankrollUsd, 320);
  assert.equal(red.multiple, 1.28);
  assert.equal(blue.bankrollUsd, 290);
  assert.equal(gold.bankrollUsd, 250);
  assert.equal(b.day, 11);
  assert.equal(b.totalDays, 180);
  assert.equal(b.stakedUsd, 2000);
  assert.equal(b.potUsd, 2000 + 70 + 40);
  assert.equal(red.place, 1);
  assert.equal(b.leaderId, 'red');
  // the race keeps counting nothing past its end
  const end = raceBoard(reduce(events, CAT), CAT, T0 + 400 * DAY);
  assert.equal(end.over, true);
  assert.equal(end.lanes.find((l) => l.id === 'red').bankrollUsd, 320);
});

test('each horizon locks its winner when it passes; ties win nothing', () => {
  const events = [gun(), sale('red', 2, 300), sale('blue', 9, 900)];
  const b = raceBoard(reduce(events, CAT), CAT, T0 + 12 * DAY);
  const [w1, d30, d90] = b.standings;
  assert.equal(w1.state, 'done');
  assert.equal(w1.winner, 'red'); // blue's big sale came after day 7
  assert.equal(w1.ranking[0].bankrollUsd, 550);
  assert.equal(d30.state, 'live');
  assert.equal(d30.winner, null);
  assert.equal(d30.leader, 'blue');
  assert.equal(d30.daysLeft, 18);
  assert.equal(d90.state, 'upcoming');
  const quiet = raceBoard(reduce([gun()], CAT), CAT, T0 + 8 * DAY);
  assert.equal(quiet.standings[0].tie, true);
  assert.equal(quiet.standings[0].winner, null);
  assert.equal(quiet.leaderId, null);
});

test('rates, plays and the breakdown come from the ledger', () => {
  const events = [
    gun(),
    { kind: 'play', id: 'p1', ts: at(0.5), path: 'red', play: 'shop', name: 'Planner shop', status: 'trying', plan: 'ten planners', by: 'agent' },
    { kind: 'step', id: 's1', ts: at(0.6), path: 'red', type: 'plan', text: 'sell planners', by: 'agent' },
    spend('red', 1, 40, { play: 'shop', category: 'tool' }),
    sale('red', 5, 60, { play: 'shop' }), sale('red', 8, 70, { play: 'shop' }), sale('red', 9, 10),
    { kind: 'play', id: 'p2', ts: at(8.5), path: 'red', play: 'shop', name: 'Planner shop', status: 'working', why: 'sales', by: 'agent' },
    { kind: 'step', id: 's2', ts: at(9.5), path: 'red', type: 'blocked', text: 'needs Joshua to confirm an account', play: 'shop', by: 'agent' },
  ];
  const now = T0 + 10 * DAY;
  const red = raceBoard(reduce(events, CAT), CAT, now).lanes.find((l) => l.id === 'red');
  assert.equal(red.bankrollUsd, 350);
  // last 7 days (day 3 to 10): +60 +70 +10
  assert.equal(red.rate7, 20);
  assert.equal(red.rateAll, 10);
  assert.equal(red.plays.length, 1);
  const shop = red.plays[0];
  assert.equal(shop.status, 'working');
  assert.equal(shop.plan, 'ten planners');
  assert.equal(shop.inUsd, 130);
  assert.equal(shop.outUsd, 40);
  assert.equal(shop.netUsd, 90);
  assert.equal(shop.sales, 2);
  assert.deepEqual(red.loose, { inUsd: 10, outUsd: 0, n: 1 });
  assert.equal(red.plan.text, 'sell planners');
  assert.equal(red.blocked.text, 'needs Joshua to confirm an account');
  assert.equal(red.timelineTotal, 8);
  assert.equal(red.timeline[0].kind, 'step');
  assert.equal(red.timeline[0].day, 10);
  assert.equal(red.timeline.find((x) => x.kind === 'out').playName, 'Planner shop');
  // any later move clears blocked
  const moved = raceBoard(reduce([...events, { kind: 'play', id: 'p3', ts: at(9.8), path: 'red', play: 'shop', name: 'Planner shop', status: 'paused', by: 'agent' }], CAT), CAT, now).lanes.find((l) => l.id === 'red');
  assert.equal(moved.blocked, null);
});

test('the race template, mode and demo; the snapshot carries the board and not every step', () => {
  assert.ok(MODES.race);
  const cfg = fromTemplate('race');
  assert.equal(cfg.mode, 'race');
  assert.equal(cfg.rooms.length, 8);
  const { dir, ledger } = tmpLedger();
  const n = seedRaceDemo(ledger, dir, T0 + 20 * DAY);
  assert.ok(n > 100);
  assert.throws(() => seedRaceDemo(ledger, dir), /refusing/);
  const cat = loadCatalog(dir);
  assert.equal(stationInfo(dir).mode, 'race');
  assert.equal(stationInfo(dir).folk.length, 8);
  const snap = snapshot(ledger, cat, dir, T0 + 20 * DAY);
  assert.equal(snap.state.demo, true);
  assert.equal(snap.state.steps, undefined);
  assert.ok(snap.state.stepCount > 20);
  assert.equal(snap.race.day, 13);
  assert.equal(snap.race.standings[0].winner, 'red');
  assert.equal(snap.race.leaderId, 'blue');
  assert.ok(snap.race.lanes.find((l) => l.id === 'violet').bankrollUsd < 250);
  // every dollar in the demo carries evidence and a play
  assert.ok(ledger.readAll().filter((e) => e.kind === 'money.in').every((e) => e.evidence && e.play));
});
