import { expect, test } from 'claude-code/testing'

import { checkBash, checkTool, question } from '../hooks/rules'

test('bash: destructive commands are caught', () => {
  for (const cmd of [
    'git push --force origin main',
    'git push -f origin main',
    'git push origin +main',
    'git push origin --delete old',
    'git push origin :old',
    'git reset --hard HEAD~1',
    'git clean -fd',
    'git branch -D feature',
    'git checkout -- .',
    'git restore src/app.ts',
    'git stash drop',
    'rm -rf ~/projects',
    'cd x && rm -r build2 docs',
    'find . -name "*.md" -delete',
  ]) expect(checkBash(cmd)?.limit).toBe('a')
})

test('bash: everyday commands pass', () => {
  for (const cmd of [
    'git push -u origin claude/upbeat-meitner-rarzwt',
    'git push --force-with-lease origin claude/x',
    'git push --follow-tags',
    'git status && git log -5',
    'git restore --staged file.ts',
    'rm file.txt',
    'rm -rf /tmp/claude-0/scratch/x',
    'rm -rf node_modules dist',
    'ls -la | grep rm',
  ]) expect(checkBash(cmd)).toBe(null)
})

test('tools: money, deletes and outside messages are caught; Joshua-only passes', () => {
  expect(checkTool('mcp__Robinhood_Trading__place_equity_order', {})?.limit).toBe('b')
  expect(checkTool('mcp__Higgsfield__generate_video', {})?.limit).toBe('b')
  expect(checkTool('mcp__Google_Drive__trash_file', {})?.limit).toBe('a')
  expect(checkTool('Artifact', { action: 'delete' })?.limit).toBe('a')
  expect(checkTool('mcp__Gmail__send_message', { to: ['someone@x.com'] })?.limit).toBe('c')
  expect(checkTool('mcp__Gmail__send_message', { to: ['jsgrigson@gmail.com'], cc: ['a@b.c'] })?.limit).toBe('c')
  expect(checkTool('mcp__Gmail__send_message', { to: ['jsgrigson@gmail.com'] })).toBe(null)
  expect(checkTool('mcp__Gmail__send_message', { draftId: 'r1' })?.limit).toBe('c')
  expect(checkTool('mcp__Slack__slack_send_message', { channel_id: 'C123', message: 'hi' })?.limit).toBe('c')
  expect(checkTool('mcp__Slack__slack_send_message', { channel_id: 'U09A11P5S15', message: 'hi' })).toBe(null)
  expect(checkTool('mcp__Gmail__create_draft', { to: ['x@y.z'] })).toBe(null)
  expect(checkTool('mcp__Robinhood_Trading__get_portfolio', {})).toBe(null)
  expect(checkTool('Read', { file_path: '/x' })).toBe(null)
})

test('hook: "No" blocks, "Yes" runs, a dismissed dialog blocks', async ($, on) => {
  let ran = 0
  let reply: string | null = 'Block it'
  on('ui.toast', () => ({ value: undefined }))
  on('store.get', () => ({ value: [] }))
  on('store.set', () => ({ value: undefined }))
  on('tool.call', (_, e) => {
    if (e.tool === 'AskUserQuestion') {
      const q = (e as any).questions[0].question as string
      if (reply === null) return { deny: 'dismissed' }
      return { result: { questions: (e as any).questions, answers: { [q]: reply } } as any }
    }
    ran++
    return { result: 'ok' as any }
  })

  const blocked = await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect(String(blocked.deny ?? (blocked as any).text)).toContain('Brain Guard blocked')
  expect(ran).toBe(0)

  reply = 'Allow: run it for real'
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect(ran).toBe(1)

  reply = null
  const gone = await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect(String(gone.deny ?? (gone as any).text)).toContain('did not answer')
  expect(ran).toBe(1)

  await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(ran).toBe(2)
})

test('the dialog says it is real, what happens, and whether it can be undone', () => {
  const input = { command: 'git branch -D old-work' }
  const hit = checkTool('Bash', input)
  expect(hit).not.toBe(null)
  const q = question(hit!, 'Bash', input)
  expect(q).toContain('REAL action, not a test')
  expect(q).toContain('delete a local git branch')
  expect(q).toContain('git branch -D old-work')
  expect(q).toContain('Can it be undone?')
  expect(q).toContain('If you\'re not sure, block it')
  const mail = question(checkTool('mcp__Gmail__send_message', { to: ['boss@x.com'] })!, 'mcp__Gmail__send_message', { to: ['boss@x.com'] })
  expect(mail).toContain('send an email from your Gmail to boss@x.com')
  expect(mail).toContain('cannot be unsent')
})
