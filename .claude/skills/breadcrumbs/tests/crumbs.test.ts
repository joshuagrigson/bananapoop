import { expect, test } from 'claude-code/testing'

import { contextFor, listText, matches, normalizePin, parse, relative, serialize } from '../hooks/crumbs'
import type { Crumb } from '../hooks/crumbs'

const ROOT = '/home/user/repo'
const c = (over: Partial<Crumb>): Crumb => ({ id: 'a1', path: 'src/app.tsx', note: 'n', at: '2026-11-01', commit: 'abc1234', ...over })

test('paths: absolute inside the repo become relative; outside is refused', () => {
  expect(relative('/home/user/repo/src/app.tsx', ROOT)).toBe('src/app.tsx')
  expect(relative('src/app.tsx', ROOT)).toBe('src/app.tsx')
  expect(relative('/etc/passwd', ROOT)).toBe(null)
  expect(normalizePin('/home/user/repo/../x', ROOT)).toBe(null)
  expect(normalizePin('/home/user/repo', ROOT)).toBe(null)
})

test('matching: exact file, folder prefix, retired never', () => {
  expect(matches(c({}), 'src/app.tsx')).toBe(true)
  expect(matches(c({}), 'src/app.ts')).toBe(false)
  expect(matches(c({ path: 'src/' }), 'src/deep/x.ts')).toBe(true)
  expect(matches(c({ path: 'src/' }), 'srcx/a.ts')).toBe(false)
  expect(matches(c({ retired: { at: '2026-11-02', reason: 'fixed' } }), 'src/app.tsx')).toBe(false)
})

test('context: says where it came from, its age, drift and id', () => {
  const now = Date.parse('2026-11-04T12:00:00Z')
  const text = contextFor('src/app.tsx', [c({ note: 'never name a var h' })], { a1: 2 }, now)
  expect(text).toContain('Breadcrumbs pinned to src/app.tsx')
  expect(text).toContain('never name a var h')
  expect(text).toContain('3d ago')
  expect(text).toContain('file changed in 2 commits since')
  expect(text).toContain('id a1')
  expect(contextFor('x', [c({ at: '2026-01-01' })], {}, now)).toContain('OLD')
})

test('file format round-trips and tolerates junk', () => {
  expect(parse(serialize([c({})]))).toHaveLength(1)
  expect(parse('not json')).toHaveLength(0)
  expect(listText([])).toContain('none pinned')
  expect(listText([c({}), c({ id: 'b2', retired: { at: 'x', reason: 'y' } })])).toContain('1 live, 1 retired')
})

test('round trip: leave a crumb, read the file, the note arrives; retire it, it stops', async ($, on) => {
  const files: Record<string, string> = {}
  on('command.register', () => ({ value: { command: 'crumbs' } }))
  on('tool.register', (_: any, e: any) => ({ value: { tool: `mcp__breadcrumbs__${e.name}` } }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', (_: any, e: any) => {
    const a = e.argv.join(' ')
    if (a.includes('--show-toplevel')) return { value: { exitCode: 0, stdout: `${ROOT}\n`, stderr: '' } }
    if (a.includes('--short')) return { value: { exitCode: 0, stdout: 'deadbee\n', stderr: '' } }
    if (a.includes('rev-list')) return { value: { exitCode: 0, stdout: '0\n', stderr: '' } }
    return { value: { exitCode: 1, stdout: '', stderr: '' } }
  })
  on('fs.read', (_: any, e: any) => {
    if (!(e.path in files)) throw new Error('ENOENT')
    return { value: files[e.path] }
  })
  on('fs.write', (_: any, e: any) => { files[e.path] = e.text; return { value: undefined } })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { type: 'text', file: { content: 'code' } } as any }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const left = await $.tool.call({ tool: 'mcp__breadcrumbs__leave_breadcrumb', path: `${ROOT}/src/app.tsx`, note: 'never name a loop var h here' } as any)
  expect(String(left.result)).toContain('pinned to src/app.tsx')
  expect(files[`${ROOT}/.claude/breadcrumbs.json`]).toContain('never name a loop var h here')

  const read = await $.tool.call({ tool: 'Read', file_path: `${ROOT}/src/app.tsx` } as any)
  expect(String((read as any).context?.join('\n'))).toContain('never name a loop var h here')
  expect(String((read as any).context?.join('\n'))).toContain('file unchanged since')

  const other = await $.tool.call({ tool: 'Read', file_path: `${ROOT}/README.md` } as any)
  expect((other as any).context).toBeUndefined()

  const id = parse(files[`${ROOT}/.claude/breadcrumbs.json`]!)[0]!.id
  await $.tool.call({ tool: 'mcp__breadcrumbs__retire_breadcrumb', id, reason: 'fixed for good' } as any)
  const after = await $.tool.call({ tool: 'Read', file_path: `${ROOT}/src/app.tsx` } as any)
  expect((after as any).context).toBeUndefined()

  const outside = await $.tool.call({ tool: 'mcp__breadcrumbs__leave_breadcrumb', path: '/etc/hosts', note: 'x' } as any)
  expect(String(outside.result)).toContain('not inside this repo')
})
