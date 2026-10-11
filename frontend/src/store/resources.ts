// Game-style resources for the top HUD and the dashboard. Derived from live city state (no backend).
// Real money (COST) is shown separately from game currency (CREDITS) on purpose.
import { useShallow } from 'zustand/react/shallow'
import { useGrid } from './grid'
import { useKeys } from './keys'

export type ResourceLevel = 'ok' | 'warn' | 'alert'

export interface Resource {
  key: 'energy' | 'credits' | 'bandwidth' | 'trust' | 'heat' | 'cost'
  label: string // "ENERGY"
  value: string // formatted main value
  sub: string // small secondary text, e.g. "+120/task" or "/ $5.00"
  pct: number // 0..1 fill for the mini bar
  level: ResourceLevel
  metric: string // the real metric behind it (tooltip)
}

const fmtK = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

export function useResources(): Resource[] {
  const snap = useGrid(
    useShallow((s) => {
      const list = s.order.map((id) => s.buildings[id])
      return {
        total: list.length,
        working: list.filter((b) => b.status === 'working').length,
        errors: list.filter((b) => b.status === 'error').length,
        approvals: list.filter((b) => b.status === 'needs_approval').length,
        credits: s.credits,
        ok: s.stats.approvals,
        bad: s.stats.rejections,
        tokens: s.stats.tokensToday,
        cost: s.stats.costToday,
        budget: s.stats.budgetToday,
      }
    }),
  )
  const keyCount = useKeys((s) => s.keys.length)

  const capacity = Math.max(4, snap.total)
  const energyPct = snap.working / capacity
  const trust = snap.ok + snap.bad === 0 ? 1 : snap.ok / (snap.ok + snap.bad)
  const heat = Math.min(1, 0.08 + snap.working * 0.12 + snap.errors * 0.35 + snap.approvals * 0.15)
  const bandwidth = 18_000 + snap.working * 24_000 // tokens/min (mock rate)
  const costPct = snap.cost / snap.budget

  return [
    {
      key: 'energy',
      label: 'ENERGY',
      value: `${snap.working}/${capacity}`,
      sub: keyCount === 0 ? 'no key' : 'agents busy',
      pct: energyPct,
      level: keyCount === 0 ? 'warn' : energyPct >= 1 ? 'alert' : energyPct > 0.8 ? 'warn' : 'ok',
      metric: 'Running agents / capacity',
    },
    {
      key: 'credits',
      label: 'CREDITS',
      value: snap.credits.toLocaleString(),
      sub: '+120 / task',
      pct: Math.min(1, snap.credits / 3000),
      level: snap.credits < 150 ? 'warn' : 'ok',
      metric: 'Game currency. Earned by finished tasks, spent on buildings. Not real money.',
    },
    {
      key: 'bandwidth',
      label: 'BANDWIDTH',
      value: `${fmtK(bandwidth)}/m`,
      sub: `${fmtK(snap.tokens)} today`,
      pct: Math.min(1, bandwidth / 120_000),
      level: bandwidth > 96_000 ? 'warn' : 'ok',
      metric: 'Tokens per minute across all agents',
    },
    {
      key: 'trust',
      label: 'TRUST',
      value: `${Math.round(trust * 100)}%`,
      sub: `${snap.ok} ok · ${snap.bad} no`,
      pct: trust,
      level: trust < 0.7 ? 'alert' : trust < 0.85 ? 'warn' : 'ok',
      metric: 'Approved / (approved + rejected) risky actions',
    },
    {
      key: 'heat',
      label: 'HEAT',
      value: `${Math.round(heat * 100)}%`,
      sub: snap.errors ? `${snap.errors} error` : snap.approvals ? 'awaiting human' : 'stable',
      pct: heat,
      level: heat > 0.6 ? 'alert' : heat > 0.35 ? 'warn' : 'ok',
      metric: 'Load + errors + pending risky actions',
    },
    {
      key: 'cost',
      label: 'COST',
      value: `$${snap.cost.toFixed(2)}`,
      sub: `/ $${snap.budget.toFixed(2)} today`,
      pct: Math.min(1, costPct),
      level: costPct >= 1 ? 'alert' : costPct > 0.8 ? 'warn' : 'ok',
      metric: 'Real API spend today vs. daily budget (USD)',
    },
  ]
}
