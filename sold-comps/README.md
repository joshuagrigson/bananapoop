# SoldComps kit

Notes and a ready client for [SoldComps](https://sold-comps.com), a paid API that
returns real eBay sold prices (plus Mercari, Poshmark and TCGPlayer). Read from
the site on 2026-11-11. Prices and limits change; the live docs win.

- Docs: https://sold-comps.com/docs
- Machine-readable spec: https://api.sold-comps.com/openapi.json (`python3 soldcomps.py spec` saves a copy)
- Changelog: https://sold-comps.com/changelog
- eBay category IDs: https://sold-comps.com/ebay-categories

## What is in this folder

| File | What it is |
|---|---|
| `soldcomps.py` | Command-line client. Pulls sold listings and keeps them as CSV + raw JSON. Standard library only. |
| `test_soldcomps.py` | Tests against a local fake of the API. No key, no network. |
| `data/` | Where pulls land: `data/<keyword>/comps.csv` and one raw `.json` per run. |

## Use it

Get a key at https://sold-comps.com/signup (free plan, no card), then:

```bash
export SOLDCOMPS_API_KEY=sc_your_key_here
```

```bash
python3 soldcomps.py search "rtx 3080 10gb -lot -parts" --condition used
```

It prints the count, median, average, low, high and the middle half of prices
(with and without shipping), and how many searches are left this month. Each
run adds only new listings to `comps.csv`, so re-running a search weekly builds
a price history longer than the 90 days eBay shows.

Other commands:

```bash
python3 soldcomps.py search "stanley tumbler 40oz" --pages 2 --after 2026-10-01
```

```bash
python3 soldcomps.py search "iphone 15 pro 256gb" --active
```

```bash
python3 soldcomps.py item 168647489856
```

```bash
python3 soldcomps.py usage
```

`search` flags: `--pages N` (1 search each), `--count 60|120|240`, `--site ebay.co.uk`,
`--condition new|used`, `--condition-id 7000`, `--min`, `--max`, `--category`,
`--after`, `--before`, `--format auction|buyItNow|acceptsOffers`, `--zip`,
`--real-offers`, `--loose`, `--active`.

## What it costs

One search = one keyword = one page of up to 240 sold listings, whatever the
number that comes back. Failed requests are not counted.

| Plan | Searches / month | Price |
|---|---|---|
| Free | 100 | $0, no card |
| Starter | 2,000 | $9 |
| Growth | 10,000 | $29 |
| Scale | 50,000 | $79 |
| High volume | 100,000 to 2,000,000 | $129 to $999 |

- Pay-as-you-go credits: $3 per 1,000 searches, never expire, work on the free plan.
- Rate limit: 60 requests a minute on the plans above (120 to 240 on high volume).
- History: about 90 days, which is all eBay exposes.
- Things that cost more than 1: image search (2), `hydrateBoa` when it finds a
  match (+1), Poshmark `enrichSellerInfo` (+1), Max Mode (1 per page).

## The API in one page

Base URL `https://api.sold-comps.com`. Every call sends
`Authorization: Bearer sc_...`. Keys start with `sc_`; up to 10 per account,
all sharing one quota.

| Call | What it returns |
|---|---|
| `GET /v1/scrape?keyword=` | One page of eBay sold listings (or active ones with `sold=false`) |
| `POST /v1/scrape/image` | Sold listings that look like a photo you send |
| `GET /v1/scrape/category?categoryId=` | Every recent sale in a category, no keyword |
| `POST /api/bulk-search` | 1 to 20 keywords at once, streamed back |
| `POST /v1/scrape/max` | "Max Mode": the server pages for you (up to 100 pages), result inline, by email or as CSV |
| `GET /v1/scrape/max/results/{jobId}` | Progress and result of a Max Mode job (kept 30 days) |
| `GET /v1/item/{itemId}` | Full detail of one listing: specifics, all images, seller, description |
| `GET /v1/mercari?keyword=` | Mercari sold or active listings, up to 100 a page |
| `GET /v1/poshmark/sold?keyword=` | Poshmark sold listings, 48 a page, with days-to-sell |
| `GET /v1/tcgplayer/search?keyword=` | TCGPlayer products with market price and cheapest listings |
| `GET /v1/tcgplayer/sales?productId=` | The 5 most recent sales of a card |
| `GET /usage` | Plan, searches used and left, reset time. Free |
| `GET /requests` | History of your own requests, 90 days. Free |

### `/v1/scrape` filters

`keyword` (eBay search text; `-word` excludes), `page`, `count` (60, 120, 240),
`ebaySite` (ebay.com, .co.uk, .de, .fr, .it, .es, .ca, .com.au), `categoryId`,
`sortOrder` (endedRecently is the default), `minPrice`, `maxPrice`,
`itemCondition` (any, new, used), `conditionId` (1000 new, 1500 open box,
3000 used, 7000 for parts), `buyingFormat` (all, auction, buyItNow,
acceptsOffers), `sellerCountry` (two-letter code), `soldAfter` / `soldBefore`
(YYYY-MM-DD), `aspectFilter` (JSON of eBay's sidebar facets, for example
`{"Brand":"Apple","Storage Capacity":"256 GB"}`), `exactMatch` (default true),
`postalCode`, `hydrateBoa`, `imageUrl`, `sold` (false = active listings).

### What comes back for each sold listing

`itemId`, `url`, `title`, `condition`, `conditionId`, `soldPrice`,
`soldPriceMax`, `soldCurrency`, `shippingPrice`, `shippingType`, `totalPrice`
(price + shipping), `endedAt` (date only), `bestOfferAccepted`, `buyingFormat`,
`bidCount`, `sellerUsername`, `sellerFeedbackScore`, `sellerPositivePercent`,
`itemLocation`, `epid` (eBay's catalog ID: same product = same `epid`),
`thumbnailUrl`, `scrapedAt`. Active listings swap the sold fields for
`currentPrice`, `watcherCount`, `unitsSold`, `acceptsOffers`, `timeLeft`.

The page itself carries `totalItems` (items on this page), `totalResults`
(eBay's own rough total, a string), `hasNextPage` and `autoSelectedCategory`.

## Traps

- **Best Offer prices are too high.** When `bestOfferAccepted` is true,
  `soldPrice` is the asking price, not what was paid. `hydrateBoa=true`
  (`--real-offers`) looks up the accepted amount for 1 extra search. It only
  works for items listed on ebay.com, ebay.co.uk and ebay.de.
- **Listings with variations** report the low end in `soldPrice` and the high
  end in `soldPriceMax`.
- **Date filters run after the page is pulled.** A page can come back short or
  empty and still have a next page. Each page still costs 1 search.
- **Stop at page 100.** eBay blocks past it. 100 pages at 240 = 24,000 listings.
- **429 has two meanings.** `code: rate_limited` means wait `retry_after`
  seconds and retry. `code: quota_exceeded` means the month is used up: stop.
- **503 `upstream_blocked`** is usually brief: retry after a few seconds.
- **`X-eBay-Cookies`** (your own eBay session) is optional. eBay can limit or
  close the account it belongs to, so leave it off unless needed.
- `categoryId` on an item is the filter you sent, not the item's category.

## What the terms allow

Allowed: research, pricing and buying decisions, tools for your own business,
showing the data to users of your own product, and keeping the data after a
subscription ends. Every plan allows commercial use.

Not allowed without written permission: reselling or handing out the data as a
feed, bulk export or API, or building a competing service. Also no bypassing
limits and no sharing keys.

## Other ways to get eBay sold data

- **Terapeak / Product Research** (eBay Seller Hub): free with a seller account,
  about three years of history, a dashboard only, no API.
- **eBay Marketplace Insights API**: official, 90 days, closed to new applicants.
- **eBay Browse API**: free, active listings only.
- **eBay Finding API** (`findCompletedItems`): shut down in February 2025.

## Tests

```bash
python3 test_soldcomps.py
```
