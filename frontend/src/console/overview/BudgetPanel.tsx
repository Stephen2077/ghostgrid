// Row 2 right: today's real spend vs budget as a pixel meter, plus tokens split by agent type.
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CATALOG } from '@/constants'
import { useBuildingList, useGrid } from '@/store/grid'
import type { BuildingType } from '@/types'
import { C, Panel, SegBar, fmtCompact } from './parts'

// Mock weight per building type (no per-agent usage in the backend yet). Session tokens are added on top.
const BASE_WEIGHT: Record<BuildingType, number> = { router: 22_000, codex: 30_000, claude: 26_000, deepseek: 18_000, security: 8_000, bot: 6_000 }
const TYPE_ORDER: BuildingType[] = ['codex', 'claude', 'deepseek', 'router', 'security', 'bot']

export function BudgetPanel() {
  const { cost, budget, tokens } = useGrid(
    useShallow((s) => ({ cost: s.stats.costToday, budget: s.stats.budgetToday, tokens: s.stats.tokensToday })),
  )
  const buildings = useBuildingList()

  const split = useMemo(() => {
    const w = new Map<BuildingType, number>()
    for (const b of buildings) {
      const sessionTokens = b.sessions.reduce((a, s) => a + s.tokens, 0)
      w.set(b.type, (w.get(b.type) ?? 0) + BASE_WEIGHT[b.type] + sessionTokens)
    }
    const sum = [...w.values()].reduce((a, v) => a + v, 0) || 1
    return TYPE_ORDER.filter((t) => w.has(t)).map((t) => {
      const share = (w.get(t) ?? 0) / sum
      return { type: t, share, tokens: Math.round(share * tokens), color: CATALOG[t].accent }
    })
  }, [buildings, tokens])

  const pct = budget > 0 ? cost / budget : 0
  const color = pct >= 1 ? C.red : pct > 0.8 ? C.yellow : C.green
  const left = Math.max(0, budget - cost)

  return (
    <Panel title="BUDGET" pip={C.yellow} meta={<span className="font-pixel text-[8px] leading-none text-gg-yellow">USD</span>}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-pixel text-[8px] leading-none text-gg-mute">SPENT TODAY</div>
          <div className="font-pixel mt-2 text-base leading-none" style={{ color }}>
            ${cost.toFixed(2)}
            <span className="text-[10px] text-gg-mute"> / ${budget.toFixed(2)}</span>
          </div>
        </div>
        <div className="text-right text-lg leading-none text-gg-mute">
          <span className="tabular-nums text-gg-ink">{Math.round(pct * 100)}%</span> used
        </div>
      </div>
      <div className="mt-3">
        <SegBar pct={pct} color={color} cells={20} tall label={`Budget ${Math.round(pct * 100)}% used`} />
      </div>
      <div className="mt-2 flex justify-between text-lg leading-none text-gg-mute">
        <span>LEFT ${left.toFixed(2)}</span>
        <span>RESETS 00:00</span>
      </div>

      <div className="mt-6 border-t-2 border-dashed border-gg-haze pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-pixel text-[8px] leading-none text-gg-mute">TOKENS BY AGENT</span>
          <span className="text-lg leading-none text-gg-ink tabular-nums">{fmtCompact.format(tokens)} today</span>
        </div>
        <div className="mt-3 flex h-6 gap-[2px]" role="img" aria-label="Tokens by agent type">
          {split.map((s) => (
            <span
              key={s.type}
              title={`${CATALOG[s.type].short}: ${fmtCompact.format(s.tokens)}`}
              style={{ flexGrow: s.share, flexBasis: 0, background: s.color }}
              className="min-w-[2px] shadow-[inset_-2px_-2px_0_0_rgba(0,0,0,0.35)]"
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-lg leading-tight">
          {split.map((s) => (
            <li key={s.type} className="flex min-w-0 items-center gap-2">
              <span className="inline-block size-2 flex-none" style={{ background: s.color }} />
              <span className="truncate text-gg-mute">{CATALOG[s.type].short}</span>
              <span className="ml-auto tabular-nums text-gg-ink">{fmtCompact.format(s.tokens)}</span>
              <span className="w-9 text-right tabular-nums text-gg-mute">{Math.round(s.share * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
