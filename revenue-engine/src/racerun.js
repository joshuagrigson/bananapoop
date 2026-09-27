// One room's turn in a simulation race, run by Claude on its own: it researches the real web (search and fetch), finds
// what is selling, the gaps nobody fills and what buyers complain about in what exists, tests ideas in the market
// simulator, builds the real thing in the sandbox and launches the best variant in the simulated market. It can read
// the web; it cannot send, post, list or buy anything: every write goes to the ledger, nowhere else.
import crypto from 'node:crypto';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { reduce } from './reduce.js';
import { raceBoard, raceBrief } from './race.js';
import { costUsd, priceFor } from './cost.js';
import { LedgerError, RESEARCH_TOPICS } from './ledger.js';
import { SIM_CHANNELS, SIM_ARTIFACTS, SimError } from './sim.js';

export const RACE_RUN_MODEL = 'claude-sonnet-5';

const SYSTEM = `You are a contestant agent in a simulation race on a money ledger. Your job is to find what could really make money, using real, current data from the web, and prove it as far as a simulation can.

Laws:
1. Real data only. Every number you use comes from a page you read; log it with log_research and its url. Never invent a statistic, price, seller, review or quote.
2. Nothing leaves the station. You never send, post, publish, list or buy anything. You build the real thing with build (the full email, full page, full listing) so it is ready if Joshua presses REAL MONEY.
3. There is no list of allowed ideas: any legal way to make money your research supports is yours to choose, including a high-risk, high-reward long shot when the evidence makes the case (simulate it with channel "venture": attempts a month, cost per attempt, the base rate of winning with its source, and the typical payoff). Look in three places: what is trending now; gaps (demand with few or weak sellers, unanswered questions, underserved buyers); and improvements (products that sell but get complaints: read reviews and threads, then design the better version).
4. Size the market from real numbers before you test: monthly demand in the niche (views, searches, job posts or buyers), how many sellers compete for it, and its yearly growth, each with its source. Put them in spec.demand with cites; they drive the forecast more than anything else.
5. Test widely with simulate (many variants: channel, price, offer, volume), cite your sources in each spec's cites, then launch the best one. Don't game the simulator: uncited numbers are ignored or held to benchmarks.
6. Keep prose short. Finish with a plain summary of what you found, tested, built and launched.`;

const TOPICS = Object.keys(RESEARCH_TOPICS);

function tools({ ledger, catalog, roomId, runId, now, log }) {
  const board = () => raceBoard(reduce(ledger.readAll(), catalog), catalog, now());
  const append = (ev) => { try { const e = ledger.append({ ...ev, path: roomId, by: 'agent', runId }); log({ type: ev.kind, act: ev.act, id: e.id }); return e; } catch (e) { if (e instanceof LedgerError || e instanceof SimError) return { error: e.message }; throw e; } };
  const err = (e) => `error: ${e.error}`;
  return [
    betaTool({
      name: 'read_board', description: 'Your room: bankroll, plays, what you researched, tested, built and launched, and the race standings.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => {
        const b = board(); const l = b.lanes.find((x) => x.id === roomId);
        return JSON.stringify({ day: b.day, totalDays: b.totalDays, mode: b.mode, speed: b.sim && b.sim.speedLabel, standings: b.lanes.map((x) => ({ id: x.id, place: x.place, score: x.scoreText })), you: { bankroll: l.bankrollUsd, plays: l.plays.map((p) => ({ id: p.id, name: p.name, status: p.status, net: p.netUsd, sim: p.sim && { live: p.sim.live, line: p.sim.line, forecast: p.sim.forecast && p.sim.forecast.net } })), sim: l.sim, timeline: l.timeline.slice(0, 25) }, topIdeasAllRooms: b.sim && b.sim.topIdeas.slice(0, 6) });
      },
    }),
    betaTool({
      name: 'log_research', description: `Log one finding from a page you read. topic: ${TOPICS.join(', ')}. Use "gap" style findings under demand/competition and complaints under idea.`,
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string', description: 'What the page shows, with its numbers' }, url: { type: 'string' }, topic: { type: 'string', enum: TOPICS }, numbers: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' } }, required: ['label', 'value'] } }, play: { type: 'string' } }, required: ['title', 'text', 'url', 'topic'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'research', ...i }); return e.error ? err(e) : `logged ${e.id}`; },
    }),
    betaTool({
      name: 'simulate', description: `Test 1-24 variants in the market simulator (200 runs each). Each: { label, spec: { channel (${Object.keys(SIM_CHANNELS).join('|')}), price, volume, recurring?, churn?, unitCost?, platform?, feePct?, fixedPerMonth?, capacityPerDay?, hoursPerSale?, audience?, marketPrice?, competition (low|medium|high), trend (rising|flat|falling), rates?, cites?: { key: url }, demand?: { monthly, kind: views|searches|posts|buyers, sellers, growth (yearly, 0.45 = +45%), cites: { monthly, sellers, growth } } } }. Sourced demand sizes the market. Returns ranges and odds of profit, best first, plus notes where the simulator overrode you.`,
      inputSchema: { type: 'object', properties: { variants: { type: 'array', items: { type: 'object' } }, play: { type: 'string' } }, required: ['variants'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'sim', act: 'test', variants: i.variants, ...(i.play ? { play: i.play } : {}) }); return e.error ? err(e) : JSON.stringify(e.variants.map((v) => ({ label: v.label, net: v.result.net, pProfit: v.result.pProfit, breakEvenDay: v.result.breakEvenDay, flags: v.flags }))); },
    }),
    betaTool({
      name: 'log_play', description: 'Start or update a play (one way to make money) with its business model.',
      inputSchema: { type: 'object', properties: { play: { type: 'string', description: 'id: lowercase-with-dashes' }, name: { type: 'string' }, status: { type: 'string', enum: ['trying', 'working', 'paused', 'dropped'] }, plan: { type: 'string' }, why: { type: 'string' }, method: { type: 'string' }, offer: { type: 'string' }, customer: { type: 'string' }, channel: { type: 'string' }, pricing: { type: 'string' }, costs: { type: 'string' } }, required: ['play', 'name', 'status'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'play', ...i }); return e.error ? err(e) : `play ${i.play}: ${i.status}`; },
    }),
    betaTool({
      name: 'build', description: `Build the real thing in the sandbox (never sent anywhere): what = ${Object.keys(SIM_ARTIFACTS).join('|')}; content is the full text or HTML.`,
      inputSchema: { type: 'object', properties: { what: { type: 'string', enum: Object.keys(SIM_ARTIFACTS) }, title: { type: 'string' }, content: { type: 'string' }, format: { type: 'string', enum: ['text', 'markdown', 'html'] }, to: { type: 'string' }, play: { type: 'string' } }, required: ['what', 'title', 'content'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'sim', act: 'build', ...i }); return e.error ? err(e) : `built ${e.id}`; },
    }),
    betaTool({
      name: 'launch', description: 'Put one variant live in the simulated market for a play (relaunching replaces its spec).',
      inputSchema: { type: 'object', properties: { play: { type: 'string' }, spec: { type: 'object' }, label: { type: 'string' } }, required: ['play', 'spec'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'sim', act: 'launch', ...i }); return e.error ? err(e) : JSON.stringify({ launched: i.play, forecast: e.forecast.net, notes: e.flags }); },
    }),
    betaTool({
      name: 'stop', description: 'Take a play out of the simulated market.',
      inputSchema: { type: 'object', properties: { play: { type: 'string' }, why: { type: 'string' } }, required: ['play'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'sim', act: 'stop', ...i }); return e.error ? err(e) : `stopped ${i.play}`; },
    }),
    betaTool({
      name: 'log_step', description: 'Log your plan, something you did or learned, or where you need Joshua (blocked).',
      inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['did', 'plan', 'learned', 'blocked'] }, text: { type: 'string' }, play: { type: 'string' }, url: { type: 'string' } }, required: ['type', 'text'], additionalProperties: false },
      run: async (i) => { const e = append({ kind: 'step', ...i }); return e.error ? err(e) : `step ${e.id}`; },
    }),
  ];
}

// provider: { kind: 'anthropic', client } or { kind: 'replay', script: [{ calls: [{ name, input }] }] }
export async function runRoom({ ledger, catalog, roomId, provider, model = null, maxUsd = 1, maxIterations = 30, searches = 12, now = () => Date.now(), log = () => {} }) {
  const st = reduce(ledger.readAll(), catalog), b = raceBoard(st, catalog, now());
  if (!b) throw new LedgerError('no race yet');
  if (!b.lanes.some((l) => l.id === roomId)) throw new LedgerError(`room "${roomId}" is not in the race`);
  if (!b.simMode) throw new LedgerError('race run drives simulation races; this race uses ' + b.mode + ' money');
  const m = model || b.rules.models[roomId] || RACE_RUN_MODEL;
  if (!priceFor(m)) throw new LedgerError(`no price on file for model "${m}"`);
  const runId = crypto.randomBytes(6).toString('hex');
  const toolList = tools({ ledger, catalog, roomId, runId, now, log });
  const room = catalog.find((c) => c.id === roomId);
  const brief = raceBrief(b, roomId, { roomName: room ? room.name : roomId });
  ledger.append({ kind: 'agent.run.start', runId, path: roomId, role: 'racer', model: m, maxUsd });
  let usd = 0, iterations = 0, reason = 'done', summary = '';
  try {
    if (provider.kind === 'replay') {
      const byName = Object.fromEntries(toolList.map((t) => [t.name, t]));
      for (const step of provider.script || []) { iterations++; for (const c of step.calls || []) if (byName[c.name]) await byName[c.name].run(c.input); if (step.text) summary = step.text; }
    } else {
      const runner = provider.client.beta.messages.toolRunner({
        model: m, max_tokens: 16000, max_iterations: maxIterations,
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [...toolList, { type: 'web_search_20260209', name: 'web_search', max_uses: searches }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: searches }],
        messages: [{ role: 'user', content: `${brief}\n\nThis is one check-in. Use the tools, not the command line: read_board first, then research, test, build and launch. Stop when this check-in's work is logged.` }],
      });
      for await (const msg of runner) {
        iterations++;
        const c = costUsd(m, msg.usage || {}) || 0; usd += c;
        ledger.append({ kind: 'money.out', usd: c, category: 'api', path: roomId, runId, evidence: `${m} iteration ${iterations}` });
        const t = (msg.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n').trim(); if (t) summary = t;
        log({ type: 'iteration', iterations, usd });
        if (msg.stop_reason === 'refusal') { reason = 'refusal'; break; }
        if (usd >= maxUsd) { reason = 'budget'; break; }
      }
    }
  } catch (e) { reason = 'error'; summary = e.message; }
  ledger.append({ kind: 'agent.run.end', runId, path: roomId, role: 'racer', model: m, usd, iterations, reason });
  return { runId, reason, usd, iterations, summary };
}
