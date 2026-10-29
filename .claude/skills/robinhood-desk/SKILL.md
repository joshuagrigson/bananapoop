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
  `Buy now`, `Growth`, `Dividend`, and `Desk: Winter + FORTRESS` watchlists. The last one
  (list id `5cda8c9f-a335-4734-b442-3ff233396534`) is thematic: backup power, grid hardening,
  Texas power, water, storm retail. Names there are watch-only unless one falls 15% or more from
  its 52-week high and passes the step 4 valuation gate; then it is a candidate like any other.
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

## Paper account (the proof)

Joshua gave the desk $500 of play money on 2026-10-27 to prove the analytics before real money.
Every call the desk makes is executed as a PAPER fill, never a real order.

- Ledger sheet (read only, never edit): `[PAPER] Robinhood desk paper account`, id
  `1ROWFH4VLrm425Sk3fHx6ycXeBR8WLpHbPQ-ynM00lM0`.
- Current holdings live in the newest `[PAPER-STATE]` doc in the Brain folder. Read it in step 1.
- Benchmark: $500 of SPY bought at the same moment the account opened (0.649587 sh at 769.72).
- Sizing on $500: core target $350 (VTI 75% / VXUS 25%) entered in three tranches; satellite
  sleeve $150, up to 5 names, $30 each, entered in thirds ($10 lots). Fractional shares to 6
  decimals. No commissions. Fill price = the live quote at the time of the sweep (regular-session
  last trade; if after hours, the official close).
- Every call in step 4 that is a BUY, SELL, or TRIM becomes a fill in the same sweep, under the
  same rules (earnings blackout, valuation gate, thirds, 5% cap of the paper NAV at cost).
- Every sweep, changed or not, computes paper NAV (cash + holdings at live quotes), its return
  since open, the SPY benchmark's return, and the gap. Add one line to the final reply even on a
  "no change" day: `Paper $<nav> (<signed % since open>) vs SPY <signed %>, gap <signed pts>.`
- Every fill writes a doc titled `[PAPER-FILL] YYYY-MM-DD <ticker> <BUY|SELL> $<amount> @ <price>`
  with one CSV line: `date,time_ct,ticker,side,dollars,shares,price,cash_after,reason,call_doc`.
  The nightly cycle merges fills into the sheet.
- The `[PAPER-STATE]` doc is rewritten (as a new doc) in step 6 whenever a fill happens, carrying
  the full holdings table, cash, NAV, benchmark, and the scoreboard below.

Scoreboard (carried in every [PAPER-STATE]): days since open, NAV return, SPY return, gap, max
drawdown of each, number of calls, hit rate (calls that beat SPY over their own holding period).

Graduation test, read at 60 trading days (about 2027-01-23): the desk earns real money only if
the paper NAV beat SPY after the same period AND its max drawdown was no worse than SPY's by more
than 2 points AND at least 6 single-stock calls were scored. Failing any one means the rules
change and the clock restarts. Nobody softens this.

## Swing account (the second proof)

A second $500 paper account, opened 2026-10-29, whose goal is short-term gains. Separate holdings,
cash, benchmark and scoreboard from the long-term paper account. Never mix the two.

- Ledger sheet (read only, never edit): `[PAPER-SWING] Robinhood desk swing account`.
- Holdings live in the newest `[PAPER-SWING-STATE]` doc. Read it in step 1 with the other state.
- Benchmark: $500 of SPY at the open of the account (0.651424 sh at 767.55).

Rules:
- Max 5 positions, $100 each, $500 total. No options, leverage, or shorting.
- Setups allowed, and only these: (a) post-earnings drift: a beat on EPS and revenue with a gap up
  of 2% or more, entered the same or next sweep; (b) momentum: a close at a 20-day high on volume
  at least 1.5x its 30-day average; (c) mean reversion: a name from the quality screen down 8% or
  more in a day on news that does not touch the thesis.
- Every position carries three exits set at entry: stop at -5%, target at +8%, time stop at 10
  trading days or the sweep before that company's earnings, whichever comes first.
- Exits are checked at every sweep against the live quote. A stop or target that was crossed
  fills at the live quote when the sweep sees it, not at the stop price. Record the slippage.
- Max 2 new entries per sweep. No entries in the sweep right before a scheduled macro release.
- Four closed losers in a row pauses new entries until the next Monday's morning sweep.
- Every fill (entry or exit) writes `[PAPER-SWING-FILL] YYYY-MM-DD <ticker> <BUY|SELL> $<amount> @
  <price>` with one CSV line: `date,time_ct,ticker,side,dollars,shares,price,stop,target,time_stop,
  cash_after,setup,reason,pnl_if_exit`. Every fill also rewrites `[PAPER-SWING-STATE]` as a new doc.
- Every sweep adds a second line to the final reply, after the long-term line:
  `Swing $<nav> (<signed % since open>) vs SPY <signed %>, <n> open, <w>/<l> closed.`

Scoreboard (in every [PAPER-SWING-STATE]): NAV return, SPY return, gap, open and closed trade
counts, win rate, average win vs average loss, max drawdown, worst slippage.

Graduation test at 60 trading days (about 2027-01-27): win rate 55% or better AND average win
larger than average loss AND NAV ahead of SPY by 3 points or more AND max drawdown under 10%.
Failing any one closes the swing desk and the finding is recorded as the result.

## Kill switch

Every call is scored against holding the S&P at 5, 20, and 60 days. If the calls do not beat
holding after 60 days, the rules change or the desk shuts. The state doc carries that scoreboard
forward once rows exist.
