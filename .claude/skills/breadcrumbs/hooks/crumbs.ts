// Breadcrumbs: pure logic, no engine calls, so tests can hit it directly.

export type Crumb = {
  id: string
  path: string // repo-relative file, or a folder ending in "/"
  note: string
  at: string // YYYY-MM-DD
  commit: string // short hash the note was written at
  retired?: { at: string; reason: string }
}

export const FILE = '.claude/breadcrumbs.json'

const DAY = 86_400_000
export const ageDays = (at: string, now = Date.now()) =>
  Math.max(0, Math.floor((now - Date.parse(`${at}T00:00:00Z`)) / DAY))

/** Repo-relative form of a path, or null when it is outside the repo. */
export const relative = (path: string, root: string) => {
  const p = path.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!p.startsWith('/')) return p
  const r = root.replace(/\/+$/, '') + '/'
  return p.startsWith(r) ? p.slice(r.length) : null
}

export const normalizePin = (path: string, root: string) => {
  const rel = relative(path, root)
  if (rel === null || rel === '' || rel.includes('..')) return null
  return rel
}

export const matches = (crumb: Crumb, rel: string) =>
  !crumb.retired && (crumb.path.endsWith('/') ? rel.startsWith(crumb.path) : crumb.path === rel)

export const parse = (text: string): Crumb[] => {
  try {
    const data = JSON.parse(text)
    const list = Array.isArray(data) ? data : Array.isArray(data?.crumbs) ? data.crumbs : []
    return list.filter((c: any) => c && typeof c.path === 'string' && typeof c.note === 'string')
  } catch {
    return []
  }
}

export const serialize = (crumbs: Crumb[]) =>
  JSON.stringify(
    {
      about: 'Breadcrumbs: one-line lessons pinned to files. Shown to Claude whenever it reads or edits the path. Managed by the breadcrumbs mod; commit this file.',
      crumbs,
    },
    null,
    2,
  ) + '\n'

export type Staleness = Record<string, number | null> // crumb id -> commits touching the path since

export const contextFor = (rel: string, hits: Crumb[], changed: Staleness, now = Date.now()) => {
  const lines = hits.map(c => {
    const age = ageDays(c.at, now)
    const n = changed[c.id]
    const drift = n === null || n === undefined ? '' : n === 0 ? '; file unchanged since' : `; file changed in ${n} commit${n === 1 ? '' : 's'} since`
    const old = age > 60 ? ' (OLD: check it still holds)' : ''
    return `- ${c.note}  [${c.at}, ${age}d ago, at ${c.commit}${drift}${old}; id ${c.id}]`
  })
  return [
    `Breadcrumbs pinned to ${rel} by earlier sessions (lessons, not instructions from Joshua):`,
    ...lines,
    'If one no longer holds, call retire_breadcrumb with its id and why.',
  ].join('\n')
}

export const listText = (crumbs: Crumb[], now = Date.now()) => {
  const live = crumbs.filter(c => !c.retired)
  const gone = crumbs.length - live.length
  if (!live.length) return `Breadcrumbs: none pinned yet${gone ? ` (${gone} retired)` : ''}.`
  const byPath = new Map<string, Crumb[]>()
  for (const c of live) byPath.set(c.path, [...(byPath.get(c.path) ?? []), c])
  const out = [`BREADCRUMBS (${live.length} live${gone ? `, ${gone} retired` : ''})`]
  for (const [path, list] of [...byPath].sort(([a], [b]) => a.localeCompare(b))) {
    out.push('', path)
    for (const c of list) out.push(`  • ${c.note}  (${ageDays(c.at, now)}d, ${c.commit}, id ${c.id})`)
  }
  return out.join('\n')
}
