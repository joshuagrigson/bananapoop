# Robinhood Desk

Joshua's long-term investing desk. Claude reads the Robinhood accounts through Robinhood's official
agent connection (MCP), sweeps what a senior analyst watches, and tells Joshua what to buy or sell,
when, and why. It never places an order; the Agentic account keeps trade approvals on.

Opened 2026-10-26. Horizon: 3 to 10 years. Universe: the whole US market plus Joshua's watchlists.

## Pieces

| Piece | Where it lives | Id / name |
|---|---|---|
| Robinhood agent connection | claude.ai connector "Robinhood Trading" | https://agent.robinhood.com/mcp/trading |
| Agentic account (trades only here, approvals ON, unfunded) | Robinhood | nickname MCP, ends 9923 |
| Saved screen: long-term quality | Robinhood Legend scans | "Desk: Long-term quality", scan b6e4df84-cc5c-41d6-b081-3648adbae2ac |
| Market-shock alerts (Robinhood pushes to phone) | Robinhood alerts | SPY crosses 50-day SMA, SPY crosses 200-day SMA, QQQ crosses 50-day SMA |
| Hourly sweep | claude.ai Scheduled task | prompt in `sweep-prompt.md`; weekdays 7:35am to 3:35pm Central |
| Ledger | Google Sheet in the Brain folder | "[LEDGER] Robinhood desk" |
| Sweep state | Brain docs | newest "[DESK-STATE] ..." |
| Plan | Brain doc | [DECISION-PENDING] 2026-10-26 Robinhood desk v2 |

## Screen definition

Stocks only, market cap over $10B, return on equity over 15%, operating margin over 15%,
forward P/E between 5 and 25, PEG between 0 and 2. 123 matches on 2026-10-26.

## Rules the sweep applies

- Long-term money. Staged entries: never more than a third of planned size at once.
- No new buy in the 2 trading days before that company's earnings.
- Core ETFs (VTI, VXUS, SCHD) are dollar-cost-average by default.
- A BUY on a single stock needs two independent pieces of evidence (valuation, fundamentals,
  catalyst, insider or analyst action).
- A SELL needs a thesis break, not a price dip.
- Nothing changed and nothing fired means "no change", not a message.

## Kill switch

Every call is scored against holding the S&P at 5, 20 and 60 days. If the calls do not beat
holding after 60 days, the rules change or the desk shuts.
