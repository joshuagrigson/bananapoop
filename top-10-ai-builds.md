# Top 10 Things We Can Build With AI — September 2026

**Question:** Rerun the tournament, but only for things Joshua and Claude can build with AI. Keep the spread: trend plays, businesses that have been around forever, and plays that solve an unsolved problem efficiently.

**Method:** Same tournament as `top-10-money-paths.md`. There were about 60 candidates. Every idea stayed in until a survivor beat it on a stated number. Cuts that rest on my reasoning rather than data are tagged **[judgment]**. Income and odds are **derived estimates**. Market numbers are sourced at the bottom.

## Building is not the bottleneck anymore

This is the strongest case against the premise, and it shaped the whole ranking.

- **14,700 new subscription apps launch every month**, 7x the 2022 rate. Only **17.3%** reach $1K MRR within 2 years, and **4.6%** reach $10K. Apps from before 2020 still take 69% of the revenue.
- In 2025, **20%** of Stripe Atlas startups charged their first customer within 30 days.
- Anything we can build in a week, thousands of others can build too.

So this list is ranked by **who we can sell to, and what we know that they don't**. Buildability is only a filter.

**New scoring for this run:**
- BUILD: can we ship a sellable v1 in 4 weeks or less?
- BUYER: is there a business buyer with a budget line and a measurable return?
- REACH: can Joshua pick up the phone and reach that buyer?
- MOAT: how likely is it that the AI labs or an incumbent eat it within 18 months?
- CEILING: how much ARR is possible in 3 years?
- ODDS: how likely is the mid-case?

## The Top 10

| # | Build | Bucket | Yr-3 mid-case (derived) | Odds | Joshua's head start |
|---|-------|--------|--------------------------|------|---------------------|
| 1 | **AI call QA + coaching for 10–200-seat contact centers** | Trend | $400K–1M ARR | Medium | Coaching platform already built |
| 2 | **Contact-rate engine: number-reputation monitoring, rotation and "Spam Likely" remediation** | Unsolved | $300K–1M ARR | Medium | DID Dashboard already built |
| 3 | **AI front office for a boring business: build it, then buy the business it runs** | Forever + Trend | $200–300K/yr + equity | Med-high (needs ~$80–100K) | Randi booking worker, call-center playbooks |
| 4 | **Show-rate engine for appointment-set sales, paid per appointment that shows** | Forever (the confirmation call) | $300–800K | Med-low | His own data: no-show rate went 21.5% → 30.1% when confirmation calls stopped |
| 5 | **Texas property-tax protest engine for non-homestead property, on contingency** | Unsolved + Forever | $250–500K (seasonal) | Med-low | Texas-based; outbound skill |
| 6 | **Homeowner defense kit against aerial-photo insurance non-renewals, sold through roofers and agents** | Unsolved | $200–600K | Low-med | none |
| 7 | **Denial-appeal engine for small medical billing companies** | Unsolved | $300K–1M | Low-med | none |
| 8 | **AI agent that chases overdue invoices between businesses (voice + email)** | Forever (collections) | $200–600K | Low-med | Outbound calling expertise |
| 9 | **Telecom and utility bill audit for small businesses, on contingency** | Forever (audit) | $150–300K | Low-med | none |
| 10 | **Insurance-certificate and lien-waiver tracker for small subcontractors, under $500/mo** | Forever (paperwork) | $100–300K ARR | Med-low | none |

### Why each one survived

**1. AI call QA + coaching.**
- Enterprise vendors lock the mid-market out. Observe.AI runs about **$60–180K a year per 100 seats, with a 100-seat minimum**. The market prices range from about $59 to $185 per agent per month.
- Example: 30 centers × 50 seats × $60 = **$1.08M ARR**.
- Joshua knows the buyer, speaks their language, and can cold-call them.
- **Fix before selling** (from the 09-25 audit): speaker labels and timestamps. Whisper already returns the segments; the pipeline throws them away.
- AI products run about 50% gross margin, versus 70–80% for regular SaaS, so price for it.

**2. Contact-rate engine.**
- **86%** of calls from unknown numbers go unanswered.
- At Numeracle, businesses seeking protection rose **46%** and remediations **44%** in 2025. Labels come back after removal.
- Among small carriers, only **17.5%** of traffic is signed.
- Each major carrier's labels come from a different opaque analytics engine (First Orion, TNS, TransUnion), and there's no single appeal channel.
- Incumbents charge $250–8,000/mo (unverified); First Orion has a $1,200/mo enterprise minimum.
- The DID Dashboard already turns carrier reputation into a two-axis grade with an early-warning radar.
- Folds in the TCPA-compliance layer as a module (TCPA is the federal robocall law; 2,810 suits in 2025).
- Risk: the FCC's Rich Call Data proposal (verified caller name and logo) could shrink or reshape the problem.

**3. Build the AI front office, then buy the business it runs.**
- This merges last list's #1 with the build.
- Home-services callers reach a live person only **52%** of the time, and **55%** of businesses never ask for the booking. CallRail's AI answering got 44% more calls answered.
- Install answering, confirmation and follow-up in an HVAC shop (median owner earnings $315K, sells at about 2.5x) and you raise the earnings you just bought.
- General Catalyst is running a $1.5B strategy on this exact idea.
- It's the highest-odds path on this list, but it needs capital.

**4. Show-rate engine.**
- Joshua's own numbers: when QA confirmation calls stopped at both centers, **no-shows went from 21.5% to 30.1%**, about $55K lost in 35 days.
- The target is businesses where a show is worth hundreds of dollars: in-home estimates, tours, demos.
- The general no-show and inbound-receptionist space is crowded (Weave, Avoca), so the edge is the segment plus pricing per appointment that shows.
- **Legal:** AI voices count as "artificial" under TCPA (FCC 24-17), so calls go only to people who booked and gave consent. The revoke-all opt-out rule arrives 1/31/27.
- Evidence gap: I didn't research direct competitors in the outbound-sales segment.

**5. Texas property-tax protest engine.**
- About **3M protests a year**. Only **22%** of homeowners have ever appealed. Firms keep **25–50%** of the savings. Ownwell's average saving is $774.
- The efficient part: appraisal-district data is public, so we can score every non-homestead parcel for over-assessment and contact owners with a specific savings number. No search engine or ads needed.
- Prop 13's $140K homestead exemption shrinks the homestead upside, which is why this targets non-homestead property.
- Requires TDLR property-tax-consultant registration.

**6. Aerial non-renewal defense.**
- Insurers use aerial imagery to non-renew homes. Moody's bought CAPE Analytics to do it better.
- **No dedicated homeowner-side product was found.**
- New laws create a process to plug into:
  - Colorado HB25-1182 (in force 7/1/26): insurers must disclose risk scores, credit mitigation work and offer appeals.
  - Georgia: images must be at most a year old, with 60 days to fix problems.
  - New York has a bill pending.
- Texas premiums rose 60% from 2019 to 2024.
- Sell through roofers and agents, because a homeowner buys once.
- Weakest point: nobody has proven people will pay for this.

**7. Denial-appeal engine.**
- **19%** of in-network ACA claims are denied and **under 1%** are appealed.
- **80.7%** of appealed Medicare Advantage prior-auth denials are overturned.
- Hospitals spend $25.7B a year, about $57 per claim, fighting denials.
- Sell to the thousands of small billing companies as a force multiplier.
- Needs HIPAA business-associate agreements (BAAs).

**8. B2B invoice-chasing agent.**
- **59%** of small businesses have invoices more than 30 days overdue, averaging $17.7K.
- The consumer debt-collection rules (FDCPA and Reg F) don't apply when a business collects its own B2B invoices.
- Incumbents are email-only (Chaser £199–899/mo, Upflow ~$440/mo). Voice is barely covered, and outbound calling is Joshua's craft.
- Risk: QuickBooks and Intuit agents.

**9. Telecom and utility bill audit.**
- AI reads invoices well, and the fee is 25–50% of what's recovered.
- Enterprise expense-management vendors ignore small businesses **[judgment]**.
- The error rates (for example "80% of invoices") are vendor claims and unverified. That's why it's #9.

**10. Insurance-certificate and lien-waiver tracker.**
- Incumbents: TrustLayer (free for up to 50 vendors, then ~$500+/mo), myCOI (200-certificate minimum, ~$500–2,000/mo), Levelset ($500–1,250/mo).
- There's a real pricing gap under $500 for small subcontractors, but free tiers are moving in. The ceiling is low.

## Everything else, and what beats it

**Gate A. Distribution is broken: consumer, app store, SEO, creator**
- Consumer subscription apps, including **Paper Plate** and **Master Gardener**. 17.3% reach $1K MRR and 4.6% reach $10K. AI apps churn about 30% faster (annual retention 21.1% vs 30.7%). Loses to **#1**: a buyer with a budget line beats an app-store lottery.
- AI companion and chat apps: same retention data. Loses to **#1**.
- Faceless AI video, including **BabyLoop**. YouTube's inauthentic-content policy applies, and YouTube businesses sell for 1.8x profit. Loses to **#1**.
- Kids' education and Code School as a consumer product: loses to **#1** **[judgment]**.
- Mobile games: power law. Loses to **#1**.
- SEO content, programmatic SEO, affiliate sites, rank-and-rent, directories:
  - **68%** of US Google searches ended without a click (Jan–Apr 2026).
  - An AI Overview cuts the #1 result's click-through by **58%**.
  - Chegg's non-subscriber traffic fell 37%.
  - Loses to **#5**, which finds buyers in public records instead.
- ChatGPT app or Claude connector as the business: ChatGPT apps don't support in-app sales of digital goods or subscriptions, and the Claude directory has no billing. Loses to **#2**.
- A generic Shopify app with no specific pain behind it: median under $1K MRR (unverified). Loses to **#1**.
- Chrome extensions, templates, prompt packs, courses, newsletters: commoditized. Loses to **#1** **[judgment]**.

**Gate B. The labs already shipped it**
- Meeting notes: ChatGPT Record (2025).
- Deep-research and report tools: Gemini, OpenAI and Perplexity all shipped them.
- **Resume builder and job finder (Launchpad).** OpenAI announced a Jobs Platform for mid-2026, and job seekers pay little: 42% of recent grads are underemployed. Loses to **#1**.
- Consumer legal documents: after Anthropic's Claude Cowork legal plugin was announced, LegalZoom fell 19.7% in a day.
- Workflow-automation builders: Relay shut down in Aug 2026, saying bigger platforms had built the same thing.
- AI headshot and photo apps: GPT-4o image generation and Nano Banana.
- AI website builders, or local-business sites (Randi-style) as a business: Lovable is at $600M ARR, and Wix bought Base44. Loses to **#3**.
- AI coding tools, general agents, tutoring.
- **SITE_TESTER** as a product: dev tools plus computer-use agents. Loses to **#1** **[judgment]**.

**Gate C. Niche already owned or shrinking (verified this run)**
- AI search-visibility SaaS (GEO/AEO): Profound at a $1.8B valuation; HubSpot AEO $50/mo; BrightLocal includes it free; Otterly $29/mo.
- Government-contracting proposal AI: GovDash raised $30M, and Sweetspot is also funded. Only 8,200 new small-business entrants, the fewest since 1989. SBA suspended 25% of 8(a) firms.
- Grant-writing AI: Instrumentl raised $55M, and a third of nonprofits had government funding disrupted.
- Home-care scheduling: WellSky is valued above $3B, and PSG is rolling up the rest. Caregiver-recruiting AI: TalentSprout at $199/mo plus five others.
- RV-park reservations: Campspot runs 3,500+ parks, and Storable and Aspira own others. **RV shipments are down 13.9% in 2026.** Joshua's RV domain knowledge doesn't rescue this one.
- Niche-trade field software: Skimmer $74M (pool), ServiceCore $62M (septic), FieldRoutes (pest, owned by ServiceTitan), Towbook from $49/mo.
- Consumer debt-collection AI: 4,534 FDCPA suits in 2025, and CFPB complaints nearly doubled. Loses to **#8**, which sits outside those rules.
- Inbound AI receptionist: Avoca is valued at $1B, and ServiceTitan has it built in. Loses to **#3** (use it inside a business you own) and **#4** (a different segment).
- Salon booking (the Randi worker): Square, Vagaro and Booksy own it. Loses to **#3**.
- AI bookkeeping: Pilot $99/mo, and Digits prices on outcomes. Loses to **#9**.
- AI medical scribe: Abridge and Microsoft **[judgment]**.

**Gate D. Legal or structural blockers**
- AI voice cold-calling or an AI-SDR agency: AI voices are "artificial" under TCPA (FCC 24-17), so calls to cell phones need consent. Loses to **#4**, which only calls people who booked.
- Permit expediting: the bottleneck is city staff. Loses to **#5**.
- Senior-care placement: A Place for Mom's referral model plus SEO dependence.
- MCP-connector development shop: service businesses sell for 1.2x profit, and vendors build their own connectors. Loses to **#2** **[judgment]**.
- Build-to-flip micro-SaaS: SaaS sells for a median 3.9x profit and wrappers get discounted. That's an exit strategy, not a product; it applies to #1 and #2.

**Gate E. Near misses**
- TCPA-consent layer: folded into **#2** as a module.
- Insurance-agency retention AI: not researched; AgencyZoom is owned by Vertafore. Open.
- Skilled-trades hiring and matching: not researched. Open.
- Freight audit: needs deep logistics knowledge. Loses to **#9**.

## Confidence

- **Target:** which things Joshua and Claude can build and sell for the most odds-weighted money.
- **Well supported:** app-store base rates; zero-click search; the lab launches listed above; mid-market contact centers locked out of QA by minimums; spam-label demand up 44–46%.
- **Somewhat supported:** B2B voice invoice-chasing is thin (an inference from incumbents' pricing pages).
- **Weakest:** whether anyone will pay for aerial non-renewal defense, and how crowded the #4 segment really is.
- **Still open:**
  - The FCC's Rich Call Data rule could shrink #2, or create demand for verification.
  - AI gross margins around 50% put pressure on flat-fee pricing.
- **Load-bearing weakest claim:** that 10–200-seat centers will buy QA from a two-person vendor before their dialer (Convoso, Five9) ships native AI QA. If Convoso ships it, #1 falls and #2 rises, because #2 rides carrier data, not dialer features.
- **What the answer comes down to:** sell #1 or #2 before building an eleventh thing. The Brain has no record of a paying customer for any of the roughly 10 builds so far.

## IP check (before #1 or #2)

If the coaching platform or the DID Dashboard was built on an employer's time, systems or data, read the employment agreement's IP-assignment and non-compete clauses before selling it outside. Texas enforces reasonable non-competes. The rubric, benchmark calls and DID pool data are probably the company's even if the code isn't.

## Sources

- RevenueCat State of Subscription Apps 2026: https://www.revenuecat.com/state-of-subscription-apps
- AI app retention (TechCrunch 3/10/26): https://techcrunch.com/2026/03/10/ai-powered-apps-struggle-with-long-term-retention-new-report-shows
- Stripe 2025 annual letter: https://stripe.com/annual-updates/2025
- Stripe AI economy: https://stripe.com/guides/indexing-the-ai-economy
- Lovable $600M: https://techcrunch.com/2026/09/24/lovables-annualized-revenue-crosses-600m-as-vibe-coding-takes-off/
- Base44 → Wix: https://techcrunch.com/2025/06/18/6-month-old-solo-owned-vibe-coder-base44-sells-to-wix-for-80m-cash/
- Acquire.com multiples: https://blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026/
- Flippa 2025: https://flippa.com/blog/2025-online-business-ma-insights-from-flippa/
- FE International AI M&A: https://www.feinternational.com/blog/ai-ma-trend
- Pew AI summaries: https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/
- Ahrefs AIO CTR: https://ahrefs.com/blog/ai-overviews-reduce-clicks-update
- SparkToro zero-click 2026: https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/
- Chegg: https://www.highereddive.com/news/chegg-layoffs-strategic-alternatives-google-ai/804192/
- OpenAI Apps SDK monetization: https://developers.openai.com/apps-sdk/build/monetization
- Claude MCP 2026: https://claude.com/blog/bringing-mcp-2026-07-28-to-claude
- Shopify developer payouts: https://www.shopify.com/news/billion-dollar-ecosystem
- ChatGPT Record: https://help.openai.com/en/articles/11487532-chatgpt-record
- AI graveyard (Relay): https://techcrunch.com/2026/09/15/the-ai-graveyard-a-running-list-of-projects-and-startups-that-didnt-make-it/
- Cowork legal plugin selloff: https://www.cnn.com/2026/02/04/investing/us-stocks-anthropic-software
- OpenAI Jobs Platform: https://campustechnology.com/articles/2025/09/10/openai-to-launch-ai-powered-jobs-platform-by-mid-2026.aspx
- Digits outcome pricing: https://www.cpapracticeadvisor.com/2026/04/07/digits-announces-outcome-based-pricing-for-accounting-firms/181110/
- Pilot pricing: https://pilot.com/pricing
- B2B monetization 2026: https://www.growthunhinged.com/p/the-state-of-b2b-monetization-in-2026
- Observe.AI pricing: https://www.cloudtalk.io/blog/observe-ai-pricing/
- Hiya State of the Call: https://www.hiya.com/state-of-the-call
- Numeracle 2025: https://www.numeracle.com/press-releases/2025-remediation-case-study
- TNS 2026: https://tnsi.com/resource/com/tns-2026-robocall-report-reveals-signed-call-traffic-gap-press-release/
- First Orion pricing: https://firstorion.com/inform-pricing
- FCC caller-ID proposal: https://www.mintz.com/insights-center/viewpoints/2776/2025-11-20-fcc-proposes-new-rules-call-branding-and-caller-id
- WebRecon 2025: https://webrecon.com/litigation-statistics/webrecon-dec-2025-stats-year-in-review
- TCPAWorld July 2026: https://tcpaworld.com/2026/09/08/woah-tcpa-class-actions-down-massively-in-july-have-we-finally-peaked-and-what-is-causing-this/
- Revoke-all delay: https://www.burr.com/telephone-consumer-protection-act/the-fcc-delays-effective-date-of-tcpa-revoke-all-rule-until-january-31-2027
- FCC AI voice ruling: https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf
- Invoca home services 2026: https://www.invoca.com/reports/the-invoca-home-services-lead-conversion-benchmarks-report-2026
- CallRail AI answering: https://www.prnewswire.com/news-releases/callrail-opens-voice-assist-to-every-business-now-with-contextual-ai-texting-302835822.html
- BizBuySell HVAC: https://www.bizbuysell.com/learning-center/valuation-benchmarks/hvac/
- TX protests: https://texaspropertytaxtrends.com/tax-protests-filed/
- Ownwell: https://www.prnewswire.com/news-releases/ownwell-raises-50m-launches-national-service-to-streamline-property-tax-appeals-and-make-home-ownership-more-affordable-302692103.html
- Prop 13 (TX 2025): https://ballotpedia.org/Texas_Proposition_13,_Increase_Homestead_Property_Tax_Exemption_Amendment_(2025)
- Aerial imagery laws: https://www.nerdwallet.com/insurance/homeowners/learn/aerial-imagery-homeowners-insurance
- NY aerial bill: https://blog.pia.org/2026/05/06/n-y-bill-would-set-standards-for-use-of-aerial-imagery-in-homeowners-insurance/
- Moody's / CAPE: https://www.insurancejournal.com/news/national/2025/01/13/807956.htm
- Dallas Fed home insurance: https://www.dallasfed.org/research/swe/2026/swe2609
- KFF ACA denials: https://www.kff.org/patient-consumer-protections/claims-denials-and-appeals-in-aca-marketplace-plans-in-2024/
- KFF MA prior auth: https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/
- Premier denials: https://premierinc.com/newsroom/policy/claims-adjudication-costs-providers-257-billion-18-billion-is-potentially-unnecessary-expense
- QuickBooks late payments: https://quickbooks.intuit.com/r/small-business-data/small-business-late-payments-report-2026/
- Chaser vs Upflow: https://trove.works/chaser-upflow-pricing-comparison/
- TrustLayer: https://www.trustlayer.io/resources/trustlayer-vs-jones-coi-software
- Profound Series D: https://techcrunch.com/2026/09/15/aeo-startup-profound-hits-unicorn-valuation-raises-180m-series-d-7-months-after-last-round/
- HubSpot AEO: https://www.cmswire.com/digital-experience/hubspot-launches-aeo-expands-ai-agents-at-spring-2026-spotlight/
- BrightLocal AI visibility: https://help.brightlocal.com/hc/en-us/articles/37989673412114-What-is-Local-AI-Visibility
- SBA FY25 scorecard: https://www.sba.gov/article/2026/06/25/sba-releases-fy25-scorecard-small-business-contracting
- GovCon entrants: https://www.govconintelligence.com/p/small-business-contracting-dropped
- GovDash: https://www.govdash.com/blog/press-govdash-raises-30m-series-b-to-help-companies-win-and-manage-government-contracts-with-ai
- Instrumentl: https://www.businesswire.com/news/home/20250423312598/en/Instrumentl-Raises-$55M-from-Summit-Partners-to-Accelerate-Their-AI-Grant-Fundraising-Platform
- WellSky: https://www.pehub.com/leonard-green-joins-tpg-as-investor-in-wellsky-topping-3bn-valuation/
- TalentSprout: https://www.talentsprout.ai/solutions/home-care
- Campspot: https://software.campspot.com/about-campspot/year-in-review/
- RV shipments 2026: https://rvbusiness.com/rvia-july-wholesale-numbers-down-11-9-percent-over-2025/
- Skimmer: https://www.getskimmer.com/blog/skimmer-raises-74m-in-growth-capital-from-mainsail-partners
- Towbook: https://towbook.com/pricing
- YouTube AI-slop policy: https://techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos/
