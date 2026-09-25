// Demo data for previewing the station. It is loudly labeled: the first line is a demo note,
// the reducer sets state.demo, and every page shows a DEMO banner. It refuses to touch a real ledger.
import fs from 'node:fs';
import path from 'node:path';
import { LedgerError } from './ledger.js';
import { addItem, markDone } from './inbox.js';
import { addClient, markPacked } from './clients.js';

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
