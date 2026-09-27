// The simulator's starting assumptions: published benchmarks for each step of each channel, low / typical / high.
// PROVISIONAL: filled in from research below. Every number here should carry the pages it came from.
const P = (lo, mid, hi, src = [], note = '', better = 'high') => ({ lo, mid, hi, src, note, better });

export const PRIORS = {
  email: { feePct: 0.03, rates: { reply: P(0.01, 0.03, 0.08), positive: P(0.15, 0.3, 0.5), close: P(0.05, 0.15, 0.3) } },
  dm: { feePct: 0.03, rates: { reply: P(0.05, 0.1, 0.2), positive: P(0.15, 0.3, 0.5), close: P(0.05, 0.15, 0.3) } },
  local: { feePct: 0.03, rates: { meeting: P(0.01, 0.03, 0.06), close: P(0.1, 0.2, 0.35) } },
  freelance: { feePct: 0.1, rates: { interview: P(0.03, 0.08, 0.15), hire: P(0.1, 0.2, 0.35) } },
  marketplace: { feePct: 0.1, rates: { views: P(1, 4, 15), conv: P(0.005, 0.015, 0.03), ramp: P(30, 60, 120, [], '', 'low') } },
  ads: { feePct: 0.03, rates: { cpc: P(0.5, 1, 2, [], '', 'low'), conv: P(0.01, 0.025, 0.05) } },
  social: { feePct: 0.03, rates: { reach: P(50, 200, 1000), follower_reach: P(0.05, 0.1, 0.3), follow: P(0.002, 0.005, 0.01), ctr: P(0.002, 0.008, 0.02), conv: P(0.01, 0.02, 0.04) } },
  seo: { feePct: 0.03, rates: { visits: P(0.5, 3, 15), ramp: P(90, 180, 365, [], '', 'low'), conv: P(0.005, 0.01, 0.02) } },
  recurring: { churn: P(0.03, 0.08, 0.15, [], '', 'low') },
};

// platform fees, as a share of each sale
export const FEES = {};
