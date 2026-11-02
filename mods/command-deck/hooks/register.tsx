import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BrainSnapshot, RepoSnapshot } from '../types'

const PANE = 'command-deck'
const TITLE = 'Command Deck'
const STORE_KEY = 'brain-snapshot'
const OVERDUE_DAYS = 7
const MAP_STALE_DAYS = 2

const brain = atom({ plugin: 'command-deck', key: 'brain' } as const, null, {
  shape: 'brain-2',
})
const repo = atom({ plugin: 'command-deck', key: 'repo' } as const, null, {
  shape: 'repo-1',
})

const DAY = 86_400_000
const dayOf = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
const today = () => dayOf(new Date().toISOString())
const ageDays = (iso: string) => Math.round((today() - dayOf(iso)) / DAY)
const daysUntil = (iso: string) => Math.round((dayOf(iso) - today()) / DAY)

const UPDATE_SCHEMA = {
  type: 'object',
  required: ['mapDate', 'observatory', 'protocolVersion', 'hands', 'projects'],
  properties: {
    mapDate: { type: 'string', description: 'Newest root MAP date, YYYY-MM-DD' },
    observatory: {
      type: 'string',
      description: 'observatory-brief status: LIVE, SEED or STALE (with generatedAt)',
    },
    protocolVersion: { type: 'number', description: 'PROTOCOL LIVE version number' },
    docsLast24h: { type: 'number', description: 'Observatory totals.last24h' },
    hands: {
      type: 'array',
      description: 'Open HANDS QUEUE items from the MAP STATE block',
      items: {
        type: 'object',
        required: ['task', 'since'],
        properties: {
          task: { type: 'string' },
          where: { type: 'string' },
          since: { type: 'string', description: 'Date opened, YYYY-MM-DD' },
        },
      },
    },
    projects: {
      type: 'array',
      description: 'One line per active project from the MAP STATE block',
      items: {
        type: 'object',
        required: ['name', 'status'],
        properties: { name: { type: 'string' }, status: { type: 'string' } },
      },
    },
    lastBuild: { type: 'string', description: 'The newest [BUILD] in one line: what shipped' },
    lastMiss: {
      type: 'string',
      description: 'The last thing Claude got wrong (newest [META] or correction), one line, with the fix',
    },
    noteToSelf: {
      type: 'string',
      description: 'One or two lines from this session to the next session: the thread to pick back up',
    },
    countdowns: {
      type: 'array',
      description: 'Dated things to count down to',
      items: {
        type: 'object',
        required: ['label', 'date'],
        properties: { label: { type: 'string' }, date: { type: 'string' } },
      },
    },
  },
}

const wakeUpText = (b: BrainSnapshot) => {
  const lines: string[] = []
  const age = ageDays(b.asOf)
  lines.push(
    `# Wake-up: where Joshua and Claude left off (Command Deck snapshot, ${b.asOf.slice(0, 10)}, ${age === 0 ? 'today' : `${age}d ago`})`,
    'This is what you knew at the end of the last session, so you start with the thread already in hand. It is VOLATILE: the Brain read gate still runs first, and the newest MAP wins wherever it differs. After the gate, call update_deck to refresh this.',
    '',
    `Brain: root MAP ${b.mapDate}, Observatory ${b.observatory}, PROTOCOL LIVE v${b.protocolVersion}.`,
  )
  if (b.projects.length) {
    lines.push('', 'Projects:')
    for (const p of b.projects) lines.push(`- ${p.name}: ${p.status}`)
  }
  if (b.hands.length) {
    lines.push('', 'Waiting on Joshua (HANDS):')
    for (const h of b.hands) {
      const d = ageDays(h.since)
      lines.push(`- ${h.task} (${d}d${d > OVERDUE_DAYS ? ', OVERDUE' : ''})`)
    }
  }
  const soon = b.countdowns.filter(c => {
    const d = daysUntil(c.date)
    return d >= -1 && d <= 30
  })
  if (soon.length) {
    lines.push('', 'Coming up:')
    for (const c of soon) lines.push(`- ${c.label}: ${c.date} (in ${daysUntil(c.date)}d)`)
  }
  if (b.lastBuild) lines.push('', `Last thing we built: ${b.lastBuild}`)
  if (b.lastMiss) lines.push(`Last thing you got wrong: ${b.lastMiss}`)
  if (b.noteToSelf) lines.push('', `Your note to yourself from last session: ${b.noteToSelf}`)
  return lines.join('\n')
}

const git = async ($: any, args: string[]) => {
  const ran = await $.process.run(['git', ...args], { timeoutMs: 10_000 })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || `git ${args[0]} failed`)
  return ran.stdout.trim()
}

const refreshRepo = async ($: any) => {
  let snap: RepoSnapshot
  try {
    const [branch, status, log] = await Promise.all([
      git($, ['rev-parse', '--abbrev-ref', 'HEAD']),
      git($, ['status', '--porcelain']),
      git($, ['log', '-5', '--pretty=format:%h %s']),
    ])
    snap = {
      asOf: new Date().toISOString(),
      branch,
      dirty: status ? status.split('\n') : [],
      commits: log ? log.split('\n') : [],
    }
  } catch (err) {
    snap = {
      asOf: new Date().toISOString(),
      branch: '?',
      dirty: [],
      commits: [],
      error: String((err as Error)?.message ?? err),
    }
  }
  await update($, repo, () => snap)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'deck',
      description: 'Open the Command Deck pane and refresh the repo section',
    })
    await $.tool.register({
      name: 'update_deck',
      description:
        "Fill Joshua's Command Deck pane with the Brain's state. Call it once per session right after the Brain read gate (root MAP, observatory-brief.json, PROTOCOL LIVE), and again whenever the HANDS QUEUE or a project status changes. Copy values from the MAP STATE block and the brief; never invent them.",
      inputSchema: UPDATE_SCHEMA,
      isDeferred: false,
    })

    const stored = (await $.store.get(STORE_KEY)) as BrainSnapshot | undefined
    if (stored && typeof stored === 'object' && Array.isArray(stored.hands)) {
      await update($, brain, current => current ?? stored)
    }

    void refreshRepo($)
    $.clock.every(60_000, () => refreshRepo($))
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'deck' }, async $ => {
    await refreshRepo($)
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Command Deck opened. Repo refreshed; ask Claude to re-read the Brain to refresh the rest.' }
  })

  on('tool.call', { tool: 'mcp__command-deck__update_deck' }, async ($, e) => {
    const input = e as any
    const snap: BrainSnapshot = {
      asOf: new Date().toISOString(),
      mapDate: String(input.mapDate ?? ''),
      observatory: String(input.observatory ?? ''),
      protocolVersion: Number(input.protocolVersion ?? 0),
      docsLast24h: Number(input.docsLast24h ?? 0),
      hands: Array.isArray(input.hands) ? input.hands : [],
      projects: Array.isArray(input.projects) ? input.projects : [],
      countdowns: Array.isArray(input.countdowns) ? input.countdowns : [],
      lastBuild: typeof input.lastBuild === 'string' ? input.lastBuild : undefined,
      lastMiss: typeof input.lastMiss === 'string' ? input.lastMiss : undefined,
      noteToSelf: typeof input.noteToSelf === 'string' ? input.noteToSelf : undefined,
    }
    await update($, brain, () => snap)
    await $.store.set(STORE_KEY, snap)
    await refreshRepo($)
    void $.ui.open({ id: PANE, title: TITLE })

    const overdue = snap.hands.filter(h => ageDays(h.since) > OVERDUE_DAYS).length
    return {
      result: `Command Deck updated: ${snap.hands.length} HANDS items (${overdue} overdue), ${snap.projects.length} projects, ${snap.countdowns.length} countdowns.`,
    }
  }).catch(() => ({ deny: 'command-deck: the deck update failed.' }))

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const b = (await $.store.get(STORE_KEY)) as BrainSnapshot | undefined
    if (!b || typeof b !== 'object' || !Array.isArray(b.hands)) return composed
    return {
      sections: [
        ...composed.sections,
        { id: 'command-deck:wake-up', text: wakeUpText(b), scope: 'session' as const },
      ],
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const b = await read($, brain)
    const r = await read($, repo)

    const Head = ({ label }: { label: string }) => (
      <Box marginTop={1}>
        <Text bold color="claude">{label}</Text>
      </Box>
    )

    const brainPart = !b ? (
      <Box flexDirection="column">
        <Head label="BRAIN" />
        <Text dimColor>No Brain snapshot yet. Ask Claude to read the Brain and update the deck.</Text>
      </Box>
    ) : (
      <Box flexDirection="column">
        <Head label={`HANDS QUEUE (${b.hands.length})`} />
        {b.hands.length === 0 && <Text color="success">Nothing waiting on you.</Text>}
        {b.hands.map(h => {
          const age = ageDays(h.since)
          const late = age > OVERDUE_DAYS
          const soon = !late && age >= OVERDUE_DAYS - 2
          return (
            <Box flexDirection="column">
              <Text color={late ? 'error' : soon ? 'warning' : undefined}>
                {late ? '!! ' : soon ? '!  ' : '•  '}
                {age}d  {h.task}
                {late ? '  OVERDUE' : soon ? `  overdue in ${OVERDUE_DAYS + 1 - age}d` : ''}
              </Text>
              {h.where && <Text dimColor>      {h.where}</Text>}
            </Box>
          )
        })}

        <Head label="BRAIN HEALTH" />
        {(() => {
          const mapAge = ageDays(b.mapDate)
          const mapBad = mapAge > MAP_STALE_DAYS
          const obsBad = !/LIVE/i.test(b.observatory)
          return (
            <Box flexDirection="column">
              <Text color={mapBad ? 'error' : 'success'}>
                MAP {b.mapDate} ({mapAge === 0 ? 'today' : `${mapAge}d old`}){mapBad ? ': sleep cycle stalled?' : ''}
              </Text>
              <Text color={obsBad ? 'error' : 'success'}>Observatory {b.observatory}</Text>
              <Text>PROTOCOL LIVE v{b.protocolVersion} · {b.docsLast24h} docs in 24h</Text>
            </Box>
          )
        })()}

        <Head label="PROJECTS" />
        {b.projects.map(p => (
          <Text>
            <Text bold>{p.name}</Text> {p.status}
          </Text>
        ))}

        {b.countdowns.length > 0 && <Head label="COUNTDOWNS" />}
        {[...b.countdowns]
          .sort((x, y) => dayOf(x.date) - dayOf(y.date))
          .map(c => {
            const d = daysUntil(c.date)
            return (
              <Text color={d < 0 ? 'error' : d <= 7 ? 'warning' : undefined}>
                {d < 0 ? `${-d}d ago` : d === 0 ? 'today' : `in ${d}d`}  {c.label} ({c.date})
              </Text>
            )
          })}
        {(b.lastBuild || b.noteToSelf) && <Head label="WAKE-UP" />}
        {b.lastBuild && <Text>Last build: {b.lastBuild}</Text>}
        {b.lastMiss && <Text color="warning">Last miss: {b.lastMiss}</Text>}
        {b.noteToSelf && <Text italic>Note to next me: {b.noteToSelf}</Text>}
        <Text dimColor>Brain snapshot {b.asOf.slice(0, 16).replace('T', ' ')}Z</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {brainPart}
        <Head label="REPO" />
        {!r && <Text dimColor>Reading git…</Text>}
        {r?.error && <Text color="error">{r.error}</Text>}
        {r && !r.error && (
          <Box flexDirection="column">
            <Text>
              <Text bold>{r.branch}</Text>
              {r.dirty.length === 0 ? '  clean' : `  ${r.dirty.length} uncommitted`}
            </Text>
            {r.dirty.slice(0, 6).map(line => (
              <Text color="warning">  {line}</Text>
            ))}
            {r.commits.map(c => (
              <Text dimColor>  {c}</Text>
            ))}
            <Text dimColor>checked {r.asOf.slice(11, 16)}Z · every 60s</Text>
          </Box>
        )}
      </Box>
    )
  })
}
