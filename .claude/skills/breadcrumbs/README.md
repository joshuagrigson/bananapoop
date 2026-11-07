# Breadcrumbs

A Claude Code mod: one-line lessons pinned to files. Whenever Claude reads or edits a file (Read, Edit, Write, NotebookEdit), every live breadcrumb pinned to that file, or to a folder above it, arrives with the result. Claude sees it the moment it matters instead of having to remember to search.

- `leave_breadcrumb` (a tool for Claude): a repo-relative path (a folder ends in `/`) and one plain line.
- `retire_breadcrumb`: marks one as no longer true. It stays in the file, marked retired, so history is kept.
- `/crumbs`: lists every live breadcrumb, grouped by path.
- Each note shows its date, the commit it was written at, how many commits have touched the file since, and `OLD` past 60 days, so a stale lesson shows its age.

Storage is `.claude/breadcrumbs.json` in the repo itself, so the notes reach every session and machine once committed.

Every session in this repo loads it from `.claude/skills/breadcrumbs` (on the branch the session starts from). Tests: `claude plugin test .claude/skills/breadcrumbs`.
