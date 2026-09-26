// The outside world for the preview's mock station: stand-ins for Stripe, Square, PayPal, Gumroad and the Texas permit
// records that answer in each platform's real response shape, so the engine's own sync and harvest code runs unchanged.
// Every business, buyer and dollar is made up. Nothing is ever sent to the real services.
//
// Payments are a pure function of (key, time): the same key always sees the same transaction ids, so re-syncing finds
// duplicates exactly as it would against the real API. Before the mock was first opened, sales are sparse history
// (a few a day, business hours only); while a mock page is open they arrive every few minutes, so there is always
// something to watch.
const HIST = 8 * 3600e3;
const LIVE = 150e3;

const hash32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const FIRST = ['Jordan', 'Maya', 'Chris', 'Priya', 'Devon', 'Alex', 'Sam', 'Rosa', 'Tariq', 'Lena', 'Marcus', 'Ivy', 'Noah', 'Grace', 'Omar', 'Tess'];
const LAST = ['P.', 'K.', 'R.', 'M.', 'T.', 'L.', 'S.', 'W.', 'B.', 'D.'];
const buyer = (r) => `${pick(r, FIRST)} ${pick(r, LAST)} (demo)`;

// spans: [[startMs, endMs]] when a mock page was open (dense sales); liveOnly: the seeded demo link, whose history is
// already on the demo ledger, so it only ever brings in new sales.
export function makeServices({ getSpans, getItems, now = () => Date.now() }) {
  function sales(key, from, to, liveOnly) {
    const spans = getSpans();
    const inLive = (t) => spans.some(([a, b]) => t >= a && t <= b);
    const out = [];
    const t1 = Math.min(to, now());
    if (!liveOnly) {
      for (let s = Math.floor(from / HIST); s <= Math.floor(t1 / HIST); s++) {
        const r = rng(hash32(`${key}:h:${s}`));
        if (r() > 0.6) continue;
        const t = s * HIST + r() * HIST;
        const hr = new Date(t).getHours();
        if (t < from || t > t1 || hr < 8 || hr > 20 || inLive(t)) continue;
        out.push({ id: `h${s}`, t, r });
      }
    }
    for (const [a, b] of spans) {
      const lo = Math.max(a, from), hi = Math.min(b, t1);
      for (let s = Math.floor(lo / LIVE); s <= Math.floor(hi / LIVE); s++) {
        const r = rng(hash32(`${key}:l:${s}`));
        if (r() > 0.5) continue;
        const t = s * LIVE + r() * LIVE;
        if (t < lo || t > hi) continue;
        out.push({ id: `l${s}`, t, r });
      }
    }
    return out.sort((x, y) => x.t - y.t);
  }
  const itemFor = (r) => {
    const items = getItems();
    return items.length ? pick(r, items) : { name: 'Consulting session', usd: 150 };
  };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const keyOf = (h) => String((h && (h.authorization || h.Authorization)) || '').replace(/^(Bearer|Basic)\s+/i, '');
  const live = (k) => /demo-live/.test(k);

  const stripe = (u, k) => {
    const since = Number(u.searchParams.get('created[gte]') || 0) * 1000;
    const data = sales('stripe:' + k, since || now() - 90 * 864e5, now(), live(k)).reverse().map((x) => {
      const it = itemFor(x.r), gross = Math.round(it.usd * 100);
      return { id: `txn_mock_${hash32(k).toString(36)}_${x.id}`, type: 'charge', created: Math.floor(x.t / 1000), amount: gross, fee: Math.round(gross * 0.029 + 30), net: gross - Math.round(gross * 0.029 + 30), currency: 'usd', description: `${it.name} for ${buyer(x.r)}` };
    });
    return json({ object: 'list', data, has_more: false });
  };
  const squareSales = (k, since) => sales('square:' + k, since || now() - 90 * 864e5, now(), live(k)).map((x) => {
    const it = itemFor(x.r), cents = Math.round(it.usd * 100), tip = x.r() < 0.6 ? Math.round(cents * (0.15 + x.r() * 0.1)) : 0;
    const extra = x.r() < 0.25 ? itemFor(x.r) : null;
    const pid = `sqp_${hash32(k).toString(36)}_${x.id}`;
    return { p: { id: pid, order_id: 'ord_' + pid, status: 'COMPLETED', created_at: new Date(x.t).toISOString(), receipt_number: pid.slice(-6).toUpperCase(), buyer_email_address: `${pick(x.r, FIRST).toLowerCase()}@example.com`, amount_money: { amount: cents + (extra ? Math.round(extra.usd * 100) : 0), currency: 'USD' }, tip_money: { amount: tip, currency: 'USD' }, processing_fee: [{ amount_money: { amount: Math.round((cents + tip) * 0.026 + 10), currency: 'USD' } }] }, lines: [it, ...(extra ? [extra] : [])] };
  });
  const square = async (u, k, init) => {
    if (u.pathname.endsWith('/orders/batch-retrieve')) {
      const ids = new Set((JSON.parse(init.body || '{}').order_ids) || []);
      const all = squareSales(k, now() - 400 * 864e5);
      return json({ orders: all.filter((s) => ids.has(s.p.order_id)).map((s) => ({ id: s.p.order_id, line_items: s.lines.map((li, i) => ({ uid: 'li' + i, name: li.name, quantity: '1', total_money: { amount: Math.round(li.usd * 100), currency: 'USD' } })) })) });
    }
    const since = Date.parse(u.searchParams.get('begin_time') || '') || 0;
    return json({ payments: squareSales(k, since).map((s) => s.p) });
  };
  const paypal = (u, k) => {
    if (u.pathname.endsWith('/oauth2/token')) return json({ access_token: 'mock-' + k.slice(-8), token_type: 'Bearer', expires_in: 3600 });
    const a = Date.parse(u.searchParams.get('start_date') || '') || 0, b = Date.parse(u.searchParams.get('end_date') || '') || now();
    const tx = sales('paypal:' + k, a, b, live(k)).map((x) => {
      const it = itemFor(x.r);
      return { transaction_info: { transaction_id: `PP${hash32(k + x.id).toString(36).toUpperCase()}`, transaction_event_code: 'T0006', transaction_status: 'S', transaction_initiation_date: new Date(x.t).toISOString(), transaction_amount: { currency_code: 'USD', value: it.usd.toFixed(2) }, fee_amount: { currency_code: 'USD', value: (-(it.usd * 0.0349 + 0.49)).toFixed(2) }, transaction_subject: it.name }, payer_info: { payer_name: { alternate_full_name: buyer(x.r) } } };
    });
    return json({ transaction_details: tx, total_pages: 1 });
  };
  const gumroad = (u, k) => {
    const since = Date.parse(u.searchParams.get('after') || '') || 0;
    const list = sales('gumroad:' + k, since || now() - 90 * 864e5, now(), live(k)).map((x) => {
      const it = itemFor(x.r), cents = Math.round(it.usd * 100);
      return { id: `gr_${hash32(k).toString(36)}_${x.id}`, created_at: new Date(x.t).toISOString(), price: cents, gumroad_fee: Math.round(cents * 0.1), currency: 'usd', full_name: buyer(x.r), product_name: it.name };
    });
    return json({ success: true, sales: list });
  };
  // Texas Comptroller sales-tax permits: a handful of fictional new local businesses each day
  const NAMES = ['Bluebonnet', 'Cedar Hollow', 'Pecan Street', 'Lone Oak', 'Guadalupe', 'Riverbend', 'Mesquite', 'Hill Country', 'Brazos', 'Sunset Ridge', 'Live Oak', 'Barton'];
  const KINDS = [['812111', 'Barber Shop'], ['812112', 'Salon'], ['812113', 'Nail Studio'], ['812199', 'Lash & Brow'], ['812910', 'Pet Grooming'], ['811111', 'Auto Repair'], ['621210', 'Family Dental']];
  const CITIES = [['Austin', '78704'], ['Round Rock', '78664'], ['Pflugerville', '78660'], ['Georgetown', '78626'], ['Cedar Park', '78613']];
  const permits = () => {
    const rows = [];
    const today = Math.floor(now() / 864e5);
    for (let d = today - 30; d <= today; d++) {
      const r = rng(hash32('permit:' + d));
      const n = Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const [naics, kind] = pick(r, KINDS), [city, zip] = pick(r, CITIES), name = `${pick(r, NAMES)} ${kind} (demo)`;
        rows.push({ taxpayer_number: String(30000000000 + d * 10 + i), outlet_number: String(i + 1), taxpayer_name: `${name} LLC`, outlet_name: name, outlet_address: `${100 + Math.floor(r() * 9000)} ${pick(r, NAMES)} Rd`, outlet_city: city, outlet_zip_code: zip, outlet_naics_code: naics, outlet_permit_issue_date: new Date(d * 864e5).toISOString(), outlet_first_sales_date: new Date(d * 864e5).toISOString() });
      }
    }
    return json(rows);
  };

  // fetchImpl for the engine: every outside call lands here and never on the network
  return async function mockFetch(url, init = {}) {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 450));
    const u = new URL(String(url));
    const k = keyOf(init.headers);
    if (u.hostname === 'api.stripe.com') return stripe(u, k);
    if (u.hostname === 'connect.squareup.com') return square(u, k, init);
    if (u.hostname === 'api-m.paypal.com') return paypal(u, u.pathname.endsWith('/oauth2/token') ? k : k.replace(/^mock-/, ''));
    if (u.hostname === 'api.gumroad.com') return gumroad(u, k);
    if (u.hostname === 'data.texas.gov') return permits();
    return json({ error: { message: `the mock has no stand-in for ${u.hostname}` } }, 502);
  };
}
