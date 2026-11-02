# Command Deck

A Claude Code mod: a pane beside the chat showing Joshua's working state.

- **HANDS QUEUE** — by-hand items with age; amber two days before, red OVERDUE past 7 days.
- **BRAIN HEALTH** — root MAP age (red past 2 days), Observatory status, PROTOCOL LIVE version, docs in 24h.
- **PROJECTS + COUNTDOWNS** — one status line per project; dated items sorted by days left.
- **REPO** — branch, uncommitted files, last 5 commits; refreshed every 60 s by the mod itself.

A mod can't call Drive, so the Brain sections are filled by Claude through the tool the mod registers,
`mcp__command-deck__update_deck`, after the Brain read gate. The last snapshot is kept in `$.store`.
`/deck` reopens the pane and refreshes the repo section.

## Load it

```bash
claude --plugin-dir mods/command-deck
```

Check it: `claude plugin validate mods/command-deck`.
