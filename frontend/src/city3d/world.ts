// 3D city layout. 1 tile = 1 world unit. The map is MAP.size × MAP.size tiles centered on the origin.
// +x goes to the screen's lower-right, +z to the lower-left (camera looks from +x,+y,+z toward the origin).
import type { Building, BuildingType } from '../types'

export const MAP = { size: 16 }

// Roads are full rows/columns of tiles at these indexes (both axes) → a 3×3 grid of blocks.
export const ROAD_INDEXES = [5, 10]

export interface Lot {
  id: number
  tx: number // first tile column (0..15)
  tz: number // first tile row (0..15)
  w: number // tiles along x
  d: number // tiles along z
}

// Lots 0–4 hold the default buildings (see DEFAULT_BUILDINGS). Lots 5–12 are empty plots the player can build on.
export const LOTS: Lot[] = [
  { id: 0, tx: 7, tz: 7, w: 2, d: 2 }, // center plaza → Router Spire
  { id: 1, tx: 1, tz: 1, w: 3, d: 3 }, // NW block (back) → DeepSeek Forge
  { id: 2, tx: 12, tz: 1, w: 3, d: 3 }, // NE block (right) → Claude Nexus
  { id: 3, tx: 1, tz: 12, w: 3, d: 3 }, // SW block (left) → Codex Tower
  { id: 4, tx: 12, tz: 12, w: 3, d: 3 }, // SE block → Security Checkpoint
  { id: 5, tx: 6, tz: 1, w: 2, d: 2 }, // N block
  { id: 6, tx: 8, tz: 2, w: 2, d: 2 },
  { id: 7, tx: 6, tz: 12, w: 2, d: 2 }, // S block
  { id: 8, tx: 8, tz: 13, w: 2, d: 2 },
  { id: 9, tx: 1, tz: 6, w: 2, d: 2 }, // W block
  { id: 10, tx: 2, tz: 8, w: 2, d: 2 },
  { id: 11, tx: 12, tz: 6, w: 2, d: 2 }, // E block
  { id: 12, tx: 13, tz: 8, w: 2, d: 2 },
]

export const BUILDABLE_LOTS = LOTS.filter((l) => l.id >= 5).map((l) => l.id)

// World-space center of a lot on the ground plane.
export function lotCenter(lotId: number): [number, number, number] {
  const l = LOTS[lotId]
  const half = MAP.size / 2
  return [l.tx + l.w / 2 - half, 0, l.tz + l.d / 2 - half]
}

// Footprint size (world units) a building may use on its lot (leave a 0.2 margin for sidewalks).
export function lotFootprint(lotId: number): { w: number; d: number } {
  const l = LOTS[lotId]
  return { w: l.w - 0.4, d: l.d - 0.4 }
}

// Roof height (world units) of each building type, without antennas. Drones land at the roof.
export const BUILDING_HEIGHT: Record<BuildingType, number> = {
  router: 7,
  codex: 5,
  claude: 4.5,
  deepseek: 3.5,
  security: 2.2,
  bot: 2.6,
}

// Where drones take off / land for a building (just above its roof).
export function dockPoint(b: Pick<Building, 'lot' | 'type'>): [number, number, number] {
  const [x, , z] = lotCenter(b.lot)
  return [x, BUILDING_HEIGHT[b.type] + 0.6, z]
}

// Camera: orthographic, 2:1 dimetric ("pixel isometric") — elevation 30°, azimuth 45°.
export const CAMERA = {
  position: [20, 16.33, 20] as [number, number, number],
  zoom: 34, // world-units → CSS px; CameraRig adapts it to the viewport
  near: -100,
  far: 200,
}

// Each rendered pixel covers PIXEL_SIZE × PIXEL_SIZE CSS pixels (pixel-art look + cheap rendering).
export const PIXEL_SIZE = 3
