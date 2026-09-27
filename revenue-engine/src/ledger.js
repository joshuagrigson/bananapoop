// Append-only JSONL ledger. Every number the engine shows traces back to a line in this file.
// Law 1 (borrowed from StarNet): the interface never asserts a state the ledger cannot prove.
// Law 2 (ours): money.in without evidence is rejected at the door. No evidence, no revenue.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SIM_CHANNELS, SIM_ARTIFACTS, SimError, normalizeSpec, testVariants, monteCarlo, panelQuality } from './sim.js';

export const KINDS = Object.freeze([
  'money.in', 'money.out', 'outcome', 'post', 'job', 'agent.run.start', 'agent.run.end', 'path.status', 'gate', 'note',
  'race', 'play', 'step', 'signal', 'judge', 'research', 'sim',
]);
export const STAGES = Object.freeze(['prospect', 'conversation', 'demo', 'pilot', 'paid', 'retained']);
export const OUT_CATEGORIES = Object.freeze(['api', 'tool', 'ads', 'capital', 'other']);
export const RUN_REASONS = Object.freeze(['done', 'budget', 'max_iters', 'refusal', 'error']);
export const PATH_STATUSES = Object.freeze(['active', 'paused', 'killed']);
// The sandbox race (race.js): every contestant room gets the same stake and an agent who tries to multiply it.
// A play is one way a room is trying to make money; a step is one thing its agent did, planned, learned or is stuck on.
export const PLAY_STATUSES = Object.freeze(['trying', 'working', 'paused', 'dropped']);
export const STEP_TYPES = Object.freeze(['did', 'plan', 'learned', 'blocked']);
export const DEFAULT_HORIZONS = Object.freeze([7, 30, 90, 180]);
// The race's rules, chosen at setup and written on the ledger with the starting gun. What each agent may use to make
// money, what it may spend, who it may contact, how it is scored. The brief each agent gets is written from these.
export const RACE_METHODS = Object.freeze({
  digital: 'Digital products: templates, printables, presets, courses',
  services: 'Freelance services and gigs',
  saas: 'Software and subscriptions',
  content: 'Content: ad revenue, sponsorships, memberships',
  affiliate: 'Affiliate links and referrals',
  ecommerce: 'Physical products and print on demand',
  local: 'Work for local businesses: sites, profiles, marketing',
  data: 'Data and lead lists',
  resale: 'Buying and reselling',
  trading: 'Trading and investing: stocks, crypto',
  betting: 'Betting and prediction markets',
});
export const RACE_CONNECTORS = Object.freeze(['Shopify', 'Wix', 'Canva', 'Figma', 'Adobe', 'Netlify', 'Cloudflare', 'Render', 'Zapier', 'Google Drive', 'GitHub', 'Hugging Face', 'Supermetrics', 'Web search', 'HubSpot', 'Microsoft 365', 'Slack']);
// Joshua's day-job accounts: off unless a race turns them on
export const RACE_WORK_CONNECTORS = Object.freeze(['HubSpot', 'Microsoft 365', 'Slack']);
export const RACE_MODELS = Object.freeze({ 'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5': 'Claude Sonnet 5', 'claude-haiku-4-5': 'Claude Haiku 4.5', 'claude-fable-5-1': 'Claude Fable 5.1' });
// what the race is for: the board and every brief lead with it
export const RACE_PURPOSES = Object.freeze({
  idea: 'Find an idea I can run for real',
  money: 'Make the most money',
  demand: 'Prove demand without spending',
  models: 'See which model does best',
  consistency: 'Find the most consistent agent',
  learn: 'Learn what works, fast',
  custom: 'Something else (in my own words)',
});
// what wins a prize
export const RACE_SCORING = Object.freeze({
  bankroll: 'Biggest bankroll',
  profit: 'Most profit (bankroll minus stake)',
  multiple: 'Biggest multiple (bankroll divided by stake)',
  revenue: 'Most money in, before spending',
  roi: 'Most back for every dollar spent',
  sales: 'Most sales',
  customers: 'Most different customers',
  signals: 'Most demand shown: sign-ups, pre-orders, replies...',
  consistency: 'Steadiest growth: most periods up',
  firstDollar: 'Fastest to a first sale',
  judge: 'Your own scores',
});
export const RACE_TIEBREAKS = Object.freeze({ none: 'Nobody wins that prize', earliest: 'Whoever got there first', leastSpent: 'Whoever spent less', mostSales: 'Whoever made more sales' });
export const RACE_CONTACT = Object.freeze({ drafts: 'Agents draft; Joshua sends', none: 'No contact with people at all', direct: 'Agents send messages themselves (honest, signed, with an opt-out)' });
export const RACE_POSTING = Object.freeze({ drafts: 'Agents draft; Joshua publishes', none: 'No public posts at all', direct: 'Agents post publicly themselves' });
export const RACE_NAME_USE = Object.freeze({ never: 'Never', drafts: 'Only in drafts Joshua sends', allowed: 'Allowed' });
export const RACE_ACCOUNTS = Object.freeze({ ask: 'Ask Joshua first', allowed: 'Allowed', never: 'Never' });
export const RACE_PENALTY = Object.freeze({ warn: 'Flag it on the board', fine: 'Fine the room', out: 'Knock the room out' });
export const RACE_MONEY_MODES = Object.freeze({
  sim: 'Simulation: agents research the real web, but every sale, email, site and ad is simulated',
  paper: 'Paper money: nothing is bought or sold, but real people see the work',
  real: 'Real money',
});
// how fast the simulated market runs, in simulated days per real day
export const SIM_SPEEDS = Object.freeze({ 1: 'Real time: a day is a day', 7: 'A week every day', 30: 'A month every day', 24: 'A day every hour', 288: 'A day every 5 minutes', 1440: 'A day every minute' });
// what an agent can find on the real web and log as research
export const RESEARCH_TOPICS = Object.freeze({ trend: 'A trend', idea: 'A way to make money', price: 'What things sell for', demand: 'Proof people want it', competition: 'Who else sells it', channel: 'Where the buyers are', cost: 'What it costs', rule: 'A platform rule or limit', benchmark: 'A benchmark rate' });
// what an agent does in the simulation: test variants, put one live in the simulated market, stop it, build the real
// thing in the sandbox (an email, a site), or have a simulated panel of buyers read what it built
export const SIM_ACTS = Object.freeze({ test: 'Tested variants', launch: 'Launched in the simulation', stop: 'Stopped in the simulation', build: 'Built in the sandbox', panel: 'Shown to a simulated panel' });
export const RACE_EVIDENCE = Object.freeze({ any: 'Any note', id: 'An order or charge number', link: 'A link to the proof' });
export const RACE_VISIBILITY = Object.freeze({ open: 'Agents can see every room', blind: 'Agents see only their own room' });
export const SPEND_CATEGORIES = Object.freeze({ api: 'API and AI use', tool: 'Tools and software', ads: 'Ads', capital: 'Stock and inventory', other: 'Fees and other' });
// demand the agents can prove without a sale; each has a weight in the demand score
export const SIGNAL_TYPES = Object.freeze({ signup: 'Sign-up', preorder: 'Pre-order', reply: 'Reply', lead: 'Qualified lead', meeting: 'Meeting booked', follower: 'Follower', favorite: 'Save or favorite', view: 'View' });
export const SIGNAL_PLURAL = Object.freeze({ signup: 'sign-ups', preorder: 'pre-orders', reply: 'replies', lead: 'qualified leads', meeting: 'meetings booked', follower: 'followers', favorite: 'saves or favorites', view: 'views' });
export const DEFAULT_SIGNAL_WEIGHTS = Object.freeze({ signup: 1, preorder: 10, reply: 2, lead: 5, meeting: 8, follower: 0.2, favorite: 0.5, view: 0.01 });
export const RULE_KINDS = Object.freeze({ must: 'Must', mustnot: 'Must not', may: 'May' });
export function defaultRaceRules() {
  return {
    purpose: 'idea', purposeText: '', moneyMode: 'sim', simSpeed: 1,
    methods: Object.keys(RACE_METHODS).filter((k) => k !== 'trading' && k !== 'betting'), customMethods: [],
    connectors: RACE_CONNECTORS.filter((c) => !RACE_WORK_CONNECTORS.includes(c)), banned: ['TikTok'],
    spendCategories: Object.keys(SPEND_CATEGORIES), ads: true,
    maxSpendPerDayUsd: null, maxTotalSpendUsd: null, approveOverUsd: null, reserveUsd: null, reinvest: true, knockoutUsd: null,
    outreach: 'drafts', posting: 'drafts', maxMessagesPerDay: 20, useName: 'drafts', personalNetwork: false, newAccounts: 'ask',
    collab: false, visibility: 'open', copying: true,
    // how often each agent checks in, in minutes; 0 means one session that works through the whole race
    everyMinutes: 1440, maxSessionMinutes: null, quietHours: null, weekdaysOnly: false,
    scoring: 'bankroll', tiebreak: 'none', places: 1, eliminateLast: false, idleOutMinutes: null, signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
    ruleBreak: 'warn', fineUsd: 0, evidence: 'any', requireModel: false, dailyReport: false,
    stakes: {}, models: {}, roomNotes: {}, customRules: [], notes: '',
  };
}

const isText = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;
const isUsd = (v) => typeof v === 'number' && Number.isFinite(v);
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());
const isRoomId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(v);
const isPlayId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(v);
const isBy = (v) => ['user', 'agent'].includes(v);
const optUsd = (v, what) => { if (v === undefined || v === null || v === '') return null; if (!isUsd(v) || v < 0 || v > 1e7) fail(`race rules: ${what} must be a dollar amount, or left out`); return Math.round(v * 100) / 100; };
// fills every rule a setup left out with its default, and refuses a rule it cannot read
function raceRules(input) {
  const d = defaultRaceRules();
  if (input === undefined || input === null) return d;
  if (typeof input !== 'object' || Array.isArray(input)) fail('race rules must be an object');
  const r = { ...d };
  const pick = (k, set) => { if (input[k] !== undefined) { if (!set[input[k]]) fail(`race rules: ${k} must be one of ${Object.keys(set).join(', ')}`); r[k] = input[k]; } };
  const bool = (k) => { if (input[k] !== undefined) { if (typeof input[k] !== 'boolean') fail(`race rules: ${k} must be true or false`); r[k] = input[k]; } };
  const text = (k, max) => { if (input[k] !== undefined) { if (typeof input[k] !== 'string' || input[k].length > max) fail(`race rules: ${k} must be text, up to ${max} characters`); r[k] = input[k].trim(); } };
  const mins = (k, lo, hi) => { if (input[k] !== undefined) { if (input[k] === null || input[k] === '') { r[k] = null; return; } if (!Number.isInteger(input[k]) || input[k] < lo || input[k] > hi) fail(`race rules: ${k} must be a whole number from ${lo} to ${hi}, or left out`); r[k] = input[k]; } };
  const words = (k, maxN, maxLen) => { if (input[k] !== undefined) { if (!Array.isArray(input[k]) || input[k].length > maxN || !input[k].every((c) => isText(c) && c.trim().length <= maxLen)) fail(`race rules: ${k} must be a list of up to ${maxN} short names`); r[k] = [...new Set(input[k].map((c) => c.trim()))]; } };
  const roomMap = (k, ok, what) => { if (input[k] !== undefined) { if (!input[k] || typeof input[k] !== 'object' || Array.isArray(input[k]) || !Object.entries(input[k]).every(([id, v]) => isRoomId(id) && ok(v))) fail(`race rules: ${k} must map room ids to ${what}`); r[k] = { ...input[k] }; } };
  pick('purpose', RACE_PURPOSES); text('purposeText', 600); pick('moneyMode', RACE_MONEY_MODES);
  if (input.simSpeed !== undefined) { if (!SIM_SPEEDS[input.simSpeed]) fail(`race rules: simSpeed must be one of ${Object.keys(SIM_SPEEDS).join(', ')} simulated days per real day`); r.simSpeed = Number(input.simSpeed); }
  if (input.methods !== undefined) {
    if (!Array.isArray(input.methods) || !input.methods.every((m) => RACE_METHODS[m])) fail(`race rules: methods must be from ${Object.keys(RACE_METHODS).join(', ')}`);
    r.methods = [...new Set(input.methods)];
  }
  words('customMethods', 30, 80); words('connectors', 60, 40); words('banned', 60, 60);
  if (input.spendCategories !== undefined) {
    if (!Array.isArray(input.spendCategories) || !input.spendCategories.every((c) => SPEND_CATEGORIES[c])) fail(`race rules: spendCategories must be from ${Object.keys(SPEND_CATEGORIES).join(', ')}`);
    r.spendCategories = [...new Set(input.spendCategories)];
  } else if (input.ads === false) r.spendCategories = r.spendCategories.filter((c) => c !== 'ads');
  r.ads = r.spendCategories.includes('ads');
  for (const k of ['maxSpendPerDayUsd', 'maxTotalSpendUsd', 'approveOverUsd', 'reserveUsd', 'knockoutUsd']) if (input[k] !== undefined) r[k] = optUsd(input[k], k);
  if (input.fineUsd !== undefined) r.fineUsd = optUsd(input.fineUsd, 'fineUsd') || 0;
  for (const k of ['reinvest', 'personalNetwork', 'collab', 'copying', 'weekdaysOnly', 'eliminateLast', 'requireModel', 'dailyReport']) bool(k);
  pick('outreach', RACE_CONTACT); pick('posting', RACE_POSTING); pick('useName', RACE_NAME_USE); pick('newAccounts', RACE_ACCOUNTS);
  pick('visibility', RACE_VISIBILITY); pick('scoring', RACE_SCORING); pick('tiebreak', RACE_TIEBREAKS); pick('ruleBreak', RACE_PENALTY); pick('evidence', RACE_EVIDENCE);
  mins('maxMessagesPerDay', 0, 10000); mins('maxSessionMinutes', 1, 10080); mins('idleOutMinutes', 5, 525600); mins('places', 1, 3);
  if (input.everyMinutes !== undefined) { if (!Number.isInteger(input.everyMinutes) || input.everyMinutes < 0 || input.everyMinutes > 10080) fail('race rules: everyMinutes must be a whole number of minutes, 0 (all the time) to 10080 (a week)'); r.everyMinutes = input.everyMinutes; }
  else if (input.everyHours !== undefined) { if (!Number.isInteger(input.everyHours) || input.everyHours < 1 || input.everyHours > 168) fail('race rules: everyHours must be a whole number of hours, 1 to 168'); r.everyMinutes = input.everyHours * 60; }
  if (input.quietHours !== undefined) {
    const q = input.quietHours, hm = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    if (q !== null && !(q && typeof q === 'object' && hm(q.from) && hm(q.to))) fail('race rules: quietHours must be { from: "22:00", to: "07:00" }, or left out');
    r.quietHours = q ? { from: q.from, to: q.to } : null;
  }
  if (input.signalWeights !== undefined) {
    if (!input.signalWeights || typeof input.signalWeights !== 'object' || !Object.entries(input.signalWeights).every(([k, v]) => SIGNAL_TYPES[k] && isUsd(v) && v >= 0 && v <= 1e6)) fail(`race rules: signalWeights must give ${Object.keys(SIGNAL_TYPES).join(', ')} a weight of 0 or more`);
    r.signalWeights = { ...DEFAULT_SIGNAL_WEIGHTS, ...input.signalWeights };
  }
  roomMap('stakes', (v) => isUsd(v) && v > 0 && v <= 1e6, 'dollar amounts above zero');
  roomMap('models', (v) => typeof v === 'string' && /^claude-[a-z0-9.-]{2,40}$/.test(v), 'Claude model ids');
  roomMap('roomNotes', (v) => typeof v === 'string' && v.length <= 1000, 'instructions of up to 1000 characters');
  if (input.customRules !== undefined) {
    if (!Array.isArray(input.customRules) || input.customRules.length > 60 || !input.customRules.every((c) => c && RULE_KINDS[c.kind] && isText(c.text) && c.text.length <= 300)) fail('race rules: customRules must be up to 60 rules, each { kind: must | mustnot | may, text }');
    r.customRules = input.customRules.map((c) => ({ kind: c.kind, text: c.text.trim() }));
  }
  text('notes', 4000);
  return r;
}

export class LedgerError extends Error {}
// what a Monte Carlo result keeps on the ledger
function slimResult(r) { return { runs: r.runs, horizons: r.horizons, net: r.net, sales: r.sales, gross: r.gross, hours: r.hours, pProfit: r.pProfit, breakEvenDay: r.breakEvenDay, pBreakEven: r.pBreakEven }; }
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
      // who did the work: one of the world's folk (a barber, a kid). kid is the older name for the same thing.
      if (ev.by !== undefined && !(isText(ev.by) && ev.by.length <= 40)) fail('money.in by must name who did the work (1-40 chars)');
      if (ev.kid !== undefined && !(isText(ev.kid) && ev.kid.length <= 40)) fail('money.in kid must be the name of the kid who did the chore');
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('money.in play must be a play id (lowercase letters, digits and dashes)');
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
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('money.out play must be a play id (lowercase letters, digits and dashes)');
      if (ev.approved !== undefined && typeof ev.approved !== 'boolean') fail('money.out approved must be true or false: Joshua said yes to this purchase');
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
    case 'race':
      // the starting gun. The rules go on the ledger with it, so changing a default later never rewrites a finished race.
      if (ev.amend === true) {
        if (!isText(ev.evidence, 3)) fail('a race amendment needs evidence: who changed the rules and why');
        ev.rules = raceRules(ev.rules);
        if (ev.name !== undefined && !(isText(ev.name) && ev.name.length <= 60)) fail('race name must be 1-60 characters');
        break;
      }
      if (!isUsd(ev.stakeUsd) || ev.stakeUsd <= 0 || ev.stakeUsd > 1e6) fail('race needs stakeUsd > 0: what each contestant room starts with');
      if (!isText(ev.evidence, 3)) fail('race needs evidence: where the stake money actually sits (a card, an account)');
      // prize times: horizonsMin in minutes (a test race: [30, 60, 120]), or horizons in whole days
      if (ev.horizonsMin !== undefined) {
        if (!(Array.isArray(ev.horizonsMin) && ev.horizonsMin.length >= 1 && ev.horizonsMin.length <= 8 && ev.horizonsMin.every((m) => Number.isInteger(m) && m >= 1 && m <= 3660 * 1440))) fail('race prize times must be 1-8 whole numbers of minutes, e.g. [30, 60, 120]');
        ev.horizonsMin = [...new Set(ev.horizonsMin)].sort((a, b) => a - b);
        delete ev.horizons;
      } else {
        if (ev.horizons === undefined) ev.horizons = [...DEFAULT_HORIZONS];
        if (!(Array.isArray(ev.horizons) && ev.horizons.length >= 1 && ev.horizons.length <= 8 && ev.horizons.every((d) => Number.isInteger(d) && d >= 1 && d <= 3660))) fail('race horizons must be 1-8 whole numbers of days, e.g. [7, 30, 90, 180]');
        ev.horizons = [...new Set(ev.horizons)].sort((a, b) => a - b);
      }
      if (ev.rooms !== undefined && !(Array.isArray(ev.rooms) && ev.rooms.length >= 1 && ev.rooms.length <= 12 && ev.rooms.every(isRoomId))) fail('race rooms must be a list of 1-12 room ids');
      if (ev.name !== undefined && !(isText(ev.name) && ev.name.length <= 60)) fail('race name must be 1-60 characters');
      // the gun can be set for later: the race counts from startsAt
      if (ev.startsAt !== undefined && (!isText(ev.startsAt) || Number.isNaN(Date.parse(ev.startsAt)))) fail('race startsAt must be an ISO-8601 date');
      // an amendment changes the rules (and name) of the race under way; the stake, horizons, rooms and start stay
      if (ev.amend !== undefined && typeof ev.amend !== 'boolean') fail('race amend must be true or false');
      // a real-money race started from a simulation carries what the simulation forecast, fixed at the moment of the switch
      if (ev.fromRace !== undefined && !(isText(ev.fromRace) && ev.fromRace.length <= 40)) fail('race fromRace must be the id of the simulated race it came from');
      if (ev.forecasts !== undefined && !(ev.forecasts && typeof ev.forecasts === 'object' && !Array.isArray(ev.forecasts) && Object.keys(ev.forecasts).every(isRoomId) && JSON.stringify(ev.forecasts).length <= 60000)) fail('race forecasts must map room ids to what the simulation forecast');
      ev.rules = raceRules(ev.rules);
      break;
    case 'play':
      if (!isRoomId(ev.path)) fail('play needs the room id (path) it belongs to');
      if (!isPlayId(ev.play)) fail('play needs a play id: lowercase letters, digits and dashes, e.g. planner-shop');
      if (!(isText(ev.name) && ev.name.length <= 80)) fail('play needs a name (1-80 characters)');
      if (!PLAY_STATUSES.includes(ev.status)) fail(`play status must be one of ${PLAY_STATUSES.join(', ')}`);
      if (ev.plan !== undefined && !(isText(ev.plan) && ev.plan.length <= 2000)) fail('play plan must be 1-2000 characters');
      if (ev.why !== undefined && !(isText(ev.why) && ev.why.length <= 500)) fail('play why must be 1-500 characters');
      // the business model: what it sells, to whom, how they find it, what it charges, what it costs to run
      for (const k of ['offer', 'customer', 'channel', 'pricing', 'costs']) if (ev[k] !== undefined && !(isText(ev[k]) && ev[k].length <= 400)) fail(`play ${k} must be 1-400 characters`);
      // which kind of money-making it is (a race rule can allow or bar each kind)
      if (ev.method !== undefined && !(isText(ev.method) && ev.method.length <= 80)) fail('play method must be a kind of money-making, e.g. digital or services');
      if (!isBy(ev.by)) fail('play.by must be "user" or "agent"');
      break;
    case 'signal':
      // demand shown without a sale: sign-ups, pre-orders, replies... evidence required, like money
      if (!isRoomId(ev.path)) fail('signal needs the room id (path) it belongs to');
      if (!SIGNAL_TYPES[ev.type]) fail(`signal type must be one of ${Object.keys(SIGNAL_TYPES).join(', ')}`);
      if (ev.count === undefined) ev.count = 1;
      if (!Number.isInteger(ev.count) || ev.count < 1 || ev.count > 1e6) fail('signal count must be a whole number, 1 or more');
      if (!isText(ev.evidence, 3)) fail('signal needs evidence (a sign-up list link, an order number, a reply subject). No evidence, no signal.');
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('signal play must be a play id');
      if (!isBy(ev.by)) fail('signal.by must be "user" or "agent"');
      break;
    case 'judge':
      // Joshua's own score for a room, when the race is judged by him
      if (!isRoomId(ev.path)) fail('judge needs the room id (path) it scores');
      if (!isUsd(ev.points) || ev.points < -1000 || ev.points > 1000) fail('judge points must be a number from -1000 to 1000');
      if (!isText(ev.why)) fail('judge needs a why');
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('judge play must be a play id');
      break;
    case 'research':
      // something an agent found on the real web: the url is the evidence, and the simulation's numbers can cite it
      if (!isRoomId(ev.path)) fail('research needs the room id (path) it belongs to');
      if (!(isText(ev.title) && ev.title.length <= 120)) fail('research needs a title (1-120 characters)');
      if (!(isText(ev.text) && ev.text.length <= 1500)) fail('research needs text (1-1500 characters): what the page shows');
      if (!isUrl(ev.url)) fail('research needs the url of the page it came from. No source, no finding.');
      if (ev.topic === undefined) ev.topic = 'trend';
      if (!RESEARCH_TOPICS[ev.topic]) fail(`research topic must be one of ${Object.keys(RESEARCH_TOPICS).join(', ')}`);
      if (ev.numbers !== undefined && !(Array.isArray(ev.numbers) && ev.numbers.length <= 12 && ev.numbers.every((n) => n && isText(n.label) && n.label.length <= 60 && isUsd(n.value) && (n.unit === undefined || (typeof n.unit === 'string' && n.unit.length <= 20))))) fail('research numbers must be up to 12 of { label, value, unit }');
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('research play must be a play id');
      if (!isBy(ev.by)) fail('research.by must be "user" or "agent"');
      break;
    case 'sim':
      if (!isRoomId(ev.path)) fail('sim needs the room id (path) it belongs to');
      if (!SIM_ACTS[ev.act]) fail(`sim act must be one of ${Object.keys(SIM_ACTS).join(', ')}`);
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('sim play must be a play id');
      if (['launch', 'stop', 'panel'].includes(ev.act) && !isPlayId(ev.play)) fail(`sim ${ev.act} needs the play id`);
      if (!isBy(ev.by)) fail('sim.by must be "user" or "agent"');
      try {
        if (ev.act === 'test') {
          // the results are worked out here, at the door, from the specs: nobody can log a simulated result by hand
          if (!Array.isArray(ev.variants) || ev.variants.length < 1 || ev.variants.length > 24) fail('sim test needs 1-24 variants, each { label, spec }');
          const horizons = ev.horizons === undefined ? [7, 30, 90] : ev.horizons;
          if (!(Array.isArray(horizons) && horizons.length >= 1 && horizons.length <= 4 && horizons.every((d) => Number.isInteger(d) && d >= 1 && d <= 365))) fail('sim test horizons must be 1-4 whole numbers of days up to 365');
          ev.horizons = [...new Set(horizons)].sort((a, b) => a - b);
          ev.variants = testVariants(ev.variants.map((v) => ({ label: v && v.label, spec: v && (v.spec || v) })), { horizons: ev.horizons, runs: 200, seed: ev.id }).map((v) => ({ ...v, result: slimResult(v.result) }));
        } else if (ev.act === 'launch') {
          const n = normalizeSpec(ev.spec);
          ev.spec = n.spec; ev.flags = n.flags; ev.cited = n.cited; ev.set = n.set;
          if (ev.label !== undefined && !(isText(ev.label) && ev.label.length <= 120)) fail('sim launch label must be 1-120 characters');
          ev.forecast = slimResult(monteCarlo(n.spec, { horizons: [7, 30, 90], runs: 200, seed: ev.id }));
        } else if (ev.act === 'build') {
          if (!SIM_ARTIFACTS[ev.what]) fail(`sim build what must be one of ${Object.keys(SIM_ARTIFACTS).join(', ')}`);
          if (!(isText(ev.title) && ev.title.length <= 120)) fail('sim build needs a title (1-120 characters)');
          if (!(isText(ev.content) && ev.content.length <= 60000)) fail('sim build needs the content itself (up to 60,000 characters): the email, the page, the listing');
          if (ev.to !== undefined && !(isText(ev.to) && ev.to.length <= 200)) fail('sim build to must say who it would go to (up to 200 characters)');
          if (ev.format !== undefined && !['text', 'markdown', 'html'].includes(ev.format)) fail('sim build format must be text, markdown or html');
        } else if (ev.act === 'panel') {
          if (!(typeof ev.score === 'number' && ev.score >= 0 && ev.score <= 1)) fail('sim panel score must be the share of the panel who would act, 0 to 1');
          if (!(Number.isInteger(ev.n) && ev.n >= 1 && ev.n <= 200)) fail('sim panel n must be how many simulated buyers read it, 1 to 200');
          if (ev.notes !== undefined && !(isText(ev.notes) && ev.notes.length <= 2000)) fail('sim panel notes must be up to 2000 characters');
          if (ev.build !== undefined && !isText(ev.build)) fail('sim panel build must be the id of what it read');
          ev.quality = panelQuality(ev.score);
        } else if (ev.act === 'stop') {
          if (ev.why !== undefined && !(isText(ev.why) && ev.why.length <= 500)) fail('sim stop why must be 1-500 characters');
        }
      } catch (e) {
        if (e instanceof SimError) fail(`sim ${ev.act}: ${e.message}`);
        throw e;
      }
      break;
    case 'step':
      if (!isRoomId(ev.path)) fail('step needs the room id (path) it belongs to');
      if (!(isText(ev.text) && ev.text.length <= 600)) fail('step needs text (1-600 characters): what was done, planned, learned or is blocked');
      if (ev.type === undefined) ev.type = 'did';
      if (!STEP_TYPES.includes(ev.type)) fail(`step type must be one of ${STEP_TYPES.join(', ')}`);
      if (ev.play !== undefined && !isPlayId(ev.play)) fail('step play must be a play id');
      if (ev.url !== undefined && !isUrl(ev.url)) fail('step url must be a live http(s) URL');
      if (!isBy(ev.by)) fail('step.by must be "user" or "agent"');
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
