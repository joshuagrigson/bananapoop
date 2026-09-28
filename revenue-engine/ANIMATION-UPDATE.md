# Station visuals, layout and research update

Based on `claude/amazing-edison-n9ydsa` at `7b87cee`.

## Quieter production

- Outbound production represents grouped sales, with at most two traveling items per ordinary room and a global cap of 36.
- Density increases only at 10,000 sales/day; logarithmic scaling and an eight-item room ceiling keep even extreme production bounded. Normal-room emission intervals are roughly 14-28 seconds. Repeated sale effects aggregate into one amount-bearing batch at most every 15 seconds.
- Conveyor spacing is eight world units normally (previously 1.25), scaling down gradually only at extreme volume. Stored pallet goods also use logarithmic sales volume.
- Rounded cargo corners, consistent speed, gentle bobbing, smoother vault entry, smaller silhouettes and restrained trails/glow. Conveyor items keep their appearance when entering a new segment instead of changing at each loop. Medium zoom now draws the themed products instead of dots. All twelve worlds use the shared improved renderer.
- Revenue accounting and simulation outcomes are unchanged by visual batching.

## Room design and growth

Click a room to choose its shape. Double-click a room or its label, or choose Arrange rooms, to open the jiggling layout editor. Drag to swap positions, tap an empty plot to move, or use arrow keys. Save persists the layout; Cancel discards it. The editor uses ten plots, with the vault and dock fixed.

Shapes: square, wide, tall, circle and L-shaped courtyard. Illustrated maps follow saved room positions and show extensions. Profit thresholds of $50, $100, $250, $500, $1,000 and $2,500 add animated annexes and visual workers; race growth uses simulated profit. These are visual indicators, not real hiring or construction.

## Resident research agents

The Node server has a durable research queue and one persistent identity per room. Enabling research makes each new simulation queue a fresh web investigation, business ideation and market testing for each contestant. Agents retain summaries from earlier races, but must collect fresh source URLs. Runs proceed serially, display status/cost, and can stop after the current API request. Restarted servers mark interrupted runs rather than silently repeating paid work.

Live research is OFF by default. The Netlify/static preview runs prerecorded demos and clearly labels them. No paid API call was made during this work; queue tests use injected test providers. Live integration has not been verified against a paid account.

To activate on a trusted local server:

1. In `revenue-engine`, install dependencies with `npm ci`.
2. Configure `ANTHROPIC_API_KEY` in the server environment (never in browser code). Optionally set `REVENUE_ENGINE_DATA` to a separate data directory.
3. Run `node src/cli.js serve --no-scheduler --port 8790` and open `http://127.0.0.1:8790`.
4. Open Research settings from a room or race, choose the total API budget target, enable research, and start a new simulation.

The default target is $8/race, split across contestants. An in-flight response can exceed that target. Set provider account spending limits for an account-level ceiling. Model token charges and web-search calls are included; provider pricing may change. Simulated revenue does not pay the API bill. A static Netlify upload cannot run the resident research backend; hosting that backend requires separate setup.

## Animation and map polish

Twelve-frame articulated walk, carry, work, idle and cheer cycles cover twelve worlds and seven species. Walking cadence follows distance, with acceleration and easing at destinations. Atlases build incrementally and use a 128 MiB LRU cache. Far rooms refresh oldest-first under an adaptive budget rather than the old 350ms interval. Illustrated maps gain contact shadows, bevels, paving seams, ambient light and gentle drifting motes. Reduced-motion preferences disable the new character/map cycles and slow cargo traffic. Device frame rates have not been benchmarked.

## Verification and delivery

104 Node tests pass, including traffic bounds/scaling, shape persistence, rejected plots, map navigation/extensions, research identity/memory/cancellation, and token/search cost accounting. Syntax checks and the static build pass. Browser checks exercised shape saving, layout moves, reload persistence and double-click arrangement. Fixed delayed mock startup so it can recover from the read-only fallback.

Build: `node scripts/build-preview.mjs` from `revenue-engine`.
Tests: `node --test --test-isolation=none test/*.test.js`.

The source ZIP includes all edited code and tests. The preview ZIP is a static Netlify-ready build. No GitHub branch has been pushed and the public Netlify deployment has not been changed.
