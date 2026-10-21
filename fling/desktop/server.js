// Fling local server: serves the phone page, takes chunked uploads from the
// phone, and offers laptop files back to the phone over a WebSocket.
// Plain Node (no Electron imports) so it can be tested on its own.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { WebSocketServer } = require('ws');

const MAX_CHUNK = 64 * 1024 * 1024; // phone sends 8 MB; anything past this is refused
const MAX_TEXT = 1024 * 1024;

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Keep the name readable but strip anything Windows won't accept.
function cleanName(name) {
  let n = String(name || 'file').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  n = n.replace(/^\.+/, '').slice(0, 180);
  return n || 'file';
}

function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}

function guessType(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.heic': 'image/heic', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] || 'application/octet-stream';
}

function num(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
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

class FlingServer extends EventEmitter {
  constructor({ port, token, inboxDir, phoneDir, deviceName }) {
    super();
    this.port = port;
    this.token = token;
    this.inboxDir = inboxDir;
    this.phoneDir = phoneDir;
    this.deviceName = deviceName;
    this.uploads = new Map(); // id -> { fd, path, name, type, size, received, fy, vy }
    this.offers = new Map(); // id -> { path, name, type, size }
    this.phones = new Set();
  }

  start() {
    fs.mkdirSync(this.inboxDir, { recursive: true });
    this.http = http.createServer((req, res) => {
      this.route(req, res).catch((err) => {
        if (!res.headersSent) json(res, 500, { error: String(err.message || err) });
        else res.destroy();
      });
    });
    // A phone that walks away mid-upload leaves a half file; clear it after 10 idle minutes.
    this.sweeper = setInterval(() => {
      for (const up of [...this.uploads.values()]) {
        if (Date.now() - up.seen > 10 * 60 * 1000) { this.dropUpload(up); this.emit('cancel', { id: up.id }); }
      }
    }, 60 * 1000);
    this.sweeper.unref();
    this.wss = new WebSocketServer({ noServer: true });
    this.http.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname !== '/ws' || !safeEqual(url.searchParams.get('k'), this.token)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.addPhone(ws));
    });
    return new Promise((resolve, reject) => {
      this.http.once('error', reject);
      this.http.listen(this.port, '0.0.0.0', () => resolve());
    });
  }

  stop() {
    clearInterval(this.sweeper);
    clearInterval(this.pinger);
    for (const ws of this.phones) ws.terminate();
    for (const up of this.uploads.values()) this.dropUpload(up);
    if (this.wss) this.wss.close();
    return new Promise((resolve) => (this.http ? this.http.close(() => resolve()) : resolve()));
  }

  addPhone(ws) {
    this.phones.add(ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => { this.phones.delete(ws); this.emit('phones', this.phones.size); });
    ws.on('error', () => {});
    ws.send(JSON.stringify({ t: 'hello', name: this.deviceName }));
    // Re-offer anything the laptop threw while the phone page was closed.
    for (const [id, o] of this.offers) ws.send(JSON.stringify({ t: 'offer', id, name: o.name, type: o.type, size: o.size }));
    this.emit('phones', this.phones.size);
    if (!this.pinger) {
      this.pinger = setInterval(() => {
        for (const p of this.phones) {
          if (!p.isAlive) { p.terminate(); continue; }
          p.isAlive = false;
          try { p.ping(); } catch {}
        }
      }, 15000);
      this.pinger.unref();
    }
  }

  // Laptop -> phone. Returns false when no phone is listening.
  offer(filePath) {
    let st;
    try { st = fs.statSync(filePath); } catch { return { ok: false, reason: 'missing' }; }
    if (!st.isFile()) return { ok: false, reason: 'not a file' };
    const id = crypto.randomBytes(9).toString('base64url');
    const o = { path: filePath, name: path.basename(filePath), type: guessType(filePath), size: st.size };
    this.offers.set(id, o);
    const msg = JSON.stringify({ t: 'offer', id, name: o.name, type: o.type, size: o.size });
    for (const ws of this.phones) ws.send(msg);
    return { ok: true, id, phones: this.phones.size };
  }

  offerText(text) {
    const msg = JSON.stringify({ t: 'text', text: String(text).slice(0, MAX_TEXT) });
    for (const ws of this.phones) ws.send(msg);
    return { ok: this.phones.size > 0 };
  }

  dropUpload(up) {
    try { fs.closeSync(up.fd); } catch {}
    try { fs.unlinkSync(up.path); } catch {}
    this.uploads.delete(up.id);
  }

  async route(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (!p.startsWith('/api/')) return this.serveStatic(p, res);
    if (!safeEqual(url.searchParams.get('k'), this.token)) return json(res, 401, { error: 'not paired' });

    if (p === '/api/info' && req.method === 'GET') {
      return json(res, 200, { ok: true, name: this.deviceName });
    }

    if (p === '/api/begin' && req.method === 'POST') {
      const meta = JSON.parse((await readBody(req, 8192)).toString('utf8') || '{}');
      const id = crypto.randomBytes(9).toString('base64url');
      const name = cleanName(meta.name);
      const file = uniquePath(this.inboxDir, name);
      const up = {
        id, path: file, name: path.basename(file),
        type: String(meta.type || guessType(file)).slice(0, 100),
        size: num(meta.size, 0, 1e13, 0), received: 0,
        fy: num(meta.fy, 0, 1, 0.5), vy: num(meta.vy, -10, 10, 0),
        fd: fs.openSync(file, 'w'), seen: Date.now(),
      };
      this.uploads.set(id, up);
      this.emit('incoming', { id, name: up.name, type: up.type, size: up.size, fy: up.fy, vy: up.vy });
      return json(res, 200, { ok: true, id });
    }

    if (p === '/api/chunk' && req.method === 'PUT') {
      const up = this.uploads.get(url.searchParams.get('id'));
      if (!up) return json(res, 404, { error: 'unknown upload' });
      const offset = Number(url.searchParams.get('offset'));
      if (offset !== up.received) return json(res, 409, { error: 'offset', received: up.received });
      const buf = await readBody(req, MAX_CHUNK);
      fs.writeSync(up.fd, buf, 0, buf.length, offset);
      up.received += buf.length;
      up.seen = Date.now();
      this.emit('progress', { id: up.id, received: up.received, size: up.size });
      return json(res, 200, { ok: true, received: up.received });
    }

    if (p === '/api/end' && req.method === 'POST') {
      const up = this.uploads.get(url.searchParams.get('id'));
      if (!up) return json(res, 404, { error: 'unknown upload' });
      fs.closeSync(up.fd);
      this.uploads.delete(up.id);
      this.emit('arrive', { id: up.id, path: up.path, name: up.name, type: up.type, size: up.received });
      return json(res, 200, { ok: true });
    }

    if (p === '/api/cancel' && req.method === 'POST') {
      const up = this.uploads.get(url.searchParams.get('id'));
      if (up) { this.dropUpload(up); this.emit('cancel', { id: up.id }); }
      return json(res, 200, { ok: true });
    }

    if (p === '/api/text' && req.method === 'POST') {
      const meta = JSON.parse((await readBody(req, MAX_TEXT + 8192)).toString('utf8') || '{}');
      const text = String(meta.text || '').slice(0, MAX_TEXT);
      if (!text.trim()) return json(res, 400, { error: 'empty' });
      this.emit('text', { id: crypto.randomBytes(9).toString('base64url'), text, fy: num(meta.fy, 0, 1, 0.5), vy: num(meta.vy, -10, 10, 0) });
      return json(res, 200, { ok: true });
    }

    if (p.startsWith('/api/dl/') && req.method === 'GET') {
      const o = this.offers.get(p.slice('/api/dl/'.length));
      if (!o) return json(res, 404, { error: 'gone' });
      let st;
      try { st = fs.statSync(o.path); } catch { return json(res, 404, { error: 'gone' }); }
      const inline = url.searchParams.get('inline') === '1';
      res.writeHead(200, {
        'Content-Type': o.type,
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(o.name)}`,
      });
      fs.createReadStream(o.path).pipe(res);
      return;
    }

    if (p === '/api/got' && req.method === 'POST') {
      const id = url.searchParams.get('id');
      if (this.offers.delete(id)) this.emit('delivered', { id });
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'not found' });
  }

  serveStatic(p, res) {
    const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
    const file = path.resolve(this.phoneDir, rel);
    if (!file.startsWith(path.resolve(this.phoneDir) + path.sep)) return json(res, 403, { error: 'no' });
    fs.readFile(file, (err, data) => {
      if (err) return json(res, 404, { error: 'not found' });
      res.writeHead(200, {
        'Content-Type': STATIC_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  }
}

module.exports = { FlingServer, cleanName, guessType };
