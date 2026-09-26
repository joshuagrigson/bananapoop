// Demo data for previewing the station. It is loudly labeled: the first line is a demo note,
// the reducer sets state.demo, and every page shows a DEMO banner. It refuses to touch a real ledger.
import fs from 'node:fs';
import path from 'node:path';
import { LedgerError } from './ledger.js';
import { addItem, markDone } from './inbox.js';
import { addClient, markPacked } from './clients.js';
import { fromTemplate, saveConfig } from './rooms.js';

export function seedDemo(ledger, dataDir, now = Date.now()) {
  const existing = ledger.readAll();
  if (existing.length && !existing.some((e) => e.kind === 'note' && e.demo === true)) {
    throw new LedgerError(`refusing to seed demo data into a real ledger (${existing.length} lines). Point REVENUE_ENGINE_DATA at an empty folder.`);
  }
  const day = 86400e3;
  const at = (d, h = 0) => new Date(now - d * day + h * 3600e3).toISOString();
  const lines = [
    { kind: 'note', demo: true, text: 'DEMO LEDGER: fictional preview data. Every business, URL and dollar here is made up.', ts: at(20) },
    { kind: 'path.status', path: 'coparent-hq', status: 'killed', reason: 'demo: kill test failed, 0 of 5 practices', ts: at(19) },
    { kind: 'job', jobId: 'job_demo_creator', role: 'creator', path: 'content-channel', everyHours: 24, maxUsd: 1, enabled: true, ts: at(18) },
    { kind: 'job', jobId: 'job_demo_audit', role: 'auditor', path: 'gbp-management', everyHours: 24, maxUsd: 1, enabled: true, ts: at(18) },
    { kind: 'job', jobId: 'job_demo_manager', role: 'manager', path: 'gbp-management', everyHours: 24, maxUsd: 2, enabled: true, ts: at(17) },
    { kind: 'job', jobId: 'job_demo_scout', role: 'scout', path: 'freelance-desk', everyHours: 2, maxUsd: 0.5, enabled: true, ts: at(17) },
    { kind: 'job', jobId: 'job_demo_fulfiller', role: 'fulfiller', path: 'freelance-desk', everyHours: 2, maxUsd: 2, enabled: true, ts: at(17) },
    { kind: 'job', jobId: 'job_demo_prospect', role: 'prospector', path: 'cohort-course', everyHours: 48, maxUsd: 1, enabled: true, ts: at(16) },
  ];
  const shops = ['Demo Salon One', 'Demo Med Spa', 'Demo Groomers', 'Demo Barber Co', 'Demo Nail Bar', 'Demo Lash Studio', 'Demo Brow House', 'Demo Day Spa', 'Demo Skin Clinic', 'Demo Hair Loft', 'Demo Pet Spa', 'Demo Wax Bar'];
  shops.forEach((s, i) => lines.push({ kind: 'outcome', path: 'gbp-management', stage: 'prospect', ref: s, evidence: `https://example.com/demo/${i}`, by: 'agent', ts: at(15, i) }));
  shops.slice(0, 8).forEach((s, i) => lines.push({ kind: 'outcome', path: 'gbp-management', stage: 'conversation', ref: s, evidence: 'demo: video audit sent', by: 'user', ts: at(12, i) }));
  shops.slice(0, 5).forEach((s, i) => lines.push({ kind: 'outcome', path: 'gbp-management', stage: 'demo', ref: s, evidence: 'demo: owner replied', by: 'user', ts: at(9, i) }));
  shops.slice(0, 2).forEach((s, i) => lines.push({ kind: 'outcome', path: 'gbp-management', stage: 'pilot', ref: s, evidence: 'demo: first month paid', by: 'user', ts: at(6, i) }));
  lines.push({ kind: 'money.in', usd: 199, path: 'gbp-management', source: 'Demo Salon One', evidence: 'demo invoice 0001', ts: at(6) });
  lines.push({ kind: 'money.in', usd: 249, path: 'gbp-management', source: 'Demo Med Spa', evidence: 'demo invoice 0002', ts: at(5) });
  ['Operator course waitlist opens', 'How I built a QA scorer without code', 'Missed calls cost salons more than rent'].forEach((t, i) => {
    lines.push({ kind: 'outcome', path: 'cohort-course', stage: 'prospect', ref: `demo waitlist ${i}`, evidence: 'demo: form signup', by: 'user', ts: at(10, i) });
  });
  const posts = [
    { id: 'post_demo_1', platform: 'linkedin', title: 'Missed calls cost salons more than rent', url: 'https://example.com/demo/post/1' },
    { id: 'post_demo_2', platform: 'youtube', title: 'I scored 100 sales calls with AI in an hour', url: 'https://example.com/demo/post/2' },
    { id: 'post_demo_3', platform: 'x', title: 'Build-in-public: day 1 of the revenue station', url: 'https://example.com/demo/post/3' },
    { id: 'post_demo_4', platform: 'linkedin', title: 'The one confirmation call that saves 9% of tours', url: 'https://example.com/demo/post/4' },
  ];
  posts.forEach((p, i) => lines.push({ kind: 'post', path: 'content-channel', by: 'user', ts: at(8 - i), ...p }));
  lines.push({ kind: 'outcome', path: 'content-channel', stage: 'prospect', ref: 'demo DM from a salon owner', evidence: 'demo: DM', by: 'user', ts: at(4) });
  lines.push({ kind: 'money.in', usd: 42.5, path: 'content-channel', source: 'Demo affiliate program', evidence: 'demo payout 77', postId: 'post_demo_2', ts: at(3) });
  // two finished runs and one in progress, with real-looking per-iteration spend lines
  const run = (id, role, pathId, d, usd, reason, open = false, jobId = undefined) => {
    lines.push({ kind: 'agent.run.start', runId: id, path: pathId, role, model: 'claude-opus-5', maxUsd: 2, ...(jobId ? { jobId } : {}), ts: at(d) });
    lines.push({ kind: 'money.out', usd, category: 'api', path: pathId, runId: id, evidence: 'demo iteration', ts: at(d, 0.1) });
    if (!open) lines.push({ kind: 'agent.run.end', runId: id, path: pathId, role, model: 'claude-opus-5', usd, iterations: 4, reason, ts: at(d, 0.2) });
  };
  run('run_demo_1', 'auditor', 'gbp-management', 15, 0.41, 'done');
  run('run_demo_2', 'creator', 'content-channel', 2, 0.18, 'done');
  run('run_demo_3', 'creator', 'content-channel', 0, 0.06, 'done', true, 'job_demo_creator');
  lines.push({ kind: 'money.out', usd: 12, category: 'tool', path: 'gbp-management', evidence: 'demo domain + hosting', ts: at(14) });
  // freelance desk: scored posts, sent proposals, one won and paid job with the operator's hours
  ['Demo client: lead list for HVAC', 'Demo client: GBP posts for a dentist', 'Demo client: Zapier missed-call flow', 'Demo client: dedupe 4k leads'].forEach((ref, i) => {
    lines.push({ kind: 'outcome', path: 'freelance-desk', stage: 'prospect', ref, evidence: `https://example.com/demo/job/${i}`, by: 'agent', ts: at(7, i) });
    if (i < 3) lines.push({ kind: 'outcome', path: 'freelance-desk', stage: 'conversation', ref, evidence: 'demo: proposal sent', by: 'user', ts: at(6, i) });
  });
  lines.push({ kind: 'outcome', path: 'freelance-desk', stage: 'demo', ref: 'Demo client: lead list for HVAC', evidence: 'demo: client replied', by: 'user', ts: at(5) });
  lines.push({ kind: 'outcome', path: 'freelance-desk', stage: 'pilot', ref: 'Demo client: lead list for HVAC', evidence: 'demo: contract started', by: 'user', ts: at(4) });
  lines.push({ kind: 'money.in', usd: 120, path: 'freelance-desk', source: 'Demo client (Upwork)', evidence: 'Upwork demo-5531 (imported)', ext: 'upwork:demo-5531', via: 'csv:upwork', tag: 'lead research', hours: 1.5, ts: at(1) });
  lines.push({ kind: 'money.in', usd: 193.9, path: 'gbp-management', source: 'Demo Groomers', evidence: 'Stripe txn_demo_1 (synced)', ext: 'stripe:txn_demo_1', via: 'stripe', ts: at(2) });
  run('run_demo_4', 'scout', 'freelance-desk', 7, 0.09, 'done');
  for (const l of lines) ledger.append(l);
  addItem(dataDir, 'freelance-desk', { type: 'post', url: 'https://example.com/demo/job/9', text: 'DEMO POST. Need 40 roofing contractors in Dallas with emails and phone numbers. Budget $80. Payment verified.' });
  addItem(dataDir, 'freelance-desk', { type: 'post', text: 'DEMO POST. Write 12 Google Business Profile posts for a med spa, one per week. Budget $60.' });
  const handled = addItem(dataDir, 'freelance-desk', { type: 'post', url: 'https://example.com/demo/job/0', text: 'DEMO POST. Need a lead list of HVAC companies in Houston with owner names. Budget $120.' });
  markDone(dataDir, 'freelance-desk', handled.id, 'demo: 8/10, proposal drafted');
  const fo = path.join(dataDir, 'outbox', 'freelance-desk');
  fs.mkdirSync(fo, { recursive: true });
  fs.writeFileSync(path.join(fo, 'proposal-demo-hvac.md'), '# DEMO proposal\n\nFictional preview content.\n');
  const c1 = addClient(dataDir, 'gbp-management', { name: 'Demo Salon One', city: 'Texarkana', category: 'hair salon', monthlyUsd: 199, notes: 'DEMO. New 5-star review from "Kim": loved the balayage. Fall color special 15% off in October.' });
  addClient(dataDir, 'gbp-management', { name: 'Demo Med Spa', city: 'Texarkana', category: 'med spa', monthlyUsd: 249, notes: 'DEMO. Open Saturdays starting October.' });
  markPacked(dataDir, 'gbp-management', c1.id, 'demo: September pack', new Date(now - 5 * day));
  addItem(dataDir, 'gbp-management', { type: 'lead', url: 'https://example.com/demo/permit/1', text: 'DEMO LEAD. Business: Demo Skin Studio. Address: Summerhill Rd, Texarkana, TX. Type: personal care (NAICS 812199).' });
  addItem(dataDir, 'gbp-management', { type: 'lead', url: 'https://example.com/demo/permit/2', text: 'DEMO LEAD. Business: Demo Crawfish Shack. Address: New Boston Rd, Nash, TX. Type: restaurants (NAICS 722513).' });
  const ga = path.join(dataDir, 'outbox', 'gbp-management');
  fs.mkdirSync(ga, { recursive: true });
  fs.writeFileSync(path.join(ga, 'audit-demo-skin-studio.md'), '# DEMO audit\n\nFictional preview content.\n');
  const out = path.join(dataDir, 'outbox', 'content-channel');
  fs.mkdirSync(out, { recursive: true });
  for (let i = 1; i <= 3; i++) fs.writeFileSync(path.join(out, `post-demo-${i}.md`), `# DEMO draft ${i}\n\nFictional preview content.\n`);
  // a labeled demo income link: no key, never contacted, only there so the sync panel has something to show
  fs.writeFileSync(path.join(dataDir, 'connections.json'), JSON.stringify([{
    id: 'conn_stripe_demo', kind: 'stripe', label: 'DEMO account', path: 'gbp-management', enabled: true, demo: true,
    since: at(90), createdAt: at(10), secret: {}, cursor: at(0.02),
    lastSync: { at: at(0.02), ok: true, imported: 1, usd: 193.9, seen: 3, skipped: 0 },
  }], null, 2));
  return lines.length;
}

// A barber's station for the preview: rooms from the barber template and ~60 days of fictional Square sales,
// one ledger line per service on each ticket, exactly the shape a real Square sync writes. Loudly labeled demo data.
export function seedBarberDemo(ledger, dataDir, now = Date.now()) {
  if (ledger.readAll().length) throw new LedgerError('refusing to seed the barber demo into a ledger that already has lines');
  const cfg = fromTemplate('barber');
  // monthly goals so each room's tube has something to fill (placeholders, like the template's prices)
  const GOALS = { products: 300, 'skin-fade': 2000, 'beard-trim': 600, 'kids-cut': 500, 'hot-towel-shave': 500, 'line-up': 500, color: 600, haircut: 2000 };
  // three barbers: each character on the map is one of them, walking to the room of the service they just did
  const BARBERS = [{ name: 'Dre', color: '#60a5fa', rooms: ['skin-fade', 'line-up', 'haircut', 'beard-trim'] }, { name: 'Kim', color: '#f472b6', rooms: ['color', 'kids-cut', 'haircut', 'products'] }, { name: 'Sal', color: '#ffb454', rooms: ['hot-towel-shave', 'beard-trim', 'haircut', 'products'] }];
  saveConfig(dataDir, { ...cfg, name: 'The Shop (demo)', folk: BARBERS, rooms: cfg.rooms.map((r) => ({ ...r, goalUsd: GOALS[r.id] || 0 })) });
  const BY = { 'Skin Fade': ['Dre'], 'Line Up': ['Dre'], 'Gray Blend': ['Kim'], 'Kids Cut (12 & under)': ['Kim'], 'Hot Towel Shave': ['Sal'], 'Beard Trim': ['Sal', 'Dre'] };
  let seed = 20260925;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (list) => { let t = rand() * list.reduce((s, x) => s + x.w, 0); for (const x of list) { t -= x.w; if (t <= 0) return x; } return list[list.length - 1]; };
  const MENU = [
    { item: "Men's Haircut", usd: 30, w: 30, tip: true }, { item: 'Skin Fade', usd: 40, w: 24, tip: true }, { item: 'Beard Trim', usd: 20, w: 10, tip: true },
    { item: 'Kids Cut (12 & under)', usd: 25, w: 9, tip: true }, { item: 'Hot Towel Shave', usd: 35, w: 4, tip: true }, { item: 'Line Up', usd: 15, w: 9, tip: true },
    { item: 'Gray Blend', usd: 60, w: 3, tip: true },
  ];
  const ADDONS = [{ item: 'Beard Trim', usd: 20 }, { item: 'Line Up', usd: 15 }, { item: 'Pomade', usd: 22 }, { item: 'Beard Oil', usd: 18 }];
  const clients = ['Marcus T.', 'DeShawn R.', 'Luis P.', 'Tyler K.', 'Andre W.', 'Chris M.', 'Jamal B.', 'Noah S.', 'Eli G.', 'Omar F.', 'Brandon L.', 'Isaiah D.'];
  const day = 86400e3;
  const lines = [{ kind: 'note', demo: true, text: 'DEMO LEDGER: a fictional barber shop. Every client, ticket and dollar here is made up.', ts: new Date(now - 61 * day).toISOString() }];
  let ticket = 0;
  for (let d = 60; d >= 0; d--) {
    const date = new Date(now - d * day);
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 1) continue; // closed Sunday and Monday
    const tickets = 5 + Math.floor(rand() * 6) + (dow === 5 || dow === 6 ? 3 : 0);
    for (let k = 0; k < tickets; k++) {
      ticket++;
      const at = new Date(date.getTime() - (d === 0 ? 3 : 8 - k * 0.6) * 3600e3 + Math.floor(rand() * 20) * 60e3);
      if (at.getTime() > now) continue;
      const items = [pick(MENU)];
      if (rand() < 0.28) { const a = ADDONS[Math.floor(rand() * ADDONS.length)]; if (a.item !== items[0].item) items.push(a); }
      if (rand() < 0.03) items.push({ item: 'Gift Card', usd: 50 });
      const tipBase = items.filter((x) => x.tip).reduce((s, x) => s + x.usd, 0);
      const tip = Math.round(tipBase * (0.12 + rand() * 0.14));
      const total = items.reduce((s, x) => s + x.usd, 0);
      const fee = Math.round((total + tip) * 2.6 + 10) / 100;
      const who = clients[Math.floor(rand() * clients.length)];
      const pool = BY[items[0].item] || ['Dre', 'Kim', 'Sal'], barber = pool[Math.floor(rand() * pool.length)];
      let givenNet = 0, givenTip = 0;
      items.forEach((x, i) => {
        const last = i === items.length - 1, share = x.usd / total;
        const net = last ? Math.round((total + tip - fee - givenNet) * 100) / 100 : Math.round((total + tip - fee) * share * 100) / 100;
        const t = last ? tip - givenTip : Math.round(tip * share * 100) / 100;
        givenNet += net; givenTip += t;
        lines.push({
          kind: 'money.in', usd: net, path: 'haircut', source: who, by: barber, evidence: `Square demo-${ticket} (synced)`, item: x.item, qty: 1,
          ...(t > 0 ? { tip: Math.min(t, net) } : {}), ext: `square:demo-${ticket}:${i}`, grp: `square:demo-${ticket}`, via: 'square', ts: at.toISOString(),
        });
      });
    }
  }
  lines.push({ kind: 'job', jobId: 'job_demo_promo', role: 'creator', path: 'skin-fade', everyHours: 48, maxUsd: 1, enabled: true, ts: new Date(now - 20 * day).toISOString() });
  for (const l of lines) ledger.append(l);
  fs.writeFileSync(path.join(dataDir, 'connections.json'), JSON.stringify([{
    id: 'conn_square_demo', kind: 'square', label: 'DEMO shop', path: 'haircut', enabled: true, demo: true,
    since: new Date(now - 61 * day).toISOString(), createdAt: new Date(now - 61 * day).toISOString(), secret: {}, cursor: new Date(now - 600e3).toISOString(),
    lastSync: { at: new Date(now - 600e3).toISOString(), ok: true, imported: 3, usd: 96.4, seen: 3, skipped: 0 },
  }], null, 2));
  return lines.length;
}

// A family's allowance station for the preview: three fictional kids, the chore chart, six weeks of chores checked
// off by a parent and paid out on Sundays, on the farm skin. Loudly labeled demo data.
export function seedAllowanceDemo(ledger, dataDir, now = Date.now()) {
  if (ledger.readAll().length) throw new LedgerError('refusing to seed the allowance demo into a ledger that already has lines');
  const KIDS = [{ name: 'Emma', color: '#f472b6' }, { name: 'Liam', color: '#60a5fa' }, { name: 'Ava', color: '#4ade80' }];
  const cfg = fromTemplate('chores', { name: 'The Family Farm (demo)', skin: 'farm', folk: KIDS });
  const GOALS = { dishes: 20, 'yard-work': 30, homework: 20 };
  saveConfig(dataDir, { ...cfg, rooms: cfg.rooms.map((r) => ({ ...r, goalUsd: GOALS[r.id] || 0 })) });
  const price = Object.fromEntries(cfg.rooms.map((r) => [r.id, r.priceUsd]));
  const nameOf = Object.fromEntries(cfg.rooms.map((r) => [r.id, r.name]));
  // how likely each kid is to do each chore on a given day
  const HABITS = {
    Emma: { dishes: 0.7, 'make-bed': 0.9, homework: 0.85, laundry: 0.25, 'tidy-room': 0.5, 'feed-pets': 0.2 },
    Liam: { dishes: 0.35, 'make-bed': 0.5, homework: 0.6, 'take-out-trash': 0.45, 'yard-work': 0, 'tidy-room': 0.25 },
    Ava: { 'make-bed': 0.7, 'feed-pets': 0.8, 'tidy-room': 0.4 },
  };
  let seed = 20260926;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const day = 86400e3;
  const lines = [{ kind: 'note', demo: true, text: 'DEMO LEDGER: a fictional family. Every kid, chore and dollar here is made up.', ts: new Date(now - 43 * day).toISOString() }];
  const owed = Object.fromEntries(KIDS.map((k) => [k.name, 0]));
  for (let d = 42; d >= 0; d--) {
    const date = new Date(now - d * day), dow = date.getUTCDay();
    for (const k of KIDS) {
      for (const [chore, p] of Object.entries(HABITS[k.name])) {
        if (rand() > p) continue;
        const at = new Date(date.getTime() - (d === 0 ? 2 : 6 - rand() * 4) * 3600e3);
        if (at.getTime() > now) continue;
        lines.push({ kind: 'money.in', usd: price[chore], path: chore, source: k.name, by: k.name, kid: k.name, item: nameOf[chore], qty: 1, evidence: 'checked off by Mom (demo)', ts: at.toISOString() });
        owed[k.name] += price[chore];
      }
      // Liam mows on Saturdays
      if (k.name === 'Liam' && dow === 6 && rand() < 0.85) {
        lines.push({ kind: 'money.in', usd: price['yard-work'], path: 'yard-work', source: 'Liam', by: 'Liam', kid: 'Liam', item: 'Yard work', qty: 1, evidence: 'checked off by Dad (demo)', ts: new Date(date.getTime() - 5 * 3600e3).toISOString() });
        owed.Liam += price['yard-work'];
      }
    }
    // Sunday evening: everyone is paid what they are owed (this week's stays owed until the next Sunday)
    if (dow === 0 && d > 0) for (const k of KIDS) {
      const amt = Math.round(owed[k.name] * 100) / 100;
      if (amt <= 0) continue;
      lines.push({ kind: 'money.out', usd: amt, category: 'other', path: 'general', payee: k.name, evidence: `paid ${k.name} in cash (demo)`, ts: new Date(date.getTime() + 2 * 3600e3).toISOString() });
      owed[k.name] = 0;
    }
  }
  lines.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  for (const l of lines) ledger.append(l);
  return lines.length;
}
