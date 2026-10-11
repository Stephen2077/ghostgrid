// BOT: config of a player-built custom bot. Stored only; nothing is sent until the backend connects.
import { useId, useMemo } from 'react'
import { BOT_KINDS } from '@/constants'
import { useGrid } from '@/store/grid'
import type { BotConfig, BuildingId } from '@/types'
import { BlurField, Field, SectionTitle } from './parts'

const SWATCHES = ['#ff2bd6', '#00f0ff', '#39ff14', '#ffd400', '#ff3355']

export function BotSection({ id, bot }: { id: BuildingId; bot: BotConfig }) {
  // Defensive: bots are created by the build menu in parallel; never crash the panel on a partial config.
  const kind = BOT_KINDS[bot.kind] ?? BOT_KINDS.custom
  const endpoint = bot.endpoint ?? ''
  const color = (bot.color ?? '').toLowerCase()
  const endpointId = useId()
  const scheduleId = useId()
  const notesId = useId()
  const update = (patch: Partial<BotConfig>) => useGrid.getState().updateBot(id, patch)
  const hasEndpoint = endpoint.trim() !== ''
  const line = hasEndpoint ? 'var(--gg-cyan)' : 'var(--gg-yellow)'

  return (
    <section>
      <SectionTitle
        right={
          <span className="font-pixel text-[8px] leading-none" style={{ color: kind.color }}>
            {kind.label.toUpperCase()}
          </span>
        }
      >
        BOT
      </SectionTitle>
      <div className="flex flex-col gap-3">
        <p className="text-[18px] leading-[20px] text-gg-mute">{kind.description}</p>

        <Field label="ENDPOINT URL" htmlFor={endpointId}>
          <BlurField
            id={endpointId}
            type="url"
            value={endpoint}
            placeholder="https://your-backend/bot"
            onCommit={(endpoint) => update({ endpoint })}
          />
        </Field>

        <div
          className="flex items-start gap-2 border-2 px-2 py-2"
          style={{ borderColor: line, color: line, background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
          role="status"
        >
          <span className={`mt-[2px] inline-block size-2 shrink-0 ${hasEndpoint ? '' : 'gg-sp-live'}`} style={{ background: line }} />
          <span className="font-pixel text-[8px] leading-[12px]">
            {hasEndpoint ? 'ENDPOINT SET · not connected (backend pending)' : 'WAITING FOR BACKEND'}
          </span>
        </div>

        <Field label="SCHEDULE" htmlFor={scheduleId}>
          <BlurField id={scheduleId} value={bot.schedule ?? ''} placeholder="every 5m" onCommit={(schedule) => update({ schedule })} />
        </Field>

        <Field label="NOTES" htmlFor={notesId}>
          <BlurField
            id={notesId}
            multiline
            value={bot.notes ?? ''}
            placeholder="What should this bot do?"
            onCommit={(notes) => update({ notes })}
          />
        </Field>

        <div className="flex flex-col gap-1">
          <span className="font-pixel text-[8px] leading-[12px] text-gg-mute">COLOR</span>
          <div role="radiogroup" aria-label="Bot color" className="flex gap-3">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                onClick={() => update({ color: c })}
                className="gg-sp-swatch size-6 border-2 border-gg-void"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {bot.kind === 'trading' && <TradingStats seed={id} />}
      </div>
    </section>
  )
}

// ---- Mock trading stats (seeded, stable per bot). Paper only, no market data, no orders. ----

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ACTIONS = ['BUY', 'HOLD', 'SELL']
const W = 96
const H = 28

function mockTrading(seed: string) {
  const rnd = mulberry32(hash(seed))
  const pts = [0]
  for (let i = 1; i < 32; i++) pts.push(pts[i - 1] + (rnd() - 0.42) * 0.9)
  const pnl = pts[pts.length - 1]
  const min = Math.min(0, ...pts)
  const max = Math.max(0, ...pts)
  const y = (v: number) => Math.round(H - 2 - ((v - min) / (max - min || 1)) * (H - 4))
  const sx = W / (pts.length - 1)
  // Stepped path (H/V only) reads as pixel art.
  let path = `M0 ${y(pts[0])}`
  for (let i = 1; i < pts.length; i++) path += ` H${Math.round(i * sx)} V${y(pts[i])}`
  const signals = ['BTC', 'ETH'].map((a) => `${ACTIONS[Math.floor(rnd() * 3)]} ${a}`).join(' · ')
  const positions = 1 + Math.floor(rnd() * 4)
  return { path, zeroY: y(0), pnl, signals, positions }
}

function TradingStats({ seed }: { seed: string }) {
  const t = useMemo(() => mockTrading(seed), [seed])
  const color = t.pnl >= 0 ? 'var(--gg-green)' : 'var(--gg-red)'
  return (
    <div className="flex flex-col gap-2 border-2 border-dashed border-gg-haze bg-gg-void p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[8px] leading-none text-gg-mute">TRADING · 24H</span>
        <span className="font-pixel border-2 border-gg-yellow px-1 py-[3px] text-[8px] leading-none text-gg-yellow">PAPER / MOCK</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-12 w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Mock PnL sparkline"
      >
        <line x1={0} x2={W} y1={t.zeroY} y2={t.zeroY} stroke="var(--gg-haze)" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        <path d={t.path} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="text-[20px] leading-[20px] tabular-nums" style={{ color }}>
        PnL {t.pnl >= 0 ? '+' : ''}
        {t.pnl.toFixed(2)}% (paper)
      </p>
      <p className="text-[18px] leading-[20px] text-gg-ink">Signals: {t.signals}</p>
      <p className="text-[18px] leading-[20px] text-gg-mute">Positions: {t.positions} open (paper) · mock data, no real orders</p>
    </div>
  )
}
