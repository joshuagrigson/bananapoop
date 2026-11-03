import { expect, test } from 'claude-code/testing'

// Regression: a `.map(h => ...)` inside the pane shadowed the JSX factory `h`,
// so the pane failed to draw whenever there were HANDS items.
const SNAP = {
  asOf: '2026-11-02T22:00:00.000Z',
  mapDate: '2026-11-02',
  observatory: 'LIVE',
  protocolVersion: 2,
  docsLast24h: 27,
  hands: [{ task: 'Audit verdicts', where: 'AUDIT doc', since: '2026-10-27' }],
  projects: [{ name: 'Grigson TV', status: 'iPhone verified' }],
  countdowns: [{ label: 'Credits reset', date: '2026-11-18' }],
  noteToSelf: 'hello next me',
}

test('the pane draws with HANDS items, on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'deck' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__command-deck__update_deck' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', () => ({ value: SNAP }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main', stderr: '' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'command-deck', surface, component: 'Pane', requestId: 'command-deck',
      props: { title: 'Command Deck', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
    } as any)
    expect((await ui.find({ type: 'Text', text: /Audit verdicts/ }))?.text).toContain('Audit verdicts')
    expect((await ui.find({ type: 'Text', text: /hello next me/ }))?.text).toContain('hello next me')
    await ui.unmount()
  }
})
