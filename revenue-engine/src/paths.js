// The path catalog: every way this operator is trying to make money, with stage gates and a kill test.
// Seeded from the 2026-09-25 income tournament (26 ideas -> top 10) and the Sept-2026 market tournament.
// VOLATILE: prices, competitor moves and income ranges drift. The stage/kill-test structure is the durable part.
import { STAGES } from './ledger.js';

const DEFAULT_TARGETS = { prospect: 10, conversation: 3, demo: 1, pilot: 1, paid: 1, retained: 2 };
const DEFAULT_LABELS = {
  prospect: 'named prospects with a live URL',
  conversation: 'real two-way conversations',
  demo: 'demo or discovery call held',
  pilot: 'paid pilot started',
  paid: 'first invoice paid',
  retained: 'clients past month 2',
};

// Gates are preconditions with legal or ethical weight. A gated path refuses agent spend until cleared with evidence.
export const GATES = Object.freeze({
  'employment-agreement': {
    title: 'Employment agreement read: side work in contact-center ops is permitted',
    why: 'Paths 1-3 stand on call-center expertise built at the day job. Invention-assignment, moonlighting, '
      + 'non-compete and non-solicit clauses decide whether they exist at all. Anything that touched employer '
      + 'data gets rebuilt clean, on your own time and hardware.',
  },
});

export const CATALOG = Object.freeze([
  {
    id: 'ops-consulting',
    short: 'Ops consulting',
    rank: 1,
    name: 'Fractional contact-center ops consulting',
    bucket: 'expertise service',
    thesis: 'Dialer, contact rate, number health, show rate, QA programs. Two or three retainers at $2.5-4K/mo. '
      + 'DID audits and automation builds are deliverables inside this, not separate businesses.',
    month12Usd: [5000, 12000],
    firstDollarWeeks: [2, 8],
    gate: 'employment-agreement',
    budgetUsd: 25,
    constraints: [
      "Never pitch the employer's competitors (membership camping, timeshare tour operators).",
      'No employer data in any deliverable; examples are anonymized or rebuilt.',
    ],
    killTest: '25 personalized outreaches to centers with 10-200 seats in 30 days. Fewer than 3 discovery calls booked = kill or reprice.',
    stages: {
      prospect: { target: 25, label: 'centers (10-200 seats) with a named ops lead' },
      conversation: { target: 3, label: 'discovery calls booked' },
      demo: { target: 2, label: 'free number-health or show-rate audits delivered' },
      pilot: { target: 1, label: 'paid 30-day engagement' },
      paid: { target: 1, label: 'first retainer invoice paid' },
      retained: { target: 2, label: 'retainers past month 2' },
    },
  },
  {
    id: 'show-rate-engine',
    short: 'Show-rate engine',
    rank: 2,
    name: 'Show-rate engine, priced per show recovered',
    bucket: 'B2B outcome-priced',
    thesis: 'Confirm + remind + rebook automation for high-ticket appointment businesses. Voice AI is cents per '
      + 'minute, so the value is the playbook. Proof in hand: a dropped QA confirmation step moved RV no-shows '
      + 'from 21.5% to 30.1%, about $55K in 35 days.',
    month12Usd: [2000, 10000],
    firstDollarWeeks: [4, 12],
    gate: 'employment-agreement',
    budgetUsd: 25,
    constraints: [
      'MUST NOT sell to membership-camping or timeshare tour operators.',
      'Dental and medical are owned by Weave, NexHealth and Solutionreach; skip them.',
      'Test verticals: senior-living tours, apartment leasing, home-improvement estimates, med-spa consults.',
    ],
    killTest: 'One paid pilot, any price, inside 60 days of first outreach. Otherwise kill.',
    stages: {
      prospect: { target: 20, label: 'high-ticket appointment businesses with a visible no-show problem' },
      conversation: { target: 5, label: 'owners who shared their show rate' },
      demo: { target: 2, label: 'show-rate audits delivered' },
      pilot: { target: 1, label: 'paid pilot, priced per show recovered' },
      paid: { target: 1, label: 'first outcome invoice paid' },
      retained: { target: 2, label: 'accounts past month 2' },
    },
  },
  {
    id: 'managed-call-qa',
    short: 'Call QA',
    rank: 3,
    name: 'Managed AI call QA with weekly coaching packets',
    bucket: 'productized service',
    thesis: "Score 100% of a center's calls and ship a weekly coaching packet. Sold as the outcome, not as "
      + 'software, which sidesteps 81 LLM contact-center startups and the QA tools already in dialer marketplaces.',
    month12Usd: [2000, 8000],
    firstDollarWeeks: [4, 10],
    gate: 'employment-agreement',
    budgetUsd: 25,
    constraints: [
      'Platform rebuilt clean on own hardware; no employer dialer data.',
      "Never pitch the employer's competitors.",
    ],
    killTest: '10 centers offered a free 50-call scored sample. Fewer than 2 accept in 30 days = kill.',
    stages: {
      prospect: { target: 15, label: 'centers (10-200 seats) with a QA or coaching lead' },
      conversation: { target: 3, label: 'sample-scoring conversations' },
      demo: { target: 2, label: 'free 50-call scored samples delivered' },
      pilot: { target: 1, label: 'paid monthly QA pilot' },
      paid: { target: 1, label: 'first monthly invoice paid' },
      retained: { target: 2, label: 'centers past month 2' },
    },
  },
  {
    id: 'local-growth-bundle',
    short: 'Salon bundle',
    rank: 4,
    name: 'Local growth bundle for Square-based salons, med-spas and groomers',
    bucket: 'recurring agency',
    thesis: 'Site + booking + missed-call text-back + reviews + optional AI receptionist at $150-250/mo. Square '
      + 'has no native voice receptionist. The salon site already built is the portfolio piece; a free site audit '
      + 'is the lead magnet.',
    month12Usd: [1500, 5000],
    firstDollarWeeks: [0, 2],
    budgetUsd: 20,
    constraints: [
      'Skip home services: Jobber, ServiceTitan and Housecall Pro ship receptionists already.',
      'A2P 10DLC registration must be done before any SMS goes out.',
    ],
    killTest: '20 free site audits delivered in 30 days. Fewer than 2 paying shops = kill.',
    stages: {
      prospect: { target: 30, label: 'local Square-based shops with a weak site or no online booking' },
      conversation: { target: 8, label: 'owners who replied to a free audit' },
      demo: { target: 5, label: 'free audits delivered' },
      pilot: { target: 2, label: 'first months paid' },
      paid: { target: 2, label: 'invoices paid' },
      retained: { target: 5, label: 'shops past month 2' },
    },
  },
  {
    id: 'coparent-hq',
    short: 'CoParentHQ',
    rank: 5,
    name: 'CoParentHQ at per-family pricing',
    bucket: 'consumer subscription',
    thesis: 'Court-driven, non-discretionary demand with multi-year LTV. AppClose and TalkingParents both killed '
      + "their free plans in 2026. Distribution runs through family lawyers and mediators; the incumbent's real "
      + 'moat is its model court-order language, not its software.',
    month12Usd: [1000, 5000],
    firstDollarWeeks: [12, 26],
    budgetUsd: 15,
    constraints: [
      'Paying attorneys for referrals runs into bar conflict-of-interest rules; get a legal read first.',
      'Six cheaper entrants already exist (Kidtime, Parenting Path, BestInterest, Larkling, Just Parent, 2houses).',
    ],
    killTest: '5 family-law practices agree to hand the app to clients inside 90 days. Otherwise kill.',
    stages: {
      prospect: { target: 20, label: 'family-law practices and mediators in TX and AR' },
      conversation: { target: 5, label: 'practices that took a call' },
      demo: { target: 3, label: 'practices walked through the app' },
      pilot: { target: 1, label: 'first paying family' },
      paid: { target: 10, label: 'paying families' },
      retained: { target: 5, label: 'families past month 3' },
    },
  },
  {
    id: 'cohort-course',
    short: 'Cohort course',
    rank: 6,
    name: 'Cohort course: ship real apps with Claude as an operator',
    bucket: 'info product',
    thesis: 'Anthropic Academy has 26 free courses, so only the operator angle survives. Comparable cohorts run '
      + '$799-1,000. A presale proves it before anything is recorded.',
    month12Usd: [1000, 5000],
    firstDollarWeeks: [2, 6],
    budgetUsd: 15,
    constraints: [
      'Presell before recording anything.',
      'No employer material in the curriculum.',
    ],
    killTest: '5 presale purchases from a 50-person waitlist inside 30 days. Otherwise kill.',
    stages: {
      prospect: { target: 50, label: 'waitlist signups' },
      conversation: { target: 10, label: 'waitlist members interviewed' },
      demo: { target: 20, label: 'free workshop attendees' },
      pilot: { target: 5, label: 'presale purchases' },
      paid: { target: 10, label: 'cohort 1 seats paid' },
      retained: { target: 1, label: 'cohort 2 filled' },
    },
  },
  {
    id: 'content-channel',
    short: 'Content studio',
    rank: 7,
    name: 'Content channel that sells the paid paths',
    bucket: 'content / audience',
    thesis: 'Agents draft posts; you review and publish under your own name. Posts earn two ways: directly '
      + '(affiliate links, sponsorships, platform payouts) and as a funnel that feeds leads into the salon bundle '
      + 'and the cohort course. Every post carries one call to action, and every dollar can be attributed to the post that earned it.',
    month12Usd: [0, 2000],
    firstDollarWeeks: [8, 26],
    budgetUsd: 15,
    postTarget: 30,
    constraints: [
      'Posted by a human under your real name. No faceless, mass-produced video: YouTube terminated AI channels in Jan 2026 under its inauthentic-content policy.',
      'Every post has exactly one call to action: the email list, the free site audit, or the course waitlist.',
      'No employer data, call recordings, or anything that identifies a customer.',
      'Any trend or statistic in a post carries its source URL in the draft.',
    ],
    killTest: '30 posts published in 30 days. Fewer than 50 email signups and zero inbound leads = kill or change format.',
    stages: {
      prospect: { target: 10, label: 'inbound replies or DMs from a post' },
      conversation: { target: 50, label: 'email list signups' },
      demo: { target: 5, label: 'leads handed to a paid path' },
      pilot: { target: 1, label: 'first sponsor or affiliate deal' },
      paid: { target: 1, label: 'first content payout' },
      retained: { target: 3, label: 'months with a content payout' },
    },
  },
  {
    id: 'freelance-desk',
    short: 'Freelance desk',
    rank: 8,
    name: 'Freelance desk: agent-staffed gigs on Upwork and Fiverr',
    bucket: 'freelance services',
    thesis: 'Clients pay for finished work. Agents write the gig listings, score job posts you paste in, draft '
      + 'proposals, and draft the deliverable; you send, review, deliver and own the client. Your review time is the '
      + 'ceiling, so the dashboard tracks earnings per gig type and per hour of your time.',
    month12Usd: [1000, 4000],
    firstDollarWeeks: [1, 4],
    budgetUsd: 15,
    // Starting prices are guesses to test, not market research. The lister checks comparables before you publish.
    gigMenu: [
      'Lead research: 50 qualified leads in one niche, each with website, contact channel and a fit note ($60-150)',
      'Lead list cleanup: dedupe, fix formatting, flag bad phones and emails ($40-120)',
      'Google Business Profile posts: a month of posts, ready to paste ($50-100)',
      'Missed-call text-back or Zapier/GoHighLevel automation build ($100-300)',
      'Cold email or SMS sequence: 5 steps written for their offer ($60-150)',
    ],
    constraints: [
      'Agents never submit proposals, message clients, or log into Upwork or Fiverr. Upwork bans automated bidding; you send everything yourself.',
      'Disclose AI assistance whenever the client or the platform asks for it.',
      'Every deliverable is reviewed by the operator before it ships. Drafts include a checklist of what to verify.',
      'No employer data. Call-scoring and coaching gigs wait until the employment-agreement gate is cleared.',
      'Skip posts that ask for unpaid test work, payment off-platform, or contact outside the platform before a contract.',
    ],
    killTest: '3 Fiverr gigs live or 20 Upwork proposals sent within 30 days. Fewer than 2 paid orders = change the gig type or kill.',
    stages: {
      prospect: { target: 20, label: 'job posts scored as a fit' },
      conversation: { target: 20, label: 'proposals you sent or gigs you listed' },
      demo: { target: 3, label: 'client replies or interviews' },
      pilot: { target: 2, label: 'jobs won' },
      paid: { target: 2, label: 'jobs paid' },
      retained: { target: 2, label: 'repeat clients' },
    },
  },
]);

export function getPath(id, catalog = CATALOG) {
  return catalog.find((p) => p.id === id) || null;
}

// Ordered stage list for a path, with per-path overrides applied over the defaults.
export function stagesFor(spec) {
  return STAGES.map((id) => {
    const o = (spec && spec.stages && spec.stages[id]) || {};
    return { id, target: o.target || DEFAULT_TARGETS[id], label: o.label || DEFAULT_LABELS[id] };
  });
}
