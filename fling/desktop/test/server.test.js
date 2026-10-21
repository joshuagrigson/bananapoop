// End-to-end check of the receiver: a fake phone uploads, sends text, and
// catches a file the laptop throws back. Run: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const { FlingServer, cleanName } = require('../server');

const PORT = 47000 + Math.floor(Math.random() * 900);
const TOKEN = 'test-token';
const base = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fling-'));
const inbox = path.join(tmp, 'inbox');
const phoneDir = path.join(__dirname, '..', '..', 'phone');

const q = (p, extra = '') => `${base}${p}?k=${TOKEN}${extra}`;

async function main() {
  const server = new FlingServer({ port: PORT, token: TOKEN, inboxDir: inbox, phoneDir, deviceName: 'TEST-PC' });
  const events = [];
  for (const ev of ['incoming', 'progress', 'arrive', 'cancel', 'text', 'delivered', 'phones']) server.on(ev, (d) => events.push([ev, d]));
  await server.start();

  // static phone page, no key needed; no path traversal
  let r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<title>Fling<\/title>/);
  r = await fetch(`${base}/..%2f..%2fserver.js`);
  assert.notEqual(r.status, 200);

  // wrong key refused
  r = await fetch(`${base}/api/info?k=nope`);
  assert.equal(r.status, 401);
  r = await fetch(q('/api/info'));
  assert.deepEqual(await r.json(), { ok: true, name: 'TEST-PC' });

  // chunked upload, with an out-of-order chunk rejected
  const data = crypto.randomBytes(3 * 1024 * 1024 + 123);
  r = await fetch(q('/api/begin'), { method: 'POST', body: JSON.stringify({ name: 'IMG/../bad:name.jpg', type: 'image/jpeg', size: data.length, fy: 0.3, vy: -1 }) });
  const { id } = await r.json();
  assert.ok(id);
  const half = 2 * 1024 * 1024;
  r = await fetch(q('/api/chunk', `&id=${id}&offset=5`), { method: 'PUT', body: data.subarray(0, 10) });
  assert.equal(r.status, 409);
  r = await fetch(q('/api/chunk', `&id=${id}&offset=0`), { method: 'PUT', body: data.subarray(0, half) });
  assert.equal((await r.json()).received, half);
  r = await fetch(q('/api/chunk', `&id=${id}&offset=${half}`), { method: 'PUT', body: data.subarray(half) });
  assert.equal((await r.json()).received, data.length);
  r = await fetch(q('/api/end', `&id=${id}`), { method: 'POST' });
  assert.equal(r.status, 200);
  const arrive = events.find(([e]) => e === 'arrive')[1];
  assert.equal(path.dirname(arrive.path), inbox);
  assert.equal(arrive.name, 'IMG_.._bad_name.jpg');
  assert.ok(fs.readFileSync(arrive.path).equals(data), 'file bytes match');
  const incoming = events.find(([e]) => e === 'incoming')[1];
  assert.equal(incoming.fy, 0.3);

  // same name again gets a new file, not an overwrite
  r = await fetch(q('/api/begin'), { method: 'POST', body: JSON.stringify({ name: 'IMG/../bad:name.jpg', size: 0 }) });
  const id2 = (await r.json()).id;
  await fetch(q('/api/end', `&id=${id2}`), { method: 'POST' });
  assert.ok(fs.existsSync(path.join(inbox, 'IMG_.._bad_name (2).jpg')));

  // cancel removes the partial file
  r = await fetch(q('/api/begin'), { method: 'POST', body: JSON.stringify({ name: 'half.mov', size: 100 }) });
  const id3 = (await r.json()).id;
  await fetch(q('/api/chunk', `&id=${id3}&offset=0`), { method: 'PUT', body: Buffer.alloc(50) });
  await fetch(q('/api/cancel', `&id=${id3}`), { method: 'POST' });
  assert.ok(!fs.existsSync(path.join(inbox, 'half.mov')));

  // text
  r = await fetch(q('/api/text'), { method: 'POST', body: JSON.stringify({ text: 'https://example.com', fy: 0.5 }) });
  assert.equal(r.status, 200);
  assert.equal(events.find(([e]) => e === 'text')[1].text, 'https://example.com');

  // laptop -> phone: queued before the phone connects, delivered on connect
  const outFile = path.join(tmp, 'report.pdf');
  fs.writeFileSync(outFile, 'PDF-ish bytes');
  const offer = server.offer(outFile);
  assert.ok(offer.ok);
  assert.equal(offer.phones, 0);

  const bad = new WebSocket(`ws://127.0.0.1:${PORT}/ws?k=wrong`);
  await new Promise((res) => { bad.on('error', res); bad.on('unexpected-response', res); });

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?k=${TOKEN}`);
  const msgs = [];
  ws.on('message', (m) => msgs.push(JSON.parse(m)));
  await new Promise((res) => ws.on('open', res));
  await new Promise((res) => setTimeout(res, 150));
  assert.equal(msgs[0].t, 'hello');
  const o = msgs.find((m) => m.t === 'offer');
  assert.equal(o.name, 'report.pdf');
  assert.equal(o.type, 'application/pdf');
  r = await fetch(q(`/api/dl/${o.id}`));
  assert.equal(await r.text(), 'PDF-ish bytes');
  assert.match(r.headers.get('content-disposition'), /attachment/);
  await fetch(q('/api/got', `&id=${o.id}`), { method: 'POST' });
  assert.ok(events.some(([e, d]) => e === 'delivered' && d.id === o.id));
  assert.ok(server.offerText('hi').ok);
  await new Promise((res) => setTimeout(res, 100));
  assert.ok(msgs.some((m) => m.t === 'text' && m.text === 'hi'));

  ws.close();
  await server.stop();
  assert.equal(cleanName(''), 'file');
  assert.equal(cleanName('...hidden'), 'hidden');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('server tests passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
