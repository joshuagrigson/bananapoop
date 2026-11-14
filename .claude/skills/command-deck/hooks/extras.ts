// Command Deck extras: a timer, a subagent type, a system-prompt section and
// toasts. Imported by register.tsx; everything here reads the same saved
// Brain snapshot the pane and Wake-Up use.
import type { On } from 'claude-code'

import type { BrainSnapshot } from '../types'

const STORE_KEY = 'brain-snapshot'
const NOTIFIED_KEY = 'overdue-notified'
const OVERDUE_DAYS = 7
const TICK_MS = 5 * 60_000
const WRITE_NUDGE_MIN = 45

const DAY = 86_400_000
const dayOf = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
const ageDays = (iso: string) => Math.round((dayOf(new Date().toISOString()) - dayOf(iso)) / DAY)

// Session-local counters. A reload starts them over, which only delays a nudge.
const session = { startedAt: Date.now(), writes: 0, lastWriteAt: 0, turnsSinceWrite: 0, nudgedAt: 0 }

const minutesSinceWrite = () => Math.round((Date.now() - (session.lastWriteAt || session.startedAt)) / 60_000)
export const isWriteOwed = () => session.turnsSinceWrite > 0 && minutesSinceWrite() >= WRITE_NUDGE_MIN

const BRAIN_READER_PROMPT = `You fetch Joshua's Brain state for his Command Deck. You do not answer anything else.

The Brain is the Google Drive folder 1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn. Do exactly these reads:
1. The newest root MAP: search_files with
   parentId = '1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn' and title contains 'MAP' and title contains 'root' and not title contains 'META' and not title contains 'INBOX'
   Take the newest by createdTime and read it.
2. observatory-brief.json by id 1rP3niqTY1RU7TILKimogE4_xS4mjjcv3.
3. The PROTOCOL LIVE doc that the brief's protocolLive.id names (read it only for its VERSION line).

Then reply with ONE JSON object and nothing else, copying values only from what you read (never invent):
{
  "mapDate": "YYYY-MM-DD of the MAP",
  "observatory": "brief status plus generatedAt, e.g. LIVE (generatedAt 2026-11-02T08:24Z)",
  "protocolVersion": <VERSION number>,
  "docsLast24h": <brief totals.last24h>,
  "hands": [{ "task": "...", "where": "...", "since": "YYYY-MM-DD" }],
  "projects": [{ "name": "...", "status": "one line" }],
  "countdowns": [{ "label": "...", "date": "YYYY-MM-DD" }],
  "lastBuild": "newest BUILD in the MAP HOT SET, one line",
  "lastMiss": "newest META named in the MAP, one line with its fix"
}
HANDS come from the MAP's HANDS QUEUE: "since" = MAP date minus the item's age in days. Projects come from the MAP's STATE block bullets. Countdowns are dated future events the MAP names.
If a read fails, say which one in a top-level "error" field and fill what you can.`

const shortTitle = (t: unknown) => {
  const s = String(t ?? '')
  return s.length > 70 ? `${s.slice(0, 67)}…` : s
}

async function tick($: any) {
  try {
    const b = (await $.store.get(STORE_KEY)) as BrainSnapshot | undefined
    if (b && Array.isArray(b.hands)) {
      const today = new Date().toISOString().slice(0, 10)
      const notified = ((await $.store.get(NOTIFIED_KEY)) as Record<string, string> | undefined) ?? {}
      let changed = false
      for (const item of b.hands) {
        const key = `${item.task}|${item.since}`
        if (ageDays(item.since) > OVERDUE_DAYS && notified[key] !== today) {
          $.ui.toast(`🔴 Overdue now: ${shortTitle(item.task)}`)
          notified[key] = today
          changed = true
        }
      }
      if (changed) await $.store.set(NOTIFIED_KEY, notified)
    }
    if (isWriteOwed() && Date.now() - session.nudgedAt > WRITE_NUDGE_MIN * 60_000) {
      session.nudgedAt = Date.now()
      $.ui.toast(`🧠 No Brain write in ${minutesSinceWrite()} min; one is owed`)
    }
  } catch {
    // A timer tick never matters enough to fail loudly.
  }
}

export const sessionSection = () => {
  const lines = [
    '# Command Deck: this session',
    `Brain writes this session: ${session.writes}${session.lastWriteAt ? `, last ${minutesSinceWrite()} min ago` : ''}.`,
  ]
  if (isWriteOwed()) {
    lines.push(`A Brain write is owed: ${minutesSinceWrite()} min and ${session.turnsSinceWrite} turns since the last one (ZERO-JUDGMENT RULE).`)
  }
  lines.push(
    'For the Brain read gate you can delegate the three reads to the subagent type command-deck:brain-reader; it returns JSON you pass straight to update_deck.',
  )
  return lines.join('\n')
}

// Called from register.tsx's one session.start hook (a module may hook an
// event without a matcher only once).
export async function startExtras($: any) {
  session.startedAt = Date.now()
  await $.agent.register({
    name: 'brain-reader',
    description:
      "Reads Joshua's Brain (root MAP, observatory brief, PROTOCOL LIVE version) and returns the Command Deck JSON for update_deck. Use it for the Brain read gate to keep the big docs out of the main context.",
    prompt: BRAIN_READER_PROMPT,
    tools: ['mcp__Google_Drive__search_files', 'mcp__Google_Drive__read_file_content', 'ToolSearch'],
    model: 'sonnet',
  })
  $.clock.every(TICK_MS, () => tick($))
  void tick($)
}

export const registerExtras = (on: On) => {
  on('prompt.submit', async ($, e, next) => {
    session.turnsSinceWrite += 1
    return next(e)
  })

  on('tool.call', { tool: 'mcp__Google_Drive__create_file' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      session.writes += 1
      session.lastWriteAt = Date.now()
      session.turnsSinceWrite = 0
      $.ui.toast(`🧠 Saved to Brain: ${shortTitle((e as any).title)}`)
    }
    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const cmd = String((e as any).command ?? '')
    if (ran.deny !== undefined) return ran
    const out = `${(ran.result as any)?.stdout ?? ''}\n${(ran.result as any)?.stderr ?? ''}`
    if (/\bgit\s+push\b/.test(cmd)) {
      const failed = ran.isError === true || /rejected|error:|fatal:/i.test(out)
      $.ui.toast(failed ? '⚠️ git push failed' : '⬆️ Pushed to GitHub')
    } else if (/\b(claude plugin test|npm test|npx vitest|pytest|bun test)\b/.test(cmd)) {
      const m = out.match(/(\d+)\s+fail/)
      const fails = m ? Number(m[1]) : ran.isError === true ? 1 : 0
      $.ui.toast(fails > 0 ? `❌ Tests: ${fails} failing` : '✅ Tests passed')
    }
    return ran
  })
}
