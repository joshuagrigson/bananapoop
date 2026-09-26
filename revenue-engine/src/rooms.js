// Proxyfolk: a tiny world of folk who stand in for anything you keep track of. Rooms are what you track (a service, a
// chore, a money path, a site, a job); folk are who works them (a barber, a kid, you) and, at the paid level, AI agents
// that do the work themselves. The number of folk in a room is the number working it. The world they live in (space,
// castle, farm...) is only a skin: any world fits any purpose.
//
// Rooms: what each room on the station stands for. By default the rooms are the built-in money paths (paths.js).
// Anyone can redesign them for their own business instead: a barber makes one room per service, a shop one per product
// line. The design lives in <data>/rooms.json.
//
// Rooms are views over the ledger, not buckets that money is poured into. A synced payment keeps the item name its
// platform reported ("Skin fade", "Beard trim"), and each room claims items by keyword. Rename a room or change its
// keywords and history re-sorts itself, without rewriting a single ledger line. Money that no room claims stays in the
// room it was logged to, and every dollar, claimed or not, still counts in the vault.
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG } from './paths.js';
import { LedgerError } from './ledger.js';

export const MAX_ROOMS = 10;
export const MAX_FOLK = 12;
export const MAX_KIDS = MAX_FOLK;
// What the station is for. The same rooms, ledger and vault underneath; the mode decides what the screens lead with.
export const MODES = Object.freeze({
  agents: { title: 'Command center', blurb: 'Deploy AI agents on money-making jobs and watch each path climb from prospect to paid.' },
  service: { title: 'Service station', blurb: 'One room per service a business sells. Synced sales split into rooms, ranked by profit per hour.' },
  allowance: { title: 'Allowance tracker', blurb: 'One room per chore. Kids earn when a parent checks a chore off; pay them out from the vault.' },
});
// How the world looks. Pure decoration: every skin draws the same ledger, and any skin fits any mode.
export const SKINS = Object.freeze({
  space: { title: 'Space station', blurb: 'Astronauts in a station orbiting a ringed planet.' },
  castle: { title: 'Dark castle', blurb: 'A castle at midnight, a different monster haunting every room.' },
  farm: { title: 'Farm', blurb: 'Barns and pens on a sunny day, farmers and a different animal in every section.' },
  cyber: { title: 'Cyberpunk city', blurb: 'Neon rooftops in the rain: hackers, samurai, DJs and mechanics at work.' },
  alien: { title: 'Alien ship', blurb: 'A living starship: greys, blobs and tentacled crew in glowing chambers.' },
  ocean: { title: 'Deep sea base', blurb: 'A base on the sea floor: divers, fish, octopuses and crabs among the coral.' },
});
export const FOLK_COLORS = Object.freeze(['#f472b6', '#60a5fa', '#4ade80', '#ffb454', '#a78bfa', '#2dd4bf', '#ff5c6c', '#ffd84d', '#e5e7eb', '#c8a27a', '#818cf8', '#9be15d']);
export const KID_COLORS = FOLK_COLORS;
export const STYLES = Object.freeze({
  office: 'Desks and monitors',
  barber: 'Barber chairs and mirrors',
  shop: 'Shelves and a counter',
  studio: 'Studio lights and camera',
});
export const SCREENS = Object.freeze(['open', 'bars', 'calendar', 'wave', 'map', 'board', 'play', 'jobs', 'none']);
export const PROPS = Object.freeze(['pole', 'register', 'plant', 'rack', 'phone', 'kiosk', 'camera', 'coffee']);
export const PALETTE = Object.freeze(['#ff5c6c', '#ff8a4c', '#ffb454', '#ffd84d', '#9be15d', '#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa', '#818cf8', '#a78bfa', '#f472b6', '#e5e7eb', '#c8a27a']);

const svc = (name, match, minutes, priceUsd, costUsd, extra = {}) => ({ name, match, minutes, priceUsd, costUsd, ...extra });
const CHORE = { style: 'office', screen: 'board', prop: 'plant' };
// Starting points. Everything in them is editable; prices and times are placeholders to overwrite.
export const TEMPLATES = Object.freeze({
  barber: {
    title: 'Barber shop', blurb: 'One room per service. Square sales split into them by service name.', name: 'The Shop',
    rooms: [
      svc('Products', ['pomade', 'product', 'shampoo', 'oil', 'balm', 'wax', 'clay', 'gel'], 5, 20, 9, { accent: '#ff8a4c', style: 'shop', prop: 'register', screen: 'bars' }),
      svc('Skin fade', ['fade', 'taper'], 45, 40, 2, { accent: '#60a5fa' }),
      svc('Beard trim', ['beard'], 20, 20, 1, { accent: '#c8a27a' }),
      svc('Kids cut', ['kid', 'child', 'youth'], 25, 25, 1.5, { accent: '#ffd84d' }),
      svc('Hot towel shave', ['shave', 'towel'], 35, 35, 3, { accent: '#2dd4bf' }),
      svc('Line-up', ['line up', 'lineup', 'line-up', 'edge up', 'shape up'], 15, 15, 0.5, { accent: '#a78bfa' }),
      svc('Color', ['color', 'colour', 'dye', 'gray blend', 'grey blend'], 60, 60, 12, { accent: '#f472b6' }),
      svc('Haircut', ['cut', 'trim', 'hair'], 30, 30, 2, { accent: '#ff5c6c' }),
    ],
  },
  salon: {
    title: 'Hair salon', blurb: 'Cuts, color and treatments, each its own room.', name: 'The Salon',
    rooms: [
      svc('Retail', ['product', 'shampoo', 'conditioner', 'spray', 'oil'], 5, 30, 14, { accent: '#ff8a4c', style: 'shop', prop: 'register', screen: 'bars' }),
      svc('Balayage', ['balayage', 'highlight', 'foil'], 150, 180, 25, { accent: '#ffd84d' }),
      svc('Color', ['color', 'colour', 'root', 'gloss', 'toner'], 90, 95, 15, { accent: '#f472b6' }),
      svc('Blowout', ['blowout', 'blow dry', 'style'], 45, 45, 2, { accent: '#60a5fa' }),
      svc('Treatment', ['treatment', 'keratin', 'mask', 'olaplex'], 60, 80, 12, { accent: '#2dd4bf' }),
      svc('Extensions', ['extension', 'tape in', 'weft'], 120, 250, 90, { accent: '#a78bfa' }),
      svc('Cut', ['cut', 'trim', 'bang'], 45, 55, 2, { accent: '#ff5c6c' }),
    ],
  },
  freelance: {
    title: 'Freelancer', blurb: 'One room per kind of gig. Import Upwork or Fiverr statements.', name: 'The Studio',
    rooms: [
      svc('Lead lists', ['lead', 'list', 'data'], 90, 120, 0, { accent: '#22d3ee', style: 'office', prop: 'coffee', screen: 'jobs' }),
      svc('Automations', ['zap', 'automation', 'integration', 'workflow'], 180, 300, 0, { accent: '#a78bfa', style: 'office', prop: 'rack', screen: 'wave' }),
      svc('Content', ['post', 'content', 'article', 'script', 'video'], 60, 80, 0, { accent: '#f472b6', style: 'studio', prop: 'camera', screen: 'play' }),
      svc('Other gigs', ['gig', 'invoice', 'order', 'project'], 60, 50, 0, { accent: '#60a5fa', style: 'office', prop: 'plant', screen: 'board' }),
    ],
  },
  paths: { title: 'Online business (built-in paths)', blurb: 'The original eight money paths with stages, gates and agents.', name: 'Revenue Station', rooms: null },
  blank: { title: 'Start blank', blurb: 'One empty room to build from.', name: 'My Station', rooms: [svc('First room', [], 30, 0, 0, { accent: '#60a5fa', style: 'office' })] },
  chores: {
    title: 'Chore chart', blurb: 'Eight everyday chores with a price each. Rename, reprice or add your own.', name: 'Allowance Station',
    rooms: [
      svc('Dishes', ['dish'], 15, 1, 0, { accent: '#60a5fa', ...CHORE }),
      svc('Make bed', ['bed'], 5, 0.5, 0, { accent: '#f472b6', ...CHORE }),
      svc('Tidy room', ['tidy', 'clean room', 'pick up'], 15, 1, 0, { accent: '#ffd84d', ...CHORE }),
      svc('Homework', ['homework', 'reading', 'study'], 30, 1, 0, { accent: '#a78bfa', ...CHORE }),
      svc('Feed pets', ['feed', 'pet', 'dog', 'cat'], 5, 0.5, 0, { accent: '#ff8a4c', ...CHORE }),
      svc('Take out trash', ['trash', 'garbage', 'recycl'], 5, 0.75, 0, { accent: '#9be15d', ...CHORE }),
      svc('Laundry', ['laundry', 'fold'], 20, 1.5, 0, { accent: '#2dd4bf', ...CHORE }),
      svc('Yard work', ['yard', 'mow', 'rake', 'weed'], 60, 5, 0, { accent: '#4ade80', ...CHORE }),
    ],
  },
});
// the mode and skin each template starts in (both can be changed any time)
const TEMPLATE_MODE = { barber: 'service', salon: 'service', freelance: 'service', paths: 'agents', blank: 'service', chores: 'allowance' };
// A template never picks the world: purpose and skin are independent. (Kept as a hook, deliberately empty.)
const TEMPLATE_SKIN = {};

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 32) || 'room';
const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const norm = (s) => String(s || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();

// A built-in path turned into room form, so a custom station can keep some paths next to its own rooms.
const baseSpec = (id) => CATALOG.find((p) => p.id === id) || null;

// Validate and normalize a station design. Throws LedgerError with a sentence a person can act on.
const HEX = /^#[0-9a-f]{6}$/i;
// The folk: named people who work the rooms (kids in an allowance chart, barbers in a shop, you). Each has a colour and,
// optionally, the rooms they work; without rooms they go wherever their last logged work was. AI agents are folk too,
// but they come from the ledger's jobs, not from this list.
function normalizeFolk(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new LedgerError('folk must be a list of names');
  const seen = new Set(), out = [];
  for (const k of list) {
    const nm = String(k && typeof k === 'object' ? k.name ?? '' : k ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!nm || seen.has(nm.toLowerCase())) continue;
    seen.add(nm.toLowerCase());
    const color = k && typeof k === 'object' && HEX.test(k.color || '') ? k.color.toLowerCase() : FOLK_COLORS[out.length % FOLK_COLORS.length];
    const rooms = k && typeof k === 'object' && Array.isArray(k.rooms) ? [...new Set(k.rooms.filter((r) => typeof r === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(r)))].slice(0, 10) : [];
    // what they are, in a word or three: Barber, Colorist, Apprentice, Owner. Shown under their name on the map.
    const role = k && typeof k === 'object' ? String(k.role ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) : '';
    out.push({ name: nm, color, ...(role ? { role } : {}), ...(rooms.length ? { rooms } : {}) });
  }
  if (out.length > MAX_FOLK) throw new LedgerError(`a world keeps up to ${MAX_FOLK} folk`);
  return out;
}
// folk may only work rooms that exist
const pinFolk = (folk, ids) => folk.map((f) => { if (!f.rooms) return f; const rooms = f.rooms.filter((r) => ids.has(r)); const { rooms: _drop, ...rest } = f; return rooms.length ? { ...rest, rooms } : rest; });
// a room's look in each non-space skin ("crypt" in the castle, "coop" on the farm): a short slug the station draws
function normalizeLooks(looks) {
  if (!looks || typeof looks !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(looks)) if (SKINS[k] && typeof v === 'string' && /^[a-z][a-z0-9-]{0,19}$/.test(v)) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

export function normalizeConfig(input) {
  if (!input || typeof input !== 'object') throw new LedgerError('rooms config must be an object');
  const name = String(input.name ?? 'Proxyfolk').trim().slice(0, 40) || 'Proxyfolk';
  const template = TEMPLATES[input.template] ? input.template : 'custom';
  if (input.mode !== undefined && !MODES[input.mode]) throw new LedgerError(`mode must be one of ${Object.keys(MODES).join(', ')}`);
  if (input.skin !== undefined && !SKINS[input.skin]) throw new LedgerError(`skin must be one of ${Object.keys(SKINS).join(', ')}`);
  const skin = input.skin || 'space';
  const folk0 = normalizeFolk(input.folk ?? input.kids);
  if (input.rooms === null || input.rooms === undefined) return { name, template: 'paths', mode: input.mode || 'agents', skin, folk: pinFolk(folk0, new Set(CATALOG.map((p) => p.id))), rooms: null };
  if (!Array.isArray(input.rooms)) throw new LedgerError('rooms must be a list');
  if (!input.rooms.length) throw new LedgerError('a station needs at least one room');
  if (input.rooms.length > MAX_ROOMS) throw new LedgerError(`a station has room for ${MAX_ROOMS} rooms`);
  const ids = new Set();
  const rooms = input.rooms.map((r, i) => {
    const base = r.base ? baseSpec(r.base) : null;
    if (r.base && !base) throw new LedgerError(`room ${i + 1} is based on an unknown path "${r.base}"`);
    const rname = String(r.name ?? (base ? base.name : '')).trim().slice(0, 60);
    if (!rname) throw new LedgerError(`room ${i + 1} needs a name`);
    let id = base ? base.id : (r.id && /^[a-z0-9][a-z0-9-]{0,31}$/.test(r.id) ? r.id : slug(rname));
    if (ids.has(id)) { if (base) throw new LedgerError(`the path "${id}" is in the station twice`); let k = 2; while (ids.has(`${id}-${k}`)) k++; id = `${id}-${k}`; }
    ids.add(id);
    const accent = /^#[0-9a-f]{6}$/i.test(r.accent || '') ? r.accent.toLowerCase() : PALETTE[i % PALETTE.length];
    const match = (Array.isArray(r.match) ? r.match : []).map((m) => norm(m).slice(0, 40)).filter(Boolean).slice(0, 24);
    return {
      id, base: base ? base.id : undefined, kind: base ? 'pipeline' : 'service',
      name: rname, short: String(r.short ?? '').trim().slice(0, 22) || (base ? base.short : rname.slice(0, 22)),
      accent, style: STYLES[r.style] ? r.style : (base ? 'office' : 'barber'),
      screen: SCREENS.includes(r.screen) ? r.screen : (base ? undefined : 'open'), prop: PROPS.includes(r.prop) ? r.prop : (base ? undefined : 'pole'),
      match: [...new Set(match)],
      minutes: num(r.minutes, 1, 1440, 30), priceUsd: num(r.priceUsd, 0, 1e6, 0), costUsd: num(r.costUsd, 0, 1e6, 0), goalUsd: num(r.goalUsd, 0, 1e8, 0),
      looks: normalizeLooks(r.looks),
    };
  });
  const mode = input.mode || (rooms.every((r) => r.base) ? 'agents' : 'service');
  return { name, template, mode, skin, folk: pinFolk(folk0, ids), rooms };
}

const file = (dataDir) => path.join(dataDir, 'rooms.json');
export function loadConfig(dataDir) {
  if (!dataDir) return null;
  try { return normalizeConfig(JSON.parse(fs.readFileSync(file(dataDir), 'utf8'))); } catch { return null; }
}
export function saveConfig(dataDir, input) {
  const cfg = normalizeConfig(input);
  fs.mkdirSync(dataDir, { recursive: true });
  const f = file(dataDir), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, f);
  return cfg;
}
export function resetConfig(dataDir) { try { fs.unlinkSync(file(dataDir)); } catch { /* already default */ } }
export function fromTemplate(key, opts = {}) {
  const t = TEMPLATES[key];
  if (!t) throw new LedgerError(`unknown template "${key}" (${Object.keys(TEMPLATES).join(', ')})`);
  return normalizeConfig({
    name: opts.name || t.name, template: key, mode: opts.mode || TEMPLATE_MODE[key] || 'service', skin: opts.skin || TEMPLATE_SKIN[key] || 'space', folk: opts.folk ?? opts.kids,
    rooms: t.rooms ? t.rooms.map((r) => ({ ...r })) : null,
  });
}

// The catalog the engine runs on: built-in paths, or the rooms a person designed (a built-in path inside a custom
// station keeps its stages, gate and budget; a service room gets a small agent budget and default stages).
export function catalogFrom(cfg) {
  if (!cfg || !cfg.rooms) return CATALOG;
  return cfg.rooms.map((r, i) => {
    const base = r.base ? baseSpec(r.base) : null;
    const shared = { rank: i + 1, name: r.name, short: r.short, accent: r.accent, style: r.style, screen: r.screen, prop: r.prop, match: r.match, kind: r.kind, minutes: r.minutes, priceUsd: r.priceUsd, costUsd: r.costUsd, goalUsd: r.goalUsd, looks: r.looks };
    if (base) return { ...base, ...shared, id: base.id };
    return {
      id: r.id, bucket: 'service', thesis: `${r.name}: a service this business sells.`, killTest: '', budgetUsd: 5,
      month12Usd: [0, 0], firstDollarWeeks: [0, 0], offers: [], constraints: [], stages: {}, ...shared,
    };
  });
}
export const loadCatalog = (dataDir) => catalogFrom(loadConfig(dataDir));
export const stationInfo = (dataDir) => {
  const c = loadConfig(dataDir);
  const folk = c ? c.folk : [];
  // kids is the same list under its older name, for pages written before folk
  return { name: c ? c.name : 'Proxyfolk', template: c ? c.template : 'paths', custom: Boolean(c && c.rooms), configured: Boolean(c), mode: c ? c.mode : 'agents', skin: c ? c.skin : 'space', folk, kids: folk };
};

// Which room claims an item name: the first room, in station order, with a keyword inside the name.
export function roomForItem(item, catalog) {
  const n = norm(item);
  if (!n) return null;
  for (const r of catalog) if (r.match && r.match.some((m) => m && n.includes(m))) return r.id;
  return null;
}
// Re-file money by item name. Pure: returns new event objects only where the room changed.
export function routeEvents(events, catalog) {
  if (!catalog.some((r) => r.match && r.match.length)) return events;
  return events.map((e) => {
    if (e.kind !== 'money.in' || !e.item) return e;
    const to = roomForItem(e.item, catalog);
    return to && to !== e.path ? { ...e, path: to, loggedPath: e.path } : e;
  });
}
// Item names on the ledger that no room claims yet, most money first: suggestions for the room editor.
export function unclaimedItems(events, catalog, limit = 30) {
  const m = new Map();
  for (const e of events) {
    if (e.kind !== 'money.in' || !e.item || roomForItem(e.item, catalog)) continue;
    const k = String(e.item).trim();
    const x = m.get(k) || { item: k, n: 0, usd: 0 };
    x.n += Number(e.qty) || 1; x.usd += e.usd; m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.usd - a.usd).slice(0, limit);
}
