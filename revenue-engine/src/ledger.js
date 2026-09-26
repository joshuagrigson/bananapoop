// Append-only JSONL ledger. Every number the engine shows traces back to a line in this file.
// Law 1 (borrowed from StarNet): the interface never asserts a state the ledger cannot prove.
// Law 2 (ours): money.in without evidence is rejected at the door. No evidence, no revenue.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const KINDS = Object.freeze([
  'money.in', 'money.out', 'outcome', 'post', 'job', 'agent.run.start', 'agent.run.end', 'path.status', 'gate', 'note',
]);
export const STAGES = Object.freeze(['prospect', 'conversation', 'demo', 'pilot', 'paid', 'retained']);
export const OUT_CATEGORIES = Object.freeze(['api', 'tool', 'ads', 'capital', 'other']);
export const RUN_REASONS = Object.freeze(['done', 'budget', 'max_iters', 'refusal', 'error']);
export const PATH_STATUSES = Object.freeze(['active', 'paused', 'killed']);

const isText = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;
const isUsd = (v) => typeof v === 'number' && Number.isFinite(v);
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());

export class LedgerError extends Error {}
const fail = (msg) => { throw new LedgerError(msg); };

// Returns a normalized copy of the event or throws LedgerError. Pure.
export function validate(input) {
  if (!input || typeof input !== 'object') fail('event must be an object');
  const ev = { ...input };
  if (!KINDS.includes(ev.kind)) fail(`unknown kind "${ev.kind}" (${KINDS.join(', ')})`);
  ev.ts = isText(ev.ts) ? ev.ts : new Date().toISOString();
  if (Number.isNaN(Date.parse(ev.ts))) fail('ts must be an ISO-8601 date');
  ev.id = isText(ev.id) ? ev.id : crypto.randomBytes(6).toString('hex');

  switch (ev.kind) {
    case 'money.in':
      if (!isUsd(ev.usd) || ev.usd <= 0) fail('money.in needs usd > 0');
      if (!isText(ev.path)) fail('money.in needs a path id');
      if (!isText(ev.source)) fail('money.in needs a source (who paid)');
      if (!isText(ev.evidence, 3)) fail('money.in needs evidence (invoice id, Stripe charge, bank line). No evidence, no revenue.');
      if (ev.postId !== undefined && !isText(ev.postId)) fail('money.in postId must be a post event id');
      if (ev.tag !== undefined && !isText(ev.tag)) fail('money.in tag must be text, e.g. the gig type');
      if (ev.hours !== undefined && !(typeof ev.hours === 'number' && ev.hours > 0 && ev.hours < 1000)) fail('money.in hours must be a positive number');
      // synced or imported payments carry the platform's own transaction id, so the same payment is never counted twice
      if (ev.ext !== undefined && !(isText(ev.ext, 3) && ev.ext.length <= 200)) fail('money.in ext must be the platform transaction id (3-200 chars)');
      if (ev.via !== undefined && !(isText(ev.via) && ev.via.length <= 40)) fail('money.in via must name the connector, e.g. stripe');
      // what was sold, as the platform named it ("Skin fade"): rooms claim money by item name
      if (ev.item !== undefined && !(isText(ev.item) && ev.item.length <= 120)) fail('money.in item must be the service or product name (1-120 chars)');
      if (ev.qty !== undefined && !(typeof ev.qty === 'number' && ev.qty > 0 && ev.qty < 10000)) fail('money.in qty must be a positive number');
      if (ev.tip !== undefined && !(isUsd(ev.tip) && ev.tip >= 0 && ev.tip <= ev.usd)) fail('money.in tip must be between 0 and the amount');
      if (ev.grp !== undefined && !(isText(ev.grp, 3) && ev.grp.length <= 200)) fail('money.in grp must be the parent transaction id');
      // allowance stations: which kid earned it
      if (ev.kid !== undefined && !(isText(ev.kid) && ev.kid.length <= 40)) fail('money.in kid must be the name of the kid who did the chore');
      break;
    case 'post':
      if (!isText(ev.path)) fail('post needs a path id');
      if (!isText(ev.platform)) fail('post needs a platform (youtube, x, linkedin, instagram, blog, ...)');
      if (!isUrl(ev.url)) fail('post needs the live http(s) URL of the published post. Drafts are not posts.');
      if (!isText(ev.title)) fail('post needs a title or first line');
      if (!['user', 'agent'].includes(ev.by)) fail('post.by must be "user" or "agent"');
      break;
    case 'job':
      if (!isText(ev.jobId)) fail('job needs a jobId');
      if (!isText(ev.role) || !isText(ev.path)) fail('job needs role and path');
      if (typeof ev.everyHours !== 'number' || !(ev.everyHours >= 1)) fail('job.everyHours must be >= 1');
      if (!isUsd(ev.maxUsd) || ev.maxUsd <= 0) fail('job.maxUsd must be > 0');
      if (typeof ev.enabled !== 'boolean') fail('job.enabled must be true or false');
      break;
    case 'money.out':
      if (!isUsd(ev.usd) || ev.usd < 0) fail('money.out needs usd >= 0');
      if (!OUT_CATEGORIES.includes(ev.category)) fail(`money.out category must be one of ${OUT_CATEGORIES.join(', ')}`);
      if (!isText(ev.path)) ev.path = 'general';
      if (!isText(ev.evidence) && !isText(ev.runId)) fail('money.out needs evidence or a runId');
      if (ev.payee !== undefined && !(isText(ev.payee) && ev.payee.length <= 40)) fail('money.out payee must be the name of who was paid');
      break;
    case 'outcome':
      if (!isText(ev.path)) fail('outcome needs a path id');
      if (!STAGES.includes(ev.stage)) fail(`outcome stage must be one of ${STAGES.join(', ')}`);
      if (!isText(ev.ref)) fail('outcome needs a ref (the business or person)');
      if (!isText(ev.evidence, 3)) fail('outcome needs evidence (URL, email subject, calendar link)');
      if (!['user', 'agent'].includes(ev.by)) fail('outcome.by must be "user" or "agent"');
      break;
    case 'agent.run.start':
      if (!isText(ev.runId) || !isText(ev.path) || !isText(ev.role) || !isText(ev.model)) fail('agent.run.start needs runId, path, role, model');
      if (!isUsd(ev.maxUsd) || ev.maxUsd < 0) fail('agent.run.start needs maxUsd >= 0');
      break;
    case 'agent.run.end':
      if (!isText(ev.runId) || !isText(ev.path) || !isText(ev.role) || !isText(ev.model)) fail('agent.run.end needs runId, path, role, model');
      if (!isUsd(ev.usd) || ev.usd < 0) fail('agent.run.end needs usd >= 0');
      if (!Number.isInteger(ev.iterations) || ev.iterations < 0) fail('agent.run.end needs integer iterations');
      if (!RUN_REASONS.includes(ev.reason)) fail(`agent.run.end reason must be one of ${RUN_REASONS.join(', ')}`);
      break;
    case 'path.status':
      if (!isText(ev.path)) fail('path.status needs a path id');
      if (!PATH_STATUSES.includes(ev.status)) fail(`path.status must be one of ${PATH_STATUSES.join(', ')}`);
      if (!isText(ev.reason)) fail('path.status needs a reason');
      break;
    case 'gate':
      if (!isText(ev.gate)) fail('gate needs a gate name');
      if (typeof ev.cleared !== 'boolean') fail('gate.cleared must be true or false');
      if (!isText(ev.evidence, 3)) fail('gate needs evidence (what was read, who said so)');
      break;
    case 'note':
      if (!isText(ev.text)) fail('note needs text');
      break;
  }
  return ev;
}

export class Ledger {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  // Validate, then append one line with fsync. Never rewrites history.
  append(input) {
    const ev = validate(input);
    const fd = fs.openSync(this.file, 'a');
    try {
      fs.writeSync(fd, JSON.stringify(ev) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return ev;
  }

  readAll() {
    if (!fs.existsSync(this.file)) return [];
    const out = [];
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t)); } catch { /* a torn final line is skipped, never repaired by guessing */ }
    }
    return out;
  }
}
