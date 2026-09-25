// The harvester: plain code, no AI, $0. Pulls newly permitted Texas businesses from the Comptroller's free
// "Active Sales Tax Permit Holders" dataset (data.texas.gov, id jrea-zgmq, refreshed weekly), keeps the
// local-service types that live or die on Google Maps, skips anything seen before, and drops each one into
// the GBP path's inbox as a "lead" for the auditor agent. Only public business records are used.
import fs from 'node:fs';
import path from 'node:path';
import { addItem } from './inbox.js';

export const DATASET = 'https://data.texas.gov/resource/jrea-zgmq.json';

// Comptroller county codes: 019 Bowie (Texarkana TX, Nash, Wake Village, New Boston, Hooks, De Kalb), 034 Cass.
// Miller County is in Arkansas and is not in Texas data.
export const DEFAULT_COUNTIES = ['019', '034'];

// NAICS prefixes for businesses customers find on Google Maps.
export const DEFAULT_NAICS = [
  { prefix: '8121', label: 'personal care: salon, barber, nails, skin, spa' },
  { prefix: '81291', label: 'pet care and grooming' },
  { prefix: '811', label: 'repair: auto, electronics, home goods' },
  { prefix: '7225', label: 'restaurants and food service' },
  { prefix: '71394', label: 'fitness and recreation centers' },
  { prefix: '238', label: 'specialty trade contractors' },
  { prefix: '45311', label: 'florists' },
];

export function buildQuery({ counties = DEFAULT_COUNTIES, sinceDays = 30, limit = 1000, now = new Date() } = {}) {
  if (!counties.every((c) => /^\d{3}$/.test(c))) throw new Error('county codes are 3 digits, e.g. 019');
  const since = new Date(now.getTime() - sinceDays * 86400e3).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    $select: 'taxpayer_number,outlet_number,outlet_name,taxpayer_name,outlet_address,outlet_city,outlet_zip_code,outlet_county_code,outlet_naics_code,outlet_permit_issue_date,outlet_first_sales_date,taxpayer_organization_type',
    $where: `outlet_county_code in(${counties.map((c) => `'${c}'`).join(',')}) AND outlet_permit_issue_date > '${since}'`,
    $order: 'outlet_permit_issue_date DESC',
    $limit: String(Math.min(Math.max(1, limit), 5000)),
  });
  return `${DATASET}?${params}`;
}

const keyOf = (r) => `${r.taxpayer_number}-${r.outlet_number}`;
const KEEP_UPPER = /^(llc|inc|pllc|lp|llp|dba|tx|usa|ii|iii|iv)$/i;
const title = (s) => String(s || '').toLowerCase().replace(/\b[a-z][a-z']*/g, (w) => (KEEP_UPPER.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));

export function matchNaics(code, naics = DEFAULT_NAICS) {
  const s = String(code || '');
  return naics.find((n) => s.startsWith(n.prefix)) || null;
}

// Returns { fetched, matched, added, skippedSeen, items }. fetchImpl is injectable for tests.
export async function harvest({ dataDir, pathId = 'gbp-management', counties, naics = DEFAULT_NAICS, sinceDays = 30, limit = 1000, maxNew = 25, fetchImpl = fetch, now = new Date() } = {}) {
  const url = buildQuery({ counties, sinceDays, limit, now });
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`data.texas.gov answered ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('data.texas.gov returned something other than a list');

  const seenFile = path.join(dataDir, 'harvest', 'seen.json');
  let seen = {};
  try { seen = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch { seen = {}; }

  const out = { fetched: rows.length, matched: 0, added: 0, skippedSeen: 0, items: [] };
  for (const r of rows) {
    const kind = matchNaics(r.outlet_naics_code, naics);
    if (!kind) continue;
    out.matched += 1;
    const key = keyOf(r);
    if (seen[key]) { out.skippedSeen += 1; continue; }
    if (out.added >= maxNew) break;
    const name = title(r.outlet_name || r.taxpayer_name);
    const city = title(r.outlet_city);
    const record = `${DATASET}?taxpayer_number=${encodeURIComponent(r.taxpayer_number)}&outlet_number=${encodeURIComponent(r.outlet_number)}`;
    const text = [
      `Business: ${name}`,
      `Legal name: ${title(r.taxpayer_name)}`,
      `Address: ${title(r.outlet_address)}, ${city}, TX ${r.outlet_zip_code || ''}`.trim(),
      `Type: ${kind.label} (NAICS ${r.outlet_naics_code})`,
      `Sales-tax permit issued: ${String(r.outlet_permit_issue_date || '').slice(0, 10)}`,
      `First sales date: ${String(r.outlet_first_sales_date || '').slice(0, 10)}`,
      'Source: Texas Comptroller, Active Sales Tax Permit Holders (public record).',
    ].join('\n');
    const item = addItem(dataDir, pathId, { type: 'lead', url: record, title: `${name} (${city})`, text });
    seen[key] = { at: now.toISOString(), inbox: item.id };
    out.added += 1;
    out.items.push({ id: item.id, name, city, naics: r.outlet_naics_code });
  }
  fs.mkdirSync(path.dirname(seenFile), { recursive: true });
  fs.writeFileSync(seenFile, JSON.stringify(seen));
  return out;
}
