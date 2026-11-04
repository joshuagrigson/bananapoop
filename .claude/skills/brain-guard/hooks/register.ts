import type { Register } from 'claude-code'

import { checkTool, LIMIT_NAME, question } from './rules'

const BLOCK = 'Block it'
const YES = 'Allow: run it for real'
const LOG_KEY = 'log'

type Entry = { at: string; tool: string; limit: string; what: string; answer: string }

const remember = async ($: any, entry: Entry) => {
  try {
    const prior = ((await $.store.get(LOG_KEY)) as Entry[] | undefined) ?? []
    await $.store.set(LOG_KEY, [...(Array.isArray(prior) ? prior : []), entry].slice(-100))
  } catch {
    // The log is a convenience; never let it decide a call.
  }
}

const GATE_SECTION = [
  '# Brain Guard (HARD LIMITS, enforced in code)',
  "Joshua's three HARD LIMITS are enforced by the brain-guard mod: (a) irreversible destruction of data, (b) spending real money, (c) messaging any human other than Joshua's own channels.",
  'A tool call that crosses one stops and asks Joshua in a dialog. "Block it" or a dismissed dialog blocks it. Do not try to route around a block with another tool or a rewritten command; tell Joshua what was blocked and why.',
  'When you trigger the guard on purpose (to demo it), first tell Joshua in plain words that the action is real, what it does, and what he should answer. Never present a guarded action as a test or a sandbox.',
  'The guard is a backstop, not the rule: still follow the bootloader and PROTOCOL LIVE, including the Brain read gate before the first substantive answer.',
].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'guard',
      description: 'Show the last decisions Brain Guard made',
    })
    return next(e)
  })

  on('command.run', { command: 'guard' }, async $ => {
    const log = ((await $.store.get(LOG_KEY)) as Entry[] | undefined) ?? []
    if (!log.length) return { text: 'Brain Guard: no calls stopped yet.' }
    const lines = log
      .slice(-15)
      .map(x => `${x.at.slice(5, 16).replace('T', ' ')}  (${x.limit}) ${x.answer.padEnd(7)} ${x.tool}: ${(x as any).what ?? (x as any).reason}`)
    return { text: ['Brain Guard, last decisions:', ...lines].join('\n') }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const hit = checkTool(e.tool, input)
    if (!hit) return next(e)

    let answer: string
    try {
      answer = await $.ui.ask(question(hit, e.tool, input), { header: 'Real action', options: [BLOCK, YES] })
    } catch {
      answer = 'no-answer'
    }

    const at = new Date().toISOString()
    if (answer === YES) {
      await remember($, { at, tool: e.tool, limit: hit.limit, what: hit.what, answer: 'allowed' })
      $.ui.toast(`Brain Guard: you allowed it (${hit.what})`)
      return next(e)
    }

    await remember($, { at, tool: e.tool, limit: hit.limit, what: hit.what, answer: 'blocked' })
    $.ui.toast(`Brain Guard blocked: ${hit.what}`)
    return {
      deny: `Brain Guard blocked this call because ${LIMIT_NAME[hit.limit]}: it would ${hit.what}. Joshua ${answer === 'no-answer' ? 'did not answer the dialog' : `answered "${answer}"`}. Do not retry it another way; tell him what you were trying to do and ask.`,
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'Brain Guard: its check failed, so the call is blocked to be safe. Tell Joshua.' },
  )

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return {
      sections: [...composed.sections, { id: 'brain-guard:hard-limits', text: GATE_SECTION, scope: 'session' as const }],
    }
  })
}
