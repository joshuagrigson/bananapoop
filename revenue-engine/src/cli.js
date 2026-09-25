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
import { seedDemo } from './demo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DATA_DIR = process.env.REVENUE_ENGINE_DATA || path.join(ROOT, 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.jsonl');

const usd = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

const HELP = `revenue-engine

  status                                   headline numbers, level, open quests
  log-in <usd> --path P --source S --evidence E [--post POST_ID]   real money received
  log-out <usd> --category C [--path P] --evidence E  real money spent (api|tool|ads|capital|other)
  outcome <path> <stage> --ref R --evidence E         prospect|conversation|demo|pilot|paid|retained
  gate <name> --cleared|--blocked --evidence E        e.g. gate employment-agreement --cleared --evidence "read 2026-09-26, no non-compete"
  path-status <path> <active|paused|killed> --reason R
  post <path> --platform X --url U --title T          a post you published (live URL required)
  job add <role> --path P --every HOURS --max-usd N    a standing order the scheduler runs
  job off <jobId>                                      disable a job
  jobs                                                 list jobs
  seed-demo                                            fill an EMPTY data dir with labeled demo data
  run <role> --path P [--max-usd 2] [--model ${DEFAULT_MODEL}] [--provider anthropic|replay --script file.json]
  serve [--port 8790] [--host 127.0.0.1] [--daily-cap 5] [--no-scheduler]
  paths                                    the catalog
  help

Data dir: ${DATA_DIR}  (override with REVENUE_ENGINE_DATA)`;

function makeAnthropicProvider() {
  // Lazy import so status/log commands never load the SDK. Zero-arg client resolves ANTHROPIC_API_KEY or an ant profile.
  return import('@anthropic-ai/sdk').then(({ default: Anthropic }) => ({ kind: 'anthropic', client: new Anthropic(), noFallback: Boolean(process.env.REVENUE_ENGINE_NO_FALLBACK) }));
}

async function providerFrom(v) {
  if (v.provider === 'replay') {
    if (!v.script) throw new Error('--provider replay needs --script <file.json>');
    return { kind: 'replay', script: JSON.parse(fs.readFileSync(path.resolve(v.script), 'utf8')) };
  }
  return makeAnthropicProvider();
}

function printStatus(ledger) {
  const st = reduce(ledger.readAll());
  const lv = commanderLevel(st);
  const q = quests(st);
  const sum = summary(q);
  const y = st.spentUsd > 0 ? st.yieldRatio.toFixed(2) : 'n/a (nothing spent)';
  console.log(`earned ${usd(st.earnedUsd)} | spent ${usd(st.spentUsd)} | yield ${y} | Commander L${lv.level} (${lv.title})${lv.next ? ` | ${usd(lv.next.remainingUsd)} to ${lv.next.title}` : ''}`);
  console.log(`events ${st.eventCount} | runs ${st.runs.length}${st.running.length ? ` (+${st.running.length} live)` : ''} | quests ${sum.open} open / ${sum.done} done\n`);
  for (const p of CATALOG) {
    const s = st.paths[p.id];
    const gated = p.gate && !(st.gates[p.gate] && st.gates[p.gate].cleared);
    const stages = Object.entries(s.outcomes).map(([k, n]) => `${k} ${k === 'paid' ? Math.max(n, s.moneyIn.length) : n}`).join(' · ');
    console.log(`#${p.rank} ${p.name} [${s.status}${gated ? ', gated' : ''}] earned ${usd(s.earnedUsd)} spent ${usd(s.spentUsd)}/${usd(p.budgetUsd)}\n    ${stages}`);
  }
  console.log('\nOPEN QUESTS');
  for (const x of q.filter((i) => i.status === 'open')) console.log(`  [ ] ${x.title}${x.progress ? ` (${x.progress.n}/${x.progress.target})` : ''}${x.blocked ? ' BLOCKED' : ''}${x.gated ? ' gated' : ''}\n      ${x.desc}`);
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
      every: { type: 'string' }, 'daily-cap': { type: 'string' }, 'no-scheduler': { type: 'boolean' },
    },
  });
  const [cmd, ...rest] = pos;
  const ledger = new Ledger(LEDGER_FILE);

  switch (cmd) {
    case undefined:
    case 'help':
      console.log(HELP); return;
    case 'status':
      printStatus(ledger); return;
    case 'paths':
      for (const p of CATALOG) console.log(`#${p.rank} ${p.id}\n   ${p.name} (${p.bucket})${p.gate ? ` gate: ${p.gate}` : ''}\n   ${p.thesis}\n   kill test: ${p.killTest}\n`);
      console.log('GATES'); for (const [k, g] of Object.entries(GATES)) console.log(`   ${k}: ${g.title}`);
      return;
    case 'log-in': {
      const ev = ledger.append({ kind: 'money.in', usd: Number(rest[0]), path: v.path, source: v.source, evidence: v.evidence, ...(v.post ? { postId: v.post } : {}) });
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
        if (!CATALOG.some((p) => p.id === v.path)) throw new LedgerError('job add needs a known --path');
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
    case 'seed-demo': {
      const n = seedDemo(ledger, DATA_DIR);
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
      console.log(JSON.stringify(result, null, 2)); return;
    }
    case 'serve': {
      const port = Number(v.port || process.env.PORT || 8790);
      const host = v.host || '127.0.0.1';
      const server = createServer({
        ledger, dataDir: DATA_DIR, runAgent,
        makeProvider: () => { if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) console.error('note: no ANTHROPIC_API_KEY in env; the SDK will try an ant auth profile'); return makeAnthropicProvider(); },
      });
      server.listen(port, host, () => console.log(`revenue station: http://${host}:${port}   money dashboard: http://${host}:${port}/ledger   (ledger ${LEDGER_FILE})`));
      if (!v['no-scheduler']) {
        const dailyCapUsd = Number(v['daily-cap'] || process.env.REVENUE_ENGINE_DAILY_CAP || 5);
        createScheduler({
          ledger, runAgent, dataDir: DATA_DIR, dailyCapUsd, makeProvider: makeAnthropicProvider,
          log: (e) => console.error(`[scheduler] ${JSON.stringify(e)}`),
        }).start(60e3);
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
