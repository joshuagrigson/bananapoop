import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpLedger } from './helpers.js';
import { validate, DEFAULT_HORIZONS } from '../src/ledger.js';
import { reduce } from '../src/reduce.js';
import { raceBoard, raceBrief, racePlaybook } from '../src/race.js';
import { snapshot } from '../src/api.js';
import { seedRaceDemo } from '../src/demo.js';
import { fromTemplate, catalogFrom, loadCatalog, stationInfo, MODES } from '../src/rooms.js';

const DAY = 86400e3;
const T0 = Date.parse('2026-09-01T12:00:00Z');
const at = (d) => new Date(T0 + d * DAY).toISOString();
const CAT = catalogFrom(fromTemplate('race'));
// these races move real money: a race is a simulation unless it says otherwise
const gun = (extra = {}) => ({ kind: 'race', id: 'gun', ts: at(0), stakeUsd: 250, evidence: 'eight cards', horizons: [7, 30, 90, 180], ...extra, rules: { moneyMode: 'real', ...(extra.rules || {}) } });
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
  assert.equal(red.rateRecent, 20);
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
  // the demo is a simulation: its money comes from the market model, its research from real pages
  assert.equal(snap.race.simMode, true);
  assert.ok(snap.race.standings[0].winner);
  assert.ok(snap.race.leaderId);
  assert.ok(snap.race.sim.totals.research >= 8 && snap.race.sim.totals.variants >= 16 && snap.race.sim.totals.live >= 8);
  assert.ok(snap.race.lanes.some((l) => l.inUsd > 0));
  assert.equal(snap.race.breakCount, 0);
  // every dollar in the demo carries evidence and a play
  assert.ok(ledger.readAll().filter((e) => e.kind === 'money.in').every((e) => e.evidence && e.play));
});

test('race rules: defaults are written on the ledger, bad rules are refused, amendments change only the rules', () => {
  const ev = validate({ kind: 'race', stakeUsd: 250, evidence: 'cards' });
  assert.ok(ev.rules.methods.includes('digital'));
  // no list by default: any legal way the agent's research supports, long shots included
  assert.equal(ev.rules.anyMethod, true);
  assert.ok(ev.rules.methods.includes('betting'));
  assert.ok(!ev.rules.connectors.includes('Microsoft 365'));
  assert.equal(ev.rules.outreach, 'drafts');
  assert.throws(() => validate({ kind: 'race', stakeUsd: 250, evidence: 'cards', rules: { methods: ['crime'] } }), /methods must be from/);
  assert.throws(() => validate({ kind: 'race', stakeUsd: 250, evidence: 'cards', rules: { outreach: 'spam' } }), /outreach must be one of/);
  assert.throws(() => validate({ kind: 'race', stakeUsd: 250, evidence: 'cards', rules: { everyHours: 0 } }), /everyHours/);
  assert.throws(() => validate({ kind: 'race', stakeUsd: 250, evidence: 'cards', rules: { stakes: { red: -5 } } }), /stakes/);
  assert.throws(() => validate({ kind: 'race', amend: true, rules: {} }), /amendment needs evidence/);
  const events = [gun({ rules: { approveOverUsd: 50 } }), { kind: 'race', id: 'am', ts: at(3), amend: true, evidence: 'Joshua allowed ads off', rules: { moneyMode: 'real', ads: false } }];
  const st = reduce(events.map((e) => validate(e)), CAT);
  assert.equal(st.race.startedAt, at(0));
  assert.equal(st.race.rules.ads, false);
  assert.equal(st.race.amendments.length, 1);
});

test('per-room stakes, scoring by multiple, knockouts and the earliest tie-break', () => {
  const rules = { stakes: { blue: 500 }, scoring: 'multiple', knockoutUsd: 0, tiebreak: 'earliest' };
  const events = [gun({ rules }), sale('red', 1, 250), sale('blue', 2, 400), spend('gold', 1, 250), sale('gold', 3, 900), sale('green', 4, 250)];
  const b = raceBoard(reduce(events.map((e) => validate(e)), CAT), CAT, T0 + 10 * DAY);
  const lane = (id) => b.lanes.find((l) => l.id === id);
  assert.equal(lane('blue').stakeUsd, 500);
  assert.equal(lane('blue').multiple, 1.8);
  assert.equal(lane('red').multiple, 2);
  assert.equal(lane('gold').out.day, 2); // fell to $0 on day 2, so its later $900 cannot win
  assert.equal(lane('gold').place, 8);
  // red and green both reach x2; red got there first
  const w1 = b.standings[0];
  assert.equal(w1.tieBroken, true);
  assert.equal(w1.winner, 'red');
  assert.equal(b.stakedUsd, 2250);
});

test('spend against income, sources, and each play\'s business model', () => {
  const events = [
    gun(),
    { kind: 'play', id: 'p1', ts: at(0.5), path: 'red', play: 'shop', name: 'Planner shop', status: 'trying', offer: 'planners', customer: 'students', channel: 'Pinterest', pricing: '$9', costs: 'Shopify', by: 'agent' },
    { kind: 'play', id: 'p2', ts: at(0.6), path: 'red', play: 'ads', name: 'Ads', status: 'trying', by: 'agent' },
    spend('red', 1, 40, { play: 'shop', category: 'tool' }), spend('red', 1.5, 20, { play: 'ads', category: 'ads' }),
    sale('red', 2, 9, { play: 'shop', source: 'Shopify' }), sale('red', 3, 9, { play: 'shop', source: 'Etsy' }), sale('red', 4, 12, { play: 'shop', source: 'Shopify' }),
    { kind: 'play', id: 'p3', ts: at(5), path: 'red', play: 'ads', name: 'Ads', status: 'dropped', why: 'no sales', by: 'agent' },
  ];
  const b = raceBoard(reduce(events.map((e) => validate(e)), CAT), CAT, T0 + 6 * DAY);
  const red = b.lanes.find((l) => l.id === 'red');
  assert.equal(red.backPerDollar, 0.5);
  assert.deepEqual(red.bySource.map((s) => [s.key, s.usd, s.n]), [['Shopify', 21, 2], ['Etsy', 9, 1]]);
  assert.deepEqual(red.byCategory.map((c) => [c.key, c.usd]), [['tool', 40], ['ads', 20]]);
  const shop = red.plays.find((p) => p.id === 'shop'), ads = red.plays.find((p) => p.id === 'ads');
  assert.equal(shop.model.offer, 'planners');
  assert.equal(shop.avgSaleUsd, 10);
  assert.equal(shop.costPerSaleUsd, 13.33);
  assert.equal(shop.firstSaleDay, 3);
  assert.equal(shop.money.length, 4);
  assert.equal(ads.status, 'dropped');
  assert.equal(ads.activeMin, Math.round(4.4 * 1440));
  assert.deepEqual(b.bySource.map((s) => s.key), ['Shopify', 'Etsy']);
});

test('the brief is written from the rules', () => {
  const events = [gun({ rules: { methods: ['digital', 'services'], ads: false, approveOverUsd: 25, connectors: ['Shopify', 'Canva'], notes: 'Be kind.', models: { red: 'claude-opus-5-5' } } })];
  const b = raceBoard(reduce(events.map((e) => validate(e)), CAT), CAT, T0 + DAY);
  const text = raceBrief(b, 'red', { roomName: 'Red', lead: 'Ada' });
  assert.match(text, /RED room/);
  assert.match(text, /\(Ada\)/);
  assert.match(text, /Claude Opus 5\.5/);
  assert.match(text, /ANY legal way your research supports/);
  assert.match(text, /Never spend on: ads/);
  assert.match(text, /over \$25 needs Joshua/);
  assert.match(text, /Shopify, Canva\./);
  assert.match(text, /Be kind\./);
});

test('a race set for later has not started yet', () => {
  const b = raceBoard(reduce([validate(gun({ startsAt: at(3) }))], CAT), CAT, T0 + DAY);
  assert.equal(b.started, false);
  assert.equal(b.startsInDays, 2);
  assert.equal(b.day, 0);
});

test('a short race: prize times in minutes, rates per hour, check-ins in minutes', () => {
  const events = [
    gun({ horizonsMin: [30, 60, 120], rules: { everyMinutes: 10 } }),
    { kind: 'money.in', id: 'a', ts: new Date(T0 + 20 * 60e3).toISOString(), path: 'red', usd: 30, source: 'buyer', evidence: 'order 1' },
    { kind: 'money.in', id: 'b', ts: new Date(T0 + 50 * 60e3).toISOString(), path: 'blue', usd: 50, source: 'buyer', evidence: 'order 2' },
  ].map((e) => validate(e));
  assert.equal(events[0].horizons, undefined);
  assert.deepEqual(events[0].horizonsMin, [30, 60, 120]);
  assert.equal(events[0].rules.everyMinutes, 10);
  const b = raceBoard(reduce(events, CAT), CAT, T0 + 70 * 60e3);
  assert.equal(b.short, true);
  assert.equal(b.rateUnit, 'hour');
  assert.equal(b.elapsedMin, 70);
  assert.equal(b.totalMin, 120);
  assert.deepEqual(b.standings.map((s) => [s.label, s.state, s.winner]), [['30 min', 'done', 'red'], ['1 hour', 'done', 'blue'], ['2 hours', 'live', null]]);
  assert.equal(b.standings[2].minsLeft, 50);
  const red = b.lanes.find((l) => l.id === 'red');
  assert.equal(red.rateAll, Math.round((30 / 70) * 60 * 100) / 100);
  assert.equal(red.series.length, 15); // a point every 5 minutes, and the gun
  assert.equal(red.timeline[0].min, 20);
  assert.match(raceBrief(b, 'red', {}), /at 30 min, 1 hour, 2 hours after the start/);
  assert.match(raceBrief(b, 'red', {}), /Check in every 10 min\./);
  assert.match(raceBrief(raceBoard(reduce([validate(gun({ horizonsMin: [60], rules: { everyMinutes: 0 } }))], CAT), CAT, T0), 'red', {}), /in one session/);
  assert.throws(() => validate(gun({ horizonsMin: [0] })), /prize times/);
  assert.throws(() => validate(gun({ rules: { everyMinutes: -1 } })), /everyMinutes/);
});

test('a play\'s playbook: the model, every step and dollar in order, where it needed a person, and the caveat', async () => {
  const events = [
    gun(),
    { kind: 'play', id: 'p1', ts: at(0.5), path: 'red', play: 'shop', name: 'Planner shop', status: 'trying', offer: 'Ten planners', customer: 'students', channel: 'Pinterest', pricing: '$9', costs: 'Shopify', plan: 'sell planners', by: 'agent' },
    spend('red', 0.6, 39, { play: 'shop', category: 'tool', payee: 'Shopify' }),
    { kind: 'step', id: 's1', ts: at(0.7), path: 'red', play: 'shop', type: 'did', text: 'Designed ten planners', by: 'agent' },
    { kind: 'step', id: 's2', ts: at(0.8), path: 'red', play: 'shop', type: 'blocked', text: 'Pinterest needs Joshua', by: 'agent' },
    sale('red', 2, 9, { play: 'shop', item: 'Planner', source: 'Shopify' }),
    { kind: 'step', id: 's3', ts: at(3), path: 'red', play: 'shop', type: 'learned', text: 'The ADHD planner sells best', by: 'agent' },
    { kind: 'play', id: 'p2', ts: at(3.5), path: 'red', play: 'shop', name: 'Planner shop', status: 'working', why: 'first sales', by: 'agent' },
  ].map((e) => validate(e));
  const st = reduce(events, CAT);
  const md = racePlaybook(st, CAT, 'red', 'shop', T0 + 5 * DAY, { lead: 'Ada' });
  assert.match(md, /^# Playbook: Planner shop/);
  assert.match(md, /run by Ada/);
  assert.match(md, /\*\*What it sells:\*\* Ten planners/);
  const steps = md.split('## Do it yourself')[1].split('## What it learned')[0];
  assert.ok(steps.indexOf('Paid $39.00 for Shopify') < steps.indexOf('Designed ten planners'));
  assert.ok(steps.indexOf('Designed ten planners') < steps.indexOf('(needed a person) Pinterest'));
  assert.match(steps, /Play marked working: first sales/);
  assert.match(md, /## What it learned\n- day 4: The ADHD planner sells best/);
  assert.match(md, /\| day 3 \| in \| Planner \| \+\$9\.00 \|/);
  assert.match(md, /not guaranteed to make the same amount/);
  assert.equal(racePlaybook(st, CAT, 'red', 'nope', T0 + DAY), null);
  // the API serves it
  const { tmpLedger } = await import('./helpers.js');
  const { createApi } = await import('../src/api.js');
  const { ledger } = tmpLedger();
  for (const e of events) ledger.append(e);
  const handle = createApi({ ledger, catalog: CAT, dataDir: null });
  const r = await handle('GET', '/api/race/playbook/red/shop', () => ({}));
  assert.equal(r.code, 200);
  assert.match(r.body.markdown, /Planner shop/);
  assert.equal((await handle('GET', '/api/race/playbook/red/none', () => ({}))).code, 404);
});

test('every rule the setup offers is validated, and left-out rules take their defaults', () => {
  const r = validate(gun({ rules: { purpose: 'demand', moneyMode: 'paper', scoring: 'signals', places: 3, customRules: [{ kind: 'must', text: 'fruit names' }], quietHours: { from: '22:00', to: '07:00' }, signalWeights: { signup: 3 } } })).rules;
  assert.equal(r.purpose, 'demand'); assert.equal(r.places, 3); assert.equal(r.signalWeights.signup, 3); assert.equal(r.signalWeights.preorder, 10);
  assert.deepEqual(r.banned, ['TikTok']); assert.equal(r.ruleBreak, 'warn');
  assert.throws(() => validate(gun({ rules: { scoring: 'vibes' } })), /scoring must be one of/);
  assert.throws(() => validate(gun({ rules: { places: 4 } })), /places/);
  assert.throws(() => validate(gun({ rules: { quietHours: { from: '25:00', to: '07:00' } } })), /quietHours/);
  assert.throws(() => validate(gun({ rules: { customRules: [{ kind: 'should', text: 'x' }] } })), /customRules/);
  assert.equal(validate(gun({ rules: { ads: false } })).rules.spendCategories.includes('ads'), false);
  assert.throws(() => validate({ kind: 'signal', path: 'red', type: 'signup', by: 'agent', evidence: '' }), /evidence/);
  assert.throws(() => validate({ kind: 'signal', path: 'red', type: 'like', by: 'agent', evidence: 'list' }), /signal type/);
  assert.throws(() => validate({ kind: 'judge', path: 'red', points: 5000, why: 'x' }), /points/);
});

test('scoring can be demand, judge points, sales, profit or return per dollar; each prize has places', () => {
  const sig = (room, d, type, count) => ({ kind: 'signal', id: `s${room}${d}${type}`, ts: at(d), path: room, type, count, evidence: 'waitlist', by: 'agent' });
  const judge = (room, d, points) => ({ kind: 'judge', id: `j${room}${d}`, ts: at(d), path: room, points, why: 'good' });
  const base = [sig('red', 1, 'signup', 30), sig('blue', 1, 'preorder', 2), sig('gold', 2, 'view', 100), judge('gold', 3, 7), judge('red', 3, 2)];
  let b = raceBoard(reduce([gun({ rules: { scoring: 'signals', places: 3 } }), ...base]), CAT, T0 + 8 * DAY);
  assert.equal(b.lanes.find((l) => l.id === 'red').score, 30);
  assert.equal(b.lanes.find((l) => l.id === 'blue').score, 20);
  assert.equal(b.standings[0].winner, 'red');
  assert.deepEqual(b.standings[0].podium, ['red', 'blue', 'gold']);
  assert.equal(b.lanes.find((l) => l.id === 'red').scoreText, '30 demand');
  b = raceBoard(reduce([gun({ rules: { scoring: 'judge' } }), ...base]), CAT, T0 + 8 * DAY);
  assert.equal(b.standings[0].winner, 'gold');
  const money = [sale('red', 1, 100), sale('red', 2, 10), spend('red', 1, 100), sale('blue', 1, 60), spend('blue', 1, 10)];
  b = raceBoard(reduce([gun({ rules: { scoring: 'sales' } }), ...money]), CAT, T0 + 8 * DAY);
  assert.equal(b.standings[0].winner, 'red');
  b = raceBoard(reduce([gun({ rules: { scoring: 'profit' } }), ...money]), CAT, T0 + 8 * DAY);
  assert.equal(b.standings[0].winner, 'blue'); assert.equal(b.lanes.find((l) => l.id === 'blue').scoreText, '+$50');
  b = raceBoard(reduce([gun({ rules: { scoring: 'roi' } }), ...money]), CAT, T0 + 8 * DAY);
  assert.equal(b.standings[0].winner, 'blue');
  b = raceBoard(reduce([gun({ rules: { scoring: 'firstDollar', tiebreak: 'earliest' } }), sale('red', 2, 1), sale('blue', 1, 1)]), CAT, T0 + 8 * DAY);
  assert.equal(b.standings[0].winner, 'blue');
});

test('the ledger flags the rule breaks it can see, and fines or knocks out as the race says', () => {
  const rules = { maxSpendPerDayUsd: 20, approveOverUsd: 15, spendCategories: ['tool', 'api'], banned: ['TikTok'], ruleBreak: 'fine', fineUsd: 10 };
  const ev = [gun({ rules }), spend('red', 1, 18, { category: 'tool' }), spend('red', 1.1, 5, { category: 'tool' }), spend('blue', 1, 5), spend('gold', 1, 16, { category: 'tool', approved: true }),
    { kind: 'step', id: 'st1', ts: at(2), path: 'teal', text: 'posted the video on TikTok', by: 'agent' }];
  const b = raceBoard(reduce(ev), CAT, T0 + 8 * DAY), br = (id) => b.lanes.find((l) => l.id === id).breaks.map((x) => x.rule);
  assert.deepEqual(br('red').sort(), ['approval', 'dailyCap']);
  assert.deepEqual(br('blue'), ['category']);
  assert.deepEqual(br('gold'), []);
  assert.deepEqual(br('teal'), ['banned']);
  assert.equal(b.lanes.find((l) => l.id === 'red').bankrollUsd, 250 - 23 - 20);
  assert.equal(b.breakCount, 4);
  const out = raceBoard(reduce([gun({ rules: { ...rules, ruleBreak: 'out' } }), ...ev.slice(1)]), CAT, T0 + 8 * DAY);
  assert.match(out.lanes.find((l) => l.id === 'teal').out.why, /broke a rule/);
  assert.equal(out.lanes.find((l) => l.id === 'teal').place, 8 - 3 + 1);
  const paper = raceBoard(reduce([gun({ rules: { moneyMode: 'paper', scoring: 'signals' } }), sale('red', 1, 5)]), CAT, T0 + 8 * DAY);
  assert.equal(paper.paper, true); assert.deepEqual(paper.lanes.find((l) => l.id === 'red').breaks.map((x) => x.rule), ['paper']);
});

test('last place goes out at each prize but the final one; a quiet room goes out; weak evidence is shown, not counted', () => {
  const ev = [gun({ horizons: [7, 30], rules: { eliminateLast: true } }), ...CAT.filter((p) => p.id !== 'pink').map((p, i) => sale(p.id, 1, 10 + i))];
  let b = raceBoard(reduce(ev), CAT, T0 + 8 * DAY);
  assert.equal(b.standings[0].eliminated, 'pink');
  assert.match(b.lanes.find((l) => l.id === 'pink').out.why, /last place at 1 week/);
  assert.equal(b.standings[1].ranking.at(-1).id, 'pink');
  const idle = [gun({ rules: { idleOutMinutes: 3 * 1440 } }), { kind: 'step', id: 'x', ts: at(1), path: 'red', text: 'working', by: 'agent' }];
  b = raceBoard(reduce(idle), CAT, T0 + 8 * DAY);
  assert.match(b.lanes.find((l) => l.id === 'red').out.why, /no move for 3 days/);
  assert.equal(b.lanes.find((l) => l.id === 'red').out.day, 5);
  b = raceBoard(reduce([gun({ rules: { evidence: 'link' } }), sale('red', 1, 50), sale('blue', 1, 50, { evidence: 'https://stripe.com/x' })]), CAT, T0 + 8 * DAY);
  assert.equal(b.lanes.find((l) => l.id === 'red').bankrollUsd, 250);
  assert.equal(b.lanes.find((l) => l.id === 'red').uncounted.length, 1);
  assert.equal(b.lanes.find((l) => l.id === 'blue').bankrollUsd, 300);
});

test('the brief carries every rule: purpose, paper money, contact, custom rules and the room\'s own note', () => {
  const b = raceBoard(reduce([gun({ rules: { purpose: 'idea', moneyMode: 'paper', scoring: 'signals', outreach: 'direct', maxMessagesPerDay: 9, customRules: [{ kind: 'mustnot', text: 'sell to kids' }], roomNotes: { red: 'B2B only' }, banned: ['TikTok', 'Etsy'], visibility: 'blind' } })]), CAT, T0 + DAY);
  const t = raceBrief(b, 'red', { roomName: 'Red' });
  for (const want of [/Find an idea I can run for real/, /PAPER race/, /At most 9 messages a day/, /MUST NOT: sell to kids/, /For your room only:\nB2B only/, /Never use or mention: TikTok, Etsy/, /only at your own room/, /race signal red/]) assert.match(t, want);
  assert.doesNotMatch(raceBrief(b, 'blue', { roomName: 'Blue' }), /B2B only/);
});
