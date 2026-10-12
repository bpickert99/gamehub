import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CLEARINGS, PATHS, type ClearingId } from '../data/autumnMap'
import { BOARD, SLOTS } from '../data/autumnLayout'
import { LAKE, MARKET, PONDS, RIVER, ROCKS } from '../data/autumnWorld'
import type { ClearingSuit } from '../data/types'

// ---------- scale: the woodland is sized for the meeples (1 unit tall) ----------

export const S = 0.035 // world units per board pixel
export const WORLD_W = BOARD.width * S // ≈ 91
export const WORLD_H = BOARD.height * S // ≈ 78
export const CLEARING_RADIUS = 5.6
const PATH_HALF = 1.15
const RIVER_HALF = 0.8 // a stream about a warrior wide, as in the app
export const WATER_LEVEL = -0.45
// Every building slot stands on a dry bank this wide, even where the river runs through its clearing.
const SLOT_BANK = 1.8
const MARGIN = 20 // forest beyond the board, fading into the mist ring
// The mist is clear this far past the board's edge, and thickens until it is opaque at MIST_SOLID.
const MIST_CLEAR = 7
const MIST_SOLID = 15

// Clearing coordinates were measured on the board including its score track (2391 px tall).
export function anchorFraction(c: ClearingId): { x: number; y: number } {
  return { x: CLEARINGS[c].x, y: (CLEARINGS[c].y * 2391) / BOARD.height }
}

export function toWorld(fx: number, fy: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3((fx - 0.5) * WORLD_W, y, (fy - 0.5) * WORLD_H)
}

export const clearingCenter = (c: ClearingId) => {
  const a = anchorFraction(c)
  return toWorld(a.x, a.y)
}

// ---------- geometry helpers ----------

type V2 = { x: number; z: number }

function distToSegment(p: V2, a: V2, b: V2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
}

// The closest point on a polyline, and the line's direction there.
function nearestOnPolyline(p: V2, pts: V2[]): { point: V2; along: V2 } {
  let best = { d: Infinity, point: pts[0], along: { x: 1, z: 0 } }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const dx = pts[i + 1].x - a.x
    const dz = pts[i + 1].z - a.z
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)))
    const point = { x: a.x + t * dx, z: a.z + t * dz }
    const d = Math.hypot(p.x - point.x, p.z - point.z)
    if (d < best.d) best = { d, point, along: { x: dx, z: dz } }
  }
  return best
}

function distToPolyline(p: V2, pts: V2[]): number {
  let d = Infinity
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(p, pts[i], pts[i + 1]))
  return d
}

function insidePolygon(p: V2, poly: V2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// Deterministic value noise, so every player sees the same woodland.
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x: number, y: number) => noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.1

// ---------- the layout in world units ----------

const v2 = (fx: number, fy: number): V2 => ({ x: (fx - 0.5) * WORLD_W, z: (fy - 0.5) * WORLD_H })
const CLEARING_LIST = (Object.keys(CLEARINGS) as ClearingId[]).map((id) => ({ id, p: v2(anchorFraction(id).x, anchorFraction(id).y), suit: CLEARINGS[id].suit }))
const PATH_SEGS = PATHS.map(([a, b]) => [CLEARING_LIST.find((c) => c.id === a)!.p, CLEARING_LIST.find((c) => c.id === b)!.p] as [V2, V2])
const RIVER_PTS = RIVER.map(([x, y]) => v2(x, y))
const LAKE_PTS = LAKE.map(([x, y]) => v2(x, y))
const PONDS_W = PONDS.map((p) => ({ c: v2(p.at[0], p.at[1]), r: p.r * WORLD_W }))
const ROCKS_W = ROCKS.map((r) => ({ c: v2(r.at[0], r.at[1]), size: r.size }))
const MARKET_W = v2(MARKET[0], MARKET[1])
const SLOTS_W = Object.values(SLOTS).flatMap((v) => v.slots.map((p) => v2(p.x, p.y)))
const slotDist = (p: V2) => Math.min(...SLOTS_W.map((q) => Math.hypot(p.x - q.x, p.z - q.z)))

function nearestClearing(p: V2): { d: number; suit: ClearingSuit } {
  let best = { d: Infinity, suit: 'fox' as ClearingSuit }
  for (const c of CLEARING_LIST) {
    const d = Math.hypot(p.x - c.p.x, p.z - c.p.z)
    if (d < best.d) best = { d, suit: c.suit }
  }
  return best
}
const pathDist = (p: V2) => Math.min(...PATH_SEGS.map(([a, b]) => distToSegment(p, a, b)))
const riverDist = (p: V2) => distToPolyline(p, RIVER_PTS)
function lakeEdge(p: V2): number {
  // Positive inside the lake: distance to its shore.
  if (!insidePolygon(p, LAKE_PTS)) return -1
  let d = Infinity
  for (let i = 0; i < LAKE_PTS.length; i++) d = Math.min(d, distToSegment(p, LAKE_PTS[i], LAKE_PTS[(i + 1) % LAKE_PTS.length]))
  return d
}
const pondDepth = (p: V2) => Math.max(0, ...PONDS_W.map((o) => 1 - Math.hypot(p.x - o.c.x, p.z - o.c.z) / o.r))

// Height of the ground: gentle rolls in the woods, flat clearings and roads, a carved river and
// lake.
export function groundHeight(x: number, z: number): number {
  const p = { x, z }
  let h = (fbm(x * 0.06, z * 0.06) - 0.5) * 1.6
  const flat = Math.max(smooth(CLEARING_RADIUS + 4, CLEARING_RADIUS, nearestClearing(p).d), smooth(PATH_HALF + 2, PATH_HALF, pathDist(p)))
  h = h * (1 - flat) + 0.05 * flat
  // Only the river, lake and pond go below the water.
  h = Math.max(h, WATER_LEVEL + 0.25)
  const river = smooth(RIVER_HALF + 0.8, RIVER_HALF - 0.3, riverDist(p))
  h = h * (1 - river) - 0.9 * river
  const lake = lakeEdge(p)
  if (lake > -1) h = h * (1 - smooth(0, 3, lake)) - 1.4 * smooth(0, 3, lake)
  const pond = pondDepth(p)
  if (pond > 0) h = h * (1 - smooth(0, 0.6, pond)) - 0.9 * smooth(0, 0.6, pond)
  const bank = smooth(SLOT_BANK + 0.8, SLOT_BANK, slotDist(p))
  return h * (1 - bank) + 0.05 * bank
}

const isWater = (p: V2) => slotDist(p) > SLOT_BANK && (riverDist(p) < RIVER_HALF + 0.35 || lakeEdge(p) > -0.5 || pondDepth(p) > 0)

// ---------- ground texture: painted like the board ----------

const TEX_EXTENT = { w: WORLD_W + 30, h: WORLD_H + 30 }

function paintGround(): THREE.CanvasTexture {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = Math.round((size * TEX_EXTENT.h) / TEX_EXTENT.w)
  const g = canvas.getContext('2d')!
  const k = canvas.width / TEX_EXTENT.w
  const X = (x: number) => (x + TEX_EXTENT.w / 2) * k
  const Z = (z: number) => (z + TEX_EXTENT.h / 2) * k

  // Forest floor with mossy blotches.
  g.fillStyle = '#41543a'
  g.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < 2600; i++) {
    const x = hash(i, 1) * canvas.width
    const y = hash(i, 2) * canvas.height
    g.fillStyle = ['#4a5e3e', '#384a33', '#52653f', '#3c4d36'][i % 4]
    g.globalAlpha = 0.5
    g.beginPath()
    g.ellipse(x, y, 6 + hash(i, 3) * 26, 4 + hash(i, 4) * 16, hash(i, 5) * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  const dirt = '#d3b987'
  const dirtEdge = '#b89d6c'
  // Roads, with a darker rim.
  g.lineCap = 'round'
  for (const [a, b] of PATH_SEGS) {
    g.strokeStyle = dirtEdge
    g.lineWidth = (PATH_HALF * 2 + 0.5) * k
    g.beginPath(); g.moveTo(X(a.x), Z(a.z)); g.lineTo(X(b.x), Z(b.z)); g.stroke()
  }
  for (const c of CLEARING_LIST) {
    g.fillStyle = dirtEdge
    g.beginPath(); g.arc(X(c.p.x), Z(c.p.z), (CLEARING_RADIUS + 0.35) * k, 0, Math.PI * 2); g.fill()
  }
  for (const [a, b] of PATH_SEGS) {
    g.strokeStyle = dirt
    g.lineWidth = PATH_HALF * 2 * k
    g.beginPath(); g.moveTo(X(a.x), Z(a.z)); g.lineTo(X(b.x), Z(b.z)); g.stroke()
  }
  for (const c of CLEARING_LIST) {
    g.fillStyle = dirt
    g.beginPath(); g.arc(X(c.p.x), Z(c.p.z), CLEARING_RADIUS * k, 0, Math.PI * 2); g.fill()
    // Worn patches and grass tufts in the clearing.
    for (let i = 0; i < 40; i++) {
      const r = Math.sqrt(hash(c.p.x + i, 9)) * CLEARING_RADIUS * 0.95
      const t = hash(i, c.p.z) * Math.PI * 2
      g.fillStyle = i % 3 ? '#c8ad7b' : '#7f8f52'
      g.globalAlpha = 0.6
      g.beginPath(); g.arc(X(c.p.x + Math.cos(t) * r), Z(c.p.z + Math.sin(t) * r), (0.2 + hash(i, 4) * 0.4) * k, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 1
  }
  // White pebbles along the roads, like the printed paths.
  g.fillStyle = '#f3ecd9'
  for (const [a, b] of PATH_SEGS) {
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const nx = -(b.z - a.z) / len
    const nz = (b.x - a.x) / len
    for (let s = CLEARING_RADIUS; s < len - CLEARING_RADIUS; s += 0.55) {
      for (const side of [-1, 1]) {
        const j = hash(s * 13 + a.x, side + b.z)
        const off = (PATH_HALF - 0.15 + j * 0.25) * side
        const x = a.x + ((b.x - a.x) * s) / len + nx * off
        const z = a.z + ((b.z - a.z) * s) / len + nz * off
        g.beginPath(); g.ellipse(X(x), Z(z), (0.12 + j * 0.1) * k, (0.09 + j * 0.06) * k, j * 3, 0, Math.PI * 2); g.fill()
      }
    }
  }
  // Muddy banks under the water.
  g.strokeStyle = '#8e8a63'
  g.lineWidth = (RIVER_HALF * 2 + 0.7) * k
  g.lineJoin = 'round'
  g.beginPath()
  RIVER_PTS.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))))
  g.stroke()
  g.fillStyle = '#8e8a63'
  g.beginPath()
  LAKE_PTS.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))))
  g.closePath(); g.fill()
  // The dry banks the building slots stand on.
  g.fillStyle = dirt
  for (const p of SLOTS_W) {
    g.beginPath(); g.arc(X(p.x), Z(p.z), (SLOT_BANK + 0.3) * k, 0, Math.PI * 2); g.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// ---------- terrain ----------

function buildTerrain(): THREE.Mesh {
  const w = WORLD_W + MARGIN * 2
  const h = WORLD_H + MARGIN * 2
  const geo = new THREE.PlaneGeometry(w, h, Math.round(w * 1.8), Math.round(h * 1.8))
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  const colors = new Float32Array(pos.count * 3)
  const hill = new THREE.Color('#5c7047')
  const white = new THREE.Color('#ffffff')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, groundHeight(x, z))
    uv.setXY(i, (x + TEX_EXTENT.w / 2) / TEX_EXTENT.w, 1 - (z + TEX_EXTENT.h / 2) / TEX_EXTENT.h)
    // Beyond the painted area the ground blends into grassy hills.
    const out = Math.max(Math.abs(x) - TEX_EXTENT.w / 2 + 4, Math.abs(z) - TEX_EXTENT.h / 2 + 4, 0)
    c.copy(white).lerp(hill, smooth(0, 4, out))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const tex = paintGround()
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true })
  // Outside the painted area use the hill colour, not the stretched texture edge.
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) diffuseColor.rgb = vec3(1.0);`,
    )
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  return mesh
}

// A ring of mist over the woods beyond the board: clear over the board, thickening past its edges
// until nothing beyond can be seen, so the modelled forest only needs a narrow margin.
function buildMist(): THREE.Mesh {
  const size = 600
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1024
  const g = canvas.getContext('2d')!
  const k = canvas.width / size
  g.fillStyle = MIST
  g.fillRect(0, 0, canvas.width, canvas.height)
  // Punch a soft-edged hole over the board, layer by layer from the outside in.
  g.globalCompositeOperation = 'destination-out'
  const clear = MIST_CLEAR
  const steps = 24
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const grow = clear + (MIST_SOLID - clear) * (1 - t)
    g.globalAlpha = 1 / steps + t * 0.08
    const w = (WORLD_W + grow * 2) * k
    const h = (WORLD_H + grow * 2) * k
    g.beginPath()
    g.roundRect((canvas.width - w) / 2, (canvas.height - h) / 2, w, h, grow * k)
    g.fill()
  }
  g.globalAlpha = 1
  const w = (WORLD_W + clear * 2) * k
  const h = (WORLD_H + clear * 2) * k
  g.beginPath()
  g.roundRect((canvas.width - w) / 2, (canvas.height - h) / 2, w, h, clear * k)
  g.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const geo = new THREE.PlaneGeometry(size, size)
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  // Above the tallest tree, so the woods sink into it rather than poking through.
  mesh.position.y = 7
  mesh.renderOrder = 1
  return mesh
}

// ---------- water ----------

function buildWater(time: { value: number }): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_W + MARGIN * 2, WORLD_H + MARGIN * 2, 1, 1)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: time },
    vertexShader: `
      varying vec3 vPos;
      varying float vDepth;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vPos;
      varying float vDepth;
      void main() {
        vec2 p = vPos.xz;
        float w = sin(p.x * 1.4 + uTime * 0.9 + sin(p.y * 0.7 + uTime * 0.4) * 2.0) * sin(p.y * 1.1 - uTime * 0.7 + sin(p.x * 0.5) * 1.5);
        vec3 deep = vec3(0.24, 0.47, 0.5);
        vec3 light = vec3(0.62, 0.82, 0.8);
        vec3 col = mix(deep, light, smoothstep(0.62, 0.95, w));
        gl_FragColor = vec4(col, 0.93);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = WATER_LEVEL
  return mesh
}

// ---------- trees ----------

function colored(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const c = new THREE.Color(color)
  const arr = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  g.deleteAttribute('uv')
  return g
}

function pineGeometry(): THREE.BufferGeometry {
  const parts = [colored(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6).translate(0, 0.45, 0), '#5a3d28')]
  const tiers = [[1.15, 1.6, 1.25], [0.9, 1.4, 2.05], [0.62, 1.2, 2.8]]
  for (const [r, h, y] of tiers) parts.push(colored(new THREE.ConeGeometry(r, h, 7).translate(0, y, 0), '#ffffff'))
  return mergeGeometries(parts)
}

function autumnGeometry(): THREE.BufferGeometry {
  const parts = [colored(new THREE.CylinderGeometry(0.13, 0.18, 1.3, 6).translate(0, 0.65, 0), '#5a3d28')]
  for (const [x, y, z, r] of [[0, 1.9, 0, 0.95], [0.55, 1.55, 0.2, 0.7], [-0.5, 1.6, -0.15, 0.72], [0.1, 1.5, -0.55, 0.65], [-0.1, 2.45, 0.1, 0.62]]) {
    parts.push(colored(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), '#ffffff'))
  }
  return mergeGeometries(parts)
}

// Push vertices out along their normals: drawn black from behind, this gives an ink outline.
function hullGeometry(geo: THREE.BufferGeometry, thickness: number): THREE.BufferGeometry {
  const g = geo.clone()
  g.computeVertexNormals()
  const pos = g.attributes.position
  const n = g.attributes.normal
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + n.getX(i) * thickness, pos.getY(i) + n.getY(i) * thickness, pos.getZ(i) + n.getZ(i) * thickness)
  }
  return g
}

// Trees sway gently: the higher the vertex, the further it moves.
function windy<T extends THREE.Material>(mat: T, time: { value: number }): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
       float sway = sin(uTime * 1.2 + base.x * 0.35 + base.z * 0.21) + 0.4 * sin(uTime * 2.3 + base.z * 0.5);
       transformed.x += sway * 0.045 * position.y * position.y * 0.35;
       transformed.z += sway * 0.03 * position.y * position.y * 0.35;`,
    )
  }
  return mat
}

const AUTUMN: Record<ClearingSuit, string[]> = {
  fox: ['#d4432f', '#c2362a', '#e0573a'],
  mouse: ['#ea8a35', '#e07a2c', '#f0a048'],
  rabbit: ['#efc63f', '#e6b52f', '#f5d75a'],
}
const PINE_GREENS = ['#2f4a35', '#365239', '#2a4230', '#3d5a3c', '#33503a']

// Trees stand about a warrior and a half tall, as in the app, so the pieces read clearly among them.
const TREE_SIZE = 0.62

// How far beyond the board's edge trees keep their ink outlines.
const INK_REACH = 6

type Tree = { x: number; z: number; s: number; rot: number; color: string; autumn: boolean }

function placeTrees(): Tree[] {
  const trees: Tree[] = []
  // Sparse enough to see warriors moving through the woods, and to keep the frame rate up.
  const step = 1.9
  for (let gx = -WORLD_W / 2 - MARGIN + 2; gx < WORLD_W / 2 + MARGIN - 2; gx += step) {
    for (let gz = -WORLD_H / 2 - MARGIN + 2; gz < WORLD_H / 2 + MARGIN - 2; gz += step) {
      const x = gx + (hash(gx, gz) - 0.5) * step * 0.9
      const z = gz + (hash(gz, gx) - 0.5) * step * 0.9
      const p = { x, z }
      // Past the board's edge the woods thin out into the mist, ending where it turns opaque.
      const out = Math.max(Math.abs(x) - WORLD_W / 2, Math.abs(z) - WORLD_H / 2)
      if (out > MIST_CLEAR && hash(x * 1.3, z * 2.1) < (out - MIST_CLEAR) / (MIST_SOLID - MIST_CLEAR)) continue
      const near = nearestClearing(p)
      if (near.d < CLEARING_RADIUS + 0.6) continue
      if (pathDist(p) < PATH_HALF + 0.5) continue
      if (isWater(p) || riverDist(p) < RIVER_HALF + 1) continue
      if (ROCKS_W.some((r) => Math.hypot(x - r.c.x, z - r.c.z) < r.size + 0.8)) continue
      if (Math.hypot(x - MARKET_W.x, z - MARKET_W.z) < 6) continue
      const roll = hash(x * 3.1, z * 1.7)
      // Autumn trees ring each clearing in its suit's colour, as on the board; pines fill the woods.
      const autumnNear = near.d < CLEARING_RADIUS + 6 && roll < 0.8 - (near.d - CLEARING_RADIUS) * 0.1
      const autumnWild = roll > 0.95
      const autumn = autumnNear || autumnWild
      const palette = autumnNear ? AUTUMN[near.suit] : autumnWild ? AUTUMN[(['fox', 'mouse', 'rabbit'] as ClearingSuit[])[Math.floor(hash(z, x) * 3)]] : PINE_GREENS
      trees.push({ x, z, s: (0.85 + hash(x, z * 2) * 0.55) * TREE_SIZE, rot: hash(z, x * 2) * Math.PI * 2, color: palette[Math.floor(hash(x * 7, z * 5) * palette.length)], autumn })
    }
  }
  return trees
}

function treeMeshes(trees: Tree[], time: { value: number }): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  for (const autumn of [false, true]) {
    const list = trees.filter((t) => t.autumn === autumn)
    // Ink outlines only show up close, so the trees out in the fog beyond the board go without.
    const inked = list.filter((t) => Math.abs(t.x) < WORLD_W / 2 + INK_REACH && Math.abs(t.z) < WORLD_H / 2 + INK_REACH)
    const geo = autumn ? autumnGeometry() : pineGeometry()
    const body = new THREE.InstancedMesh(geo, windy(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), time), list.length)
    const ink = new THREE.InstancedMesh(hullGeometry(geo, 0.06), windy(new THREE.MeshBasicMaterial({ color: '#1a140f', side: THREE.BackSide }), time), inked.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    const matrix = (t: Tree) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot)
      return m.compose(new THREE.Vector3(t.x, groundHeight(t.x, t.z) - 0.1, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + hash(t.x, t.z) * 0.3), t.s))
    }
    list.forEach((t, i) => {
      body.setMatrixAt(i, matrix(t))
      body.setColorAt(i, col.set(t.color))
    })
    inked.forEach((t, i) => ink.setMatrixAt(i, matrix(t)))
    // Trees take the sun's shadows but don't cast them: drawing thousands into the shadow map is costly.
    body.receiveShadow = true
    out.push(body, ink)
  }
  return out
}

// ---------- rocks, bridges, the market ----------

function rocks(): THREE.Object3D {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color: '#8d877a', flatShading: true })
  const ink = new THREE.MeshBasicMaterial({ color: '#1a140f', side: THREE.BackSide })
  ROCKS_W.forEach((r, i) => {
    for (let j = 0; j < 4; j++) {
      const geo = new THREE.DodecahedronGeometry(r.size * (0.35 + hash(i, j) * 0.4), 0)
      const m = new THREE.Mesh(geo, mat)
      const a = hash(j, i) * Math.PI * 2
      const x = r.c.x + Math.cos(a) * r.size * 0.5 * (j ? 1 : 0)
      const z = r.c.z + Math.sin(a) * r.size * 0.5 * (j ? 1 : 0)
      m.position.set(x, groundHeight(x, z) + r.size * 0.15, z)
      m.scale.set(1, 0.7 + hash(i * 3, j) * 0.6, 1)
      m.rotation.set(hash(i, j * 2), hash(j, i * 2) * 3, 0)
      m.castShadow = true
      m.receiveShadow = true
      const outline = new THREE.Mesh(hullGeometry(geo, 0.07), ink)
      m.add(outline)
      group.add(m)
    }
  })
  return group
}

// Where a road crosses the stream out in the woods, a plank bridge along the road, long enough to
// span the water at the angle the road meets it. (Inside clearings the stream is simply forded.)
type Bridge = { x: number; z: number; dir: V2; span: number }
const BRIDGES: Bridge[] = PATH_SEGS.flatMap(([a, b]) => {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
  const at = (s: number) => ({ x: a.x + dir.x * s, z: a.z + dir.z * s })
  const inClearing = (p: V2) => nearestClearing(p).d < CLEARING_RADIUS + 0.5
  // The point of the road nearest the stream's middle, outside the clearings.
  let best: { s: number; d: number } | null = null
  for (let s = 0; s < len; s += 0.1) {
    const d = riverDist(at(s))
    if (d < RIVER_HALF && !inClearing(at(s)) && (!best || d < best.d)) best = { s, d }
  }
  if (!best) return []
  const p = at(best.s)
  const { along } = nearestOnPolyline(p, RIVER_PTS)
  const sin = Math.abs(dir.x * along.z - dir.z * along.x) / Math.hypot(along.x, along.z)
  return [{ x: p.x, z: p.z, dir, span: Math.min(7, (2 * (RIVER_HALF + 0.8)) / Math.max(sin, 0.35)) }]
})

// Height of a bridge's planks at its middle.
export const BRIDGE_DECK = 0.47

// The deck height at a distance `u` (-1…1 along its span) from a bridge's middle.
const deck = (u: number) => 0.12 + Math.cos(u * Math.PI * 0.5) * (BRIDGE_DECK - 0.12)

function bridges(): THREE.Object3D {
  const group = new THREE.Group()
  const plank = new THREE.MeshLambertMaterial({ color: '#7a5434', flatShading: true })
  for (const b of BRIDGES) {
    const bridge = new THREE.Group()
    const n = Math.ceil(b.span / 0.46)
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.46
      const m = new THREE.Mesh(new THREE.BoxGeometry(PATH_HALF * 2.2, 0.12, 0.42), plank)
      m.position.set(0, deck(z / (b.span / 2)), z)
      m.castShadow = true
      bridge.add(m)
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, b.span), plank)
      rail.position.set(side * PATH_HALF * 1.1, BRIDGE_DECK + 0.3, 0)
      bridge.add(rail)
      for (const end of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), plank)
        post.position.set(side * PATH_HALF * 1.1, 0.35, (end * b.span) / 2)
        bridge.add(post)
      }
    }
    bridge.position.set(b.x, 0, b.z)
    bridge.rotation.y = Math.atan2(b.dir.x, b.dir.z)
    group.add(bridge)
  }
  return group
}

// Where a walking warrior's feet are: on the ground, on a bridge's deck, or wading the stream.
export function walkHeight(x: number, z: number): number {
  if (isDry(x, z)) return groundHeight(x, z)
  for (const b of BRIDGES) {
    const dx = x - b.x
    const dz = z - b.z
    const along = dx * b.dir.x + dz * b.dir.z
    const across = Math.abs(dx * b.dir.z - dz * b.dir.x)
    if (Math.abs(along) <= b.span / 2 && across <= PATH_HALF * 1.2) return deck(along / (b.span / 2))
  }
  return WATER_LEVEL - 0.1
}

// Ground pieces can stand on: not in the river, lake or a pond.
export function isDry(x: number, z: number): boolean {
  return !isWater({ x, z })
}

// Ground clear of water and roads, for a clearing's suit banner.
export function isOpenGround(x: number, z: number): boolean {
  return isDry(x, z) && pathDist({ x, z }) > PATH_HALF + 1 && riverDist({ x, z }) > RIVER_HALF + 1.5
}

export function marketPosition(): THREE.Vector3 {
  return new THREE.Vector3(MARKET_W.x, groundHeight(MARKET_W.x, MARKET_W.z), MARKET_W.z)
}

// ---------- falling leaves ----------

function leaves(trees: Tree[]) {
  const autumn = trees.filter((t) => t.autumn && Math.abs(t.x) < WORLD_W / 2 && Math.abs(t.z) < WORLD_H / 2)
  const count = 220
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), count)
  const col = new THREE.Color()
  const state = Array.from({ length: count }, (_, i) => spawn(i, true))
  function spawn(i: number, initial: boolean) {
    const t = autumn[Math.floor(Math.random() * autumn.length)]
    mesh.setColorAt(i, col.set(t.color))
    const top = groundHeight(t.x, t.z) + 2.8 * t.s
    return { x: t.x + (Math.random() - 0.5) * 1.5, y: initial ? top * Math.random() : top, z: t.z + (Math.random() - 0.5) * 1.5, floor: groundHeight(t.x, t.z), phase: Math.random() * 10, spin: Math.random() * 3 }
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const one = new THREE.Vector3(1, 1, 1)
  return {
    mesh,
    update(t: number, dt: number) {
      state.forEach((l, i) => {
        l.y -= dt * 0.55
        l.x += Math.sin(t * 1.3 + l.phase) * dt * 0.5
        l.z += Math.cos(t * 0.9 + l.phase) * dt * 0.3
        if (l.y < l.floor + 0.05) state[i] = spawn(i, false)
        e.set(t * l.spin + l.phase, t * 0.7 + l.phase, Math.sin(t + l.phase))
        m.compose(new THREE.Vector3(l.x, l.y, l.z), q.setFromEuler(e), one)
        mesh.setMatrixAt(i, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
  }
}

// ---------- the whole woodland ----------

export const MIST = '#d4d3c3'

export function buildWorld(scene: THREE.Scene): { update: (t: number, dt: number) => void } {
  const time = { value: 0 }
  scene.add(buildTerrain())
  scene.add(buildMist())
  scene.add(buildWater(time))
  const trees = placeTrees()
  for (const m of treeMeshes(trees, time)) scene.add(m)
  scene.add(rocks())
  scene.add(bridges())
  const fall = leaves(trees)
  scene.add(fall.mesh)
  return {
    update(t, dt) {
      time.value = t
      fall.update(t, dt)
    },
  }
}
