// The job inbox: work the operator hands to agents. Three kinds of item:
//   post: a job post or buyer request to score and, if it fits, draft a proposal for
//   job:  a job the operator WON, with the client's brief, to draft the deliverable for
//   lead: a local business to audit (the harvester adds these from public Texas permit records)
// Items are JSON files under <dataDir>/inbox/<pathId>/, moved to done/ once an agent handles them.
// Agents never fetch from Upwork or Fiverr themselves: automated scraping and bidding break both platforms' terms.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerError } from './ledger.js';

export const INBOX_TYPES = Object.freeze(['post', 'job', 'lead']);
const ID_RE = /^in_[a-z0-9]{6,32}$/;
const PATH_RE = /^[a-z0-9-]{1,60}$/;

const dirFor = (dataDir, pathId, done = false) => {
  if (!PATH_RE.test(String(pathId))) throw new LedgerError(`bad path id "${pathId}"`);
  return path.join(dataDir, 'inbox', pathId, ...(done ? ['done'] : []));
};

export function addItem(dataDir, pathId, { type, text, url, title } = {}) {
  if (!INBOX_TYPES.includes(type)) throw new LedgerError(`inbox type must be ${INBOX_TYPES.join(' or ')}`);
  const body = String(text || '').trim();
  if (body.length < 20) throw new LedgerError('paste the full post or brief (at least 20 characters)');
  if (body.length > 20000) throw new LedgerError('post is over 20,000 characters; trim it');
  const link = url ? String(url).trim() : '';
  if (link && !/^https?:\/\/\S+$/i.test(link)) throw new LedgerError('url must be a single http(s) link');
  const item = {
    id: 'in_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
    type, text: body, url: link || null, title: title ? String(title).slice(0, 140) : body.split('\n')[0].slice(0, 100),
    createdAt: new Date().toISOString(),
  };
  const dir = dirFor(dataDir, pathId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, item.id + '.json'), JSON.stringify(item, null, 2));
  return item;
}

function readDir(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const f of names) {
    try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { /* skip a torn file */ }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function listItems(dataDir, pathId, { type, status = 'pending' } = {}) {
  const items = readDir(dirFor(dataDir, pathId, status === 'done'));
  return type ? items.filter((i) => i.type === type) : items;
}

export function markDone(dataDir, pathId, id, verdict) {
  if (!ID_RE.test(String(id))) throw new LedgerError(`bad inbox id "${id}"`);
  const src = path.join(dirFor(dataDir, pathId), id + '.json');
  if (!fs.existsSync(src)) throw new LedgerError(`no pending inbox item "${id}"`);
  const item = JSON.parse(fs.readFileSync(src, 'utf8'));
  item.doneAt = new Date().toISOString();
  item.verdict = String(verdict || '').slice(0, 500);
  const doneDir = dirFor(dataDir, pathId, true);
  fs.mkdirSync(doneDir, { recursive: true });
  fs.writeFileSync(path.join(doneDir, id + '.json'), JSON.stringify(item, null, 2));
  fs.unlinkSync(src);
  return item;
}
