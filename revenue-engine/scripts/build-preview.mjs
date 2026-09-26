// Builds a click-around preview of Proxyfolk from labeled demo data.
// Output: preview/ with the station (/), the production terminal (/terminal/), the money dashboard (/ledger/),
// and frozen copies of every GET endpoint under /api/. A second station, a barbershop built from custom service
// rooms with Square sales split by service, lives under /barber/ with its own pages and endpoints, and a third, a
// family allowance tracker on the farm skin, lives under /family/. Every page takes ?skin=castle (or farm, cyber, alien,
// ocean, space) to show the same data in another world.
//
// Every button works: each page boots the real engine (src/api.js and everything it uses) inside the browser over an
// in-memory disk kept in localStorage (src/mock/), seeds the same demo, and answers the page's own /api/ calls. Income
// links sync from pretend Stripe/Square/PayPal/Gumroad, agents replay scripted work, and nothing ever leaves the
// browser. If the engine cannot start (a very old browser), the page falls back to the frozen endpoints, look-only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger } from '../src/ledger.js';
import { seedDemo, seedBarberDemo, seedAllowanceDemo } from '../src/demo.js';
import { snapshot, listOutbox, roomsInfo } from '../src/server.js';
import { loadCatalog } from '../src/rooms.js';
import { CATALOG } from '../src/paths.js';
import { listItems } from '../src/inbox.js';
import { listClients, isDue } from '../src/clients.js';
import { connectorSpecs, CSV_SOURCES, listConnections } from '../src/sync.js';
import { withFolkKit } from '../src/folkkit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'preview');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'station-preview-'));
const ledger = new Ledger(path.join(data, 'ledger.jsonl'));
seedDemo(ledger, data);
// Two more crew members on the job so the preview shows agents at work (still demo data, still labeled).
const now = new Date().toISOString();
ledger.append({ kind: 'agent.run.start', runId: 'run_demo_5', path: 'gbp-management', role: 'auditor', model: 'claude-sonnet-5', maxUsd: 1, jobId: 'job_demo_audit', ts: now });
ledger.append({ kind: 'agent.run.start', runId: 'run_demo_6', path: 'freelance-desk', role: 'scout', model: 'claude-sonnet-5', maxUsd: 0.5, jobId: 'job_demo_scout', ts: now });

const inbox = {};
const clients = {};
for (const p of CATALOG) {
  const pending = listItems(data, p.id);
  const done = listItems(data, p.id, { status: 'done' });
  if (pending.length || done.length) inbox[p.id] = { pending, done };
  const cl = listClients(data, p.id);
  if (cl.length) clients[p.id] = cl.map((c) => ({ ...c, due: isDue(c) }));
}

// the engine files the browser runs, and the stand-ins for the Node built-ins they import
const ENGINE = ['api.js', 'ledger.js', 'reduce.js', 'quests.js', 'level.js', 'paths.js', 'rooms.js', 'inbox.js', 'clients.js', 'sync.js', 'agent.js', 'cost.js', 'demo.js', 'harvest.js', 'scheduler.js'];
const MOCK = ['fs.js', 'path.js', 'crypto.js', 'sdk-tool.js', 'services.js', 'station.js'];
const IMPORTS = { 'node:fs': '/engine/mock/fs.js', 'node:path': '/engine/mock/path.js', 'node:crypto': '/engine/mock/crypto.js', '@anthropic-ai/sdk/helpers/beta/json-schema': '/engine/mock/sdk-tool.js' };
const shim = (station, prefix) => `<script type="importmap">${JSON.stringify({ imports: IMPORTS })}</script>
<script>(() => {
  const M = window.__PF_MOCK = { station: ${JSON.stringify(station)}, prefix: ${JSON.stringify(prefix)} };
  const real = window.fetch.bind(window);
  let done;
  const ready = new Promise((r) => { done = r; });
  M.ready = (route) => { done(route || null); const b = document.getElementById('pfAuto'); if (b && route) b.textContent = 'Autopilot: ' + (M.auto ? 'on' : 'off'); };
  setTimeout(() => done(null), 8000);
  window.addEventListener('error', (e) => { if (String(e.filename || '').includes('/engine/')) done(null); });
  const base = M.prefix + '/api/';
  const lookOnly = (u, opts) => ((opts.method || 'GET').toUpperCase() !== 'GET'
    ? Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'This browser could not start the mock engine, so the preview is look-only here.' }), { status: 403, headers: { 'content-type': 'application/json' } }))
    : real(u.href, opts));
  window.fetch = (url, opts = {}) => {
    let u;
    try { u = new URL(String((url && url.url) || url), location.href); } catch { return real(url, opts); }
    if (u.origin !== location.origin || !u.pathname.startsWith(base)) return real(url, opts);
    return ready.then((route) => (route ? route(u, opts) : lookOnly(u, opts)));
  };
})();</script>
<script type="module" src="/engine/mock/station.js" onerror="window.__PF_MOCK.ready(null)"></script>`;
const BANNER = `<div id="pfMockBar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#1d2a4d;color:#cfe0ff;padding:5px 12px;font:12px/1.3 ui-monospace,Menlo,Consolas,monospace;border-bottom:1px solid #2c3f73;position:relative;z-index:50">
<style>#pfMockBar .s{display:none}@media (max-width:900px){#pfMockBar{position:fixed!important;top:0;left:0;right:0;z-index:100!important;padding:4px 8px!important;gap:6px!important;font-size:10.5px!important;flex-wrap:nowrap!important}#pfMockBar .l{display:none}#pfMockBar .s{display:inline}#pfMockBar button,#pfDev{padding:3px 7px!important}}</style>
<b style="color:#ffd84d">MOCK</b><span class="l" style="flex:1;min-width:220px">Every button works here, on made-up data saved only in this browser. Nothing is sent anywhere: income links sync from pretend Stripe and Square, and agents replay scripted work.</span><span class="s" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Everything works · made-up data</span>
<a id="pfDev" href="/devices/" target="_top" title="See this demo on an iPhone, Android, tablet and PC side by side" style="color:#ffd84d;text-decoration:none;border:1px solid #4a64a8;border-radius:6px;padding:3px 9px;white-space:nowrap"><span class="l">Phone · tablet · PC</span><span class="s">Devices</span></a><script>if(top!==self)document.getElementById('pfDev').remove()</script>
<button id="pfAuto" type="button" onclick="if(window.__PF_MOCK.autopilot)this.textContent='Autopilot: '+(window.__PF_MOCK.autopilot()?'on':'off')" title="Scheduled agents, income syncs and chores happen on their own, as on a real station" style="font:inherit;background:#2c3f73;color:#fff;border:1px solid #4a64a8;border-radius:6px;padding:3px 9px;cursor:pointer">Autopilot: on</button>
<button type="button" onclick="if(window.__PF_MOCK.reset&&confirm('Put the demo back the way it started? Everything you tried here is cleared.'))window.__PF_MOCK.reset()" style="font:inherit;background:#2c3f73;color:#fff;border:1px solid #4a64a8;border-radius:6px;padding:3px 9px;cursor:pointer">Reset demo</button></div>`;

const raw = (file) => withFolkKit(fs.readFileSync(path.join(root, 'src', file), 'utf8'));
// the mock goes in last, after any re-pointing, so its own /api/ matcher is never rewritten
const withMock = (html, station, prefix) => html.replace('<head>', '<head>\n' + shim(station, prefix)).replace(/<body>/, '<body>\n' + BANNER);
const page = (file) => withMock(raw(file), 'paths', '');
// the same pages, re-pointed at a second station's endpoints and links under /barber/ or /family/
const subPage = (dir, file) => withMock(raw(file)
  .replace(/(['"`])\/api\//g, `$1/${dir}/api/`)
  .replace(/href="\/"/g, `href="/${dir}/"`).replace(/href="\/terminal"/g, `href="/${dir}/terminal/"`).replace(/href="\/ledger"/g, `href="/${dir}/ledger/"`), dir, '/' + dir);

fs.rmSync(out, { recursive: true, force: true });
const write = (rel, body) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
write('index.html', page('station.html'));
write('terminal/index.html', page('terminal.html'));
write('ledger/index.html', page('dashboard.html'));
write('api/state', JSON.stringify(snapshot(ledger, CATALOG, data)));
write('api/outbox', JSON.stringify(listOutbox(data, CATALOG)));
write('api/inbox', JSON.stringify(inbox));
write('api/clients', JSON.stringify(clients));
write('api/runs', '[]');
write('api/connections', JSON.stringify({ connectors: connectorSpecs(), csvSources: CSV_SOURCES, connections: listConnections(data), syncing: false }));
write('api/rooms', JSON.stringify(roomsInfo(ledger, CATALOG, data)));

// ---- the barbershop station
const bdata = fs.mkdtempSync(path.join(os.tmpdir(), 'station-barber-'));
const bledger = new Ledger(path.join(bdata, 'ledger.jsonl'));
seedBarberDemo(bledger, bdata);
const bcat = loadCatalog(bdata);
write('barber/index.html', subPage('barber', 'station.html'));
write('barber/terminal/index.html', subPage('barber', 'terminal.html'));
write('barber/ledger/index.html', subPage('barber', 'dashboard.html'));
write('barber/api/state', JSON.stringify(snapshot(bledger, bcat, bdata)));
write('barber/api/outbox', JSON.stringify(listOutbox(bdata, bcat)));
write('barber/api/inbox', '{}');
write('barber/api/clients', '{}');
write('barber/api/runs', '[]');
write('barber/api/connections', JSON.stringify({ connectors: connectorSpecs(), csvSources: CSV_SOURCES, connections: listConnections(bdata), syncing: false }));
write('barber/api/rooms', JSON.stringify(roomsInfo(bledger, bcat, bdata)));

// ---- the family allowance tracker: chores are rooms, kids earn, payouts zero their balance
const fdata = fs.mkdtempSync(path.join(os.tmpdir(), 'station-family-'));
const fledger = new Ledger(path.join(fdata, 'ledger.jsonl'));
seedAllowanceDemo(fledger, fdata);
const fcat = loadCatalog(fdata);
write('family/index.html', subPage('family', 'station.html'));
write('family/terminal/index.html', subPage('family', 'terminal.html'));
write('family/ledger/index.html', subPage('family', 'dashboard.html'));
write('family/api/state', JSON.stringify(snapshot(fledger, fcat, fdata)));
write('family/api/outbox', JSON.stringify(listOutbox(fdata, fcat)));
write('family/api/inbox', '{}');
write('family/api/clients', '{}');
write('family/api/runs', '[]');
write('family/api/connections', JSON.stringify({ connectors: connectorSpecs(), csvSources: CSV_SOURCES, connections: listConnections(fdata), syncing: false }));
write('family/api/rooms', JSON.stringify(roomsInfo(fledger, fcat, fdata)));

// the same demo inside real phone, tablet and PC frames, side by side
write('devices/index.html', raw('devices.html'));

for (const f of ENGINE) write('engine/' + f, raw(f));
for (const f of MOCK) write('engine/mock/' + f, raw('mock/' + f));

write('_headers', ['/api/*', '/barber/api/*', '/family/api/*'].map((p) => `${p}\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n`).join('') + '/engine/*\n  Cache-Control: no-cache\n');
fs.rmSync(data, { recursive: true, force: true });
fs.rmSync(bdata, { recursive: true, force: true });
fs.rmSync(fdata, { recursive: true, force: true });
console.log(`preview built in ${out}`);
