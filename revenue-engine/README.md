# Revenue Station

A pixel-art station where AI agents take jobs, make things (prospect lists, outreach, posts, offer sheets), and every dollar they help earn lands on a ledger you can audit. Open `http://127.0.0.1:8790` for the station and `/ledger` for the money dashboard.

It is a small, honest machine for driving one operator from $0 to a first dollar, then $1K, $10K, $100K, $1M. It borrows StarNet's best law (the interface never asserts anything the ledger cannot prove) and points it at revenue instead of deliverables.

- **One append-only ledger** (`data/ledger.jsonl`). Money in, money out, outcomes, agent runs, gates, path status. Nothing else is state.
- **No simulated money.** `money.in` is rejected without evidence (an invoice id, a Stripe charge, a bank line).
- **Quests are projections, not checkboxes.** There is no "mark complete". A quest is done when the ledger proves it, and it cites the lines that did.
- **Agents spend real money and say so.** Every model iteration writes its reconciled cost to the ledger. Runs stop at a per-run cap, and each path has a real budget it cannot exceed.
- **Agents never contact anyone.** They log evidenced prospects and write drafts to an outbox. A human sends.
- **Gates are legal, not cosmetic.** Paths that stand on day-job expertise are blocked from agent spend until the employment-agreement gate is cleared with evidence.

## Run it

Requirements: Node 22+. One dependency (`@anthropic-ai/sdk`).

```bash
cd revenue-engine
npm install
npm test                       # 44 tests, zero spend (replay provider)
REVENUE_ENGINE_DATA=./demo node src/cli.js seed-demo   # optional: labeled fake data to preview the station
node src/cli.js status         # headline numbers, level, open quests
node src/cli.js paths          # the catalog
node src/cli.js serve          # station at http://127.0.0.1:8790, money at /ledger, scheduler on
```

Set `ANTHROPIC_API_KEY` (or log in with `ant auth login`) before a live run:

```bash
node src/cli.js gate employment-agreement --cleared --evidence "read 2026-09-26; no non-compete, moonlighting allowed"
node src/cli.js run prospector --path local-growth-bundle --max-usd 2
node src/cli.js run outreach   --path local-growth-bundle --max-usd 1
node src/cli.js run pricing    --path show-rate-engine    --max-usd 1
node src/cli.js log-in 250 --path local-growth-bundle --source "Example Salon" --evidence "Square invoice 0001"
```

A dry run with no key and no spend:

```bash
node src/cli.js run prospector --path local-growth-bundle --provider replay --script replay/prospector-demo.json
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
node src/cli.js job add prospector --path local-growth-bundle --every 72 --max-usd 1
node src/cli.js jobs
```

`serve` runs a scheduler that checks jobs every minute. It never runs a job twice at once, stops dispatching after `--daily-cap` dollars in a day (default $5), and every gate, kill switch and path budget still applies.

## The money loop

1. Jobs put drafts in the outbox. The dashboard lists them with a copy button.
2. You publish or send. Agents never post or email anyone.
3. Log the live URL: `node src/cli.js post content-channel --platform linkedin --url https://... --title "..."`
4. When money arrives, log it with evidence and, if a post earned it, the post id: `log-in 42.50 --path content-channel --source "Affiliate" --evidence "payout 77" --post <id>`
5. The dashboard shows earned, spent, net and yield by path, month, platform and post.

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
src/inbox.js      the job inbox: posts to score and won jobs to fulfill
src/demo.js       labeled demo data (refuses a real ledger)
src/server.js     localhost HTTP: station, /ledger, /api/state, /api/events, /api/run, /api/runs, /api/jobs, /api/outbox
src/station.html  the pixel-art station (canvas, no assets, every object bound to ledger state)
src/dashboard.html  the money dashboard
src/cli.js
test/             node:test, zero spend
replay/           scripted runs for tests and dry runs
```

## What is deliberately missing

- No auto-posting or auto-emailing. Sending to real people under your name stays your action until you decide otherwise.
- No XP, no streaks, no levels for agents. The only level is the operator's, and it is denominated in dollars.
- No automatic sending. Outreach drafts sit in the outbox until a human sends them.
