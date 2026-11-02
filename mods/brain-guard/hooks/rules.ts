// Brain Guard rules: the three HARD LIMITS as checks on a tool call.
// (a) irreversible destruction of data, (b) spending real money,
// (c) messaging any human other than Joshua's own channels.
// Pure functions, no engine calls, so tests can hit them directly.

export type Limit = 'a' | 'b' | 'c'
export type Hit = { limit: Limit; reason: string }

export const JOSHUA_EMAILS = ['jsgrigson@gmail.com']
export const JOSHUA_SLACK = ['U09A11P5S15']

export const LIMIT_NAME: Record<Limit, string> = {
  a: 'irreversible destruction',
  b: 'real money',
  c: 'messaging someone else',
}

// Paths where deleting is housekeeping, not destruction.
const SAFE_DELETE = /^(\/tmp\/|\.?\/?node_modules\b|\.?\/?dist\b|\.?\/?build\b|\.?\/?\.cache\b)/

const BASH_RULES: Array<[RegExp, string]> = [
  [/\bgit\s+push\b[^\n]*\s(--force(?!-with-lease)\b|-f\b|-\w*f\w*\b)/, 'force-push (can overwrite work on the remote)'],
  [/\bgit\s+push\b[^\n]*\s\+\S/, 'force-push via +refspec'],
  [/\bgit\s+push\b[^\n]*\s(--delete\b|-d\b|:\S)/, 'deletes a remote branch or tag'],
  [/\bgit\s+reset\b[^\n]*--hard\b/, 'git reset --hard discards uncommitted work'],
  [/\bgit\s+clean\b[^\n]*\s-\w*f/, 'git clean -f deletes untracked files'],
  [/\bgit\s+branch\b[^\n]*\s-D\b/, 'force-deletes a local branch'],
  [/\bgit\s+checkout\b[^\n]*\s--\s/, 'git checkout -- discards changes to files'],
  [/\bgit\s+restore\b(?![^\n]*--staged)/, 'git restore discards changes to files'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'drops stashed work'],
  [/\bfind\b[^\n]*\s-delete\b/, 'find -delete removes files'],
  [/\b(shred|mkfs\S*|dd\s+[^\n]*of=\/dev\/)/, 'wipes data or a device'],
]

const segments = (cmd: string) => cmd.split(/&&|\|\||[;|\n]/).map(s => s.trim()).filter(Boolean)

const rmHit = (seg: string): string | null => {
  const m = seg.match(/^(?:sudo\s+)?rm\s+(.*)$/)
  if (!m || !m[1]) return null
  const tokens = m[1].split(/\s+/)
  const flags = tokens.filter(t => t.startsWith('-')).join('')
  const isRecursive = /r|R|--recursive/.test(flags)
  if (!isRecursive) return null
  const targets = tokens.filter(t => !t.startsWith('-'))
  if (targets.length > 0 && targets.every(t => SAFE_DELETE.test(t.replace(/^["']|["']$/g, '')))) return null
  return `recursive rm of ${targets.join(' ') || '(no path)'}`
}

export const checkBash = (command: string): Hit | null => {
  for (const seg of segments(command)) {
    const rm = rmHit(seg)
    if (rm) return { limit: 'a', reason: rm }
  }
  for (const [re, reason] of BASH_RULES) if (re.test(command)) return { limit: 'a', reason }
  return null
}

const TOOL_RULES: Array<[RegExp, Limit, string]> = [
  // (a) destruction
  [/^mcp__Google_Drive__trash_file$/, 'a', 'trashes a Drive file (Brain is append-only)'],
  [/^mcp__Gmail__(trash_|delete_)/, 'a', 'deletes or trashes mail'],
  [/^mcp__Claude_Docs__delete$/, 'a', 'deletes a doc'],
  [/^mcp__Cloudflare_Developer_Platform__\w+_delete$/, 'a', 'deletes a Cloudflare resource'],
  [/^mcp__Higgsfield__(delete_|unpublish_project|archive_project)/, 'a', 'deletes Higgsfield work'],
  [/^mcp__Adobe_for_creativity__boards_delete$/, 'a', 'deletes a Firefly board'],
  [/^mcp__github__delete_file$/, 'a', 'deletes a file on GitHub'],
  [/^mcp__claude-code-remote__delete_trigger$/, 'a', 'deletes a scheduled task and every session it started'],
  [/^mcp__claude-code-remote__archive_session$/, 'a', 'archives a session'],
  // (b) money
  [/^mcp__Robinhood_Trading__(place_\w+_order|exercise_option)$/, 'b', 'places a Robinhood order'],
  [/^mcp__Higgsfield__(generate_\w+|upscale_\w+|ai_influencer_generate|ads_studio_generate|shorts_studio_create|execute_preset|dubbing|voice_change|motion_control|outpaint_image|reframe|create_voice\w*|scene_builder_3d_generate_\w+)$/, 'b', 'spends Higgsfield credits'],
  // (c) messaging other people
  [/^mcp__Higgsfield__(publish_\w+|tiktok_prepare_publish|deploy_website)$/, 'c', 'publishes publicly'],
  [/^mcp__Zapier__execute_zapier_write_action$/, 'c', 'runs a Zapier write action (can post or send)'],
]

const onlyJoshuaEmail = (lists: unknown[]) => {
  const all = lists.flatMap(l => (Array.isArray(l) ? l : [])).map(x => String(x).toLowerCase().trim())
  return all.length > 0 && all.every(addr => JOSHUA_EMAILS.some(j => addr === j || addr.endsWith(`<${j}>`)))
}

export const checkTool = (tool: string, input: Record<string, unknown>): Hit | null => {
  if (tool === 'Bash') return checkBash(String(input.command ?? ''))

  if (tool === 'Artifact' && input.action === 'delete') return { limit: 'a', reason: 'deletes a published artifact' }

  if (/^mcp__Gmail__(send_message|reply|forward)$/.test(tool)) {
    if (input.draftId || (tool === 'mcp__Gmail__reply' && !input.to)) {
      return { limit: 'c', reason: 'sends mail to recipients the guard cannot see' }
    }
    return onlyJoshuaEmail([input.to, input.cc, input.bcc])
      ? null
      : { limit: 'c', reason: `sends mail to ${[input.to, input.cc, input.bcc].flat().filter(Boolean).join(', ')}` }
  }

  if (/^mcp__Slack__slack_(send_message|schedule_message)$/.test(tool)) {
    const ch = String(input.channel_id ?? '')
    return JOSHUA_SLACK.includes(ch) ? null : { limit: 'c', reason: `posts to Slack ${ch}` }
  }

  for (const [re, limit, reason] of TOOL_RULES) if (re.test(tool)) return { limit, reason }
  return null
}

export const summarize = (tool: string, input: Record<string, unknown>) => {
  if (tool === 'Bash') return String(input.command ?? '').slice(0, 300)
  const keys = Object.keys(input).filter(k => !['tool', 'tool_use_id', 'consent'].includes(k))
  const shown = keys.slice(0, 4).map(k => `${k}=${JSON.stringify(input[k])?.slice(0, 80)}`)
  return `${tool} ${shown.join(' ')}`.slice(0, 300)
}
