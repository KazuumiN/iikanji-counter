export type Counts = Record<string, number>
export type Daily = Record<string, Counts>
export type WorldRow = { rank: number; name: string; total: number; topPhrase: string | null; topCount: number; isSample?: boolean }
export type Quote = { before: string; phrase: string; after: string }
export type Celebrate = 'all' | 'milestone' | 'off'
export type Settings = {
  celebrate: Celebrate
  quote: boolean
  hint: boolean
  band: boolean
  autoOpen: boolean
  sync: boolean
  secDaily: boolean
  secBadges: boolean
  secWorld: boolean
}
export type Online = { isJoined: boolean; name: string; rank: number | null; players: number | null }

declare module 'claude-code' {
  interface PluginState {
    'kuchiguse-counter': {
      counts: Counts
      custom: string[]
      daily: Daily
      badges: string[]
      settings: Settings
      celebration: string | null
      hint: string | null
      quote: Quote | null
      online: Online
      world: WorldRow[] | null
    }
  }
}
