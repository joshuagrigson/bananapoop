// Fling Web relay: the phone and a laptop browser tab both connect out to this
// server, so nothing is installed on the laptop and any network works.
// The phone page uses the same API as the Windows app's receiver.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT) || 10000;
const KEY = process.env.FLING_KEY || '';
const STORE = process.env.FLING_STORE || path.join(os.tmpdir(), 'fling-relay');
const PHONE_DIR = path.join(__dirname, '..', 'phone');
const DESK_DIR = path.join(__dirname, 'public');
const MAX_CHUNK = 64 * 1024 * 1024;
const MAX_TEXT = 1024 * 1024;
const KEEP_MS = 24 * 60 * 60 * 1000; // files nobody picked up are deleted after a day

if (KEY.length < 16) {
  console.error('Set FLING_KEY (16+ characters) before starting.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function cleanName(name) {
  let n = String(name || 'file').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  n = n.replace(/^\.+/, '').slice(0, 180);
  return n || 'file';
}
function num(v, lo, hi, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too big')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}
const newId = () => crypto.randomBytes(9).toString('base64url');

fs.rmSync(STORE, { recursive: true, force: true });
fs.mkdirSync(STORE, { recursive: true });

// id -> { id, from, to, name, type, size, received, fy, vy, file, fd, done, created }
const transfers = new Map();
// texts waiting for a side that isn't connected yet
const pendingText = { desk: [], phone: [] };
const sockets = { desk: new Set(), phone: new Set() };

function send(role, msg) {
  const s = JSON.stringify(msg);
  for (const ws of sockets[role]) { try { ws.send(s); } catch {} }
}
function presence() {
  send('desk', { t: 'peers', phones: sockets.phone.size });
  send('phone', { t: 'peers', desks: sockets.desk.size });
}
function publicInfo(t) {
  return { id: t.id, name: t.name, type: t.type, size: t.size, fy: t.fy, vy: t.vy };
}
function dropTransfer(t) {
  try { if (t.fd != null) fs.closeSync(t.fd); } catch {}
  try { fs.unlinkSync(t.file); } catch {}
  transfers.delete(t.id);
}

setInterval(() => {
  const now = Date.now();
  for (const t of [...transfers.values()]) {
    if (!t.done && now - t.seen > 10 * 60 * 1000) { dropTransfer(t); send(t.to, { t: 'cancel', id: t.id }); }
    else if (t.done && now - t.created > KEEP_MS) dropTransfer(t);
  }
}, 60 * 1000).unref();

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
function serveStatic(res, dir, rel) {
  const file = path.resolve(dir, rel);
  if (!file.startsWith(path.resolve(dir) + path.sep)) return json(res, 403, { error: 'no' });
  serveFile(res, file);
}
function originOf(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${req.headers.host}`;
}

async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/healthz') return json(res, 200, { ok: true });
  if (p === '/desk' || p === '/desk/') return serveFile(res, path.join(DESK_DIR, 'desk.html'));
  if (p.startsWith('/desk/')) return serveStatic(res, DESK_DIR, decodeURIComponent(p.slice('/desk/'.length)));
  if (!p.startsWith('/api/')) return serveStatic(res, PHONE_DIR, p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, ''));

  if (!safeEqual(url.searchParams.get('k'), KEY)) return json(res, 401, { error: 'not paired' });

  if (p === '/api/info') return json(res, 200, { ok: true, name: 'your laptop', desks: sockets.desk.size, phones: sockets.phone.size });

  if (p === '/api/qr.svg') {
    const target = `${originOf(req)}/#k=${encodeURIComponent(KEY)}`;
    const svg = await QRCode.toString(target, { type: 'svg', margin: 1, color: { dark: '#0b0b12', light: '#ffffff' } });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
    return res.end(svg);
  }

  if (p === '/api/begin' && req.method === 'POST') {
    const meta = JSON.parse((await readBody(req, 8192)).toString('utf8') || '{}');
    const to = meta.to === 'phone' ? 'phone' : 'desk';
    const id = newId();
    const t = {
      id, to, from: to === 'desk' ? 'phone' : 'desk',
      name: cleanName(meta.name), type: String(meta.type || 'application/octet-stream').slice(0, 100),
      size: num(meta.size, 0, 1e13, 0), received: 0,
      fy: num(meta.fy, 0, 1, 0.5), vy: num(meta.vy, -10, 10, 0),
      file: path.join(STORE, id), done: false, created: Date.now(), seen: Date.now(),
    };
    t.fd = fs.openSync(t.file, 'w');
    transfers.set(id, t);
    if (to === 'desk') send('desk', { t: 'incoming', ...publicInfo(t) });
    return json(res, 200, { ok: true, id, waiting: sockets[to].size === 0 });
  }

  if (p === '/api/chunk' && req.method === 'PUT') {
    const t = transfers.get(url.searchParams.get('id'));
    if (!t || t.done) return json(res, 404, { error: 'unknown upload' });
    const offset = Number(url.searchParams.get('offset'));
    if (offset !== t.received) return json(res, 409, { error: 'offset', received: t.received });
    const buf = await readBody(req, MAX_CHUNK);
    fs.writeSync(t.fd, buf, 0, buf.length, offset);
    t.received += buf.length;
    t.seen = Date.now();
    if (t.to === 'desk') send('desk', { t: 'progress', id: t.id, received: t.received, size: t.size });
    return json(res, 200, { ok: true, received: t.received });
  }

  if (p === '/api/end' && req.method === 'POST') {
    const t = transfers.get(url.searchParams.get('id'));
    if (!t) return json(res, 404, { error: 'unknown upload' });
    if (!t.done) {
      fs.closeSync(t.fd);
      t.fd = null;
      t.done = true;
      t.size = t.received;
      t.created = Date.now();
      send(t.to, t.to === 'desk' ? { t: 'arrive', ...publicInfo(t) } : { t: 'offer', ...publicInfo(t) });
    }
    return json(res, 200, { ok: true, waiting: sockets[t.to].size === 0 });
  }

  if (p === '/api/cancel' && req.method === 'POST') {
    const t = transfers.get(url.searchParams.get('id'));
    if (t) { dropTransfer(t); send(t.to, { t: 'cancel', id: t.id }); }
    return json(res, 200, { ok: true });
  }

  if (p === '/api/text' && req.method === 'POST') {
    const meta = JSON.parse((await readBody(req, MAX_TEXT + 8192)).toString('utf8') || '{}');
    const text = String(meta.text || '').slice(0, MAX_TEXT);
    if (!text.trim()) return json(res, 400, { error: 'empty' });
    const to = meta.to === 'phone' ? 'phone' : 'desk';
    const msg = { t: 'text', id: newId(), text, fy: num(meta.fy, 0, 1, 0.5), vy: num(meta.vy, -10, 10, 0) };
    if (sockets[to].size) send(to, msg); else pendingText[to].push(msg);
    return json(res, 200, { ok: true, waiting: sockets[to].size === 0 });
  }

  if (p.startsWith('/api/dl/') && req.method === 'GET') {
    const t = transfers.get(p.slice('/api/dl/'.length));
    if (!t || !t.done) return json(res, 404, { error: 'gone' });
    const inline = url.searchParams.get('inline') === '1';
    res.writeHead(200, {
      'Content-Type': t.type || 'application/octet-stream',
      'Content-Length': t.size,
      'Cache-Control': 'no-store',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(t.name)}`,
    });
    fs.createReadStream(t.file).pipe(res);
    return;
  }

  if (p === '/api/got' && req.method === 'POST') {
    const t = transfers.get(url.searchParams.get('id'));
    if (t && t.done) { dropTransfer(t); send(t.from, { t: 'delivered', id: t.id }); }
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    if (!res.headersSent) json(res, 500, { error: String(err.message || err) });
    else res.destroy();
  });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || !safeEqual(url.searchParams.get('k'), KEY)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  const role = url.searchParams.get('role') === 'desk' ? 'desk' : 'phone';
  wss.handleUpgrade(req, socket, head, (ws) => {
    sockets[role].add(ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => { sockets[role].delete(ws); presence(); });
    ws.on('error', () => {});
    ws.send(JSON.stringify({ t: 'hello', name: role === 'phone' ? 'your laptop' : 'your phone' }));
    // Hand over anything that finished while this side was away.
    for (const t of transfers.values()) {
      if (t.done && t.to === role) ws.send(JSON.stringify(role === 'desk' ? { t: 'arrive', ...publicInfo(t) } : { t: 'offer', ...publicInfo(t) }));
    }
    for (const m of pendingText[role].splice(0)) ws.send(JSON.stringify(m));
    presence();
  });
});

// Keep sockets honest; Render also drops idle connections, so ping often.
setInterval(() => {
  for (const set of Object.values(sockets)) {
    for (const ws of set) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }
}, 25000).unref();

server.listen(PORT, '0.0.0.0', () => console.log(`Fling relay on :${PORT}`));
