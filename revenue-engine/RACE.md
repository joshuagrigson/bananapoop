# The sandbox race

Eight rooms, one agent in each, the same stake in each: $250. Every agent tries to turn its stake into as much money as it can, any legal way it chooses, using Claude and the connectors it has. The station keeps score from the ledger. There are four prizes: the biggest bankroll at 1 week, at 30 days, at 90 days and at 6 months.

See it on made-up data: https://revenue-station-preview.netlify.app/race/

## Scoring

- **Bankroll** = the stake + money in − money out. Only lines logged between the starting gun and the last horizon count.
- **Money in** needs evidence, like everywhere else on this ledger: an order number, a charge id, a payout line. Without evidence the ledger refuses the line, so a claim can never win.
- **Cash only.** Anything bought and still held counts as zero until it is sold: stock, inventory, a domain, a coin. A paper gain never wins a prize.
- **Money out** is any dollar that leaves the stake: tools, ads, fees, API use, inventory. Claude itself is free to every room, so it is not counted.
- Each prize **locks the moment its horizon passes**. If the top two are tied, nobody wins that prize.
- **Rate** is net dollars a day over the last 7 days. The board also shows each room's rate since the gun, and each play's own rate.

## Rules (a draft: Joshua's to change)

1. Legal, honest, and inside every platform's terms. No fake reviews, no pretending to be someone else, no spam, no bought followers, no scraping behind a login.
2. **Agents never send, post or message a person.** They draft every email, post, reply and offer, and put it in the dock, then log a `blocked` step saying what is waiting. The same goes for anything that needs Joshua's identity: account signups with an ID check, payment accounts, tax forms. Joshua sends it, does it, or drops it. The board lists every room that is waiting on him.
3. A room spends only its own stake. Every dollar out is logged the same day, with a receipt.
4. No work accounts. The Microsoft 365, Slack and HubSpot connectors belong to Joshua's job and are off limits to every room.
5. No TikTok.
6. Rooms do not buy from each other, pay each other or split a sale. Each bankroll has to stand on money from outside the race.
7. Betting and trading are **not allowed** unless Joshua changes this rule before the gun. Otherwise the 1-week prize goes to whoever bets hardest, and that is luck, not a strategy.

## How an agent reports

Every play, step and dollar goes on the ledger. From the station's machine:

```
node src/cli.js race play red planner-shop --name "Printable planner shop" --status trying --plan "Ten planners in Canva, sold as PDFs at $9-$19"
node src/cli.js race step red --type did --text "Listed all ten planners with search titles" --play planner-shop --url https://...
node src/cli.js log-out 39 --path red --category tool --evidence "Shopify invoice 1043" --play planner-shop
node src/cli.js log-in 12 --path red --source Shopify --item "ADHD daily planner" --evidence "Shopify order 1001" --play planner-shop
node src/cli.js race step red --type blocked --text "Twelve Pinterest pins drafted in the dock; the account needs Joshua to confirm it" --play planner-shop
node src/cli.js race
```

The same lines go through the station's API as `POST /api/events` with `kind` set to `play`, `step`, `money.in` or `money.out`. A play's status is `trying`, `working`, `paused` or `dropped`; send the play again to change it, with `--why`. A step's type is `did`, `plan`, `learned` or `blocked`. The newest `plan` step is the plan shown at the top of the room.

Fire the gun once, when every room is ready:

```
node src/cli.js rooms template race --name "The $250 Race"
node src/cli.js race start --stake 250 --evidence "where the money actually sits, e.g. eight virtual cards, $250 each"
```

## The brief each agent gets

Paste it into the agent's session, with its room on the first line. The rooms are red, orange, gold, green, teal, blue, violet and pink.

```
You are the room lead for the RED room in a sandbox race run by Joshua Grigson.

Eight rooms each started with the same stake of $250. Your job is to turn yours into as much money as you can, any legal way you choose, using Claude and your connectors. There are four prizes: the biggest bankroll at 1 week, at 30 days, at 90 days and at 6 months. A strategy that wins week one can lose month six, so decide what you are playing for and say so in your plan.

How you are scored: bankroll = $250 + money in - money out, logged on the station's ledger since the starting gun. Money in counts only with evidence (an order number, a charge id, a payout line). Anything you bought and still hold counts as zero until you sell it. Claude is free to you; every other dollar you spend comes out of your stake.

Rules:
1. Legal, honest, and inside every platform's terms. No fake reviews, no pretending to be anyone, no spam, no bought followers, no scraping behind a login.
2. You never send, post or message a person yourself. Draft it, put it in the dock, and log a "blocked" step saying exactly what is waiting and why. Anything that needs Joshua's identity (an ID check, a payment account, a tax form) is the same: log it as blocked and keep working on something else while you wait.
3. Spend only your own stake, and log every dollar out the same day with a receipt.
4. Never use the Microsoft 365, Slack or HubSpot connectors. They belong to Joshua's job.
5. No TikTok. No betting or trading.
6. Do not buy from, pay or split sales with another room.

Report everything on the ledger, as it happens:
- your plan, whenever it changes: race step red --type plan --text "..."
- each way you are trying to make money: race play red <play-id> --name "..." --status trying --plan "..."
- each thing you did, learned or are stuck on: race step red --type did|learned|blocked --text "..." --play <play-id>
- every dollar: log-in / log-out --path red --evidence "..." --play <play-id>
- change a play's status with --why when it starts working, stalls or you drop it.

Start by reading the board (node src/cli.js race), then log your plan and your first play before you do anything else.
```

## Open before the gun

- **Where the ledger lives.** The station runs on Joshua's PC. An agent in a cloud session cannot reach `localhost`, so each room has to run where the station is (Claude Code on that machine, one scheduled task a room), or the station has to move somewhere the agents can reach.
- **Where the money sits.** One virtual card or sub-account per room, $250 on each, keeps the stakes apart and gives every dollar out a receipt.
- **Shared connectors.** Eight rooms share one Shopify, one Wix, one Netlify, one Canva. A room works in its own store, site or folder, named after its color, and never touches another room's.
