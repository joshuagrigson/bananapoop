# Command Deck

A Claude Code mod: a pane beside the chat showing Joshua's working state.

- **HANDS QUEUE** — by-hand items with age; amber two days before, red OVERDUE past 7 days.
- **BRAIN HEALTH** — root MAP age (red past 2 days), Observatory status, PROTOCOL LIVE version, docs in 24h.
- **PROJECTS + COUNTDOWNS** — one status line per project; dated items sorted by days left.
- **REPO** — branch, uncommitted files, last 5 commits; refreshed every 60 s by the mod itself.

A mod can't call Drive, so the Brain sections are filled by Claude through the tool the mod registers,
`mcp__command-deck__update_deck`, after the Brain read gate. The last snapshot is kept in `$.store`.
`/deck` reopens the pane and refreshes the repo section.

## Wake-Up (v0.2)

Each system prompt gets a `command-deck:wake-up` section built from the last saved snapshot: the projects, what's waiting on Joshua, what's coming up, the last build, the last miss, and a note from the last session to the next one. That way Claude starts each session already holding the thread. It is labelled VOLATILE, the Brain read gate still runs first, and the newest MAP wins. Tests: `claude plugin test mods/command-deck`.

## Load it

```bash
claude --plugin-dir mods/command-deck
```

Check it: `claude plugin validate mods/command-deck`.
