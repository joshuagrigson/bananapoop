#!/usr/bin/env python3
"""Tests for soldcomps.py against a local fake of the SoldComps API.

  python3 test_soldcomps.py

No API key and no network needed. The fake answers in the response shape the
SoldComps docs give for /v1/scrape, /v1/item and /usage.
"""
import csv
import http.server
import io
import json
import os
import shutil
import tempfile
import threading
import unittest
import urllib.parse
from contextlib import redirect_stderr, redirect_stdout

os.environ["SOLDCOMPS_API_KEY"] = "sc_test"

STATE = {"calls": [], "fail_next": []}


def item(n, price, ship=None, boa=False):
    return {
        "itemId": str(n), "url": "https://www.ebay.com/itm/%d?nordt=true" % n,
        "title": "Thing, with a comma %d" % n, "condition": "Pre-Owned",
        "conditionId": 3000, "buyingFormat": "buyItNow",
        "bestOfferAccepted": boa, "listingType": "sold", "endedAt": "2026-11-0%d" % (n % 9 + 1),
        "soldPrice": "%.2f" % price, "soldCurrency": "USD",
        "shippingPrice": None if ship is None else "%.2f" % ship,
        "shippingType": "free" if ship is None else "paid",
        "totalPrice": "%.2f" % (price + (ship or 0)),
        "sellerUsername": "seller%d" % n, "sellerFeedbackScore": 10 * n,
        "sellerPositivePercent": 99.5, "itemLocation": "United States",
        "epid": None, "scrapedAt": "2026-11-11T00:00:00.000Z",
    }


PAGES = {
    1: [item(1, 100), item(2, 200, 10), item(3, 300, boa=True)],
    2: [item(3, 300, boa=True), item(4, 400)],  # item 3 repeats across pages
}


class Fake(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, status, body, headers=None):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = dict(urllib.parse.parse_qsl(u.query))
        STATE["calls"].append((u.path, q, self.headers.get("Authorization")))
        if STATE["fail_next"]:
            status, body = STATE["fail_next"].pop(0)
            return self.send(status, body)
        if u.path == "/openapi.json":
            return self.send(200, {"paths": {"/v1/scrape": {}, "/usage": {}}})
        if self.headers.get("Authorization") != "Bearer sc_test":
            return self.send(401, {"error": "Missing Authorization header"})
        if u.path == "/v1/scrape":
            page = int(q.get("page", 1))
            return self.send(200, {
                "keyword": q["keyword"], "page": page,
                "totalItems": len(PAGES.get(page, [])), "totalResults": "5",
                "hasNextPage": page < 2, "items": PAGES.get(page, []),
            }, {"X-Usage-Remaining": str(100 - page)})
        if u.path.startswith("/v1/item/"):
            return self.send(200, {"itemId": u.path.rsplit("/", 1)[1], "title": "One thing",
                                   "price": "4.99", "currency": "USD", "listingStatus": "sold"})
        if u.path == "/usage":
            return self.send(200, {"plan": "free", "usage": {"limit": 100, "used": 2, "remaining": 98}})
        self.send(404, {"error": "not found"})


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        os.environ["SOLDCOMPS_BASE_URL"] = "http://127.0.0.1:%d" % cls.server.server_port
        import soldcomps
        cls.sc = soldcomps
        cls.sc.time.sleep = lambda s: None  # no real waiting in tests

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.sc.DATA = self.tmp
        STATE["calls"].clear()
        STATE["fail_next"].clear()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            self.sc.main(list(argv))
        return out.getvalue()

    def rows(self, keyword_slug):
        with open(os.path.join(self.tmp, keyword_slug, "comps.csv"), newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))

    def test_search_one_page_saves_csv_raw_and_stats(self):
        out = json.loads(self.run_cli("search", "Test Thing"))
        self.assertEqual(out["count"], 3)
        self.assertEqual(out["new_rows_in_csv"], 3)
        self.assertEqual(out["price"]["median"], 200.0)
        self.assertEqual(out["price"]["low"], 100.0)
        self.assertEqual(out["with_shipping"]["median"], 210.0)
        self.assertEqual(out["best_offer_sales"], 1)
        self.assertIn("note", out)
        self.assertEqual(out["searches_left_this_month"], 99)
        rows = self.rows("test-thing")
        self.assertEqual([r["itemId"] for r in rows], ["1", "2", "3"])
        self.assertEqual(rows[0]["title"], "Thing, with a comma 1")
        self.assertEqual(rows[1]["totalPrice"], "210.00")
        self.assertTrue(os.path.exists(out["saved_raw"]))
        self.assertEqual(len(STATE["calls"]), 1)

    def test_pages_stop_at_last_page_and_dedupe(self):
        out = json.loads(self.run_cli("search", "test thing", "--pages", "5"))
        self.assertEqual(len(STATE["calls"]), 2)  # hasNextPage false on page 2
        self.assertEqual(out["new_rows_in_csv"], 4)  # item 3 once
        self.assertEqual(len(self.rows("test-thing")), 4)

    def test_second_run_adds_nothing(self):
        self.run_cli("search", "test thing", "--pages", "2")
        out = json.loads(self.run_cli("search", "test thing", "--pages", "2"))
        self.assertEqual(out["new_rows_in_csv"], 0)
        self.assertEqual(len(self.rows("test-thing")), 4)

    def test_filters_reach_the_api(self):
        self.run_cli("search", "x", "--condition", "used", "--min", "50", "--after",
                     "2026-10-01", "--zip", "75501", "--real-offers")
        q = STATE["calls"][0][1]
        self.assertEqual(q["itemCondition"], "used")
        self.assertEqual(q["minPrice"], "50.0")
        self.assertEqual(q["soldAfter"], "2026-10-01")
        self.assertEqual(q["postalCode"], "75501")
        self.assertEqual(q["hydrateBoa"], "true")
        self.assertNotIn("maxPrice", q)
        self.assertNotIn("sold", q)

    def test_rate_limit_is_retried(self):
        STATE["fail_next"].append((429, {"code": "rate_limited", "retry_after": 1}))
        out = json.loads(self.run_cli("search", "x"))
        self.assertEqual(out["count"], 3)
        self.assertEqual(len(STATE["calls"]), 2)

    def test_blocked_upstream_is_retried(self):
        STATE["fail_next"].append((503, {"code": "upstream_blocked"}))
        self.assertEqual(json.loads(self.run_cli("search", "x"))["count"], 3)

    def test_used_up_quota_stops_without_retry(self):
        STATE["fail_next"].append((429, {"code": "quota_exceeded", "reset_at": "2026-12-01T00:00:00Z"}))
        with self.assertRaises(SystemExit) as e:
            self.run_cli("search", "x")
        self.assertIn("2026-12-01", str(e.exception))
        self.assertEqual(len(STATE["calls"]), 1)

    def test_bad_key_reports_401(self):
        STATE["fail_next"].append((401, {"error": "Unauthorized"}))
        with self.assertRaises(SystemExit) as e:
            self.run_cli("usage")
        self.assertIn("401", str(e.exception))

    def test_item_usage_spec(self):
        self.assertIn("One thing", self.run_cli("item", "168647489856"))
        self.assertTrue(os.path.exists(os.path.join(self.tmp, "items", "168647489856.json")))
        self.assertIn('"remaining": 98', self.run_cli("usage"))
        self.assertIn("2 endpoints", self.run_cli("spec"))
        self.assertIsNone(STATE["calls"][-1][2])  # spec sends no key


if __name__ == "__main__":
    unittest.main(verbosity=1)
