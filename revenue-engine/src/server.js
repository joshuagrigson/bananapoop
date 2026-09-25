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
const HTML = fs.readFileSync(path.join(here, 'dashboard.html'), 'utf8');

export function snapshot(ledger, catalog = CATALOG) {
  const state = reduce(ledger.readAll(), catalog);
  const q = quests(state, catalog);
  return {
    generatedAt: new Date().toISOString(),
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
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, HTML, 'text/html');
      if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, snapshot(ledger, catalog));
      if (req.method === 'GET' && url.pathname === '/api/runs') return send(res, 200, [...runs.values()]);

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
          runId, role: body.role, pathId: body.path, ledger, dataDir, provider, catalog,
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
