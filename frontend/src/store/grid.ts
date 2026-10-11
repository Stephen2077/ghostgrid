// City state machine. All building status changes go through here.
// Flow: runCommand → dispatch (drone router→codex) → working (codex 4s) → approval (security) → done | rejected
// Players can also build new buildings (Codex / Claude / DeepSeek clones, custom bots) on empty lots.
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { api } from '../api/client'
import { CATALOG, DEFAULT_BUILDINGS, TIMING } from '../constants'
import { BUILDABLE_LOTS } from '../city3d/world'
import type {
  BotConfig,
  Building,
  BuildingId,
  BuildingStatus,
  BuildingType,
  Flight,
  FlightKind,
  LogEntry,
  LogLevel,
  Session,
  Task,
} from '../types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let n = 0
const id = (p: string) => `${p}_${Date.now().toString(36)}${(n++).toString(36)}`

export type PanelMode = 'building' | 'result' | null

export interface BuildMode {
  type: BuildingType
  name?: string
  bot?: BotConfig
}

export interface CityStats {
  approvals: number
  rejections: number
  tokensToday: number
  costToday: number // real USD (mock)
  budgetToday: number
}

interface GridState {
  buildings: Record<BuildingId, Building>
  order: BuildingId[] // render / list order
  logs: LogEntry[]
  task: Task | null
  flights: Flight[]
  selected: BuildingId | null
  panel: PanelMode
  credits: number // game currency (not real money)
  stats: CityStats
  buildMode: BuildMode | null

  // derived helpers
  isBusy: () => boolean

  // actions
  loadInitialLogs: () => Promise<void>
  runCommand: (command: string) => Promise<void>
  approve: () => Promise<void>
  reject: () => Promise<void>
  selectBuilding: (id: BuildingId | null) => void
  openResult: () => void
  closePanel: () => void
  setStatus: (id: BuildingId, status: BuildingStatus) => void
  pushLog: (id: BuildingId, level: LogLevel, text: string) => void
  launchFlight: (kind: FlightKind, from: BuildingId, to: BuildingId, durationMs: number) => string
  setBuildMode: (mode: BuildMode | null) => void
  placeBuilding: (lot: number) => BuildingId | null // uses buildMode; returns new id or null
  removeBuilding: (id: BuildingId) => void
  updateBot: (id: BuildingId, patch: Partial<BotConfig>) => void
  renameBuilding: (id: BuildingId, name: string) => void
}

const MIN = 60_000
const seedSessions = (type: BuildingType): Session[] => {
  const now = Date.now()
  if (type === 'codex')
    return [
      { id: 's_cx1', title: 'Refactor drone flight paths', status: 'done', startedAt: now - 42 * MIN, tokens: 18_230, branch: 'feat/arcs' },
      { id: 's_cx2', title: 'Fix failing auth test', status: 'queued', startedAt: now - 3 * MIN, tokens: 0, branch: 'fix/auth' },
    ]
  if (type === 'claude')
    return [
      { id: 's_cl1', title: 'Review: city state machine', status: 'done', startedAt: now - 25 * MIN, tokens: 31_904 },
      { id: 's_cl2', title: 'Architecture: plugin bots', status: 'running', startedAt: now - 6 * MIN, tokens: 12_480 },
    ]
  if (type === 'deepseek')
    return [
      { id: 's_ds1', title: 'Generate unit tests for mock.ts', status: 'done', startedAt: now - 58 * MIN, tokens: 44_310 },
      { id: 's_ds2', title: 'Batch: summarize 120 request logs', status: 'running', startedAt: now - 2 * MIN, tokens: 9_870 },
    ]
  return []
}

function makeBuilding(bid: BuildingId, type: BuildingType, lot: number, extra?: { name?: string; bot?: BotConfig }): Building {
  const c = CATALOG[type]
  return {
    id: bid,
    type,
    name: extra?.name || c.label,
    short: extra?.bot ? extra.name?.slice(0, 10).toUpperCase() || c.short : c.short,
    role: c.role,
    model: c.model,
    status: 'idle',
    lot,
    sessions: seedSessions(type),
    bot: extra?.bot,
    builtAt: Date.now(),
  }
}

const initialBuildings = Object.fromEntries(DEFAULT_BUILDINGS.map((b) => [b.id, makeBuilding(b.id, b.type, b.lot)])) as Record<
  BuildingId,
  Building
>

export const useGrid = create<GridState>()((set, get) => ({
  buildings: initialBuildings,
  order: DEFAULT_BUILDINGS.map((b) => b.id),
  logs: [],
  task: null,
  flights: [],
  selected: null,
  panel: null,
  credits: 1280,
  stats: { approvals: 23, rejections: 1, tokensToday: 182_400, costToday: 0.42, budgetToday: 5 },
  buildMode: null,

  isBusy: () => {
    const p = get().task?.phase
    return p === 'dispatch' || p === 'working' || p === 'approval'
  },

  loadInitialLogs: async () => {
    const all = await Promise.all(get().order.map((b) => api.getLogs(b, 5)))
    set({ logs: all.flat().sort((a, b) => a.ts - b.ts) })
  },

  setStatus: (b, status) =>
    set((s) => (s.buildings[b] ? { buildings: { ...s.buildings, [b]: { ...s.buildings[b], status } } } : s)),

  pushLog: (b, level, text) =>
    set((s) => ({ logs: [...s.logs, { id: id('log'), ts: Date.now(), buildingId: b, level, text }].slice(-300) })),

  launchFlight: (kind, from, to, durationMs) => {
    const fid = id('flight')
    set((s) => ({ flights: [...s.flights, { id: fid, kind, from, to, durationMs, startedAt: Date.now() }] }))
    setTimeout(() => set((s) => ({ flights: s.flights.filter((f) => f.id !== fid) })), durationMs + 600) // hover at the dock briefly
    return fid
  },

  runCommand: async (command) => {
    const { isBusy, setStatus, pushLog, launchFlight } = get()
    if (isBusy() || !command.trim()) return
    get().order.forEach((b) => get().buildings[b].status !== 'idle' && setStatus(b, 'idle'))
    set({ task: { id: 'pending', command, phase: 'dispatch', createdAt: Date.now() } })

    // 1) Router receives and dispatches a drone to Codex
    setStatus('router', 'working')
    pushLog('router', 'info', `received: "${command}"`)
    const { taskId, plan } = await api.submitCommand(command)
    plan.forEach((p) => pushLog('router', 'info', p))
    const sessionId = id('s')
    set((s) => ({
      task: s.task && { ...s.task, id: taskId },
      buildings: {
        ...s.buildings,
        codex: {
          ...s.buildings.codex,
          sessions: [
            { id: sessionId, title: command.slice(0, 48), status: 'running' as const, startedAt: Date.now(), tokens: 0, branch: `task/${taskId.slice(-5)}` },
            ...s.buildings.codex.sessions,
          ].slice(0, 6),
        },
      },
    }))
    launchFlight('drone', 'router', 'codex', TIMING.droneFlight)
    pushLog('router', 'ok', 'drone dispatched → codex')
    await sleep(TIMING.droneFlight)

    // 2) Codex works for 4s
    setStatus('router', 'idle')
    setStatus('codex', 'working')
    set((s) => ({ task: s.task && { ...s.task, phase: 'working' } }))
    const steps = ['reading repo (142 files)', 'patching src/App.tsx (+12 −3)', 'npm run build', 'needs: rm -rf /tmp/build']
    for (const step of steps) {
      pushLog('codex', step.startsWith('needs') ? 'warn' : 'info', step)
      await sleep(TIMING.codexWork / steps.length)
    }

    // 3) Security asks a human
    setStatus('codex', 'idle')
    launchFlight('packet', 'codex', 'security', TIMING.packetFlight)
    await sleep(TIMING.packetFlight)
    setStatus('security', 'needs_approval')
    pushLog('security', 'warn', 'approval required: rm -rf /tmp/build')
    set((s) => ({
      task: s.task && {
        ...s.task,
        phase: 'approval',
        approval: {
          buildingId: 'security',
          requester: 'codex',
          action: 'rm -rf /tmp/build',
          message: 'Codex wants to delete /tmp/build. Approve?',
        },
      },
    }))
  },

  approve: async () => {
    const { task, setStatus, pushLog, launchFlight } = get()
    if (task?.phase !== 'approval') return
    setStatus('security', 'idle')
    pushLog('security', 'ok', 'approved by human: rm -rf /tmp/build')
    set((s) => ({ task: { ...task, phase: 'working' }, stats: { ...s.stats, approvals: s.stats.approvals + 1 } }))
    const result = await api.approve(task.id)
    pushLog('codex', 'ok', 'deleted /tmp/build · rebuilt · 24/24 tests passed')
    launchFlight('drone-cargo', 'codex', 'router', TIMING.returnFlight)
    await sleep(TIMING.returnFlight)
    pushLog('router', 'ok', `task ${task.id} merged · ${result.tokens.toLocaleString()} tokens`)
    set((s) => ({
      task: { ...task, phase: 'done', result },
      panel: 'result',
      selected: null,
      credits: s.credits + 120,
      stats: { ...s.stats, tokensToday: s.stats.tokensToday + result.tokens, costToday: +(s.stats.costToday + result.costUsd).toFixed(4) },
      buildings: {
        ...s.buildings,
        codex: {
          ...s.buildings.codex,
          sessions: s.buildings.codex.sessions.map((x, i): Session => (i === 0 && x.status === 'running' ? { ...x, status: 'done', tokens: result.tokens } : x)),
        },
      },
    }))
  },

  reject: async () => {
    const { task, setStatus, pushLog, launchFlight } = get()
    if (task?.phase !== 'approval') return
    setStatus('security', 'error')
    pushLog('security', 'error', 'rejected by human: rm -rf /tmp/build')
    pushLog('codex', 'error', 'aborted: delete was denied')
    set((s) => ({
      task: { ...task, phase: 'rejected' },
      stats: { ...s.stats, rejections: s.stats.rejections + 1 },
      buildings: {
        ...s.buildings,
        codex: {
          ...s.buildings.codex,
          sessions: s.buildings.codex.sessions.map((x, i): Session => (i === 0 && x.status === 'running' ? { ...x, status: 'error' } : x)),
        },
      },
    }))
    launchFlight('drone', 'codex', 'router', TIMING.returnFlight)
    await api.reject(task.id)
  },

  selectBuilding: (b) => set({ selected: b, panel: b ? 'building' : null }),
  openResult: () => set({ panel: 'result', selected: null }),
  closePanel: () => set({ panel: null, selected: null }),

  setBuildMode: (mode) => set({ buildMode: mode }),

  placeBuilding: (lot) => {
    const { buildMode, buildings, credits, pushLog } = get()
    if (!buildMode || !BUILDABLE_LOTS.includes(lot)) return null
    if (Object.values(buildings).some((b) => b.lot === lot)) return null
    const cost = CATALOG[buildMode.type].cost
    if (credits < cost) return null
    const bid = id('b')
    const b = makeBuilding(bid, buildMode.type, lot, { name: buildMode.name, bot: buildMode.bot })
    set((s) => ({
      buildings: { ...s.buildings, [bid]: b },
      order: [...s.order, bid],
      credits: s.credits - cost,
      buildMode: null,
      selected: bid,
      panel: 'building',
    }))
    pushLog(bid, 'ok', `built on lot ${lot} · −${cost} CR`)
    if (b.bot) pushLog(bid, 'info', `endpoint: ${b.bot.endpoint || '(not set)'} · waiting for backend`)
    return bid
  },

  removeBuilding: (bid) => {
    if (DEFAULT_BUILDINGS.some((d) => d.id === bid)) return
    set((s) => {
      const rest = { ...s.buildings }
      const refund = Math.floor(CATALOG[rest[bid]?.type ?? 'bot'].cost / 2)
      delete rest[bid]
      return {
        buildings: rest,
        order: s.order.filter((x) => x !== bid),
        selected: s.selected === bid ? null : s.selected,
        panel: s.selected === bid ? null : s.panel,
        credits: s.credits + refund,
      }
    })
  },

  updateBot: (bid, patch) =>
    set((s) => {
      const b = s.buildings[bid]
      if (!b?.bot) return s
      return { buildings: { ...s.buildings, [bid]: { ...b, bot: { ...b.bot, ...patch } } } }
    }),

  renameBuilding: (bid, name) =>
    set((s) => (s.buildings[bid] ? { buildings: { ...s.buildings, [bid]: { ...s.buildings[bid], name } } } : s)),

}))

// Last n logs for one building, oldest first. useShallow avoids a new-array re-render loop.
export const useBuildingLogs = (b: BuildingId, count = 5) =>
  useGrid(useShallow((s) => s.logs.filter((l) => l.buildingId === b).slice(-count)))

// Ordered list of all buildings (stable reference while nothing changes).
export const useBuildingList = () => useGrid(useShallow((s) => s.order.map((bid) => s.buildings[bid])))

// Lots that already have a building.
export const useOccupiedLots = () => useGrid(useShallow((s) => s.order.map((bid) => s.buildings[bid].lot)))

// Dev hook for browser checks: window.__gg.getState().setStatus('codex', 'error')
if (import.meta.env.DEV) (window as unknown as { __gg: typeof useGrid }).__gg = useGrid
