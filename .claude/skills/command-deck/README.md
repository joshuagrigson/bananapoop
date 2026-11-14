# Command Deck

A Claude Code mod: a pane beside the chat showing Joshua's working state.

- **HANDS QUEUE** — by-hand items with age; amber two days before, red OVERDUE past 7 days.
- **BRAIN HEALTH** — root MAP age (red past 2 days), Observatory status, PROTOCOL LIVE version, docs in 24h.
- **PROJECTS + COUNTDOWNS** — one status line per project; dated items sorted by days left.
- **REPO** — branch, uncommitted files, last 5 commits; refreshed every 60 s by the mod itself.

A mod can't call Drive, so the Brain sections are filled by Claude through the tool the mod registers,
`mcp__command-deck__update_deck`, after the Brain read gate. The last snapshot is kept in `$.store`.
`/deck` prints the whole deck as text (the mobile app draws no mod panes, but it shows command output) and opens the pane where the surface has one. A one-line band above the prompt shows overdue HANDS and the next countdown.

## Wake-Up (v0.2)

Each system prompt gets a `command-deck:wake-up` section built from the last saved snapshot: the projects, what's waiting on Joshua, what's coming up, the last build, the last miss, and a note from the last session to the next one. That way Claude starts each session already holding the thread. It is labelled VOLATILE, the Brain read gate still runs first, and the newest MAP wins. Tests: `claude plugin test .claude/skills/command-deck`.

## Extras (v0.4)

- **Timer** (every 5 min): toasts when a HANDS item crosses into overdue (once a day per item), and nudges when no Brain write has happened for 45 min of an active session.
- **Subagent type** `command-deck:brain-reader`: does the Brain read gate (root MAP, observatory brief, PROTOCOL LIVE version) with Drive read tools only, and returns the JSON for `update_deck`, so the big docs stay out of the main context.
- **System prompt** `command-deck:session`: Brain writes this session, whether one is owed, and a pointer to the brain-reader.
- **Toasts**: Brain doc saved, git push landed or failed, tests passed or failing.

## Load it

Every Claude Code session opened in this repo loads it automatically from `.claude/skills/command-deck` (on the branch the session starts from). Elsewhere:

```bash
claude --plugin-dir .claude/skills/command-deck
```

Check it: `claude plugin validate .claude/skills/command-deck`.
