import * as THREE from 'three'
import type { BuildingKind } from '../engine/types'
import { FACTION_COLOR } from './pieces3d'

// Little buildings for the 3D woodland, about two meeples wide, each with an ink outline.

const INK = new THREE.MeshBasicMaterial({ color: '#1a140f', side: THREE.BackSide })
const mats = new Map<string, THREE.Material>()
const mat = (color: string) => {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }))
  return mats.get(color)!
}

function part(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, ink = 0.035): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color))
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  if (ink > 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    g.computeVertexNormals()
    const pos = g.attributes.position
    const n = g.attributes.normal
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + n.getX(i) * ink, pos.getY(i) + n.getY(i) * ink, pos.getZ(i) + n.getZ(i) * ink)
    m.add(new THREE.Mesh(g, INK))
  }
  return m
}

// A gable roof: a triangular prism along x.
function roof(w: number, d: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-d / 2, 0)
  s.lineTo(d / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false })
  g.translate(0, 0, -w / 2)
  g.rotateY(Math.PI / 2)
  return g
}

function sawBlade(r: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const teeth = 14
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 ? r : r * 0.82
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else s.moveTo(rr, 0)
  }
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false })
}

const WALL = '#e9d6ad'
const TIMBER = '#7b5233'
const STONE = '#a59e8f'

function sawmill(color: string): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.BoxGeometry(1.7, 1.0, 1.4), TIMBER, 0, 0.5, 0))
  g.add(part(roof(1.9, 1.7, 0.75), color, 0, 1.0, 0))
  const blade = part(sawBlade(0.62), '#d8d8d2', 0, 0.85, 0.74, 0.02)
  g.add(blade)
  g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10).rotateX(Math.PI / 2), '#555', 0, 0.85, 0.82, 0))
  g.add(part(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 8).rotateZ(Math.PI / 2), '#a8743f', 0.2, 0.18, 1.05))
  g.userData.spin = blade
  return g
}

function workshop(color: string): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.BoxGeometry(1.6, 1.05, 1.3), WALL, 0, 0.52, 0))
  for (const x of [-0.8, 0.8]) g.add(part(new THREE.BoxGeometry(0.08, 1.05, 1.32), TIMBER, x, 0.52, 0, 0))
  g.add(part(roof(1.8, 1.6, 0.8), color, 0, 1.05, 0))
  g.add(part(new THREE.BoxGeometry(0.28, 0.6, 0.28), STONE, 0.5, 1.5, -0.25))
  // Anvil out front.
  g.add(part(new THREE.BoxGeometry(0.22, 0.28, 0.22), '#3f3f44', -0.35, 0.14, 0.95))
  g.add(part(new THREE.BoxGeometry(0.55, 0.16, 0.26), '#3f3f44', -0.35, 0.36, 0.95))
  return g
}

function recruiter(color: string): THREE.Group {
  const g = new THREE.Group()
  g.add(part(roof(1.7, 1.8, 1.35), color, 0, 0, 0))
  g.add(part(new THREE.BoxGeometry(0.5, 0.7, 0.05), '#3a2a20', 0, 0.35, 0.86, 0))
  g.add(part(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), TIMBER, 0.95, 1.1, 0.4))
  const flag = part(new THREE.PlaneGeometry(0.7, 0.42), color, 1.3, 1.95, 0.4, 0)
  ;(flag.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide
  g.add(flag)
  g.userData.flag = flag
  return g
}

function roost(color: string): THREE.Group {
  const g = new THREE.Group()
  // A treehouse on a gnarled stump, after the Eyrie's roosts.
  g.add(part(new THREE.CylinderGeometry(0.45, 0.7, 1.3, 7), '#6b4a30', 0, 0.65, 0))
  for (let i = 0; i < 4; i++) {
    const root = part(new THREE.CylinderGeometry(0.08, 0.16, 0.8, 5), '#6b4a30', Math.cos(i * 1.6) * 0.65, 0.15, Math.sin(i * 1.6) * 0.65, 0.02)
    root.rotation.set(Math.sin(i * 1.6) * 1.1, 0, -Math.cos(i * 1.6) * 1.1)
    g.add(root)
  }
  g.add(part(new THREE.BoxGeometry(1.35, 0.8, 1.15), color, 0, 1.65, 0))
  g.add(part(new THREE.ConeGeometry(1.15, 0.85, 4).rotateY(Math.PI / 4), '#24418c', 0, 2.47, 0))
  g.add(part(new THREE.BoxGeometry(0.34, 0.34, 0.05), '#f2e2bd', 0, 1.7, 0.6, 0))
  return g
}

function ruin(): THREE.Group {
  const g = new THREE.Group()
  const walls = [[-0.6, 0.55, 0, 0.25, 1.1, 1.3], [0.1, 0.35, -0.55, 1.2, 0.7, 0.25], [0.55, 0.2, 0.3, 0.3, 0.4, 0.6]]
  for (const [x, y, z, w, h, d] of walls) g.add(part(new THREE.BoxGeometry(w, h, d), STONE, x, y, z))
  for (let i = 0; i < 7; i++) {
    g.add(part(new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.05, 0), '#938b7c', Math.cos(i * 2.3) * 0.7, 0.08, Math.sin(i * 2.3) * 0.6, 0.02))
  }
  return g
}

export function building3d(kind: BuildingKind | 'ruin', faction: 'marquise' | 'eyrie' | null): THREE.Group {
  const color = faction ? FACTION_COLOR[faction] : STONE
  switch (kind) {
    case 'sawmill': return sawmill(color)
    case 'workshop': return workshop(color)
    case 'recruiter': return recruiter(color)
    case 'roost': return roost(color)
    case 'ruin': return ruin()
  }
}

// A wood token: a little pile of three logs.
export function logPile(): THREE.Group {
  const g = new THREE.Group()
  for (const [x, y, z] of [[-0.14, 0.11, 0], [0.14, 0.11, 0], [0, 0.31, 0]]) {
    const log = part(new THREE.CylinderGeometry(0.12, 0.12, 0.62, 8).rotateZ(Math.PI / 2), '#a8743f', x, y, z, 0.02)
    log.add(part(new THREE.CircleGeometry(0.1, 8).rotateY(Math.PI / 2), '#e3c08a', 0.315, 0, 0, 0))
    g.add(log)
  }
  return g
}

// An empty building slot, outlined in white like on the board.
export function slotMarker(): THREE.Mesh {
  const s = 2.3
  const shape = new THREE.Shape()
  shape.moveTo(-s / 2, -s / 2); shape.lineTo(s / 2, -s / 2); shape.lineTo(s / 2, s / 2); shape.lineTo(-s / 2, s / 2); shape.closePath()
  const hole = new THREE.Path()
  const i = s / 2 - 0.12
  hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.closePath()
  shape.holes.push(hole)
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#fbf5e6', transparent: true, opacity: 0.9 }))
  m.rotation.x = -Math.PI / 2
  return m
}
