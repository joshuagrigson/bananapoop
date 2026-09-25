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
import { listItems, markDone } from './inbox.js';
import { dueClients, markPacked } from './clients.js';

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
  auditor: {
    title: 'Google profile auditor',
    logs: ['prospect'],
    inbox: 'lead',
    webSearch: 8,
    model: 'claude-sonnet-5',
    effort: 'low',
    directive: (spec) => `Path: ${spec.name} (${spec.id}).
Call read_inbox. Each item is a local business, usually a new one from public Texas permit records. Audit at most 4 this run.

For EACH business:
1. web_search the business name + city. Find its website, its Google Business Profile or Maps listing, and its review count and rating where the results show them. Then web_search "<its category> in <city>" to see who shows up first. Use at most 2 searches per business.
2. Score how WEAK its Google presence is, 0-10. 10 = no profile found at all. 0 = strong profile with lots of recent reviews.
   Things that make it weak: no profile found, few or no reviews, a missing website link, no hours, no photos or services visible, and competitors clearly ahead.
3. If the weakness score is 6 or more, write_note("audit-<short-slug>.md") with these parts:
   a. What you found, as a small table: profile found?, reviews/rating, website, hours, and the 3 competitors that show first. Every cell you did not actually see says "not seen", never a guess.
   b. The 3 fixes that matter most, in plain words an owner understands.
   c. A 2-minute video script for the operator to read while screen-sharing their Google search. Open by naming their business and street. Walk the 3 fixes. End with one low-pressure question.
   d. A 2-sentence text or email the operator can send with the video link.
   Then log_outcome(stage="prospect", ref="<business name> (<city>)", evidence=<the lead's url, or their listing or website URL>).
4. mark_done(id, verdict) for every business with the score and a one-line reason, even ones you skip.
Finish with write_note("audit-report.md"): every business audited, its score, and the verdict, weakest first.

Constraints (hard limits):
${list(spec.constraints)}`,
  },
  manager: {
    title: 'Monthly GBP manager',
    logs: [],
    clients: true,
    webSearch: 2,
    maxIterations: 12,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec) => `Path: ${spec.name} (${spec.id}).
Call read_clients. Each is a paying client whose monthly pack is due. For EACH client, write_note("pack-<client-slug>-<yyyy-mm>.md") containing:
1. 6 Google Business Profile posts, each 80-150 words: an update, an offer or an event, with a call-to-action button suggestion (Book, Call, Learn more) and a one-line photo brief. Tie them to this month's season, local events you can verify with a quick search, and the client's notes.
2. 5 Q&A pairs customers actually ask about this kind of business, answered in the client's voice.
3. A reply draft for every review pasted in the client's notes. Thank them by name, be specific, never argue, and keep it under 60 words. Negative reviews get a calm reply that offers to fix it offline.
4. A photo shot list: 6 shots the owner can take on a phone this month.
5. A short monthly report, written to the owner: what was posted and why. Leave [calls], [direction requests] and [website clicks] as blanks for the operator to fill from the profile's performance screen. Never invent those numbers.
Then mark_packed(id, summary) for each client.

Voice: plain, local, specific to the business. No hype, no keyword stuffing, no made-up promotions: an offer only appears if it is in the client's notes.

Constraints (hard limits):
${list(spec.constraints)}`,
  },
  lister: {
    title: 'Gig lister',
    logs: [],
    webSearch: 3,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec) => `Path: ${spec.name} (${spec.id}).
Write the storefront the operator will publish by hand.

1. Three Fiverr gigs, one file each: write_note("gig-<short-slug>.md"). Pick the three strongest from this menu:
${list(spec.gigMenu)}
Each gig file has: title (under 80 characters, starts with "I will"), category and subcategory, three packages (Basic / Standard / Premium) with price, delivery days and exactly what is included, a description under 1,200 characters, 5 FAQ with answers, the questions to ask the buyer at order time, and 5 search tags.
2. write_note("upwork-profile.md"): profile title, an overview under 1,200 characters written in first person, and three Project Catalog entries with scope, price and delivery time.

Pricing: check what comparable gigs charge with web_search and cite each URL. Price slightly under the middle of the market for the first five reviews and say so. Mark any price you could not check as a guess.
Write from the operator's real background: call-center operations, lead management, dialers, CRM automations, AI tools built as a non-developer, local small-business websites. Never invent reviews, clients, results or credentials; use [bracketed placeholders] for real examples.

Constraints (hard limits):
${list(spec.constraints)}`,
  },
  scout: {
    title: 'Job scout',
    logs: ['prospect'],
    inbox: 'post',
    webSearch: 0,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec) => `Path: ${spec.name} (${spec.id}).
Call read_inbox. It holds job posts the operator pasted from Upwork or Fiverr. For EACH post:
1. Score fit 0-10 against what this desk sells:
${list(spec.gigMenu)}
Score down for: budget under $30, no payment method verified, vague scope, requests for unpaid test work, payment or contact off-platform, anything needing employer data or call recordings.
2. If the score is 7 or more: write_note("proposal-<short-slug>.md") with a proposal under 150 words. First two lines name their exact problem in their words. Then how you would do it in 3 short steps, one [your real proof point here] placeholder, the price and delivery time, and one question that shows you read the post. No fluff, no "I hope this finds you well".
   If the post has a URL, log_outcome(stage="prospect", ref="<client or job title>", evidence=<post URL>).
3. mark_done(id, verdict) with the score and a one-line reason, for every post, fit or not.
Finish with write_note("scout-report.md"): a table of every post with score, verdict and reason, best first.

Constraints (hard limits):
${list(spec.constraints)}`,
  },
  fulfiller: {
    title: 'Deliverable drafter',
    logs: [],
    inbox: 'job',
    webSearch: 4,
    maxIterations: 14,
    model: 'claude-sonnet-5',
    effort: 'medium',
    directive: (spec) => `Path: ${spec.name} (${spec.id}).
Call read_inbox. It holds jobs the operator WON, each with the client's brief. For EACH job:
1. Draft the complete deliverable: write_note("deliverable-<short-slug>.md"). Do the actual work (research, list, copy, sequence, automation spec with exact steps), not an outline of it. For research, use web_search and put the source URL next to every fact, lead or number.
2. write_note("delivery-note-<short-slug>.md"): a short message to the client that hands over the work, says what is included, and asks one question that could lead to repeat work.
3. At the top of the deliverable, add a REVIEW CHECKLIST: every fact, link, number or claim the operator must verify before sending.
4. mark_done(id, verdict) with what you delivered and anything you could not finish.
If a brief is too vague to do well, write the questions to ask the client instead of guessing, and mark it done with verdict "needs client answers".

Constraints (hard limits):
${list(spec.constraints)}`,
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

export function buildTools({ spec, ledger, runId, dataDir, allowedStages, inboxType = null, log = () => {} }) {
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

  const readInbox = betaTool({
    name: 'read_inbox',
    description: 'Read the pending items the operator put in this path\'s inbox for you (job posts to score, or won jobs to fulfill).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const items = inboxType ? listItems(dataDir, spec.id, { type: inboxType }).slice(0, 10) : [];
      if (!items.length) return 'inbox is empty';
      return JSON.stringify(items.map((i) => ({ id: i.id, url: i.url, title: i.title, text: i.text.slice(0, 6000) })), null, 2);
    },
  });

  const markDoneTool = betaTool({
    name: 'mark_done',
    description: 'Mark one inbox item handled, with your verdict (score and reason, or what you delivered).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, verdict: { type: 'string' } },
      required: ['id', 'verdict'],
      additionalProperties: false,
    },
    run: async (input) => {
      try {
        const item = markDone(dataDir, spec.id, input.id, input.verdict);
        log({ type: 'inbox', id: item.id, verdict: item.verdict });
        return `marked ${item.id} done`;
      } catch (e) {
        if (e instanceof LedgerError) return `error: ${e.message}`;
        throw e;
      }
    },
  });

  const readClients = betaTool({
    name: 'read_clients',
    description: 'Read the clients on this path whose monthly pack is due: business, city, category, services, website, and the operator\'s notes for this month.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const due = dueClients(dataDir, spec.id).slice(0, 5);
      if (!due.length) return 'no clients are due';
      return JSON.stringify(due.map((c) => ({ id: c.id, name: c.name, city: c.city, category: c.category, website: c.website, services: c.services, notes: c.notes, lastPackAt: c.lastPackAt })), null, 2);
    },
  });

  const markPackedTool = betaTool({
    name: 'mark_packed',
    description: 'Mark one client\'s monthly pack as written, with a one-line summary.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, summary: { type: 'string' } },
      required: ['id', 'summary'],
      additionalProperties: false,
    },
    run: async (input) => {
      try {
        const c = markPacked(dataDir, spec.id, input.id, input.summary);
        log({ type: 'packed', id: c.id, name: c.name });
        return `marked ${c.name} packed`;
      } catch (e) {
        if (e instanceof LedgerError) return `error: ${e.message}`;
        throw e;
      }
    },
  });

  return { readPath, logOutcome, writeNote, readInbox, markDone: markDoneTool, readClients, markPacked: markPackedTool, outboxDir };
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

// Why a role has nothing to do on this path right now, or null if it has work.
export function idleReason(role, dataDir, pathId) {
  if (role.inbox && !listItems(dataDir, pathId, { type: role.inbox }).length) return `inbox has no pending ${role.inbox} items`;
  if (role.clients && !dueClients(dataDir, pathId).length) return 'no client packs are due';
  return null;
}

export async function runAgent(opts) {
  const { role: roleId, pathId, ledger, dataDir, provider, log = () => {} } = opts;
  const maxUsd = opts.maxUsd ?? 1;
  const catalog = opts.catalog || CATALOG;

  const role = ROLES[roleId];
  if (!role) throw new Error(`unknown role "${roleId}" (${Object.keys(ROLES).join(', ')})`);
  const model = opts.model || role.model || DEFAULT_MODEL;
  const maxIterations = opts.maxIterations ?? role.maxIterations ?? 8;
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

  // Roles with nothing to do skip before any model call: a scheduled scout or manager with no work costs $0.
  const idle = idleReason(role, dataDir, spec.id);
  if (idle) {
    log({ type: 'skipped', reason: idle });
    return { skipped: true, reason: idle, usd: 0, iterations: 0 };
  }

  const cap = Math.min(maxUsd, remaining);
  const runId = opts.runId || crypto.randomBytes(6).toString('hex');
  const tools = buildTools({ spec, ledger, runId, dataDir, allowedStages: role.logs, inboxType: role.inbox || null, log });
  const toolList = [tools.readPath, tools.logOutcome, tools.writeNote, ...(role.inbox ? [tools.readInbox, tools.markDone] : []), ...(role.clients ? [tools.readClients, tools.markPacked] : [])];
  if (role.webSearch > 0 && provider.kind === 'anthropic') {
    // The dynamic-filtering search tool needs a newer model; Haiku gets the basic version.
    toolList.push({ type: NO_EFFORT.has(model) ? 'web_search_20250305' : 'web_search_20260209', name: 'web_search', max_uses: role.webSearch });
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
