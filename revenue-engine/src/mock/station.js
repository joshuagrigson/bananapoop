// The preview's mock station: the real engine (api.js, the ledger, rooms, sync, agents, scheduler) running inside the
// page over an in-memory disk kept in this browser's localStorage. Every button works and goes through the same rules
// a real station applies; only the outside world is pretend (services.js) and agents replay scripted work instead of
// calling a model. Nothing typed here leaves the browser. Reset puts the demo back.
import fs, { mount, wipe, flush, bytes } from 'node:fs';
import { Ledger } from '../ledger.js';
import { createApi } from '../api.js';
import { runAgent } from '../agent.js';
import { createScheduler } from '../scheduler.js';
import { harvest } from '../harvest.js';
import { listItems } from '../inbox.js';
import { dueClients } from '../clients.js';
import { reduce } from '../reduce.js';
import { loadCatalog, roomForItem } from '../rooms.js';
import { syncAll } from '../sync.js';
import { seedDemo, seedBarberDemo, seedAllowanceDemo } from '../demo.js';
import { makeServices } from './services.js';

const CFG = window.__PF_MOCK || {};
const STATION = CFG.station || 'paths';
const PREFIX = CFG.prefix || '';
const KEY = `proxyfolk-mock:${STATION}:v1`;
const LIVEKEY = `proxyfolk-mock-live:${STATION}`;
const DATA = '/data';
const META = DATA + '/.mock.json';

// PayPal's basic auth is the one place the engine reaches for Buffer
if (!globalThis.Buffer) globalThis.Buffer = { from: (s) => ({ toString: (enc) => (enc === 'base64' ? btoa(unescape(encodeURIComponent(String(s)))) : String(s)) }) };

const readMeta = () => { try { return JSON.parse(fs.readFileSync(META, 'utf8')); } catch { return { born: Date.now(), spans: [] }; } };
const writeMeta = (m) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(META, JSON.stringify(m)); };

let ledger;
function boot() {
  const found = mount(KEY);
  ledger = new Ledger(DATA + '/ledger.jsonl');
  if (!found || !ledger.readAll().length) {
    wipe(); mount(KEY);
    ledger = new Ledger(DATA + '/ledger.jsonl');
    const now = Date.now();
    if (STATION === 'barber') seedBarberDemo(ledger, DATA, now);
    else if (STATION === 'family') seedAllowanceDemo(ledger, DATA, now);
    else seedDemo(ledger, DATA, now);
    // the demo's income link becomes a mock one that really syncs (new sales only; the history is already seeded)
    try {
      const conns = JSON.parse(fs.readFileSync(DATA + '/connections.json', 'utf8'));
      const live = conns.map((c) => ({ ...c, demo: false, label: c.label || 'DEMO', cursor: new Date(now).toISOString(), secret: c.kind === 'square' ? { token: 'EAAAdemoliveMOCK00000000' } : c.kind === 'stripe' ? { apiKey: 'rk_live_demoliveMOCK0000' } : c.secret }));
      fs.writeFileSync(DATA + '/connections.json', JSON.stringify(live, null, 2));
    } catch { /* this demo has no income link */ }
    writeMeta({ born: now, spans: [] });
    flush();
  }
}
boot();

// this page's open window counts as live time: sales arrive every few minutes while any mock page is open
const session = Date.now();
function spans() {
  const m = readMeta();
  const s = (m.spans || []).filter(([a, b]) => b > a);
  const last = s[s.length - 1];
  if (last && session - last[1] < 5 * 60e3) last[1] = Math.max(last[1], Date.now());
  else if (!last || last[0] !== session) s.push([session, Date.now()]);
  m.spans = s.slice(-40);
  writeMeta(m);
  return m.spans;
}
function items() {
  const cat = loadCatalog(DATA);
  const svc = cat.filter((r) => r.match && r.match.length && r.priceUsd > 0);
  if (svc.length) return svc.map((r) => ({ name: roomForItem(r.name, cat) === r.id ? r.name : r.match[0].replace(/\b\w/g, (c) => c.toUpperCase()), usd: r.priceUsd }));
  return [{ name: 'Google profile care (monthly)', usd: 199 }, { name: 'Profile audit', usd: 79 }, { name: 'Lead list (50 businesses)', usd: 120 }, { name: 'Review booster setup', usd: 149 }];
}
const services = makeServices({ getSpans: spans, getItems: items });

// ---------------------------------------------------------------------------------------------- scripted agent work
const CITIES = ['Austin', 'Round Rock', 'Georgetown', 'Cedar Park', 'Pflugerville', 'Kyle'];
const BIZ = ['Bluebonnet Nails', 'Cedar Hollow Barbers', 'Pecan Street Pets', 'Lone Oak Dental', 'Riverbend Lash', 'Mesquite Auto', 'Hill Country Brows', 'Barton Day Spa', 'Live Oak Groomers', 'Sunset Ridge Salon'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'item';
const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const step = (waitMs, calls = [], text = '') => ({ waitMs, calls, text, usage: { input_tokens: 2400 + Math.floor(Math.random() * 1800), output_tokens: 300 + Math.floor(Math.random() * 500) } });
const note = (filename, lines) => ({ name: 'write_note', input: { filename, content: ['> DEMO: written by a mock agent run in the preview. Fictional.', '', ...lines].join('\n') } });

function scriptFor(role, pathId) {
  const w = () => 1600 + Math.random() * 1800;
  const s = [step(w(), [{ name: 'read_path', input: {} }], 'Reading the path, its constraints and what is already logged.')];
  const finish = (text) => { s.push(step(w(), [], text)); return s; };
  if (role === 'prospector') {
    const found = pickN(BIZ, 3).map((b) => ({ b, c: CITIES[Math.floor(Math.random() * CITIES.length)] }));
    for (const { b, c } of found) s.push(step(w(), [{ name: 'log_outcome', input: { stage: 'prospect', ref: `${b} (${c}, TX) (demo)`, evidence: `https://example.com/demo/${slug(b)}`, note: `${c}, TX · fits the path · contact form on site (demo)` } }]));
    s.push(step(w(), [note('prospects.md', ['# Prospects (demo)', '', ...found.map(({ b, c }) => `- **${b}**, ${c} TX: open with their missing hours on Google.`)])]));
    return finish(`Logged ${found.length} prospects and wrote prospects.md.`);
  }
  if (role === 'auditor' || role === 'scout' || role === 'fulfiller') {
    const type = role === 'auditor' ? 'lead' : role === 'scout' ? 'post' : 'job';
    const todo = listItems(DATA, pathId, { type }).slice(0, 2);
    s.push(step(w(), [{ name: 'read_inbox', input: {} }]));
    for (const it of todo) {
      const name = String(it.title || it.text || 'item').replace(/^DEMO POST\.\s*/, '').slice(0, 60);
      const calls = [];
      if (role === 'auditor') calls.push(note(`audit-${slug(name)}.md`, [`# Google profile audit: ${name}`, '', '| Check | Found |', '|---|---|', '| Profile | not seen |', '| Reviews | 3 (4.3★) |', '| Hours | missing |', '', '## 3 fixes', '1. Claim and verify the profile.', '2. Add hours and 10 photos.', '3. Ask the last 20 customers for a review.']));
      if (role === 'fulfiller') calls.push(note(`deliverable-${slug(name)}.md`, [`# Deliverable draft: ${name}`, '', 'First pass, ready for the operator to check and send.']));
      if (role === 'scout') calls.push(note(`proposal-${slug(name)}.md`, [`# Proposal: ${name}`, '', 'Score 8/10. Clear scope, verified payment. Draft proposal below for the operator to send.']));
      if (role !== 'fulfiller') calls.push({ name: 'log_outcome', input: { stage: 'prospect', ref: `${name} (demo)`, evidence: /^https?:/.test(it.url || '') ? it.url : `https://example.com/demo/${slug(name)}` } });
      calls.push({ name: 'mark_done', input: { id: it.id, verdict: role === 'auditor' ? 'weak profile, audit written (demo)' : role === 'scout' ? '8/10, proposal drafted (demo)' : 'drafted (demo)' } });
      s.push(step(w(), calls));
    }
    return finish(`Worked ${todo.length} inbox item${todo.length === 1 ? '' : 's'}.`);
  }
  if (role === 'manager') {
    const due = dueClients(DATA, pathId).slice(0, 2);
    s.push(step(w(), [{ name: 'read_clients', input: {} }]));
    for (const c of due) s.push(step(w(), [note(`pack-${slug(c.name || c.id)}.md`, [`# Monthly pack: ${c.name || c.id}`, '', '- 4 Google posts drafted', '- 2 review replies drafted', '- Q&A answer drafted']), { name: 'mark_packed', input: { id: c.id, summary: '4 posts, 2 review replies, 1 Q&A (demo)' } }]));
    return finish(`Packed ${due.length} client${due.length === 1 ? '' : 's'}.`);
  }
  if (role === 'creator') {
    const topics = pickN(['Missed calls cost salons more than rent', 'Three Google fixes a new shop can do tonight', 'What a chair-hour is really worth', 'Why reviews beat ads for walk-ins'], 2);
    for (const t of topics) s.push(step(w(), [note(`post-${slug(t)}.md`, [`# ${t}`, '', 'Platform: LinkedIn (text post).', `Hook: ${t}.`, '', '[your real example here]', '', 'CTA: reply "audit" for a free 2-minute video audit.'])]));
    s.push(step(w(), [note('post-index.md', ['# Posts (demo)', ...topics.map((t) => `- post-${slug(t)}.md · LinkedIn · ${t}`)])]));
    return finish('Wrote 2 ready-to-post packages and an index.');
  }
  if (role === 'outreach') {
    s.push(step(w(), [note('outreach-index.md', ['# Outreach drafts (demo)', '', '- One first-touch message per logged prospect. You send them; agents never do.'])]));
    return finish('Drafted outreach for the logged prospects.');
  }
  s.push(step(w(), [note(`${role}-${Date.now().toString(36)}.md`, [`# ${role} draft (demo)`, '', 'A draft for the operator to review.'])]));
  return finish('Wrote a draft to the outbox.');
}
// the scheduler asks for a provider before it knows the job, so the script is chosen when the run starts
const makeProvider = async () => ({ kind: 'replay', mock: true, script: [] });
const running = new Set();
function mockRun(opts) {
  const provider = opts.provider && opts.provider.mock ? { kind: 'replay', script: scriptFor(opts.role, opts.pathId) } : opts.provider;
  const id = opts.runId || `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  running.add(id);
  beat();
  return runAgent({ ...opts, runId: id, provider }).finally(() => { running.delete(id); beat(); });
}
// heartbeat: which runs this page is carrying, so another tab never mistakes them for abandoned
function beat() {
  try {
    const m = JSON.parse(localStorage.getItem(LIVEKEY) || '{}');
    const now = Date.now();
    for (const k of Object.keys(m)) if (now - m[k] > 15e3) delete m[k];
    for (const id of running) m[id] = now;
    localStorage.setItem(LIVEKEY, JSON.stringify(m));
  } catch { /* storage blocked */ }
}
// a run whose page was closed mid-work never finishes on its own: close it on the ledger, honestly labeled
function sweepAbandoned() {
  let live = {};
  try { live = JSON.parse(localStorage.getItem(LIVEKEY) || '{}'); } catch { live = {}; }
  const st = reduce(ledger.readAll(), loadCatalog(DATA));
  for (const r of st.running || []) {
    if (/^run_demo_/.test(r.runId) || running.has(r.runId) || (live[r.runId] && Date.now() - live[r.runId] < 15e3)) continue;
    if (Date.now() - Date.parse(r.startedAt || r.ts || 0) < 20e3) continue;
    ledger.append({ kind: 'agent.run.end', runId: r.runId, path: r.path, role: r.role, model: r.model || 'claude-sonnet-5', usd: 0, tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 }, iterations: 0, reason: 'error' });
    ledger.append({ kind: 'note', runId: r.runId, path: r.path, text: `run ${r.runId} stopped: the preview page running it was closed (demo)` });
  }
}

const handle = createApi({
  ledger, dataDir: DATA, runAgent: mockRun, makeProvider, fetchImpl: services,
  harvestImpl: (o) => harvest({ ...o, fetchImpl: services }),
});

// keys typed into the mock are scrubbed before they are stored: only the shape and last 4 characters survive
const scrub = (v) => (typeof v === 'string' && v.length > 12 && !v.startsWith('••••') ? v.slice(0, 8) + v.slice(8, -4).replace(/[^_]/g, 'x') + v.slice(-4) : v);

async function route(u, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const pathname = u.pathname.slice(PREFIX.length);
  let body = {};
  if (method !== 'GET' && init.body) { try { body = JSON.parse(init.body); } catch { body = null; } }
  if (body && pathname === '/api/connections' && body.secret) body = { ...body, secret: Object.fromEntries(Object.entries(body.secret).map(([k, v]) => [k, scrub(v)])) };
  const r = await handle(method, pathname, () => (body === null ? Promise.reject(new Error('body is not JSON')) : Promise.resolve(body)));
  if (method !== 'GET') flush();
  return new Response(JSON.stringify(r.body), { status: r.code, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

// ---------------------------------------------------------------------------------------------- autopilot
// What a real station does on its own: scheduled agents clock in, income links sync, and (on the family farm) kids
// finish chores. Off switch in the mock bar.
const sched = createScheduler({ ledger, runAgent: mockRun, makeProvider, dataDir: DATA, catalog: () => loadCatalog(DATA), dailyCapUsd: 5 });
let auto = true;
try { auto = localStorage.getItem('proxyfolk-mock-auto') !== 'off'; } catch { auto = true; }
async function chore() {
  const cat = loadCatalog(DATA);
  const folk = (() => { try { return JSON.parse(fs.readFileSync(DATA + '/rooms.json', 'utf8')).folk || []; } catch { return []; } })();
  const rooms = cat.filter((r) => r.priceUsd > 0);
  if (!folk.length || !rooms.length) return;
  const k = folk[Math.floor(Math.random() * folk.length)], r = rooms[Math.floor(Math.random() * rooms.length)];
  ledger.append({ kind: 'money.in', usd: r.priceUsd, path: r.id, source: k.name, by: k.name, kid: k.name, item: r.name, qty: 1, evidence: 'checked off in the mock (demo)' });
}
let ticks = 0;
async function autopilot() {
  beat();
  if (!auto) return;
  ticks++;
  try {
    await sched.tick();
    if (ticks % 3 === 1) await syncAll({ ledger, dataDir: DATA, fetchImpl: services });
    if (STATION === 'family' && ticks % 4 === 2) await chore();
    if (ticks % 3 === 0) sweepAbandoned();
  } catch (e) { console.warn('mock autopilot:', e.message); }
  flush();
}
setInterval(autopilot, 20e3);
setTimeout(autopilot, 3500);

// another mock tab changed the disk: pick it up
window.addEventListener('storage', (e) => { if (e.key === KEY && !running.size) { mount(KEY); ledger = new Ledger(DATA + '/ledger.jsonl'); } });
window.addEventListener('pagehide', flush);

Object.assign(CFG, {
  route,
  reset() { wipe(); try { localStorage.removeItem(LIVEKEY); } catch { /* ignore */ } location.reload(); },
  autopilot(on) { auto = on !== undefined ? Boolean(on) : !auto; try { localStorage.setItem('proxyfolk-mock-auto', auto ? 'on' : 'off'); } catch { /* ignore */ } return auto; },
  get auto() { return auto; },
  bytes,
  tick: autopilot,
});
if (typeof CFG.ready === 'function') CFG.ready(route);
