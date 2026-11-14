#!/usr/bin/env python3
"""
brain_gate.py — Claude Code hooks that make the Brain read/write rules run on
their own instead of depending on a session remembering them.

  SessionStart  prints the read gate (root MAP query, brief and PROTOCOL LIVE
                ids) into the session's context. If a brain-mirror clone is on
                disk, it also names the newest root MAP and LIVE docs it holds.
  Stop          once per session, if the session did real work (3+ tool calls)
                and made no Brain write, blocks the stop with one reminder to
                write the doc. It never blocks twice, so it cannot loop.

Usage in settings.json:  python3 <path>/brain_gate.py start | stop
Stdlib only; any error exits 0 so a broken hook never blocks a session.
"""
import json
import os
import sys
from pathlib import Path

FOLDER = "1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn"
BRIEF = "1rP3niqTY1RU7TILKimogE4_xS4mjjcv3"
WRITE_TOOLS = ("Google_Drive__create_file",)
MIN_TOOL_CALLS = 3
MIRRORS = [Path("/home/user/brain-mirror"), Path.home() / "brain-mirror"]


def newest(index, keep):
    """Newest INDEX.tsv row (by created) whose title passes keep()."""
    best = None
    for line in index.read_text(encoding="utf-8").splitlines()[1:]:
        cols = line.split("\t")
        if len(cols) >= 6 and keep(cols[5]) and (best is None or cols[3] > best[3]):
            best = cols
    return best


def start():
    lines = [
        "BRAIN READ GATE (hook): before the first substantive answer, read the Brain "
        f"(Google Drive folder {FOLDER}). Load the Drive tools with ToolSearch "
        '"select:mcp__Google_Drive__search_files,mcp__Google_Drive__read_file_content,mcp__Google_Drive__create_file" if deferred.',
        f"1. Newest root MAP: parentId = '{FOLDER}' and title contains 'MAP' and title contains 'root' "
        "and not title contains 'META' and not title contains 'INBOX'.",
        f"2. observatory-brief.json by ID {BRIEF}; its protocolLive field names the rulebook.",
        "3. PROTOCOL LIVE doc named there: follow it as the rulebook.",
        "Before the session ends, write at least one Brain doc (create_file, append-only).",
    ]
    for mirror in MIRRORS:
        index = mirror / "INDEX.tsv"
        if index.exists():
            root = newest(index, lambda t: t.startswith("[MAP]") and "ROOT" in t.upper())
            live = newest(index, lambda t: t.startswith("[PROTOCOL]") and "LIVE v" in t)
            got = [f"root MAP {root[0]} ({root[2]})" if root else "", f"PROTOCOL LIVE {live[0]} ({live[2]})" if live else ""]
            lines.append(f"Local mirror {mirror} (git copy, may lag Drive by up to a day; `rg` over docs/ is deterministic search): "
                         + ", ".join(g for g in got if g) + ".")
            break
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "\n".join(lines)}}))


def stop():
    event = json.load(sys.stdin)
    if event.get("stop_hook_active"):
        return
    marker = Path(os.environ.get("TMPDIR", "/tmp")) / f"brain-gate-{event.get('session_id', 'x')}.nudged"
    if marker.exists():
        return
    transcript = Path(event.get("transcript_path", ""))
    if not transcript.is_file():
        return
    calls, wrote = 0, False
    for raw in transcript.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            msg = json.loads(raw).get("message", {})
        except ValueError:
            continue
        content = msg.get("content") if isinstance(msg, dict) else None
        for block in content if isinstance(content, list) else []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                calls += 1
                if any(t in block.get("name", "") for t in WRITE_TOOLS):
                    wrote = True
    if wrote or calls < MIN_TOOL_CALLS:
        return
    marker.touch()
    print(json.dumps({
        "decision": "block",
        "reason": (f"Brain write check (hook, shown once per session): this session made {calls} tool calls and no Brain write. "
                   f"If anything durable came out of it, write it now as a new doc in Drive folder {FOLDER} "
                   "(title: [TYPE] YYYY-MM-DD — conclusion | tags: ...). If nothing durable did, write a 3-6 line [INBOX] doc. "
                   "Then finish your reply as you were going to."),
    }))


if __name__ == "__main__":
    try:
        {"start": start, "stop": stop}[sys.argv[1]]()
    except Exception:
        pass
    sys.exit(0)
