import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { harvest, buildQuery, matchNaics } from '../src/harvest.js';
import { addClient, dueClients, markPacked, updateClient, isDue } from '../src/clients.js';
import { listItems } from '../src/inbox.js';
import { runAgent, ROLES, idleReason } from '../src/agent.js';
import { reduce } from '../src/reduce.js';
import { createScheduler } from '../src/scheduler.js';
import { CATALOG } from '../src/paths.js';
import { LedgerError } from '../src/ledger.js';
import { tmpLedger } from './helpers.js';

const GBP = CATALOG.find((p) => p.id === 'gbp-management');
const CAT = [GBP];
const ROWS = [
  { taxpayer_number: '1', outlet_number: '1', outlet_name: 'THE SKIN EXPERIENCE BY KEARSTON, LLC', taxpayer_name: 'X', outlet_address: '6400 SUMMERHILL RD STE D', outlet_city: 'TEXARKANA', outlet_zip_code: '75503', outlet_county_code: '019', outlet_naics_code: '812199', outlet_permit_issue_date: '2026-09-12T00:00:00.000', outlet_first_sales_date: '2026-10-05T00:00:00.000' },
  { taxpayer_number: '2', outlet_number: '1', outlet_name: 'GARY JACKSON', taxpayer_name: 'GARY JACKSON', outlet_address: '5104 HIGH DR', outlet_city: 'TEXARKANA', outlet_county_code: '019', outlet_naics_code: '333111', outlet_permit_issue_date: '2026-09-17T00:00:00.000' },
  { taxpayer_number: '3', outlet_number: '2', outlet_name: "SHAMSIE'S CRAWFISH", taxpayer_name: 'S', outlet_address: '1304 E NEW BOSTON RD', outlet_city: 'NASH', outlet_county_code: '019', outlet_naics_code: '722513', outlet_permit_issue_date: '2026-09-15T00:00:00.000' },
];
const fakeFetch = (rows) => async (url) => { fakeFetch.lastUrl = url; return { ok: true, json: async () => rows }; };

test('GBP management replaced the salon bundle at rank 4, with the FTC and no-guarantee lines', () => {
  assert.ok(GBP);
  assert.equal(GBP.rank, 4);
  assert.equal(CATALOG.some((p) => p.id === 'local-growth-bundle'), false);
  assert.ok(GBP.constraints.some((c) => /review gating/.test(c)));
  assert.ok(GBP.constraints.some((c) => /Never promise rankings/.test(c)));
  assert.equal(ROLES.auditor.inbox, 'lead');
  assert.equal(ROLES.manager.clients, true);
});

test('the harvest query asks the Comptroller dataset for recent permits in the chosen counties', () => {
  const u = new URL(buildQuery({ counties: ['019', '034'], sinceDays: 30, now: new Date('2026-09-25T00:00:00Z') }));
  assert.equal(u.host, 'data.texas.gov');
  assert.match(u.searchParams.get('$where'), /outlet_county_code in\('019','034'\) AND outlet_permit_issue_date > '2026-08-26'/);
  assert.throws(() => buildQuery({ counties: ["019') OR 1=1 --"] }));
  assert.equal(matchNaics('812199').prefix, '8121');
  assert.equal(matchNaics('333111'), null);
});

test('harvest keeps local-service types, drops the rest, never adds the same outlet twice', async () => {
  const { dir } = tmpLedger();
  const r1 = await harvest({ dataDir: dir, fetchImpl: fakeFetch(ROWS) });
  assert.deepEqual([r1.fetched, r1.matched, r1.added], [3, 2, 2]);
  const leads = listItems(dir, 'gbp-management', { type: 'lead' });
  assert.equal(leads.length, 2);
  assert.match(leads.find((l) => /Skin/.test(l.title)).text, /Summerhill Rd Ste D, Texarkana, TX 75503/);
  assert.match(leads.find((l) => /Skin/.test(l.title)).title, /The Skin Experience By Kearston, LLC/);
  assert.match(leads[0].url, /^https:\/\/data\.texas\.gov\/resource\/jrea-zgmq\.json\?taxpayer_number=/);
  const r2 = await harvest({ dataDir: dir, fetchImpl: fakeFetch(ROWS) });
  assert.deepEqual([r2.added, r2.skippedSeen], [0, 2]);
  await assert.rejects(harvest({ dataDir: dir, fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
});

test('clients: due on creation, not due right after a pack, due again after the cadence', () => {
  const { dir } = tmpLedger();
  const c = addClient(dir, 'gbp-management', { name: 'Hair By Randi Marlene', city: 'Texarkana', category: 'hair salon', monthlyUsd: 200 });
  assert.equal(dueClients(dir, 'gbp-management').length, 1);
  markPacked(dir, 'gbp-management', c.id, 'Sept pack', new Date('2026-09-01T00:00:00Z'));
  const stored = dueClients(dir, 'gbp-management', new Date('2026-09-20T00:00:00Z'));
  assert.equal(stored.length, 0);
  assert.equal(dueClients(dir, 'gbp-management', new Date('2026-10-02T00:00:00Z')).length, 1);
  const upd = updateClient(dir, 'gbp-management', c.id, { notes: 'New review from Kim', active: false });
  assert.equal(isDue(upd, new Date('2026-12-01T00:00:00Z')), false);
  assert.throws(() => addClient(dir, 'gbp-management', { name: 'X', city: '' }), LedgerError);
  assert.throws(() => markPacked(dir, 'gbp-management', '../../etc', 's'), LedgerError);
});

test('an auditor run turns a harvested lead into an audit draft and a prospect on the ledger', async () => {
  const { dir, ledger } = tmpLedger();
  await harvest({ dataDir: dir, fetchImpl: fakeFetch(ROWS.slice(0, 1)) });
  const lead = listItems(dir, 'gbp-management', { type: 'lead' })[0];
  const script = [
    { calls: [{ name: 'read_inbox', input: {} }] },
    { calls: [
      { name: 'write_note', input: { filename: 'audit-skin-experience.md', content: 'Audit' } },
      { name: 'log_outcome', input: { stage: 'prospect', ref: 'The Skin Experience By Kearston (Texarkana)', evidence: lead.url } },
      { name: 'mark_done', input: { id: lead.id, verdict: '9/10: no Google profile found' } },
    ] },
    { text: 'Audited 1.' },
  ];
  const r = await runAgent({ role: 'auditor', pathId: 'gbp-management', ledger, dataDir: dir, catalog: CAT, provider: { kind: 'replay', script }, maxUsd: 5 });
  assert.equal(r.reason, 'done');
  assert.equal(reduce(ledger.readAll(), CAT).paths['gbp-management'].outcomes.prospect, 1);
  assert.ok(fs.existsSync(path.join(dir, 'outbox', 'gbp-management', 'audit-skin-experience.md')));
  assert.equal(listItems(dir, 'gbp-management', { type: 'lead' }).length, 0);
});

test('a manager run writes packs for due clients and marks them; with nobody due it skips at $0', async () => {
  const { dir, ledger } = tmpLedger();
  assert.equal(idleReason(ROLES.manager, dir, 'gbp-management'), 'no client packs are due');
  const skip = await runAgent({ role: 'manager', pathId: 'gbp-management', ledger, dataDir: dir, catalog: CAT, provider: { kind: 'replay', script: [{ text: 'x' }] } });
  assert.equal(skip.skipped, true);
  assert.equal(ledger.readAll().length, 0);
  const c = addClient(dir, 'gbp-management', { name: 'Demo Salon', city: 'Texarkana' });
  const script = [
    { calls: [{ name: 'read_clients', input: {} }] },
    { calls: [{ name: 'write_note', input: { filename: 'pack-demo-salon-2026-10.md', content: 'Pack' } }, { name: 'mark_packed', input: { id: c.id, summary: 'Oct pack' } }] },
    { text: 'done' },
  ];
  const r = await runAgent({ role: 'manager', pathId: 'gbp-management', ledger, dataDir: dir, catalog: CAT, provider: { kind: 'replay', script }, maxUsd: 5 });
  assert.equal(r.reason, 'done');
  assert.equal(dueClients(dir, 'gbp-management').length, 0);
});

test('the scheduler passes over a manager with no due clients', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append({ kind: 'job', jobId: 'mgr', role: 'manager', path: 'gbp-management', everyHours: 1, maxUsd: 1, enabled: true, ts: '2026-01-01T00:00:00Z' });
  ledger.append({ kind: 'job', jobId: 'cr', role: 'creator', path: 'gbp-management', everyHours: 1, maxUsd: 1, enabled: true, ts: '2026-01-01T00:00:01Z' });
  const seen = [];
  const sch = createScheduler({ ledger, runAgent: async (o) => { seen.push(o.jobId); return { reason: 'done' }; }, makeProvider: async () => ({}), dataDir: dir, catalog: CAT });
  await (await sch.tick()).running;
  assert.deepEqual(seen, ['cr']);
});
