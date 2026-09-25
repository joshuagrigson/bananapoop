import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, listItems, markDone } from '../src/inbox.js';
import { runAgent, ROLES } from '../src/agent.js';
import { reduce } from '../src/reduce.js';
import { validate, LedgerError } from '../src/ledger.js';
import { createScheduler } from '../src/scheduler.js';
import { CATALOG } from '../src/paths.js';
import { tmpLedger, TEST_CATALOG } from './helpers.js';

const DESK = CATALOG.find((p) => p.id === 'freelance-desk');
const CAT = [...TEST_CATALOG, DESK];
const POST = 'Need 40 roofing contractors in Dallas with emails. Budget $80. Payment verified.';

test('the freelance desk is in the catalog with a gig menu and a no-auto-bidding constraint', () => {
  assert.ok(DESK);
  assert.ok(DESK.gigMenu.length >= 5);
  assert.ok(DESK.constraints.some((c) => /never submit proposals/i.test(c)));
  assert.equal(ROLES.scout.inbox, 'post');
  assert.equal(ROLES.fulfiller.inbox, 'job');
  assert.ok(ROLES.lister);
});

test('inbox: add, list by type, mark done moves it; bad input rejected', () => {
  const { dir } = tmpLedger();
  const a = addItem(dir, 'freelance-desk', { type: 'post', text: POST, url: 'https://www.upwork.com/jobs/~01' });
  addItem(dir, 'freelance-desk', { type: 'job', text: 'Won: build 40-lead list of Dallas roofers, due Friday.' });
  assert.equal(listItems(dir, 'freelance-desk', { type: 'post' }).length, 1);
  markDone(dir, 'freelance-desk', a.id, '8/10');
  assert.equal(listItems(dir, 'freelance-desk', { type: 'post' }).length, 0);
  assert.equal(listItems(dir, 'freelance-desk', { status: 'done' })[0].verdict, '8/10');
  assert.throws(() => addItem(dir, 'freelance-desk', { type: 'spam', text: POST }), LedgerError);
  assert.throws(() => addItem(dir, 'freelance-desk', { type: 'post', text: 'short' }), LedgerError);
  assert.throws(() => addItem(dir, '../etc', { type: 'post', text: POST }), LedgerError);
  assert.throws(() => markDone(dir, 'freelance-desk', '../../x', 'v'), LedgerError);
});

test('a scout run reads the inbox, drafts a proposal, logs the post as a prospect, and marks it done', async () => {
  const { dir, ledger } = tmpLedger();
  const item = addItem(dir, 'freelance-desk', { type: 'post', text: POST, url: 'https://www.upwork.com/jobs/~01' });
  const script = [
    { calls: [{ name: 'read_inbox', input: {} }] },
    { calls: [
      { name: 'write_note', input: { filename: 'proposal-dallas-roofers.md', content: 'Proposal' } },
      { name: 'log_outcome', input: { stage: 'prospect', ref: 'Dallas roofing list', evidence: 'https://www.upwork.com/jobs/~01' } },
      { name: 'mark_done', input: { id: item.id, verdict: '8/10 fits lead research' } },
    ] },
    { text: 'Scored 1 post, drafted 1 proposal.' },
  ];
  const r = await runAgent({ role: 'scout', pathId: 'freelance-desk', ledger, dataDir: dir, catalog: CAT, provider: { kind: 'replay', script }, maxUsd: 5 });
  assert.equal(r.reason, 'done');
  const st = reduce(ledger.readAll(), CAT);
  assert.equal(st.paths['freelance-desk'].outcomes.prospect, 1);
  assert.equal(listItems(dir, 'freelance-desk', { type: 'post' }).length, 0);
  assert.equal(listItems(dir, 'freelance-desk', { status: 'done' })[0].verdict, '8/10 fits lead research');
});

test('an inbox role with nothing to do skips before spending: no ledger lines, no cost', async () => {
  const { dir, ledger } = tmpLedger();
  const r = await runAgent({ role: 'fulfiller', pathId: 'freelance-desk', ledger, dataDir: dir, catalog: CAT, provider: { kind: 'replay', script: [{ text: 'x' }] } });
  assert.equal(r.skipped, true);
  assert.equal(r.usd, 0);
  assert.equal(ledger.readAll().length, 0);
});

test('the scheduler passes over an empty-inbox scout so it cannot starve other jobs', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append({ kind: 'job', jobId: 'scout', role: 'scout', path: 'freelance-desk', everyHours: 1, maxUsd: 1, enabled: true, ts: '2026-01-01T00:00:00Z' });
  ledger.append({ kind: 'job', jobId: 'creator', role: 'creator', path: 'beta', everyHours: 1, maxUsd: 1, enabled: true, ts: '2026-01-01T00:00:01Z' });
  const seen = [];
  const sch = createScheduler({ ledger, runAgent: async (o) => { seen.push(o.jobId); return { reason: 'done' }; }, makeProvider: async () => ({}), dataDir: dir, catalog: CAT });
  const r = await sch.tick();
  await r.running;
  assert.deepEqual(seen, ['creator']);
});

test('revenue by gig type rolls up jobs, earnings, hours and per-hour rate', () => {
  const ev = (o) => validate(o);
  const st = reduce([
    ev({ kind: 'money.in', usd: 120, path: 'freelance-desk', source: 'A', evidence: 'up 1', tag: 'Lead research', hours: 1.5 }),
    ev({ kind: 'money.in', usd: 80, path: 'freelance-desk', source: 'B', evidence: 'up 2', tag: 'lead research', hours: 0.5 }),
    ev({ kind: 'money.in', usd: 60, path: 'freelance-desk', source: 'C', evidence: 'fv 3', tag: 'gbp posts' }),
  ], CAT);
  assert.deepEqual(st.byTag['lead research'], { path: 'freelance-desk', jobs: 2, earnedUsd: 200, hours: 2, timedUsd: 200 });
  assert.equal(st.byTag['gbp posts'].hours, 0);
  assert.throws(() => validate({ kind: 'money.in', usd: 5, path: 'x', source: 'y', evidence: 'inv', hours: -1 }), LedgerError);
});
