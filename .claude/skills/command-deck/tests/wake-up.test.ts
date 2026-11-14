import { expect, test } from 'claude-code/testing'

const INPUT = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['desktop'] as const,
  tools: [],
  outputStyle: null,
  traits: [],
}

const SNAP = {
  asOf: '2026-11-02T22:00:00.000Z',
  mapDate: '2026-11-02',
  observatory: 'LIVE',
  protocolVersion: 2,
  docsLast24h: 27,
  hands: [{ task: 'Audit verdicts', since: '2026-10-27' }],
  projects: [{ name: 'Grigson TV', status: 'iPhone verified' }],
  countdowns: [],
  lastBuild: 'Command Deck mod',
  noteToSelf: 'Build Brain Guard next',
}

test('wake-up section is appended after the engine sections', async ($, on) => {
  on('store.get', () => ({ value: SNAP }))
  on('prompt.compose', () => ({
    sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' as const }],
  }))

  const { sections } = await $.prompt.compose(INPUT)
  expect(sections[0]?.id).toBe('intro')
  const wake = sections.find(s => s.id === 'command-deck:wake-up')
  expect(wake?.scope).toBe('session')
  expect(wake?.text).toContain('Grigson TV: iPhone verified')
  expect(wake?.text).toContain('Audit verdicts')
  expect(wake?.text).toContain('Build Brain Guard next')
  expect(wake?.text).toContain('VOLATILE')
})

test('no snapshot means no wake-up section', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  on('prompt.compose', () => ({
    sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' as const }],
  }))

  const { sections } = await $.prompt.compose(INPUT)
  expect(sections.find(x => x.id === 'command-deck:wake-up')).toBeUndefined()
  expect(sections.find(x => x.id === 'command-deck:session')).toBeDefined()
})
