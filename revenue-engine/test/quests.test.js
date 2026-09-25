import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from '../src/reduce.js';
import { quests, summary } from '../src/quests.js';
import { validate } from '../src/ledger.js';
import { TEST_CATALOG } from './helpers.js';

const ev = (o) => validate(o);
const byId = (list, id) => list.find((q) => q.id === id);

test('an empty ledger opens the gate, the first stage of each path, the ladder and yield', () => {
  const q = quests(reduce([], TEST_CATALOG), TEST_CATALOG);
  assert.equal(byId(q, 'gate:employment-agreement').status, 'open');
  assert.equal(byId(q, 'stage:alpha:prospect').status, 'open');
  assert.equal(byId(q, 'stage:alpha:prospect').gated, true);
  assert.equal(byId(q, 'stage:beta:prospect').gated, false);
  assert.equal(byId(q, 'stage:alpha:conversation'), undefined, 'only the next stage is shown');
  assert.equal(byId(q, 'ladder:1').status, 'open');
  assert.equal(byId(q, 'yield:1').status, 'open');
  assert.match(byId(q, 'yield:1').desc, /undefined, not zero/);
  assert.equal(summary(q).done, 0);
  assert.equal(q[0].kind, 'gate', 'open gates lead');
});

test('a cleared gate is done and un-gates its stage quests', () => {
  const st = reduce([ev({ kind: 'gate', gate: 'employment-agreement', cleared: true, evidence: 'read it' })], TEST_CATALOG);
  const q = quests(st, TEST_CATALOG);
  assert.equal(byId(q, 'gate:employment-agreement').status, 'done');
  assert.equal(byId(q, 'stage:alpha:prospect').gated, false);
});

test('a blocked gate is open and flagged', () => {
  const st = reduce([ev({ kind: 'gate', gate: 'employment-agreement', cleared: false, evidence: 'non-compete covers it' })], TEST_CATALOG);
  const g = byId(quests(st, TEST_CATALOG), 'gate:employment-agreement');
  assert.equal(g.status, 'open');
  assert.equal(g.blocked, true);
});

test('stage quests chain: finishing prospect surfaces conversation, citing the outcomes', () => {
  const events = [
    ev({ kind: 'outcome', path: 'alpha', stage: 'prospect', ref: 'A', evidence: 'https://a', by: 'agent', id: 'o1' }),
    ev({ kind: 'outcome', path: 'alpha', stage: 'prospect', ref: 'B', evidence: 'https://b', by: 'agent', id: 'o2' }),
  ];
  const q = quests(reduce(events, TEST_CATALOG), TEST_CATALOG);
  const p = byId(q, 'stage:alpha:prospect');
  assert.equal(p.status, 'done');
  assert.deepEqual(p.cites, ['o1', 'o2']);
  assert.equal(byId(q, 'stage:alpha:conversation').status, 'open');
  assert.equal(byId(q, 'stage:alpha:demo'), undefined);
});

test('the paid stage is satisfied by evidenced money.in even without a paid outcome', () => {
  const events = [
    ev({ kind: 'outcome', path: 'beta', stage: 'prospect', ref: 'A', evidence: 'https://a', by: 'user' }),
    ev({ kind: 'outcome', path: 'beta', stage: 'conversation', ref: 'A', evidence: 'email', by: 'user' }),
    ev({ kind: 'outcome', path: 'beta', stage: 'demo', ref: 'A', evidence: 'cal', by: 'user' }),
    ev({ kind: 'outcome', path: 'beta', stage: 'pilot', ref: 'A', evidence: 'contract', by: 'user' }),
    ev({ kind: 'money.in', usd: 250, path: 'beta', source: 'A', evidence: 'inv-1' }),
  ];
  const q = quests(reduce(events, TEST_CATALOG), TEST_CATALOG);
  assert.equal(byId(q, 'stage:beta:paid').status, 'done');
  assert.equal(byId(q, 'stage:beta:retained').status, 'open');
  assert.equal(byId(q, 'ladder:1').status, 'done');
  assert.equal(byId(q, 'ladder:1000').status, 'open');
});

test('a killed path shows no open stage quest', () => {
  const st = reduce([ev({ kind: 'path.status', path: 'beta', status: 'killed', reason: 'failed kill test' })], TEST_CATALOG);
  const q = quests(st, TEST_CATALOG);
  assert.equal(q.some((x) => x.path === 'beta' && x.status === 'open'), false);
});

test('yield quests turn done only with real spend and real earnings', () => {
  const events = [
    ev({ kind: 'money.out', usd: 10, category: 'api', evidence: 'runs' }),
    ev({ kind: 'money.in', usd: 150, path: 'beta', source: 'A', evidence: 'inv' }),
  ];
  const q = quests(reduce(events, TEST_CATALOG), TEST_CATALOG);
  assert.equal(byId(q, 'yield:1').status, 'done');
  assert.equal(byId(q, 'yield:10').status, 'done');
  assert.match(byId(q, 'yield:10').desc, /15\.00/);
});

test('open quests come before done quests', () => {
  const events = [ev({ kind: 'gate', gate: 'employment-agreement', cleared: true, evidence: 'read it' })];
  const q = quests(reduce(events, TEST_CATALOG), TEST_CATALOG);
  const firstDone = q.findIndex((x) => x.status === 'done');
  const lastOpen = q.map((x) => x.status).lastIndexOf('open');
  assert.ok(lastOpen < firstDone);
});
