# desk-listener

Always-on tripwire for the Robinhood desk. Watches EDGAR 8-Ks, price moves,
news and the macro calendar for the universe, and wakes a Claude scheduled
task (its API trigger) so a sweep runs the minute something big happens,
instead of waiting for the 8:05 / 12:05 / 4:05 runs.

Cost: one Render background worker, Starter plan (~$7/mo). Not deployed until
Joshua says so (billing starts 2026-11-05).

## Deploy (Render)

1. claude.ai → Scheduled tasks → New task → add an **API** trigger on a task
   named `Robinhood desk sweep - event` with the same prompt as the other
   three. Copy its URL (and token if shown).
2. Render → New → Blueprint → this repo → it reads `desk-listener/render.yaml`.
3. Set env vars `CLAUDE_TRIGGER_URL` and (if given) `CLAUDE_TRIGGER_TOKEN`.
   `SLACK_WEBHOOK_URL` is optional.
4. Deploy. Logs should show `cik map: {...}` with all seven tickers.

## Dry run locally

```
cd desk-listener
pip install -r requirements.txt
DRY_RUN=1 ONCE=1 python listener.py
```

## Tuning

| Var | Default | Meaning |
|---|---|---|
| PRICE_MOVE_PCT | 3.0 | wake when a universe stock is ±3% vs prior close (market hours only) |
| INDEX_MOVE_PCT | 1.5 | same for SPY/QQQ |
| POLL_SECONDS | 120 | loop interval |
| MAX_WAKES_PER_HOUR | 4 | hard cap on sweeps fired |

Add macro dates to `macro_calendar.json` (ET, ISO format). A wake fires
within 10 minutes after each.
