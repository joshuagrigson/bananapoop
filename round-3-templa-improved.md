# Round 3, improved: Templa v2

Sep 25, 2026 · builds on "Round 3: a company to build" (@Steve)

## Bottom line

Keep Templa. Change four things:

1. **Sell the quote first, the cut file second.** Hover got to a $490M valuation on *estimates* for roofers, not on cut-grade measurements. Quoting only needs to be within about 1 inch, which phones can already do. So Templa can have paying customers by around day 45, before the 1/16-inch question is settled.
2. **Stop asking the phone to hit 1/16 inch alone.** Pair it with a $100-250 Bluetooth laser measure (Leica DISTO, Bosch GLM; about ±1/16 inch). The phone captures the shape and the laser pins the key lengths. That turns the kill test from "beat published iPhone accuracy 5-20x" into "get the shape right, then lock it to real numbers."
3. **Go after shops that never bought a laser, not shops that did.** The 9,000+ LT owners have already paid for their machine. The real market is the cardboard-and-tape shops, and trades where no templating rig exists at all (shower glass, marine canvas).
4. **Fix the competitor list.** Camera-based templating already exists. Laser Products' ScanTemplater uses photogrammetry at about $10-18K and ±1/8 inch, and Flexijet has a phone app. So the claim that "nobody sells photo templating" is false. What is actually new: **no hardware at all, and anyone on the crew can do it.**

## Update: Steve's app (Vista) is already very accurate

Josh reports that Vista, Steve's measuring app, is "extremely accurate" on phone LiDAR. It also does photo mapping that exports to 3D printers and renders full rooms in AR. If that holds up, three things change:

1. **The kill test becomes a confirmation, not a research project.** Weeks 1-2 go straight to the shop-grade test protocol below instead of a 60-day build. Cut moves up to be the lead product. Quote stays in as the sales hook, not as the backup plan.
2. **The laser measure becomes insurance, not a requirement.** Keep it as an optional "certified" mode for stone and glass, where one bad cut costs $800-2,500.
3. **One scan runs the whole sale.** The same capture produces the quote, an **AR preview** of the chosen slab, glass or shutter in the customer's own room, and then the cut file. Most fabricators quote from a sketch and a showroom sample. A shop that shows a homeowner their own kitchen with the new top in it, on the first visit, closes more jobs. That upgrades Templa from a measuring tool (a cost line) to a sales tool (a revenue line), and shops pay more for revenue.

**What "extremely accurate" has to mean for fabrication (the test protocol):**

- Error on **edges and corners**, not just point-to-point distances. Stone is cut along edges.
- Measured against a trusted reference: a tape plus a laser measure, or the shop's own LT or Proliner file.
- Run by **someone other than Steve**, on rooms Steve has never scanned. The product only works if any installer gets the same result.
- **Pass:** 95% of edges within 1/16 inch (1.6 mm) for stone and glass, 1/8 inch for shutters, 1/4 inch for canvas, repeated across at least 10 rooms.
- Why this bar: published iPhone LiDAR tests land at 7 mm to 3 cm, and the depth sensor itself is low resolution (about 256×192). If Vista beats that, the edge detail almost certainly comes from the photo mapping fused with depth, which is exactly the kind of engine a competitor can't copy in a weekend. Proving it in writing becomes the core of the pitch.

**Focus rule:** the 3D-print and AR outputs are real assets, but Pocket Studio and Scanfit stay on the shelf until Templa has paying shops. Steve's engine powers them later, not in parallel.

## 1. What the original gets wrong

| Claim in Round 3 | Problem | What it means |
|---|---|---|
| "The phone replaces a $28,000 machine" | Camera systems already sell for $10-18K, at about ±1/8 inch after years of work with dedicated calibrated cameras | You compete with $10K, not $28K. And the incumbents' own photogrammetry lands at 1/8 inch, so 1/16 inch on a phone is harder than the plan says |
| "Hover proved the model" | Hover proved **estimating** (roofers quote from phone photos). It never proved cut-grade fabrication | Copy what Hover actually did: start with the quote |
| Kill test = pass or fail at day 60 | One number decides everything, and a fail throws away 60 days of Steve's engine work | Set up several ways to win, so a partial result still leaves a business |
| Countertops are the lead market | Countertops are the trade where incumbents are strongest (LT, Prodim, Leica, Flexijet all ship to them) | Pick the first trade by who has *no* tool, not by market size |
| $299/month vs "a $28K machine" | Shops that own a laser won't drop it. Shops that don't own one compare you to $15-47/hour of labor, not to a machine | Price against a template visit, not against hardware |

## 2. The improved product: three tiers, one engine

| Tier | What it does | Accuracy needed | Buyer | Price | Ready to sell |
|---|---|---|---|---|---|
| **Templa Quote** | The homeowner or salesperson opens a link (App Clip on iPhone, no install) and sweeps the kitchen or shower. The shop gets square footage, edge lengths, cutouts and photos, and quotes the same day | ±1 inch | Countertop, glass, shutter and cabinet shops | $149-199/month per shop | Now, with today's phones |
| **Templa Check** | The installer checks the measurements before cutting or tempering, and gets a flag on any edge that is off from the template | ±1/8 inch plus laser anchors | Shops that already own a laser (extra seats) | $49/seat/month | After the bench test |
| **Templa Cut** | A full DXF ready for the saw or CNC, with laser-anchored edges and an accuracy score per edge. Exports below spec are blocked | 1/16-1/4 inch by trade | Shops with no laser, plus glass and canvas | $299/month or $29 per job | After the field kill test |

**Why the tiers matter:** Quote brings in revenue and a list of paying shops while Cut is still being proven. It also fits Josh's strength exactly. Quote is a **speed-to-lead** product: the shop that quotes first wins the job (Round 2 found that 42% of high-ticket sellers never call back). Josh knows how to sell that line to owners.

**The data loop:** every Cut job run next to a shop's laser or tape gives you real error numbers for each edge. After a few hundred jobs, that dataset is the moat that a random team copying the app would not have.

## 3. The laser-anchor fix (in detail)

- Phone photos plus printed coded targets give the **shape**: which walls exist, their angles, where the cutouts are, and how edges connect.
- A Bluetooth laser measure (DISTO and Bosch both publish SDKs or data protocols) gives **3-6 key lengths**: wall to wall, depth, and the sink centerline.
- Steve's engine solves the shape *under those constraints*. That is a constrained fit, which is much easier than getting sub-millimeter edges from photos alone.
- Cost for the shop: about $150-250 one time, or bundle it into the annual plan. That is still a rounding error next to $10-33K.
- For the kill test: run it **both ways** (phone only, and phone plus laser). If phone-only fails but the laser version passes, you still have a company.

## 4. Order of trades (pick by "who has no tool")

1. **Shower glass**: tolerance is 1/16 inch, but the openings are simple (a few planes, lots of right angles), and most shops measure with a tape and a sheet. Smart Glazier already has glass shops using a phone app for measure *sheets*. Templa fills those sheets automatically, which makes a natural integration or channel partner.
2. **Marine canvas and upholstery**: tolerance is 1/4 inch, the pain is multiple trips per boat, and almost nothing exists short of about $50K patterning gear. It also connects to the boat world and DealDock contacts.
3. **Shutters and blinds**: tolerance is 1/8 inch, and one franchise system (Budget Blinds, 1,366 units) is a single deal that reaches a whole channel.
4. **Countertops last for Cut, first for Quote**: Quote sells to every countertop shop right away. Cut only goes to the shops that never bought a laser.

## 5. The revised first 90 days

| When | Steve | Josh | Proof |
|---|---|---|---|
| Weeks 1-2 | Bench test: point Vista plus targets at 3 plywood mockups (kitchen L, shower opening, boat bow) with known dimensions. Phone-only and laser-anchored | LLC, IP assignment (including Vista and swift-tsdf moving into the company), lawyer read of both employment agreements. Line up 10 shops | Error per edge on the mockups. If phone plus laser can't hit 1/8 inch on plywood, stop before driving anywhere |
| Weeks 3-6 | Quote tier: App Clip capture, square footage and edges, shop dashboard | Sell Quote to 5 local shops at a founding price of $99/month. Call script built on speed to quote | **First revenue**, not a pilot promise |
| Weeks 5-8 | Field kill test: 20+ real jobs side by side with the shop's own method, in glass and canvas first | DealDock: 30 interviews only (no building) | Pass or fail by trade and by method (phone only vs laser anchored) |
| Weeks 8-13 | Cut tier in the trade that passed. Accuracy score per edge, and block exports below spec | 15-25 Quote shops, 3-5 Cut pilots. Build the 4-state list for the winning trade | A case study: hours to quote, trips saved, remakes avoided |
| Week 13 | | YC application with revenue in hand | |

**Day-60 decision, revised:**

- Cut passes → full Templa.
- Cut fails but Quote is selling → keep Templa as a Quote/estimating company (the Hover path) and keep working on Cut.
- Quote doesn't sell to 5 shops *and* Cut fails → switch to DealDock.

## 6. Updated money math (my arithmetic)

- 60 Quote shops × $179 = about $10,700/month
- 20 Cut shops × $299 = about $6,000/month
- 40 Check seats × $49 = about $2,000/month
- **Total: about $18,700/month from about 80 shops.** That is roughly the same revenue as the original plan's 60 Cut shops, but most of it does not depend on passing the 1/16-inch test.

## 7. Risks the original missed

- **Incumbents already have photogrammetry.** Laser Products (ScanTemplater) and Prodim (the Proliner adds photos for vein matching) could ship a phone version. Your defense: speed, the no-hardware cut, and the trades they ignore (glass, canvas). Also, being acquired by one of them is a realistic exit, so keep data and IP clean.
- **Scope on Steve's nights and weekends.** Quote plus bench tests plus field tests is a lot for one engineer with a day job. Rule: Steve builds nothing for DealDock until day 60.
- **App Clip limits.** App Clips have a size cap and only some ARKit features on non-Pro phones. Check this in week 1 before promising "no install" to shops.
- **Vendor figures.** The SlabWise and SlabOS numbers come from countertop software sellers, so treat them as rough. Get prices from 3 shops by phone.

## Sources (opened Sep 25, 2026)

- [SlabWise: best laser templating systems 2026](https://slabwise.com/best/laser-templating): ScanTemplater photogrammetry, $10-18K, ±1/8 inch (vendor source, directional)
- [SlabWise: templating systems compared](https://slabwise.com/guide/templating-comparison)
- [Flexijet review 2026](https://slabwise.com/reviews/flexijet-review) and [Flexijet SmartRemote app](https://www.flexijetaustralia.com/)
- [Prodim Proliner for stone](https://www.prodim-systems.com/industries/stone-industry-solutions/): photogrammetry for vein matching
- [Smart Glazier shower measure app](https://smartglazier.com/glazier-app/)
- Original Round 3 and Round 2 PDFs for all other figures
