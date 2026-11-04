// Brain Guard rules: the three HARD LIMITS as checks on a tool call.
// (a) irreversible destruction of data, (b) spending real money,
// (c) messaging any human other than Joshua's own channels.
// Pure functions, no engine calls, so tests can hit them directly.
//
// Every hit carries plain words for the dialog: `what` (what will happen,
// for real) and `undo` (whether and how it can be reversed). The dialog is
// read by a person deciding fast; write for that, never in jargon.

export type Limit = 'a' | 'b' | 'c'
export type Hit = { limit: Limit; what: string; undo: string }

export const JOSHUA_EMAILS = ['jsgrigson@gmail.com']
export const JOSHUA_SLACK = ['U09A11P5S15']

export const LIMIT_NAME: Record<Limit, string> = {
  a: 'it destroys data',
  b: 'it spends real money',
  c: 'it contacts someone other than you',
}

const NO_UNDO = 'No. Once it runs it is gone.'
const SENT = 'No. Once sent, it cannot be unsent.'

// Paths where deleting is housekeeping, not destruction.
const SAFE_DELETE = /^(\/tmp\/|\.?\/?node_modules\b|\.?\/?dist\b|\.?\/?build\b|\.?\/?\.cache\b)/

const BASH_RULES: Array<[RegExp, string, string]> = [
  [/\bgit\s+push\b[^\n]*\s(--force(?!-with-lease)\b|-f\b|-\w*f\w*\b)/, 'force-push: replaces the branch on GitHub with this copy, wiping any commits there that are not here', 'Only if someone still has the wiped commits locally.'],
  [/\bgit\s+push\b[^\n]*\s\+\S/, 'force-push: replaces the branch on GitHub with this copy, wiping any commits there that are not here', 'Only if someone still has the wiped commits locally.'],
  [/\bgit\s+push\b[^\n]*\s(--delete\b|-d\b|:\S)/, 'delete a branch or tag on GitHub', 'Only by pushing it again from a copy that still has it.'],
  [/\bgit\s+reset\b[^\n]*--hard\b/, 'throw away every uncommitted change in this repo', NO_UNDO],
  [/\bgit\s+clean\b[^\n]*\s-\w*f/, 'delete every file git is not tracking in this repo', NO_UNDO],
  [/\bgit\s+branch\b[^\n]*\s-D\b/, 'delete a local git branch, including any commits that exist only on it', 'Hard: only from git\'s local history, and never once this container is gone.'],
  [/\bgit\s+checkout\b[^\n]*\s--\s/, 'throw away uncommitted edits to the named files', NO_UNDO],
  [/\bgit\s+restore\b(?![^\n]*--staged)/, 'throw away uncommitted edits to the named files', NO_UNDO],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'delete saved (stashed) work', 'Hard: only from git\'s local history.'],
  [/\bfind\b[^\n]*\s-delete\b/, 'delete every file the search matches', NO_UNDO],
  [/\b(shred|mkfs\S*|dd\s+[^\n]*of=\/dev\/)/, 'wipe data or a whole disk', NO_UNDO],
]

const segments = (cmd: string) => cmd.split(/&&|\|\||[;|\n]/).map(s => s.trim()).filter(Boolean)

const rmHit = (seg: string): Hit | null => {
  const m = seg.match(/^(?:sudo\s+)?rm\s+(.*)$/)
  if (!m || !m[1]) return null
  const tokens = m[1].split(/\s+/)
  const flags = tokens.filter(t => t.startsWith('-')).join('')
  if (!/r|R|--recursive/.test(flags)) return null
  const targets = tokens.filter(t => !t.startsWith('-'))
  if (targets.length > 0 && targets.every(t => SAFE_DELETE.test(t.replace(/^["']|["']$/g, '')))) return null
  return {
    limit: 'a',
    what: `permanently delete ${targets.join(' ') || 'files'} and everything inside`,
    undo: 'No. There is no trash can here.',
  }
}

export const checkBash = (command: string): Hit | null => {
  for (const seg of segments(command)) {
    const rm = rmHit(seg)
    if (rm) return rm
  }
  for (const [re, what, undo] of BASH_RULES) if (re.test(command)) return { limit: 'a', what, undo }
  return null
}

const TOOL_RULES: Array<[RegExp, Limit, string, string]> = [
  // (a) destruction
  [/^mcp__Google_Drive__trash_file$/, 'a', 'move a Google Drive file to the trash (the Brain is meant to be append-only)', 'Yes, from Drive\'s trash, for 30 days.'],
  [/^mcp__Gmail__(trash_|delete_)/, 'a', 'trash or delete email', 'Trash: yes, for 30 days. Delete: no.'],
  [/^mcp__Claude_Docs__delete$/, 'a', 'delete a Claude doc', NO_UNDO],
  [/^mcp__Cloudflare_Developer_Platform__\w+_delete$/, 'a', 'delete a Cloudflare database, bucket or store and its data', NO_UNDO],
  [/^mcp__Higgsfield__(delete_|unpublish_project|archive_project)/, 'a', 'delete or take down Higgsfield work', 'Probably not.'],
  [/^mcp__Adobe_for_creativity__boards_delete$/, 'a', 'delete a Firefly board', NO_UNDO],
  [/^mcp__github__delete_file$/, 'a', 'delete a file on GitHub (as a new commit)', 'Yes, by reverting the commit.'],
  [/^mcp__claude-code-remote__delete_trigger$/, 'a', 'delete a scheduled task and every session it ever started', NO_UNDO],
  [/^mcp__claude-code-remote__archive_session$/, 'a', 'archive a Claude session and shut down its container', 'Partly: it can be unarchived, but uncommitted files in it are lost.'],
  // (b) money
  [/^mcp__Robinhood_Trading__(place_\w+_order|exercise_option)$/, 'b', 'place a real Robinhood trade with real money', 'Only by trading back, at whatever the price is then.'],
  [/^mcp__Higgsfield__(generate_\w+|upscale_\w+|ai_influencer_generate|ads_studio_generate|shorts_studio_create|execute_preset|dubbing|voice_change|motion_control|outpaint_image|reframe|create_voice\w*|scene_builder_3d_generate_\w+)$/, 'b', 'spend paid Higgsfield credits', 'No. Credits are spent when it starts.'],
  // (c) messaging other people
  [/^mcp__Higgsfield__(publish_\w+|tiktok_prepare_publish|deploy_website)$/, 'c', 'publish publicly where other people will see it', 'Only by taking it down after people may have seen it.'],
  [/^mcp__Zapier__execute_zapier_write_action$/, 'c', 'run a Zapier action that can post, send or change things in another app', 'Depends on the app; assume no.'],
]

const recipients = (input: Record<string, unknown>) =>
  [input.to, input.cc, input.bcc].flatMap(l => (Array.isArray(l) ? l : [])).map(x => String(x).toLowerCase().trim())

const onlyJoshua = (all: string[]) =>
  all.length > 0 && all.every(addr => JOSHUA_EMAILS.some(j => addr === j || addr.endsWith(`<${j}>`)))

export const checkTool = (tool: string, input: Record<string, unknown>): Hit | null => {
  if (tool === 'Bash') return checkBash(String(input.command ?? ''))

  if (tool === 'Artifact' && input.action === 'delete') {
    return { limit: 'a', what: 'delete a published page; its link stops working for everyone', undo: NO_UNDO }
  }

  if (/^mcp__Gmail__(send_message|reply|forward)$/.test(tool)) {
    if (input.draftId || (tool === 'mcp__Gmail__reply' && !input.to)) {
      return { limit: 'c', what: 'send an email from your Gmail to people this check cannot see', undo: SENT }
    }
    const all = recipients(input)
    return onlyJoshua(all) ? null : { limit: 'c', what: `send an email from your Gmail to ${all.join(', ')}`, undo: SENT }
  }

  if (/^mcp__Slack__slack_(send_message|schedule_message)$/.test(tool)) {
    const ch = String(input.channel_id ?? '')
    return JOSHUA_SLACK.includes(ch) ? null : { limit: 'c', what: `post a Slack message as you in ${ch}`, undo: 'Partly: it can be deleted, but people may have read it.' }
  }

  for (const [re, limit, what, undo] of TOOL_RULES) if (re.test(tool)) return { limit, what, undo }
  return null
}

export const summarize = (tool: string, input: Record<string, unknown>) => {
  if (tool === 'Bash') return String(input.command ?? '').slice(0, 240)
  const keys = Object.keys(input).filter(k => !['tool', 'tool_use_id', 'consent'].includes(k))
  const shown = keys.slice(0, 4).map(k => `${k}=${JSON.stringify(input[k])?.slice(0, 60)}`)
  return `${tool.replace(/^mcp__/, '').replace(/__/g, ' → ')} ${shown.join(' ')}`.slice(0, 240)
}

// The dialog question: plain words, real-not-test up front, the safe
// answer first in the options.
export const question = (hit: Hit, tool: string, input: Record<string, unknown>) =>
  [
    'This is a REAL action, not a test or a sandbox.',
    `Claude wants to ${hit.what}.`,
    `Exactly: ${summarize(tool, input)}`,
    `Can it be undone? ${hit.undo}`,
    `You're asked because ${LIMIT_NAME[hit.limit]}. If you're not sure, block it and ask Claude why. Allow it?`,
  ].join('\n')
