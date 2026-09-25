import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpLedger, TEST_CATALOG } from './helpers.js';
import { reduce } from '../src/reduce.js';
import { createServer } from '../src/server.js';
import {
  CONNECTORS, parseCsv, detectMapping, parseAmount, parseDate, csvRecords, importRecords, knownExt, classify,
  upsertConnection, listConnections, loadConnections, syncConnection, removeConnection,
} from '../src/sync.js';

// A fake fetch that answers by URL prefix and records what was asked.
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    for (const [prefix, handler] of routes) {
      if (String(url).startsWith(prefix)) {
        const out = typeof handler === 'function' ? handler(String(url), opts, calls) : handler;
        const status = out.status || 200;
        return { ok: status < 400, status, json: async () => out.body };
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: { message: 'no route' } }) };
  };
  fn.calls = calls;
  return fn;
}

test('CSV parsing: quotes, commas in fields, BOM, CRLF, semicolons, and a title block above the header', () => {
  const t = '﻿Activity export\r\n\r\n"Date","Name","Gross","Fee","Net","Transaction ID"\r\n"09/02/2026","Acme, Inc.","100.00","-3.20","96.80","8AB"\r\n';
  const p = parseCsv(t);
  assert.deepEqual(p.headers, ['Date', 'Name', 'Gross', 'Fee', 'Net', 'Transaction ID']);
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0][1], 'Acme, Inc.');
  const semi = parseCsv('Datum;Betrag;Beschreibung\n01.09.2026;1.234,56;Kunde\n');
  assert.deepEqual(semi.headers, ['Datum', 'Betrag', 'Beschreibung']);
  const two = parseCsv('Date,Amount\n2026-09-01,50\n2026-09-02,60\n');
  assert.deepEqual(two.headers, ['Date', 'Amount']);
  assert.equal(two.rows.length, 2);
  assert.equal(parseCsv('a,"he said ""hi""",c\n1,2,3').headers[1], 'he said "hi"');
});

test('amounts and dates in the shapes real exports use', () => {
  assert.equal(parseAmount('$1,234.56'), 1234.56);
  assert.equal(parseAmount('(45.00)'), -45);
  assert.equal(parseAmount('- $12.00'), -12);
  assert.equal(parseAmount('+ $50.00'), 50);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('12,50'), 12.5);
  assert.ok(Number.isNaN(parseAmount('')));
  assert.equal(parseDate('09/25/2026').slice(0, 10), '2026-09-25');
  assert.equal(parseDate('25/09/2026').slice(0, 10), '2026-09-25');
  assert.equal(parseDate('2026-09-25').slice(0, 10), '2026-09-25');
  assert.equal(parseDate('Sep 25, 2026') !== null, true);
  assert.equal(parseDate('nonsense'), null);
});

test('column detection picks net over gross and skips fees, balances and local-currency columns', () => {
  const paypal = detectMapping(['Date', 'Time', 'TimeZone', 'Name', 'Type', 'Status', 'Currency', 'Gross', 'Fee', 'Net', 'From Email Address', 'Transaction ID', 'Balance']);
  assert.equal(paypal.amount, 9);
  assert.equal(paypal.id, 11);
  assert.equal(paypal.who, 3);
  assert.equal(paypal.type, 4);
  assert.equal(paypal.status, 5);
  const upwork = detectMapping(['Date', 'Ref ID', 'Type', 'Description', 'Agency', 'Freelancer', 'Team', 'Account Name', 'PO', 'Amount', 'Amount in local currency', 'Currency', 'Balance']);
  assert.equal(upwork.amount, 9);
  assert.equal(upwork.id, 1);
  assert.equal(upwork.what, 3);
  const bank = detectMapping(['Posting Date', 'Description', 'Debit', 'Credit']);
  assert.equal(bank.amount, 3);
});

test('statement import: only real income counts, same file twice adds nothing, equal payments on one day both count', () => {
  const { ledger } = tmpLedger();
  const csv = [
    'Date,Name,Type,Status,Currency,Gross,Fee,Net,Transaction ID',
    '09/01/2026,Client A,General Payment,Completed,USD,100.00,-3.20,96.80,T1',
    '09/02/2026,,General Withdrawal,Completed,USD,-500.00,0.00,-500.00,T2',
    '09/03/2026,Client B,General Payment,Pending,USD,40.00,-1.00,39.00,T3',
    '09/04/2026,Client C,General Payment,Completed,EUR,70.00,-2.00,68.00,T4',
    '09/05/2026,,Bank Deposit to PP Account,Completed,USD,300.00,0.00,300.00,T5',
    '09/06/2026,Client D,Express Checkout Payment,Completed,USD,25.00,-1.03,23.97,T6',
  ].join('\n');
  const first = csvRecords(csv, { source: 'paypal' });
  const r = importRecords(ledger, first.records, { path: 'beta', via: 'csv:paypal', sourceTitle: 'PayPal', verb: 'imported' });
  assert.equal(r.added.length, 2);
  assert.equal(r.usd, 120.77);
  const reasons = Object.fromEntries(r.rows.map((x) => [x.ext, x.reason]));
  assert.match(reasons['paypal:T2'], /money out|withdraw/i);
  assert.match(reasons['paypal:T3'], /Pending/);
  assert.match(reasons['paypal:T4'], /EUR/);
  assert.match(reasons['paypal:T5'], /Bank Deposit/);
  const again = importRecords(ledger, csvRecords(csv, { source: 'paypal' }).records, { path: 'beta', via: 'csv:paypal', sourceTitle: 'PayPal' });
  assert.equal(again.added.length, 0);
  assert.equal(again.rows.filter((x) => x.status === 'duplicate').length, 2);
  const st = reduce(ledger.readAll(), TEST_CATALOG);
  assert.equal(st.earnedUsd, 120.77);
  assert.equal(st.moneyIn[0].via, 'csv:paypal');
  assert.match(st.moneyIn[0].evidence, /PayPal T1 \(imported\)/);

  // a bank file with no id column: two identical deposits on one day are two payments, and re-import matches both
  const bank = 'Date,Description,Amount\n2026-09-10,ZELLE FROM JANE,50.00\n2026-09-10,ZELLE FROM JANE,50.00\n2026-09-11,CARD PURCHASE,-12.00\n';
  const b1 = importRecords(ledger, csvRecords(bank, { source: 'bank' }).records, { path: 'beta', via: 'csv:bank', sourceTitle: 'Bank' });
  assert.equal(b1.added.length, 2);
  const b2 = importRecords(ledger, csvRecords(bank, { source: 'bank' }).records, { path: 'beta', via: 'csv:bank', sourceTitle: 'Bank' });
  assert.equal(b2.added.length, 0);
});

test('Stripe: net of fees, pages with starting_after, only charges and payments, created[gte] from the cursor', async () => {
  const f = fakeFetch([['https://api.stripe.com/v1/balance_transactions', (url) => {
    const u = new URL(url);
    if (!u.searchParams.get('starting_after')) {
      return { body: { has_more: true, data: [
        { id: 'txn_1', type: 'charge', amount: 20000, fee: 610, net: 19390, currency: 'usd', created: 1788000000, description: 'Salon setup' },
        { id: 'txn_2', type: 'payout', amount: -19390, fee: 0, net: -19390, currency: 'usd', created: 1788000100 },
      ] } };
    }
    return { body: { has_more: false, data: [{ id: 'txn_3', type: 'payment', amount: 5000, fee: 175, net: 4825, currency: 'usd', created: 1788000200, description: null }] } };
  }]]);
  const out = await CONNECTORS.stripe.pull({ secret: { apiKey: 'rk_live_abcdefghijkl' }, since: '2026-09-01T00:00:00Z', fetchImpl: f });
  assert.deepEqual(out.map((r) => [r.ext, r.usd]), [['stripe:txn_1', 193.9], ['stripe:txn_3', 48.25]]);
  assert.equal(f.calls.length, 2);
  assert.equal(new URL(f.calls[1].url).searchParams.get('starting_after'), 'txn_2');
  assert.equal(new URL(f.calls[0].url).searchParams.get('created[gte]'), String(Date.parse('2026-09-01T00:00:00Z') / 1000));
  assert.equal(f.calls[0].opts.headers.authorization, 'Bearer rk_live_abcdefghijkl');
});

test('Square, PayPal and Gumroad normalize to net USD and skip what is not money in', async () => {
  const sq = fakeFetch([['https://connect.squareup.com/v2/payments', { body: { payments: [
    { id: 'p1', status: 'COMPLETED', created_at: '2026-09-02T15:00:00Z', amount_money: { amount: 25000, currency: 'USD' }, processing_fee: [{ amount_money: { amount: 760, currency: 'USD' } }], buyer_email_address: 'owner@example.com' },
    { id: 'p2', status: 'FAILED', created_at: '2026-09-02T16:00:00Z', amount_money: { amount: 9000, currency: 'USD' } },
    { id: 'p3', status: 'COMPLETED', created_at: '2026-09-03T16:00:00Z', amount_money: { amount: 10000, currency: 'USD' }, refunded_money: { amount: 10000, currency: 'USD' } },
  ] } }]]);
  const s = await CONNECTORS.square.pull({ secret: { token: 'EAAAxxxxxxxxxxxxxxxxxxxxxxx' }, since: '2026-09-01T00:00:00Z', fetchImpl: sq });
  assert.deepEqual(s.map((r) => [r.ext, r.usd, r.who]), [['square:p1', 242.4, 'owner@example.com'], ['square:p3', 0, 'Square customer']]);

  const pp = fakeFetch([
    ['https://api-m.paypal.com/v1/oauth2/token', (url, opts) => { assert.match(opts.headers.authorization, /^Basic /); return { body: { access_token: 'tok' } }; }],
    ['https://api-m.paypal.com/v1/reporting/transactions', { body: { total_pages: 1, transaction_details: [
      { transaction_info: { transaction_id: 'A1', transaction_event_code: 'T0006', transaction_status: 'S', transaction_initiation_date: '2026-09-04T10:00:00+0000', transaction_amount: { currency_code: 'USD', value: '120.00' }, fee_amount: { currency_code: 'USD', value: '-4.49' } }, payer_info: { payer_name: { alternate_full_name: 'Jane Client' } } },
      { transaction_info: { transaction_id: 'A2', transaction_event_code: 'T0400', transaction_status: 'S', transaction_initiation_date: '2026-09-05T10:00:00+0000', transaction_amount: { currency_code: 'USD', value: '-100.00' } } },
      { transaction_info: { transaction_id: 'A3', transaction_event_code: 'T0006', transaction_status: 'P', transaction_initiation_date: '2026-09-05T10:00:00+0000', transaction_amount: { currency_code: 'USD', value: '50.00' } } },
    ] } }],
  ]);
  const now = Date.parse('2026-09-20T00:00:00Z');
  const p = await CONNECTORS.paypal.pull({ secret: { clientId: 'x'.repeat(24), secret: 'y'.repeat(24) }, since: '2026-09-01T00:00:00Z', fetchImpl: pp, now });
  assert.deepEqual(p.map((r) => [r.ext, r.usd, r.who]), [['paypal:A1', 115.51, 'Jane Client']]);
  const q = new URL(pp.calls[1].url).searchParams;
  assert.match(q.get('start_date'), /^2026-09-01T00:00:00-0000$/);

  const gr = fakeFetch([['https://api.gumroad.com/v2/sales', { body: { success: true, sales: [
    { id: 's1', created_at: '2026-09-06T00:00:00Z', price: 4900, gumroad_fee: 539, product_name: 'Operator course', email: 'b@example.com' },
    { id: 's2', created_at: '2026-09-07T00:00:00Z', price: 4900, refunded: true, product_name: 'Operator course' },
  ] } }]]);
  const g = await CONNECTORS.gumroad.pull({ secret: { token: 'z'.repeat(30) }, since: '2026-09-01T00:00:00Z', fetchImpl: gr });
  assert.deepEqual(g.map((r) => [r.ext, r.usd]), [['gumroad:s1', 43.61]]);
});

test('a linked account syncs once, never double counts, records failures, and keys stay out of the ledger and the API', async () => {
  const { dir, ledger } = tmpLedger();
  const KEY = 'rk_live_SECRETSECRET1234';
  let data = [{ id: 'txn_a', type: 'charge', amount: 10000, fee: 320, net: 9680, currency: 'usd', created: 1788000000, description: 'Client A' }];
  let fail = false;
  const f = fakeFetch([['https://api.stripe.com', () => (fail ? { status: 401, body: { error: { message: 'Invalid API Key provided' } } } : { body: { has_more: false, data } })]]);
  const c = upsertConnection(dir, { kind: 'stripe', path: 'beta', secret: { apiKey: KEY }, since: '2026-08-01' }, TEST_CATALOG);
  const r1 = await syncConnection({ ledger, dataDir: dir, id: c.id, fetchImpl: f });
  assert.equal(r1.ok, true); assert.equal(r1.imported, 1); assert.equal(r1.usd, 96.8);
  data = [...data, { id: 'txn_b', type: 'charge', amount: 5000, fee: 175, net: 4825, currency: 'usd', created: 1788100000, description: 'Client B' }];
  const r2 = await syncConnection({ ledger, dataDir: dir, id: c.id, fetchImpl: f });
  assert.equal(r2.imported, 1);
  const st = reduce(ledger.readAll(), TEST_CATALOG);
  assert.equal(st.earnedUsd, 145.05);
  assert.equal(st.paths.beta.moneyIn.length, 2);
  assert.ok(knownExt(ledger).has('stripe:txn_b'));
  fail = true;
  const r3 = await syncConnection({ ledger, dataDir: dir, id: c.id, fetchImpl: f });
  assert.equal(r3.ok, false);
  assert.match(r3.error, /401.*Invalid API Key.*refused/);
  assert.equal(loadConnections(dir)[0].lastSync.ok, false);
  const ledgerText = fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8');
  assert.ok(!ledgerText.includes(KEY));
  const pub = listConnections(dir)[0];
  assert.equal(pub.secret.apiKey, '••••1234');
  assert.ok(!JSON.stringify(pub).includes('SECRETSECRET'));
  // editing with the masked value keeps the stored key
  upsertConnection(dir, { id: c.id, path: 'alpha', secret: { apiKey: '••••1234' } }, TEST_CATALOG);
  assert.equal(loadConnections(dir)[0].secret.apiKey, KEY);
  assert.equal(loadConnections(dir)[0].path, 'alpha');
  assert.throws(() => upsertConnection(dir, { kind: 'stripe', path: 'beta', secret: { apiKey: 'pk_live_nope' } }, TEST_CATALOG), /Stripe key/);
  assert.throws(() => upsertConnection(dir, { kind: 'venmo', path: 'beta', secret: {} }, TEST_CATALOG), /unknown connector/);
  removeConnection(dir, c.id);
  assert.equal(listConnections(dir).length, 0);
  assert.equal(classify([{ ext: 'x:1', at: '2026-09-01T00:00:00Z', usd: 5, currency: 'usd' }], new Set())[0].status, 'new');
});

test('HTTP: link, sync, CSV dry run and import; other websites and foreign hosts are refused', async () => {
  const { dir, ledger } = tmpLedger();
  const f = fakeFetch([['https://api.stripe.com', { body: { has_more: false, data: [{ id: 'txn_h', type: 'charge', amount: 30000, fee: 900, net: 29100, currency: 'usd', created: 1788000000, description: 'Big client' }] } }]]);
  const server = createServer({ ledger, catalog: TEST_CATALOG, dataDir: dir, fetchImpl: f });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const bad = await post('/api/connections', { kind: 'stripe', path: 'beta', secret: { apiKey: 'nope' } });
    assert.equal(bad.status, 400);
    const linked = await post('/api/connections', { kind: 'stripe', path: 'beta', label: 'main', secret: { apiKey: 'rk_live_abcdefghijklmnop' } });
    assert.equal(linked.status, 201);
    const lj = await linked.json();
    assert.equal(lj.sync.imported, 1);
    assert.equal(lj.connection.secret.apiKey, '••••mnop');
    const list = await (await fetch(base + '/api/connections')).json();
    assert.equal(list.connections.length, 1);
    assert.ok(list.connectors.stripe.steps.length > 2);
    assert.ok(!JSON.stringify(list).includes('abcdefghijkl'));
    const state = await (await fetch(base + '/api/state')).json();
    assert.equal(state.sync.connections[0].lastSync.imported, 1);
    assert.equal(state.sync.connections[0].secret, undefined);
    assert.equal(state.state.earnedUsd, 291);
    const again = await (await post('/api/sync', {})).json();
    assert.equal(again.results[0].imported, 0);

    const csv = 'Date,Description,Amount,Order ID\n2026-09-01,Fiverr order,80.00,FO1\n2026-09-02,Withdrawal,-80.00,W1\n';
    const dry = await (await post('/api/import/csv', { text: csv, path: 'beta', source: 'fiverr', dryRun: true })).json();
    assert.equal(dry.newCount, 1); assert.equal(dry.newUsd, 80); assert.equal(dry.skipped, 1);
    assert.equal(dry.mapping.id, 3);
    const imp = await (await post('/api/import/csv', { text: csv, path: 'beta', source: 'fiverr' })).json();
    assert.equal(imp.imported, 1);
    const imp2 = await (await post('/api/import/csv', { text: csv, path: 'beta', source: 'fiverr' })).json();
    assert.equal(imp2.imported, 0); assert.equal(imp2.duplicates, 1);
    const noPath = await post('/api/import/csv', { text: csv, path: 'nowhere', source: 'fiverr' });
    assert.equal(noPath.status, 400);

    // a page on another website tries to log fake revenue through the browser
    const csrf = await post('/api/events', { kind: 'money.in', usd: 999, path: 'beta', source: 'x', evidence: 'fake' }, { origin: 'https://evil.example' });
    assert.equal(csrf.status, 403);
    const same = await post('/api/events', { kind: 'note', text: 'hi' }, { origin: base });
    assert.equal(same.status, 201);
    // DNS rebinding: a request that reached us under a foreign host name
    const rebound = await new Promise((resolve) => {
      import('node:http').then(({ default: http }) => {
        const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/api/state', headers: { host: 'evil.example:80' } }, (res) => { res.resume(); resolve(res.statusCode); });
        req.end();
      });
    });
    assert.equal(rebound, 403);
  } finally {
    server.close();
  }
});
