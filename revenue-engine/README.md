# Revenue Engine

A small, honest machine for driving one operator from $0 to a first dollar, then $1K, $10K, $100K, $1M. It borrows StarNet's best law (the interface never asserts anything the ledger cannot prove) and points it at revenue instead of deliverables.

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
npm test                       # 31 tests, zero spend (replay provider)
node src/cli.js status         # headline numbers, level, open quests
node src/cli.js paths          # the catalog
node src/cli.js serve          # dashboard at http://127.0.0.1:8790
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

## Roles

| Role | Logs | Web search | Writes |
|---|---|---|---|
| `prospector` | `prospect` outcomes with a live URL each | yes | `outbox/<path>/prospects.md` |
| `outreach` | nothing | no | one draft per logged prospect plus an index |
| `pricing` | nothing | yes | `outbox/<path>/offer-sheet.md` |

Default model is `claude-opus-5`. Pricing lives in `src/cost.js` and is marked volatile; an unpriced model is refused rather than recorded as $0.

## Files

```
src/ledger.js     append-only JSONL, validation, the evidence rule
src/reduce.js     pure reducer: events -> state (dedup, totals, runs, gates)
src/paths.js      the catalog: six paths, stage targets, kill tests, budgets, the gate
src/quests.js     pure projection: gates, stages, ladder, yield
src/level.js      Commander ladder with citations
src/cost.js       model prices (volatile) and cost reconciliation
src/agent.js      roles, tools, the budgeted run loop, replay provider
src/server.js     localhost HTTP: dashboard + /api/state, /api/events, /api/run, /api/runs
src/dashboard.html
src/cli.js
test/             node:test, zero spend
replay/           scripted runs for tests and dry runs
```

## What is deliberately missing

- No pixel-art station, no sprites, no game world. StarNet's world is a retention device for many consumers; for one operator it is overhead. The mechanics stay, the theater goes.
- No XP, no streaks, no levels for agents. The only level is the operator's, and it is denominated in dollars.
- No automatic sending. Outreach drafts sit in the outbox until a human sends them.
- No recurring schedules yet. Run roles by hand until a path has earned its first dollar; automation before revenue is how the last attempt at this went wrong.
