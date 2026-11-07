import { expect, test } from 'claude-code/testing'

const INPUT = { model: 'm', promptModel: 'm', surfaces: ['desktop'] as const, tools: [], outputStyle: null, traits: [] }

const boot = async ($: any, on: any, toasts: string[], agents: any[]) => {
  on('command.register', () => ({ value: { command: 'deck' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__command-deck__update_deck' } }))
  on('agent.register', (_: any, e: any) => { agents.push(e); return { value: { agent: `command-deck:${e.name}` } } })
  on('ui.toast', (_: any, e: any) => { toasts.push(String(e.text ?? e)); return { value: undefined } })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main', stderr: '' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' as const }] }))
  on('tool.call', (_: any, e: any) => {
    if (e.tool === 'Bash' && /push/.test(e.command)) return { result: { stdout: '', stderr: e.command.includes('bad') ? '! [rejected]' : 'main -> main' } as any }
    if (e.tool === 'Bash') return { result: { stdout: '3 pass\n0 fail', stderr: '' } as any }
    return { result: 'ok' as any }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

test('registers the brain-reader subagent with Drive read tools only', async ($, on) => {
  const toasts: string[] = []
  const agents: any[] = []
  await boot($, on, toasts, agents)
  const a = agents.find(x => x.name === 'brain-reader')
  expect(a).toBeDefined()
  expect(a.tools).toContain('mcp__Google_Drive__read_file_content')
  expect(a.tools).not.toContain('mcp__Google_Drive__create_file')
  expect(a.prompt).toContain('1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn')
})

test('toasts: Brain save, push ok, push rejected, tests passed', async ($, on) => {
  const toasts: string[] = []
  await boot($, on, toasts, [])
  await $.tool.call({ tool: 'mcp__Google_Drive__create_file', title: '[BUILD] a thing' } as any)
  await $.tool.call({ tool: 'Bash', command: 'git push -u origin x' })
  await $.tool.call({ tool: 'Bash', command: 'git push origin bad' })
  await $.tool.call({ tool: 'Bash', command: 'claude plugin test mods/x' })
  const all = toasts.join(' | ')
  expect(all).toContain('Saved to Brain: [BUILD] a thing')
  expect(all).toContain('Pushed to GitHub')
  expect(all).toContain('git push failed')
  expect(all).toContain('Tests passed')
})

test('system prompt carries the session section with the write count', async ($, on) => {
  await boot($, on, [], [])
  await $.tool.call({ tool: 'mcp__Google_Drive__create_file', title: 't' } as any)
  const { sections } = await $.prompt.compose(INPUT)
  const s = sections.find(x => x.id === 'command-deck:session')
  expect(s?.text).toContain('Brain writes this session: 1')
  expect(s?.text).toContain('command-deck:brain-reader')
})
