// The agent runner: one bounded, budgeted run of one role against one path.
// Real model calls, real cost on the ledger per iteration, real evidence required for every outcome.
// Agents never contact anyone. Drafts land in the outbox; a human sends them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { reduce } from './reduce.js';
import { CATALOG, getPath, stagesFor } from './paths.js';
import { costUsd, priceFor } from './cost.js';
import { LedgerError, STAGES } from './ledger.js';

// Token efficiency: routine work runs on the cheapest model that does it well, at modest effort.
// Pass --model claude-opus-5 for a run that needs more judgment. Opus/Fable get server-side refusal fallbacks.
export const DEFAULT_MODEL = 'claude-sonnet-5';
const NO_EFFORT = new Set(['claude-haiku-4-5']);
const FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-fable-5-1']);

// Kept stable so the prompt cache holds across runs. Nothing volatile goes in here.
const SYSTEM = `You are a worker on a small, honest revenue engine. One operator, real money, real evidence.

Laws:
1. Evidence or it did not happen. Every prospect you log needs a live URL you actually saw. Never invent a business, a person, a number, or a quote.
2. Zero is a valid result. If you cannot find enough that meets the bar, log what you found and say so plainly.
3. Respect the path's constraints exactly. They are legal and ethical limits, not preferences.
4. You never contact anyone. Drafts go to the outbox via write_note; a human sends them.
5. Keep prose short. Put the work into tool calls and files, not the chat.

Start by calling read_path. Finish with a plain summary: what you logged, what you wrote, what you could not find.`;

const list = (arr) => (arr && arr.length ? arr.map((c) => `- ${c}`).join('\n') : '- none');

export const ROLES = {
  prospector: {
    title: 'Prospector',
    logs: ['prospect'],
    webSearch: 5,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec, p, stages) => {
      const s = stages.find((x) => x.id === 'prospect');
      const have = p.outcomes.prospect;
      const want = Math.max(0, Math.min(s.target - have, 10));
      return `Path: ${spec.name} (${spec.id}).
Stage to fill: ${s.label}. ${have}/${s.target} logged so far. Log up to ${want} NEW prospects this run.

Constraints (hard limits):
${list(spec.constraints)}

Kill test for this path: ${spec.killTest}

Already logged, do not repeat:
${list(p.refs.prospect.map((r) => r.ref))}

For each prospect: exact business name, city and state, one line on why it fits this path, the best contact channel you can see (site form, listed email, phone, LinkedIn), and the live URL as evidence. Use web_search. Log each with log_outcome(stage="prospect"). Then write_note("prospects.md") with the same list plus one line per prospect on the angle a first message should take.`;
    },
  },
  outreach: {
    title: 'Outreach drafter',
    logs: [],
    webSearch: 0,
    model: 'claude-haiku-4-5',
    directive: (spec, p) => `Path: ${spec.name} (${spec.id}).
Read the path. For each prospect already logged (${p.refs.prospect.length} of them, listed by read_path), draft a first-touch message: 90 to 140 words, plain, specific to what the prospect's evidence URL shows, one concrete offer drawn from the path thesis, one question, no hype. Save one file per prospect with write_note("outreach-<short-slug>.md") and an index as write_note("outreach-index.md") listing file, prospect, channel, and the one-line angle.

Constraints (hard limits):
${list(spec.constraints)}

You never send anything. If there are no prospects logged, say so and stop.`,
  },
  creator: {
    title: 'Content creator',
    logs: [],
    webSearch: 2,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec, p) => `Path: ${spec.name} (${spec.id}).
Create 3 ready-to-post content packages. Each one is a separate file written with write_note("post-<short-slug>.md").

Each package contains, in this order:
1. Platform (pick the best fit: LinkedIn, X, Instagram Reels script, YouTube Short script, or blog. Never TikTok: the operator does not use it) and why.
2. Hook: the first line or first 2 seconds.
3. The full post text or full script, ready to paste or read.
4. Caption and up to 5 hashtags where the platform uses them.
5. Visual brief: what to film, screenshot or design, in 2-3 lines.
6. One call to action, pointing at a paid path or the email list.
7. Sources: a URL for every statistic or trend you cite. Claims you cannot source get cut.

Write from the operator's real experience: running call-center ops, building AI tools as a non-developer, local small-business growth. Do not invent a personal story, a client, a result or a number. Where a real example is needed, leave a bracketed placeholder like [your real example here].

Already published on this path, do not repeat:
${list(p.posts.map((x) => `${x.platform}: ${x.title}`))}

Constraints (hard limits):
${list(spec.constraints)}

Finish with write_note("post-index.md") listing each file, platform, hook and CTA. You never publish anything. The operator posts, then logs the live URL.`,
  },
  pricing: {
    title: 'Offer designer',
    logs: [],
    webSearch: 3,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec) => `Path: ${spec.name} (${spec.id}).
Draft an outcome-priced offer sheet: the promise in one sentence, how the outcome is measured, the price mechanics with a worked example at realistic numbers (month-12 range on file: $${spec.month12Usd[0]}-${spec.month12Usd[1]}/mo), what is excluded, pilot terms, and the three objections you expect with short answers. Any market price you cite must carry its URL (use web_search); label anything you could not verify as unverified. Save as write_note("offer-sheet.md").

Constraints (hard limits):
${list(spec.constraints)}`,
  },
};

const textOf = (message) => (message.content || [])
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('\n')
  .trim();

export function buildTools({ spec, ledger, runId, dataDir, allowedStages, log = () => {} }) {
  const outboxDir = path.join(dataDir, 'outbox', spec.id);

  const readPath = betaTool({
    name: 'read_path',
    description: 'Read the path spec, its constraints, and every outcome already on the ledger for it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const st = reduce(ledger.readAll());
      const p = st.paths[spec.id];
      return JSON.stringify({
        path: spec,
        stages: stagesFor(spec),
        progress: p ? { status: p.status, outcomes: p.outcomes, refs: p.refs, spentUsd: p.spentUsd, budgetUsd: p.budgetUsd, posts: p.posts.map((x) => ({ platform: x.platform, title: x.title, url: x.url, earnedUsd: x.earnedUsd })) } : null,
      }, null, 2);
    },
  });

  const logOutcome = betaTool({
    name: 'log_outcome',
    description: `Record one real outcome on the ledger. Stages this role may log: ${allowedStages.join(', ') || 'none'}. Rejected without a live URL as evidence.`,
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: [...STAGES] },
        ref: { type: 'string', description: 'The business or person, exactly as named on the evidence page.' },
        evidence: { type: 'string', description: 'The live http(s) URL you saw.' },
        note: { type: 'string', description: 'City/state, why it fits, best contact channel.' },
      },
      required: ['stage', 'ref', 'evidence'],
      additionalProperties: false,
    },
    run: async (input) => {
      if (!allowedStages.includes(input.stage)) return `error: this role may only log ${allowedStages.join(', ') || 'nothing'}`;
      if (!/^https?:\/\/\S+$/i.test(String(input.evidence).trim())) return 'error: evidence must be a single live http(s) URL';
      try {
        const ev = ledger.append({
          kind: 'outcome', path: spec.id, stage: input.stage, ref: input.ref,
          evidence: String(input.evidence).trim(), note: input.note, by: 'agent', runId,
        });
        log({ type: 'outcome', id: ev.id, stage: ev.stage, ref: ev.ref });
        return `logged ${ev.id}`;
      } catch (e) {
        if (e instanceof LedgerError) return `error: ${e.message}`;
        throw e;
      }
    },
  });

  const writeNote = betaTool({
    name: 'write_note',
    description: "Write a markdown file into this path's outbox. Drafts, offer sheets, research. A human reads and sends; you never send.",
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Plain basename ending in .md, e.g. prospects.md' },
        content: { type: 'string' },
      },
      required: ['filename', 'content'],
      additionalProperties: false,
    },
    run: async (input) => {
      const base = path.basename(String(input.filename));
      if (base !== input.filename || !/^[\w][\w.-]*\.md$/.test(base)) return 'error: filename must be a plain basename ending in .md';
      fs.mkdirSync(outboxDir, { recursive: true });
      const target = path.join(outboxDir, base);
      fs.writeFileSync(target, String(input.content));
      log({ type: 'note', file: target });
      return `saved ${target}`;
    },
  });

  return { readPath, logOutcome, writeNote, outboxDir };
}

// Provider adapters. Both expose { iterate(): AsyncIterable<message>, pushMessages(...) }.
function anthropicRunner(provider, params) {
  const extra = provider.noFallback || !FALLBACK_MODELS.has(params.model) ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
  const runner = provider.client.beta.messages.toolRunner({ ...params, ...extra });
  return { iterate: () => runner, pushMessages: (...m) => runner.pushMessages(...m) };
}

// Deterministic, zero-spend replay for tests and dry runs. Script steps: { text?, calls?: [{name,input}], usage?, stop? }.
// Tools execute AFTER the message is yielded, exactly like the SDK runner, so a budget break skips them.
function replayRunner(provider, params, toolList) {
  const script = provider.script || [];
  const runnable = Object.fromEntries(toolList.filter((t) => typeof t.run === 'function').map((t) => [t.name, t]));
  async function* gen() {
    for (let i = 0; i < script.length; i += 1) {
      const step = script[i];
      const calls = step.calls || [];
      const content = [];
      if (step.text) content.push({ type: 'text', text: step.text });
      calls.forEach((c, j) => content.push({ type: 'tool_use', id: `toolu_${i}_${j}`, name: c.name, input: c.input }));
      const stop = step.stop || (calls.length ? 'tool_use' : 'end_turn');
      yield { stop_reason: stop, usage: step.usage || { input_tokens: 1000, output_tokens: 200 }, content };
      if (stop === 'tool_use') {
        for (const c of calls) {
          const t = runnable[c.name];
          if (t) await t.run(c.input);
        }
      }
    }
  }
  return { iterate: gen, pushMessages: () => {} };
}

export async function runAgent(opts) {
  const { role: roleId, pathId, ledger, dataDir, provider, log = () => {} } = opts;
  const maxUsd = opts.maxUsd ?? 1;
  const maxIterations = opts.maxIterations ?? 8;
  const catalog = opts.catalog || CATALOG;

  const role = ROLES[roleId];
  if (!role) throw new Error(`unknown role "${roleId}" (${Object.keys(ROLES).join(', ')})`);
  const model = opts.model || role.model || DEFAULT_MODEL;
  const spec = getPath(pathId, catalog);
  if (!spec) throw new Error(`unknown path "${pathId}" (${catalog.map((p) => p.id).join(', ')})`);
  if (!provider || !['anthropic', 'replay'].includes(provider.kind)) throw new Error('provider must be { kind: "anthropic", client } or { kind: "replay", script }');

  const state = reduce(ledger.readAll(), catalog);
  const p = state.paths[spec.id];
  if (p.status !== 'active') throw new Error(`path "${spec.id}" is ${p.status}: ${p.statusReason}`);
  if (spec.gate && !(state.gates[spec.gate] && state.gates[spec.gate].cleared)) {
    throw new Error(`path "${spec.id}" is gated on "${spec.gate}". Clear it with evidence first: node src/cli.js gate ${spec.gate} --cleared --evidence "..."`);
  }
  const remaining = spec.budgetUsd - p.spentUsd;
  if (remaining <= 0) {
    throw new Error(`path "${spec.id}" has spent $${p.spentUsd.toFixed(2)} of its $${spec.budgetUsd} budget. The cap is real: raise budgetUsd in paths.js or kill the path.`);
  }
  if (!priceFor(model, opts.price)) {
    throw new Error(`no price on file for model "${model}". Pass price {in,out} in USD per 1M tokens so spend is never recorded as $0.`);
  }

  const cap = Math.min(maxUsd, remaining);
  const runId = opts.runId || crypto.randomBytes(6).toString('hex');
  const tools = buildTools({ spec, ledger, runId, dataDir, allowedStages: role.logs, log });
  const toolList = [tools.readPath, tools.logOutcome, tools.writeNote];
  if (role.webSearch > 0 && provider.kind === 'anthropic') {
    toolList.push({ type: 'web_search_20260209', name: 'web_search', max_uses: role.webSearch });
  }
  const directive = role.directive(spec, p, stagesFor(spec));

  ledger.append({ kind: 'agent.run.start', runId, path: spec.id, role: roleId, model, maxUsd: cap, ...(opts.jobId ? { jobId: opts.jobId } : {}) });
  log({ type: 'start', runId, path: spec.id, role: roleId, model, maxUsd: cap });

  const params = {
    model,
    max_tokens: 8000,
    ...(role.effort && !NO_EFFORT.has(model) ? { output_config: { effort: role.effort } } : {}),
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: directive }],
    tools: toolList,
    max_iterations: maxIterations,
  };

  let usd = 0;
  let iterations = 0;
  let reason = null;
  let lastText = '';
  const tokens = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };

  try {
    const runner = provider.kind === 'anthropic' ? anthropicRunner(provider, params) : replayRunner(provider, params, toolList);
    for await (const message of runner.iterate()) {
      iterations += 1;
      const u = message.usage || {};
      const c = costUsd(model, u, opts.price) || 0;
      usd += c;
      tokens.in += u.input_tokens || 0;
      tokens.out += u.output_tokens || 0;
      tokens.cacheRead += u.cache_read_input_tokens || 0;
      tokens.cacheWrite += u.cache_creation_input_tokens || 0;
      ledger.append({ kind: 'money.out', usd: c, category: 'api', path: spec.id, runId, evidence: `${model} iteration ${iterations}` });
      lastText = textOf(message) || lastText;
      log({ type: 'iteration', iterations, stop: message.stop_reason, usd: c, cumulativeUsd: usd });

      if (message.stop_reason === 'pause_turn') { runner.pushMessages({ role: 'assistant', content: message.content }); continue; }
      if (message.stop_reason === 'refusal') { reason = 'refusal'; break; }
      if (message.stop_reason === 'end_turn') { reason = 'done'; break; }
      if (usd >= cap) { reason = 'budget'; break; }
      if (iterations >= maxIterations) { reason = 'max_iters'; break; }
    }
    if (!reason) reason = iterations >= maxIterations ? 'max_iters' : 'done';
  } catch (err) {
    reason = 'error';
    log({ type: 'error', message: err.message });
    ledger.append({ kind: 'note', runId, path: spec.id, text: `run ${runId} error: ${err.message}` });
  }

  ledger.append({ kind: 'agent.run.end', runId, path: spec.id, role: roleId, model, usd, tokens, iterations, reason });
  log({ type: 'end', runId, reason, usd, iterations });
  return { runId, reason, usd, iterations, summary: lastText, outbox: tools.outboxDir };
}
