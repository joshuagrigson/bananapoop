# Brain Guard

A Claude Code mod that enforces Joshua's three HARD LIMITS in code instead of relying on memory:

- **(a) irreversible destruction**: force-push, remote branch delete, `git reset --hard`, `git clean -f`, `git branch -D`, discarding changes, recursive `rm` outside `/tmp`/`node_modules`/`dist`/`build`, `find -delete`, Drive trash, mail delete, doc/artifact/Cloudflare/Higgsfield deletes, scheduled task deletes.
- **(b) real money**: Robinhood orders and option exercise; Higgsfield credit-spending generation.
- **(c) messaging someone else**: Gmail send/reply/forward unless every recipient is jsgrigson@gmail.com; Slack posts unless to U09A11P5S15; Zapier write actions; public publishing.

A matching call stops and asks Joshua in a dialog. **Yes, run it** lets that one call through. **No**, or a dismissed dialog, blocks it, and Claude is told not to route around the block. If the guard's own check throws, the call is blocked (fail closed). Every stop is logged; `/guard` shows the last 15. A system prompt section tells Claude the guard exists.

`--force-with-lease` and drafts are allowed on purpose.

```bash
claude --plugin-dir mods/brain-guard
```

Tests: `claude plugin test mods/brain-guard`.
