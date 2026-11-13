# Xbox agent

A small agent that holds Joshua's Xbox sign-in and runs the console while he's away. It runs from GitHub Actions every 30 minutes and costs nothing, because bananapoop is a public repo and Actions minutes are free for public repos.

```
 GitHub Actions cron (every 30 min)          workflow_dispatch (login / wake / off / launch / clips / digest / status)
            │                                              │
            ▼                                              ▼
   ┌─────────────────────┐  sealed refresh token  ┌──────────────────────────┐
   │ agent.js            │◀──────────────────────▶│ branch xbox-agent-state  │
   │ refresh MS token →  │   (AES-256-GCM, key    │ state.enc only           │
   │ Xbox user → XSTS    │    = XBOX_STATE_KEY)   └──────────────────────────┘
   └─────────┬───────────┘
             │ each job decides from config.json whether it's due
   ┌─────────┼──────────┬───────────┬───────────┬──────────┬───────────┐
   ▼         ▼          ▼           ▼           ▼          ▼
 clips    friends    warmup      bedtime     idle-off    digest
 03:00    every tick weekdays    23:30       2 ticks on  Sun 10:00
   │         │       17:15          │        Home →off      │
   │ mp4 → ffmpeg 9:16                 Xbox cloud API (xccs / peoplehub / mediahub / titlehub)
   ▼
 Apps Script web app (Joshua's Google) → Drive "TheGamerzFeed/Xbox clips"
             all jobs ──► ntfy topic ──► ntfy app on Joshua's phone
```

| Stage | Job | Why it exists |
|---|---|---|
| Cron / dispatch | Starts a run every 30 min, or on demand from the GitHub app | Free scheduler; nothing to host |
| agent.js | Swaps the sealed refresh token for Xbox tokens, then runs the jobs | One sign-in, then hands-off |
| State branch | Holds `state.enc`, the only state | The repo is public, so the state is encrypted |
| clips | Pulls new Game DVR clips nightly, cuts them to 1080×1920, drops them in Drive | Feeds TheGamerzFeed without touching the console |
| friends | Pings when a favorite friend gets into a game | "Kianni is on CoD" |
| warmup | Weekdays 17:15: wakes the Xbox and launches CoD | Updates finish before he sits down |
| bedtime | 23:30: powers off | School-night / kid schedule |
| idle-off | On but parked on Home for ~1 h: powers off | The cloud-side stand-in for "off when the TV goes off" |
| digest | Sunday: hours by game, titles played, gamerscore gained | Weekly look at play time |
| meta | When CoD is running: reads the mode from Xbox rich presence and sends the current meta from wzhub.gg (Warzone: top builds with attachments and loadout code; MW4 MP: tier list; DMZ: link) | "What should I run?" answered when you load in |
| ntfy | Every message to the phone | No email, no Slack, his own channel |

## Setup (one time)

1. **Microsoft app registration**: follow the 11-07 handoff (portal.azure.com → Entra ID → App registrations → New, personal accounts, "Allow public client flows" = Yes). Copy the Application (client) ID.
2. **Drive drop**: script.google.com → New project → paste `drop/Code.gs` → set `DROP_KEY` → Deploy → Web app (Execute as Me, access Anyone) → copy the `/exec` URL.
3. **Repo secrets** (bananapoop → Settings → Secrets and variables → Actions): `XBOX_CLIENT_ID`, `XBOX_STATE_KEY`, `NTFY_TOPIC`, `DRIVE_DROP_URL`, `DRIVE_DROP_KEY`.
4. **Phone**: install ntfy and subscribe to the `NTFY_TOPIC` topic.
5. **Sign in**: Actions → Xbox agent → Run workflow → `login`. The code arrives on the phone; enter it at microsoft.com/link.

Scheduled runs only fire from the repo's default branch. Until the secrets exist, every run exits in seconds without doing anything.

## Config (`config.json`)

All times are in `America/Chicago`. `days` uses 0 = Sunday. `friends.watch` is a list of gamertags; empty means favorites, or everyone if no friend is a favorite. `bedtime` takes several entries, for example an earlier school-night time.

## Limits

- The Xbox endpoints are unofficial (the same ones the Xbox app and Home Assistant use) and can change. Nothing here has run against the real console yet.
- It can't see the screen, play for you, or force a specific update.
- Cron runs can be up to ~30 min late. Pings and the warmup land within that window.
- Meta comes from wzhub.gg's pages; if they change their layout, the ping says the page changed instead of sending junk. Whether CoD's Xbox rich presence names the mode is unverified; if it doesn't, you get the Warzone list once a day, labelled "couldn't read your mode". Manual: Run workflow → `meta` with warzone / mp / dmz.
- Clips over 36 MB after the 9:16 cut are skipped (an Apps Script request limit). The phone is told when one is skipped.
- Your own gameplay clips are fine for TheGamerzFeed, but Content Rewards campaigns like the MW4 trailer allow only the campaign's own footage.

`npm test` runs 21 offline checks against a fake Microsoft and Xbox Live, plus one real ffmpeg cut.
