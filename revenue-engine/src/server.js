// Zero-dependency HTTP server: the dashboard and a small JSON API over the ledger.
// Binds to localhost by default. The page renders only what /api/state can prove from the ledger.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reduce } from './reduce.js';
import { quests, summary } from './quests.js';
import { commanderLevel } from './level.js';
import { CATALOG, GATES, stagesFor } from './paths.js';
import { LedgerError } from './ledger.js';
import { ROLES, DEFAULT_MODEL } from './agent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_HTML = fs.readFileSync(path.join(here, 'dashboard.html'), 'utf8');
const STATION_HTML = fs.readFileSync(path.join(here, 'station.html'), 'utf8');

// Count real files an agent wrote to each path's outbox. The station's dock draws exactly this many papers.
function outboxCounts(dataDir, catalog) {
  const out = {};
  for (const p of catalog) {
    let n = 0;
    try { n = fs.readdirSync(path.join(dataDir, 'outbox', p.id)).filter((f) => f.endsWith('.md')).length; } catch { n = 0; }
    out[p.id] = n;
  }
  return out;
}

// Drafts waiting for a human to publish or send. Newest first, content capped at 8 KB each.
export function listOutbox(dataDir, catalog = CATALOG) {
  const out = [];
  if (!dataDir) return out;
  for (const p of catalog) {
    const dir = path.join(dataDir, 'outbox', p.id);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { continue; }
    for (const f of files) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      out.push({ path: p.id, file: f, mtime: st.mtime.toISOString(), content: fs.readFileSync(full, 'utf8').slice(0, 8192) });
    }
  }
  return out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

export function snapshot(ledger, catalog = CATALOG, dataDir = null) {
  const state = reduce(ledger.readAll(), catalog);
  const q = quests(state, catalog);
  return {
    generatedAt: new Date().toISOString(),
    outbox: dataDir ? outboxCounts(dataDir, catalog) : {},
    state,
    level: commanderLevel(state),
    quests: q,
    questSummary: summary(q),
    catalog: catalog.map((p) => ({ ...p, stageList: stagesFor(p) })),
    gates: GATES,
    roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { title: v.title, logs: v.logs }])),
    defaultModel: DEFAULT_MODEL,
  };
}

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

// opts.runAgent(args) -> Promise<result>; opts.makeProvider() -> provider for live runs (may throw if no credentials)
export function createServer({ ledger, catalog = CATALOG, dataDir, runAgent, makeProvider }) {
  const runs = new Map(); // runId -> { status, started, result?, error? }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, STATION_HTML, 'text/html');
      if (req.method === 'GET' && url.pathname === '/ledger') return send(res, 200, LEDGER_HTML, 'text/html');
      if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, snapshot(ledger, catalog, dataDir));
      if (req.method === 'GET' && url.pathname === '/api/runs') return send(res, 200, [...runs.values()]);
      if (req.method === 'GET' && url.pathname === '/api/outbox') return send(res, 200, listOutbox(dataDir, catalog));

      if (req.method === 'POST' && url.pathname === '/api/jobs') {
        const body = await readJson(req);
        if (!ROLES[body.role]) return send(res, 400, { ok: false, error: `unknown role "${body.role}"` });
        if (!catalog.some((p) => p.id === body.path)) return send(res, 400, { ok: false, error: `unknown path "${body.path}"` });
        try {
          const ev = ledger.append({
            kind: 'job', jobId: body.jobId || `job_${Date.now().toString(36)}`, role: body.role, path: body.path,
            everyHours: Number(body.everyHours), maxUsd: Number(body.maxUsd), enabled: body.enabled !== false, note: body.note,
          });
          return send(res, 201, { ok: true, event: ev });
        } catch (e) {
          if (e instanceof LedgerError) return send(res, 400, { ok: false, error: e.message });
          throw e;
        }
      }

      if (req.method === 'POST' && url.pathname === '/api/events') {
        const body = await readJson(req);
        try {
          const ev = ledger.append(body);
          return send(res, 201, { ok: true, event: ev });
        } catch (e) {
          if (e instanceof LedgerError) return send(res, 400, { ok: false, error: e.message });
          throw e;
        }
      }

      if (req.method === 'POST' && url.pathname === '/api/run') {
        if (!runAgent || !makeProvider) return send(res, 501, { ok: false, error: 'agent runs are not wired on this server' });
        const body = await readJson(req);
        const runId = `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        let provider;
        try { provider = await makeProvider(body); } catch (e) { return send(res, 400, { ok: false, error: e.message }); }
        const entry = { runId, role: body.role, path: body.path, status: 'running', started: new Date().toISOString() };
        runs.set(runId, entry);
        runAgent({
          runId, role: body.role, pathId: body.path, ledger, dataDir, provider, catalog, jobId: body.jobId,
          model: body.model || undefined, maxUsd: Number.isFinite(body.maxUsd) ? body.maxUsd : undefined,
        }).then((result) => Object.assign(entry, { status: 'ended', result }))
          .catch((e) => Object.assign(entry, { status: 'failed', error: e.message }));
        return send(res, 202, { ok: true, runId });
      }

      return send(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      return send(res, 500, { ok: false, error: e.message });
    }
  });
}
