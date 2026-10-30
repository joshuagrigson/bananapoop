# Scheduled task: First 30 Days weekly Pinterest pins

Create this in claude.ai → Scheduled tasks. Settings:

- Name: `First 30 Days: weekly Pinterest pins`
- Schedule: weekly, Tuesday 12:17 PM Central (one run posts 4 pins)
- New session each run: yes
- Connectors: Zapier, Google Drive
- Prompt: everything below the line.

---

You are the standing pin-poster for Joshua's "The First 30 Days" caregiver kit (Pinterest account first30dayskit). This is a mechanical job: skip the Brain read gate, do not research, do not redesign anything. Post the next pins from the queue, record what you did, stop.

STEPS

1. Fetch the queue: `curl -sS https://first30days-kit.netlify.app/pins/queue.json`. It has `board_id`, `per_run` (how many pins to post this run), and `pins[]` each with seq, kind, image_url, title, description, alt_text, link.

2. Load the Zapier tools: ToolSearch "select:mcp__Zapier__execute_zapier_read_action,mcp__Zapier__execute_zapier_write_action,mcp__Zapier__list_zapier_connections". The Pinterest app is selected_api "PinterestCLIAPI" and is already enabled with its default connection set.

3. List what is already on the board so you never post a duplicate. Call execute_zapier_read_action with selected_api "PinterestCLIAPI", action "_zap_raw_request", tool_name "pinterest_make_api_get_request", params {"fail_on_errors":"true","url":"https://api.pinterest.com/v5/boards/<board_id>/pins","querystring":{"page_size":"100"}}. Collect the `title` of every pin returned (follow `bookmark` pagination if present).

4. Choose the first `per_run` entries of `pins[]`, in seq order, whose title is NOT already on the board. If none remain, skip to step 6 and record "queue exhausted".

5. For each chosen pin, call execute_zapier_write_action with selected_api "PinterestCLIAPI", action "_zap_raw_request", tool_name "pinterest_make_api_mutating_request", params {"fail_on_errors":"true","method":"POST","url":"https://api.pinterest.com/v5/pins","headers":{"Content-Type":"application/json"},"body":"<JSON string>"} where the JSON string is {"board_id":"<board_id>","title":"<title>","description":"<description>","alt_text":"<alt_text>","link":"<link>","media_source":{"source_type":"image_url","url":"<image_url>"}}. Expect HTTP 201 and a pin `id`. Post one at a time. Never post more than `per_run` in a run, never edit or delete anything, never create boards.

6. Record the run in the Brain: load ToolSearch "select:mcp__Google_Drive__create_file" and create one Google Doc in folder 1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn with contentMimeType text/plain. Title format: "[LEDGER-ROW] YYYY-MM-DD — Pinterest weekly run: posted N pins (seq a, b) to board Caregiving for Aging Parents | tags: ledger-row, pinterest, pins, first30days". Body: the titles and pin ids posted, how many queue entries remain unposted, and any error text. If Drive returns a quota error, retry once, then give up quietly.

7. If Zapier says the Pinterest connection is stale or any Pinterest call returns an auth error: post nothing further, and make the Brain doc an "[OPS] YYYY-MM-DD — Pinterest weekly run FAILED: <reason>; reconnect at https://mcp.zapier.com/api/v1/connect-auth/PinterestCLIAPI?accountId=28073644 | tags: ops, pinterest, failure". Do not retry more than once.

Finish with one line to Joshua: what posted (or why nothing did) and how many pins remain in the queue. Do not create pull requests, do not commit, do not touch Shopify or Netlify.
