# STARNET, read for the money question — 2026-09-25

**Question:** Look at ANDROOagi/STARNET, a gamified way to use agents to make $100K-1M as fast as possible. How can we improve it and implement it to do the same?

**Short answer:** STARNET is not a money machine and does not claim to be one. Its predecessor was exactly that fantasy, and the author killed it on purpose. What is worth taking is the *honesty machinery* (truthful telemetry, quests as predicates over real events, levels that cite their evidence) and pointing it at revenue instead of deliverables. That is what `revenue-engine/` does.

## What STARNET actually is

Cloned at commit `7ee93ce` (2026-09-23), 43,201 files, MIT code, brand reserved by Andrew Sims.

- A local-first desktop harness (Tauri shell, Node sidecar on :8787, vanilla-JS frontend) where you create AI agents, place them in a pixel-art space station, and the layout *is* the permission model: a room is a capability scope, a placed prop is a real tool grant.
- Lineage matters: UltronOS (banned from the Claude API 2026-04-04) → "v7", a *fake* sim where Etsy stores, Fiverr gigs and SaaS MRR were conjured from dice every minute → StarNet, which deleted the fake economy. The README says it outright: "StarNet does not simulate revenue."
- The core law, repeated in `DECISIONS.md`: the interface must never assert state the harness cannot prove.
- The gamification (`docs/rpg-layer-design.md`) is the management UI wearing a game: stats are reducers over the event log, a quest is a predicate over real events with no "complete" button, a level is a real budget ceiling, loot is the actual file on disk, and every stat drills down to the run that earned it. Streak freezes, re-engagement pings and progress bars that lerp to 100% are banned by policy.
- `docs/LIFE_GOAL_PROGRESSION_2026-09-05.md`: Commander level tracks progress toward *life goals* with evidence receipts, and "completing a plan does not assert that the real-world goal has been achieved."
- `docs/ROADMAP_2026-07-04_BRUTAL.md`, in the author's own words: zero users, revenue structurally impossible, the product over-built and under-launched. The only revenue plan is reselling API credits.

## The strongest case against the premise

Someone spent months building a gamified agent harness, shipped 84 props, 28 skills, recipes, routines, autonomy tiers, voice and themes, and wrote down that nobody outside the room had ever run it and no dollar could be produced. A gamified agent station is a *cost center with a dopamine loop*. Money comes from a buyer paying for an outcome; agents are leverage on the sales and delivery work, never the source of revenue. If the goal is $100K as soon as possible, the fastest path in the Brain is still the boring one: a retainer sold to a contact center this month, not a station.

## What to take, and what to change

| Keep from STARNET | Change for the money goal |
|---|---|
| Truthful telemetry: every number cites a ledger line | The ledger records **dollars in and dollars out**, not deliverables |
| Quests as predicates, no manual complete | Quests are **stage gates per path** (prospect → conversation → demo → pilot → paid → retained) and a **money ladder** ($1 → $1K → $10K → $100K → $1M) |
| Commander level with evidence receipts | Level is denominated in **evidenced revenue only**; every rung cites the payment that crossed it |
| Yield ratio (product-$ / spent-$) as the one headline number | Yield = **earned / spent**, undefined (not zero) until something is spent |
| Budget caps the loop enforces | A **real per-path budget** the runner refuses to exceed, plus a per-run cap |
| Boss Approval: a human judges before anything ships | Agents **never send**; drafts go to an outbox a human sends from |
| The `opportunity-scan` skill's rules: every demand claim cites a live page; zero is a valid result | Baked into the prospector's system prompt and enforced by the tool: **no URL, no prospect** |
| Loops as role directives (`loops/*.md`) | Three roles only: prospector, outreach drafter, offer designer |
| The station, sprites, XP, streaks, voice, channels, MCP catalog | **Cut.** One operator does not need a retention device; the 43K-file world becomes 12 files |

Two additions STARNET does not have:

1. **Legal gates.** The Brain's income tournament names one load-bearing unknown: Josh's employment agreement. Paths 1-3 (ops consulting, show-rate engine, managed call QA) are gated; the runner refuses to spend on them until the gate is cleared with evidence. That is a Boss Approval with legal weight.
2. **Kill tests.** Every path carries the cheapest test that proves or kills it, and a killed path stops accepting spend. STARNET tracks failures as "slag"; here a failed kill test frees the budget.

## What was built

`revenue-engine/` — Node 22, one dependency, 30 tests at zero spend. See its README. Seeded with six paths from the two tournaments in the Brain: fractional ops consulting, show-rate engine, managed call QA (all gated), local growth bundle, CoParentHQ, cohort course.

## What was not verified here

- No live model call was made from this sandbox (no API key, no `ant` CLI). The Anthropic path uses the SDK tool runner with server-side refusal fallbacks; the first live run on Josh's machine is the proof.
- STARNET's desktop build was not installed or run. Everything above comes from reading the repo.
- Income figures in the path catalog are estimates from the Brain's tournaments, not measurements.
