// Builds a static, click-around preview of the Revenue Station from labeled demo data.
// Output: preview/ with the station (/), the production terminal (/terminal/), the money dashboard (/ledger/),
// and frozen copies of every GET endpoint under /api/. A second station, a barbershop built from custom service
// rooms with Square sales split by service, lives under /barber/ with its own pages and endpoints, and a third, a
// family allowance tracker on the farm skin, lives under /family/. Every page takes ?skin=castle (or farm, cyber, alien,
// ocean, space) to show the same data in another world. Any POST (dispatch, log, add client) is answered by a
// shim with "preview only", so nothing in the preview can spend money or pretend to act.
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

const SHIM = `<script>(() => {
  const real = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    if (opts.method && opts.method.toUpperCase() !== 'GET') {
      return Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'Preview only: this page runs on demo data. Run the station on your computer to take real actions.' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    }
    return real(url, opts);
  };
})();</script>`;
const BANNER = '<div style="background:#1d2a4d;color:#cfe0ff;padding:6px 16px;font:12px ui-monospace,Menlo,Consolas,monospace;border-bottom:1px solid #2c3f73">PREVIEW: a look-only copy on demo data. Buttons are switched off. The real station runs on your computer with your own ledger.</div>';

const page = (file) => fs.readFileSync(path.join(root, 'src', file), 'utf8')
  .replace('<head>', '<head>\n' + SHIM)
  .replace(/<body>/, '<body>\n' + BANNER);
// the same pages, re-pointed at a second station's endpoints and links under /barber/ or /family/
const subPage = (dir, file) => page(file)
  .replace(/(['"`])\/api\//g, `$1/${dir}/api/`)
  .replace(/href="\/"/g, `href="/${dir}/"`).replace(/href="\/terminal"/g, `href="/${dir}/terminal/"`).replace(/href="\/ledger"/g, `href="/${dir}/ledger/"`);

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

write('_headers', ['/api/*', '/barber/api/*', '/family/api/*'].map((p) => `${p}\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n`).join(''));
fs.rmSync(data, { recursive: true, force: true });
fs.rmSync(bdata, { recursive: true, force: true });
fs.rmSync(fdata, { recursive: true, force: true });
console.log(`preview built in ${out}`);
