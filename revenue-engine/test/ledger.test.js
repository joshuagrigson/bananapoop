import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate, LedgerError } from '../src/ledger.js';
import { tmpLedger } from './helpers.js';

test('money.in without evidence is rejected', () => {
  assert.throws(() => validate({ kind: 'money.in', usd: 500, path: 'alpha', source: 'Acme' }), LedgerError);
  assert.throws(() => validate({ kind: 'money.in', usd: 500, path: 'alpha', source: 'Acme', evidence: 'x' }), LedgerError);
});

test('money.in must be positive and carry a source', () => {
  assert.throws(() => validate({ kind: 'money.in', usd: 0, path: 'alpha', source: 'Acme', evidence: 'inv-1' }), LedgerError);
  assert.throws(() => validate({ kind: 'money.in', usd: -5, path: 'alpha', source: 'Acme', evidence: 'inv-1' }), LedgerError);
  assert.throws(() => validate({ kind: 'money.in', usd: 5, path: 'alpha', evidence: 'inv-1' }), LedgerError);
});

test('a valid event gets an id and a timestamp', () => {
  const ev = validate({ kind: 'money.in', usd: 500, path: 'alpha', source: 'Acme', evidence: 'invoice 1001' });
  assert.equal(typeof ev.id, 'string');
  assert.ok(!Number.isNaN(Date.parse(ev.ts)));
});

test('outcome validation: stage, ref, evidence, by', () => {
  assert.throws(() => validate({ kind: 'outcome', path: 'alpha', stage: 'won', ref: 'X', evidence: 'https://x', by: 'user' }), /stage/);
  assert.throws(() => validate({ kind: 'outcome', path: 'alpha', stage: 'prospect', ref: 'X', evidence: 'https://x', by: 'robot' }), /by/);
  assert.throws(() => validate({ kind: 'outcome', path: 'alpha', stage: 'prospect', ref: 'X', by: 'user' }), /evidence/);
});

test('money.out needs evidence or a runId and a known category', () => {
  assert.throws(() => validate({ kind: 'money.out', usd: 1, category: 'api' }), /evidence/);
  assert.throws(() => validate({ kind: 'money.out', usd: 1, category: 'fun', evidence: 'x' }), /category/);
  const ev = validate({ kind: 'money.out', usd: 1, category: 'api', runId: 'r1' });
  assert.equal(ev.path, 'general');
});

test('unknown kind is rejected', () => {
  assert.throws(() => validate({ kind: 'revenue.simulated', usd: 1e6 }), /unknown kind/);
});

test('append then readAll round-trips and skips a torn last line', () => {
  const { ledger } = tmpLedger();
  const a = ledger.append({ kind: 'note', text: 'one' });
  const b = ledger.append({ kind: 'note', text: 'two' });
  fs.appendFileSync(ledger.file, '{"kind":"note","text":"torn');
  const all = ledger.readAll();
  assert.deepEqual(all.map((e) => e.id), [a.id, b.id]);
});
