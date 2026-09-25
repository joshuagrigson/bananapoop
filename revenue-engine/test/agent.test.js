import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runAgent, ROLES } from '../src/agent.js';
import { reduce } from '../src/reduce.js';
import { costUsd } from '../src/cost.js';
import { tmpLedger, TEST_CATALOG } from './helpers.js';

const script = JSON.parse(fs.readFileSync(new URL('../replay/prospector-demo.json', import.meta.url), 'utf8'));
const MODEL = 'claude-opus-5';

test('a replayed prospector run logs evidenced prospects, rejects the unevidenced one, writes the outbox, and reconciles cost', async () => {
  const { dir, ledger } = tmpLedger();
  const result = await runAgent({
    role: 'prospector', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG,
    provider: { kind: 'replay', script }, model: MODEL, maxUsd: 5,
  });
  assert.equal(result.reason, 'done');
  assert.equal(result.iterations, 4);
  const expected = script.reduce((s, step) => s + costUsd(MODEL, step.usage), 0);
  assert.ok(Math.abs(result.usd - expected) < 1e-9);

  const st = reduce(ledger.readAll(), TEST_CATALOG);
  assert.equal(st.paths.beta.outcomes.prospect, 2, 'the evidence-less prospect never reached the ledger');
  assert.equal(st.paths.beta.refs.prospect.every((r) => r.by === 'agent' && /^https:/.test(r.evidence)), true);
  assert.equal(st.runs.length, 1);
  assert.equal(st.runs[0].reason, 'done');
  assert.ok(Math.abs(st.spentUsd - expected) < 1e-9, 'per-iteration money.out sums to the run cost');
  assert.equal(st.moneyOut.length, 4);
  assert.ok(fs.existsSync(path.join(dir, 'outbox', 'beta', 'prospects.md')));
});

test('a run stops with reason "budget" once cumulative cost reaches the cap, before more tools fire', async () => {
  const { dir, ledger } = tmpLedger();
  const step1 = costUsd(MODEL, script[0].usage);
  const result = await runAgent({
    role: 'prospector', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG,
    provider: { kind: 'replay', script }, model: MODEL, maxUsd: step1,
  });
  assert.equal(result.reason, 'budget');
  assert.equal(result.iterations, 1);
  const st = reduce(ledger.readAll(), TEST_CATALOG);
  assert.equal(st.paths.beta.outcomes.prospect, 0, 'tools after the budget break never ran');
});

test('a gated path refuses to spend until the gate is cleared', async () => {
  const { dir, ledger } = tmpLedger();
  await assert.rejects(
    runAgent({ role: 'prospector', pathId: 'alpha', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script }, model: MODEL }),
    /gated on "employment-agreement"/,
  );
  ledger.append({ kind: 'gate', gate: 'employment-agreement', cleared: true, evidence: 'read 2026-09-26' });
  const result = await runAgent({ role: 'prospector', pathId: 'alpha', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script }, model: MODEL, maxUsd: 1 });
  assert.equal(result.reason, 'done');
});

test('the path budget is a real cap: an exhausted path refuses a new run', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append({ kind: 'money.out', usd: 5, category: 'api', path: 'beta', evidence: 'earlier runs' });
  await assert.rejects(
    runAgent({ role: 'prospector', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script }, model: MODEL }),
    /budget/,
  );
});

test('an unpriced model is refused rather than recorded as $0', async () => {
  const { dir, ledger } = tmpLedger();
  await assert.rejects(
    runAgent({ role: 'prospector', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script }, model: 'mystery-model' }),
    /no price on file/,
  );
  const ok = await runAgent({ role: 'prospector', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script }, model: 'mystery-model', price: { in: 1, out: 2 }, maxUsd: 5 });
  assert.equal(ok.reason, 'done');
});

test('a killed path refuses runs; a drafts-only role cannot log outcomes', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append({ kind: 'path.status', path: 'beta', status: 'killed', reason: 'kill test failed' });
  await assert.rejects(runAgent({ role: 'outreach', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script: [] }, model: MODEL }), /killed/);
  assert.deepEqual(ROLES.outreach.logs, []);
  const { dir: d2, ledger: l2 } = tmpLedger();
  const r = await runAgent({ role: 'outreach', pathId: 'beta', ledger: l2, dataDir: d2, catalog: TEST_CATALOG, provider: { kind: 'replay', script: script.slice(0, 2) }, model: MODEL, maxUsd: 5 });
  assert.equal(r.reason, 'done');
  assert.equal(reduce(l2.readAll(), TEST_CATALOG).paths.beta.outcomes.prospect, 0);
});

test('a filename that escapes the outbox is refused', async () => {
  const { dir, ledger } = tmpLedger();
  const evil = [{ calls: [{ name: 'write_note', input: { filename: '../../escape.md', content: 'x' } }] }, { text: 'done' }];
  await runAgent({ role: 'outreach', pathId: 'beta', ledger, dataDir: dir, catalog: TEST_CATALOG, provider: { kind: 'replay', script: evil }, model: MODEL, maxUsd: 5 });
  assert.equal(fs.existsSync(path.join(dir, '..', 'escape.md')), false);
  assert.equal(fs.existsSync(path.join(dir, 'escape.md')), false);
});
