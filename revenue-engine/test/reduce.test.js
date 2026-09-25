import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from '../src/reduce.js';
import { commanderLevel } from '../src/level.js';
import { validate } from '../src/ledger.js';
import { TEST_CATALOG } from './helpers.js';

const ev = (o) => validate(o);

test('totals, per-path split and yield ratio come straight from the ledger', () => {
  const events = [
    ev({ kind: 'money.out', usd: 2, category: 'api', path: 'alpha', evidence: 'run' }),
    ev({ kind: 'money.out', usd: 3, category: 'tool', evidence: 'domain' }),
    ev({ kind: 'money.in', usd: 50, path: 'alpha', source: 'Acme', evidence: 'inv-1' }),
  ];
  const st = reduce(events, TEST_CATALOG);
  assert.equal(st.earnedUsd, 50);
  assert.equal(st.spentUsd, 5);
  assert.equal(st.yieldRatio, 10);
  assert.equal(st.paths.alpha.earnedUsd, 50);
  assert.equal(st.paths.alpha.spentUsd, 2);
  assert.equal(st.paths.general.spentUsd, 3);
  assert.equal(st.paths.general.known, false);
});

test('yield is null, not zero, when nothing has been spent', () => {
  const st = reduce([ev({ kind: 'money.in', usd: 5, path: 'beta', source: 'A', evidence: 'inv' })], TEST_CATALOG);
  assert.equal(st.yieldRatio, null);
});

test('outcomes are deduplicated by (path, stage, ref) ignoring case and whitespace', () => {
  const events = [
    ev({ kind: 'outcome', path: 'alpha', stage: 'prospect', ref: 'Acme Dental', evidence: 'https://a', by: 'agent' }),
    ev({ kind: 'outcome', path: 'alpha', stage: 'prospect', ref: ' acme dental ', evidence: 'https://a', by: 'user' }),
    ev({ kind: 'outcome', path: 'alpha', stage: 'conversation', ref: 'Acme Dental', evidence: 'email: re: audit', by: 'user' }),
  ];
  const st = reduce(events, TEST_CATALOG);
  assert.equal(st.paths.alpha.outcomes.prospect, 1);
  assert.equal(st.paths.alpha.outcomes.conversation, 1);
  assert.equal(st.paths.alpha.refs.prospect[0].ref, 'Acme Dental');
});

test('runs pair start with end; spend is not double counted from run.end', () => {
  const events = [
    ev({ kind: 'agent.run.start', runId: 'r1', path: 'alpha', role: 'prospector', model: 'm', maxUsd: 1 }),
    ev({ kind: 'money.out', usd: 0.4, category: 'api', path: 'alpha', runId: 'r1' }),
    ev({ kind: 'agent.run.end', runId: 'r1', path: 'alpha', role: 'prospector', model: 'm', usd: 0.4, iterations: 1, reason: 'done' }),
    ev({ kind: 'agent.run.start', runId: 'r2', path: 'alpha', role: 'prospector', model: 'm', maxUsd: 1 }),
  ];
  const st = reduce(events, TEST_CATALOG);
  assert.equal(st.spentUsd, 0.4);
  assert.equal(st.runs.length, 1);
  assert.equal(st.runs[0].reason, 'done');
  assert.equal(st.running.length, 1);
  assert.equal(st.running[0].runId, 'r2');
});

test('path status and gates are the latest event wins', () => {
  const events = [
    ev({ kind: 'gate', gate: 'employment-agreement', cleared: false, evidence: 'unread', ts: '2026-01-01T00:00:00Z' }),
    ev({ kind: 'gate', gate: 'employment-agreement', cleared: true, evidence: 'read, no non-compete', ts: '2026-01-02T00:00:00Z' }),
    ev({ kind: 'path.status', path: 'beta', status: 'killed', reason: 'kill test failed' }),
  ];
  const st = reduce(events, TEST_CATALOG);
  assert.equal(st.gates['employment-agreement'].cleared, true);
  assert.equal(st.paths.beta.status, 'killed');
});

test('commander level cites the payment that crossed each rung', () => {
  const events = [
    ev({ kind: 'money.in', usd: 600, path: 'alpha', source: 'A', evidence: 'inv-1', ts: '2026-01-01T00:00:00Z', id: 'p1' }),
    ev({ kind: 'money.in', usd: 600, path: 'alpha', source: 'B', evidence: 'inv-2', ts: '2026-01-02T00:00:00Z', id: 'p2' }),
  ];
  const lv = commanderLevel(reduce(events, TEST_CATALOG));
  assert.equal(lv.level, 2);
  assert.equal(lv.citations.length, 2);
  assert.equal(lv.citations[0].crossedBy, 'p1');
  assert.equal(lv.citations[1].crossedBy, 'p2');
  assert.equal(lv.next.usd, 10000);
  assert.equal(lv.next.remainingUsd, 8800);
});

test('empty ledger is level 0 with no citations', () => {
  const lv = commanderLevel(reduce([], TEST_CATALOG));
  assert.equal(lv.level, 0);
  assert.deepEqual(lv.citations, []);
});
