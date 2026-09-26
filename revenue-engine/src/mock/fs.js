// A small in-memory disk that stands in for node:fs when the engine runs inside the preview page. It holds the same
// files the station keeps on a real computer (ledger.jsonl, rooms.json, inbox, clients, outbox, connections) and saves
// them to this browser's localStorage, so a mock station survives a reload. Nothing here ever leaves the browser.
const files = new Map(); // path -> { data: string, mtime: number }
const dirs = new Set(['/']);
let storeKey = null;
let saveTimer = 0;

const norm = (p) => {
  const out = [];
  for (const seg of String(p).split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); }
  return '/' + out.join('/');
};
const parent = (p) => { const n = norm(p); const i = n.lastIndexOf('/'); return i <= 0 ? '/' : n.slice(0, i); };
const err = (code, p) => Object.assign(new Error(`${code}: no such file or directory, '${p}'`), { code });

function persist() {
  if (!storeKey) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}
export function flush() {
  if (!storeKey) return;
  clearTimeout(saveTimer);
  try { localStorage.setItem(storeKey, JSON.stringify({ v: 1, dirs: [...dirs], files: [...files] })); } catch { /* private window or full: the mock keeps working in memory */ }
}
// Load a saved disk (or start empty). Returns true when a saved disk was found.
export function mount(key) {
  storeKey = key;
  files.clear(); dirs.clear(); dirs.add('/');
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { raw = null; }
  if (!raw) return false;
  try {
    const j = JSON.parse(raw);
    if (!j || j.v !== 1) return false;
    for (const d of j.dirs || []) dirs.add(d);
    for (const [p, f] of j.files || []) files.set(p, f);
    return true;
  } catch { return false; }
}
export function wipe() {
  files.clear(); dirs.clear(); dirs.add('/');
  try { if (storeKey) localStorage.removeItem(storeKey); } catch { /* ignore */ }
}
export const bytes = () => { let n = 0; for (const [p, f] of files) n += p.length + f.data.length; return n; };

function mkdirSync(p, opts = {}) {
  const n = norm(p);
  if (dirs.has(n)) return undefined;
  if (!opts.recursive && !dirs.has(parent(n))) throw err('ENOENT', p);
  const chain = [];
  for (let q = n; q !== '/' && !dirs.has(q); q = parent(q)) chain.push(q);
  for (const q of chain) dirs.add(q);
  persist();
  return n;
}
function existsSync(p) { const n = norm(p); return files.has(n) || dirs.has(n); }
function readFileSync(p) {
  const f = files.get(norm(p));
  if (!f) throw err('ENOENT', p);
  return f.data;
}
function writeFileSync(p, data) {
  const n = norm(p);
  if (!dirs.has(parent(n))) throw err('ENOENT', p);
  files.set(n, { data: String(data), mtime: Date.now() });
  persist();
}
function appendFileSync(p, data) {
  const n = norm(p);
  if (!dirs.has(parent(n))) throw err('ENOENT', p);
  const f = files.get(n);
  files.set(n, { data: (f ? f.data : '') + String(data), mtime: Date.now() });
  persist();
}
function readdirSync(p) {
  const n = norm(p);
  if (!dirs.has(n)) throw err('ENOENT', p);
  const pre = n === '/' ? '/' : n + '/';
  const out = new Set();
  for (const k of [...files.keys(), ...dirs]) if (k !== n && k.startsWith(pre)) out.add(k.slice(pre.length).split('/')[0]);
  return [...out].sort();
}
function statSync(p) {
  const n = norm(p);
  const f = files.get(n);
  if (f) return { mtime: new Date(f.mtime), mtimeMs: f.mtime, size: f.data.length, isFile: () => true, isDirectory: () => false };
  if (dirs.has(n)) return { mtime: new Date(0), mtimeMs: 0, size: 0, isFile: () => false, isDirectory: () => true };
  throw err('ENOENT', p);
}
function renameSync(a, b) {
  const f = files.get(norm(a));
  if (!f) throw err('ENOENT', a);
  if (!dirs.has(parent(b))) throw err('ENOENT', b);
  files.delete(norm(a));
  files.set(norm(b), { ...f, mtime: Date.now() });
  persist();
}
function unlinkSync(p) { if (!files.delete(norm(p))) throw err('ENOENT', p); persist(); }
function rmSync(p, opts = {}) {
  const n = norm(p);
  if (files.delete(n)) return persist();
  if (!dirs.has(n)) { if (opts.force) return undefined; throw err('ENOENT', p); }
  for (const k of [...files.keys()]) if (k.startsWith(n + '/')) files.delete(k);
  for (const k of [...dirs]) if (k === n || k.startsWith(n + '/')) dirs.delete(k);
  return persist();
}
// the ledger appends through a file descriptor; here a descriptor is just the path
const fds = new Map();
let nextFd = 3;
function openSync(p, flags = 'r') {
  const n = norm(p);
  if (!dirs.has(parent(n))) throw err('ENOENT', p);
  if (flags.includes('a') && !files.has(n)) files.set(n, { data: '', mtime: Date.now() });
  const fd = nextFd++;
  fds.set(fd, n);
  return fd;
}
function writeSync(fd, data) { appendFileSync(fds.get(fd), data); return String(data).length; }
function fsyncSync() { flush(); }
function closeSync(fd) { fds.delete(fd); }

export default { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, renameSync, unlinkSync, rmSync, openSync, writeSync, fsyncSync, closeSync };
