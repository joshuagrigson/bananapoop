// The station's JSON API as a plain function: handle(method, pathname, readBody) -> { code, body }. No sockets, no HTML.
// server.js puts it behind http on localhost. The preview runs this same file in the browser over an in-memory disk, so
// every button in the mock goes through the real rules (evidence, budgets, validation), not a look-alike.
import fs from 'node:fs';
import path from 'node:path';
import { reduce } from './reduce.js';
import { quests, summary } from './quests.js';
import { commanderLevel } from './level.js';
import { CATALOG, GATES, stagesFor } from './paths.js';
import { LedgerError } from './ledger.js';
import { ROLES, DEFAULT_MODEL } from './agent.js';
import { addItem, listItems } from './inbox.js';
import { addClient, listClients, updateClient, isDue } from './clients.js';
import { harvest as runHarvest } from './harvest.js';
import { loadCatalog, loadConfig, saveConfig, resetConfig, fromTemplate, stationInfo, unclaimedItems, TEMPLATES, STYLES, SCREENS, PROPS, PALETTE, MAX_ROOMS, MODES, SKINS, KID_COLORS, MAX_KIDS, FOLK_COLORS, MAX_FOLK } from './rooms.js';
import { connectorSpecs, CSV_SOURCES, listConnections, upsertConnection, removeConnection, publicConnection, syncConnection, syncAll, syncing, testConnection, csvRecords, classify, knownExt, importRecords } from './sync.js';

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
    station: dataDir ? stationInfo(dataDir) : { name: 'Proxyfolk', template: 'paths', custom: false, configured: false, mode: 'agents', skin: 'space', folk: [], kids: [] },
    // income links, without any secret: the station's comm mast and sync panel read this
    sync: { syncing: syncing(), connections: dataDir ? listConnections(dataDir).map(({ secret, ...c }) => c) : [] },
    gates: GATES,
    roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { title: v.title, logs: v.logs }])),
    defaultModel: DEFAULT_MODEL,
  };
}

// Everything the room designer needs: the saved design, the live catalog, templates and the menu of looks.
export function roomsInfo(ledger, catalog, dataDir) {
  const cfg = dataDir ? loadConfig(dataDir) : null;
  return {
    config: cfg || { name: 'Proxyfolk', template: 'paths', rooms: null },
    catalog: catalog.map((p) => ({ id: p.id, name: p.name, short: p.short, kind: p.kind || 'pipeline', accent: p.accent, style: p.style, screen: p.screen, prop: p.prop, match: p.match || [], minutes: p.minutes, priceUsd: p.priceUsd, costUsd: p.costUsd, goalUsd: p.goalUsd, looks: p.looks, base: p.kind === 'service' ? undefined : p.id })),
    templates: Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => { const c = fromTemplate(k); return [k, { title: t.title, blurb: t.blurb, rooms: t.rooms ? t.rooms.length : CATALOG.length, mode: c.mode, skin: c.skin, name: c.name, list: c.rooms }]; })),
    modes: MODES, skins: SKINS, kidColors: KID_COLORS, maxKids: MAX_KIDS, folkColors: FOLK_COLORS, maxFolk: MAX_FOLK,
    builtIn: CATALOG.map((p) => ({ id: p.id, name: p.name, short: p.short })),
    styles: STYLES, screens: SCREENS, props: PROPS, palette: PALETTE, maxRooms: MAX_ROOMS,
    unclaimed: unclaimedItems(ledger.readAll(), catalog),
  };
}

// opts.runAgent(args) -> Promise<result>; opts.makeProvider() -> provider for live runs (may throw if no credentials)
// opts.fetchImpl is what income sync uses to reach Stripe, Square, PayPal and Gumroad (swapped out in tests).
// opts.catalog pins the rooms (tests); without it the rooms come from <data>/rooms.json on every request, so a room
// designed in the station takes effect immediately.
// readBody(limit) -> Promise<parsed JSON body>; it is only called for writes.
export function createApi({ ledger, catalog: fixedCatalog = null, dataDir, runAgent, makeProvider, harvestImpl = null, fetchImpl = globalThis.fetch }) {
  const runs = new Map(); // runId -> { status, started, result?, error? }
  const ok = (code, body) => ({ code, body });

  return async function handle(method, pathname, readBody) {
    const catalog = fixedCatalog || loadCatalog(dataDir);
    try {
      if (method === 'GET' && pathname === '/api/state') return ok(200, snapshot(ledger, catalog, dataDir));
      if (method === 'GET' && pathname === '/api/runs') return ok(200, [...runs.values()]);
      if (method === 'GET' && pathname === '/api/outbox') return ok(200, listOutbox(dataDir, catalog));
      if (method === 'GET' && pathname === '/api/inbox') {
        const out = {};
        for (const p of catalog) {
          const pending = dataDir ? listItems(dataDir, p.id) : [];
          const done = dataDir ? listItems(dataDir, p.id, { status: 'done' }).slice(-20) : [];
          if (pending.length || done.length) out[p.id] = { pending, done };
        }
        return ok(200, out);
      }
      if (method === 'GET' && pathname === '/api/clients') {
        const out = {};
        for (const p of catalog) {
          const list = dataDir ? listClients(dataDir, p.id) : [];
          if (list.length) out[p.id] = list.map((c) => ({ ...c, due: isDue(c) }));
        }
        return ok(200, out);
      }
      if (method === 'POST' && pathname === '/api/clients') {
        const body = await readBody();
        if (!catalog.some((p) => p.id === body.path)) return ok(400, { ok: false, error: `unknown path "${body.path}"` });
        try {
          const c = body.id ? updateClient(dataDir, body.path, body.id, body) : addClient(dataDir, body.path, body);
          return ok(201, { ok: true, client: c });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }
      if (method === 'POST' && pathname === '/api/harvest') {
        if (!dataDir) return ok(501, { ok: false, error: 'no data dir' });
        const body = await readBody();
        try {
          const r = await (harvestImpl || runHarvest)({ dataDir, sinceDays: Number(body.sinceDays) || 30, ...(Array.isArray(body.counties) ? { counties: body.counties } : {}) });
          return ok(200, { ok: true, ...r });
        } catch (e) {
          return ok(502, { ok: false, error: e.message });
        }
      }
      if (method === 'POST' && pathname === '/api/inbox') {
        const body = await readBody();
        if (!catalog.some((p) => p.id === body.path)) return ok(400, { ok: false, error: `unknown path "${body.path}"` });
        try {
          return ok(201, { ok: true, item: addItem(dataDir, body.path, body) });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }

      if (method === 'POST' && pathname === '/api/jobs') {
        const body = await readBody();
        if (!ROLES[body.role]) return ok(400, { ok: false, error: `unknown role "${body.role}"` });
        if (!catalog.some((p) => p.id === body.path)) return ok(400, { ok: false, error: `unknown path "${body.path}"` });
        try {
          const ev = ledger.append({
            kind: 'job', jobId: body.jobId || `job_${Date.now().toString(36)}`, role: body.role, path: body.path,
            everyHours: Number(body.everyHours), maxUsd: Number(body.maxUsd), enabled: body.enabled !== false, note: body.note,
          });
          return ok(201, { ok: true, event: ev });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }

      if (method === 'POST' && pathname === '/api/events') {
        const body = await readBody();
        try {
          const ev = ledger.append(body);
          return ok(201, { ok: true, event: ev });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }

      // ---- room designer
      if (method === 'GET' && pathname === '/api/rooms') return ok(200, roomsInfo(ledger, catalog, dataDir));
      if (method === 'POST' && pathname === '/api/rooms') {
        if (!dataDir) return ok(501, { ok: false, error: 'no data dir' });
        const body = await readBody();
        try {
          if (body.reset) { resetConfig(dataDir); return ok(200, { ok: true, config: null }); }
          // just the world: the dashboard's skin picker changes the station's skin and nothing else
          if (body.skin && !body.template && !body.config) {
            const cur = loadConfig(dataDir) || { name: 'Proxyfolk', rooms: null };
            return ok(200, { ok: true, config: saveConfig(dataDir, { ...cur, skin: body.skin }) });
          }
          const cfg = body.template ? fromTemplate(body.template, { name: body.name, skin: body.skin, mode: body.mode, folk: body.folk ?? body.kids }) : body.config;
          const saved = saveConfig(dataDir, cfg);
          return ok(200, { ok: true, config: saved });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }

      // ---- income sync
      if (method === 'GET' && pathname === '/api/connections') {
        return ok(200, { connectors: connectorSpecs(), csvSources: CSV_SOURCES, connections: dataDir ? listConnections(dataDir) : [], syncing: syncing() });
      }
      if (method === 'POST' && pathname === '/api/connections') {
        if (!dataDir) return ok(501, { ok: false, error: 'no data dir' });
        const body = await readBody();
        try {
          if (body.remove) { removeConnection(dataDir, body.id); return ok(200, { ok: true }); }
          const fresh = !body.id || Object.values(body.secret || {}).some((v) => typeof v === 'string' && v.trim() && !v.startsWith('••••'));
          if (fresh && body.test !== false) {
            const kind = body.kind || (listConnections(dataDir).find((c) => c.id === body.id) || {}).kind;
            try { await testConnection({ kind, secret: body.secret || {}, fetchImpl }); } catch (e) { return ok(400, { ok: false, error: e.message }); }
          }
          const c = upsertConnection(dataDir, body, catalog);
          const first = body.syncNow === false ? null : await syncConnection({ ledger, dataDir, id: c.id, fetchImpl });
          return ok(201, { ok: true, connection: publicConnection({ ...c, lastSync: first ? { ...first } : c.lastSync }), sync: first });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }
      if (method === 'POST' && pathname === '/api/sync') {
        if (!dataDir) return ok(501, { ok: false, error: 'no data dir' });
        const body = await readBody();
        try {
          const results = body.id ? [await syncConnection({ ledger, dataDir, id: body.id, fetchImpl })] : await syncAll({ ledger, dataDir, fetchImpl });
          return ok(200, { ok: true, results });
        } catch (e) {
          if (e instanceof LedgerError) return ok(400, { ok: false, error: e.message });
          throw e;
        }
      }
      if (method === 'POST' && pathname === '/api/import/csv') {
        const body = await readBody(8_000_000);
        if (!catalog.some((p) => p.id === body.path)) return ok(400, { ok: false, error: `pick which money path this income belongs to (unknown path "${body.path}")` });
        const source = String(body.source || 'csv').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'csv';
        const title = String(body.title || CSV_SOURCES[source]?.title || body.source || 'CSV').slice(0, 40);
        const parsed = csvRecords(body.text || '', { source, mapping: body.mapping || undefined });
        if (!parsed.headers.length) return ok(400, { ok: false, error: 'that file has no rows. Export it as CSV and try again.' });
        if (body.dryRun) {
          const rows = classify(parsed.records, knownExt(ledger));
          const n = (st) => rows.filter((r) => r.status === st).length;
          return ok(200, { ok: true, headers: parsed.headers, mapping: parsed.mapping, fields: parsed.fields, rows: rows.slice(0, 200), total: rows.length, newCount: n('new'), duplicates: n('duplicate'), skipped: n('skip'), newUsd: Math.round(rows.filter((r) => r.status === 'new').reduce((s, r) => s + r.usd, 0) * 100) / 100 });
        }
        const r = importRecords(ledger, parsed.records, { path: body.path, via: 'csv:' + source, sourceTitle: title, verb: 'imported' });
        return ok(201, { ok: true, imported: r.added.length, usd: r.usd, duplicates: r.rows.filter((x) => x.status === 'duplicate').length, skipped: r.rows.filter((x) => x.status === 'skip').length });
      }

      if (method === 'POST' && pathname === '/api/run') {
        if (!runAgent || !makeProvider) return ok(501, { ok: false, error: 'agent runs are not wired on this server' });
        const body = await readBody();
        const runId = `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        let provider;
        try { provider = await makeProvider(body); } catch (e) { return ok(400, { ok: false, error: e.message }); }
        const entry = { runId, role: body.role, path: body.path, status: 'running', started: new Date().toISOString() };
        runs.set(runId, entry);
        runAgent({
          runId, role: body.role, pathId: body.path, ledger, dataDir, provider, catalog, jobId: body.jobId,
          model: body.model || undefined, maxUsd: Number.isFinite(body.maxUsd) ? body.maxUsd : undefined,
        }).then((result) => Object.assign(entry, { status: 'ended', result }))
          .catch((e) => Object.assign(entry, { status: 'failed', error: e.message }));
        return ok(202, { ok: true, runId });
      }

      return ok(404, { ok: false, error: 'not found' });
    } catch (e) {
      return ok(500, { ok: false, error: e.message });
    }
  };
}
