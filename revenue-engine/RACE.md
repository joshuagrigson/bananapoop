# The sandbox race

Eight rooms, one agent in each, the same stake in each: $250. Every agent tries to turn its stake into as much money as it can, any legal way it chooses, using Claude and the connectors it has. The station keeps score from the ledger. There are four prizes: the biggest bankroll at 1 week, at 30 days, at 90 days and at 6 months.

See it on made-up data: https://revenue-station-preview.netlify.app/race/

## Setting it up

Put the station in race mode (Customize > What it's for > Sandbox race; the same screen has an **Open race setup: every option** button), then press **Race** in the main menu (the bottom bar on a phone). With no race yet it opens the setup; with one running it opens the race board, where **Rules and limits** and **New race** sit at the top.

The setup has every option there is, in sections you can jump between from the list on the left (a strip across the top on a phone). Nothing is fixed but the house rules. Everything is written on the ledger with the starting gun, and **Start the race** at the bottom fires it (or **Schedule the race** for a start time later). The line above the button counts what you set and warns you about anything that can't work, like a paper race scored on money.

- **Start from:** eight ready-made races. Each one sets the rules it names and keeps everything you wrote yourself:
  - **Idea tournament:** no money, scored on demand, top 3.
  - **Demand sprint:** two hours, no money.
  - **Quick test:** 30 min / 1 h / 2 h on $50.
  - **Real-money race:** $250 for 6 months, with receipts and approvals.
  - **Model shootout:** a different Claude model in each room.
  - **Battle royale:** last place goes out at every prize.
  - **Only the law:** everything allowed but the house rules.
  - **Locked down:** tight caps, and any break is out.

  This section also lets you save a setup under a name (it stays in this browser), load or forget saved ones, **Export file** / **Import file** as JSON, **Copy rules.json** for the command line, and go **Back to defaults**.
- **Purpose:** what the race is for: find an idea to run for real, make the most money, prove demand without spending, compare models, find the steadiest agent, learn fast, or your own words. Every brief leads with it. Below it is a box for **your rules in plain words**, which go into every brief word for word.
- **Time:**
  - Prize times: presets, or tick any from 30 min to 1 year, or type your own (`45m, 3h, 10d`).
  - How often each agent checks in (every 5 minutes to once a week, or one session for the whole race) and the longest session.
  - Quiet hours, weekdays only, and a start now or later.
- **Scoring and prizes:**
  - What wins: biggest bankroll, profit, multiple, money in, return per dollar, sales, different customers, demand shown, steadiest growth, fastest first sale, or your own points.
  - A tie-break: nobody, whoever got there first, whoever spent less, or whoever sold more.
  - 1 to 3 places per prize.
  - The evidence money needs: any note, an order number, or a link.
  - Knockouts: a bankroll line, going quiet for a set time, and last place out at every prize but the last.
  - The weight of each kind of demand: sign-up, pre-order, reply, qualified lead, meeting, follower, save, view.
- **Contestants:** the race name and stake. For each room: whether it races, its own stake, its Claude model (or set every room at once, or a different model in each), and an instruction only that room gets.
- **Ways to make money:** the eleven kinds, more in your own words, a **never use or mention** list (TikTok by default), and whether a play must log what it sells and to whom before it spends.
- **Tools:** every connector, work accounts marked, plus any you type.
- **Money:**
  - Real or paper money.
  - What rooms may spend on: API use, tools, ads, stock, fees.
  - Most a room spends in a day, and in all.
  - Purchases that need you first.
  - A reserve that must always be kept.
  - Whether money made may be spent.
  - Whether rooms may trade with each other.
- **People and posting:**
  - Agents draft and you send; no contact at all; or agents send themselves, honestly and signed, with a daily message limit.
  - The same three choices for public posts.
  - Whether your name may be used, whether your own contacts may be reached, and whether new accounts need you.
- **How agents work:** whether they see every room or only their own, whether they may copy, and whether every day needs a report.
- **Breaking a rule:** flag it on the board, fine the room a set amount per break, or knock it out.
- **Your own rules:** as many **must / must not / may** rules as you like (up to 60), with ideas to start from.
- **House rules:** the four that hold in every race, whatever the rest says.
- **Preview a brief:** exactly what any room's agent will read, written from the setup as it stands, before you start.

Each rule is marked **ledger checks** or **in the brief**:
- **Ledger checks:** the board catches a break itself and shows it with the time it happened. This covers spending categories and limits, approvals, the reserve, reinvesting, the banned list, allowed ways (a play names its kind with `--method`), quiet hours, weekends, daily reports, going quiet, paper money and the evidence standard.
- **In the brief:** on trust. The agents read it; the ledger cannot see it.

**Change the rules** on the board amends the race under way. The stake, prize times and rooms stay; everything else can change, and the change goes on the ledger with why. Every brief is written again from the new rules.

## Scoring

- **Bankroll** = the room's stake + money in − money out − fines. Only lines logged between the starting gun and the last prize time count.
- **Money in** needs evidence, like everywhere else on this ledger: an order number, a charge id, a payout line. Without evidence the ledger refuses the line, so a claim can never win. A race can raise the bar to an order number or a link; lines below it are shown in the room as **not counted**.
- **Demand** (sign-ups, pre-orders, replies, leads, meetings, followers, saves, views) needs evidence too. Each kind scores its weight when a race is scored on demand, and every room shows the demand it proved either way.
- **Your points:** in a race scored on your own points, the board has a **Your scores** form: room, points, why. Each one goes on the ledger.
- **Cash only.** Anything bought and still held counts as zero until it is sold: stock, inventory, a domain, a coin. A paper gain never wins a prize.
- **Money out** is any dollar that leaves the stake: tools, ads, fees, API use, inventory. Claude itself is free to every room, so it is not counted.
- Each prize **locks the moment its time passes**. A knocked-out room ranks last and wins nothing after it is out; the board says why it went out.
- **Rate** is net dollars a day over the last 7 days. The board also shows each room's rate since the gun, and each play's own rate. A race of two days or less reads in hours instead: dollars an hour over its last half hour to hour, times like 0:42 into the race, and a chart point every 5 minutes.

## What you can see

- **The board** (no room selected): what the race is for, the prizes (winner, the places after it, who went out), who is waiting on you, the standings on the race's own score, the rule breaks the ledger saw, the demand each room proved, spent vs made for every room with what each dollar spent brought back, where the race's money comes from (Gumroad, Fiverr, Shopify...), every rule, and a copy button for every agent's brief.
- **A room:** its score, bankroll, multiple, rate and return per dollar, why it is out (if it is), its rule breaks and fines, the demand it proved, money below the evidence standard, a chart by day, its place for each prize, spent vs made with where the money went, where its money comes from (each play and each platform), its plan, every play it tried, the day-by-day breakdown of everything it did, and its brief.
- **Winning ideas** (on the board, once a prize is won): each winner's best play, one click from its page.
- **A play** (click one): its full business model. What it sells, who buys, how they find it, what it charges, what it costs to run, and the plan; then made, spent, net, return per dollar, average sale, cost per sale, where its money came from and went, how its status changed and why, every step the agent took for it, and every dollar.

## How an agent reports

Every play, step and dollar goes on the ledger. From the station's machine:

```
node src/cli.js race play red planner-shop --name "Printable planner shop" --status trying --plan "Ten planners in Canva, sold as PDFs" \
  --offer "Ten printable planners" --customer "Students, parents, ADHD adults" --channel "Pinterest and store search" --pricing "$9-$19" --costs "Shopify $39/mo, Canva $15/mo"
node src/cli.js race step red --type did --text "Listed all ten planners with search titles" --play planner-shop --url https://...
node src/cli.js log-out 39 --path red --category tool --evidence "Shopify invoice 1043" --play planner-shop
node src/cli.js log-in 12 --path red --source Shopify --item "ADHD daily planner" --evidence "Shopify order 1001" --play planner-shop
node src/cli.js race signal red --type signup --count 14 --evidence "waitlist export, 14 rows" --play planner-shop
node src/cli.js log-out 80 --path red --category ads --payee Pinterest --evidence "Pinterest ads receipt 77" --approved --play planner-shop
node src/cli.js race step red --type blocked --text "Twelve Pinterest pins drafted in the dock; the account needs Joshua to confirm it" --play planner-shop
node src/cli.js race
```

The same lines go through the station's API as `POST /api/events` with `kind` set to `play`, `step`, `signal`, `money.in` or `money.out` (and `judge` for your own points: `race judge red --points 10 --why "..."`). A play can name its kind with `--method` (digital, services, saas, content, affiliate, ecommerce, local, data, resale, trading, betting, or one of the race's own), so the ledger can tell whether it is allowed; `log-out --approved` marks a purchase you said yes to. A play's status is `trying`, `working`, `paused` or `dropped`; send the play again to change it, with `--why`. The business model flags (`--offer`, `--customer`, `--channel`, `--pricing`, `--costs`) are what the play's page shows. A step's type is `did`, `plan`, `learned` or `blocked`. The newest `plan` step is the plan shown at the top of the room.

Fire the gun once, when every room is ready:

```
node src/cli.js rooms template race --name "The $250 Race"
node src/cli.js race start --stake 250 --evidence "where the money actually sits, e.g. eight virtual cards, $250 each" --rules rules.json
node src/cli.js race start --stake 50 --times 30m,1h,2h --evidence "one test card, $50 a room"     # a quick test race
```

`rules.json` holds any of the setup's rules. The easiest way to get one is **Copy rules.json** or **Export file** in the setup. Anything left out takes its default:

- **Purpose and scoring:** `purpose`, `purposeText`, `scoring`, `tiebreak`, `places`, `signalWeights`, `evidence`.
- **Knockouts and penalties:** `eliminateLast`, `idleOutMinutes`, `knockoutUsd`, `ruleBreak`, `fineUsd`.
- **Money:** `moneyMode`, `spendCategories`, `maxSpendPerDayUsd`, `maxTotalSpendUsd`, `approveOverUsd`, `reserveUsd`, `reinvest`, `collab`.
- **What they may use:** `methods`, `customMethods`, `banned`, `connectors`, `requireModel`.
- **People:** `outreach`, `maxMessagesPerDay`, `posting`, `useName`, `personalNetwork`, `newAccounts`.
- **How agents work:** `visibility`, `copying`, `dailyReport`, `everyMinutes` (0 = one session for the whole race), `maxSessionMinutes`, `quietHours` (`{ "from": "22:00", "to": "07:00" }`), `weekdaysOnly`.
- **Per room and your own words:** `stakes`, `models`, `roomNotes`, `customRules` (`[{ "kind": "must", "text": "..." }]`), `notes`.

`race amend --rules rules.json --evidence "why"` changes them mid-race. `race start --at 2026-10-01T09:00` starts the clock later.

## Taking a winning idea for real

This is what the race is for: the agents battle, and the winner's idea is the one you run for real. Every play's page has **Its playbook**: copy it, download it (`playbook-<room>-<play>.md`) or read it there. It holds everything needed to run the idea yourself, written from the whole ledger:
- the result and the business model;
- every step in order, with what it paid for and when its status changed;
- what it learned, and where it needed a person;
- every dollar with its evidence;
- what not to take for granted.

From the command line: `node src/cli.js race playbook red planner-shop`.

## The brief each agent gets

The brief is written from the race's rules, so it always matches them. It covers:
- what the race is for, the stake (or that it is paper), the prizes and how it is scored;
- the tie-break, the places, what knocks a room out, and what a rule break costs;
- the ways allowed and ruled out, the banned list and the tools;
- the house rules, every money limit, the contact, posting and account rules;
- how often to check in and when not to work;
- your own rules, your notes, the room's own instruction, and how to report. Copy it from the board or a room's panel, or print it: `node src/cli.js race brief red`. Paste it into that room's agent session.

## Open before the gun

- **Where the ledger lives.** The station runs on Joshua's PC. An agent in a cloud session cannot reach `localhost`, so each room has to run where the station is (Claude Code on that machine, one scheduled task a room), or the station has to move somewhere the agents can reach.
- **Where the money sits.** One virtual card or sub-account per room, $250 on each, keeps the stakes apart and gives every dollar out a receipt.
- **Shared connectors.** Eight rooms share one Shopify, one Wix, one Netlify, one Canva. A room works in its own store, site or folder, named after its color, and never touches another room's.
