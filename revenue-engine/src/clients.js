// Client roster for recurring services (GBP management). Each client is a file under
// <dataDir>/clients/<pathId>/<id>.json. The monthly manager agent works only on clients whose pack is due,
// so a scheduled manager job costs $0 when nobody is due. Notes are where the operator pastes what changed
// this month: new reviews to answer, promotions, hours, photos taken.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerError } from './ledger.js';

const ID_RE = /^cl_[a-z0-9]{6,32}$/;
const PATH_RE = /^[a-z0-9-]{1,60}$/;
const DAY = 86400e3;

const dirFor = (dataDir, pathId) => {
  if (!PATH_RE.test(String(pathId))) throw new LedgerError(`bad path id "${pathId}"`);
  return path.join(dataDir, 'clients', pathId);
};
const fileFor = (dataDir, pathId, id) => {
  if (!ID_RE.test(String(id))) throw new LedgerError(`bad client id "${id}"`);
  return path.join(dirFor(dataDir, pathId), id + '.json');
};
const text = (v, max = 4000) => String(v || '').trim().slice(0, max);

export function addClient(dataDir, pathId, input = {}) {
  const name = text(input.name, 140);
  if (name.length < 2) throw new LedgerError('client needs a business name');
  const city = text(input.city, 80);
  if (!city) throw new LedgerError('client needs a city');
  const website = text(input.website, 300);
  if (website && !/^https?:\/\/\S+$/i.test(website)) throw new LedgerError('website must be an http(s) link');
  const cadenceDays = Number(input.cadenceDays || 30);
  if (!(cadenceDays >= 7 && cadenceDays <= 90)) throw new LedgerError('cadenceDays must be 7-90');
  const c = {
    id: 'cl_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
    name, city, category: text(input.category, 120), website: website || null,
    services: text(input.services, 2000), notes: text(input.notes),
    monthlyUsd: Number(input.monthlyUsd) > 0 ? Number(input.monthlyUsd) : null,
    cadenceDays, createdAt: new Date().toISOString(), lastPackAt: null, packs: [], active: true,
  };
  const dir = dirFor(dataDir, pathId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, c.id + '.json'), JSON.stringify(c, null, 2));
  return c;
}

export function listClients(dataDir, pathId) {
  let names = [];
  try { names = fs.readdirSync(dirFor(dataDir, pathId)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const f of names) {
    try { out.push(JSON.parse(fs.readFileSync(path.join(dirFor(dataDir, pathId), f), 'utf8'))); } catch { /* skip torn */ }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function isDue(c, now = new Date()) {
  return c.active && (!c.lastPackAt || now.getTime() - Date.parse(c.lastPackAt) >= c.cadenceDays * DAY);
}

export function dueClients(dataDir, pathId, now = new Date()) {
  return listClients(dataDir, pathId).filter((c) => isDue(c, now));
}

export function updateClient(dataDir, pathId, id, patch = {}) {
  const file = fileFor(dataDir, pathId, id);
  if (!fs.existsSync(file)) throw new LedgerError(`no client "${id}"`);
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (patch.notes !== undefined) c.notes = text(patch.notes);
  if (patch.services !== undefined) c.services = text(patch.services, 2000);
  if (patch.active !== undefined) c.active = Boolean(patch.active);
  if (patch.monthlyUsd !== undefined) c.monthlyUsd = Number(patch.monthlyUsd) > 0 ? Number(patch.monthlyUsd) : null;
  fs.writeFileSync(file, JSON.stringify(c, null, 2));
  return c;
}

export function markPacked(dataDir, pathId, id, summary, now = new Date()) {
  const file = fileFor(dataDir, pathId, id);
  if (!fs.existsSync(file)) throw new LedgerError(`no client "${id}"`);
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  c.lastPackAt = now.toISOString();
  c.packs = [...(c.packs || []), { at: c.lastPackAt, summary: text(summary, 500) }].slice(-24);
  fs.writeFileSync(file, JSON.stringify(c, null, 2));
  return c;
}
