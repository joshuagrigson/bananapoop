---
name: robinhood-desk
description: Run one sweep of Joshua's Robinhood desk. Use whenever a scheduled task or a message says to run the desk sweep (morning, midday, close, or on an event). Reads the accounts through the Robinhood connector, sweeps what a senior analyst watches, decides BUY/SELL/TRIM/HOLD calls under fixed rules, escalates real decisions to a stronger model, reports to Joshua's phone only when something changed, and writes the desk state to the Brain so the next sweep starts from it.
---

# Robinhood desk sweep

Joshua is a long-term investor (3 to 10 year horizon). He wants to be told what to buy or sell
and when, with the evidence a senior analyst would use, and to hear about it the moment something
big shifts the market. He watches the whole market for new buys, not just what he holds. The desk
never places an order and never changes the approval setting.

One sweep = the seven steps below, in order. Do not skip step 6 even when nothing changed.

## Fixed ids

| Thing | Value |
|---|---|
| Brain folder (Google Drive) | `1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn` |
| Plan doc | `15W-9qUG2Lfetk3NE6BwQLqab7fbxWQYJpv__kOR2O7Y` |
| Ledger sheet (read only, never edit) | `1BmHYqNavHV8yKZ6lkMExTVyDmf95yU8E3IzyiwqcXoA` |
| Saved screen in Robinhood | title `Desk: Long-term quality`, scan `b6e4df84-cc5c-41d6-b081-3648adbae2ac` |
| Agentic account | nickname `MCP`, ends 9923, approvals ON |
| Market-shock alerts (Robinhood pushes these itself) | SPY crosses 50-day SMA, SPY crosses 200-day SMA, QQQ crosses 50-day SMA |

## Step 0. Tools

If the Robinhood Trading or Google Drive tools are deferred, load them with ToolSearch:

```
select:mcp__Robinhood_Trading__get_accounts,mcp__Robinhood_Trading__get_portfolio,mcp__Robinhood_Trading__get_equity_positions,mcp__Robinhood_Trading__get_equity_quotes,mcp__Robinhood_Trading__get_earnings_calendar,mcp__Robinhood_Trading__get_equity_analyst_ratings,mcp__Robinhood_Trading__run_scan,mcp__Robinhood_Trading__get_alert_log,mcp__Robinhood_Trading__get_watchlists,mcp__Robinhood_Trading__get_watchlist_items
select:mcp__Google_Drive__search_files,mcp__Google_Drive__read_file_content,mcp__Google_Drive__create_file
```

If a connector is absent after that, say so in the final line and do the rest with web search.
Large Robinhood results (earnings calendar, scans) are saved to a file; use `jq` on it, never
read it whole.

## Step 1. Load the last state

Search the Brain folder for the newest doc whose title starts `[DESK-STATE]` and read it. It
holds the open calls, the watch items, and what the last sweep thought. Read the plan doc only on
the first sweep of the week or if the state doc points to it. Never re-search a topic twice in one
sweep.

## Step 2. Read the accounts

`get_accounts`, then `get_portfolio` and `get_equity_positions` for every account. Report cash,
positions, and unsettled funds. The Agentic account is the only one the agent can trade in, and it
is never traded by this skill. Never place an order. Never change approvals.

## Step 3. Sweep

Robinhood side:
- `get_equity_quotes` on `SPY QQQ IWM VTI VXUS SCHD`, every held symbol, and every symbol on the
  `Buy now`, `Growth`, and `Dividend` watchlists.
- `get_earnings_calendar` for today and tomorrow with `filter=high_market_cap`.
- `run_scan` on the saved screen. Note names that entered or left since the last state.
- `get_alert_log` for fired alerts.
- `get_equity_analyst_ratings` on anything that moved more than 3%.

Web side (WebSearch, standard mode), looking for what a sell-side strategist would flag today:
- Today's macro releases and Fed news (FOMC, CPI, PCE, jobs, GDP, Treasury yields, VIX, oil).
- Any S&P move over 1.5% intraday and why.
- Earnings reactions and guidance changes on held, watchlisted, or candidate names.
- SEC 8-K, insider Form 4 buys, analyst upgrades or downgrades on those names.
- Credit spreads, geopolitics, tariffs, fiscal deadlines if anything moved.

Compare everything to the last state. The output of this step is "what changed", not a market
recap.

## Step 4. Decide

Produce 0 to N calls. Each call: ticker, action (BUY / SELL / TRIM / HOLD / WAIT), price, the
evidence, confidence 1 to 5, and the condition that flips it.

Rules:
- Long-term money. Staged entries: never more than a third of planned size at once.
- No new buy in the 2 trading days before that company's earnings.
- Core ETFs (VTI, VXUS, SCHD) are dollar-cost-average by default. A broad drawdown over 5%
  accelerates core buys, not single stocks.
- A BUY on a single stock needs two independent pieces of evidence: valuation, fundamentals,
  catalyst, insider or analyst action.
- A SELL needs a thesis break, not a price dip.
- Valuation gate for new money: forward P/E at or below the stock's 5-year median, or PEG under 2.
- No single stock over 5% of the portfolio at cost. Core stays at least 70%.
- Defensive mode (SPY below its 50-day, high-yield spread above 400bp, a surprise hike, Brent
  above $130): keep core buys, pause single-stock buys, sell nothing.
- If nothing changed since the last state and no event fired, the correct output is "no change".

Escalation: if any trigger in step 5 fires, or you are about to issue a new or changed call, hand
the decision to a subagent run with model opus. Give it the step 3 findings and the last state and
use its call. Do not escalate for "no change".

## Step 5. Report

Triggers that mean Joshua hears about it: a new or changed call; the S&P moved more than 1.5%
intraday; a held, watchlisted, or candidate name moved more than 5%; a market-shock alert fired.

- If a trigger fired: the final reply is a message under 200 words. First sentence is the call.
  Then up to three bullets of why, then the flip condition. That final reply is what reaches his
  phone as the push notification.
- If nothing fired: the final reply is one line and nothing else:
  `Desk sweep <time CT>: no change. SPY <price> (<signed %>).`

## Step 6. Write (every run)

Create a new Google Doc in the Brain folder. Never edit an existing doc or the ledger sheet.

1. State doc, every run, changed or not. Title:
   `[DESK-STATE] YYYY-MM-DD HH:MM CT — <one-line conclusion> | tags: robinhood, desk, state`
   Body: market snapshot (SPY, QQQ, 10-year, VIX, oil, anything that moved), accounts, open
   calls, candidates with their next catalyst date, watch items for the next sweep, what fired.
   Under 1500 words.
2. One ledger row per new or changed call. Title:
   `[LEDGER-ROW] YYYY-MM-DD <ticker> <call> <price>`
   Body, one CSV line:
   `date,ticker,call,price_at_call,spy_at_call,thesis,confidence,flip_condition,catalyst_date`
   The nightly cycle merges rows into the ledger sheet.

Never store credentials or account numbers in a doc.

## Kill switch

Every call is scored against holding the S&P at 5, 20, and 60 days. If the calls do not beat
holding after 60 days, the rules change or the desk shuts. The state doc carries that scoreboard
forward once rows exist.
