import * as THREE from 'three'
import type { ClearingSuit } from '../data/types'
import type { Faction } from '../engine/types'

// World units: 1 unit = 100 px of board.webp (2607 x 2225 px).
export const BW = 26.07
export const BH = 22.25
export const BOARD_TOP = 0.3

export const FACTION_COLOR: Record<Faction, string> = { marquise: '#e2702a', eyrie: '#2f5fc4' }
const INK = '#1b130c'

// ---------- textures ----------

const textureCache = new Map<string, THREE.Texture>()
const loader = new THREE.TextureLoader()

export function imageTexture(url: string): THREE.Texture {
  let t = textureCache.get(url)
  if (!t) {
    t = loader.load(url)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    textureCache.set(url, t)
  }
  return t
}

function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, done: () => void) => void): THREE.CanvasTexture {
  const cached = textureCache.get(key)
  if (cached) return cached as THREE.CanvasTexture
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  draw(canvas.getContext('2d')!, () => (t.needsUpdate = true))
  textureCache.set(key, t)
  return t
}

function withImage(url: string, use: (img: HTMLImageElement) => void, done: () => void) {
  const img = new Image()
  img.onload = () => {
    use(img)
    done()
  }
  img.src = url
}

// ---------- shared geometry/material cache ----------

const cache = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key) as T
}

const woodMaterial = (color: string) =>
  cached(`wood:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 }))

// ---------- meeples (traced from the physical warriors) ----------

// Meeples are drawn in a 320 x 400 box (SVG units); this sets their size on the board.
const K = 0.0025 // world units per SVG unit: meeples are 0.68 wide and 1 tall, a little larger than life
const MEEPLE_DEPTH = 0.3
const BEVEL = 0.035

type Cmd = readonly ['M' | 'L', number, number] | readonly ['Q', number, number, number, number]

const SILHOUETTE: Record<Faction, Cmd[]> = {
  marquise: [['M', 24, 400], ['L', 296, 400], ['L', 296, 150], ['L', 284, 30], ['L', 215, 100], ['Q', 160, 85, 105, 100], ['L', 36, 30], ['L', 24, 150]],
  eyrie: [['M', 60, 400], ['L', 296, 400], ['L', 296, 190], ['Q', 290, 20, 150, 20], ['Q', 90, 22, 60, 80], ['L', 0, 125], ['L', 60, 160], ['L', 52, 200]],
}

// Line-art faces, matching the printed faces on Root's wooden warriors.
const FACE_SVG: Record<Faction, string> = {
  marquise: `<g fill="none" stroke="#1b130c" stroke-width="13" stroke-linecap="round" stroke-linejoin="round">
    <path d="M58 150 L146 186 Q138 236 100 240 Q60 238 58 150 Z"/><path d="M262 150 L174 186 Q182 236 220 240 Q260 238 262 150 Z"/>
    <path d="M136 274 Q148 290 160 276 Q172 290 184 274"/></g>
    <g fill="#1b130c"><circle cx="118" cy="210" r="17"/><circle cx="202" cy="210" r="17"/><path d="M150 256 L170 256 L160 268 Z"/></g>`,
  eyrie: `<g fill="none" stroke="#1b130c" stroke-width="12" stroke-linecap="round">
    <circle cx="168" cy="118" r="38"/><path d="M128 58 Q150 40 178 50 Q200 58 196 76"/></g>
    <circle cx="160" cy="124" r="19" fill="#1b130c"/>`,
}

const sx = (x: number) => (x - 160) * K
const sy = (y: number) => (400 - y) * K

function silhouette(f: Faction): THREE.Shape {
  const s = new THREE.Shape()
  for (const c of SILHOUETTE[f]) {
    if (c[0] === 'Q') {
      const [, cx, cy, x, y] = c
      s.quadraticCurveTo(sx(cx), sy(cy), sx(x), sy(y))
    } else if (c[0] === 'M') s.moveTo(sx(c[1]), sy(c[2]))
    else s.lineTo(sx(c[1]), sy(c[2]))
  }
  s.closePath()
  return s
}

function extrude(shape: THREE.Shape, depth: number, bevel = BEVEL): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 })
  g.translate(0, 0, -depth / 2)
  return g
}

function faceTexture(f: Faction): THREE.CanvasTexture {
  return canvasTexture(`face:${f}`, 640, 800, (g, done) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400" width="640" height="800">${FACE_SVG[f]}</svg>`
    withImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, (img) => g.drawImage(img, 0, 0, 640, 800), done)
  })
}

export function meeple(f: Faction): THREE.Group {
  const group = new THREE.Group()
  const body = new THREE.Mesh(cached(`meeple:${f}`, () => extrude(silhouette(f), MEEPLE_DEPTH)), woodMaterial(FACTION_COLOR[f]))
  body.castShadow = true
  group.add(body)
  const face = new THREE.Mesh(
    cached('face-plane', () => new THREE.PlaneGeometry(320 * K, 400 * K)),
    cached(`face-mat:${f}`, () => new THREE.MeshStandardMaterial({ map: faceTexture(f), transparent: true, roughness: 0.8, depthWrite: false })),
  )
  face.position.set(0, 200 * K, MEEPLE_DEPTH / 2 + BEVEL + 0.003)
  group.add(face)
  return group
}

// ---------- tiles: buildings, ruins, items ----------

function roundedSquare(size: number, r: number): THREE.Shape {
  // Built in 0..1 so ExtrudeGeometry's cap UVs map the whole image onto the top.
  const s = new THREE.Shape()
  const a = r / size
  s.moveTo(a, 0)
  s.lineTo(1 - a, 0)
  s.quadraticCurveTo(1, 0, 1, a)
  s.lineTo(1, 1 - a)
  s.quadraticCurveTo(1, 1, 1 - a, 1)
  s.lineTo(a, 1)
  s.quadraticCurveTo(0, 1, 0, 1 - a)
  s.lineTo(0, a)
  s.quadraticCurveTo(0, 0, a, 0)
  return s
}

function tileGeometry(): THREE.ExtrudeGeometry {
  return cached('tile', () => {
    const g = new THREE.ExtrudeGeometry(roundedSquare(1, 0.14), { depth: 1, bevelEnabled: false, curveSegments: 6 })
    g.translate(-0.5, -0.5, 0)
    return g
  })
}

// A square tile lying on the board with its art on top; `height` is its thickness.
export function tile(art: string, size: number, height: number, side: string): THREE.Mesh {
  const top = cached(`tile-top:${art}`, () => new THREE.MeshStandardMaterial({ map: imageTexture(art), roughness: 0.7 }))
  const edge = woodMaterial(side)
  const mesh = new THREE.Mesh(tileGeometry(), [top, edge])
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(size, size, height)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// Round cardboard token (wood) with its art on top.
export function disc(art: string, radius: number, height: number, side: string): THREE.Mesh {
  const geo = cached(`disc`, () => new THREE.CylinderGeometry(1, 1, 1, 40))
  const top = cached(`disc-top:${art}`, () => new THREE.MeshStandardMaterial({ map: imageTexture(art), roughness: 0.7 }))
  const mesh = new THREE.Mesh(geo, [woodMaterial(side), top, woodMaterial(side)])
  mesh.scale.set(radius, height, radius)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// The Marquise keep, after the wooden castle piece: three towers with pointed roofs.
function castleShape(): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(-0.55, 0)
  s.lineTo(0.55, 0)
  s.lineTo(0.55, 0.55)
  s.lineTo(0.62, 0.55)
  s.lineTo(0.44, 0.92) // right roof
  s.lineTo(0.28, 0.55)
  s.lineTo(0.2, 0.62)
  s.lineTo(0.2, 0.75)
  s.lineTo(0.24, 0.75)
  s.lineTo(0, 1.25) // centre spire
  s.lineTo(-0.24, 0.75)
  s.lineTo(-0.2, 0.75)
  s.lineTo(-0.2, 0.62)
  s.lineTo(-0.28, 0.55)
  s.lineTo(-0.44, 0.92) // left roof
  s.lineTo(-0.62, 0.55)
  s.lineTo(-0.55, 0.55)
  s.closePath()
  return s
}

function castleFace(): THREE.CanvasTexture {
  // Covers x -0.65..0.65, y 0..1.3.
  return canvasTexture('castle-face', 390, 390, (g, done) => {
    g.fillStyle = INK
    const px = (x: number) => (x + 0.65) * 300
    const py = (y: number) => (1.3 - y) * 300
    // roof shadows
    for (const [x, top] of [[-0.44, 0.92], [0, 1.25], [0.44, 0.92]] as const) {
      g.beginPath()
      g.moveTo(px(x), py(top - 0.04))
      g.lineTo(px(x + 0.12), py(top - 0.3))
      g.lineTo(px(x - 0.02), py(top - 0.24))
      g.closePath()
      g.fill()
    }
    // door
    g.beginPath()
    g.moveTo(px(-0.1), py(0))
    g.lineTo(px(-0.1), py(0.18))
    g.arc(px(0), py(0.18), 0.1 * 300, Math.PI, 0)
    g.lineTo(px(0.1), py(0))
    g.closePath()
    g.fill()
    // bricks
    for (const [x, y] of [[-0.38, 0.38], [-0.3, 0.3], [0.32, 0.42], [0.4, 0.2], [-0.42, 0.12]]) g.fillRect(px(x), py(y), 26, 12)
    done()
  })
}

export function keep(): THREE.Group {
  const group = new THREE.Group()
  const body = new THREE.Mesh(cached('castle', () => extrude(castleShape(), 0.3, 0.03)), woodMaterial(FACTION_COLOR.marquise))
  body.castShadow = true
  group.add(body)
  const face = new THREE.Mesh(
    cached('castle-face-plane', () => new THREE.PlaneGeometry(1.3, 1.3)),
    cached('castle-face-mat', () => new THREE.MeshStandardMaterial({ map: castleFace(), transparent: true, depthWrite: false })),
  )
  face.position.set(0, 0.65, 0.15 + 0.03 + 0.003)
  group.add(face)
  return group
}

// ---------- sprites: suit banners and counts ----------

export function badge(count: number, f: Faction): THREE.Sprite {
  const map = canvasTexture(`badge:${f}:${count}`, 128, 128, (g, done) => {
    g.fillStyle = FACTION_COLOR[f]
    g.strokeStyle = '#fff4dc'
    g.lineWidth = 12
    g.beginPath()
    g.arc(64, 64, 52, 0, Math.PI * 2)
    g.fill()
    g.stroke()
    g.fillStyle = '#fff'
    g.font = 'bold 64px Georgia, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(count), 64, 70)
    done()
  })
  const s = new THREE.Sprite(cached(`badge-mat:${f}:${count}`, () => new THREE.SpriteMaterial({ map, depthTest: false })))
  s.scale.set(0.5, 0.5, 1)
  s.renderOrder = 10
  return s
}

const RIBBON: Record<Faction | 'none', string> = { marquise: FACTION_COLOR.marquise, eyrie: FACTION_COLOR.eyrie, none: '#cdbb94' }

export function suitBanner(suit: ClearingSuit, ruler: Faction | null, icon: string): THREE.Sprite {
  const key = `${suit}:${ruler ?? 'none'}`
  const map = canvasTexture(`banner:${key}`, 160, 230, (g, done) => {
    // ribbon
    g.fillStyle = RIBBON[ruler ?? 'none']
    g.beginPath()
    g.moveTo(52, 100)
    g.lineTo(108, 100)
    g.lineTo(108, 222)
    g.lineTo(80, 196)
    g.lineTo(52, 222)
    g.closePath()
    g.fill()
    // diamond
    g.save()
    g.translate(80, 78)
    g.rotate(Math.PI / 4)
    g.fillStyle = '#f2e2bd'
    g.strokeStyle = '#fff4dc'
    g.lineWidth = 10
    g.shadowColor = 'rgba(0,0,0,0.5)'
    g.shadowBlur = 8
    g.fillRect(-46, -46, 92, 92)
    g.shadowBlur = 0
    g.strokeRect(-46, -46, 92, 92)
    g.restore()
    withImage(icon, (img) => g.drawImage(img, 44, 42, 72, 72), done)
  })
  const s = new THREE.Sprite(cached(`banner-mat:${key}`, () => new THREE.SpriteMaterial({ map })))
  s.scale.set(0.95, 1.37, 1)
  s.center.set(0.5, 0)
  return s
}

// ---------- highlight rings (kept from the 2D board) ----------

export function ringTexture(kind: 'on' | 'selected'): THREE.CanvasTexture {
  return canvasTexture(`ring:${kind}`, 256, 256, (g, done) => {
    g.beginPath()
    g.arc(128, 128, 112, 0, Math.PI * 2)
    g.fillStyle = kind === 'on' ? 'rgba(255,250,235,0.16)' : 'rgba(255,210,87,0.22)'
    g.fill()
    g.lineWidth = 12
    g.strokeStyle = kind === 'on' ? 'rgba(255,250,235,0.95)' : '#ffd257'
    if (kind === 'on') g.setLineDash([30, 18])
    g.stroke()
    done()
  })
}
