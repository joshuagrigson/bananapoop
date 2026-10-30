#!/usr/bin/env python3
"""
mirror.py — pull every doc in the Claude Brain (Google Drive folder) into this
repo as plain text, one file per doc, so git history becomes the drift log and
ripgrep becomes the search.

Layout it writes:
  docs/<driveId>.md     header block (title, lane, created, modified, mime, url)
                        then the exported body (Google Docs -> text/plain;
                        JSON / Markdown / text files downloaded as-is)
  INDEX.tsv             id <tab> lane <tab> date <tab> created <tab> modified <tab> title
  manifest.json         {id: modifiedTime} of what is mirrored, so a nightly run
                        only re-exports docs whose modifiedTime changed

Read-only against Drive. Never writes to Drive. Never deletes a local file for
a doc that disappeared from Drive; it marks it in the header instead, because
the Brain is append-only and a vanished doc is itself a finding.

Auth: a service-account JSON in env GDRIVE_SA_KEY (GitHub secret). The Brain
folder must be shared with the service account's email as Viewer.
"""
import io
import json
import os
import re
import sys
import time
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

FOLDER_ID = os.environ.get("BRAIN_FOLDER_ID", "1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn")
ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
MANIFEST = ROOT / "manifest.json"
INDEX = ROOT / "INDEX.tsv"

GOOGLE_DOC = "application/vnd.google-apps.document"
GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet"
GOOGLE_PREFIX = "application/vnd.google-apps."
EXPORT_AS = {GOOGLE_DOC: "text/plain", GOOGLE_SHEET: "text/csv"}
TEXT_MIMES = ("application/json", "text/", "application/x-ndjson")


def drive():
    key = os.environ.get("GDRIVE_SA_KEY")
    if not key:
        sys.exit("GDRIVE_SA_KEY is not set")
    info = json.loads(key)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def with_retry(fn, tries=5):
    for attempt in range(tries):
        try:
            return fn()
        except HttpError as e:
            status = getattr(e.resp, "status", None)
            if status in (403, 429, 500, 502, 503) and attempt < tries - 1:
                time.sleep(2 ** attempt)
                continue
            raise


def list_folder(svc):
    out, token = [], None
    q = f"'{FOLDER_ID}' in parents and trashed = false"
    fields = "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, size)"
    while True:
        resp = with_retry(lambda: svc.files().list(
            q=q, fields=fields, pageSize=1000, pageToken=token,
            supportsAllDrives=True, includeItemsFromAllDrives=True
        ).execute())
        out.extend(resp.get("files", []))
        token = resp.get("nextPageToken")
        if not token:
            return out


def parse_title(t):
    m = re.match(r"^\[([A-Z][A-Z0-9-]*)\]", t)
    if m:
        lane = m.group(1)
    elif re.match(r"^ZZ-SUPERSEDED", t, re.I):
        lane = "ZZ-SUPERSEDED"
    elif re.match(r"^ZZ-", t, re.I):
        lane = "ZZ-ERROR"
    elif re.match(r"^0\d\s", t) or re.match(r"^CLAUDE-BRAIN-HANDOFF", t, re.I):
        lane = "STRUCTURAL"
    elif re.search(r"\.(json|md|txt|csv)$", t, re.I):
        lane = "FILE"
    else:
        lane = "UNTAGGED"
    d = re.search(r"(\d{4}-\d{2}-\d{2})", t)
    return lane, (d.group(1) if d else "")


def fetch_body(svc, f):
    mime = f["mimeType"]
    buf = io.BytesIO()
    if mime in EXPORT_AS:
        req = svc.files().export_media(fileId=f["id"], mimeType=EXPORT_AS[mime])
    elif mime.startswith(GOOGLE_PREFIX):
        return f"(not exported: Google type {mime})\n"
    elif mime.startswith(TEXT_MIMES):
        req = svc.files().get_media(fileId=f["id"], supportsAllDrives=True)
    else:
        return f"(binary {mime}, {f.get('size', '?')} bytes — not mirrored)\n"

    def run():
        buf.seek(0)
        buf.truncate()
        dl = MediaIoBaseDownload(buf, req)
        done = False
        while not done:
            _, done = dl.next_chunk()
        return buf.getvalue()

    data = with_retry(run)
    text = data.decode("utf-8", errors="replace")
    return text.lstrip("﻿")


def header(f, lane, date, note=""):
    lines = [
        f"title: {f['name']}",
        f"id: {f['id']}",
        f"lane: {lane}",
        f"date: {date}",
        f"created: {f['createdTime']}",
        f"modified: {f['modifiedTime']}",
        f"mime: {f['mimeType']}",
        f"url: https://drive.google.com/open?id={f['id']}",
    ]
    if note:
        lines.append(f"note: {note}")
    return "\n".join(lines) + "\n---\n\n"


def main():
    svc = drive()
    files = list_folder(svc)
    DOCS.mkdir(exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    full = os.environ.get("MIRROR_FULL") == "1"

    seen, changed, errors = set(), 0, 0
    index_rows = []
    for f in sorted(files, key=lambda x: x["createdTime"]):
        fid = f["id"]
        seen.add(fid)
        lane, date = parse_title(f["name"])
        index_rows.append((fid, lane, date, f["createdTime"], f["modifiedTime"], f["name"]))
        path = DOCS / f"{fid}.md"
        if not full and manifest.get(fid) == f["modifiedTime"] and path.exists():
            continue
        try:
            body = fetch_body(svc, f)
        except Exception as e:  # noqa: BLE001 — one bad doc must not stop the night
            errors += 1
            body = f"(fetch failed: {e})\n"
        path.write_text(header(f, lane, date) + body, encoding="utf-8")
        manifest[fid] = f["modifiedTime"]
        changed += 1

    # Docs that vanished from Drive: keep the file, mark it. Append-only means
    # this should never happen, so it is worth seeing in the diff.
    gone = 0
    for fid in list(manifest):
        if fid not in seen:
            path = DOCS / f"{fid}.md"
            if path.exists() and "note: MISSING FROM DRIVE" not in path.read_text(encoding="utf-8")[:600]:
                txt = path.read_text(encoding="utf-8")
                txt = txt.replace("\n---\n", f"\nnote: MISSING FROM DRIVE since {time.strftime('%Y-%m-%d')}\n---\n", 1)
                path.write_text(txt, encoding="utf-8")
                gone += 1

    index_rows.sort(key=lambda r: (r[3]))
    INDEX.write_text(
        "id\tlane\tdate\tcreated\tmodified\ttitle\n"
        + "\n".join("\t".join(c.replace("\t", " ").replace("\n", " ") for c in r) for r in index_rows)
        + "\n",
        encoding="utf-8",
    )
    MANIFEST.write_text(json.dumps(manifest, indent=0, sort_keys=True) + "\n", encoding="utf-8")

    lanes = {}
    for _, lane, *_rest in index_rows:
        lanes[lane] = lanes.get(lane, 0) + 1
    summary = {
        "docsInDrive": len(files),
        "changedTonight": changed,
        "fetchErrors": errors,
        "markedMissing": gone,
        "lanes": dict(sorted(lanes.items(), key=lambda kv: -kv[1])),
    }
    print(json.dumps(summary, indent=2))
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
            out.write(f"changed={changed}\n")
            out.write(f"docs={len(files)}\n")
            out.write(f"errors={errors}\n")


if __name__ == "__main__":
    main()
