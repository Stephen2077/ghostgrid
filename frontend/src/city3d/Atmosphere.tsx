// Night mood around the floating city: pixel sky, stars, distant city, rain, specks, holo billboards, flying cars.
// Budget: 10 draw calls (sky bg, stars, city, rain, specks, 3 signs, sign frames, cars). Nothing allocates per
// frame: stars + rain animate on the GPU (one uniform each), cars/frames/specks mutate buffers in useFrame.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PALETTE, UNIT_BOX } from './materials'
import { CAMERA, MAP, PIXEL_SIZE } from './world'

const REDUCED =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ---------- iso screen frame ----------
// A group with ISO_Q has local +x = screen right, +y = screen up, +z = toward the camera.
const ISO_Q = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(new THREE.Vector3(...CAMERA.position), new THREE.Vector3(), new THREE.Vector3(0, 1, 0)),
)
const SCR_X = new THREE.Vector3(1, 0, 0).applyQuaternion(ISO_Q)
const SCR_Y = new THREE.Vector3(0, 1, 0).applyQuaternion(ISO_Q)
const VIEW = new THREE.Vector3(0, 0, 1).applyQuaternion(ISO_Q) // toward the camera

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function nearestTex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- layout (screen-space, see ISO_Q) ----------
// Signs sit in open sky beside the platform, clear of the DOM HUD (TopNav, BuildMenu, CommandBar, 380px
// SidePanel) and of the building labels at the default camera on 1440×900 and 1193×687: upper-left (between
// BuildMenu and the DeepSeek label), upper-right (left of the SidePanel), lower-left (under the BuildMenu).
// t = world units per texel (≈ 1 render px at zoom 42). k is chosen so the ±6° idle sway barely moves them.
const SIGNS = [
  { lines: ['GHOSTGRID'], color: PALETTE.pink, t: 0.075, sx: -6.9, sy: 8, k: -4 },
  { lines: ['AGENTS', 'ONLINE'], color: PALETTE.cyan, t: 0.065, sx: 4.6, sy: 7.6, k: 0 },
  { lines: ['BUILD', 'YOUR', 'CITY'], color: PALETTE.pink, t: 0.07, sx: -14.4, sy: -4.6, k: -2.6 },
].map((s) => {
  const texW = Math.max(...s.lines.map((l) => l.length)) * 8 + 8 // see holoTexture
  const texH = s.lines.length * 11 + 5
  return { ...s, text: s.lines.join(' '), hw: (texW * s.t) / 2, hh: (texH * s.t) / 2 }
})

// Flying-car lanes (world space, along x).
const LANES = [
  { z: -16, y: 2, from: -40, to: 40, speed: 7, color: PALETTE.pink, phase: 0 },
  { z: 17, y: -4, from: 28, to: -44, speed: 9, color: PALETTE.cyan, phase: 31 },
]

// Platform lower silhouette in screen space (assumes a slab up to SLAB deep under the 16×16 ground).
const HALF = MAP.size / 2 + 0.6
const SLAB = 2.5
const P_FRONT_SY = HALF * SCR_Y.x - SLAB * SCR_Y.y + HALF * SCR_Y.z
const P_SIDE_SX = Math.abs(-HALF * SCR_X.x + HALF * SCR_X.z)
const P_SIDE_SY = -HALF * SCR_Y.x - SLAB * SCR_Y.y + HALF * SCR_Y.z
const platformFloor = (ax: number) => P_FRONT_SY + (P_SIDE_SY - P_FRONT_SY) * Math.min(1, ax / P_SIDE_SX)

// ---------- sky ----------
function hexRgb(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function makeSkyTexture() {
  const H = 128
  const c = document.createElement('canvas')
  c.width = 1
  c.height = H
  const g = c.getContext('2d')!
  const stops: [number, number[]][] = [
    [0, hexRgb(PALETTE.void)],
    [0.5, hexRgb(PALETTE.night)],
    [1, hexRgb(PALETTE.dusk)],
  ]
  const pink = hexRgb(PALETTE.pink)
  const BAND = 4 // posterized steps → pixel-art sky
  for (let y = 0; y < H; y += BAND) {
    const t = (y + BAND / 2) / H
    const i = t < stops[1][0] ? 0 : 1
    const f = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
    const glow = Math.exp(-(((t - 0.74) / 0.05) ** 2)) * 0.14 // faint pink horizon band
    const col = [0, 1, 2].map((k) => {
      const base = stops[i][1][k] + (stops[i + 1][1][k] - stops[i][1][k]) * f
      return Math.round(base + (pink[k] - base) * glow)
    })
    g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`
    g.fillRect(0, y, 1, BAND)
  }
  return nearestTex(c)
}

function Sky() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const tex = makeSkyTexture()
    const prev = scene.background
    scene.background = tex
    return () => {
      if (scene.background === tex) scene.background = prev
      tex.dispose()
    }
  }, [scene])
  return null
}

// ---------- stars (GPU twinkle) ----------
const STAR_VS = /* glsl */ `
uniform float uTime;
attribute vec3 aColor;
attribute vec3 aTw; // phase, speed, size(px)
varying vec3 vColor;
void main() {
  float s = 0.5 + 0.5 * sin(uTime * aTw.y + aTw.x);
  s = floor(s * 3.0 + 0.5) / 3.0; // stepped twinkle
  vColor = aColor * (0.2 + 0.8 * s);
  gl_PointSize = aTw.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FLAT_FS = /* glsl */ `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <colorspace_fragment>
}`

function Stars() {
  const { geo, mat } = useMemo(() => {
    const N = 320
    const r = rng(11)
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const tw = new Float32Array(N * 3)
    const palette = [PALETTE.ink, PALETTE.ink, PALETTE.ink, PALETTE.ink, PALETTE.cyan, PALETTE.pink, PALETTE.yellow]
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -44 + r() * 88
      pos[i * 3 + 1] = -6 + 36 * Math.sqrt(r()) // denser toward the top
      pos[i * 3 + 2] = -120 // far behind everything (screen-space group)
      c.set(palette[Math.floor(r() * palette.length)]).multiplyScalar(r() < 0.08 ? 1.6 : 0.5 + r() * 0.4)
      col.set([c.r, c.g, c.b], i * 3)
      tw.set([r() * 6.283, 0.6 + r() * 2.4, r() < 0.15 ? 2 : 1], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aTw', new THREE.BufferAttribute(tw, 3))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: STAR_VS,
      fragmentShader: FLAT_FS,
      toneMapped: false,
    })
    return { geo, mat }
  }, [])
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])
  useFrame(({ clock }) => {
    if (!REDUCED) mat.uniforms.uTime.value = clock.elapsedTime % 1000
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

// ---------- distant city (1 instanced mesh, windows via one shared emissive texture) ----------
const CITY_COLORS = ['#120b2a', '#1a1040', '#24164f']

function makeWindowTexture() {
  const S = 32 // 8×8 cells of 4 texels, 2×2 windows; texel (0,0) is always dark (used for roofs)
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, S, S)
  const r = rng(31)
  const lit = [PALETTE.ink, PALETTE.ink, PALETTE.ink, PALETTE.cyan, PALETTE.pink, PALETTE.yellow]
  for (let y = 0; y < S; y += 4)
    for (let x = 0; x < S; x += 4)
      if (r() < 0.2) {
        g.fillStyle = lit[Math.floor(r() * lit.length)]
        g.fillRect(x + 1, y + 1, 2, 2)
      }
  const t = nearestTex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

interface CityBox {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  c: number
}

function layoutCity(count: number): CityBox[] {
  const r = rng(2077)
  const out: CityBox[] = []
  for (let tries = 0; out.length < count && tries < count * 8; tries++) {
    const a = r() * Math.PI * 2
    const R = 14 + Math.pow(r(), 0.85) * 16
    const x = Math.cos(a) * R
    const z = Math.sin(a) * R
    const w = 0.8 + r() * 1.6
    const d = 0.8 + r() * 1.6
    const h = 2 + Math.pow(r(), 1.5) * 12
    const sx = x * SCR_X.x + z * SCR_X.z
    const hwS = (0.7072 * (w + d)) / 2 // half screen width of the box
    const hdY = (0.3536 * (w + d)) / 2 // top diamond rises this much on screen
    const syBase = x * SCR_Y.x + z * SCR_Y.z
    const topFor = (syLimit: number) => (syLimit - hdY - syBase) / SCR_Y.y
    const kOf = (top: number) => x * VIEW.x + top * VIEW.y + z * VIEW.z + (0.6124 * (w + d)) / 2

    let maxTop = topFor(8.5 + r() * 2.5) // keep the sky visible above the skyline
    // In front of the platform: stay below its lower silhouette.
    const ax = Math.max(0, Math.abs(sx) - hwS)
    if (x * VIEW.x + z * VIEW.z > 0 && ax < P_SIDE_SX + 0.5) maxTop = Math.min(maxTop, topFor(platformFloor(ax) - 0.5))
    // Never cover a billboard from in front; sky signs (sy > 0) also get clear sky behind them.
    for (const s of SIGNS) {
      const overlap = Math.abs(sx - s.sx) < hwS + s.hw + 0.3
      if (overlap && (s.sy > 0 || kOf(-6 + h) > s.k)) maxTop = Math.min(maxTop, topFor(s.sy - s.hh - 0.4))
    }
    // Keep the car lanes clear.
    for (const l of LANES) if (Math.abs(z - l.z) < d / 2 + 0.9) maxTop = Math.min(maxTop, l.y - 0.7)

    let top = -6 + h
    let base = -6
    if (top > maxTop) {
      top = maxTop
      base = Math.max(-26, top - h) // sink it (reads as a city far below) instead of flattening it
    }
    const hh = top - base
    if (hh < 1) continue
    out.push({ x, y: base + hh / 2, z, w, h: hh, d, c: Math.floor(r() * CITY_COLORS.length) })
  }
  return out
}

function DistantCity() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const boxes = useMemo(() => layoutCity(210), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveMap: makeWindowTexture(),
      emissiveIntensity: 1.1,
    })
    // World-scaled window UVs per instance (no stretching on tall boxes), dark roofs, per-building offset.
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_INSTANCING
  vec3 ggS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec2 ggOff = floor(fract(instanceMatrix[3].xz * vec2(0.137, 0.213)) * 8.0) / 8.0;
  vec2 ggRep = abs(normal.x) > 0.5 ? ggS.zy : ggS.xy;
  vEmissiveMapUv = abs(normal.y) > 0.5 ? vec2(0.01) : uv * ggRep / 3.2 + ggOff;
#endif`,
      )
    }
    m.customProgramCacheKey = () => 'gg-distant-city'
    return m
  }, [])
  useEffect(() => () => {
    mat.emissiveMap?.dispose()
    mat.dispose()
  }, [mat])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    boxes.forEach((b, i) => {
      mesh.setMatrixAt(i, m.makeScale(b.w, b.h, b.d).setPosition(b.x, b.y, b.z))
      mesh.setColorAt(i, c.set(CITY_COLORS[b.c]))
    })
    mesh.count = boxes.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes])
  return <instancedMesh ref={ref} args={[UNIT_BOX, mat, boxes.length]} />
}

// ---------- rain (GPU fall, one line segment per drop) ----------
const RAIN = { n: 390, half: 10, bottom: -2, span: 16, fall: 11, len: 0.55 }
const RAIN_VS = /* glsl */ `
uniform float uTime;
uniform float uSpan;
uniform float uBottom;
uniform float uLen;
uniform vec3 uSlant;
attribute float aTail;
attribute vec3 aColor;
varying vec3 vColor;
varying float vA;
void main() {
  float ph = mod(position.y - uTime, uSpan); // height above uBottom
  vec3 p = vec3(position.x, uBottom + ph, position.z) + uSlant * (uSpan - ph);
  p += normalize(vec3(-uSlant.x, 1.0, -uSlant.z)) * uLen * aTail;
  vColor = aColor;
  vA = 1.0 - 0.75 * aTail;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`
const RAIN_FS = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vA;
void main() {
  gl_FragColor = vec4(vColor, uOpacity * vA);
  #include <colorspace_fragment>
}`

function Rain() {
  const { geo, mat } = useMemo(() => {
    const r = rng(5)
    const pos = new Float32Array(RAIN.n * 6)
    const tail = new Float32Array(RAIN.n * 2)
    const col = new Float32Array(RAIN.n * 6)
    const c = new THREE.Color()
    for (let i = 0; i < RAIN.n; i++) {
      const x = (r() * 2 - 1) * RAIN.half
      const z = (r() * 2 - 1) * RAIN.half
      const y = r() * RAIN.span
      pos.set([x, y, z, x, y, z], i * 6)
      tail.set([0, 1], i * 2)
      c.set(r() < 0.8 ? PALETTE.ink : r() < 0.5 ? PALETTE.pink : PALETTE.cyan)
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aTail', new THREE.BufferAttribute(tail, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpan: { value: RAIN.span },
        uBottom: { value: RAIN.bottom },
        uLen: { value: RAIN.len },
        uSlant: { value: new THREE.Vector3(0.09, 0, -0.09) }, // leans to screen-right
        uOpacity: { value: 0.19 },
      },
      vertexShader: RAIN_VS,
      fragmentShader: RAIN_FS,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    return { geo, mat }
  }, [])
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])
  useFrame(({ clock }) => {
    if (!REDUCED) mat.uniforms.uTime.value = (clock.elapsedTime * RAIN.fall) % RAIN.span
  })
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />
}

// ---------- floating specks (1 Points; drift mutates one Float32Array in useFrame) ----------
const SPECKS = { n: 120, half: 9, top: 8 }

function Specks() {
  const { geo, mat, attr, drift } = useMemo(() => {
    const r = rng(77)
    const pos = new Float32Array(SPECKS.n * 3)
    const col = new Float32Array(SPECKS.n * 3)
    const drift = new Float32Array(SPECKS.n * 3) // base x, rise speed, wobble phase
    const palette = [PALETTE.cyan, PALETTE.pink, PALETTE.green]
    const c = new THREE.Color()
    for (let i = 0; i < SPECKS.n; i++) {
      const x = (r() * 2 - 1) * SPECKS.half
      pos.set([x, r() * SPECKS.top, (r() * 2 - 1) * SPECKS.half], i * 3)
      drift.set([x, 0.15 + r() * 0.3, r() * 6.283], i * 3)
      c.set(palette[i % palette.length])
      col.set([c.r, c.g, c.b], i * 3)
    }
    const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', attr)
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const mat = new THREE.PointsMaterial({
      size: PIXEL_SIZE, // CSS px × pixelRatio (1/PIXEL_SIZE) → 1 render pixel
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    })
    return { geo, mat, attr, drift }
  }, [])
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])
  useFrame(({ clock }, dt) => {
    if (REDUCED) return
    const pos = attr.array as Float32Array
    const t = clock.elapsedTime
    const step = Math.min(dt, 0.1) // no jump after a background tab
    for (let o = 0; o < pos.length; o += 3) {
      const y = pos[o + 1] + drift[o + 1] * step
      pos[o + 1] = y > SPECKS.top ? y - SPECKS.top : y
      pos[o] = drift[o] + Math.sin(t * 0.4 + drift[o + 2]) * 0.25
    }
    attr.needsUpdate = true
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

// ---------- holographic billboards ----------
const SIGN_BG = 'rgba(26,16,64,0.6)'

// Multi-line pixel-font sign: 8px glyphs, 3px line gap, 4px padding (size matches SIGNS texW/texH).
function holoTexture(lines: string[], color: string) {
  const font = '8px "Press Start 2P", monospace'
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  g.font = font
  const widths = lines.map((l) => Math.ceil(g.measureText(l).width))
  c.width = Math.max(16, ...widths) + 8
  c.height = lines.length * 11 + 5
  g.fillStyle = SIGN_BG // resizing the canvas reset the context state
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = color
  g.font = font
  g.textBaseline = 'middle'
  lines.forEach((l, i) => g.fillText(l, Math.round((c.width - widths[i]) / 2), 9 + i * 11))
  return nearestTex(c)
}
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)
const FRAME_T = 0.14
const FRAME_PAD = 0.12

// Mostly-on hologram flicker with stepped glitches.
function flicker(seed: number, t: number) {
  const k = Math.floor(t * 10 + seed * 17)
  const h = Math.abs(Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453) % 1
  const glitch = h < 0.05 ? 0.15 : h < 0.1 ? 0.55 : 1
  return glitch * (0.88 + 0.12 * Math.sin(t * 2.1 + seed * 2))
}

function Billboards() {
  const frameRef = useRef<THREE.InstancedMesh>(null)
  const signs = useMemo(
    () =>
      SIGNS.map((s) => {
        const tex = holoTexture(s.lines, s.color)
        const img = tex.image as HTMLCanvasElement
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          color: new THREE.Color(1.9, 1.9, 1.9),
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        })
        return { ...s, w: img.width * s.t, h: img.height * s.t, mat, neon: new THREE.Color(s.color).multiplyScalar(2.4) }
      }),
    [],
  )
  const frameMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), [])
  useEffect(() => () => {
    signs.forEach((s) => {
      s.mat.map?.dispose()
      s.mat.dispose()
    })
    frameMat.dispose()
  }, [signs, frameMat])

  useLayoutEffect(() => {
    const mesh = frameRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    signs.forEach((s, i) => {
      const W = s.w + FRAME_PAD * 2 + FRAME_T
      const H = s.h + FRAME_PAD * 2 + FRAME_T
      const bars: [number, number, number, number][] = [
        [s.sx, s.sy + H / 2, W + FRAME_T, FRAME_T],
        [s.sx, s.sy - H / 2, W + FRAME_T, FRAME_T],
        [s.sx - W / 2, s.sy, FRAME_T, H],
        [s.sx + W / 2, s.sy, FRAME_T, H],
      ]
      bars.forEach(([x, y, bw, bh], j) => {
        mesh.setMatrixAt(i * 4 + j, m.makeScale(bw, bh, FRAME_T).setPosition(x, y, s.k))
        mesh.setColorAt(i * 4 + j, s.neon)
      })
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [signs])

  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    if (REDUCED) return
    const t = clock.elapsedTime
    const mesh = frameRef.current
    signs.forEach((s, i) => {
      const f = flicker(i + 1, t)
      s.mat.opacity = 0.92 * f
      if (mesh) for (let j = 0; j < 4; j++) mesh.setColorAt(i * 4 + j, tmp.copy(s.neon).multiplyScalar(f))
    })
    if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <>
      {signs.map((s) => (
        <mesh
          key={s.text}
          geometry={UNIT_PLANE}
          material={s.mat}
          position={[s.sx, s.sy, s.k]}
          scale={[s.w, s.h, 1]}
          renderOrder={2}
        />
      ))}
      <instancedMesh ref={frameRef} args={[UNIT_BOX, frameMat, SIGNS.length * 4]} frustumCulled={false} />
    </>
  )
}

// ---------- flying cars with light trails (1 instanced mesh) ----------
const TRAIL = 7
const PER_CAR = 2 + TRAIL // body, headlight, trail segments

function FlyingCars() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(() => () => mat.dispose(), [mat])
  const m = useMemo(() => new THREE.Matrix4(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new THREE.Color()
    LANES.forEach((l, i) => {
      const o = i * PER_CAR
      mesh.setColorAt(o, c.set(PALETTE.dusk))
      mesh.setColorAt(o + 1, c.set(PALETTE.ink).multiplyScalar(3))
      for (let j = 0; j < TRAIL; j++)
        mesh.setColorAt(o + 2 + j, c.set(l.color).multiplyScalar(2.6 * Math.pow(1 - j / TRAIL, 1.3)))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = REDUCED ? 0 : clock.elapsedTime
    LANES.forEach((l, i) => {
      const o = i * PER_CAR
      const len = Math.abs(l.to - l.from)
      const dir = Math.sign(l.to - l.from)
      const x = l.from + dir * ((t * l.speed + l.phase) % len)
      mesh.setMatrixAt(o, m.makeScale(0.9, 0.32, 0.5).setPosition(x, l.y, l.z))
      mesh.setMatrixAt(o + 1, m.makeScale(0.16, 0.16, 0.42).setPosition(x + dir * 0.5, l.y, l.z))
      for (let j = 0; j < TRAIL; j++)
        mesh.setMatrixAt(o + 2 + j, m.makeScale(0.42, 0.14, 0.14).setPosition(x - dir * (0.75 + j * 0.5), l.y, l.z))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[UNIT_BOX, mat, LANES.length * PER_CAR]} frustumCulled={false} />
}

export function Atmosphere() {
  // Wait for the pixel font once so the cached sign textures use it (one-time state, not per frame).
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    let alive = true
    const done = () => {
      if (alive) setFontReady(true)
    }
    if (document.fonts?.load) document.fonts.load('8px "Press Start 2P"').then(done, done)
    else done()
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <Sky />
      <DistantCity />
      <Rain />
      <Specks />
      <FlyingCars />
      <group quaternion={ISO_Q}>
        <Stars />
        {fontReady && <Billboards />}
      </group>
    </>
  )
}
