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
