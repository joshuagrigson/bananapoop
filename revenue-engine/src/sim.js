// The simulated market. A room's agent researches the real web, then tries its ideas here instead of on real people:
// every email, listing, post, ad and sale below is simulated, and nothing leaves the station until Joshua presses
// REAL MONEY. Pure and seeded: the same spec, seed and day always give the same result, so the board can re-derive the
// simulated world on every read instead of storing it, and nobody (an agent included) can write a simulated sale.
//
// The model is a funnel per channel: how many people a play reaches a day, what share take each step, what the last
// step is worth. The rates start from published benchmarks (PRIORS, each with its sources). An agent may set its own
// rate, but only a rate it can cite beats the benchmark's typical value: an uncited number is capped at typical, so an
// idea never wins on a guess. Price against the market, competition, the trend and a panel's read of the actual work
// move the buying step up or down, all bounded.
import { PRIORS, FEES } from './sim-priors.js';

export { PRIORS, FEES };

const DAY = 86400e3;
export const SIM_CHANNELS = Object.freeze({
  email: { title: 'Cold email', unit: 'emails sent a day', volMax: 500, stages: ['reply', 'positive', 'close'], signals: { reply: 'reply', positive: 'lead' }, lag: [2, 10], audience: 50000 },
  dm: { title: 'Direct messages (LinkedIn and similar)', unit: 'messages sent a day', volMax: 40, stages: ['reply', 'positive', 'close'], signals: { reply: 'reply', positive: 'lead' }, lag: [2, 10], audience: 30000 },
  local: { title: 'Local businesses: calls and visits', unit: 'businesses contacted a day', volMax: 80, stages: ['meeting', 'close'], signals: { meeting: 'meeting' }, lag: [3, 14], audience: 5000 },
  freelance: { title: 'Freelance proposals (Upwork and similar)', unit: 'proposals sent a day', volMax: 30, stages: ['interview', 'hire'], signals: { interview: 'reply' }, lag: [1, 7], audience: 20000 },
  marketplace: { title: 'Marketplace listings (Etsy, Gumroad, Fiverr and similar)', unit: 'listings live', volMax: 500, stages: ['views', 'conv'], signals: { views: 'view' }, lag: [0, 0], audience: 1e7, ramp: true },
  ads: { title: 'Paid ads to a sales page', unit: 'dollars of ads a day', volMax: 5000, stages: ['cpc', 'conv'], signals: { cpc: 'view' }, lag: [0, 1], audience: 1e7, spend: true },
  social: { title: 'Organic social posts', unit: 'posts a day', volMax: 12, stages: ['reach', 'follow', 'ctr', 'conv'], signals: { reach: 'view', follow: 'follower' }, lag: [0, 2], audience: 1e7, growth: true },
  seo: { title: 'Search: articles and pages', unit: 'new pages a day', volMax: 8, stages: ['visits', 'conv'], signals: { visits: 'view' }, lag: [0, 0], audience: 1e7, ramp: true },
});
export const SIM_COMPETITION = Object.freeze({ low: 1.15, medium: 1, high: 0.75 });
export const SIM_TREND = Object.freeze({ rising: 1.15, flat: 1, falling: 0.8 });
export const DEMAND_KINDS = Object.freeze(['views', 'searches', 'posts', 'buyers']);
export const SIM_ARTIFACTS = Object.freeze({ email: 'Email', site: 'Site or landing page', post: 'Post', listing: 'Listing', ad: 'Ad', product: 'Product', script: 'Script', proposal: 'Proposal', other: 'Other' });
// a panel's read (share of simulated buyers who would act) to the quality multiplier: 20% or less 0.6, 50% 1.0, 80% up 1.4
export const panelQuality = (score) => Math.round((0.6 + 0.8 * Math.max(0, Math.min(1, (score - 0.2) / 0.6))) * 100) / 100;

// ---- seeded randomness: mulberry32 over a string hash, so a (race, room, play, day) always rolls the same
export function hashSeed(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function binomial(r, n, p) {
  n = Math.max(0, Math.floor(n)); p = Math.max(0, Math.min(1, p));
  if (!n || !p) return 0;
  if (n < 40) { let k = 0; for (let i = 0; i < n; i++) if (r() < p) k++; return k; }
  const m = n * p, sd = Math.sqrt(m * (1 - p));
  return Math.max(0, Math.min(n, Math.round(m + sd * normal(r))));
}
function poisson(r, lam) {
  if (lam <= 0) return 0;
  if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * normal(r)));
  const L = Math.exp(-lam); let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

const r4 = (v) => Math.round(v * 10000) / 10000;
const r2 = (v) => Math.round(v * 100) / 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());
class SimError extends Error {}
const fail = (m) => { throw new SimError(m); };
export { SimError };

// A spec is one variant of an idea, ready to simulate. Normalizing it is where the guard lives: every rate the agent
// set is checked against the channel's benchmark and its citation. Returns { spec, used, flags }: the numbers the
// simulator will actually use, and a plain line for every number it changed and why.
export function normalizeSpec(input, { maxPerDay = null, maxSpendPerDay = null } = {}) {
  if (!input || typeof input !== 'object') fail('a sim spec must be an object');
  const ch = SIM_CHANNELS[input.channel];
  if (!ch) fail(`channel must be one of ${Object.keys(SIM_CHANNELS).join(', ')}`);
  const pri = PRIORS[input.channel];
  const flags = [];
  const s = { channel: input.channel };
  const num = (k, lo, hi, def) => {
    const v = input[k];
    if (v === undefined || v === null || v === '') return def;
    if (!isNum(v) || v < lo || v > hi) fail(`${k} must be a number from ${lo} to ${hi}`);
    return v;
  };
  s.price = num('price', 0.5, 100000, null);
  if (s.price === null) fail('price is required: what one sale (or one month, if recurring) costs the buyer, in dollars');
  s.recurring = input.recurring === true;
  s.churn = s.recurring ? num('churn', 0.005, 0.9, null) : null;
  s.unitCost = num('unitCost', 0, 100000, 0);
  s.feePct = num('feePct', 0, 0.9, null);
  s.platform = typeof input.platform === 'string' ? input.platform.slice(0, 40) : null;
  s.fixedPerMonth = num('fixedPerMonth', 0, 100000, 0);
  s.volume = num('volume', 0, 1e6, null);
  if (s.volume === null) fail(`volume is required: ${ch.unit}`);
  s.capacityPerDay = num('capacityPerDay', 0.01, 1e6, null);
  s.hoursPerSale = num('hoursPerSale', 0, 1000, 0);
  s.audience = num('audience', 10, 1e9, null);
  s.marketPrice = num('marketPrice', 0.5, 100000, null);
  s.competition = input.competition === undefined ? 'medium' : input.competition;
  if (!SIM_COMPETITION[s.competition]) fail(`competition must be one of ${Object.keys(SIM_COMPETITION).join(', ')}`);
  s.trend = input.trend === undefined ? 'flat' : input.trend;
  if (!SIM_TREND[s.trend]) fail(`trend must be one of ${Object.keys(SIM_TREND).join(', ')}`);
  s.quality = num('quality', 0.6, 1.4, 1);
  const cites = input.cites && typeof input.cites === 'object' && !Array.isArray(input.cites) ? input.cites : {};
  const cited = (k) => isUrl(cites[k]);
  s.cites = Object.fromEntries(Object.entries(cites).filter(([, u]) => isUrl(u)).map(([k, u]) => [k, u.trim()]));

  // volume: what one person or account can actually do on this channel a day
  let volCap = ch.volMax;
  if (input.channel === 'email' || input.channel === 'dm') { if (maxPerDay !== null && maxPerDay !== undefined) volCap = Math.min(volCap, maxPerDay); }
  if (input.channel === 'ads' && maxSpendPerDay !== null && maxSpendPerDay !== undefined) volCap = Math.min(volCap, maxSpendPerDay);
  if (s.volume > volCap) { flags.push(`volume ${s.volume} is more than ${volCap} ${ch.unit} can really be done; using ${volCap}`); s.volume = volCap; }

  // rates: the benchmark's typical value, unless the agent cites a source for its own
  s.rates = {};
  const given = input.rates && typeof input.rates === 'object' ? input.rates : {};
  for (const k of Object.keys(pri.rates)) {
    const b = pri.rates[k];
    const v = given[k];
    if (v === undefined || v === null) { s.rates[k] = b.mid; continue; }
    if (!isNum(v) || v < 0) fail(`rates.${k} must be a number of 0 or more`);
    if (cited(k)) {
      const lo = b.lo * 0.5, hi = b.hi * 1.5, c = Math.max(lo, Math.min(hi, v));
      if (c !== v) flags.push(`${k} ${v} is outside what any benchmark shows (${r4(lo)}-${r4(hi)}); using ${r4(c)}`);
      s.rates[k] = c;
    } else if (b.better === 'low' ? v < b.mid : v > b.mid) {
      flags.push(`${k} ${v} is better than the typical ${b.mid} with no source cited; using ${b.mid} (cite a source to use your own)`);
      s.rates[k] = b.mid;
    } else s.rates[k] = v;
  }
  for (const k of Object.keys(given)) if (!pri.rates[k]) flags.push(`rates.${k} is not a step of ${ch.title.toLowerCase()} (${Object.keys(pri.rates).join(', ')}); ignored`);
  if (s.feePct === null) s.feePct = FEES[s.platform] !== undefined ? FEES[s.platform].pct : pri.feePct;
  if (s.recurring && s.churn === null) s.churn = PRIORS.recurring.churn.mid;
  if (s.recurring && !cited('churn') && input.churn !== undefined && input.churn < PRIORS.recurring.churn.mid) {
    flags.push(`churn ${input.churn} is lower than the typical ${PRIORS.recurring.churn.mid} a month with no source cited; using ${PRIORS.recurring.churn.mid}`);
    s.churn = PRIORS.recurring.churn.mid;
  }
  if (s.marketPrice !== null && !cited('marketPrice')) flags.push('marketPrice has no source: cite the listings or pages it came from');
  // the market itself, from research: how much attention the niche gets a month (views, searches, job posts, buyers),
  // how many sellers split it, and how fast it is growing. Only numbers with a source count; they size the market
  // directly instead of the benchmark guess, and a cited growth rate replaces the rising/flat/falling label.
  s.demand = null; const drivers = [];
  if (input.demand && typeof input.demand === 'object') {
    const dm = input.demand, dc = dm.cites && typeof dm.cites === 'object' ? dm.cites : {}, d = { kind: DEMAND_KINDS.includes(dm.kind) ? dm.kind : 'views', cites: {} };
    const take = (k, ok, what) => { if (dm[k] === undefined || dm[k] === null) return; if (!ok(dm[k])) fail(`demand.${k} must be ${what}`); if (!isUrl(dc[k])) { flags.push(`demand.${k} has no source; ignored (cite the page it came from)`); return; } d[k] = dm[k]; d.cites[k] = dc[k].trim(); };
    take('monthly', (v) => isNum(v) && v > 0 && v < 1e11, 'a positive number: attention the niche gets a month');
    take('sellers', (v) => isNum(v) && v >= 1 && v < 1e9, 'a number of competing sellers or listings, 1 or more');
    take('growth', (v) => isNum(v) && v > -0.95 && v < 100, 'a yearly growth rate, e.g. 0.45 for +45% a year');
    if (d.growth !== undefined && d.growth > 2) { flags.push(`demand.growth ${d.growth} is capped at 2 (tripling a year): a fast trend rarely keeps its pace`); d.growth = 2; }
    if (Object.keys(d.cites).length) {
      s.demand = d;
      if (d.growth !== undefined) drivers.push(`demand growing ${Math.round(d.growth * 100)}% a year (sourced), in place of the "${s.trend}" label`);
      if (d.monthly && d.sellers) drivers.push(`${d.monthly.toLocaleString('en-US')} ${d.kind} a month split across ${d.sellers.toLocaleString('en-US')} sellers: about ${r2(d.monthly / 30 / (d.sellers + 1))} a day for a fair share`);
      else if (d.monthly && d.kind === 'posts') drivers.push(`${d.monthly.toLocaleString('en-US')} job posts a month (sourced) cap proposals at about ${r2(d.monthly / 30)} a day`);
      else if (d.monthly && d.kind !== 'buyers') drivers.push(`${d.monthly.toLocaleString('en-US')} ${d.kind} a month (sourced); add the number of competing sellers to size your share of it`);
      if (d.monthly && d.kind === 'buyers' && input.audience === undefined) { s.audience = d.monthly; drivers.push(`${d.monthly.toLocaleString('en-US')} buyers with this need cap how many can ever be reached`); }
    }
  }
  s.drivers = drivers;
  if (s.audience === null) s.audience = ch.audience;
  for (const k of Object.keys(pri.rates)) if (given[k] !== undefined && cited(k)) s.drivers.push(`${k} ${s.rates[k]} from a cited source`);
  if (s.recurring && input.churn !== undefined && cited('churn')) s.drivers.push(`churn ${s.churn} a month from a cited source`);
  const citedN = Object.keys(pri.rates).filter((k) => given[k] !== undefined && cited(k)).length + (s.marketPrice !== null && cited('marketPrice') ? 1 : 0);
  const setN = Object.keys(pri.rates).filter((k) => given[k] !== undefined).length + (s.marketPrice !== null ? 1 : 0);
  const dN = s.demand ? Object.keys(s.demand.cites).length : 0;
  return { spec: s, flags, cited: citedN + dN, set: setN + dN, drivers: s.drivers };
}

// what one buyer-step multiplier comes to: price against the market, competition, the trend
function buyFactor(s) {
  let f = SIM_COMPETITION[s.competition] * (s.demand && s.demand.growth !== undefined ? 1 : SIM_TREND[s.trend]);
  if (s.marketPrice) f *= Math.max(0.2, Math.min(2, (s.marketPrice / s.price) ** 1.2));
  return f;
}

// One run of the market, day by day. start: state carried from an earlier stretch (followers, sales so far, subscribers,
// replies still coming). Returns every day's numbers and the state to carry on from.
export function simulate(spec, days, seed, start = null) {
  const ch = SIM_CHANNELS[spec.channel], R = spec.rates, r = rng(seed);
  const st = start ? { ...start, pending: [...start.pending] } : { day: 0, reached: 0, sales: 0, followers: 0, subs: 0, pages: 0, pending: [] };
  const out = [];
  const buy = buyFactor(spec) * spec.quality;
  const first = Math.sqrt(spec.quality);
  const fee = spec.feePct;
  for (let i = 0; i < days; i++) {
    const d = st.day;
    const sat = Math.max(0, 1 - st.reached / spec.audience);
    const row = { day: d, reach: 0, engaged: 0, leads: 0, sales: 0, lost: 0, grossUsd: 0, feesUsd: 0, costUsd: 0, adsUsd: 0, toolUsd: 0, subs: 0, signals: {} };
    const sig = (k, n) => { if (n > 0 && ch.signals[k]) row.signals[ch.signals[k]] = (row.signals[ch.signals[k]] || 0) + n; };
    let buyers = 0;
    // the market from research: a sourced growth rate moves attention over time; monthly demand split across the
    // sellers is the most a fair share of the niche can bring in a day
    const dmd = spec.demand, gm = dmd && dmd.growth !== undefined ? Math.max(0.5, Math.min(3, (1 + dmd.growth) ** (d / 365))) : 1;
    const fair = dmd && dmd.monthly && dmd.sellers ? (dmd.monthly / 30 / (dmd.sellers + 1)) * gm : null;
    switch (spec.channel) {
      case 'email': case 'dm': {
        const sent = Math.round(spec.volume * sat); row.reach = sent;
        const rep = binomial(r, sent, R.reply * first); sig('reply', rep); row.engaged = rep;
        const pos = binomial(r, rep, Math.min(1, R.positive * gm)); sig('positive', pos); row.leads = pos;
        buyers = binomial(r, pos, R.close * buy);
        break;
      }
      case 'local': {
        const n = Math.round(spec.volume * sat); row.reach = n;
        const m = binomial(r, n, Math.min(1, R.meeting * first * gm)); sig('meeting', m); row.engaged = m; row.leads = m;
        buyers = binomial(r, m, R.close * buy);
        break;
      }
      case 'freelance': {
        // you can only pitch jobs that exist: sourced job posts a month cap the proposals, and growth adds jobs
        const posts = dmd && dmd.monthly && dmd.kind === 'posts' ? (dmd.monthly / 30) * gm : Infinity;
        const n = Math.round(Math.min(spec.volume, posts) * sat); row.reach = n;
        const iv = binomial(r, n, Math.min(1, R.interview * first * (posts === Infinity ? gm : 1))); sig('interview', iv); row.engaged = iv; row.leads = iv;
        buyers = binomial(r, iv, R.hire * buy);
        break;
      }
      case 'marketplace': {
        // a new listing starts nearly unseen and fills in over the ramp; sales so far (reviews) lift it, up to double
        const ramp = Math.min(1, 0.1 + 0.9 * (d / Math.max(1, R.ramp)));
        const proof = Math.min(2, 1 + st.sales / 200);
        // a sourced fair share of the niche's views replaces the benchmark guess: a 10-listing shop gets its share,
        // a bigger catalog up to twice that
        const base = fair !== null && dmd.kind === 'views' ? fair * Math.min(2, Math.sqrt(spec.volume / 10)) : spec.volume * R.views * gm;
        const views = poisson(r, base * ramp * proof * first);
        row.reach = views; sig('views', views); row.engaged = views;
        buyers = binomial(r, views, R.conv * buy);
        break;
      }
      case 'ads': {
        const budget = spec.volume * sat; row.adsUsd = r2(budget);
        const cpc = Math.max(0.05, R.cpc * (1 + 0.15 * normal(r)));
        const clicks = Math.floor(Math.min(budget / cpc, fair !== null ? fair : Infinity) * first);
        row.reach = clicks; sig('cpc', clicks); row.engaged = clicks;
        buyers = binomial(r, clicks, R.conv * buy);
        break;
      }
      case 'social': {
        // reach per post grows with the followers the posts win; a link click then buys on the sales page
        const perPost = R.reach + st.followers * R.follower_reach;
        const reach = poisson(r, spec.volume * perPost * sat * first * gm);
        row.reach = reach; sig('reach', reach);
        const fol = binomial(r, reach, R.follow); st.followers += fol; sig('follow', fol);
        const clicks = binomial(r, reach, R.ctr); row.engaged = clicks;
        buyers = binomial(r, clicks, R.conv * buy);
        break;
      }
      case 'seo': {
        // every page ever written keeps drawing visits once search trusts it, after a slow start
        st.pages += spec.volume;
        const age = Math.min(1, d / Math.max(1, R.ramp));
        // a sourced fair share of the niche's searches replaces the benchmark visits per page
        const visits = poisson(r, (fair !== null && dmd.kind === 'searches' ? fair * Math.min(1, st.pages / 20) : st.pages * R.visits * gm) * age * age * first);
        row.reach = visits; sig('visits', visits); row.engaged = visits;
        buyers = binomial(r, visits, R.conv * buy);
        break;
      }
      default: break;
    }
    // buyers from slower channels decide days later
    const [l0, l1] = ch.lag;
    for (let b = 0; b < buyers; b++) st.pending.push(d + l0 + Math.floor(r() * (l1 - l0 + 1)));
    let today = 0; const keep = [];
    for (const due of st.pending) (due <= d ? today++ : keep.push(due));
    st.pending = keep;
    if (spec.capacityPerDay !== null && today > spec.capacityPerDay) { row.lost = today - Math.floor(spec.capacityPerDay); today = Math.floor(spec.capacityPerDay); }
    row.sales = today; st.sales += today;
    st.reached += row.reach;
    if (spec.recurring) {
      // each subscriber pays the monthly price spread over its days; some leave every day
      st.subs = st.subs - binomial(r, st.subs, spec.churn / 30) + today;
      row.subs = st.subs;
      row.grossUsd = r2((st.subs * spec.price) / 30);
    } else row.grossUsd = r2(today * spec.price);
    row.feesUsd = r2(row.grossUsd * fee);
    row.costUsd = r2(today * spec.unitCost);
    if (spec.fixedPerMonth && d % 30 === 0) row.toolUsd = r2(spec.fixedPerMonth);
    row.netUsd = r2(row.grossUsd - row.feesUsd - row.costUsd - row.adsUsd - row.toolUsd);
    row.hours = r2(today * spec.hoursPerSale);
    out.push(row);
    st.day += 1;
  }
  return { days: out, state: st };
}

const pct = (xs, q) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1) + 0.5)))]; };
// Many runs of one variant: the range of what could happen at each horizon, how often it ends in profit, when it
// usually breaks even. horizons in days.
export function monteCarlo(spec, { horizons = [7, 30, 90], runs = 200, seed = 1, stakeUsd = null } = {}) {
  const last = Math.max(...horizons);
  const nets = horizons.map(() => []), sales = horizons.map(() => []), gross = horizons.map(() => []), hours = horizons.map(() => []);
  const breakEven = [], broke = [];
  for (let k = 0; k < runs; k++) {
    const { days } = simulate(spec, last, hashSeed(seed, k));
    let cum = 0, cs = 0, cg = 0, ch = 0, low = 0;
    let hi = 0;
    const cums = [];
    for (let d = 0; d < days.length; d++) {
      cum += days[d].netUsd; cs += days[d].sales; cg += days[d].grossUsd; ch += days[d].hours;
      cums.push(cum);
      low = Math.min(low, cum);
      while (hi < horizons.length && horizons[hi] === d + 1) { nets[hi].push(r2(cum)); sales[hi].push(cs); gross[hi].push(r2(cg)); hours[hi].push(r2(ch)); hi++; }
    }
    // break-even: the day it went into profit and stayed there to the last horizon
    let be = null;
    if (cum > 0) { be = cums.length; for (let d = cums.length - 1; d >= 0 && cums[d] > 0; d--) be = d + 1; }
    breakEven.push(be);
    if (stakeUsd !== null) broke.push(low < -stakeUsd);
  }
  const bes = breakEven.filter((x) => x !== null);
  return {
    runs, horizons,
    net: horizons.map((h, i) => ({ days: h, p10: pct(nets[i], 0.1), p50: pct(nets[i], 0.5), p90: pct(nets[i], 0.9), mean: r2(nets[i].reduce((a, b) => a + b, 0) / runs) })),
    sales: horizons.map((h, i) => ({ days: h, p50: pct(sales[i], 0.5), p90: pct(sales[i], 0.9) })),
    gross: horizons.map((h, i) => ({ days: h, p50: pct(gross[i], 0.5) })),
    hours: horizons.map((h, i) => ({ days: h, p50: pct(hours[i], 0.5) })),
    pProfit: horizons.map((h, i) => r2(nets[i].filter((v) => v > 0).length / runs)),
    breakEvenDay: bes.length > runs / 2 ? pct(bes, 0.5) : null,
    pBreakEven: r2(bes.length / runs),
    pBust: stakeUsd !== null ? r2(broke.filter(Boolean).length / runs) : null,
  };
}

// Test a set of variants at once: normalize each, simulate each, rank them by the typical net at the last horizon.
export function testVariants(variants, opts = {}) {
  const horizons = opts.horizons || [7, 30, 90];
  return variants.map((v, i) => {
    const { spec, flags, cited, set, drivers } = normalizeSpec(v.spec || v, opts);
    const result = monteCarlo(spec, { horizons, runs: opts.runs || 200, seed: hashSeed(opts.seed || 'test', i, JSON.stringify(spec)), stakeUsd: opts.stakeUsd ?? null });
    return { label: String(v.label || `${SIM_CHANNELS[spec.channel].title} at $${spec.price}`).slice(0, 120), spec, flags, cited, set, drivers, result };
  }).sort((a, b) => b.result.net[b.result.net.length - 1].p50 - a.result.net[a.result.net.length - 1].p50);
}

// ---- the live simulation inside a race: every launched play runs in the simulated market from its launch, on the
// race's own clock (speed: simulated days per real day), and each finished simulated day becomes money lines the race
// counts exactly like real ones. Derived on every read from the launches on the ledger; never stored.
// launches: [{ ts, spec, stop?, id }] oldest first, for one play. Returns { lines, signals, days, state, live }.
export function liveLines({ raceId, room, play, launches, now, speed = 1, until = Infinity }) {
  const lines = [], signals = [], rows = [];
  let state = null, live = false;
  const end = Math.min(now, until);
  for (let i = 0; i < launches.length; i++) {
    const L = launches[i];
    if (L.stop) { live = false; continue; }
    const t0 = Date.parse(L.ts), t1 = Math.min(end, i + 1 < launches.length ? Date.parse(launches[i + 1].ts) : Infinity);
    if (!(t1 > t0)) { live = true; continue; }
    const perDay = DAY / speed;
    const n = Math.min(3660, Math.floor((t1 - t0) / perDay));
    live = i === launches.length - 1;
    if (n <= 0) continue;
    const base = state ? state.day : 0;
    const { days, state: s2 } = simulate(L.spec, n, hashSeed(raceId, room, play, i), state);
    state = s2;
    days.forEach((row, k) => {
      const dayEnd = t0 + (k + 1) * perDay, jr = rng(hashSeed(raceId, room, play, i, 'at', k));
      const at = (f) => new Date(Math.round(dayEnd - perDay * (1 - f))).toISOString();
      const simDay = base + k + 1;
      rows.push({ ...row, at: new Date(Math.round(dayEnd)).toISOString(), simDay });
      const who = row.sales === 1 ? 'a simulated buyer' : `${row.sales} simulated buyers`;
      if (row.grossUsd > 0) lines.push({ dir: 'in', ts: at(0.3 + jr() * 0.6), usd: r2(row.grossUsd - row.feesUsd), item: L.spec.recurring ? `${row.subs} simulated subscriber${row.subs === 1 ? '' : 's'}` : `${row.sales} sale${row.sales === 1 ? '' : 's'}`, source: L.spec.platform || SIM_CHANNELS[L.spec.channel].title, evidence: `simulated: ${who}, day ${simDay}`, sim: true, play, id: `sim:${play}:${i}:${k}:in` });
      if (row.adsUsd > 0) lines.push({ dir: 'out', ts: at(0.05), usd: row.adsUsd, category: 'ads', payee: 'simulated ads', evidence: `simulated ad spend, day ${simDay}`, sim: true, play, id: `sim:${play}:${i}:${k}:ads` });
      if (row.costUsd > 0) lines.push({ dir: 'out', ts: at(0.95), usd: row.costUsd, category: 'capital', payee: 'simulated costs', evidence: `simulated cost of ${row.sales} sale${row.sales === 1 ? '' : 's'}, day ${simDay}`, sim: true, play, id: `sim:${play}:${i}:${k}:cost` });
      if (row.toolUsd > 0) lines.push({ dir: 'out', ts: at(0.02), usd: row.toolUsd, category: 'tool', payee: 'simulated tools', evidence: `simulated monthly tools, day ${simDay}`, sim: true, play, id: `sim:${play}:${i}:${k}:tool` });
      for (const [type, count] of Object.entries(row.signals)) signals.push({ ts: at(0.5), type, count, play, sim: true, evidence: `simulated, day ${simDay}`, id: `sim:${play}:${i}:${k}:${type}` });
    });
  }
  return { lines, signals, days: rows, state, live };
}

// a short line for a spec: "Cold email, 40 a day, $300 each"
export function specLine(s) {
  const ch = SIM_CHANNELS[s.channel];
  const money = s.recurring ? `$${s.price}/month` : `$${s.price}${s.channel === 'ads' ? ' a sale' : ' each'}`;
  return `${ch.title}, ${s.volume} ${ch.unit.replace(/ a day$/, '')}${/a day$/.test(ch.unit) ? ' a day' : ''}, ${money}`;
}
