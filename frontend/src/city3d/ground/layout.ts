// Static ground layout: block spans, road centers and hand-placed lamps / props / puddles / cars.
// Every position stays off the LOTS footprints in world.ts. y = 0 is the road surface.
import { PALETTE } from '../materials'
import { MAP, ROAD_INDEXES } from '../world'

export const HALF = MAP.size / 2
export const CURB = 0.05 // sidewalk / plaza height above the road
export const SLAB_DEPTH = 1.2 // floating platform thickness under the map
export const ROADS = ROAD_INDEXES.map((i) => i + 0.5 - HALF) // world centers of the road rows / cols

export const isRoadIndex = (i: number) => ROAD_INDEXES.includes(i)

// Non-road tile ranges [start, end) along one axis = the blocks between the roads.
export function blockSpans(): [number, number][] {
  const out: [number, number][] = []
  let start = 0
  for (let i = 0; i <= MAP.size; i++) {
    if (i === MAP.size || isRoadIndex(i)) {
      if (i > start) out.push([start, i])
      start = i + 1
    }
  }
  return out
}

// Street lamp: pole at (x, z), arm + head reach toward the road along (ax, az).
export interface Lamp {
  x: number
  z: number
  ax: number
  az: number
  color: string
}
export const LAMP_REACH = 0.3 // head offset from the pole

// 8 lamps on intersection corners + 8 on the outer road segments (outer side, away from lots) = 16.
export const LAMPS: Lamp[] = (() => {
  const out: Omit<Lamp, 'color'>[] = []
  const off = 0.65
  for (const rx of ROADS)
    for (const rz of ROADS) {
      out.push({ x: rx - off, z: rz - off, ax: 1, az: 0 })
      out.push({ x: rx + off, z: rz + off, ax: -1, az: 0 })
    }
  for (const r of ROADS) {
    const side = r < 0 ? -1 : 1
    for (const s of [-5.5, 5.5]) {
      out.push({ x: r + side * off, z: s, ax: -side, az: 0 }) // beside a column road
      out.push({ x: s, z: r + side * off, ax: 0, az: -side }) // beside a row road
    }
  }
  return out.map((l, i) => ({ ...l, color: i % 2 ? PALETTE.pink : PALETTE.cyan }))
})()

export type PropKind = 'vending' | 'ac' | 'bench'
// rot = long side / front face along z instead of x
export interface Prop {
  kind: PropKind
  x: number
  z: number
  rot?: boolean
}

export const PROPS: Prop[] = [
  { kind: 'vending', x: -3.55, z: -7.3 },
  { kind: 'vending', x: 3.55, z: -7.3 },
  { kind: 'vending', x: -7.3, z: 3.55, rot: true },
  { kind: 'vending', x: 0.9, z: -3.55 },
  { kind: 'vending', x: 7.4, z: -0.5, rot: true },
  { kind: 'vending', x: -0.6, z: 7.4 },
  { kind: 'ac', x: -1.4, z: -4.4 },
  { kind: 'ac', x: -3.6, z: -0.6 },
  { kind: 'ac', x: 3.6, z: 0.6 },
  { kind: 'ac', x: 7.4, z: 3.6 },
  { kind: 'ac', x: 1.3, z: -7.4 },
  { kind: 'ac', x: -7.4, z: -1.4 },
  { kind: 'ac', x: -4.6, z: 3.55 },
  { kind: 'bench', x: 0, z: -1.55 },
  { kind: 'bench', x: 0, z: 1.55 },
  { kind: 'bench', x: -1.55, z: 0, rot: true },
  { kind: 'bench', x: 1.55, z: 0, rot: true },
]

export const PUDDLES: { x: number; y: number; z: number; w: number; d: number; rot: number }[] = [
  { x: -2.3, y: 0.004, z: 6.1, w: 0.75, d: 0.45, rot: Math.PI / 2 },
  { x: 5.3, y: 0.004, z: -2.65, w: 0.85, d: 0.42, rot: 0 },
  { x: 1.25, y: CURB + 0.004, z: 1.2, w: 0.6, d: 0.5, rot: 0 },
]

// Cars drive straight along a road and wrap at the platform edge (they shrink to 0 there).
export interface Car {
  axis: 'x' | 'z'
  road: number
  dir: 1 | -1
  speed: number
  phase: number
  color: string
}
const [R0, R1] = ROADS
export const CARS: Car[] = [
  { axis: 'z', road: R0, dir: 1, speed: 1.6, phase: 0, color: PALETTE.haze },
  { axis: 'z', road: R0, dir: -1, speed: 1.3, phase: 7, color: PALETTE.pink },
  { axis: 'z', road: R1, dir: 1, speed: 1.9, phase: 4, color: PALETTE.steel },
  { axis: 'z', road: R1, dir: -1, speed: 1.5, phase: 11, color: PALETTE.yellow },
  { axis: 'x', road: R0, dir: 1, speed: 1.4, phase: 2, color: PALETTE.cyan },
  { axis: 'x', road: R0, dir: -1, speed: 1.7, phase: 9, color: PALETTE.dusk },
  { axis: 'x', road: R1, dir: 1, speed: 1.2, phase: 13, color: PALETTE.grey },
  { axis: 'x', road: R1, dir: -1, speed: 2.0, phase: 6, color: PALETTE.haze },
]
