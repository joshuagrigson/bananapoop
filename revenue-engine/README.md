# Proxyfolk

A tiny illustrated world of folk who stand in for anything you keep track of. You build the rooms, the folk who work them, and the world they live in, and every one of them is bound to a real ledger line. Open `http://127.0.0.1:8790` for the world and `/ledger` for the money dashboard.

**The backbone.** Three things, all editable, in any combination:

- **Rooms are what you track.** A barber's services, a kid's chores, a money path, a website, a client, a job. Up to 10 per world.
- **Folk are who works them.** Each character is someone real: a person on the roster (a kid, a barber, you) who walks to the room of their latest logged work, or, at the paid level, an **AI agent** on a job that does the work itself (one character per agent). The number of characters in a room is the number working it.
- **The world is a skin.** Space station, dark castle, farm, cyber city, alien ship or ocean base. Purpose and world are independent: a barbershop can live in the castle and a chore chart in the cyber city, and everything works the same. Switching worlds never touches a number.

When something real happens (a sale, a chore, a finished agent run) the folk who did it walk over and do it on screen: a visitor sits down and gets a haircut, a kid washes the dishes, coins fly to the vault, the room's tier climbs and fireworks go off. Between real events the folk just live (tinker, chat, take a break, sleep at night on your clock), and the field guide (`?`) says which is which.

It started as a revenue station for one operator, and it keeps StarNet's best law: the interface never asserts anything the ledger cannot prove.

- **One append-only ledger** (`data/ledger.jsonl`). Money in, money out, outcomes, agent runs, gates, path status. Nothing else is state.
- **No simulated money.** `money.in` is rejected without evidence (an invoice id, a Stripe charge, a bank line).
- **Quests are projections, not checkboxes.** There is no "mark complete". A quest is done when the ledger proves it, and it cites the lines that did.
- **Agents spend real money and say so.** Every model iteration writes its reconciled cost to the ledger. Runs stop at a per-run cap, and each path has a real budget it cannot exceed.
- **Agents never contact anyone.** They log evidenced prospects and write drafts to an outbox. A human sends.
- **Gates are legal, not cosmetic.** Paths that stand on day-job expertise are blocked from agent spend until the employment-agreement gate is cleared with evidence.

## Look first

Live preview on demo data, and every button works: https://revenue-station-preview.netlify.app (station), `/terminal/` (production terminal), `/ledger/` (money dashboard). A second station built for a barbershop, one room per service with Square sales split by service, is at https://revenue-station-preview.netlify.app/barber/, and a family allowance tracker on the farm is at https://revenue-station-preview.netlify.app/family/. Add `?skin=castle` (or `farm`, `cyber`, `alien`, `ocean`, `space`) to any page to see the same numbers in another world, for example https://revenue-station-preview.netlify.app/barber/?skin=cyber. To see it on every kind of screen at once, open https://revenue-station-preview.netlify.app/devices/: the live mock inside an iPhone, an Android phone, a tablet (turn it sideways with the rotate chip) and a PC monitor, side by side at their real sizes, each running the real phone, tablet or desktop layout; pick the station and the page on top, or one device on its own, and tap around inside any screen. Every character, room, backdrop and map can be exported to PNG with sprite sheets, a gallery and the code behind them: `npm run preview && npm run export-art` (see `scripts/export-art.mjs`; `scripts/legacy-export.mjs` does the same for the old pixel engine). The folk kit in `art/folk-kit/` redraws the whole cast and the six world maps in the Code Lab house style (thick outlines, chibi proportions, five tiers from Runner to Tycoon, six species, six poses) as SVG from code; `npm run export-folk` writes every one to SVG and PNG with contact sheets in `folk-art/`, and `art/folk-kit/PROPOSALS.md` holds 20 proposed new worlds and their casts. Rebuild all of it with `npm run preview`, which writes a static copy to `preview/`.

The preview is a working mock, not a picture of one. Each page boots the real engine (`src/api.js` and the ledger, rooms, sync, agents and scheduler behind it) inside the browser over an in-memory disk kept in that browser's localStorage (`src/mock/`), seeded with the same demo. Log a sale, check off a chore, pay a kid, hire or dispatch an agent, link Stripe or Square with any made-up key, import a CSV, redesign the rooms: it all goes through the same rules a real station applies (the evidence rule, budgets, keyword routing). Only the outside world is pretend: Stripe, Square, PayPal, Gumroad and the Texas permit records are stand-ins that answer in each platform's real response shape, and agents replay scripted work instead of calling a model. Nothing typed there leaves the browser; keys are scrubbed to their shape and last four characters before they are stored. The bar on top switches Autopilot (scheduled agents, syncs and chores happening on their own) and resets the demo.

What to try first: press **Tour** (or T). It walks every part of the page and drives the world as it goes. In **Customize**, every field has a **?** with a plain-words explanation, and "Explain every field" shows them all.

### Up close

Pick a room and press **Close-up** (or keep zooming in, or pinch past the closest look on a phone). The camera frames that one room as a cutaway, its walls rising to full height: walls, windows that follow the time of day, and furniture for what the room is for. A barbershop gets chairs, mirrors and a pole; a chore called Dishes gets a kitchen, Yard work a lawn and a mower, Laundry a washer. The same folk, agents and clients are there at the same spots doing the same things, drawn big enough to see faces: a diamond over each head says what they are up to (green working, yellow free, blue asleep, cyan an AI agent), a bar shows a job in progress and what it will earn, and the screen on the wall shows the room's real numbers. Money lands as a value pop with coins. Arrows step room to room; swipe does too on a phone.

### On a phone

The phone layout is its own design, not a squeezed desktop: the world fills the screen, the numbers scroll along the top, the latest ledger line runs as a ticker, the main menu is a tab bar (World, Rooms, Customize, Income, More), and the side panel becomes a sheet you pull up. On a computer the same page keeps the left menu rail, the labeled camera dock and the side panel.

Click anywhere on a room (floor, walls or its label) and the camera flies right into it, walls up, so you can watch that sector work, while the side panel turns into that room's hub: its rank and level, who is in there (click a name to follow them), its numbers, the previous and next room, **Whole world** and **Edit room**. Click the vault for the roster, or the dock. Click a character to follow them: the camera tracks them and the panel says what they are doing and whether it is real. Drag to pan, scroll or pinch to zoom, double-click a room to fly in, `1`-`9` jump to a room, `C` customizes the world, `R` replays the last 24 hours of real events (it also plays on its own when the world is left alone), `M` turns sound on, `Esc` steps back (out of the close-up to the room, then to the whole world), `P` folds the side panel, `?` opens the field guide. `V` opens a room's close-up, `[` and `]` step room to room, `T` starts the tour. Add `?hour=22` to any page to see the world at night. Everything is drawn as smooth vectors straight to the screen, every frame, at the display's full resolution: rooms, furniture, walls and doors, the vault, the dock, the halls, the mast, the sky of each world, the critters, weather and light at night, and the folk themselves. Nothing is a sprite, so zooming never blurs or goes blocky, and detail is added as you zoom in (faces, hair, tools, the numbers on the wall screen). Every room, the vault and the dock floats on its own slab with its two back walls, joined to its neighbours by walkways, with the world's sky behind and nothing underneath. Behind the whole station, as in a dollhouse (or the Sims), the two outer back walls stay up on a ledge of their own: castle stone with battlements, banners and towers, a hull with portholes in space, a red barn on the farm, a lit block with neon signs in the city, living ribs on the alien ship, viewports onto the sea on the ocean floor. People dress for the world: jumpsuits and headsets in space, tunics (and your crown) in the castle, overalls and straw hats on the farm, jackets and visors in the city, uniforms on the ship, wetsuits and dive masks under the sea; a room's costume in the castle, city or ship wins, and work clothes (a barber's apron) go on top. Furniture is chosen by what a room is for and the walking paths go around it. Everyone is drawn in the Code Lab house style from the folk kit (`art/folk-kit/`): chibi figures with thick outlines, dressed for their world and their level. Agents and folk move up five tiers, Runner, Clerk, Trader, Broker and Tycoon (a lanyard, a tie, a vest and headset, a jacket with gold buttons, then gold trim, a cape and a circlet), and a room's costume turns its people into skeletons, robots, greys, blobs or octopuses. Each world also has its residents, labelled as scenery: Mordra and Vex in the castle with Grubbs running the floors, Mott and Warg on the farm, a cargo bot and floating runners in space, a hoverboard courier and a DJ bot in the city, Glorp the blob and grey Tycoons on the ship, Octavia the octopus accountant and crab couriers under the sea. One of them is data: on the farm, Mumblecrow stands in any room with no sales, chores or leads for 7 days. Add `?figures=classic` to see the older figures. Every room also sends what it makes to the vault along the walkways, in its world's form (enchanted coins and sealed scrolls in the castle, produce on the farm, cargo pods in space, data cubes in the city, spores on the ship, pearls in bubbles under the sea), and it funnels in at the centre, where a swirl turns faster the more is coming in. It is data: the stream is as steady as the room's last 30 days of money, leads follow its last 7 days of pipeline steps, a quiet room sends nothing, and every sale sends a burst. The castle's walls are real masonry up close: coursed stone, piers, arrow slits, moss and ivy, torches that light the wall, cloth banners and slate-roofed towers. **Map** (or `B`) opens the station drawn as an illustrated map of its world, every room numbered; click one to fly there. **Walls** in the camera dock (or `L`) switches between three views, as in the Sims: Cutaway (the room you look at has its walls up, the rest are low), Walls up (every room), and Walls down (no walls at all, the outer ones too).

Labels stay out of the way: each room's plate is one short line hanging below its front corner (the rest shows on hover), everyone who works stands on a ring of their own color, and a character's name only appears while you hover over or follow them. Each room has a medallion on its floor saying what it is.

On a computer the side panel folds in two steps, with the arrows on its edge or `P`: the full panel, then a stacked list of rooms, then a thin taskbar of room chips (rank, money, a dot when something is live). The comms feed folds to its header with **Hide** and comes back with **Show**. Both are remembered.

No room is ever a ghost town. Like a trading floor, every room carries a floor crowd working the phones, running papers, hunched over desks and cheering when money lands: three people even in a brand-new room with no income yet, one more for each doubling of its activity over the last 7 days (sales, and in the command center every pipeline step), up to two more for agents hired to work there, seven at most; a killed room goes quiet. Every agent on a live run also brings three glowing helpers into its room. The crowd is atmosphere, not ledger lines, and says so: hover one and it reads **Floor crew** or **Agent crew**, and the room's hub counts them as "+N on the floor", apart from the named characters.

## One-paste start (Windows)

Paste this into PowerShell. It downloads or updates the code, checks Node, asks for your Anthropic key once (hidden), pulls new local businesses, adds Randi as client #1, sets the auditor and manager jobs, and opens the station. Run the same line again any day to update and restart.

```powershell
cd $HOME; if (Test-Path bananapoop) { git -C bananapoop pull } else { git clone -b claude/amazing-edison-n9ydsa https://github.com/joshuagrigson/bananapoop }; powershell -ExecutionPolicy Bypass -File .\bananapoop\revenue-engine\setup.ps1
```

## Income sync (so the station updates itself)

Open **Sync** in the top bar (or press `I`, or click the comm mast). Two ways to get your real income in:

- **Link an account**: Stripe, Square, PayPal, Gumroad. Paste a key (the panel shows exactly where to get it; Stripe's is truly read-only, Square's and PayPal's can do more, so they stay on your computer and the station only ever reads with them), pick which money path it counts toward, done. The station pulls new payments every 15 minutes while it is open, net of the platform's fees.
- **Import a statement**: Upwork, Fiverr, Etsy, Amazon Associates, PayPal, Venmo, any bank. Download the CSV from the site, drop it in, check the preview (new, already there, skipped and why), press Import.

Every payment is stored with the platform's own transaction id, so syncing or importing the same thing twice never counts a dollar twice. Withdrawals, fees, transfers, refunds, pending and non-USD lines are skipped. Keys live only in `data/connections.json` on your computer; they never go into the ledger and the station only ever shows their last 4 characters. The same thing from the command line:

```bash
node src/cli.js connect stripe --path gbp-management --key rk_live_...
node src/cli.js import-csv ~/Downloads/upwork.csv --path freelance-desk --source upwork --dry-run
node src/cli.js sync
node src/cli.js connections
```

## Rooms: make the station your business

The rooms don't have to be the built-in money paths. Open **Rooms** in the top bar (or press `C`) and make each room whatever you sell: a barber makes one room per service (skin fade, beard trim, kids cut, products), a salon one per treatment, a freelancer one per kind of gig. Up to 10 rooms, each with its own name, color, furniture (barber chairs and mirrors, a shop counter, desks, a studio), wall sign and corner prop. Start from a template (barber shop, hair salon, freelancer, the built-in paths, blank) and change anything. A new, empty station asks on first open.

Each room claims sales by keyword. A synced sale keeps the name its platform gave it, and it lands in the first room whose keyword appears in that name: Square's "Skin Fade" goes to the room that claims `fade`, "Beard Oil" to the products room that claims `oil`. Square is read one line per service on the ticket, so a cut plus a beard trim lands in two rooms, and the tip and fees are shared between them by price, to the cent. Cash and other sales go in with a service room's **Log a sale**.

Rooms are views, not buckets. Renaming a room, changing its keywords or reordering the rooms re-sorts the whole history on the next refresh, and no ledger line is ever rewritten. Sales no room claims stay in the room they were logged to (for Square, the room picked when linking it), and every dollar, claimed or not, still totals in the vault at the centre. Money logged to a room you later removed shows on the roster as "not in any room" until a keyword claims it.

A service room shows what it sold, revenue, average ticket, tips, estimated profit after supplies, and **profit per hour of chair time** (set minutes and supply cost per service), with a daily takings chart and a monthly goal. The roster ranks the services by profit per hour, revenue, count or profit over 7, 30 or 90 days, and the top earner per hour wears a crown on the map. On the map: mirror bulbs light for each sale today, towels stack up with this month's sales, and the tube fills toward the room's goal (gold once met).

The design lives in `data/rooms.json`. From the command line: `node src/cli.js rooms`, `rooms template barber --name "Kim's Cuts"`, `rooms skin castle`, `rooms mode allowance`, `rooms reset`.

### What a world is for, and which world it is

A world has a purpose, picked on first open or under **Customize** (`C`), and any purpose goes with any world:

- **Command center**: the built-in money paths, with agents you hire and dispatch for money-making jobs.
- **Service station**: one room per service you sell (a barber's cuts, a salon's treatments), ranked by profit per hour.
- **Allowance tracker**: one room per chore, for parents. See below.

Switching the purpose in Customize redraws the rooms for it: a barbershop's cuts become the chore chart's chores (or the built-in paths), with their own names, prices and keywords, and the station's title and people's job words follow. Everything is a draft to edit; switching back brings back what you had. Customize saves when it closes (the X, Esc or a click outside), and the toast that confirms it has an Undo; Cancel is the way out without saving.

And one of six worlds, each with its own backdrop, materials and room types: a **space station**, a **dark castle** (a crypt of skeletons, a witch's kitchen, a goblin forge, a haunted library, a dragon's hoard, a vampire's parlor), a **farm** (a cow pasture, a pig pen, a chicken coop, a sheep meadow, a horse stable, a veggie garden full of bunnies, with farmhands at work), a **cyber city** (a hacker den, a neon bar of androids, a street dojo, a chop shop, a night club, a ripperdoc clinic), an **alien ship** (a specimen lab, a hatchery, the bridge, a spore garden, a probe bay, a watcher lounge) and an **ocean base** (a coral reef, an octopus grotto, a shipwreck of crabs, a kelp forest, a sub bay of sea turtles, the deep with its jellyfish). Each room picks its own look in the designer. In the castle, the city and the ship, the folk working a room wear its costume (Dre the barber becomes a witch in the witch's kitchen, Emma a skeleton in the crypt); on the farm and under the sea the animals are the room's stock, more of them as it gets busier. The world is only dress: every world draws the same ledger, and switching never touches a number. The HUD, the money dashboard (`/ledger`, which has a world picker of its own) and the production terminal (`/terminal`: an amber scrying glass in the castle, a chalkboard on the farm, sonar under the sea) all follow the station's world. The dashboard also hides the agent machinery a shop or a family does not use.

### Folk

Customize (`C`) holds the roster: a name and color per person (up to 12), and in each room's settings, who works there. Log a sale or a chore with who did it (`money.in` gets a `by` field) and that person walks to the room and does it. Without a room list, a person lives wherever their last logged work was. AI agents need no roster entry: hire one in a room (Crew) and a character appears there, one per agent.

### Allowance tracker

Pick **Allowance tracker** and the **Chore chart** template (dishes, make bed, tidy room, homework, feed pets, trash, laundry, yard work), add each kid's name, and set what every chore pays and how long it takes. To log a chore, open its room, pick the kid who did it and press **Check it off**: that appends a `money.in` line with the kid's name, and the kid shows up on the map standing in that room, name overhead. The vault totals what every kid has earned and what each is owed. **Pay** (two clicks) records a `money.out` line with the kid as payee, which zeroes their balance. Nothing moves real money. Chores are ranked by pay per hour, so it is easy to see which ones are worth the most to a kid's time. A second station keeps a family's chores apart from your business: `setup.ps1 -Station family`, or `REVENUE_ENGINE_DATA=./data-family node src/cli.js serve --port 8792`.

### A second station for someone else's business

A separate station keeps its own ledger, rooms and income links, so a barbershop's Square key and sales never mix with yours. On Windows:

```powershell
cd $HOME; if (Test-Path bananapoop) { git -C bananapoop pull } else { git clone -b claude/amazing-edison-n9ydsa https://github.com/joshuagrigson/bananapoop }; powershell -ExecutionPolicy Bypass -File .\bananapoop\revenue-engine\setup.ps1 -Station shop
```

That keeps everything in `data-shop/`, runs on port 8791 (side by side with your own station on 8790), needs no Anthropic key, and opens the station: pick **Barber shop**, name it, open **Sync**, link Square. Elsewhere: `REVENUE_ENGINE_DATA=./data-shop node src/cli.js serve --port 8791`.

## Crew

Every agent you hire (a standing job) is a character who lives in its room: it wanders between runs and sits at a desk while its run is live. Hire one from a room's **Crew** section (role, how often, max per run); flip its switch to send it off shift. One-off runs from **Act → Dispatch** beam in from Command and leave when done.

## Run it

Requirements: Node 22+. One dependency (`@anthropic-ai/sdk`).

```bash
cd revenue-engine
npm install
npm test                       # 71 tests, zero spend (replay provider, fake payment APIs)
REVENUE_ENGINE_DATA=./demo node src/cli.js seed-demo   # optional: labeled fake data to preview the station
REVENUE_ENGINE_DATA=./demo-shop node src/cli.js seed-demo --barber   # optional: the barbershop demo
REVENUE_ENGINE_DATA=./demo-family node src/cli.js seed-demo --family  # optional: the allowance demo (three kids, the farm)
node src/cli.js status         # headline numbers, level, open quests
node src/cli.js paths          # the catalog
node src/cli.js serve          # station at http://127.0.0.1:8790, money at /ledger, scheduler on
```

Set `ANTHROPIC_API_KEY` (or log in with `ant auth login`) before a live run:

```bash
node src/cli.js gate employment-agreement --cleared --evidence "read 2026-09-26; no non-compete, moonlighting allowed"
node src/cli.js harvest                                    # free: new local businesses from Texas records
node src/cli.js run auditor    --path gbp-management --max-usd 1
node src/cli.js run pricing    --path show-rate-engine    --max-usd 1
node src/cli.js log-in 200 --path gbp-management --source "Example Salon" --evidence "Square invoice 0001"
```

A dry run with no key and no spend:

```bash
node src/cli.js run prospector --path cohort-course --provider replay --script replay/prospector-demo.json
```

## The loop

1. Pick the next open quest (the dashboard and `status` order them: gates, then the next stage per path, then the money ladder, then yield).
2. Run an agent role against the path, or do the step by hand.
3. Log what actually happened, with evidence. Prospects from agents already carry a URL; conversations, demos, pilots and payments are yours to log.
4. Watch the stage advance. When a path fails its kill test, kill it with a reason. The budget it had goes back into the pool.
5. Money in moves the Commander level. Every rung cites the payment that crossed it.

## Jobs (the agents working while you're away)

```bash
node src/cli.js job add creator    --path content-channel     --every 24 --max-usd 1
node src/cli.js job add auditor    --path gbp-management      --every 24 --max-usd 1
node src/cli.js job add manager    --path gbp-management      --every 24 --max-usd 2
node src/cli.js jobs
```

`serve` runs a scheduler that checks jobs every minute. It never runs a job twice at once, stops dispatching after `--daily-cap` dollars in a day (default $5), and every gate, kill switch and path budget still applies.

## The money loop

1. Jobs put drafts in the outbox. The dashboard lists them with a copy button.
2. You publish or send. Agents never post or email anyone.
3. Log the live URL: `node src/cli.js post content-channel --platform linkedin --url https://... --title "..."`
4. When money arrives, log it with evidence and, if a post earned it, the post id: `log-in 42.50 --path content-channel --source "Affiliate" --evidence "payout 77" --post <id>`
5. The dashboard shows earned, spent, net and yield by path, month, platform and post.

## GBP management (room #4, the lead offer)

Local businesses live or die on Google Maps. Market price: about $125-285/mo freelance, $300-700 agency.

1. **Find** (`harvest`, or the dashboard button): pulls every business that got a Texas sales-tax permit in the last 30 days in Bowie (019) and Cass (034) counties from the Comptroller's free dataset, keeps salons, spas, groomers, repair shops, restaurants, gyms, trades and florists, and drops them in the audit inbox. Plain code, $0. `serve --harvest-daily` runs it once a day.
2. **Audit** (`auditor`, Sonnet 5 at low effort, 2 searches per business, 4 per run): checks each one's public Google presence against the first 3 competitors, scores how weak it is, and for 6+ writes a findings table, 3 fixes, a 2-minute video script and a 2-sentence text. Cells it did not see say "not seen".
3. **You** record the screen video from the script and send it with the text. Log it: `outcome gbp-management conversation --ref "Business" --evidence "sent 9/26"`.
4. **Client** says yes: they add you as a Manager on their profile (never their password). `client add gbp-management --name "..." --city Texarkana --category "hair salon" --monthly 200`.
5. **Monthly** (`manager`): for each client whose pack is due, writes 6 posts with photo briefs, 5 Q&A pairs, replies to the reviews you pasted into their notes, a photo shot list and a report with blanks for calls and direction requests. Update notes with `client notes gbp-management <id> --notes "..."`. You paste it in.

Hard lines: no fake, bought or incentivized reviews and no review gating (FTC); no keyword-stuffed names, fake addresses or profiles for businesses the client doesn't run; never promise rankings. Kill test: 30 video audits in 30 days, fewer than 2 paying clients = reprice or kill.

## The Freelance desk (agent-staffed gigs)

Room #8. Clients on Upwork and Fiverr pay for finished work; agents do most of it, you are the face and the quality check.

1. `node src/cli.js run lister --path freelance-desk` writes three Fiverr gig listings and an Upwork profile to the outbox, priced against comparables it cites. You publish them by hand.
2. Paste job posts into the dashboard's Freelance inbox (or `inbox add freelance-desk --type post --file post.txt --url https://...`). The `scout` scores each one 0-10, drafts a proposal under 150 words for anything 7+, and logs the post as a prospect. You read, edit and send.
3. When you win a job, paste the client's brief as "job I won". The `fulfiller` drafts the full deliverable plus a delivery note, with a checklist of what to verify. You review and deliver.
4. Log the payout with the gig type and your hours: `log-in 120 --path freelance-desk --source "Client (Upwork)" --evidence "payout 5531" --tag "lead research" --hours 1.5`. The dashboard ranks gig types by dollars per hour of your time.

Agents never log into Upwork or Fiverr, submit proposals or message clients; Upwork bans automated bidding. The scout and fulfiller skip before spending anything when their inbox is empty, so a scheduled scout costs $0 on a quiet day:

```bash
node src/cli.js job add scout     --path freelance-desk --every 2 --max-usd 0.5
node src/cli.js job add fulfiller --path freelance-desk --every 2 --max-usd 2
```

Kill test: 3 Fiverr gigs live or 20 Upwork proposals sent within 30 days; fewer than 2 paid orders means change the gig type or kill the path.

## Token efficiency

Routine roles run on the cheapest model that does them well: Sonnet 5 at medium effort for prospecting, content and offers, Haiku 4.5 for outreach drafts. Defaults are $1 per run and 8 loop iterations. Web searches are capped per role, and the system prompt is cached. Pass `--model claude-opus-5` for a run that needs more judgment.

## Roles

| Role | Logs | Web search | Writes |
|---|---|---|---|
| `prospector` | `prospect` outcomes with a live URL each | yes | `outbox/<path>/prospects.md` |
| `outreach` | nothing | no | one draft per logged prospect plus an index |
| `pricing` | nothing | yes | `outbox/<path>/offer-sheet.md` |
| `auditor` | `prospect` (lead or listing URL) | yes (8) | `audit-*.md` with findings, 3 fixes, a video script and a text, plus `audit-report.md`; reads the lead inbox |
| `manager` | nothing | yes (2) | `pack-<client>-<month>.md`: posts, Q&A, review replies, shot list, report; reads due clients |
| `lister` | nothing | yes (3) | three `gig-*.md` Fiverr listings and `upwork-profile.md` |
| `scout` | `prospect` (the job post URL) | no | `proposal-*.md` for posts scoring 7+, plus `scout-report.md`; reads the inbox |
| `fulfiller` | nothing | yes (4) | `deliverable-*.md` with a review checklist and `delivery-note-*.md`; reads the inbox |
| `creator` | nothing | yes (2) | three `post-*.md` packages: platform, hook, full text or script, caption, visual brief, one CTA, sources |

Default model is `claude-sonnet-5`. Pricing lives in `src/cost.js` and is marked volatile; an unpriced model is refused rather than recorded as $0.

## Files

```
src/ledger.js     append-only JSONL, validation, the evidence rule
src/reduce.js     pure reducer: events -> state (dedup, totals, runs, gates)
src/paths.js      the catalog: six paths, stage targets, kill tests, budgets, the gate
src/quests.js     pure projection: gates, stages, ladder, yield
src/level.js      Commander ladder with citations
src/cost.js       model prices (volatile) and cost reconciliation
src/agent.js      roles, tools, the budgeted run loop, replay provider
src/scheduler.js  jobs: due logic, daily cap, one-at-a-time dispatch, skips inbox jobs with no work
src/inbox.js      the job inbox: posts to score, won jobs to fulfill, local leads to audit
src/harvest.js    free Texas new-permit feed (data.texas.gov jrea-zgmq) into the GBP inbox
src/sync.js       income sync: Stripe, Square, PayPal, Gumroad links and CSV statement import, deduped by transaction id
src/rooms.js      the room design: templates, validation, keyword routing of sales into rooms (views over the ledger)
src/clients.js    client roster with monthly pack due dates
src/demo.js       labeled demo data (refuses a real ledger)
src/api.js        the JSON API as a plain function (/api/state, /api/events, /api/run, /api/jobs, /api/rooms, /api/connections, ...)
src/server.js     localhost HTTP: the pages, the host and origin guard, and api.js behind them
src/mock/         the preview's mock: an in-memory disk, path and hash stand-ins, pretend payment platforms, the boot script
src/station.html  the station: smooth vector renderer (rooms and furniture by purpose, lighting, depth-sorted folk, pathfinding, camera), the room close-up, the tour, field help, the phone layout and game HUD; no assets, scenery labelled as scenery
src/dashboard.html  the money dashboard
src/devices.html  the preview's device showcase: the live mock in iPhone, Android, tablet and PC frames
scripts/export-art.mjs  the art handoff: every character, room, backdrop and map as PNG, with atlases, a gallery and a standalone character renderer
scripts/export-folk.mjs the folk kit export: art/folk-kit's characters and maps as SVG + PNG, contact sheets, manifest
art/folk-kit/           folkSvg.js (every character, Code Lab style), mapSvg.js (the six world maps), PROPOSALS.md
src/cli.js
test/             node:test, zero spend
replay/           scripted runs for tests and dry runs
```

## What is deliberately missing

- No auto-posting or auto-emailing. Sending to real people under your name stays your action until you decide otherwise.
- No XP, no streaks, no levels for agents. The only level is the operator's, and it is denominated in dollars.
- No automatic sending. Outreach drafts sit in the outbox until a human sends them.
