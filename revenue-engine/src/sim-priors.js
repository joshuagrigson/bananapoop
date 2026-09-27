// The simulator's starting assumptions: published benchmarks for each step of each channel, low / typical / high,
// researched 2026-09-27. Each carries the pages it came from. Where no credible source was found the value is marked
// "assumption": an agent's own cited number beats it, and the board shows it as unsourced.
const P = (lo, mid, hi, src = [], note = '', better = 'high') => ({ lo, mid, hi, src, note, better });
const NONE = 'assumption: no credible published benchmark found';

export const PRIORS = {
  email: { feePct: 0.029, rates: {
    reply: P(0.0045, 0.0343, 0.107, ['https://instantly.ai/cold-email-benchmark-report-2026', 'https://belkins.io/blog/cold-email-response-rates'], 'replies per email sent; Instantly 2026 report, average 3.43%'),
    positive: P(0.3, 0.48, 0.65, ['https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/'], 'positive share of replies, by hook type 48-65%; low end widened'),
    close: P(0.05, 0.15, 0.3, [], NONE + ' for interested prospect to paid'),
  } },
  dm: { feePct: 0.029, rates: {
    reply: P(0.042, 0.072, 0.105, ['https://belkins.io/blog/linkedin-outreach-study'], 'LinkedIn outreach reply rate, Belkins + Expandi 2025, 15M+ contacts'),
    positive: P(0.3, 0.48, 0.65, ['https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/'], 'taken from cold email positive-reply share'),
    close: P(0.05, 0.15, 0.3, [], NONE),
  } },
  local: { feePct: 0.029, rates: {
    meeting: P(0.0027, 0.01, 0.05, ['https://belkins.io/blog/cold-calling-benchmarks', 'https://www.cleverly.co/blog/cold-calling-statistics'], 'meetings per dial: Belkins 2025, 0.27% of dials, 4.6% of conversations; typical is between'),
    close: P(0.2, 0.31, 0.47, ['https://salesmotion.io/blog/sales-win-rate-benchmarks-2026'], 'opportunity to won, median 31% for small deals'),
  } },
  freelance: { feePct: 0.1, rates: {
    interview: P(0.05, 0.15, 0.25, ['https://gigradar.io/blog/upwork-proposal-response-rate', 'https://aiproposer.com/learn/upwork-proposal-benchmarks-by-category'], 'proposal to client reply or interview; new freelancers at the low end'),
    hire: P(0.1, 0.15, 0.2, ['https://aiproposer.com/learn/upwork-proposal-benchmarks-by-category'], 'interview to hire, 1 contract per 5-10 interviews'),
  } },
  marketplace: { feePct: 0.095, rates: {
    views: P(1, 4, 15, [], NONE + ' for daily views of a new listing'),
    conv: P(0.01, 0.014, 0.05, ['https://help.erank.com/blog/what-is-a-good-conversion-rate-on-etsy/', 'https://www.littledata.io/average/ecommerce-conversion-rate-(all-devices)'], 'shop visit to purchase: Etsy 1-5%, ecommerce average 1.4%'),
    ramp: P(30, 60, 120, [], NONE + ' for how long a new listing takes to be seen', 'low'),
  } },
  ads: { feePct: 0.029, rates: {
    cpc: P(0.34, 0.6, 0.86, ['https://localiq.com/blog/facebook-advertising-benchmarks/', 'https://localiq.com/blog/search-advertising-benchmarks/'], 'Facebook average cost per click (Google search averages $5.42)', 'low'),
    conv: P(0.014, 0.032, 0.047, ['https://www.littledata.io/average/ecommerce-conversion-rate-(all-devices)'], 'store visit to purchase'),
  } },
  social: { feePct: 0.029, rates: {
    reach: P(50, 200, 1000, ['https://www.socialinsider.io/blog/social-media-reach/'], 'people reached per post for a new account (assumption); Socialinsider 2026: small accounts reach 4-7% of followers'),
    follower_reach: P(0.0435, 0.0665, 0.1, ['https://www.socialinsider.io/blog/social-media-reach/'], 'reach per follower per post, 1-5K follower accounts: Facebook 4.35%, Instagram 6.65%'),
    follow: P(0.002, 0.005, 0.01, [], NONE + ' for follows per person reached'),
    ctr: P(0.002, 0.008, 0.02, [], NONE + ' for organic link clicks per person reached'),
    conv: P(0.014, 0.032, 0.047, ['https://www.littledata.io/average/ecommerce-conversion-rate-(all-devices)'], 'store visit to purchase'),
  } },
  seo: { feePct: 0.029, rates: {
    visits: P(0.5, 3, 15, [], NONE + ' for daily visits per page once ranked'),
    ramp: P(30, 180, 365, ['https://ahrefs.com/blog/how-long-does-it-take-to-rank/'], 'Ahrefs: pages that reach the top take months to a year; typical is an assumption', 'low'),
    conv: P(0.01, 0.02, 0.03, ['https://wecantrack.com/insights/affiliate-conversion-statistics/'], 'affiliate click to sale 1-3%, used for content visitors'),
  } },
  app: { feePct: 0.15, churn: P(0.06, 0.1, 0.16, ['https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026'], 'monthly subscription churn: 27-28% of annual subscribers stay a year (RevenueCat 2026)', 'low'), rates: {
    paid: P(0.0149, 0.022, 0.121, ['https://www.revenuecat.com/state-of-subscription-apps-2025', 'https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026'], 'download to paid: 1.49% low-priced, about 2.2% freemium, 10.7-12.1% hard paywall (RevenueCat 2025, 2026)'),
    ramp: P(14, 30, 90, [], NONE + ' for how long a new app takes to be found', 'low'),
  } },
  venture: { feePct: 0, rates: {
    win: P(0.01, 0.05, 0.2, [], NONE + ' for a long shot: cite the base rate for your kind of bet'),
    spread: P(0.5, 1, 1.5, [], 'assumption: how widely a win\'s payoff varies around its price (lognormal sigma)', 'low'),
  } },
  recurring: { churn: P(0.032, 0.0425, 0.08, ['https://recurly.com/research/churn-rate-benchmarks/'], 'monthly subscription churn, Recurly 2026 3.2-5.0%; high end widened for small new products', 'low') },
};

// platform fees as a share of each sale (fixed per-sale parts are in the notes)
export const FEES = {
  appstore: { pct: 0.15, src: 'https://developer.apple.com/app-store/small-business-program/', note: 'App Store Small Business Program: 15% up to $1M a year, 30% above' },
  googleplay: { pct: 0.15, src: '', note: 'Google Play: 15% on the first $1M (not re-checked in this research)' },
  etsy: { pct: 0.095, src: 'https://craftybase.com/blog/the-complete-guide-to-etsy-fees', note: '6.5% transaction + 3% processing, plus $0.25 and $0.20 listing' },
  gumroad: { pct: 0.1, src: 'https://gumroad.com/pricing', note: '10% + $0.50 direct; 30% on Discover sales' },
  fiverr: { pct: 0.2, src: 'https://freelancecompare.com/blog/fiverr-fees-explained', note: 'flat 20% seller fee' },
  upwork: { pct: 0.1, src: 'https://golance.com/blogs/upwork-fees-explained-2026', note: '0-15% variable since May 2025, typically about 10%, plus Connects' },
  stripe: { pct: 0.029, src: 'https://stripe.com/pricing', note: '2.9% + $0.30 US cards' },
  payhip: { pct: 0.05, src: 'https://help.payhip.com/article/102-billing-and-upgrading', note: 'free plan 5%; paid plans 2% or 0%' },
};
