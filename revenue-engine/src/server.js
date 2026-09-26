// Zero-dependency HTTP server: the station pages and the JSON API (api.js) on localhost.
// Binds to localhost by default. The page renders only what /api/state can prove from the ledger.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';
import { withFolkKit } from './folkkit.js';

export { snapshot, listOutbox, roomsInfo } from './api.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_HTML = fs.readFileSync(path.join(here, 'dashboard.html'), 'utf8');
const STATION_HTML = withFolkKit(fs.readFileSync(path.join(here, 'station.html'), 'utf8'));
const TERMINAL_HTML = fs.readFileSync(path.join(here, 'terminal.html'), 'utf8');

function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('body is not JSON')); }
    });
    req.on('error', reject);
  });
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

// Only answer requests addressed to this machine by name (blocks DNS-rebinding pages from reading the ledger), and only
// accept writes from this station's own pages (blocks any other website from spending money or logging fake revenue).
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
function hostName(h) { const s = String(h || '').toLowerCase(); return s.startsWith('[') ? s.slice(0, s.indexOf(']') + 1) : s.split(':')[0]; }
function guard(req, checkHost) {
  if (checkHost && !LOOPBACK.has(hostName(req.headers.host))) return 'this station only answers on localhost';
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin !== undefined) {
    let ok = false;
    try { ok = new URL(req.headers.origin).host === String(req.headers.host || ''); } catch { ok = false; }
    if (!ok) return 'writes are only accepted from the station\'s own pages';
  }
  return null;
}

// opts: see createApi in api.js (ledger, catalog, dataDir, runAgent, makeProvider, harvestImpl, fetchImpl), plus checkHost.
export function createServer({ checkHost = true, ...opts }) {
  const handle = createApi(opts);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const refused = guard(req, checkHost);
    if (refused) return send(res, 403, { ok: false, error: refused });
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, STATION_HTML, 'text/html');
    if (req.method === 'GET' && url.pathname === '/terminal') return send(res, 200, TERMINAL_HTML, 'text/html');
    if (req.method === 'GET' && url.pathname === '/ledger') return send(res, 200, LEDGER_HTML, 'text/html');
    const r = await handle(req.method, url.pathname, (limit) => readJson(req, limit));
    return send(res, r.code, r.body);
  });
}
