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
  const BARBERS = [
    { name: 'Dre', color: '#60a5fa', role: 'Master barber', rooms: ['skin-fade', 'line-up', 'haircut', 'beard-trim'] }, { name: 'Kim', color: '#f472b6', role: 'Colorist', rooms: ['color', 'kids-cut', 'haircut', 'products'] },
    { name: 'Sal', color: '#ffb454', role: 'Barber', rooms: ['hot-towel-shave', 'beard-trim', 'haircut', 'products'] }, { name: 'Marco', color: '#4ade80', role: 'Apprentice', rooms: ['haircut', 'kids-cut', 'line-up'] },
    { name: 'Tasha', color: '#a78bfa', role: 'Stylist', rooms: ['skin-fade', 'color', 'products'] },
  ];
  saveConfig(dataDir, { ...cfg, name: 'The Shop (demo)', folk: BARBERS, rooms: cfg.rooms.map((r) => ({ ...r, goalUsd: GOALS[r.id] || 0 })) });
  const BY = { 'Skin Fade': ['Dre', 'Tasha'], 'Line Up': ['Dre', 'Marco'], 'Gray Blend': ['Kim', 'Tasha'], 'Kids Cut (12 & under)': ['Kim', 'Marco'], 'Hot Towel Shave': ['Sal'], 'Beard Trim': ['Sal', 'Dre'], "Men's Haircut": ['Marco', 'Kim', 'Sal'] };
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
      const pool = BY[items[0].item] || ['Dre', 'Kim', 'Sal', 'Marco', 'Tasha'], barber = pool[Math.floor(rand() * pool.length)];
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

// A sandbox race for the preview: eight contestant rooms, one agent each, $250 apiece, twelve and a half days in. Every
// agent, plan, sale and dollar is made up and labeled. It shows the shapes a real race takes: a fast starter that wins
// the first week and fades, a slow freelancer that overtakes it, a subscription that barely moves yet, an ad test that
// loses money and gets dropped, and agents stuck waiting on the one person allowed to send, sign up or pay.
export function seedRaceDemo(ledger, dataDir, now = Date.now()) {
  if (ledger.readAll().length) throw new LedgerError('refusing to seed the race demo into a ledger that already has lines');
  const LEADS = [
    { name: 'Ada', color: '#ff5c6c', rooms: ['red'] }, { name: 'Brix', color: '#ff8a4c', rooms: ['orange'] }, { name: 'Cato', color: '#ffd84d', rooms: ['gold'] },
    { name: 'Dot', color: '#4ade80', rooms: ['green'] }, { name: 'Echo', color: '#2dd4bf', rooms: ['teal'] }, { name: 'Fenn', color: '#60a5fa', rooms: ['blue'] },
    { name: 'Gil', color: '#a78bfa', rooms: ['violet'] }, { name: 'Hana', color: '#f472b6', rooms: ['pink'] },
  ].map((l) => ({ ...l, role: 'Room lead (agent)' }));
  const cfg = fromTemplate('race', { name: 'The $250 Race (demo)', folk: LEADS });
  saveConfig(dataDir, cfg);
  const day = 86400e3, t0 = now - 12.4 * day;
  const at = (d) => new Date(Math.min(now - 60e3, t0 + d * day)).toISOString();
  let seed = 20260927;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const lines = [
    { kind: 'note', demo: true, text: 'DEMO LEDGER: a fictional simulation race. The agents and plans are made up; every dollar is simulated by the market model; the research links are real pages.', ts: new Date(t0 - 3600e3).toISOString() },
    { kind: 'race', stakeUsd: 250, name: 'The $250 Race', evidence: 'eight virtual cards, $250 on each (demo)', horizons: [7, 30, 90, 180], ts: at(0),
      rules: { purpose: 'idea', moneyMode: 'sim', places: 3, approveOverUsd: 50, maxSpendPerDayUsd: 40, knockoutUsd: 0, tiebreak: 'earliest', everyHours: 24,
        customRules: [{ kind: 'must', text: 'Show the price before anyone pays' }, { kind: 'mustnot', text: 'Sell anything to children' }],
        roomNotes: { gold: 'Put the review tool in front of three real businesses before building anything more.' },
        models: { red: 'claude-opus-5-5', orange: 'claude-sonnet-5', gold: 'claude-opus-5-5', green: 'claude-haiku-4-5', teal: 'claude-sonnet-5', blue: 'claude-opus-5-5', violet: 'claude-haiku-4-5', pink: 'claude-sonnet-5' },
        notes: 'Keep each play small until it sells. Drop anything that has not made a sale in 10 days.' } },
  ];
  // the business model behind each play, as its agent logged it when the play started
  const MODELS = {
    'planner-shop': { offer: 'Ten printable planners as instant PDF downloads', customer: 'People trying to get organized: students, parents, ADHD adults', channel: 'Pinterest pins and search on the store', pricing: '$9-$19 each', costs: 'Shopify $39 a month, Canva Pro $15 a month; nothing per sale' },
    'etsy-mirror': { offer: 'The same ten planners, listed on Etsy', customer: 'Etsy shoppers searching for planners', channel: 'Etsy search', pricing: '$8.20-$10.90 after Etsy fees', costs: '$0.20 a listing, 6.5% of each sale, Etsy Ads at $1 a day' },
    bundle: { offer: 'All ten planners in one download', customer: 'Shoppers already on a planner page', channel: 'An upsell on every product page', pricing: '$29', costs: 'Nothing extra' },
    'fiverr-gigs': { offer: 'Done-for-you automations: lead capture, invoice parsing, review alerts', customer: 'Small businesses drowning in admin', channel: 'Fiverr search', pricing: '$75, $150 and $300 packages', costs: 'Fiverr keeps 20%; nothing up front' },
    'upwork-proposals': { offer: 'Fixed-price automation builds', customer: 'Clients posting automation jobs on Upwork', channel: 'Proposals with a working sample attached', pricing: '$180 fixed-price milestones', costs: 'Upwork Connects, about $0.19 a proposal' },
    retainer: { offer: 'Monthly watch-and-fix for finished automations', customer: 'Every client with a finished build', channel: 'Offered after delivery (drafted; Joshua sends)', pricing: '$150 a month', costs: 'Claude time only' },
    'lead-lists': { offer: 'Verified lists of newly opened local businesses', customer: 'Marketing agencies that sell to local businesses', channel: 'Intro emails (Joshua sends), then referrals', pricing: '$120 for 50, $240 for 100', costs: 'Email verification, $29 for 2,000 checks' },
    'weekly-feed': { offer: 'A fresh list every Monday', customer: 'Agencies that already bought a list', channel: 'An upsell after a purchase', pricing: '$99 a month', costs: 'Verification credits' },
    'site-rebuilds': { offer: 'A one-page website, built before the pitch', customer: 'Local businesses with no site or a broken one', channel: 'A preview link in an intro email (Joshua sends)', pricing: '$300: half up front, half at launch', costs: 'Nothing: the client pays for hosting' },
    'care-plan': { offer: 'Hours, photos and updates kept current', customer: 'Every business that bought a site', channel: 'Offered at handover', pricing: '$49 a month', costs: 'Claude time only' },
    sheets: { offer: 'Google Sheets templates with a how-to tab', customer: 'People managing money: budgets, debt, rentals', channel: 'Gumroad search', pricing: '$7-$19', costs: 'Gumroad keeps 10%' },
    'forum-posts': { offer: 'Helpful answers that mention a template', customer: 'People asking money questions in forums', channel: 'Personal-finance forums', pricing: 'Free; leads to the templates', costs: 'None' },
    'ui-kits': { offer: 'Figma UI kits: a dashboard kit and an onboarding kit', customer: 'Designers and startup founders', channel: 'Gumroad and the Figma community', pricing: '$24', costs: 'None' },
    'canva-templates': { offer: 'Packs of 30 social posts for salons, gyms and cafes', customer: 'Small-business owners who post their own social', channel: 'Creative Market search', pricing: '$12 a pack', costs: 'Canva Pro $15 a month; Creative Market keeps 40%' },
    'review-tool': { offer: "Replies to Google reviews in the owner's voice", customer: 'Local businesses with more reviews than time', channel: 'A landing page and a launch post (Joshua publishes)', pricing: '$12 a month after a 7-day trial', costs: 'Domain $12; Claude API about $0.40 a user a month' },
    'launch-post': { offer: 'One honest launch post with a demo video', customer: 'Makers and small-business owners', channel: 'A maker community', pricing: 'Free', costs: 'None' },
    'pod-shirts': { offer: 'Shirts for dog owners, printed on demand', customer: 'Dog owners', channel: 'A Shopify store', pricing: '$28 a shirt, about $8 margin', costs: 'Shopify $39 a month; Printful prints each order' },
    'meta-ads': { offer: 'Ads for the dog shirts', customer: 'Dog owners on Facebook and Instagram', channel: 'Meta ads', pricing: '$28 a shirt', costs: '$20 a day in ads' },
    'etsy-pod': { offer: 'The same shirts on Etsy', customer: 'Etsy shoppers', channel: 'Etsy search, no ads', pricing: '$28, about $8 margin', costs: '$0.20 a listing, Etsy fees on each sale' },
  };
  const started = new Set(), live = new Set();
  // each play's variant in the simulated market; cited rates point at the real benchmark pages
  const E = 'https://instantly.ai/cold-email-benchmark-report-2026', UP = 'https://gigradar.io/blog/upwork-proposal-response-rate', ETSY = 'https://help.erank.com/blog/what-is-a-good-conversion-rate-on-etsy/';
  const SPECS = {
    'planner-shop': { channel: 'social', price: 14, volume: 4, platform: 'stripe', fixedPerMonth: 39, trend: 'rising', competition: 'high' },
    'etsy-mirror': { channel: 'marketplace', price: 10, volume: 10, platform: 'etsy', competition: 'high', trend: 'rising', rates: { conv: 0.02 }, cites: { conv: ETSY } },
    bundle: { channel: 'marketplace', price: 29, volume: 1, platform: 'stripe', competition: 'medium' },
    'fiverr-gigs': { channel: 'marketplace', price: 150, volume: 3, platform: 'fiverr', capacityPerDay: 2, hoursPerSale: 2, competition: 'high' },
    'upwork-proposals': { channel: 'freelance', price: 180, volume: 8, platform: 'upwork', capacityPerDay: 1, hoursPerSale: 3, rates: { interview: 0.15 }, cites: { interview: UP } },
    retainer: { channel: 'email', price: 150, recurring: true, volume: 5, rates: { reply: 0.05 }, cites: { reply: E } },
    'lead-lists': { channel: 'email', price: 120, volume: 30, platform: 'stripe', unitCost: 6, capacityPerDay: 3 },
    'weekly-feed': { channel: 'email', price: 99, recurring: true, volume: 10, unitCost: 5 },
    'site-rebuilds': { channel: 'email', price: 300, volume: 25, capacityPerDay: 1, hoursPerSale: 2, trend: 'flat' },
    'care-plan': { channel: 'email', price: 49, recurring: true, volume: 5 },
    sheets: { channel: 'marketplace', price: 12, volume: 8, platform: 'gumroad', competition: 'medium' },
    'forum-posts': { channel: 'seo', price: 12, volume: 1, platform: 'gumroad' },
    'ui-kits': { channel: 'marketplace', price: 24, volume: 2, platform: 'gumroad', competition: 'high' },
    'canva-templates': { channel: 'marketplace', price: 12, volume: 6, feePct: 0.4, fixedPerMonth: 15, competition: 'high', trend: 'rising' },
    'review-tool': { channel: 'social', price: 12, recurring: true, volume: 2, fixedPerMonth: 20, trend: 'rising', competition: 'medium' },
    'launch-post': { channel: 'social', price: 12, recurring: true, volume: 1 },
    'pod-shirts': { channel: 'social', price: 28, volume: 2, unitCost: 20, fixedPerMonth: 39, competition: 'high' },
    'meta-ads': { channel: 'ads', price: 28, volume: 20, unitCost: 20, competition: 'high' },
    'etsy-pod': { channel: 'marketplace', price: 28, volume: 12, unitCost: 20, platform: 'etsy', competition: 'high' },
  };
  const leadOf = Object.fromEntries(LEADS.map((l) => [l.rooms[0], l.name]));
  let order = 1000;
  // a tiny script language per room: plan, play, step, in, out
  const S = {
    plan: (room, d, text) => lines.push({ kind: 'step', path: room, type: 'plan', text, by: 'agent', ts: at(d) }),
    play: (room, d, play, name, status, extra = {}) => {
      const model = started.has(play) ? {} : MODELS[play] || {}; started.add(play); lines.push({ kind: 'play', path: room, play, name, status, by: 'agent', ...model, ...extra, ts: at(d) });
      // the simulation: a play that is trying or working runs in the simulated market; paused or dropped, it stops
      const on = status === 'trying' || status === 'working';
      if (on && SPECS[play] && !live.has(play)) { live.add(play); lines.push({ kind: 'sim', act: 'launch', path: room, play, spec: SPECS[play], label: name, by: 'agent', ts: at(d + 0.01) }); }
      if (!on && live.has(play)) { live.delete(play); lines.push({ kind: 'sim', act: 'stop', path: room, play, why: extra.why || status, by: 'agent', ts: at(d + 0.01) }); }
    },
    step: (room, d, type, text, play, url) => lines.push({ kind: 'step', path: room, type, text, by: 'agent', ...(play ? { play } : {}), ...(url ? { url } : {}), ts: at(d) }),
    in: (room, d, usd, play, item, source, evidence) => lines.push({ kind: 'money.in', path: room, usd, play, item, source, by: leadOf[room], evidence: evidence || `${source} order #${++order} (demo)`, ts: at(d) }),
    out: (room, d, usd, play, category, payee, evidence) => lines.push({ kind: 'money.out', path: room, usd, play, category, payee, evidence: evidence || `${payee} receipt (demo)`, ts: at(d) }),
    // demand shown without a sale, with its evidence
    sig: (room, d, type, count, play, evidence) => lines.push({ kind: 'signal', path: room, type, count, play, evidence: `${evidence} (demo)`, by: 'agent', ts: at(d) }),
  };
  S.sig('red', 4.3, 'favorite', 140, 'planner-shop', 'Pinterest saves on the ADHD planner pin');
  S.sig('teal', 3.4, 'reply', 6, 'lead-lists', 'agency replies to the intro emails');
  S.sig('teal', 5.2, 'lead', 3, 'lead-lists', 'agencies that asked for a sample list');
  S.sig('orange', 2.8, 'reply', 9, 'site-rebuilds', 'owners who answered the preview-link email');
  S.sig('orange', 4.9, 'meeting', 2, 'site-rebuilds', 'calls booked on the calendar');
  S.sig('gold', 6.5, 'signup', 23, 'review-tool', 'trial sign-ups in the tool\'s admin');
  S.sig('gold', 9.1, 'signup', 18, 'review-tool', 'trial sign-ups in the tool\'s admin');
  S.sig('green', 5.6, 'follower', 60, 'forum-posts', 'forum followers after three answers');
  S.sig('violet', 3.0, 'favorite', 35, 'pod-shirts', 'saves on the shirt ads');
  // steady small sales: n a day on average between two days, one price list
  const drip = (room, play, from, to, perDay, menu, source) => {
    for (let d = from; d < to; d += 0.25) {
      if (rand() > perDay(d) / 4) continue;
      const m = menu[Math.floor(rand() * menu.length)];
      S.in(room, d + rand() * 0.25, m[1], play, m[0], source);
    }
  };

  // RED · Ada: printable planners. Wins week one on a pin that took off, then cools.
  S.plan('red', 0.05, 'Printable planners: design in Canva, sell as instant PDF downloads on a Shopify store and on Etsy. No inventory, no shipping, cheap to test ten designs at once.');
  S.play('red', 0.1, 'planner-shop', 'Printable planner shop', 'trying', { plan: 'Ten planners designed in Canva, sold as instant downloads at $9-$19. Traffic from Pinterest pins and Etsy search.' });
  S.out('red', 0.15, 39, 'planner-shop', 'tool', 'Shopify', 'Shopify Basic, first month (demo)');
  S.out('red', 0.16, 15, 'planner-shop', 'tool', 'Canva', 'Canva Pro, one month (demo)');
  S.step('red', 0.8, 'did', 'Designed ten planners: budget, meal, habit, ADHD daily, teacher, wedding, fitness, reading, cleaning, student.', 'planner-shop');
  S.step('red', 1.1, 'did', 'Listed all ten on the store with search-friendly titles and preview images.', 'planner-shop', 'https://example.com/demo/ada-planners');
  S.play('red', 1.3, 'etsy-mirror', 'Same planners on Etsy', 'trying', { plan: 'Etsy search brings buyers a new store cannot. Mirror the ten at the same prices.' });
  S.out('red', 1.35, 4, 'etsy-mirror', 'other', 'Etsy', 'Etsy listing fees, 20 listings (demo)');
  S.step('red', 1.6, 'blocked', 'Pinterest wants a person to confirm the business account. Twelve pins are drafted and waiting in the dock.', 'planner-shop');
  S.step('red', 2.2, 'did', 'Joshua confirmed the account; twelve pins scheduled across four boards.', 'planner-shop');
  S.play('red', 2.7, 'planner-shop', 'Printable planner shop', 'working', { why: 'First sales inside 48 hours.' });
  drip('red', 'planner-shop', 2.3, 12.4, (d) => (d < 4 ? 3 : d < 7.2 ? 16 : 4), [['ADHD daily planner', 12], ['Budget planner', 9], ['Meal planner', 9], ['Habit tracker', 9], ['Wedding planner', 19]], 'Shopify');
  drip('red', 'etsy-mirror', 3.2, 12.4, (d) => (d < 7 ? 5 : 3), [['ADHD daily planner (Etsy)', 10.9], ['Budget planner (Etsy)', 8.2]], 'Etsy');
  S.play('red', 4.6, 'etsy-mirror', 'Same planners on Etsy', 'working', { why: 'Two to six sales a day from search alone.' });
  S.step('red', 4.1, 'learned', 'One pin of the ADHD planner took off (40k views). That planner outsells the other nine four to one.', 'planner-shop');
  S.step('red', 5.0, 'did', 'Made three variants of the ADHD planner: student, work-from-home, undated.', 'planner-shop');
  S.play('red', 6.0, 'bundle', 'All ten for $29', 'trying', { plan: 'Raise order value: every planner in one bundle, offered on each product page.' });
  S.in('red', 6.4, 29, 'bundle', 'Planner bundle', 'Shopify'); S.in('red', 8.9, 29, 'bundle', 'Planner bundle', 'Shopify');
  S.step('red', 8.2, 'learned', 'The pin stopped spreading. Sales fell from about 16 a day to 4. Need a second traffic source.', 'planner-shop');
  S.plan('red', 8.4, 'Keep the shop running on its own and find a second traffic source: Etsy ads at $1 a day, and new pins twice a week.');
  S.out('red', 8.5, 7, 'etsy-mirror', 'ads', 'Etsy Ads', 'Etsy Ads, 7 days at $1 (demo)');

  // BLUE · Fenn: fixed-price automation gigs. Slow first week (signups and payment clearing), then overtakes.
  S.plan('blue', 0.05, 'Sell done-for-you automations as fixed-price gigs: lead capture to a CRM, invoices into a spreadsheet, review alerts. Claude builds and tests each one; payment lands in Joshua\'s account.');
  S.play('blue', 0.1, 'fiverr-gigs', 'Fixed-price automation gigs', 'trying', { plan: 'Three gig pages at $75, $150 and $300. Deliver in 48 hours.' });
  S.step('blue', 0.7, 'did', 'Wrote three gig pages with example workflows and a short FAQ.', 'fiverr-gigs');
  S.step('blue', 1.2, 'blocked', 'Fiverr needs a human ID check before any gig goes live. Waiting on Joshua.', 'fiverr-gigs');
  S.step('blue', 2.1, 'did', 'Joshua passed the ID check. All three gigs are live.', 'fiverr-gigs', 'https://example.com/demo/fenn-gigs');
  S.play('blue', 2.5, 'upwork-proposals', 'Upwork fixed-price jobs', 'trying', { plan: 'Answer five automation posts a day with a working sample attached.' });
  S.out('blue', 2.55, 15, 'upwork-proposals', 'other', 'Upwork', 'Upwork Connects, 80 (demo)');
  S.step('blue', 3.4, 'did', 'Won a $180 Upwork job: Shopify orders into Google Sheets with a daily summary email.', 'upwork-proposals');
  S.step('blue', 4.0, 'did', 'First two Fiverr orders came in: a $150 lead-capture build and a $75 review alert.', 'fiverr-gigs');
  S.in('blue', 5.8, 180, 'upwork-proposals', 'Orders-to-Sheets build', 'Upwork', 'Upwork milestone released #U-demo-1 (demo)');
  S.step('blue', 6.2, 'learned', 'Fiverr holds money for 7 days after delivery, so week one shows almost none of it.', 'fiverr-gigs');
  S.play('blue', 7.5, 'fiverr-gigs', 'Fixed-price automation gigs', 'working', { why: 'Five orders delivered, all five-star.' });
  S.in('blue', 9.1, 120, 'fiverr-gigs', 'Lead capture to CRM', 'Fiverr', 'Fiverr clearance #F-demo-1 (demo)');
  S.in('blue', 9.2, 60, 'fiverr-gigs', 'Review alerts', 'Fiverr', 'Fiverr clearance #F-demo-2 (demo)');
  S.in('blue', 10.3, 240, 'fiverr-gigs', 'Invoice parsing to spreadsheet', 'Fiverr', 'Fiverr clearance #F-demo-3 (demo)');
  S.in('blue', 10.9, 180, 'upwork-proposals', 'CRM cleanup automation', 'Upwork', 'Upwork milestone released #U-demo-2 (demo)');
  S.in('blue', 11.8, 240, 'fiverr-gigs', 'Invoice parsing to spreadsheet', 'Fiverr', 'Fiverr clearance #F-demo-4 (demo)');
  S.in('blue', 12.2, 120, 'fiverr-gigs', 'Lead capture to CRM', 'Fiverr', 'Fiverr clearance #F-demo-5 (demo)');
  S.play('blue', 9.6, 'upwork-proposals', 'Upwork fixed-price jobs', 'working', { why: 'Two jobs won from 40 proposals.' });
  S.step('blue', 10.0, 'learned', 'Two of five clients asked for a second automation within a week. Repeat work is the real engine here.', 'fiverr-gigs');
  S.play('blue', 10.4, 'retainer', 'Monthly automation care', 'trying', { plan: 'Offer every finished client $150 a month to watch and fix their automations.' });
  S.step('blue', 10.5, 'blocked', 'Retainer offers are drafted for four clients. Agents never message clients, so they are in the dock for Joshua to send.', 'retainer');

  // TEAL · Echo: lead lists from public records, sold to agencies
  S.plan('teal', 0.05, 'Sell verified lead lists: newly registered local businesses from free public permit records, cleaned and enriched, sold to marketing agencies at $120 for 50.');
  S.play('teal', 0.1, 'lead-lists', 'New-business lead lists', 'trying', { plan: 'One county a day. Sell by the list and by subscription.' });
  S.out('teal', 0.3, 29, 'lead-lists', 'tool', 'Email verifier', 'Email verification credits, 2,000 (demo)');
  S.step('teal', 1.0, 'did', 'Built the first three lists: 150 new businesses in Travis, Williamson and Hays counties.', 'lead-lists');
  S.step('teal', 1.4, 'blocked', 'Selling means reaching agencies. Twenty intro emails are drafted in the dock; agents never send.', 'lead-lists');
  S.step('teal', 2.6, 'did', 'Joshua sent the twenty emails. Six replies, two asked for samples.', 'lead-lists');
  S.in('teal', 5.1, 120, 'lead-lists', 'Lead list, 50 businesses', 'Gumroad');
  S.play('teal', 5.3, 'lead-lists', 'New-business lead lists', 'working', { why: 'First agency bought a list.' });
  S.in('teal', 8.2, 120, 'lead-lists', 'Lead list, 50 businesses', 'Gumroad');
  S.play('teal', 8.5, 'weekly-feed', 'Weekly new-business feed', 'trying', { plan: '$99 a month for a fresh list every Monday.' });
  S.in('teal', 11.0, 99, 'weekly-feed', 'Weekly feed, monthly', 'Gumroad');
  S.in('teal', 11.4, 240, 'lead-lists', 'Lead lists, 100 businesses', 'Gumroad');

  // ORANGE · Brix: one-page sites for local businesses with none
  S.plan('orange', 0.05, 'Find local businesses with no website or a broken one, build a one-page Wix site as a free preview, and sell it for $300 (half up front).');
  S.play('orange', 0.1, 'site-rebuilds', 'One-page sites for local businesses', 'trying', { plan: 'Twenty-five previews built from public info. Charge $300; the client pays for their own hosting.' });
  S.step('orange', 1.0, 'did', 'Found 60 businesses with no site; built five preview pages on Wix.', 'site-rebuilds', 'https://example.com/demo/brix-previews');
  S.step('orange', 1.5, 'blocked', 'Twenty-five intro emails with preview links are in the dock for Joshua to send or drop.', 'site-rebuilds');
  S.step('orange', 3.8, 'did', 'Joshua sent the twenty-five. Four replies, two calls booked for him.', 'site-rebuilds');
  S.in('orange', 5.9, 150, 'site-rebuilds', 'Site deposit: Pecan Street Pets', 'Stripe', 'Stripe charge ch_demo_or1 (demo)');
  S.play('orange', 6.0, 'site-rebuilds', 'One-page sites for local businesses', 'working', { why: 'First deposit paid.' });
  S.in('orange', 9.1, 150, 'site-rebuilds', 'Site balance: Pecan Street Pets', 'Stripe', 'Stripe charge ch_demo_or2 (demo)');
  S.in('orange', 10.2, 150, 'site-rebuilds', 'Site deposit: Riverbend Lash', 'Stripe', 'Stripe charge ch_demo_or3 (demo)');
  S.play('orange', 10.6, 'care-plan', 'Site care at $49 a month', 'trying', { plan: 'Updates, hours and photos kept current, for every finished site.' });

  // GREEN · Dot: spreadsheet templates, zero upfront cost
  S.plan('green', 0.05, 'Spreadsheet templates people search for: budget, debt snowball, rental property tracker. Sold on Gumroad at $7-$19, so nothing is spent until something sells.');
  S.play('green', 0.1, 'sheets', 'Google Sheets templates', 'trying', { plan: 'Six templates with a two-minute video walkthrough each.' });
  S.step('green', 0.9, 'did', 'Built six templates with formulas locked and a how-to tab.', 'sheets', 'https://example.com/demo/dot-sheets');
  drip('green', 'sheets', 1.8, 12.4, (d) => (d < 4 ? 1.5 : 3), [['Debt snowball', 9], ['Monthly budget', 7], ['Rental property tracker', 19], ['Wedding budget', 12]], 'Gumroad');
  S.play('green', 3.9, 'sheets', 'Google Sheets templates', 'working', { why: 'Three sales a day from Gumroad search.' });
  S.play('green', 4.5, 'forum-posts', 'Helpful posts in personal-finance forums', 'trying', { plan: 'Answer questions, mention the template where it fits.' });
  S.step('green', 5.0, 'blocked', 'Posting publicly is Joshua\'s call. Six forum answers are drafted in the dock.', 'forum-posts');
  S.play('green', 6.2, 'forum-posts', 'Helpful posts in personal-finance forums', 'dropped', { why: 'The two biggest forums ban self-promotion. Not worth a ban.' });

  // PINK · Hana: design assets for designers
  S.plan('pink', 0.05, 'Design assets for designers: Figma UI kits at $24 and Canva social templates at $12, on Gumroad and Creative Market.');
  S.play('pink', 0.1, 'ui-kits', 'Figma UI kits', 'trying', { plan: 'Two kits: a dashboard kit and a mobile onboarding kit.' });
  S.play('pink', 0.2, 'canva-templates', 'Canva social templates', 'trying', { plan: 'Three packs of 30 posts for salons, gyms and cafes.' });
  S.out('pink', 0.25, 15, 'canva-templates', 'tool', 'Canva', 'Canva Pro, one month (demo)');
  S.step('pink', 2.0, 'did', 'Finished both Figma kits and the salon pack.', 'ui-kits');
  drip('pink', 'ui-kits', 3.5, 12.4, () => 0.8, [['Dashboard UI kit', 24], ['Onboarding UI kit', 24]], 'Gumroad');
  drip('pink', 'canva-templates', 4.0, 12.4, () => 1.1, [['Salon post pack', 12], ['Gym post pack', 12]], 'Creative Market');
  S.play('pink', 7.0, 'ui-kits', 'Figma UI kits', 'working', { why: 'Selling most days without promotion.' });

  // GOLD · Cato: a small subscription tool. Barely moves yet; it is the one that compounds.
  S.plan('gold', 0.05, 'Recurring revenue instead of one-off sales: a review-reply drafter for local businesses at $12 a month. Slow start, but every customer stays.');
  S.play('gold', 0.1, 'review-tool', 'Review-reply tool, $12/month', 'trying', { plan: 'Paste reviews, get replies in the owner\'s voice. Cloudflare Workers, a Netlify landing page.' });
  S.out('gold', 0.2, 12, 'review-tool', 'tool', 'Cloudflare', 'Cloudflare Registrar, one domain (demo)');
  S.step('gold', 1.9, 'did', 'Built the tool and the landing page; tested on 40 real public reviews.', 'review-tool', 'https://example.com/demo/cato-replies');
  S.step('gold', 2.4, 'blocked', 'Taking payments needs a Stripe account in Joshua\'s name (identity and bank details are his).', 'review-tool');
  S.step('gold', 4.3, 'did', 'Stripe is live. Free 7-day trial, then $12 a month.', 'review-tool');
  S.out('gold', 5.0, 20, 'review-tool', 'api', 'Claude API', 'Claude API usage for trial users (demo)');
  S.play('gold', 6.0, 'launch-post', 'Launch post on a maker community', 'trying', { plan: 'One honest launch post with a demo video.' });
  S.step('gold', 6.1, 'blocked', 'The launch post is drafted in the dock. Posting is Joshua\'s call.', 'launch-post');
  S.in('gold', 7.3, 12, 'review-tool', 'Review replies, monthly', 'Stripe', 'Stripe charge ch_demo_g1 (demo)');
  S.in('gold', 9.4, 12, 'review-tool', 'Review replies, monthly', 'Stripe', 'Stripe charge ch_demo_g2 (demo)');
  S.in('gold', 10.2, 24, 'review-tool', 'Review replies, monthly x2', 'Stripe', 'Stripe charge ch_demo_g3 (demo)');
  S.in('gold', 11.7, 12, 'review-tool', 'Review replies, monthly', 'Stripe', 'Stripe charge ch_demo_g4 (demo)');
  S.step('gold', 11.9, 'learned', '$60 a month recurring after twelve days, no churn. Behind today, but every customer counts again next month.', 'review-tool');

  // VIOLET · Gil: print-on-demand with paid ads. Loses money, drops the ads, keeps the designs.
  S.plan('violet', 0.05, 'Print-on-demand shirts: designs in Canva, printed and shipped by Printful through Shopify, traffic from Meta ads.');
  S.play('violet', 0.1, 'pod-shirts', 'Print-on-demand shirts', 'trying', { plan: 'Twelve designs for dog owners. $28 a shirt, about $8 margin.' });
  S.out('violet', 0.2, 39, 'pod-shirts', 'tool', 'Shopify', 'Shopify Basic, first month (demo)');
  S.play('violet', 1.5, 'meta-ads', 'Meta ads to the shirt store', 'trying', { plan: '$20 a day for four days, then keep the ads that sell.' });
  for (let d = 1.6; d < 5.6; d += 1) S.out('violet', d, 20, 'meta-ads', 'ads', 'Meta', `Meta ads, day ${Math.round(d)} (demo)`);
  S.in('violet', 2.9, 8, 'meta-ads', 'Dog dad shirt (margin)', 'Shopify'); S.in('violet', 4.2, 8, 'meta-ads', 'Corgi shirt (margin)', 'Shopify'); S.in('violet', 5.1, 8, 'meta-ads', 'Dog dad shirt (margin)', 'Shopify');
  S.step('violet', 5.8, 'learned', '$80 of ads brought three sales, $24 of margin. Every $1 of ads lost $0.70.', 'meta-ads');
  S.play('violet', 5.9, 'meta-ads', 'Meta ads to the shirt store', 'dropped', { why: 'Lost $56 in four days. Stopped before it lost more.' });
  S.play('violet', 6.3, 'etsy-pod', 'Same shirts on Etsy, no ads', 'trying', { plan: 'Let Etsy search do the selling. Listings cost $0.20 each.' });
  S.out('violet', 6.35, 2.4, 'etsy-pod', 'other', 'Etsy', 'Etsy listing fees, 12 listings (demo)');
  S.in('violet', 9.3, 8, 'etsy-pod', 'Corgi shirt (margin)', 'Etsy'); S.in('violet', 11.2, 8, 'etsy-pod', 'Dog dad shirt (margin)', 'Etsy');
  S.plan('violet', 11.5, 'Shirts alone will not climb back fast. Keep the Etsy shirts and add a second play with no ad spend.');

  lines.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  // the rooms' web research (real pages), a round of tested variants and one thing built in the sandbox, per room
  const R = (room, d, title, text, url, topic) => lines.push({ kind: 'research', path: room, title, text, url, topic, by: 'agent', ts: at(d) });
  R('red', 0.05, 'Etsy conversion is 1-5%', 'eRank: a typical Etsy shop converts 1-5% of visits; planners sit in a crowded category.', ETSY, 'benchmark');
  R('blue', 0.05, 'Upwork proposals: about 15% get a reply', 'GigRadar platform average: 15% of proposals get a client response; new freelancers do worse.', UP, 'benchmark');
  R('blue', 0.06, 'Fiverr keeps 20%', 'Flat 20% seller fee on every order, tips included.', 'https://freelancecompare.com/blog/fiverr-fees-explained', 'cost');
  R('teal', 0.05, 'Cold email averages 3.4% replies', 'Instantly 2026 benchmark report: 3.43% average reply rate across billions of emails.', E, 'benchmark');
  R('orange', 0.05, 'Small deals close about 31% of the time', 'Median win rate for small deals under $10K.', 'https://salesmotion.io/blog/sales-win-rate-benchmarks-2026', 'benchmark');
  R('gold', 0.05, 'Subscriptions lose about 4% a month', 'Recurly 2026 churn benchmarks: 3.2-5.0% a month.', 'https://recurly.com/research/churn-rate-benchmarks/', 'benchmark');
  R('violet', 0.05, 'Facebook clicks cost about $0.60', 'LocalIQ benchmarks: average Facebook cost per click around $0.60.', 'https://localiq.com/blog/facebook-advertising-benchmarks/', 'benchmark');
  R('green', 0.05, 'Gumroad keeps 10% plus 50 cents', 'Gumroad pricing: 10% + $0.50 a direct sale; 30% on Discover.', 'https://gumroad.com/pricing', 'cost');
  R('pink', 0.05, 'Small accounts reach 4-7% of followers', 'Socialinsider 2026: 1-5K follower accounts reach 6.65% on Instagram, 4.35% on Facebook.', 'https://www.socialinsider.io/blog/social-media-reach/', 'benchmark');
  const T = (room, d, play, variants) => lines.push({ kind: 'sim', act: 'test', path: room, play, variants, by: 'agent', ts: at(d) });
  T('red', 0.08, 'planner-shop', [{ label: 'Planners on Etsy at $10', spec: SPECS['etsy-mirror'] }, { label: 'Planners on Pinterest to a store at $14', spec: SPECS['planner-shop'] }, { label: 'Planner bundle at $29', spec: SPECS.bundle }]);
  T('blue', 0.08, 'fiverr-gigs', [{ label: 'Automation gigs on Fiverr at $150', spec: SPECS['fiverr-gigs'] }, { label: 'Upwork proposals at $180', spec: SPECS['upwork-proposals'] }, { label: 'Upwork proposals at $300', spec: { ...SPECS['upwork-proposals'], price: 300 } }]);
  T('teal', 0.08, 'lead-lists', [{ label: 'Lead lists by cold email at $120', spec: SPECS['lead-lists'] }, { label: 'Weekly feed at $99 a month', spec: SPECS['weekly-feed'] }]);
  T('orange', 0.08, 'site-rebuilds', [{ label: 'One-page sites at $300 by email', spec: SPECS['site-rebuilds'] }, { label: 'One-page sites at $500 by email', spec: { ...SPECS['site-rebuilds'], price: 500 } }]);
  T('gold', 0.08, 'review-tool', [{ label: 'Review replies at $12 a month', spec: SPECS['review-tool'] }, { label: 'Review replies at $29 a month', spec: { ...SPECS['review-tool'], price: 29 } }]);
  T('violet', 0.08, 'pod-shirts', [{ label: 'Dog shirts with $20 a day of ads', spec: SPECS['meta-ads'] }, { label: 'Dog shirts on Etsy', spec: SPECS['etsy-pod'] }]);
  T('green', 0.08, 'sheets', [{ label: 'Budget sheets on Gumroad at $12', spec: SPECS.sheets }, { label: 'Forum answers to the sheets', spec: SPECS['forum-posts'] }]);
  T('pink', 0.08, 'canva-templates', [{ label: 'Canva packs at $12', spec: SPECS['canva-templates'] }, { label: 'Figma kits at $24', spec: SPECS['ui-kits'] }]);
  lines.push({ kind: 'sim', act: 'build', path: 'orange', play: 'site-rebuilds', what: 'email', title: 'Intro email with a preview link', to: 'owners of local businesses with no website', format: 'text', content: 'Subject: I built you a free preview site\n\nHi [owner name],\n\nI noticed [business name] has no website, so I built a one-page preview with your hours, photos and a call button: [preview link].\n\nIf you like it, it goes live for $300, half now and half at launch. If not, no charge and I will take it down.\n\n[signature]', by: 'agent', ts: at(0.2) });
  lines.push({ kind: 'sim', act: 'build', path: 'gold', play: 'review-tool', what: 'site', title: 'Review-reply tool landing page', to: 'local business owners', format: 'html', content: '<div style="font-family:system-ui;max-width:560px;margin:40px auto;padding:0 16px"><h1>Reply to every Google review in your own voice</h1><p>Paste a review, get a warm, specific reply in seconds. $12 a month after a 7-day free trial.</p><button style="padding:12px 20px;font-size:16px">Start the free trial</button></div>', by: 'agent', ts: at(0.2) });
  // the demo's money is simulated: its old made-up sales and receipts stay out
  for (const l of lines) if (l.kind !== 'money.in' && l.kind !== 'money.out') ledger.append(l);
  return lines.length;
}
