import type { Register } from 'claude-code'

import { contextFor, FILE, listText, matches, normalizePin, parse, relative, serialize } from './crumbs'
import type { Crumb, Staleness } from './crumbs'

let root = ''

const newId = () => {
  try {
    return crypto.randomUUID().slice(0, 8)
  } catch {
    return Math.random().toString(16).slice(2, 10)
  }
}

async function repoRoot($: any): Promise<string> {
  if (root) return root
  const ran = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { timeoutMs: 5_000 })
  root = ran.exitCode === 0 ? ran.stdout.trim() : ''
  return root
}

async function load($: any): Promise<Crumb[]> {
  const r = await repoRoot($)
  if (!r) return []
  try {
    return parse(await $.fs.read(`${r}/${FILE}`))
  } catch {
    return []
  }
}

async function save($: any, crumbs: Crumb[]) {
  const r = await repoRoot($)
  if (!r) throw new Error('not in a git repository')
  await $.fs.write(`${r}/${FILE}`, serialize(crumbs))
}

async function staleness($: any, hits: Crumb[]): Promise<Staleness> {
  const out: Staleness = {}
  for (const c of hits) {
    try {
      const ran = await $.process.run(['git', 'rev-list', '--count', `${c.commit}..HEAD`, '--', c.path], { timeoutMs: 5_000 })
      out[c.id] = ran.exitCode === 0 ? Number(ran.stdout.trim()) : null
    } catch {
      out[c.id] = null
    }
  }
  return out
}

// Adds the crumbs pinned to the file a Read/Edit/Write touched to what the
// model reads after the tool's result.
async function annotate($: any, e: any, next: any) {
  const ran = await next(e)
  if (ran.deny !== undefined) return ran
  try {
    const path = String(e.file_path ?? e.notebook_path ?? '')
    const r = await repoRoot($)
    const rel = path && r ? relative(path, r) : null
    if (!rel) return ran
    const hits = (await load($)).filter(c => matches(c, rel))
    if (!hits.length) return ran
    const text = contextFor(rel, hits, await staleness($, hits))
    const prior = Array.isArray(ran.context) ? ran.context : ran.context ? [String(ran.context)] : []
    return { ...ran, context: [...prior, text] }
  } catch {
    return ran
  }
}

const SECTION = [
  '# Breadcrumbs',
  'Lessons pinned to files arrive after a Read, Edit or Write of that file, as "Breadcrumbs pinned to <path>". They come from earlier sessions of you, so weigh them like your own notes.',
  'When you learn something tied to a specific file or folder (a bug class, a trap, a constraint, how Joshua wants it), call leave_breadcrumb with the repo-relative path (a folder ends in "/") and one plain line. Retire a crumb that no longer holds with retire_breadcrumb. .claude/breadcrumbs.json is a normal repo file: commit it with your work.',
].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'crumbs', description: 'List the breadcrumbs pinned in this repo' })
    await $.tool.register({
      name: 'leave_breadcrumb',
      description:
        'Pin a one-line lesson to a file or folder in this repo, so every later session sees it the moment it reads or edits that path. Use for lessons tied to a place: a bug class, a trap, a constraint, how Joshua wants something. Not for general facts (those go to the Brain).',
      inputSchema: {
        type: 'object',
        required: ['path', 'note'],
        properties: {
          path: { type: 'string', description: 'Repo-relative (or absolute) file path; a folder ends in "/"' },
          note: { type: 'string', description: 'One plain line, under 300 characters' },
        },
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'retire_breadcrumb',
      description: 'Retire a breadcrumb that no longer holds (kept in the file, marked retired, so history stays).',
      inputSchema: {
        type: 'object',
        required: ['id', 'reason'],
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
      },
      isDeferred: false,
    })
    await repoRoot($)
    return next(e)
  })

  on('command.run', { command: 'crumbs' }, async $ => ({ text: listText(await load($)) }))

  on('tool.call', { tool: 'Read' }, ($, e, next) => annotate($, e, next))
  on('tool.call', { tool: 'Edit' }, ($, e, next) => annotate($, e, next))
  on('tool.call', { tool: 'Write' }, ($, e, next) => annotate($, e, next))
  on('tool.call', { tool: 'NotebookEdit' }, ($, e, next) => annotate($, e, next))

  on('tool.call', { tool: 'mcp__breadcrumbs__leave_breadcrumb' }, async ($, e) => {
    const input = e as any
    const r = await repoRoot($)
    if (!r) return { result: 'Not in a git repository; no breadcrumb left.' }
    const pin = normalizePin(String(input.path ?? ''), r)
    const note = String(input.note ?? '').trim().replace(/\s+/g, ' ')
    if (!pin) return { result: `That path is not inside this repo (${r}); no breadcrumb left.` }
    if (!note || note.length > 300) return { result: 'The note must be one line of 1-300 characters; no breadcrumb left.' }
    const head = await $.process.run(['git', 'rev-parse', '--short', 'HEAD'], { timeoutMs: 5_000 })
    const crumb: Crumb = {
      id: newId(),
      path: pin,
      note,
      at: new Date().toISOString().slice(0, 10),
      commit: head.exitCode === 0 ? head.stdout.trim() : 'unknown',
    }
    await save($, [...(await load($)), crumb])
    $.ui.toast(`🍞 Breadcrumb on ${pin}`)
    return { result: `Breadcrumb ${crumb.id} pinned to ${pin}. Commit ${FILE} with your work so other sessions get it.` }
  })

  on('tool.call', { tool: 'mcp__breadcrumbs__retire_breadcrumb' }, async ($, e) => {
    const input = e as any
    const crumbs = await load($)
    const hit = crumbs.find(c => c.id === String(input.id) && !c.retired)
    if (!hit) return { result: `No live breadcrumb with id ${input.id}.` }
    hit.retired = { at: new Date().toISOString().slice(0, 10), reason: String(input.reason ?? '').slice(0, 300) }
    await save($, crumbs)
    return { result: `Breadcrumb ${hit.id} on ${hit.path} retired. Commit ${FILE}.` }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return { sections: [...composed.sections, { id: 'breadcrumbs:how', text: SECTION, scope: 'session' as const }] }
  })
}
