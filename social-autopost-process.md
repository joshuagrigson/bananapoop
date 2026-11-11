# How the faceless pages get posted automatically

Written 2026-11-11 from the Brain record (BUILD / DECISION / STATE / LEDGER-ROW docs, Nov 3–10) and the two
posting branches in this repo (`claude/determined-feynman-rybagt`, `claude/upbeat-meitner-rarzwt`).
Everything marked VOLATILE can drift; the trigger IDs and connection IDs are what was live on 2026-11-10.

**Short answer on TikTok:** no, this exact pipeline does not reach TikTok. The two surfaces it posts through
(Zapier's Facebook Pages app and Meta Business Suite) are Meta-only, and Pinterest is its own API. TikTok needs
one of the four routes in section 8. The content side (reels, captions, queue files, scheduling, ledger) carries
over unchanged.

---

## 1. The pipeline in one picture

```
 ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────────┐
 │ A. MAKE         │    │ B. HOST          │    │ C. QUEUE          │    │ D. SCHEDULE          │
 │ reels (build.py)│───▶│ mp4 → Shopify CDN│───▶│ dated JSON in repo│───▶│ claude.ai scheduled  │
 │ pins/posts      │    │ png → Netlify    │    │ (what, when, url) │    │ task bound to a      │
 │ (Playwright png)│    │                  │    │                   │    │ session w/ Zapier    │
 └─────────────────┘    └──────────────────┘    └───────────────────┘    └──────────┬───────────┘
                                                                                     │ fires, reads queue
                                                                                     ▼
 ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────────┐
 │ G. LEDGER       │◀───│ F. VERIFY        │◀───│ E. POST           │    │ E'. ENGAGE           │
 │ [LEDGER-ROW] in │    │ read post back   │    │ Zapier → FB page  │───▶│ Meta "Comment to     │
 │ the Brain       │    │ (post_by_you,    │    │ Zapier → Pinterest│    │ message": READY → DM │
 │                 │    │ GET /v5/pins)    │    │ Business Suite→IG │    │ with the kit link    │
 └─────────────────┘    └──────────────────┘    └───────────────────┘    └──────────────────────┘
```

| Stage | What it does | Why it exists | What flows out |
|---|---|---|---|
| A. Make | Renders reels (1080x1920 mp4) and pin/post images (1000x1500 png) from JSON scripts and HTML templates | Faceless means no camera; everything is generated | mp4 + png + captions |
| B. Host | Puts media at a public HTTPS URL | Every posting API takes a URL, never a file upload | Shopify CDN / Netlify URLs |
| C. Queue | Dated JSON files in the repo: one entry per post | Scheduling lives in data, so a run only has to find "today" | queue entries |
| D. Schedule | claude.ai scheduled tasks fire a Claude session on a cron | The platforms have no scheduled-publish field (Zapier) or a 29-day cap (Meta) | a session with the Zapier connector |
| E. Post | Zapier actions (Facebook Pages, Pinterest raw API) or Meta Business Suite by hand | The only writable surfaces for a Page, a board, an IG account | post / pin / reel IDs |
| E'. Engage | Meta comment-keyword automation sends the free card + kit link by DM | Links in captions get throttled; the DM is the sales step | DMs |
| F. Verify | Reads the post back before claiming success | Receipts rule; a 201 is not "it is live" | evidence |
| G. Ledger | One `[LEDGER-ROW]` Brain doc per run | Append-only record a later session can trust | Brain docs |

---

## 2. Stage A: making the content

### Reels (video)
- Scene template: `explainer/scenes/reel.html` (full-bleed photo with slow push-in, serif hook with yellow
  highlights, burned-in karaoke captions at 66vh so Facebook's UI never covers them, logo pill, CTA pill).
- Script per reel: `explainer/reels/90-days-ready/<name>.json` (hook, line cards, voice, cta field).
- Voice: Kokoro TTS (`af_heart` / `am_onyx`). Images: Qwen-Image on ZeroGPU (quota ~8 images/day), then
  Pollinations as the free fallback (crop the bottom 5% to lose the watermark).
- Build command:

```bash
RENDER_FMT=jpeg python3 explainer/scripts/build.py explainer/reels/90-days-ready/<name>.json \
  --out <dir> --scene explainer/scenes/reel.html --assets qwen
```

- Output: `final/pah-*.mp4`, 27–46 s, 1080x1920, h264 + aac. Keep reels under 90 s so Facebook files them as Reels.
- Captions live next to the scripts in `CAPTIONS.md`. Reel captions carry **no link** (link posts get less reach);
  the link goes out in the READY DM instead.
- A second generation of reels (`prepared-at-home/reels/reel-v01…v07.mp4`) was rendered with `reel-90day.mjs`.

### Pins and page-post images
- `caregiver-kit/pins-queue.mjs` renders 1000x1500 pin cards with Playwright from the kit page PNGs and writes
  `caregiver-kit/site/pins/queue.json` (title, description, alt text, link with UTM, image URL).
- Page-post images are the same cards or the kit covers under `prepared-at-home/social/`.

### Rules that keep it faceless
- No contact info, no personal profile anywhere on the Page or the IG account.
- Facebook groups are off the table: Pages cannot join the caregiver groups, and posting from the personal
  profile would tie Josh Grigson to the brand. Groups are by hand only, if at all.

---

## 3. Stage B: hosting

| Media | Where | Why |
|---|---|---|
| mp4 reels | Shopify Files via `stagedUploadsCreate` → multipart POST → `fileCreate` (GenericFile); URL looks like `cdn.shopify.com/s/files/…/pah-power-out.mp4` | The repo is private, so GitHub URLs do not work; Shopify CDN was already in hand and serves `video/mp4` |
| pin + post images | `first30days-kit.netlify.app/pins/q/qNN.png` and `preparedathome.netlify.app/img/*.png` | Static, public, already deployed. The old `first30days-kit` site must stay live because the queue points at it |

Check the URL with a plain fetch (200 and the right content type) before it goes into a queue.

---

## 4. Stage C: the queue files

All three live on branch `claude/determined-feynman-rybagt`.

**`prepared-at-home/social/fb-weekly-queue.json`** – one Facebook page post per Thursday, Nov 12 → Jan 28:

```json
{
  "page_id": "1340911372449312",
  "zapier": {
    "selected_api": "FacebookV2CLIAPI",
    "action": "page_photo",
    "tool_name": "facebook_pages_create_page_photo",
    "connection_id": "02e3e8ac-d32e-842c-92fd-92dd15e6b0c7"
  },
  "schedule": "Thursdays 18:13 America/Chicago; post the entry whose date is today, else do nothing",
  "posts": [
    { "date": "2026-11-12", "image": "https://preparedathome.netlify.app/img/90-day-kit-paycheck-plan.png",
      "message": "…caption…\n\nhttps://preparedathome.netlify.app/?s=fb#ready" }
  ]
}
```

**`caregiver-kit/site/pins/queue.json`** – 20 pins for the Caregiving for Aging Parents board, `per_run: 4`.
Each entry: `seq, kind, image_url, title, description, alt_text, link`. The run dedups by title against the live
board, so a reposted queue never double-pins.

**`prepared-at-home/social/storm-state.json`** – state for the storm-alert task (`last_post_utc`, 4-day cooldown).

Design rule: the task reads "today" from the queue and stays silent otherwise. Adding a post = adding a dated entry
and committing. No task edits.

---

## 5. Stage D: scheduling

Two mechanisms, both claude.ai scheduled tasks that wake a Claude session.

| Task | Schedule | Mechanism | Trigger (VOLATILE) |
|---|---|---|---|
| Weekly FB page post | Thu 6:13 PM CT (`CRON_TZ=America/Chicago 13 18 * * 4`) | cron, bound to a session that holds the Zapier connector | `trig_01BkRDM9sC7f5qn98xE4AxHf` |
| Weekly Pinterest run | weekly, 4 pins per run | cron, fresh session created by hand in claude.ai | `trig_01AGx4dHparXRfVk9uAoNiqX` |
| Reels 2–5 | 7:13 PM CT on Nov 6 / 8 / 11 / 13 | one-shot `send_later` into the session that posted reel 1 | `trig_01RDdujo…`, `01SfwKu2…`, `01WUJzr4…`, `012qVqTS…` |
| Storm alert | event-driven, 4-day cooldown | scheduled check + `storm-state.json` | – |

The one rule that matters: **a trigger created from a cloud session with `create_new_session_on_fire` carries no
connectors.** Either bind the task to an existing session that already has Zapier (`send_later` or
`persistent_session_id`), or create the task by hand in claude.ai Scheduled tasks where all connectors attach.
Session-bound posting was verified live on Nov 5 (Post 2) and has fired cleanly since.

Why not schedule inside the platforms: Zapier's Facebook actions have `save_as_draft` but no scheduled time;
Meta Business Suite schedules only 20 minutes to 29 days ahead and only for FB + IG.

---

## 6. Stage E: posting, surface by surface

### Facebook Page (Prepared at Home, page id 1340911372449312) – fully automatic
- Zapier MCP, app `FacebookV2CLIAPI`, connection `02e3e8ac-d32e-842c-92fd-92dd15e6b0c7` passed explicitly
  (the old default connection `67161443` fails with "access_token missing").
- Photo post: action `page_photo` (`facebook_pages_create_page_photo`), params `page`, `source` (URL), `message`.
- Reel: action `page_video` (`facebook_pages_create_page_video`) with a vertical mp4 under 90 s. Verified Nov 4:
  it lands as a **Reel** (`facebook.com/reel/<id>`), not a feed video.
- No "comment" action exists, so any link goes in the caption (page posts) or in the DM (reels).
- Post insights are not readable through Zapier (`insightsAvailable:false`); read reach in Business Suite.

### Instagram (@preparedathomekit) – by hand, in bulk
- Meta Business Suite Planner, cross-post FB + IG in one scheduling pass. Seven reels were scheduled on Nov 4 for
  Nov 10 → Dec 1 in one sitting.
- Limits learned: 20 min to 29 days ahead; a reel edited inside Business Suite (music added) cannot be shared
  to IG; Tags are FB-only when cross-posting; IG web cannot edit the bio link (phone app only);
  `business.facebook.com/latest/content_calendar` works, the `instagram_account` settings URL redirect-loops.
- Zapier has no Instagram publishing action in this setup, so IG stays a monthly by-hand batch.

### Pinterest (account preparedathomekit) – fully automatic
- Zapier raw API calls to Pinterest: `POST /v5/pins` (and `POST /v5/boards` for a new board). Both need
  `fail_on_errors`, and GETs also need `method`.
- Boards: Caregiving for Aging Parents `669769844523888735`; Emergency Prep on a Budget `669769844523890493`;
  Products `669769844523888746`.
- Dedup by title against the live board before each post. `alt_text` cannot be set through Zapier and
  `PATCH /v5/pins` is blocked, so a wrong link means a hand edit on pinterest.com.
- Gotcha that bit once: a run rewrote `preparedathome.netlify.app` to `preparedathomekit.netlify.app`
  (confused the domain with the Pinterest username) and produced a 404 pin. The task prompt now says to copy the
  queue link byte for byte and verify the returned link equals it.

### Facebook groups – by hand only
Facebook ended third-party group posting in 2024; Zapier has no group action; automating the personal profile in
Chrome risks Joshua's own account. Groups are a manual, optional lane.

---

## 7. Stages E', F, G: engagement, verification, ledger

**READY automation (live since Nov 4, verified by Joshua's own test comment).** Meta Business Suite → Inbox →
Automations → "Comment to message". Keywords READY / Ready / ready on Messenger + Instagram. Public reply
"Sent! Check your messages 📬"; private message = free Water Card PDF + the $9 kit link. Page-wide, so every reel
and post uses the same keyword.

**Verify before claiming.** After a Facebook post, read `facebook_pages_new_post_by_you` and confirm type, link,
caption, duration. After a pin, `GET /v5/pins/<id>` and compare `link` to the queue. A 201 alone is never "live".

**Ledger.** Every run writes one `[LEDGER-ROW] YYYY-MM-DD — <what posted, ids, links>` doc to the Brain. The
Nov 14 check-back counts five reels on the page and at least one READY comment.

---

## 8. TikTok: what carries over and what does not

Carries over unchanged: stages A, B, C, F, G. The reels are already the right shape (9:16, under 60 s is ideal,
burned-in captions, no link in caption). Captions need a TikTok edit: shorter, hashtags matter more, and the CTA
becomes "comment READY" only if a DM path exists (TikTok has no comment-to-DM automation for a new account, so on
TikTok the CTA is "link in bio" or the Shopify/Netlify URL spoken on screen).

Does not carry over: stage E. Nothing in the current stack can publish to TikTok:

- Zapier's TikTok apps are ads and lead-gen only; there is no organic "upload video" action.
- Meta Business Suite posts to Facebook and Instagram only.
- Pinterest is its own API.

Four routes, in the order I would try them:

| Route | Unattended? | Cost | What it takes | Verdict |
|---|---|---|---|---|
| **1. Higgsfield MCP** (`tiktok_connect` → `tiktok_prepare_publish`, `DIRECT_POST` or `UPLOAD_TO_DRAFT`) | No. The user submits a review widget per post, and the client must support MCP Apps (desktop app, not a scheduled cloud run) | $0 extra, Higgsfield Pro is already paid | Connect the TikTok account once (no account connected as of 2026-11-11). Media must be uploaded to Higgsfield first (mp4 fine; images must be JPEG/WebP, PNG is rejected) | Best semi-automatic route today: Claude does everything up to the Post button. Not a cron job |
| **2. Third-party scheduler** (Buffer, Metricool, Later, Publer; or Upload-Post / TokPortal as a Zapier action) | Yes | Free tiers exist for 1–3 channels; paid from ~$6–$20/mo per channel set | A new account, TikTok OAuth, then the same dated-queue task calls their API or Zapier action | The only true cron path. Spending money needs Joshua's yes (HARD LIMIT b) |
| **3. Own TikTok developer app** (Content Posting API) | Yes, after audit | $0 | Register an app, pass TikTok's audit. Unaudited apps can only post to **private** accounts (max 5 users/24 h), and the publish call is blocked for public accounts | Not viable for a growth page until audited; audits reject internal-use apps |
| **4. By hand from the phone** | No | $0 | Reels delivered via SendUserFile with captions; Joshua posts in the app | What TheGamerzFeed does now, and what Content Rewards effectively requires (a clip must be submitted within ~24 min of going live, so posting and submitting happen together) |

Two facts that shape the choice: Joshua does not use TikTok personally (the account is a posting slot), and the
clipping campaign pays 37% more on TikTok than on Instagram ($1.85 vs $1.35 per 1k), which is why a TikTok
@thegamerzfeed is on the list. For the clipping page route 4 is already the right one because of the submission
window. For Prepared at Home, route 1 gets a weekly TikTok batch down to one review click per reel; route 2 is
the upgrade if TikTok starts to pull its weight.

---

## 9. Gotchas worth remembering

- Zapier connection with no default set looks like an expired login ("access_token missing"). Fix is the default
  connection id, not a reconnect.
- Every overlay layer in `reel.html` needs its own z-index; the first render showed photos only. Sample frames,
  do not trust the build exit code.
- Instagram desktop: the big "+" on the profile is Story highlights; the sidebar "+" is Create; the crop step
  defaults to square and cuts the on-screen text, pick Original / 9:16.
- Positive-only image prompts held: no gas masks or weapons in 25 generated images.
- Drive search drops brackets and silently omits docs; read Brain docs by ID when an ID is known.
