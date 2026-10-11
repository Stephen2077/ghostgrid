// Small formatters for the API Keys page.
import { BUILDINGS } from '@/constants'
import { useGrid } from '@/store/grid'
import type { BuildingId } from '@/types'

// Every building in the city (defaults + player-built) takes a provider key. `order` keeps its
// identity until a building is added or removed, so it is safe as a selector result.
export const useKeyBuildings = (): BuildingId[] => useGrid((s) => s.order)

// Defensive lookups: never crash on an unknown id.
export const buildingShort = (b: BuildingId) => useGrid.getState().buildings[b]?.short ?? BUILDINGS[b]?.short ?? b.toUpperCase()
export const buildingName = (b: BuildingId) => useGrid.getState().buildings[b]?.name ?? BUILDINGS[b]?.name ?? b

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function timeAgo(ts: number | null): string {
  if (ts == null) return 'Never'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'Just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
