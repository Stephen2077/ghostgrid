import type { BotKind, BuildingId, BuildingStatus, BuildingType, Provider } from './types'

// What each building type is. Used by the build menu, panels, dashboard and 3D components.
export interface CatalogEntry {
  type: BuildingType
  label: string // "Codex Tower"
  short: string // "CODEX"
  role: string
  model: string
  provider: Provider
  cost: number // credits to build (game currency, not real money)
  accent: string // neon accent hex for this building
  buildable: boolean // can the player build more of these?
}

export const CATALOG: Record<BuildingType, CatalogEntry> = {
  router: {
    type: 'router',
    label: 'Router Spire',
    short: 'ROUTER',
    role: 'Receives commands, plans the work, dispatches agents.',
    model: 'claude-opus-5-5',
    provider: 'anthropic',
    cost: 0,
    accent: '#00f0ff',
    buildable: false,
  },
  codex: {
    type: 'codex',
    label: 'Codex Tower',
    short: 'CODEX',
    role: 'Writes and edits code in parallel sessions, runs builds and tests.',
    model: 'gpt-5-codex',
    provider: 'openai',
    cost: 300,
    accent: '#39ff14',
    buildable: true,
  },
  claude: {
    type: 'claude',
    label: 'Claude Nexus',
    short: 'CLAUDE',
    role: 'Architecture, code review and long-horizon reasoning.',
    model: 'claude-opus-5-5',
    provider: 'anthropic',
    cost: 300,
    accent: '#ff9d4d',
    buildable: true,
  },
  deepseek: {
    type: 'deepseek',
    label: 'DeepSeek Forge',
    short: 'DEEPSEEK',
    role: 'Cheap batch jobs: tests, refactors, data crunching.',
    model: 'deepseek-chat',
    provider: 'deepseek',
    cost: 200,
    accent: '#4d7cff',
    buildable: true,
  },
  security: {
    type: 'security',
    label: 'Security Checkpoint',
    short: 'SECURITY',
    role: 'Gates risky actions. Asks a human before anything destructive.',
    model: 'deepseek-chat',
    provider: 'deepseek',
    cost: 0,
    accent: '#ffd400',
    buildable: false,
  },
  bot: {
    type: 'bot',
    label: 'Custom Bot',
    short: 'BOT',
    role: 'Your own bot. The backend connects it through its endpoint.',
    model: 'custom-model',
    provider: 'custom',
    cost: 150,
    accent: '#ff2bd6',
    buildable: true,
  },
}

export const BOT_KINDS: Record<BotKind, { label: string; description: string; color: string }> = {
  trading: { label: 'Trading Bot', description: 'Paper-trades a strategy. Shows signals and PnL.', color: '#39ff14' },
  webhook: { label: 'Webhook Bot', description: 'Reacts to incoming events from your backend.', color: '#00f0ff' },
  scraper: { label: 'Scraper Bot', description: 'Fetches pages and extracts structured data.', color: '#ffd400' },
  custom: { label: 'Custom Bot', description: 'Anything else. You define the endpoint.', color: '#ff2bd6' },
}

// The five buildings every city starts with (ids are fixed so the demo flow can address them).
export const BUILDING_IDS: BuildingId[] = ['router', 'codex', 'claude', 'deepseek', 'security']

export const DEFAULT_BUILDINGS: { id: BuildingId; type: BuildingType; lot: number }[] = [
  { id: 'router', type: 'router', lot: 0 },
  { id: 'codex', type: 'codex', lot: 3 }, // left of the spire in the iso view (the demo's main building)
  { id: 'claude', type: 'claude', lot: 2 }, // right
  { id: 'deepseek', type: 'deepseek', lot: 1 }, // back (low and wide, still visible behind the spire)
  { id: 'security', type: 'security', lot: 4 },
]

// Back-compat lookup for the default buildings: BUILDINGS.codex.name etc.
export const BUILDINGS: Record<string, { id: BuildingId; name: string; short: string; role: string; model: string }> =
  Object.fromEntries(
    DEFAULT_BUILDINGS.map((b) => [
      b.id,
      { id: b.id, name: CATALOG[b.type].label, short: CATALOG[b.type].short, role: CATALOG[b.type].role, model: CATALOG[b.type].model },
    ]),
  )

export const STATUS_COLOR: Record<BuildingStatus | 'offline', string> = {
  idle: 'var(--gg-cyan)',
  working: 'var(--gg-green)',
  needs_approval: 'var(--gg-yellow)',
  error: 'var(--gg-red)',
  offline: 'var(--gg-grey)',
}

export const STATUS_LABEL: Record<BuildingStatus | 'offline', string> = {
  idle: 'IDLE',
  working: 'WORKING',
  needs_approval: 'NEEDS APPROVAL',
  error: 'ERROR',
  offline: 'NO KEY',
}

export const PROVIDERS: Record<Provider, { label: string; baseUrl: string; models: string[] }> = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-5-codex', 'gpt-5', 'gpt-5-mini'] },
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  },
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-3-pro', 'gemini-3-flash'],
  },
  custom: { label: 'Custom', baseUrl: '', models: ['custom-model'] },
}

// Main demo flow timings (ms). Store and FlightLayer both read these.
export const TIMING = {
  droneFlight: 1500,
  codexWork: 4000,
  packetFlight: 800,
  returnFlight: 1500,
}
