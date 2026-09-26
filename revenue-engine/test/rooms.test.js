import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpLedger } from './helpers.js';
import { validate } from '../src/ledger.js';
import { reduce } from '../src/reduce.js';
import { quests } from '../src/quests.js';
import { createServer } from '../src/server.js';
import { seedBarberDemo, seedAllowanceDemo } from '../src/demo.js';
import { CATALOG } from '../src/paths.js';
import { CONNECTORS, importRecords, upsertConnection, syncConnection } from '../src/sync.js';
import {
  normalizeConfig, saveConfig, loadConfig, resetConfig, fromTemplate, catalogFrom, loadCatalog, stationInfo,
  roomForItem, routeEvents, unclaimedItems, TEMPLATES, MAX_ROOMS,
} from '../src/rooms.js';

const barber = () => catalogFrom(fromTemplate('barber'));
const sale = (item, usd, extra = {}) => ({ kind: 'money.in', id: 'e' + Math.random().toString(36).slice(2, 8), ts: '2026-09-10T15:00:00Z', usd, path: 'haircut', source: 'client', evidence: 'square receipt 1', item, ...extra });

test('a room design is validated with sentences a person can act on', () => {
  assert.throws(() => normalizeConfig({ rooms: [] }), /at least one room/);
  assert.throws(() => normalizeConfig({ rooms: [{ name: '' }] }), /room 1 needs a name/);
  assert.throws(() => normalizeConfig({ rooms: Array.from({ length: MAX_ROOMS + 1 }, (_, i) => ({ name: 'R' + i })) }), /room for 10 rooms/);
  assert.throws(() => normalizeConfig({ rooms: [{ base: 'no-such-path' }] }), /unknown path/);
  const c = normalizeConfig({ name: '  Kim\'s Cuts ', rooms: [{ name: 'Skin Fade!', match: ['  FADE ', 'fade', 'Taper_Fade'], minutes: 99999, costUsd: -3, accent: 'red' }, { name: 'Skin Fade!' }] });
  assert.equal(c.name, "Kim's Cuts");
  assert.equal(c.template, 'custom');
  assert.deepEqual(c.rooms.map((r) => r.id), ['skin-fade', 'skin-fade-2']);
  assert.deepEqual(c.rooms[0].match, ['fade', 'taper fade']);
  assert.equal(c.rooms[0].minutes, 1440);
  assert.equal(c.rooms[0].costUsd, 0);
  assert.match(c.rooms[0].accent, /^#[0-9a-f]{6}$/);
  assert.equal(c.rooms[0].kind, 'service');
  assert.equal(c.rooms[0].style, 'barber');
  assert.equal(c.rooms[0].screen, 'open');
  assert.equal(c.rooms[0].prop, 'pole');
  // rooms: null means the built-in paths
  assert.deepEqual(normalizeConfig({ name: 'X', rooms: null }), { name: 'X', template: 'paths', mode: 'agents', skin: 'space', folk: [], rooms: null });
});

test('templates: the barber shop splits a real Square menu into the right rooms', () => {
  const cat = barber();
  assert.equal(cat.length, TEMPLATES.barber.rooms.length);
  const where = (item) => roomForItem(item, cat);
  assert.equal(where('Skin Fade'), 'skin-fade');
  assert.equal(where('Taper · Low'), 'skin-fade');
  assert.equal(where("Men's Haircut"), 'haircut');
  assert.equal(where('Kids Cut (12 & under)'), 'kids-cut');
  assert.equal(where('Beard Trim'), 'beard-trim');
  assert.equal(where('Beard Oil'), 'products');
  assert.equal(where('Line Up'), 'line-up');
  assert.equal(where('Hot Towel Shave'), 'hot-towel-shave');
  assert.equal(where('Gray Blend'), 'color');
  assert.equal(where('Pomade'), 'products');
  assert.equal(where('Gift Card'), null);
  assert.equal(where(''), null);
  // every template is valid as shipped
  for (const k of Object.keys(TEMPLATES)) assert.doesNotThrow(() => fromTemplate(k));
  assert.throws(() => fromTemplate('nope'), /unknown template/);
});

test('rooms.json round trip, and the catalog the engine runs on', () => {
  const { dir } = tmpLedger();
  assert.equal(loadConfig(dir), null);
  assert.equal(loadCatalog(dir), CATALOG);
  assert.deepEqual(stationInfo(dir), { name: 'Proxyfolk', template: 'paths', custom: false, configured: false, mode: 'agents', skin: 'space', folk: [], kids: [] });
  const keep = CATALOG[0].id;
  saveConfig(dir, { name: 'Mixed', rooms: [{ name: 'Braids', match: ['braid'], minutes: 180, priceUsd: 150, costUsd: 10, goalUsd: 1200 }, { base: keep, name: 'My path', accent: '#123456' }] });
  assert.ok(fs.existsSync(path.join(dir, 'rooms.json')));
  const cat = loadCatalog(dir);
  assert.deepEqual(cat.map((r) => [r.id, r.rank, r.kind]), [['braids', 1, 'service'], [keep, 2, 'pipeline']]);
  const braids = cat[0], base = cat[1];
  assert.equal(braids.goalUsd, 1200);
  assert.equal(braids.budgetUsd, 5);
  assert.deepEqual(braids.stages, {});
  // a built-in path inside a custom station keeps its stages, gate and budget, and takes the new name and color
  assert.equal(base.name, 'My path');
  assert.equal(base.accent, '#123456');
  assert.deepEqual(base.stages, CATALOG[0].stages);
  assert.equal(base.budgetUsd, CATALOG[0].budgetUsd);
  assert.deepEqual(stationInfo(dir), { name: 'Mixed', template: 'custom', custom: true, configured: true, mode: 'service', skin: 'space', folk: [], kids: [] });
  // a corrupt file falls back to the built-in paths instead of taking the station down
  fs.writeFileSync(path.join(dir, 'rooms.json'), '{not json');
  assert.equal(loadCatalog(dir), CATALOG);
  saveConfig(dir, fromTemplate('salon'));
  resetConfig(dir);
  assert.equal(loadConfig(dir), null);
});

test('rooms are views: money is re-filed by item name at read time, and the vault total never changes', () => {
  const cat = barber();
  const events = [
    sale('Skin Fade', 42), sale('Beard Trim', 20), sale('Gift Card', 50), sale(undefined, 30),
    { kind: 'money.in', id: 'x1', ts: '2026-09-10T16:00:00Z', usd: 12, path: 'haircut', source: 'walk-in', evidence: 'cash' },
  ];
  const routed = routeEvents(events, cat);
  assert.deepEqual(routed.map((e) => e.path), ['skin-fade', 'beard-trim', 'haircut', 'haircut', 'haircut']);
  assert.equal(routed[0].loggedPath, 'haircut');
  assert.equal(routed[2].loggedPath, undefined);
  assert.equal(events[0].path, 'haircut', 'the ledger lines themselves are never rewritten');
  const st = reduce(events, cat);
  assert.equal(st.paths['skin-fade'].earnedUsd, 42);
  assert.equal(st.paths['beard-trim'].earnedUsd, 20);
  assert.equal(st.paths.haircut.earnedUsd, 92);
  assert.equal(st.earnedUsd, 154);
  // a catalog with no keywords leaves every line where it was logged
  assert.equal(routeEvents(events, CATALOG), events);
  assert.deepEqual(unclaimedItems(events, cat).map((x) => [x.item, x.usd]), [['Gift Card', 50]]);
  // money logged to a room that was later removed still counts in the vault
  const orphan = reduce([{ kind: 'money.in', id: 'o1', ts: '2026-09-10T16:00:00Z', usd: 25, path: 'old-room', source: 'x', evidence: 'cash' }], cat);
  assert.equal(orphan.earnedUsd, 25);
});

test('service rooms have no sales-pipeline quests; built-in paths keep theirs', () => {
  const cfg = normalizeConfig({ rooms: [{ name: 'Fade', match: ['fade'] }, { base: CATALOG[0].id }] });
  const cat = catalogFrom(cfg);
  const qs = quests(reduce([], cat), cat);
  assert.ok(!qs.some((q) => q.kind === 'stage' && q.path === 'fade'));
  assert.ok(qs.some((q) => q.kind === 'stage' && q.path === CATALOG[0].id));
});

test('ledger: item, qty, tip and grp on money.in are checked', () => {
  const ok = { kind: 'money.in', usd: 50, path: 'a', source: 'b', evidence: 'receipt 1' };
  assert.doesNotThrow(() => validate({ ...ok, item: 'Skin Fade', qty: 2, tip: 8, grp: 'square:p1' }));
  assert.throws(() => validate({ ...ok, item: '' }), /item/);
  assert.throws(() => validate({ ...ok, item: 'x'.repeat(121) }), /item/);
  assert.throws(() => validate({ ...ok, qty: 0 }), /qty/);
  assert.throws(() => validate({ ...ok, tip: 60 }), /tip/);
  assert.throws(() => validate({ ...ok, tip: -1 }), /tip/);
  assert.throws(() => validate({ ...ok, grp: 'x' }), /grp/);
});

// A fake fetch that answers by URL prefix and records what was asked.
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    for (const [prefix, handler] of routes) {
      if (String(url).startsWith(prefix)) {
        const out = typeof handler === 'function' ? handler(String(url), opts) : handler;
        return { ok: true, status: 200, json: async () => out };
      }
    }
    return { ok: false, status: 404, json: async () => ({ errors: [{ detail: 'no route' }] }) };
  };
  fn.calls = calls;
  return fn;
}
const SQ_PAYMENTS = { payments: [
  // a fade plus a beard trim on one ticket, $10 tip, $2.08 in fees
  { id: 'p1', order_id: 'o1', status: 'COMPLETED', created_at: '2026-09-12T15:00:00Z', receipt_number: 'R1', amount_money: { amount: 6000, currency: 'USD' }, tip_money: { amount: 1000, currency: 'USD' }, total_money: { amount: 7000, currency: 'USD' }, processing_fee: [{ amount_money: { amount: 208, currency: 'USD' } }] },
  // no order behind it: one line, named from the note
  { id: 'p2', status: 'COMPLETED', created_at: '2026-09-12T16:00:00Z', amount_money: { amount: 2500, currency: 'USD' }, note: 'Line up' },
  { id: 'p3', order_id: 'o3', status: 'CANCELED', created_at: '2026-09-12T17:00:00Z', amount_money: { amount: 9900, currency: 'USD' } },
] };
const SQ_ORDERS = { orders: [{ id: 'o1', line_items: [
  { uid: 'a', name: 'Skin Fade', variation_name: 'Regular', quantity: '1', total_money: { amount: 4000, currency: 'USD' } },
  { uid: 'b', name: 'Beard Trim', quantity: '1', total_money: { amount: 2000, currency: 'USD' } },
  { uid: 'c', name: 'Hot towel (free)', quantity: '1', total_money: { amount: 0, currency: 'USD' } },
] }] };

test('Square: one ticket splits into one line per service, with the tip and fees shared by price', async () => {
  const f = fakeFetch([['https://connect.squareup.com/v2/payments', SQ_PAYMENTS], ['https://connect.squareup.com/v2/orders/batch-retrieve', (url, opts) => { assert.deepEqual(JSON.parse(opts.body).order_ids, ['o1']); return SQ_ORDERS; }]]);
  const recs = await CONNECTORS.square.pull({ secret: { token: 'EAAA' + 'x'.repeat(30) }, since: '2026-09-01T00:00:00Z', fetchImpl: f });
  assert.deepEqual(recs.map((r) => [r.ext, r.grp, r.item, r.usd, r.tip]), [
    ['square:p1:a', 'square:p1', 'Skin Fade', 45.28, 6.67],
    ['square:p1:b', 'square:p1', 'Beard Trim', 22.64, 3.33],
    ['square:p2', undefined, 'Line up', 25, 0],
  ]);
  // the lines add back up to the payment, to the cent
  assert.equal(Math.round((recs[0].usd + recs[1].usd) * 100), 7000 - 208);
  assert.equal(Math.round((recs[0].tip + recs[1].tip) * 100), 1000);
  // imported into a barber station, each line lands in its own room
  const { dir, ledger } = tmpLedger();
  const cat = barber();
  const res = importRecords(ledger, recs, { path: 'haircut', via: 'square', sourceTitle: 'Square' });
  assert.equal(res.added.length, 3);
  const st = reduce(ledger.readAll(), cat);
  assert.equal(st.paths['skin-fade'].earnedUsd, 45.28);
  assert.equal(st.paths['beard-trim'].earnedUsd, 22.64);
  assert.equal(st.paths['line-up'].earnedUsd, 25);
  assert.equal(Math.round(st.earnedUsd * 100), 7000 - 208 + 2500);
  // pulled again: nothing new
  assert.equal(importRecords(ledger, recs, { path: 'haircut', via: 'square', sourceTitle: 'Square' }).added.length, 0);
  // a payment already counted whole (before line items were read) is never counted again as lines
  const { ledger: l2 } = tmpLedger();
  l2.append({ kind: 'money.in', usd: 67.92, path: 'haircut', source: 'x', evidence: 'Square p1 (synced)', ext: 'square:p1', via: 'square' });
  assert.equal(importRecords(l2, recs, { path: 'haircut', via: 'square', sourceTitle: 'Square' }).added.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('HTTP: the room designer reads and saves rooms.json, and the station follows', async () => {
  const { dir, ledger } = tmpLedger();
  ledger.append(sale('Skin Fade', 40));
  ledger.append(sale('Gift Card', 50));
  const f = fakeFetch([['https://connect.squareup.com/v2/payments', SQ_PAYMENTS], ['https://connect.squareup.com/v2/orders/batch-retrieve', SQ_ORDERS]]);
  const server = createServer({ ledger, dataDir: dir, fetchImpl: f });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    let info = await (await fetch(base + '/api/rooms')).json();
    assert.equal(info.config.rooms, null);
    assert.equal(info.catalog.length, CATALOG.length);
    assert.ok(info.templates.barber && info.styles.barber && info.screens.includes('open') && info.props.includes('pole'));
    let st = await (await fetch(base + '/api/state')).json();
    assert.equal(st.station.configured, false);

    const tpl = await post('/api/rooms', { template: 'barber', name: "Kim's Cuts" });
    assert.equal(tpl.status, 200);
    st = await (await fetch(base + '/api/state')).json();
    assert.equal(st.station.name, "Kim's Cuts");
    assert.equal(st.catalog.length, 8);
    assert.equal(st.state.paths['skin-fade'].earnedUsd, 40);
    assert.equal(st.state.paths.haircut.earnedUsd, 50);
    info = await (await fetch(base + '/api/rooms')).json();
    assert.deepEqual(info.unclaimed.map((x) => x.item), ['Gift Card']);

    // claim gift cards in their own room, first in line
    const rooms = [{ name: 'Gift cards', match: ['gift'] }, ...info.config.rooms];
    assert.equal((await post('/api/rooms', { config: { name: "Kim's Cuts", rooms } })).status, 200);
    st = await (await fetch(base + '/api/state')).json();
    assert.equal(st.state.paths['gift-cards'].earnedUsd, 50);
    assert.equal(st.state.earnedUsd, 90);

    // the dashboard's world picker changes the skin and leaves the rooms alone
    assert.equal((await post('/api/rooms', { skin: 'castle' })).status, 200);
    st = await (await fetch(base + '/api/state')).json();
    assert.equal(st.station.skin, 'castle');
    assert.equal(st.state.paths['gift-cards'].earnedUsd, 50);
    assert.equal((await post('/api/rooms', { skin: 'moon-base' })).status, 400);

    assert.equal((await post('/api/rooms', { config: { rooms: [] } })).status, 400);
    assert.equal((await post('/api/rooms', { template: 'barber' }, { origin: 'https://evil.example' })).status, 403);

    // Square linked to the default room: a synced ticket splits across the service rooms
    const linked = await post('/api/connections', { kind: 'square', path: 'haircut', secret: { token: 'EAAA' + 'y'.repeat(30) } });
    assert.equal(linked.status, 201);
    st = await (await fetch(base + '/api/state')).json();
    assert.equal(st.state.paths['skin-fade'].earnedUsd, 40 + 45.28);
    assert.equal(st.state.paths['beard-trim'].earnedUsd, 22.64);
    assert.equal(st.state.paths['line-up'].earnedUsd, 25);

    assert.equal((await post('/api/rooms', { reset: true })).status, 200);
    st = await (await fetch(base + '/api/state')).json();
    assert.equal(st.catalog.length, CATALOG.length);
    assert.equal(Math.round(st.state.earnedUsd * 100), 9000 + 6792 + 2500, 'resetting the rooms never loses money');
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('barber demo: labeled, only on an empty ledger, and every dollar lands in a room', () => {
  const { dir, ledger } = tmpLedger();
  const now = Date.parse('2026-09-25T18:00:00Z');
  seedBarberDemo(ledger, dir, now);
  assert.throws(() => seedBarberDemo(ledger, dir, now), /already has lines/);
  const cat = loadCatalog(dir);
  assert.equal(stationInfo(dir).name, 'The Shop (demo)');
  const st = reduce(ledger.readAll(), cat);
  assert.ok(st.demo, 'the demo ledger says it is a demo');
  const inRooms = cat.reduce((s, r) => s + st.paths[r.id].earnedUsd, 0);
  assert.equal(Math.round(inRooms * 100), Math.round(st.earnedUsd * 100));
  assert.ok(cat.every((r) => st.paths[r.id].earnedUsd > 0), 'every service room sold something');
  assert.ok(st.moneyIn.every((e) => e.item && e.ext && e.via === 'square'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('modes, skins, kids and per-skin looks are validated and saved', () => {
  const c = normalizeConfig({ mode: 'allowance', skin: 'castle', kids: ['Emma', { name: 'liam', color: '#123456' }, 'EMMA', '  '], rooms: [{ name: 'Dishes', looks: { castle: 'crypt', farm: 'Bad Look', nowhere: 'x' } }] });
  assert.equal(c.mode, 'allowance');
  assert.equal(c.skin, 'castle');
  assert.deepEqual(c.folk, [{ name: 'Emma', color: '#f472b6' }, { name: 'liam', color: '#123456' }], 'kids is read as the older name for folk');
  assert.deepEqual(c.rooms[0].looks, { castle: 'crypt' });
  assert.throws(() => normalizeConfig({ skin: 'moon', rooms: null }), /skin must be one of/);
  assert.throws(() => normalizeConfig({ mode: 'party', rooms: null }), /mode must be one of/);
  assert.throws(() => normalizeConfig({ folk: Array.from({ length: 13 }, (_, i) => 'Kid' + i), rooms: null }), /up to 12 folk/);
  // folk may name the rooms they work; unknown rooms are dropped
  const f = normalizeConfig({ folk: [{ name: 'Dre', role: '  Master   barber ', rooms: ['fade', 'nowhere'] }, { name: 'Kim', rooms: ['gone'] }], rooms: [{ name: 'Fade' }] });
  assert.deepEqual(f.folk.map((x) => x.rooms || null), [['fade'], null]);
  assert.deepEqual(f.folk.map((x) => x.role || null), ['Master barber', null], 'a role is a short, tidy label');
  // a template never picks the world
  assert.equal(fromTemplate('chores').skin, 'space');
  // the mode follows the rooms unless it is chosen
  assert.equal(normalizeConfig({ rooms: [{ base: CATALOG[0].id }] }).mode, 'agents');
  assert.equal(normalizeConfig({ rooms: [{ name: 'Fade' }] }).mode, 'service');
  // templates start in their own mode and skin, and both can be overridden
  assert.deepEqual([fromTemplate('chores').mode, fromTemplate('chores').skin], ['allowance', 'space']);
  assert.deepEqual([fromTemplate('paths').mode, fromTemplate('barber').mode], ['agents', 'service']);
  assert.equal(fromTemplate('barber', { skin: 'cyber' }).skin, 'cyber');
  assert.equal(catalogFrom(c)[0].looks.castle, 'crypt');
});

test('ledger: an allowance chore names its kid, a payout names who was paid', () => {
  const ok = { kind: 'money.in', usd: 1, path: 'dishes', source: 'Emma', evidence: 'checked off by Mom' };
  assert.doesNotThrow(() => validate({ ...ok, kid: 'Emma' }));
  assert.doesNotThrow(() => validate({ ...ok, by: 'Dre' }));
  assert.throws(() => validate({ ...ok, by: '' }), /by must name/);
  assert.throws(() => validate({ ...ok, kid: '' }), /kid/);
  const pay = { kind: 'money.out', usd: 5, category: 'other', evidence: 'paid Emma cash' };
  assert.doesNotThrow(() => validate({ ...pay, payee: 'Emma' }));
  assert.throws(() => validate({ ...pay, payee: 'x'.repeat(41) }), /payee/);
});

test('allowance demo: labeled, kids earn by chore, Sunday payouts leave this week owed', () => {
  const { dir, ledger } = tmpLedger();
  seedAllowanceDemo(ledger, dir, Date.parse('2026-09-25T18:00:00Z'));
  assert.throws(() => seedAllowanceDemo(ledger, dir), /already has lines/);
  const info = stationInfo(dir);
  assert.deepEqual([info.mode, info.skin, info.kids.map((k) => k.name)], ['allowance', 'farm', ['Emma', 'Liam', 'Ava']]);
  const st = reduce(ledger.readAll(), loadCatalog(dir));
  assert.ok(st.demo);
  assert.ok(st.moneyIn.every((e) => e.kid && e.by === e.kid && e.item));
  const paid = st.moneyOut.filter((e) => e.payee).reduce((s, e) => s + e.usd, 0);
  assert.ok(paid > 0 && paid < st.earnedUsd, 'some is paid out, this week is still owed');
  fs.rmSync(dir, { recursive: true, force: true });
});
