#!/usr/bin/env node
// CLI: status, log money and outcomes, clear gates, kill paths, run agents, serve the dashboard.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Ledger, LedgerError } from './ledger.js';
import { reduce } from './reduce.js';
import { quests, summary } from './quests.js';
import { commanderLevel } from './level.js';
import { CATALOG, GATES } from './paths.js';
import { runAgent, ROLES, DEFAULT_MODEL } from './agent.js';
import { createServer } from './server.js';
import { createScheduler } from './scheduler.js';
import { seedDemo, seedBarberDemo, seedAllowanceDemo } from './demo.js';
import { addItem, listItems } from './inbox.js';
import { addClient, listClients, updateClient, isDue } from './clients.js';
import { harvest, DEFAULT_COUNTIES } from './harvest.js';
import { loadCatalog, loadConfig, saveConfig, resetConfig, fromTemplate, TEMPLATES, MODES, SKINS } from './rooms.js';
import { CONNECTORS, CSV_SOURCES, listConnections, upsertConnection, removeConnection, syncConnection, syncAll, testConnection, csvRecords, classify, knownExt, importRecords } from './sync.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DATA_DIR = process.env.REVENUE_ENGINE_DATA || path.join(ROOT, 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.jsonl');

const usd = (n) => { const v = Number(n || 0); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: Math.abs(v) % 1 ? 2 : 0, maximumFractionDigits: 2 }); };

const HELP = `revenue-engine

  status                                   headline numbers, level, open quests
  log-in <usd> --path P --source S --evidence E [--item "Skin fade"] [--post ID] [--tag GIG] [--hours H]   real money received
  log-out <usd> --category C [--path P] --evidence E  real money spent (api|tool|ads|capital|other)
  outcome <path> <stage> --ref R --evidence E         prospect|conversation|demo|pilot|paid|retained
  gate <name> --cleared|--blocked --evidence E        e.g. gate employment-agreement --cleared --evidence "read 2026-09-26, no non-compete"
  path-status <path> <active|paused|killed> --reason R
  post <path> --platform X --url U --title T          a post you published (live URL required)
  harvest [--days 30] [--counties 019,034]             pull newly permitted local businesses from free Texas records into the GBP inbox ($0)
  client add <path> --name N --city C [--category X] [--website U] [--monthly 200]   a paying client for monthly packs
  client notes <path> <clientId> --notes "new reviews, promos, hours..."        what changed this month
  clients [path]                                       list clients and whose pack is due
  inbox add <path> --type post|job|lead --file F [--url U]   hand work to the agents
  inbox <path>                                         list pending and handled inbox items
  job add <role> --path P --every HOURS --max-usd N    a standing order the scheduler runs
  job off <jobId>                                      disable a job
  jobs                                                 list jobs
  rooms                                                the rooms this station is built from
  rooms template <barber|salon|freelance|chores|paths|blank> [--name "Kayla's Chair"] [--skin castle]   start the rooms from a template
  rooms skin <space|castle|farm|cyber|alien|ocean>      how the station looks (decoration only)
  rooms mode <agents|service|allowance>                what the screens lead with
  rooms reset                                          back to the built-in money paths
  connections                                          income links and when each last synced
  connect <stripe|square|paypal|gumroad> --path P --key K [--secret S] [--label L] [--since 2026-06-01]
                                                       link where you get paid (PayPal: --key CLIENT_ID --secret SECRET)
  disconnect <connectionId>                            forget a link and its key
  sync [connectionId]                                  pull new payments now (serve does this every 15 minutes)
  import-csv <file> --path P --source upwork|fiverr|etsy|amazon|paypal|venmo|bank|other [--dry-run]
                                                       import a statement export; the same file twice never counts twice
  seed-demo [--barber|--family]                        fill an EMPTY data dir with labeled demo data (a barbershop, or a family's chores)
  run <role> --path P [--max-usd 2] [--model ${DEFAULT_MODEL}] [--provider anthropic|replay --script file.json]
  serve [--port 8790] [--host 127.0.0.1] [--daily-cap 5] [--no-scheduler] [--harvest-daily] [--sync-every 15] [--open]
  paths                                    the catalog
  help

Data dir: ${DATA_DIR}  (override with REVENUE_ENGINE_DATA)`;

function makeAnthropicProvider() {
  // Lazy import so status/log commands never load the SDK. Zero-arg client resolves ANTHROPIC_API_KEY or an ant profile.
  return import('@anthropic-ai/sdk').then(({ default: Anthropic }) => ({ kind: 'anthropic', client: new Anthropic(), noFallback: Boolean(process.env.REVENUE_ENGINE_NO_FALLBACK) }));
}

// Open the station in the default browser. Failure is harmless: the URL is printed either way.
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  import('node:child_process').then(({ exec }) => exec(cmd, () => {})).catch(() => {});
}

async function providerFrom(v) {
  if (v.provider === 'replay') {
    if (!v.script) throw new Error('--provider replay needs --script <file.json>');
    return { kind: 'replay', script: JSON.parse(fs.readFileSync(path.resolve(v.script), 'utf8')) };
  }
  return makeAnthropicProvider();
}

function printStatus(ledger) {
  const CAT = loadCatalog(DATA_DIR);
  const st = reduce(ledger.readAll(), CAT);
  const lv = commanderLevel(st);
  const q = quests(st, CAT);
  const sum = summary(q);
  const y = st.spentUsd > 0 ? st.yieldRatio.toFixed(2) : 'n/a (nothing spent)';
  console.log(`earned ${usd(st.earnedUsd)} | spent ${usd(st.spentUsd)} | yield ${y} | Commander L${lv.level} (${lv.title})${lv.next ? ` | ${usd(lv.next.remainingUsd)} to ${lv.next.title}` : ''}`);
  console.log(`events ${st.eventCount} | runs ${st.runs.length}${st.running.length ? ` (+${st.running.length} live)` : ''} | quests ${sum.open} open / ${sum.done} done\n`);
  for (const p of CAT) {
    const s = st.paths[p.id];
    if (p.kind === 'service') { const n = st.moneyIn.filter((e) => e.path === p.id).reduce((a, e) => a + (e.qty || 1), 0); console.log(`#${p.rank} ${p.name} [service] earned ${usd(s.earnedUsd)} from ${n} sold${p.match && p.match.length ? `  (claims items with: ${p.match.join(', ')})` : ''}`); continue; }
    const gated = p.gate && !(st.gates[p.gate] && st.gates[p.gate].cleared);
    const stages = Object.entries(s.outcomes).map(([k, n]) => `${k} ${k === 'paid' ? Math.max(n, s.moneyIn.length) : n}`).join(' · ');
    console.log(`#${p.rank} ${p.name} [${s.status}${gated ? ', gated' : ''}] earned ${usd(s.earnedUsd)} spent ${usd(s.spentUsd)}/${usd(p.budgetUsd)}\n    ${stages}`);
  }
  console.log('\nOPEN QUESTS');
  for (const x of q.filter((i) => i.status === 'open')) console.log(`  [ ] ${x.title}${x.progress ? ` (${Math.round(x.progress.n * 100) / 100}/${x.progress.target})` : ''}${x.blocked ? ' BLOCKED' : ''}${x.gated ? ' gated' : ''}\n      ${x.desc}`);
  const done = q.filter((i) => i.status === 'done');
  if (done.length) { console.log('\nDONE'); for (const x of done) console.log(`  [x] ${x.title}: ${x.desc}`); }
}

async function main(argv) {
  const { values: v, positionals: pos } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      path: { type: 'string' }, source: { type: 'string' }, evidence: { type: 'string' }, category: { type: 'string' },
      ref: { type: 'string' }, reason: { type: 'string' }, cleared: { type: 'boolean' }, blocked: { type: 'boolean' },
      'max-usd': { type: 'string' }, model: { type: 'string' }, provider: { type: 'string' }, script: { type: 'string' },
      port: { type: 'string' }, host: { type: 'string' }, 'max-iterations': { type: 'string' },
      platform: { type: 'string' }, url: { type: 'string' }, title: { type: 'string' }, post: { type: 'string' },
      every: { type: 'string' }, type: { type: 'string' }, days: { type: 'string' }, counties: { type: 'string' },
      name: { type: 'string' }, city: { type: 'string' }, category: { type: 'string' }, website: { type: 'string' },
      monthly: { type: 'string' }, notes: { type: 'string' }, services: { type: 'string' }, 'harvest-daily': { type: 'boolean' }, open: { type: 'boolean' }, file: { type: 'string' }, tag: { type: 'string' }, hours: { type: 'string' }, 'daily-cap': { type: 'string' }, 'no-scheduler': { type: 'boolean' },
      key: { type: 'string' }, secret: { type: 'string' }, item: { type: 'string' }, label: { type: 'string' }, since: { type: 'string' }, 'dry-run': { type: 'boolean' }, 'sync-every': { type: 'string' }, barber: { type: 'boolean' }, family: { type: 'boolean' }, skin: { type: 'string' }, mode: { type: 'string' },
    },
  });
  const [cmd, ...rest] = pos;
  const ledger = new Ledger(LEDGER_FILE);
  const CAT = loadCatalog(DATA_DIR);

  switch (cmd) {
    case undefined:
    case 'help':
      console.log(HELP); return;
    case 'status':
      printStatus(ledger); return;
    case 'paths':
      for (const p of CAT) console.log(`#${p.rank} ${p.id}\n   ${p.name} (${p.bucket})${p.gate ? ` gate: ${p.gate}` : ''}\n   ${p.thesis}\n   kill test: ${p.killTest}\n`);
      console.log('GATES'); for (const [k, g] of Object.entries(GATES)) console.log(`   ${k}: ${g.title}`);
      return;
    case 'log-in': {
      const ev = ledger.append({ kind: 'money.in', usd: Number(rest[0]), path: v.path, source: v.source, evidence: v.evidence, ...(v.post ? { postId: v.post } : {}), ...(v.tag ? { tag: v.tag } : {}), ...(v.hours ? { hours: Number(v.hours) } : {}), ...(v.item ? { item: v.item } : {}) });
      console.log(`appended money.in ${ev.id}: ${usd(ev.usd)} on ${ev.path} from ${ev.source}`); return;
    }
    case 'log-out': {
      const ev = ledger.append({ kind: 'money.out', usd: Number(rest[0]), category: v.category, path: v.path, evidence: v.evidence });
      console.log(`appended money.out ${ev.id}: ${usd(ev.usd)} ${ev.category} on ${ev.path}`); return;
    }
    case 'outcome': {
      const ev = ledger.append({ kind: 'outcome', path: rest[0], stage: rest[1], ref: v.ref, evidence: v.evidence, by: 'user' });
      console.log(`appended outcome ${ev.id}: ${ev.stage} "${ev.ref}" on ${ev.path}`); return;
    }
    case 'gate': {
      if (!v.cleared && !v.blocked) throw new LedgerError('gate needs --cleared or --blocked');
      const ev = ledger.append({ kind: 'gate', gate: rest[0], cleared: Boolean(v.cleared) && !v.blocked, evidence: v.evidence });
      console.log(`appended gate ${ev.id}: ${ev.gate} ${ev.cleared ? 'CLEARED' : 'BLOCKED'}`); return;
    }
    case 'path-status': {
      const ev = ledger.append({ kind: 'path.status', path: rest[0], status: rest[1], reason: v.reason });
      console.log(`appended path.status ${ev.id}: ${ev.path} -> ${ev.status}`); return;
    }
    case 'post': {
      const ev = ledger.append({ kind: 'post', path: rest[0], platform: v.platform, url: v.url, title: v.title, by: 'user' });
      console.log(`appended post ${ev.id}: ${ev.platform} "${ev.title}" on ${ev.path}. Attribute revenue with: log-in <usd> ... --post ${ev.id}`); return;
    }
    case 'job': {
      const st = reduce(ledger.readAll());
      if (rest[0] === 'add') {
        const role = rest[1];
        if (!ROLES[role]) throw new LedgerError(`job add needs a role: ${Object.keys(ROLES).join(', ')}`);
        if (!CAT.some((p) => p.id === v.path)) throw new LedgerError('job add needs a known --path');
        const ev = ledger.append({ kind: 'job', jobId: `job_${Date.now().toString(36)}`, role, path: v.path, everyHours: Number(v.every), maxUsd: Number(v['max-usd']), enabled: true });
        console.log(`appended job ${ev.jobId}: ${role} on ${ev.path} every ${ev.everyHours}h, max $${ev.maxUsd}/run. It runs while "serve" is up.`); return;
      }
      if (rest[0] === 'off') {
        const j = st.jobs[rest[1]];
        if (!j) throw new LedgerError(`no job "${rest[1]}"`);
        ledger.append({ kind: 'job', jobId: j.jobId, role: j.role, path: j.path, everyHours: j.everyHours, maxUsd: j.maxUsd, enabled: false });
        console.log(`job ${j.jobId} disabled`); return;
      }
      throw new LedgerError('job needs "add" or "off"');
    }
    case 'jobs': {
      const st = reduce(ledger.readAll());
      const jobs = Object.values(st.jobs);
      if (!jobs.length) { console.log('no jobs. Add one: job add creator --path content-channel --every 24 --max-usd 1'); return; }
      for (const j of jobs) console.log(`${j.jobId} ${j.enabled ? 'ON ' : 'off'} ${j.role} -> ${j.path} every ${j.everyHours}h max $${j.maxUsd} · runs ${j.runs} · last ${j.lastRunAt || 'never'}`);
      return;
    }
    case 'harvest': {
      const counties = v.counties ? v.counties.split(',').map((c) => c.trim()) : DEFAULT_COUNTIES;
      const r = await harvest({ dataDir: DATA_DIR, counties, sinceDays: Number(v.days || 30) });
      console.log(`data.texas.gov: ${r.fetched} new permits in counties ${counties.join(',')}, ${r.matched} local-service types, ${r.skippedSeen} already seen, ${r.added} added to the gbp-management inbox.`);
      for (const i of r.items) console.log(`  + ${i.name} (${i.city}) NAICS ${i.naics}`);
      if (r.added) console.log('Next: node src/cli.js run auditor --path gbp-management');
      return;
    }
    case 'client': {
      const pid = rest[1];
      if (!CAT.some((p) => p.id === pid)) throw new LedgerError('client needs a known path, e.g. gbp-management');
      if (rest[0] === 'add') {
        const c = addClient(DATA_DIR, pid, { name: v.name, city: v.city, category: v.category, website: v.website, services: v.services, notes: v.notes, monthlyUsd: v.monthly });
        console.log(`added client ${c.id}: ${c.name} (${c.city}). The manager writes their first pack on its next run.`); return;
      }
      if (rest[0] === 'notes') {
        const c = updateClient(DATA_DIR, pid, rest[2], { notes: v.notes });
        console.log(`updated notes for ${c.name}`); return;
      }
      throw new LedgerError('client needs "add" or "notes"');
    }
    case 'clients': {
      const ids = rest[0] ? [rest[0]] : CAT.map((p) => p.id);
      let any = false;
      for (const pid of ids) {
        for (const c of listClients(DATA_DIR, pid)) {
          any = true;
          console.log(`${c.id} ${c.name} (${c.city}) ${c.monthlyUsd ? '$' + c.monthlyUsd + '/mo' : ''} · last pack ${c.lastPackAt ? c.lastPackAt.slice(0, 10) : 'never'} · ${isDue(c) ? 'DUE' : 'not due'}`);
        }
      }
      if (!any) console.log('no clients yet. Add one: client add gbp-management --name "..." --city Texarkana --category "hair salon" --monthly 200');
      return;
    }
    case 'inbox': {
      if (rest[0] === 'add') {
        if (!CAT.some((p) => p.id === rest[1])) throw new LedgerError('inbox add needs a known path, e.g. freelance-desk');
        if (!v.file) throw new LedgerError('inbox add needs --file with the pasted post or brief');
        const item = addItem(DATA_DIR, rest[1], { type: v.type, url: v.url, text: fs.readFileSync(path.resolve(v.file), 'utf8') });
        console.log(`added ${item.id} (${item.type}) to ${rest[1]}: ${item.title}`); return;
      }
      const pid = rest[0] || 'freelance-desk';
      const pending = listItems(DATA_DIR, pid);
      const done = listItems(DATA_DIR, pid, { status: 'done' });
      console.log(`${pid}: ${pending.length} waiting, ${done.length} handled`);
      for (const i of pending) console.log(`  [ ] ${i.id} ${i.type} ${i.title}`);
      for (const i of done.slice(-10)) console.log(`  [x] ${i.id} ${i.type} ${i.title} -> ${i.verdict}`);
      return;
    }
    case 'seed-demo': {
      const n = v.family ? seedAllowanceDemo(ledger, DATA_DIR) : v.barber ? seedBarberDemo(ledger, DATA_DIR) : seedDemo(ledger, DATA_DIR);
      console.log(`seeded ${n} demo lines into ${LEDGER_FILE}. The station shows a DEMO banner. Delete ${DATA_DIR} to start real.`); return;
    }
    case 'run': {
      const role = rest[0];
      if (!ROLES[role]) throw new LedgerError(`run needs a role: ${Object.keys(ROLES).join(', ')}`);
      if (!v.path) throw new LedgerError('run needs --path');
      const provider = await providerFrom(v);
      const result = await runAgent({
        role, pathId: v.path, ledger, dataDir: DATA_DIR, provider,
        model: v.model, maxUsd: v['max-usd'] ? Number(v['max-usd']) : undefined,
        maxIterations: v['max-iterations'] ? Number(v['max-iterations']) : undefined,
        log: (e) => console.error(`[${e.type}] ${JSON.stringify({ ...e, type: undefined })}`),
      });
      console.log(result.skipped ? `skipped: ${result.reason}. Nothing was spent.` : JSON.stringify(result, null, 2)); return;
    }
    case 'rooms': {
      if (rest[0] === 'skin' || rest[0] === 'mode') {
        const cur = loadConfig(DATA_DIR) || { name: 'Revenue Station', rooms: null };
        const saved = saveConfig(DATA_DIR, { ...cur, [rest[0]]: rest[1] });
        console.log(`${saved.name}: ${rest[0]} is now ${rest[0] === 'skin' ? SKINS[saved.skin].title : MODES[saved.mode].title}`);
        return;
      }
      if (rest[0] === 'template') {
        const cfg = fromTemplate(rest[1], { name: v.name, skin: v.skin, mode: v.mode });
        const saved = saveConfig(DATA_DIR, cfg);
        console.log(`station "${saved.name}" now has ${saved.rooms ? saved.rooms.length + ' rooms: ' + saved.rooms.map((r) => r.name).join(', ') : 'the built-in paths'}. Edit them in the station (press C).`);
        return;
      }
      if (rest[0] === 'reset') { resetConfig(DATA_DIR); console.log('back to the built-in money paths'); return; }
      const cfg = loadConfig(DATA_DIR);
      console.log(`${cfg ? cfg.name : 'Revenue Station'} (${cfg && cfg.rooms ? 'custom rooms' : 'built-in paths'}) · ${MODES[cfg ? cfg.mode : 'agents'].title} · ${SKINS[cfg ? cfg.skin : 'space'].title}${cfg && cfg.kids.length ? ' · kids: ' + cfg.kids.map((k) => k.name).join(', ') : ''}`);
      for (const p of CAT) console.log(`  #${p.rank} ${p.id}  ${p.name}${p.kind === 'service' ? `  [service, ${p.minutes} min, cost ${usd(p.costUsd)}${p.match.length ? `, claims: ${p.match.join(', ')}` : ''}]` : ''}`);
      console.log(`templates: ${Object.keys(TEMPLATES).join(', ')}   skins: ${Object.keys(SKINS).join(', ')}   modes: ${Object.keys(MODES).join(', ')}`);
      return;
    }
    case 'connections': {
      const list = listConnections(DATA_DIR);
      if (!list.length) { console.log('no income links yet. Link one: node src/cli.js connect stripe --path <path> --key rk_live_...'); return; }
      for (const c of list) {
        const ls = c.lastSync;
        console.log(`${c.id}  ${c.title}${c.label ? ` (${c.label})` : ''} -> ${c.path}${c.enabled ? '' : ' [off]'}  ${ls ? (ls.ok ? `synced ${ls.at}: ${ls.imported} new, ${usd(ls.usd)}` : `FAILED ${ls.at}: ${ls.error}`) : 'never synced'}`);
      }
      return;
    }
    case 'connect': {
      const kind = rest[0];
      const spec = CONNECTORS[kind];
      if (!spec) throw new LedgerError(`connect what? one of: ${Object.keys(CONNECTORS).join(', ')}`);
      const secret = {};
      spec.fields.forEach((f, i) => { secret[f.key] = i === 0 ? v.key : v.secret; });
      console.log(`checking the key with ${spec.title}...`);
      await testConnection({ kind, secret });
      const c = upsertConnection(DATA_DIR, { kind, path: v.path, label: v.label, since: v.since, secret }, CAT);
      const r = await syncConnection({ ledger, dataDir: DATA_DIR, id: c.id });
      console.log(r.ok ? `linked ${c.id}: ${r.imported} payments imported (${usd(r.usd)}), ${r.skipped} skipped. "serve" keeps it in sync.` : `linked ${c.id}, but the first sync failed: ${r.error}`);
      return;
    }
    case 'disconnect':
      removeConnection(DATA_DIR, rest[0]); console.log(`removed ${rest[0]} and its key`); return;
    case 'sync': {
      const results = rest[0] ? [await syncConnection({ ledger, dataDir: DATA_DIR, id: rest[0] })] : await syncAll({ ledger, dataDir: DATA_DIR });
      if (!results.length) console.log('no income links yet (see: connect)');
      for (const r of results) console.log(r.ok ? `${r.id}: ${r.imported} new payments, ${usd(r.usd)}${r.skipped ? `, ${r.skipped} skipped` : ''}` : `${r.id}: FAILED ${r.error}`);
      return;
    }
    case 'import-csv': {
      if (!rest[0]) throw new LedgerError('import-csv <file> --path P --source upwork');
      if (!CAT.some((p) => p.id === v.path)) throw new LedgerError(`--path must be one of: ${CAT.map((p) => p.id).join(', ')}`);
      const source = String(v.source || 'other').toLowerCase();
      const title = (CSV_SOURCES[source] || { title: v.source || 'CSV' }).title;
      const parsed = csvRecords(fs.readFileSync(rest[0], 'utf8'), { source });
      const rows = classify(parsed.records, knownExt(ledger));
      const cols = Object.entries(parsed.mapping).filter(([, i]) => i >= 0).map(([k, i]) => `${k}="${parsed.headers[i]}"`).join(' ');
      console.log(`columns: ${cols}`);
      for (const r of rows.slice(0, 15)) console.log(`  ${r.status.padEnd(9)} ${String(r.at || '').slice(0, 10)}  ${usd(r.usd).padStart(10)}  ${String(r.who).slice(0, 40)}${r.reason ? `  (${r.reason})` : ''}`);
      if (rows.length > 15) console.log(`  ... ${rows.length - 15} more`);
      const fresh = rows.filter((r) => r.status === 'new');
      if (v['dry-run']) { console.log(`dry run: ${fresh.length} new payments (${usd(fresh.reduce((s, r) => s + r.usd, 0))}) would be added to ${v.path}. Nothing was written.`); return; }
      const res = importRecords(ledger, parsed.records, { path: v.path, via: 'csv:' + source, sourceTitle: title, verb: 'imported' });
      console.log(`imported ${res.added.length} payments (${usd(res.usd)}) into ${v.path}; ${rows.filter((r) => r.status === 'duplicate').length} were already on the ledger.`);
      return;
    }
    case 'serve': {
      const port = Number(v.port || process.env.PORT || 8790);
      const host = v.host || '127.0.0.1';
      const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
      if (!loopback) console.error(`note: listening on ${host}, so the localhost-only check is off. Anyone who can reach this address can use the station.`);
      const server = createServer({
        ledger, dataDir: DATA_DIR, runAgent, checkHost: loopback,
        makeProvider: () => { if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) console.error('note: no ANTHROPIC_API_KEY in env; the SDK will try an ant auth profile'); return makeAnthropicProvider(); },
      });
      server.listen(port, host, () => {
        console.log(`revenue station: http://${host}:${port}   money dashboard: http://${host}:${port}/ledger   (ledger ${LEDGER_FILE})`);
        if (v.open) openBrowser(`http://${host}:${port}`);
      });
      if (!v['no-scheduler']) {
        const dailyCapUsd = Number(v['daily-cap'] || process.env.REVENUE_ENGINE_DAILY_CAP || 5);
        createScheduler({
          ledger, runAgent, dataDir: DATA_DIR, dailyCapUsd, makeProvider: makeAnthropicProvider, catalog: () => loadCatalog(DATA_DIR),
          log: (e) => console.error(`[scheduler] ${JSON.stringify(e)}`),
        }).start(60e3);
        if (v['harvest-daily']) {
          const tick = () => harvest({ dataDir: DATA_DIR }).then((r) => console.error(`[harvest] ${r.added} new local businesses added`)).catch((e) => console.error(`[harvest] ${e.message}`));
          tick();
          setInterval(tick, 24 * 3600e3).unref();
          console.log('harvest on: pulls new Texas permits once a day into the gbp-management inbox ($0)');
        }
        const syncEvery = Number(v['sync-every'] ?? 15);
        if (syncEvery > 0) {
          const tick = () => syncAll({ ledger, dataDir: DATA_DIR }).then((rs) => rs.forEach((r) => { if (!r.ok) console.error(`[sync] ${r.id}: ${r.error}`); else if (r.imported) console.error(`[sync] ${r.id}: ${r.imported} new payments, ${usd(r.usd)}`); })).catch((e) => console.error(`[sync] ${e.message}`));
          setTimeout(tick, 15e3).unref();
          setInterval(tick, syncEvery * 60e3).unref();
          console.log(`income sync on: pulls new payments from your linked accounts every ${syncEvery} minutes (--sync-every 0 to turn off)`);
        }
        console.log(`scheduler on: checks jobs every minute, stops dispatching after $${dailyCapUsd} spent in a day (--daily-cap to change, --no-scheduler to turn off)`);
      }
      return;
    }
    default:
      console.log(HELP);
      throw new LedgerError(`unknown command "${cmd}"`);
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(process.env.DEBUG ? e : `error: ${e.message}`);
  process.exit(1);
});
