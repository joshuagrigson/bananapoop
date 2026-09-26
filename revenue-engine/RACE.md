# The sandbox race

Eight rooms, one agent in each, the same stake in each: $250. Every agent tries to turn its stake into as much money as it can, any legal way it chooses, using Claude and the connectors it has. The station keeps score from the ledger. There are four prizes: the biggest bankroll at 1 week, at 30 days, at 90 days and at 6 months.

See it on made-up data: https://revenue-station-preview.netlify.app/race/

## Setting it up

Open the station in race mode and press **Set up the race** (or **New race** on the board). Every rule is yours to choose, and all of it is written on the ledger with the starting gun:

- **The basics:** the race name, the stake per room, the prize days (1 week, 2 weeks, 30, 60, 90 days, 6 months, 1 year, or any others), how it is scored (biggest bankroll, most profit, or biggest multiple), what happens on a tie (nobody wins, or whoever got there first), and whether it starts now or later.
- **Contestants:** which rooms race, each room's own stake (to handicap one), and which Claude model each room's agent runs on (to see which does best).
- **Ways they may make money:** digital products, freelance services, software and subscriptions, content, affiliate links, physical products and print on demand, work for local businesses, data and lead lists, buying and reselling, trading and investing, betting and prediction markets. Trading and betting start switched off.
- **Tools and connectors they may use:** Shopify, Wix, Canva, Figma, Adobe, Netlify, Cloudflare, Render, Zapier, Google Drive, GitHub, Hugging Face, Supermetrics, web search, plus any you type in. HubSpot, Microsoft 365 and Slack are marked as work accounts and start switched off.
- **Money:** paid ads on or off, the most a room may spend in a day, the purchase size that needs you first, a knockout line (a room whose bankroll falls to it is out), and whether rooms may trade with each other.
- **People and posting:** agents draft and you send or publish, or no contact with people at all; how often each agent checks in.
- **Anything else:** your own rules in plain words. They go into every brief.

**Change the rules** on the board amends the race under way: the stake, prize days and rooms stay, everything else can change, and the change goes on the ledger with why. Every brief is written again from the new rules.

## Scoring

- **Bankroll** = the room's stake + money in − money out. Only lines logged between the starting gun and the last prize day count.
- **Money in** needs evidence, like everywhere else on this ledger: an order number, a charge id, a payout line. Without evidence the ledger refuses the line, so a claim can never win.
- **Cash only.** Anything bought and still held counts as zero until it is sold: stock, inventory, a domain, a coin. A paper gain never wins a prize.
- **Money out** is any dollar that leaves the stake: tools, ads, fees, API use, inventory. Claude itself is free to every room, so it is not counted.
- Each prize **locks the moment its day passes**. A knocked-out room ranks last and wins nothing after it is out.
- **Rate** is net dollars a day over the last 7 days. The board also shows each room's rate since the gun, and each play's own rate.

## What you can see

- **The board** (no room selected): the prizes, who is waiting on you, the standings, spent vs made for every room with what each dollar spent brought back, where the race's money comes from (Gumroad, Fiverr, Shopify...), the rules, and a copy button for every agent's brief.
- **A room:** its bankroll, multiple, rate and return per dollar, a chart by day, its place for each prize, spent vs made with where the money went, where its money comes from (each play and each platform), its plan, every play it tried, the day-by-day breakdown of everything it did, and its brief.
- **A play** (click one): its full business model. What it sells, who buys, how they find it, what it charges, what it costs to run, and the plan; then made, spent, net, return per dollar, average sale, cost per sale, where its money came from and went, how its status changed and why, every step the agent took for it, and every dollar.

## How an agent reports

Every play, step and dollar goes on the ledger. From the station's machine:

```
node src/cli.js race play red planner-shop --name "Printable planner shop" --status trying --plan "Ten planners in Canva, sold as PDFs" \
  --offer "Ten printable planners" --customer "Students, parents, ADHD adults" --channel "Pinterest and store search" --pricing "$9-$19" --costs "Shopify $39/mo, Canva $15/mo"
node src/cli.js race step red --type did --text "Listed all ten planners with search titles" --play planner-shop --url https://...
node src/cli.js log-out 39 --path red --category tool --evidence "Shopify invoice 1043" --play planner-shop
node src/cli.js log-in 12 --path red --source Shopify --item "ADHD daily planner" --evidence "Shopify order 1001" --play planner-shop
node src/cli.js race step red --type blocked --text "Twelve Pinterest pins drafted in the dock; the account needs Joshua to confirm it" --play planner-shop
node src/cli.js race
```

The same lines go through the station's API as `POST /api/events` with `kind` set to `play`, `step`, `money.in` or `money.out`. A play's status is `trying`, `working`, `paused` or `dropped`; send the play again to change it, with `--why`. The business model flags (`--offer`, `--customer`, `--channel`, `--pricing`, `--costs`) are what the play's page shows. A step's type is `did`, `plan`, `learned` or `blocked`. The newest `plan` step is the plan shown at the top of the room.

Fire the gun once, when every room is ready:

```
node src/cli.js rooms template race --name "The $250 Race"
node src/cli.js race start --stake 250 --evidence "where the money actually sits, e.g. eight virtual cards, $250 each" --rules rules.json
```

`rules.json` holds any of the setup's rules (`methods`, `connectors`, `ads`, `maxSpendPerDayUsd`, `approveOverUsd`, `knockoutUsd`, `outreach`, `posting`, `collab`, `everyHours`, `scoring`, `tiebreak`, `stakes`, `models`, `notes`); anything left out takes its default. `race amend --rules rules.json --evidence "why"` changes them mid-race.

## The brief each agent gets

The brief is written from the race's rules, so it always matches them: the stake, the prizes, the ways allowed and ruled out, the tools, the money limits, the contact rules, your own notes, and how to report. Copy it from the board or a room's panel, or print it: `node src/cli.js race brief red`. Paste it into that room's agent session.

## Open before the gun

- **Where the ledger lives.** The station runs on Joshua's PC. An agent in a cloud session cannot reach `localhost`, so each room has to run where the station is (Claude Code on that machine, one scheduled task a room), or the station has to move somewhere the agents can reach.
- **Where the money sits.** One virtual card or sub-account per room, $250 on each, keeps the stakes apart and gives every dollar out a receipt.
- **Shared connectors.** Eight rooms share one Shopify, one Wix, one Netlify, one Canva. A room works in its own store, site or folder, named after its color, and never touches another room's.
