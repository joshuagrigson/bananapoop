export type HandsItem = { task: string; where?: string; since: string }
export type Project = { name: string; status: string }
export type Countdown = { label: string; date: string }
export type BrainSnapshot = {
  asOf: string
  mapDate: string
  observatory: string
  protocolVersion: number
  docsLast24h: number
  hands: HandsItem[]
  projects: Project[]
  countdowns: Countdown[]
}
export type RepoSnapshot = {
  asOf: string
  branch: string
  dirty: string[]
  commits: string[]
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'command-deck': {
      brain: Shaped<BrainSnapshot | null>
      repo: Shaped<RepoSnapshot | null>
    }
  }
}
