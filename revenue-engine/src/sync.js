// Income sync: pull payments from the places you actually get paid and append them to the ledger as evidenced money.in.
// Two ways in:
//   1. API links (Stripe, Square, PayPal, Gumroad): a key the station only ever reads with, polled every few minutes.
//   2. Statement import (Upwork, Fiverr, Etsy, Amazon Associates, PayPal, Venmo, any bank): the platform's own CSV export.
// Every imported line carries the platform's transaction id in `ext`, so syncing or importing twice never counts a
// dollar twice. Keys live only in <data>/connections.json on this computer, are never written to the ledger, and are
// never sent back to the browser (it only ever sees the last 4 characters).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerError } from './ledger.js';

const DAY = 86400e3;
const round2 = (n) => Math.round(n * 100) / 100;

class SyncError extends Error {}

async function readJsonResponse(r, platform) {
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  if (!r.ok) {
    const detail = body && (
      (body.error && (body.error.message || body.error_description || (typeof body.error === 'string' ? body.error : ''))) ||
      (Array.isArray(body.errors) && body.errors[0] && (body.errors[0].detail || body.errors[0].code)) ||
      body.message || body.error_description
    );
    const hint = r.status === 401 || r.status === 403 ? ' (the key was refused: check it is a live key with read access)' : '';
    throw new SyncError(`${platform} said ${r.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}${hint}`);
  }
  if (body === null) throw new SyncError(`${platform} answered with something that is not JSON`);
  return body;
}

// ---------------------------------------------------------------------------------------------- API connectors
// pull({ secret, since, fetchImpl, maxPages }) -> [{ ext, at, usd, currency, who, what }]
// usd is what actually reached you: net of the platform's processing fee where the platform reports it.
export const CONNECTORS = {
  stripe: {
    title: 'Stripe',
    blurb: 'Card payments, invoices and payment links. Net of Stripe fees.',
    fields: [{ key: 'apiKey', label: 'Restricted key (read only)', placeholder: 'rk_live_…', secret: true }],
    steps: [
      'Open Stripe → Developers → API keys.',
      'Create restricted key. Name it "Proxyfolk".',
      'Set "Balance transactions" to Read. Leave everything else at None.',
      'Create, then copy the rk_live_ key and paste it here.',
    ],
    link: 'https://dashboard.stripe.com/apikeys',
    check: (s) => (/^(rk|sk)_(live|test)_\w{10,}$/.test(String(s.apiKey || '').trim()) ? null : 'That does not look like a Stripe key (rk_live_… or sk_live_…).'),
    async pull({ secret, since, fetchImpl, maxPages = 20 }) {
      const out = [];
      let after = null;
      for (let page = 0; page < maxPages; page++) {
        const q = new URLSearchParams({ limit: '100' });
        if (since) q.set('created[gte]', String(Math.floor(Date.parse(since) / 1000)));
        if (after) q.set('starting_after', after);
        const r = await fetchImpl('https://api.stripe.com/v1/balance_transactions?' + q, { headers: { authorization: 'Bearer ' + String(secret.apiKey).trim() } });
        const j = await readJsonResponse(r, 'Stripe');
        const data = Array.isArray(j.data) ? j.data : [];
        for (const t of data) {
          if (t.type !== 'charge' && t.type !== 'payment') continue;
          out.push({
            ext: 'stripe:' + t.id, at: new Date(t.created * 1000).toISOString(), usd: t.net / 100, currency: String(t.currency || '').toUpperCase(),
            who: t.description || 'Stripe customer', what: t.description || 'Stripe payment', ref: t.id,
          });
        }
        if (!j.has_more || !data.length) break;
        after = data[data.length - 1].id;
      }
      return out;
    },
  },
  square: {
    title: 'Square',
    blurb: 'Services, products, invoices and tips taken with Square, split by what was sold. Net of fees and refunds.',
    fields: [{ key: 'token', label: 'Production access token', placeholder: 'EAAA…', secret: true }],
    steps: [
      'Open the Square Developer Console and sign in with your Square account.',
      'Create an application (any name), then open it.',
      'Switch the toggle at the top to Production and copy the Production access token.',
      'Paste it here. The station only reads payments and the items on each ticket, but this token can do more than read, so treat it like a password: it stays on this computer only.',
    ],
    link: 'https://developer.squareup.com/apps',
    check: (s) => (String(s.token || '').trim().length >= 20 ? null : 'That token looks too short. Copy the Production access token.'),
    // Each completed payment becomes one line per service or product on its ticket (from the Orders API), so a cut
    // plus a beard trim lands in two rooms. Tips, fees and refunds are shared across the lines by their price.
    async pull({ secret, since, fetchImpl, maxPages = 20 }) {
      const auth = { authorization: 'Bearer ' + String(secret.token).trim(), accept: 'application/json' };
      const payments = [];
      let cursor = null;
      for (let page = 0; page < maxPages; page++) {
        const q = new URLSearchParams({ limit: '100', sort_order: 'ASC' });
        if (since) q.set('begin_time', new Date(since).toISOString());
        if (cursor) q.set('cursor', cursor);
        const r = await fetchImpl('https://connect.squareup.com/v2/payments?' + q, { headers: auth });
        const j = await readJsonResponse(r, 'Square');
        for (const p of j.payments || []) if (p.status === 'COMPLETED' && (p.total_money || p.amount_money)) payments.push(p);
        cursor = j.cursor;
        if (!cursor) break;
      }
      const orders = new Map();
      const ids = [...new Set(payments.map((p) => p.order_id).filter(Boolean))];
      for (let i = 0; i < ids.length; i += 100) {
        const r = await fetchImpl('https://connect.squareup.com/v2/orders/batch-retrieve', {
          method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ order_ids: ids.slice(i, i + 100) }),
        });
        const j = await readJsonResponse(r, 'Square (orders)');
        for (const o of j.orders || []) orders.set(o.id, o);
      }
      const amt = (m) => (m && Number.isFinite(m.amount) ? m.amount : 0);
      const out = [];
      for (const p of payments) {
        const total = p.total_money ? amt(p.total_money) : amt(p.amount_money) + amt(p.tip_money);
        const fees = (p.processing_fee || []).reduce((s, f) => s + amt(f.amount_money), 0);
        const net = total - fees - amt(p.refunded_money);
        const tip = Math.min(amt(p.tip_money), Math.max(0, net));
        const currency = (p.total_money || p.amount_money).currency;
        const who = p.buyer_email_address || 'Square customer';
        const base = { at: p.created_at, currency, who, ref: p.receipt_number || p.id };
        const order = orders.get(p.order_id);
        const lines = ((order && order.line_items) || []).filter((li) => amt(li.total_money) > 0);
        if (!lines.length) {
          out.push({ ...base, ext: 'square:' + p.id, usd: net / 100, tip: tip / 100, item: p.note ? String(p.note).slice(0, 120) : undefined, what: p.note || 'Square payment' });
          continue;
        }
        const sum = lines.reduce((s, li) => s + amt(li.total_money), 0);
        let givenNet = 0, givenTip = 0;
        lines.forEach((li, k) => {
          const last = k === lines.length - 1, share = amt(li.total_money) / sum;
          const n = last ? net - givenNet : Math.round(net * share), t = last ? tip - givenTip : Math.round(tip * share);
          givenNet += n; givenTip += t;
          const variation = li.variation_name && !/^regular$/i.test(li.variation_name) ? li.variation_name : '';
          const item = `${li.name || 'Item'}${variation ? ' · ' + variation : ''}`.slice(0, 120);
          out.push({ ...base, ext: `square:${p.id}:${li.uid || k}`, grp: 'square:' + p.id, usd: n / 100, tip: Math.max(0, Math.min(t, n)) / 100, item, qty: Number(li.quantity) > 0 ? Number(li.quantity) : 1, what: item });
        });
      }
      return out;
    },
  },
  paypal: {
    title: 'PayPal',
    blurb: 'Payments received into your PayPal business account. Net of PayPal fees.',
    fields: [
      { key: 'clientId', label: 'Live client ID', placeholder: 'A…', secret: false },
      { key: 'secret', label: 'Live secret', placeholder: 'E…', secret: true },
    ],
    steps: [
      'Open the PayPal Developer Dashboard → Apps & Credentials and switch to Live.',
      'Create app (type Merchant). Open it.',
      'Under Features, tick "Transaction search" and save. PayPal can take a few hours to enable it.',
      'Copy the Client ID and Secret and paste them here.',
    ],
    link: 'https://developer.paypal.com/dashboard/applications/live',
    check: (s) => (String(s.clientId || '').trim().length >= 20 && String(s.secret || '').trim().length >= 20 ? null : 'Paste both the live Client ID and the Secret.'),
    async pull({ secret, since, fetchImpl, now = Date.now(), maxPages = 20 }) {
      const basic = Buffer.from(`${String(secret.clientId).trim()}:${String(secret.secret).trim()}`).toString('base64');
      const tr = await fetchImpl('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST', headers: { authorization: 'Basic ' + basic, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: 'grant_type=client_credentials',
      });
      const tok = await readJsonResponse(tr, 'PayPal');
      if (!tok.access_token) throw new SyncError('PayPal did not return an access token');
      const out = [];
      const fmt = (ms) => new Date(ms).toISOString().slice(0, 19) + '-0000';
      // PayPal allows at most 31 days per query, so walk the range in 30-day windows.
      let start = since ? Date.parse(since) : now - 90 * DAY;
      let pages = 0;
      while (start < now && pages < maxPages) {
        const end = Math.min(now, start + 30 * DAY);
        for (let page = 1; pages < maxPages; page++) {
          pages++;
          const q = new URLSearchParams({ start_date: fmt(start), end_date: fmt(end), fields: 'transaction_info,payer_info', page_size: '500', page: String(page) });
          const r = await fetchImpl('https://api-m.paypal.com/v1/reporting/transactions?' + q, { headers: { authorization: 'Bearer ' + tok.access_token, accept: 'application/json' } });
          const j = await readJsonResponse(r, 'PayPal');
          for (const d of j.transaction_details || []) {
            const t = d.transaction_info || {};
            const gross = Number(t.transaction_amount && t.transaction_amount.value);
            if (t.transaction_status !== 'S' || !(gross > 0) || !String(t.transaction_event_code || '').startsWith('T00')) continue;
            const fee = Number((t.fee_amount && t.fee_amount.value) || 0);
            const payer = d.payer_info || {};
            out.push({
              ext: 'paypal:' + t.transaction_id, at: new Date(t.transaction_initiation_date).toISOString(), usd: gross + (fee < 0 ? fee : -fee),
              currency: t.transaction_amount.currency_code, who: (payer.payer_name && (payer.payer_name.alternate_full_name || payer.payer_name.given_name)) || payer.email_address || 'PayPal payer',
              what: t.transaction_subject || t.transaction_note || 'PayPal payment', ref: t.transaction_id,
            });
          }
          if (!(j.total_pages > page)) break;
        }
        start = end;
      }
      return out;
    },
  },
  gumroad: {
    title: 'Gumroad',
    blurb: 'Digital products and course sales. Net of Gumroad fees where Gumroad reports them.',
    fields: [{ key: 'token', label: 'Access token', placeholder: 'paste the access token', secret: true }],
    steps: [
      'Open Gumroad → Settings → Advanced → Applications.',
      'Create application (any name, redirect URI http://127.0.0.1).',
      'Click "Generate access token" and copy it.',
      'Paste it here.',
    ],
    link: 'https://app.gumroad.com/settings/advanced',
    check: (s) => (String(s.token || '').trim().length >= 20 ? null : 'That token looks too short.'),
    async pull({ secret, since, fetchImpl, maxPages = 20 }) {
      const out = [];
      let pageKey = null;
      for (let page = 0; page < maxPages; page++) {
        const q = new URLSearchParams();
        if (since) q.set('after', new Date(since).toISOString().slice(0, 10));
        if (pageKey) q.set('page_key', pageKey);
        const r = await fetchImpl('https://api.gumroad.com/v2/sales?' + q, { headers: { authorization: 'Bearer ' + String(secret.token).trim(), accept: 'application/json' } });
        const j = await readJsonResponse(r, 'Gumroad');
        if (j.success === false) throw new SyncError('Gumroad refused the request: ' + (j.message || 'unknown reason'));
        for (const s of j.sales || []) {
          if (s.refunded || s.chargedback || s.disputed) continue;
          const price = Number(s.price) || 0, fee = Number(s.gumroad_fee) || 0;
          out.push({
            ext: 'gumroad:' + s.id, at: new Date(s.created_at).toISOString(), usd: (price - fee) / 100, currency: String(s.currency_symbol === '$' || !s.currency ? 'USD' : s.currency).toUpperCase(),
            who: s.full_name || s.email || 'Gumroad buyer', what: s.product_name || 'Gumroad sale', ref: s.order_id ? String(s.order_id) : s.id,
          });
        }
        pageKey = j.next_page_key || null;
        if (!pageKey) break;
      }
      return out;
    },
  },
};

// Statement exports: where to find each one. The importer reads any CSV; these only pre-fill the source name and help.
export const CSV_SOURCES = {
  upwork: { title: 'Upwork', steps: ['Upwork → Reports → Transaction history.', 'Pick a date range, then Download CSV.'], link: 'https://www.upwork.com/nx/payments/reports/transaction-history' },
  fiverr: { title: 'Fiverr', steps: ['Fiverr → Earnings (from your profile menu).', 'Set the date range and download the CSV of your earnings.'] },
  etsy: { title: 'Etsy', steps: ['Etsy Shop Manager → Finances → Monthly statements.', 'Choose the month and Download CSV.'] },
  amazon: { title: 'Amazon Associates', steps: ['Associates Central → Reports → Earnings.', 'Download the report as CSV.'] },
  paypal: { title: 'PayPal (statement)', steps: ['PayPal → Activity → Statements → Custom.', 'Choose "Completed payments", a date range, CSV, then Download.'] },
  venmo: { title: 'Venmo', steps: ['Venmo on the web → Statements.', 'Pick a month and download the CSV.'] },
  bank: { title: 'Bank or card account', steps: ['Your bank → the account → Download transactions.', 'Choose CSV. Only deposits (positive amounts) are imported.'] },
  other: { title: 'Anything else', steps: ['Any CSV with a date and an amount column works. Check the column matches before importing.'] },
};

export const connectorSpecs = () => Object.fromEntries(Object.entries(CONNECTORS).map(([k, c]) => [k, { title: c.title, blurb: c.blurb, fields: c.fields, steps: c.steps, link: c.link }]));

// ---------------------------------------------------------------------------------------------- the connection store
const storeFile = (dataDir) => path.join(dataDir, 'connections.json');
export function loadConnections(dataDir) {
  if (!dataDir) return [];
  try { const j = JSON.parse(fs.readFileSync(storeFile(dataDir), 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; }
}
function saveConnections(dataDir, list) {
  fs.mkdirSync(dataDir, { recursive: true });
  const f = storeFile(dataDir), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, f);
}
const mask = (v) => { const s = String(v || ''); return s ? '••••' + s.slice(-4) : ''; };
export function publicConnection(c) {
  const spec = CONNECTORS[c.kind];
  const secret = {};
  for (const f of (spec ? spec.fields : [])) secret[f.key] = f.secret ? mask(c.secret && c.secret[f.key]) : String((c.secret && c.secret[f.key]) || '');
  return { id: c.id, kind: c.kind, title: spec ? spec.title : c.kind, label: c.label || '', path: c.path, enabled: c.enabled !== false, demo: Boolean(c.demo), since: c.since, createdAt: c.createdAt, lastSync: c.lastSync || null, secret };
}
export const listConnections = (dataDir) => loadConnections(dataDir).map(publicConnection);

export function upsertConnection(dataDir, input, catalog) {
  const list = loadConnections(dataDir);
  const existing = input.id ? list.find((c) => c.id === input.id) : null;
  if (input.id && !existing) throw new LedgerError(`no connection "${input.id}"`);
  const kind = existing ? existing.kind : input.kind;
  const spec = CONNECTORS[kind];
  if (!spec) throw new LedgerError(`unknown connector "${kind}" (${Object.keys(CONNECTORS).join(', ')})`);
  const pathId = input.path || (existing && existing.path);
  if (!catalog.some((p) => p.id === pathId)) throw new LedgerError(`unknown path "${pathId}"`);
  // a masked value coming back from the browser means "keep what is stored"
  const secret = { ...((existing && existing.secret) || {}) };
  for (const f of spec.fields) {
    const v = input.secret && input.secret[f.key];
    if (typeof v === 'string' && v.trim() && !v.startsWith('••••')) secret[f.key] = v.trim();
  }
  const bad = spec.check(secret);
  if (bad) throw new LedgerError(bad);
  const since = input.since ? new Date(input.since) : existing ? new Date(existing.since) : new Date(Date.now() - 90 * DAY);
  if (Number.isNaN(since.getTime())) throw new LedgerError('since must be a date like 2026-06-01');
  const c = {
    id: existing ? existing.id : `conn_${kind}_${crypto.randomBytes(3).toString('hex')}`,
    kind, label: String(input.label ?? (existing && existing.label) ?? '').slice(0, 60), path: pathId,
    enabled: input.enabled !== undefined ? input.enabled !== false : existing ? existing.enabled !== false : true,
    since: since.toISOString(), secret, createdAt: existing ? existing.createdAt : new Date().toISOString(),
    lastSync: existing ? existing.lastSync || null : null,
    cursor: existing && existing.path === pathId && existing.since === since.toISOString() ? existing.cursor || null : null,
  };
  const next = existing ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c];
  saveConnections(dataDir, next);
  return c;
}
export function removeConnection(dataDir, id) {
  const list = loadConnections(dataDir);
  if (!list.some((c) => c.id === id)) throw new LedgerError(`no connection "${id}"`);
  saveConnections(dataDir, list.filter((c) => c.id !== id));
}
function patchConnection(dataDir, id, patch) {
  const list = loadConnections(dataDir);
  saveConnections(dataDir, list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

// ---------------------------------------------------------------------------------------------- importing records
// Every transaction id already on the ledger, including the parent id of payments that were split into lines,
// so a split sale and the same sale unsplit can never both count.
export function knownExt(ledger) {
  const s = new Set();
  for (const e of ledger.readAll()) if (e.kind === 'money.in') { if (e.ext) s.add(e.ext); if (e.grp) s.add(e.grp); }
  return s;
}
// Classify normalized records against the ledger without writing anything.
export function classify(records, seen) {
  const batch = new Set();
  return records.map((r) => {
    let status = 'new', reason = '';
    if (!r.at || Number.isNaN(Date.parse(r.at))) { status = 'skip'; reason = 'no readable date'; }
    else if (!(r.usd > 0)) { status = 'skip'; reason = r.reason || 'not money in'; }
    else if (r.currency && String(r.currency).toUpperCase() !== 'USD') { status = 'skip'; reason = `${r.currency}, not USD`; }
    else if (r.skip) { status = 'skip'; reason = r.skip; }
    else if (seen.has(r.ext) || (r.grp && seen.has(r.grp)) || batch.has(r.ext)) { status = 'duplicate'; reason = 'already on the ledger'; }
    if (status === 'new') batch.add(r.ext);
    return { ...r, usd: round2(Number(r.usd) || 0), status, reason };
  });
}
export function importRecords(ledger, records, { path: pathId, via, sourceTitle, verb = 'synced' }) {
  const rows = classify(records, knownExt(ledger));
  const added = [];
  for (const r of rows) {
    if (r.status !== 'new') continue;
    const ev = ledger.append({
      kind: 'money.in', usd: r.usd, path: pathId, source: String(r.who || sourceTitle).slice(0, 120),
      evidence: `${sourceTitle} ${r.ref || r.ext.split(':').slice(1).join(':')} (${verb})`.slice(0, 240), ext: r.ext, via, ts: new Date(r.at).toISOString(),
      ...(r.item ? { item: String(r.item).trim().slice(0, 120) } : {}),
      ...(r.qty > 0 && r.qty < 10000 ? { qty: r.qty } : {}),
      ...(r.tip > 0 ? { tip: Math.min(round2(r.tip), round2(r.usd)) } : {}),
      ...(r.grp ? { grp: r.grp } : {}),
    });
    added.push(ev);
  }
  return { rows, added, usd: round2(added.reduce((s, e) => s + e.usd, 0)) };
}

// ---------------------------------------------------------------------------------------------- running a sync
const inFlight = new Set();
export const syncing = () => inFlight.size > 0;

export async function syncConnection({ ledger, dataDir, id, fetchImpl = globalThis.fetch, now = Date.now() }) {
  const c = loadConnections(dataDir).find((x) => x.id === id);
  if (!c) throw new LedgerError(`no connection "${id}"`);
  const spec = CONNECTORS[c.kind];
  if (!spec) return { id, kind: c.kind, ok: false, error: `unknown connector "${c.kind}"` };
  if (c.demo) return { id, kind: c.kind, ok: true, imported: 0, usd: 0, skipped: 0, demo: true };
  if (inFlight.has(id)) return { id, kind: c.kind, ok: false, error: 'already syncing' };
  inFlight.add(id);
  try {
    // re-read a few days before the last sync: late settlements still land, and ext ids stop any double count
    const since = c.cursor ? new Date(Date.parse(c.cursor) - 3 * DAY).toISOString() : c.since;
    const records = await spec.pull({ secret: c.secret || {}, since, fetchImpl, now });
    const res = importRecords(ledger, records, { path: c.path, via: c.kind, sourceTitle: spec.title });
    const skipped = res.rows.filter((r) => r.status === 'skip').length;
    const lastSync = { at: new Date(now).toISOString(), ok: true, imported: res.added.length, usd: res.usd, seen: records.length, skipped };
    patchConnection(dataDir, id, { lastSync, cursor: new Date(now).toISOString() });
    return { id, kind: c.kind, ...lastSync };
  } catch (e) {
    const lastSync = { at: new Date(now).toISOString(), ok: false, error: e instanceof SyncError || e instanceof LedgerError ? e.message : `could not reach ${spec.title}: ${e.message}` };
    patchConnection(dataDir, id, { lastSync });
    return { id, kind: c.kind, ...lastSync };
  } finally {
    inFlight.delete(id);
  }
}
export async function syncAll({ ledger, dataDir, fetchImpl, now }) {
  const out = [];
  for (const c of loadConnections(dataDir)) if (c.enabled !== false) out.push(await syncConnection({ ledger, dataDir, id: c.id, fetchImpl, now }));
  return out;
}
// Try the key before saving it: one small read of the last week.
export async function testConnection({ kind, secret, fetchImpl = globalThis.fetch, now = Date.now() }) {
  const spec = CONNECTORS[kind];
  if (!spec) throw new LedgerError(`unknown connector "${kind}"`);
  const bad = spec.check(secret || {});
  if (bad) throw new LedgerError(bad);
  const records = await spec.pull({ secret, since: new Date(now - 7 * DAY).toISOString(), fetchImpl, now, maxPages: 1 });
  return { ok: true, recent: records.length };
}

// ---------------------------------------------------------------------------------------------- CSV statements
export function parseCsv(text) {
  let s = String(text || '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const first = s.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => first.split(ch).length - 1;
  const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((f) => f.trim() !== '')) rows.push(row); row = []; }
    else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], rows: [] };
  // some exports put a title block above the real header: use the first row that has 3+ filled cells
  const filled = (r) => r.filter((f) => f.trim()).length;
  const want = Math.min(3, Math.max(...rows.slice(0, 12).map(filled)));
  let h = 0;
  while (h < rows.length - 1 && filled(rows[h]) < want) h++;
  return { headers: rows[h].map((x) => x.trim()), rows: rows.slice(h + 1) };
}

const FIELDS = ['date', 'amount', 'id', 'who', 'what', 'currency', 'type', 'status'];
export function detectMapping(headers) {
  const H = headers.map((x) => x.toLowerCase().trim());
  const find = (tests, not = []) => {
    for (const t of tests) {
      const i = H.findIndex((h) => (typeof t === 'string' ? h === t : t.test(h)) && !not.some((n) => n.test(h)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const m = {
    date: find(['date', 'date paid', 'transaction date', 'payment date', 'order date', 'created', /\bdate\b/, /date/, /time/], [/update/i, /due/i]),
    amount: find(['net', 'net amount', 'amount', 'earnings', 'amount received', 'total', 'gross', /\bnet\b/, /amount/, /earning/, /credit/, /total/, /price/], [/fee/, /tax/, /balance/, /local/, /debit/]),
    id: find(['transaction id', 'order id', 'receipt id', 'ref id', 'id', 'reference', 'reference id', 'order', 'invoice', /transaction.?id/, /order.?(id|number|#)/, /reference/, /\bref\b/, /receipt/, /\bid\b/]),
    who: find(['name', 'client', 'customer', 'buyer', 'payer', 'from', 'team', 'client name', 'buyer name', /client/, /customer/, /buyer/, /payer/, /\bname\b/]),
    what: find(['description', 'title', 'item', 'item title', 'memo', 'summary', 'details', 'subject', 'note', 'product', /description/, /title/, /item/, /memo/, /product/]),
    currency: find(['currency', /currency/]),
    type: find(['type', 'transaction type', /\btype\b/]),
    status: find(['status', /status/]),
  };
  return m;
}
export function parseAmount(v) {
  let s = String(v ?? '').trim();
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  s = s.replace(/[^0-9.,-]/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  // 1.234,56 (comma decimals) vs 1,234.56
  if (/,\d{2}$/.test(s) && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}
export function parseDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (m) {
    let [, a, b, y, hh = '12', mm = '00', ss = '00', ap] = m;
    let mon = Number(a), day = Number(b);
    if (mon > 12 && day <= 12) [mon, day] = [day, mon];
    let year = Number(y); if (year < 100) year += 2000;
    let hour = Number(hh); if (ap) { if (/pm/i.test(ap) && hour < 12) hour += 12; if (/am/i.test(ap) && hour === 12) hour = 0; }
    const d = new Date(Date.UTC(year, mon - 1, day, hour, Number(mm), Number(ss)));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
const SKIP_TYPE = /withdraw|transfer|bank deposit|payout|conversion|currency|fee|refund|reversal|chargeback|hold|authorization|debit|purchase|payment sent/i;
const SKIP_STATUS = /pending|denied|failed|refund|reversed|cancel|declined|void|unclaimed|on hold/i;
export function csvRecords(text, { source = 'csv', mapping } = {}) {
  const { headers, rows } = parseCsv(text);
  const map = { ...detectMapping(headers), ...(mapping || {}) };
  const get = (row, k) => (map[k] >= 0 && map[k] < row.length ? String(row[map[k]] ?? '').trim() : '');
  const twins = new Map();
  const records = rows.map((row) => {
    const amount = parseAmount(get(row, 'amount'));
    const at = parseDate(get(row, 'date'));
    const type = get(row, 'type'), status = get(row, 'status');
    const idv = get(row, 'id');
    const who = get(row, 'who'), what = get(row, 'what');
    // no id column: fingerprint the row, numbering identical rows so two equal payments on one day both count,
    // while importing the same file again still matches every row to itself
    const key = [get(row, 'date'), get(row, 'amount'), who, what].join('|');
    const n = (twins.get(key) || 0) + 1; twins.set(key, n);
    const ext = idv ? `${source}:${idv}` : `${source}:h${crypto.createHash('sha1').update(key + '#' + n).digest('hex').slice(0, 16)}`;
    let skip = '';
    if (map.amount < 0) skip = 'no amount column';
    else if (type && SKIP_TYPE.test(type)) skip = `type "${type}"`;
    else if (status && SKIP_STATUS.test(status)) skip = `status "${status}"`;
    return { ext, at, usd: amount, currency: get(row, 'currency') || '', who: who || what || source, what: what || who || '', item: what ? what.slice(0, 120) : undefined, ref: idv || '', skip, reason: amount < 0 ? 'money out' : amount === 0 ? 'zero' : Number.isNaN(amount) ? 'no amount' : '' };
  });
  return { headers, mapping: map, fields: FIELDS, records };
}
