#!/usr/bin/env python3
"""SoldComps client: pull eBay sold prices and keep them.

Needs an API key from https://sold-comps.com/signup (free: 100 searches/month).
Set it once:   export SOLDCOMPS_API_KEY=sc_...

  python3 soldcomps.py search "rtx 3080 10gb -lot -parts" --condition used
  python3 soldcomps.py search "stanley tumbler 40oz" --pages 2 --after 2026-10-01
  python3 soldcomps.py item 168647489856
  python3 soldcomps.py usage
  python3 soldcomps.py spec          # saves the live OpenAPI spec to data/

Every search is saved under data/<keyword>/ :
  <date>-<time>.json   the raw API response(s), untouched
  comps.csv            one row per listing, added to on every run, no duplicates

Python 3.8+, standard library only.
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("SOLDCOMPS_BASE_URL", "https://api.sold-comps.com").rstrip("/")
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
MAX_PAGE = 100  # eBay blocks most requests past page 100
CSV_FIELDS = [
    "itemId", "endedAt", "title", "condition", "conditionId", "soldPrice",
    "soldPriceMax", "soldCurrency", "shippingPrice", "shippingType",
    "totalPrice", "bestOfferAccepted", "buyingFormat", "bidCount",
    "sellerUsername", "sellerFeedbackScore", "sellerPositivePercent",
    "itemLocation", "epid", "url", "thumbnailUrl", "scrapedAt", "keyword",
    "ebaySite",
]


class ApiError(Exception):
    def __init__(self, status, body):
        self.status, self.body = status, body
        msg = body.get("error") or body.get("message") or body
        super().__init__("HTTP %s %s: %s" % (status, body.get("code", ""), msg))


def api_key():
    key = os.environ.get("SOLDCOMPS_API_KEY", "").strip()
    if not key:
        sys.exit("No API key. Get a free one at https://sold-comps.com/signup "
                 "then run:  export SOLDCOMPS_API_KEY=sc_...")
    return key


def get(path, params=None, auth=True, tries=4):
    """GET a JSON endpoint. Retries rate limits and transient 5xx; never
    retries a used-up monthly quota. Returns (body, headers)."""
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(
            {k: v for k, v in params.items() if v is not None})
    headers = {"Accept": "application/json", "User-Agent": "soldcomps.py"}
    if auth:
        headers["Authorization"] = "Bearer " + api_key()
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(url, headers=headers), timeout=90) as r:
                return json.loads(r.read().decode("utf-8")), r.headers
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", "replace")
            try:
                body = json.loads(raw)
            except ValueError:
                body = {"error": raw[:300]}
            if not isinstance(body, dict):
                body = {"error": str(body)[:300]}
            code = body.get("code")
            retryable = (e.code == 429 and code != "quota_exceeded") or e.code in (500, 503)
            if not retryable or attempt == tries:
                raise ApiError(e.code, body)
            wait = body.get("retry_after") or e.headers.get("Retry-After") or 3 * attempt
            wait = min(float(wait), 65)
            print("  %s %s, waiting %.0fs (try %d of %d)"
                  % (e.code, code or "", wait, attempt, tries), file=sys.stderr)
            time.sleep(wait)
        except urllib.error.URLError as e:
            if attempt == tries:
                raise ApiError(0, {"error": "network: %s" % e.reason})
            time.sleep(3 * attempt)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "search"


def to_num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def save_rows(folder, items, keyword, site):
    """Add new listings to comps.csv. Returns how many were new."""
    path = os.path.join(folder, "comps.csv")
    seen = set()
    if os.path.exists(path):
        with open(path, newline="", encoding="utf-8") as f:
            seen = {row["itemId"] for row in csv.DictReader(f)}
    new = [i for i in items if i.get("itemId") and i["itemId"] not in seen]
    # the same listing can show up on two pages of one run
    unique, ids = [], set()
    for i in new:
        if i["itemId"] not in ids:
            ids.add(i["itemId"])
            unique.append(i)
    write_header = not os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        if write_header:
            w.writeheader()
        for i in unique:
            w.writerow(dict(i, keyword=keyword, ebaySite=site))
    return len(unique)


def summarize(items):
    """Price stats on the item price (no shipping) and on price + shipping."""
    out = {"count": len(items)}
    for label, field in (("price", "soldPrice"), ("with_shipping", "totalPrice")):
        nums = sorted(n for n in (to_num(i.get(field)) for i in items) if n is not None)
        if nums:
            out[label] = {
                "median": round(statistics.median(nums), 2),
                "average": round(statistics.mean(nums), 2),
                "low": nums[0], "high": nums[-1],
                "middle_half": [round(nums[len(nums) // 4], 2),
                                round(nums[(len(nums) * 3) // 4 - (1 if len(nums) > 3 else 0)], 2)],
            }
    out["best_offer_sales"] = sum(1 for i in items if i.get("bestOfferAccepted"))
    dates = sorted(i["endedAt"] for i in items if i.get("endedAt"))
    if dates:
        out["sold_between"] = [dates[0], dates[-1]]
    return out


def cmd_search(a):
    params = {
        "keyword": a.keyword, "count": a.count, "ebaySite": a.site,
        "itemCondition": a.condition, "conditionId": a.condition_id,
        "minPrice": a.min, "maxPrice": a.max, "categoryId": a.category,
        "soldAfter": a.after, "soldBefore": a.before,
        "buyingFormat": a.format, "postalCode": a.zip,
        "sold": "false" if a.active else None,
        "hydrateBoa": "true" if a.real_offers else None,
        "exactMatch": "false" if a.loose else None,
    }
    folder = os.path.join(DATA, slug(a.keyword))
    os.makedirs(folder, exist_ok=True)
    pages, items, headers = [], [], None
    last = min(a.pages, MAX_PAGE)
    for page in range(1, last + 1):
        body, headers = get("/v1/scrape", dict(params, page=page))
        pages.append(body)
        items.extend(body.get("items") or [])
        print("  page %d: %d listings" % (page, len(body.get("items") or [])),
              file=sys.stderr)
        if not body.get("hasNextPage"):
            break
        if page < last:
            time.sleep(1.1)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d-%H%M%S")
    raw_path = os.path.join(folder, stamp + ".json")
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump({"request": {k: v for k, v in params.items() if v is not None},
                   "pages": pages}, f, indent=1)
    result = {"keyword": a.keyword, "saved_raw": raw_path}
    if a.active:
        result["count"] = len(items)
        nums = sorted(n for n in (to_num(i.get("currentPrice")) for i in items) if n is not None)
        if nums:
            result["asking"] = {"median": round(statistics.median(nums), 2),
                                "low": nums[0], "high": nums[-1]}
    else:
        result["new_rows_in_csv"] = save_rows(folder, items, a.keyword, a.site)
        result["csv"] = os.path.join(folder, "comps.csv")
        result.update(summarize(items))
        if result.get("best_offer_sales") and not a.real_offers:
            result["note"] = ("%d sales took a Best Offer: their price here is the asking "
                              "price, so the real number is lower. Add --real-offers to "
                              "look up what was paid (1 extra search)."
                              % result["best_offer_sales"])
    if headers is not None and headers.get("X-Usage-Remaining"):
        result["searches_left_this_month"] = int(headers["X-Usage-Remaining"])
    print(json.dumps(result, indent=2))


def cmd_item(a):
    body, _ = get("/v1/item/" + urllib.parse.quote(a.item_id, safe=""),
                  {"ebaySite": a.site,
                   "includeDescription": "true" if a.description else None})
    folder = os.path.join(DATA, "items")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, "%s.json" % body.get("itemId", slug(a.item_id)))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(body, f, indent=1)
    print(json.dumps({k: body.get(k) for k in (
        "itemId", "title", "price", "originalPrice", "currency", "condition",
        "listingStatus", "endedDate", "bestOfferAccepted", "shipping",
        "location", "categoryPath")}, indent=2))
    print("saved " + path, file=sys.stderr)


def cmd_usage(a):
    body, _ = get("/usage")
    print(json.dumps(body, indent=2))


def cmd_spec(a):
    body, _ = get("/openapi.json", auth=False)
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, "openapi.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(body, f, indent=1)
    print("saved %s (%d endpoints)" % (path, len(body.get("paths", {}))))


def main(argv=None):
    p = argparse.ArgumentParser(description="Pull and keep eBay sold prices (SoldComps API).")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="sold listings for a keyword")
    s.add_argument("keyword", help='eBay search text; "-word" excludes a word')
    s.add_argument("--pages", type=int, default=1, help="pages to pull, 1 search each (default 1)")
    s.add_argument("--count", type=int, default=240, choices=(60, 120, 240))
    s.add_argument("--site", default="ebay.com")
    s.add_argument("--condition", choices=("any", "new", "used"))
    s.add_argument("--condition-id", type=int, help="1000 new, 3000 used, 7000 for parts")
    s.add_argument("--min", type=float, help="lowest price")
    s.add_argument("--max", type=float, help="highest price")
    s.add_argument("--category", help="eBay category id")
    s.add_argument("--after", help="sold on or after YYYY-MM-DD")
    s.add_argument("--before", help="sold on or before YYYY-MM-DD")
    s.add_argument("--format", choices=("all", "auction", "buyItNow", "acceptsOffers"))
    s.add_argument("--zip", help="your ZIP, for truer shipping prices")
    s.add_argument("--active", action="store_true", help="current listings, not sold ones")
    s.add_argument("--real-offers", action="store_true",
                   help="look up accepted Best Offer prices (costs 1 extra search)")
    s.add_argument("--loose", action="store_true", help="include eBay's looser matches")
    s.set_defaults(fn=cmd_search)

    i = sub.add_parser("item", help="full detail of one listing")
    i.add_argument("item_id", help="eBay item number or item URL")
    i.add_argument("--site", default="ebay.com")
    i.add_argument("--description", action="store_true")
    i.set_defaults(fn=cmd_item)

    sub.add_parser("usage", help="searches used and left (free call)").set_defaults(fn=cmd_usage)
    sub.add_parser("spec", help="save the live OpenAPI spec (no key needed)").set_defaults(fn=cmd_spec)

    a = p.parse_args(argv)
    try:
        a.fn(a)
    except ApiError as e:
        if e.status == 429 and e.body.get("code") == "quota_exceeded":
            sys.exit("Monthly searches are used up. Resets %s."
                     % e.body.get("reset_at", "at the next billing date"))
        sys.exit(str(e))


if __name__ == "__main__":
    main()
