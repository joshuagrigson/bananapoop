import { expect, test } from 'claude-code/testing'

// Regression: a `.map(h => ...)` inside the pane shadowed the JSX factory `h`,
// so the pane failed to draw whenever there were HANDS items.
const SNAP = {
  asOf: '2026-11-02T22:00:00.000Z',
  mapDate: '2026-11-02',
  observatory: 'LIVE',
  protocolVersion: 2,
  docsLast24h: 27,
  hands: [{ task: 'Audit verdicts', where: 'AUDIT doc', since: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10) }],
  projects: [{ name: 'Grigson TV', status: 'iPhone verified' }],
  countdowns: [{ label: 'Credits reset', date: '2026-11-18' }],
  noteToSelf: 'hello next me',
}

test('the pane draws with HANDS items, on terminal, desktop and mobile', async ($, on) => {
  on('command.register', () => ({ value: { command: 'deck' } }))
  on('agent.register', () => ({ value: { agent: 'command-deck:brain-reader' } }))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.register', () => ({ value: { tool: 'mcp__command-deck__update_deck' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', () => ({ value: SNAP }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main', stderr: '' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'command-deck', surface, component: 'Pane', requestId: 'command-deck',
      props: { title: 'Command Deck', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
    } as any)
    expect((await ui.find({ type: 'Text', text: /Audit verdicts/ }))?.text).toContain('Audit verdicts')
    expect((await ui.find({ type: 'Text', text: /hello next me/ }))?.text).toContain('hello next me')
    await ui.unmount()
  }
})

const boot = async ($: any, on: any) => {
  on('command.register', () => ({ value: { command: 'deck' } }))
  on('agent.register', () => ({ value: { agent: 'command-deck:brain-reader' } }))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.register', () => ({ value: { tool: 'mcp__command-deck__update_deck' } }))
  on('ui.open', () => ({ value: { isPlaced: false } }))
  on('store.get', () => ({ value: SNAP }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main', stderr: '' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })
}

test('/deck prints the whole deck as text (what the mobile app shows)', async ($, on) => {
  await boot($, on)
  const { text } = await $.command.run({ command: 'deck' })
  expect(text).toContain('HANDS QUEUE (1)')
  expect(text).toContain('Audit verdicts')
  expect(text).toContain('OVERDUE')
  expect(text).toContain('Grigson TV: iPhone verified')
  expect(text).toContain('Note to next me: hello next me')
  expect(text).toContain('REPO')
})

test('the band above the prompt draws one line on mobile', async ($, on) => {
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await boot($, on)
  const ui = await $.ui.mount({ plugin: 'command-deck', surface: 'mobile', component: 'AbovePrompt', props: {} } as any)
  const row = await ui.find({ type: 'Text', text: /HANDS/ })
  expect(row?.text).toContain('1 HANDS overdue')
  expect(row?.text).toContain('/deck for all')
  await ui.unmount()
})
