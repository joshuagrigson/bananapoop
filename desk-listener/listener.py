#!/usr/bin/env python3
"""Robinhood desk event listener.

Always-on worker. Polls free sources and, when something material happens to a
ticker in the universe or to the market, fires the Claude scheduled task's API
trigger so an off-schedule desk sweep runs right then.

Sources (all free, no keys):
  - SEC EDGAR "latest filings" Atom feed, filtered to 8-K / 8-K/A for the
    universe (material events: guidance, M&A, exec changes, restatements).
  - Price moves via Yahoo Finance chart endpoint (15-min delayed is fine for
    a "something big is happening" tripwire).
  - Google News RSS per ticker + Federal Reserve press-release RSS.
  - A static macro calendar (macro_calendar.json) that fires a wake a few
    minutes after each scheduled release.

Every wake is deduplicated and rate-limited so the desk is not spammed.

Env vars:
  CLAUDE_TRIGGER_URL     the "API" trigger URL from claude.ai scheduled task
  CLAUDE_TRIGGER_TOKEN   bearer token for it (if the trigger gives one)
  SLACK_WEBHOOK_URL      optional fallback/notice channel
  UNIVERSE               comma list, default NVDA,META,AMZN,AAPL,GOOGL,NFLX,MSFT
  PRICE_MOVE_PCT         default 3.0  (abs % vs previous close)
  INDEX_MOVE_PCT         default 1.5  (SPY/QQQ)
  POLL_SECONDS           default 120
  MAX_WAKES_PER_HOUR     default 4
  DRY_RUN                "1" = log what would fire, never call the trigger
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

log = logging.getLogger("desk-listener")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

ET_TZ = ZoneInfo("America/New_York")
UA = "bananapoop-desk-listener/1.0 (jsgrigson@gmail.com)"

UNIVERSE = [t.strip().upper() for t in os.environ.get(
    "UNIVERSE", "NVDA,META,AMZN,AAPL,GOOGL,NFLX,MSFT").split(",") if t.strip()]
INDEXES = ["SPY", "QQQ"]
PRICE_MOVE_PCT = float(os.environ.get("PRICE_MOVE_PCT", "3.0"))
INDEX_MOVE_PCT = float(os.environ.get("INDEX_MOVE_PCT", "1.5"))
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "120"))
MAX_WAKES_PER_HOUR = int(os.environ.get("MAX_WAKES_PER_HOUR", "4"))
DRY_RUN = os.environ.get("DRY_RUN") == "1"
TRIGGER_URL = os.environ.get("CLAUDE_TRIGGER_URL", "")
TRIGGER_TOKEN = os.environ.get("CLAUDE_TRIGGER_TOKEN", "")
SLACK_WEBHOOK = os.environ.get("SLACK_WEBHOOK_URL", "")

STATE_PATH = Path(os.environ.get("STATE_PATH", "/tmp/desk-listener-state.json"))
CAL_PATH = Path(__file__).with_name("macro_calendar.json")

# Headline words that make a news item worth a wake on its own.
HOT_WORDS = re.compile(
    r"\b(guidance|cuts? forecast|raises? forecast|downgrade|upgrade|investigat|"
    r"subpoena|recall|lawsuit|antitrust|tariff|halt|layoff|resign|steps? down|"
    r"acqui|merger|buyback|dividend cut|misses|beats)\b", re.I)
# Opinion / clickbait shapes that are never an event.
NOISE = re.compile(
    r"^(prediction|should you|is it time|here'?s why|why |opinion|"
    r"\d+ (stocks|reasons)|better buy|vs\.?\b)", re.I)

session = requests.Session()
session.headers["User-Agent"] = UA


# ---------------------------------------------------------------- state ----
class State:
    def __init__(self) -> None:
        self.seen: dict[str, float] = {}
        self.wakes: deque[float] = deque()
        self.prev_close: dict[str, float] = {}
        self.load()

    def load(self) -> None:
        try:
            d = json.loads(STATE_PATH.read_text())
            self.seen = d.get("seen", {})
            self.wakes = deque(d.get("wakes", []))
        except Exception:
            pass
        cutoff = time.time() - 6 * 3600
        self.seen = {k: v for k, v in self.seen.items() if v > cutoff}

    def save(self) -> None:
        try:
            STATE_PATH.write_text(json.dumps({"seen": self.seen, "wakes": list(self.wakes)}))
        except Exception as e:  # ephemeral disk is fine; just log
            log.warning("state save failed: %s", e)

    def first_time(self, key: str) -> bool:
        if key in self.seen:
            return False
        self.seen[key] = time.time()
        return True

    def can_wake(self) -> bool:
        now = time.time()
        while self.wakes and self.wakes[0] < now - 3600:
            self.wakes.popleft()
        return len(self.wakes) < MAX_WAKES_PER_HOUR

    def record_wake(self) -> None:
        self.wakes.append(time.time())


# ------------------------------------------------------------- helpers ----
def now_et() -> datetime:
    return datetime.now(ET_TZ)


def market_open() -> bool:
    t = now_et()
    if t.weekday() >= 5:
        return False
    return (t.hour, t.minute) >= (9, 30) and (t.hour, t.minute) < (16, 0)


def get(url: str, **kw) -> requests.Response | None:
    try:
        r = session.get(url, timeout=20, **kw)
        if r.status_code == 200:
            return r
        log.warning("GET %s -> %s", url, r.status_code)
    except requests.RequestException as e:
        log.warning("GET %s failed: %s", url, e)
    return None


def fire(reason: str, detail: dict) -> None:
    """Wake the desk. One call = one off-schedule sweep."""
    payload = {
        "source": "desk-listener",
        "reason": reason,
        "detail": detail,
        "at_et": now_et().isoformat(timespec="seconds"),
        "instruction": (
            "EVENT WAKE from the desk listener. Run the robinhood-desk SOP as a "
            "single sweep focused on this event; decide whether any ledger call "
            "changes; report in the alert format."),
    }
    log.info("WAKE %s %s", reason, json.dumps(detail)[:300])
    if DRY_RUN or not TRIGGER_URL:
        log.info("dry run / no trigger url; not firing")
        return
    headers = {"Content-Type": "application/json"}
    if TRIGGER_TOKEN:
        headers["Authorization"] = f"Bearer {TRIGGER_TOKEN}"
    try:
        r = session.post(TRIGGER_URL, json=payload, headers=headers, timeout=20)
        log.info("trigger -> %s", r.status_code)
    except requests.RequestException as e:
        log.error("trigger failed: %s", e)
        if SLACK_WEBHOOK:
            session.post(SLACK_WEBHOOK, json={"text": f"desk-listener could not wake Claude: {reason} {e}"}, timeout=10)


# ------------------------------------------------------------- sources ----
def load_cik_map() -> dict[str, str]:
    r = get("https://www.sec.gov/files/company_tickers.json")
    if not r:
        return {}
    out = {}
    for row in r.json().values():
        out[row["ticker"].upper()] = str(row["cik_str"]).zfill(10)
    return {t: out[t] for t in UNIVERSE if t in out}


def check_edgar(state: State, cik_map: dict[str, str]) -> None:
    """Latest 8-Ks across EDGAR; keep ours."""
    url = ("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent"
           "&type=8-K&count=100&output=atom")
    r = get(url)
    if not r:
        return
    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        return
    by_cik = {v: k for k, v in cik_map.items()}
    for entry in root.findall("a:entry", ns):
        title = entry.findtext("a:title", "", ns)
        link = entry.find("a:link", ns)
        href = link.get("href") if link is not None else ""
        m = re.search(r"/data/(\d+)/", href or "")
        cik = m.group(1).zfill(10) if m else ""
        ticker = by_cik.get(cik)
        if not ticker:
            continue
        if state.first_time(f"edgar:{href}"):
            if state.can_wake():
                state.record_wake()
                fire("sec_8k", {"ticker": ticker, "title": title, "url": href})


def check_prices(state: State) -> None:
    if not market_open():
        return
    for sym in UNIVERSE + INDEXES:
        r = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
                params={"interval": "5m", "range": "1d"})
        if not r:
            continue
        try:
            meta = r.json()["chart"]["result"][0]["meta"]
            last = float(meta["regularMarketPrice"])
            prev = float(meta.get("chartPreviousClose") or meta.get("previousClose"))
        except (KeyError, TypeError, ValueError, IndexError):
            continue
        pct = (last - prev) / prev * 100
        limit = INDEX_MOVE_PCT if sym in INDEXES else PRICE_MOVE_PCT
        if abs(pct) >= limit:
            # one wake per symbol per direction per day
            key = f"px:{sym}:{'up' if pct > 0 else 'dn'}:{now_et():%Y-%m-%d}"
            if state.first_time(key) and state.can_wake():
                state.record_wake()
                fire("price_move", {"ticker": sym, "pct": round(pct, 2), "last": last, "prev_close": prev})


def _rss_items(url: str) -> list[tuple[str, str]]:
    r = get(url)
    if not r:
        return []
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        return []
    items = []
    for it in root.iter("item"):
        items.append((it.findtext("title", ""), it.findtext("link", "")))
    return items


def check_news(state: State) -> None:
    feeds = [("FED", "https://www.federalreserve.gov/feeds/press_monetary.xml")]
    for t in UNIVERSE:
        feeds.append((t, f"https://news.google.com/rss/search?q={t}+stock&hl=en-US&gl=US&ceid=US:en"))
    for tag, url in feeds:
        for title, link in _rss_items(url)[:15]:
            key = f"news:{link or title}"
            if not state.first_time(key):
                continue
            if tag == "FED" or (HOT_WORDS.search(title) and not NOISE.search(title)):
                if state.can_wake():
                    state.record_wake()
                    fire("news", {"ticker": tag, "title": title, "url": link})


def check_macro(state: State) -> None:
    try:
        cal = json.loads(CAL_PATH.read_text())
    except Exception:
        return
    t = now_et()
    for ev in cal:
        when = datetime.fromisoformat(ev["time_et"]).replace(tzinfo=ET_TZ)
        if when <= t <= when + timedelta(minutes=10):
            if state.first_time(f"macro:{ev['time_et']}:{ev['name']}") and state.can_wake():
                state.record_wake()
                fire("macro_release", ev)


# ---------------------------------------------------------------- main ----
def main() -> int:
    log.info("universe=%s poll=%ss dry_run=%s trigger=%s",
             UNIVERSE, POLL_SECONDS, DRY_RUN, "set" if TRIGGER_URL else "MISSING")
    state = State()
    cik_map = load_cik_map()
    log.info("cik map: %s", cik_map)
    once = os.environ.get("ONCE") == "1"
    while True:
        try:
            check_edgar(state, cik_map)
            check_prices(state)
            check_news(state)
            check_macro(state)
            state.save()
        except Exception:
            log.exception("loop error")
        if once:
            return 0
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
