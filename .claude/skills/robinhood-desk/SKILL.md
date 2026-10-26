---
name: robinhood-desk
description: Joshua's Robinhood analyst desk. One sweep = read accounts + ledger, scan the universe, decide against written rules, report, append the ledger. Use for any "desk sweep", "what should I buy/sell", "check my robinhood", or a scheduled market-hours run. Read-only; never places an order.
---

# Robinhood desk — standard operating procedure

Recorded 2026-10-26 from the first live run. Every agent that runs the desk starts HERE, not from zero.
Joshua approved this desk ("we're in robinhood, GO"). Act, don't ask. Call him Joshua.

## 0. Fixed facts (verify only if a call errors)

| Thing | Value |
|---|---|
| Robinhood MCP | connector "Robinhood Trading", tools `mcp__Robinhood_Trading__*` (deferred: load with ToolSearch) |
| Individual (default, cash) | account_number `418812194` |
| Roth IRA | account_number `552655359` |
| Agentic "MCP" account | account_number `928799923` — the only one an agent may trade; crypto flows use rhs_account_number (same digits) |
| Trade approvals | read with `get_trade_approval_setting(928799923)`; only Joshua can flip it, in the mobile app: home tab → account switcher → MCP → tap "Claude" → Safety controls → Trade approvals (not on the web). Turned ON 2026-10-26 18:54 UTC. Desk rule: must be ON before any Phase 2 trading |
| Ledger | Google Sheet "Robinhood Desk Ledger", id `19iCmOpuCKgHWn1oIpzRb1iQyz5cN5ZfpUlkNdtOy2sU`, in Brain folder `1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn` |
| Universe | holdings in all 3 accounts + "Buy now" watchlist (NVDA META AMZN AAPL GOOGL NFLX MSFT) + SPY, QQQ. Other lists: Growth (23), Dividend (18), Crypto (4) |
| Brain | Drive folder `1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn`; append-only, never edit |

## 1. Load tools (one call)

```
ToolSearch "select:mcp__Robinhood_Trading__get_accounts,mcp__Robinhood_Trading__get_portfolio,mcp__Robinhood_Trading__get_equity_positions,mcp__Robinhood_Trading__get_equity_orders,mcp__Robinhood_Trading__get_pnl_trade_history,mcp__Robinhood_Trading__get_trade_approval_setting,mcp__Robinhood_Trading__get_equity_quotes,mcp__Robinhood_Trading__get_equity_fundamentals,mcp__Robinhood_Trading__get_equity_analyst_ratings,mcp__Robinhood_Trading__get_equity_technical_indicators,mcp__Robinhood_Trading__get_earnings_calendar,mcp__Robinhood_Trading__get_watchlists,mcp__Robinhood_Trading__get_watchlist_items,mcp__Google_Drive__search_files,mcp__Google_Drive__read_file_content,mcp__Google_Drive__create_file,WebSearch"
```

A missing tool NAME is not a missing capability: only a failed call with a quoted error supports "can't".

## 2. Read state (all in parallel)

- `get_portfolio` + `get_equity_positions` for all three accounts; `get_equity_orders` since yesterday on the individual + MCP accounts; `get_trade_approval_setting(928799923)`.
- Ledger: `read_file_content` on the sheet id above. Then `search_files` the Brain folder for `title contains '[DESK]'` modified in the last 7 days (appended calls live there, not in the sheet).
- Open calls + flip prices in the ledger are the standing rules. Do not re-derive them.

## 3. Sweep (all in parallel)

- `get_equity_quotes` on the universe (≤20 symbols per call keeps closes).
- `get_equity_technical_indicators` three calls: `sma` period 50 (start ~5 months back), `sma` period 200 (start ~13 months back), `rsi` (start ~3 months back). interval `day`, output `latest`, ≤10 symbols per call.
- `get_equity_fundamentals` (≤10 per call) and `get_equity_analyst_ratings` on the universe.
- `get_earnings_calendar(days=7, filter=high_market_cap)` — the result is ~100 KB and gets saved to a file. Filter it with jq:
  ```
  jq -c '.data.results[] | select(.symbol as $s | ["NVDA","META","AMZN","AAPL","GOOGL","NFLX","MSFT"] | index($s))' <saved-file>
  ```
  Schema per entry: `{symbol, year, quarter, eps:{estimate,actual}, report:{date,timing(am|pm),verified}}`.
- WebSearch, 2–4 calls, `mode: extended` for anything newsy: "stock market today <date>" (name the week's Fed/macro/earnings), any universe ticker moving >3%, any macro release due today (FOMC, CPI, PCE, jobs, GDP). Standard mode returned stale years; extended with the explicit date worked.

## 4. Decide (written rules; no rule, no call)

- A call changes only when: a ledger flip price is crossed on a close; a scheduled catalyst printed (earnings, Fed); or a material event hit (8-K, guidance change, downgrade wave, macro surprise).
- No new entry into a binary event (earnings/Fed) the same day.
- Close below the 200-day SMA = SELL signal. Reclaim of the 50-day SMA = BUY trigger.
- 52-week low + guidance cut = AVOID (no knife-catching).
- Every call carries: BUY / SELL / HOLD / WATCH / AVOID, the evidence, confidence (low/medium/high), the flip price, the catalyst date.
- Market regime row (SPY vs 50/200, RSI, the week's macro) is its own ledger line.

## 5. Report + write (write is the LAST action)

- Nothing changed: final message is ONE line — `Desk sweep <time ET>: no change. SPY <price> (<±%>).` Stop.
- Something changed: first sentence = the changed call. Then ≤3 bullets of why. Then the ledger row.
- Append each new call as a NEW Google Doc in the Brain folder titled
  `[DESK] YYYY-MM-DD HH:MM ET — <ticker> <call> | tags: robinhood, desk, call`
  body = one CSV row in the ledger column order:
  `date,ticker,call,price_at_call,spy_at_call,thesis,confidence,flip_price,catalyst_date,source_session`
- Never edit the ledger sheet or any Brain doc (append-only). Never store passwords or keys. Never place an order (Phase 2 is off until the ledger proves the rules at 5/20/60-day scoring vs SPY and approvals are ON).

## 6. Scheduling (known limit)

`create_trigger` from a cloud session stores NO connectors in this org, so a fired session has no Robinhood or Drive tools. The sweeps therefore live in claude.ai → Scheduled tasks (created by Joshua 2026-10-26), where all connectors are on by default. One time per task, so three tasks share one prompt (sections 1–5 of this file):

| Task | Schedule (ET) |
|---|---|
| Robinhood desk sweep - morning | weekdays 8:05 AM |
| Robinhood desk sweep - midday | weekdays 12:05 PM |
| Robinhood desk sweep - close | 4:05 PM (set to Daily at creation; should be Weekdays) |

The scheduled-task form also offers an **API** trigger ("run when your own code calls it"): that is the hook for the Phase-2 event listener (Render worker polling EDGAR/news) to fire an off-schedule sweep.

## Pitfalls seen on run 1

- `get_earnings_calendar` output overflows the context; always jq the saved file.
- Analyst-rating `updated_at` lags weeks; treat targets as background, not signal.
- The agentic account was opened with approvals OFF even though the plan said ON. Check it every run and say so when it is off.
