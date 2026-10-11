import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { CLEARINGS, type ClearingId } from '../data/autumnMap'
import { BOARD, ITEM_SPACES, SLOTS } from '../data/autumnLayout'
import type { Item } from '../data/types'
import { CLEARING_IDS, ruler } from '../engine/core'
import type { Faction, GameState } from '../engine/types'
import type { InfoKey } from '../data/rulesInfo'
import { pieceImage, suitIcon } from './assets'
import { BH, BOARD_TOP, BW, FACTION_COLOR, badge, disc, imageTexture, keep, meeple, ringTexture, suitBanner, tile } from './pieces3d'

// Clearing coordinates were measured on the full board including the score track, which board.webp
// crops off (2391 → 2225 px tall).
export function anchor(c: ClearingId): { x: number; y: number } {
  return { x: CLEARINGS[c].x, y: (CLEARINGS[c].y * 2391) / BOARD.height }
}

// Board fractions → world position on top of the board.
const world = (p: { x: number; y: number }, lift = 0) => new THREE.Vector3((p.x - 0.5) * BW, BOARD_TOP + lift, (p.y - 0.5) * BH)

type Props = {
  state: GameState
  highlight: ClearingId[]
  selected: ClearingId | null
  onClearing: (c: ClearingId) => void
  popover: { clearing: ClearingId; content: ReactNode } | null
  onInfo: (key: InfoKey) => void
  shadows: boolean
  // Screen space covered by the overlays at the top and bottom, kept clear when framing the board.
  frame: { top: number; bottom: number }
}

type Scene = {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: MapControls
  scene: THREE.Scene
  pieces: THREE.Group
  rings: THREE.Group
  resize: () => void
}

const CLEARING_RADIUS = 1.45

export default function Board3D({ state, highlight, selected, onClearing, popover, onInfo, shadows, frame }: Props) {
  const frameRef = useRef(frame)
  frameRef.current = frame
  // The camera controls own `surface`; popovers and buttons live outside it so the controls never
  // capture their pointer events.
  const surface = useRef<HTMLDivElement>(null)
  const three = useRef<Scene | null>(null)
  // Screen positions of each clearing (centre + radius), refreshed every frame for the click targets.
  const [screen, setScreen] = useState<Record<string, { x: number; y: number; r: number }>>({})
  const press = useRef<{ x: number; y: number } | null>(null)
  // The piece under the pointer, for the rules "i" button.
  const [hover, setHover] = useState<{ key: InfoKey; x: number; y: number } | null>(null)

  // ---------- scene setup, once ----------
  useEffect(() => {
    const el = surface.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#1c2417')
    scene.fog = new THREE.Fog('#1c2417', 40, 75)

    scene.add(new THREE.HemisphereLight('#fff6e0', '#3a3020', 1.1))
    const sun = new THREE.DirectionalLight('#fff1d6', 2.2)
    sun.position.set(-9, 18, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -14, near: 1, far: 50 })
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    scene.add(sun)

    // The board: a thick slab with the painted map on top.
    const boardTex = imageTexture(BOARD.image)
    boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const edge = new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 0.9 })
    const top = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.85 })
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BW, BOARD_TOP, BH), [edge, edge, top, edge, edge, edge])
    slab.position.y = BOARD_TOP / 2
    slab.receiveShadow = true
    scene.add(slab)
    const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 1 }))
    table.rotation.x = -Math.PI / 2
    table.receiveShadow = true
    scene.add(table)

    const pieces = new THREE.Group()
    const rings = new THREE.Group()
    scene.add(pieces, rings)

    // Camera: a tilted view over the board, from close to nearly straight down.
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
    const controls = new MapControls(camera, el)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.zoomToCursor = true
    controls.minPolarAngle = 0.12
    controls.maxPolarAngle = 1.05
    controls.minAzimuthAngle = -0.6
    controls.maxAzimuthAngle = 0.6
    controls.minDistance = 4
    controls.maxDistance = 34
    // Keep the camera's focus on the board so it can never drift away.
    controls.addEventListener('change', () => {
      const t = controls.target
      const cx = THREE.MathUtils.clamp(t.x, -BW / 2, BW / 2)
      const cz = THREE.MathUtils.clamp(t.z, -BH / 2, BH / 2)
      if (cx !== t.x || cz !== t.z) {
        camera.position.x += cx - t.x
        camera.position.z += cz - t.z
        t.set(cx, t.y, cz)
      }
    })

    // The overlays cover the top (players, banner) and bottom (hand, action bar) of the screen, so the
    // view is centred on the free area between them.
    const insets = () => frameRef.current
    const resize = () => {
      const { width, height } = el.getBoundingClientRect()
      const pad = insets()
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.setViewOffset(width, height, 0, (pad.bottom - pad.top) / 2, width, height)
      camera.updateProjectionMatrix()
    }
    resize()
    // Start over the whole board, tilted like the app (closer on phones).
    const { width, height } = el.getBoundingClientRect()
    const pad = insets()
    const free = (height - pad.top - pad.bottom) / height
    const fitDistance = (BH / 2 + 1.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / free / (width < 760 ? 1.9 : 1)
    const polar = 0.62
    controls.target.set(0, 0, width < 760 ? -1 : 0.4)
    camera.position.set(0, Math.cos(polar) * fitDistance, Math.sin(polar) * fitDistance + controls.target.z)
    controls.update()

    window.addEventListener('resize', resize)
    three.current = { renderer, camera, controls, scene, pieces, rings, resize }

    let frame = 0
    const v = new THREE.Vector3()
    const loop = (t: number) => {
      frame = requestAnimationFrame(loop)
      controls.update()
      // Pulse the highlight rings.
      for (const ring of rings.children as THREE.Mesh[]) {
        if (ring.userData.pulse) (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.35 * Math.sin(t / 260)
      }
      renderer.render(scene, camera)
      // Project clearings to the screen for the click targets and popovers.
      const rect = el.getBoundingClientRect()
      const out: Record<string, { x: number; y: number; r: number }> = {}
      for (const c of CLEARING_IDS) {
        const p = world(anchor(c))
        v.copy(p).project(camera)
        const x = ((v.x + 1) / 2) * rect.width
        const y = ((1 - v.y) / 2) * rect.height
        v.copy(p).add(new THREE.Vector3(CLEARING_RADIUS, 0, 0)).project(camera)
        const r = Math.abs(((v.x + 1) / 2) * rect.width - x)
        out[c] = { x: Math.round(x), y: Math.round(y), r: Math.round(r) }
      }
      setScreen((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out))
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      three.current = null
    }
  }, [])

  useEffect(() => {
    const t = three.current
    if (!t) return
    t.renderer.shadowMap.enabled = shadows
    t.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true
    })
  }, [shadows])

  useEffect(() => three.current?.resize(), [frame.top, frame.bottom])

  // ---------- pieces, rebuilt whenever the game changes ----------
  useEffect(() => {
    const t = three.current
    if (!t) return
    t.pieces.clear()
    buildPieces(state, t.pieces)
  }, [state])

  // ---------- highlight rings ----------
  useEffect(() => {
    const t = three.current
    if (!t) return
    t.rings.clear()
    const geo = new THREE.PlaneGeometry(CLEARING_RADIUS * 2, CLEARING_RADIUS * 2)
    for (const c of CLEARING_IDS) {
      const kind = selected === c ? 'selected' : highlight.includes(c) ? 'on' : null
      if (!kind) continue
      const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ringTexture(kind), transparent: true, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(world(anchor(c), 0.015))
      ring.userData.pulse = kind === 'on'
      t.rings.add(ring)
    }
  }, [highlight, selected])

  // The camera controls capture the pointer, so clicks arrive at the wrapper: find the clearing under
  // the pointer from the projected positions. A click only counts if the pointer did not drag the map.
  function onClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (e.detail === 0 && target.dataset.clearing) return onClearing(target.dataset.clearing as ClearingId)
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) return
    const rect = surface.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let best: ClearingId | null = null
    let bestDist = Infinity
    for (const c of CLEARING_IDS) {
      const s = screen[c]
      if (!s) continue
      const d = Math.hypot(x - s.x, y - s.y)
      if (d <= s.r && d < bestDist) {
        best = c
        bestDist = d
      }
    }
    if (best) onClearing(best)
  }

  const zoom = (factor: number) => () => {
    const t = three.current
    if (!t) return
    const dir = t.camera.position.clone().sub(t.controls.target)
    const len = THREE.MathUtils.clamp(dir.length() * factor, t.controls.minDistance, t.controls.maxDistance)
    t.camera.position.copy(t.controls.target).add(dir.setLength(len))
  }

  const raycaster = useRef(new THREE.Raycaster())
  function onPointerMove(e: React.PointerEvent) {
    const t = three.current
    if (!t || e.buttons !== 0) return
    const rect = surface.current!.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.current.setFromCamera(ndc, t.camera)
    for (const hit of raycaster.current.intersectObject(t.pieces, true)) {
      let o: THREE.Object3D | null = hit.object
      while (o && !o.userData.info) o = o.parent
      if (!o) continue
      const key = o.userData.info as InfoKey
      if (hover?.key !== key || Math.hypot(hover.x - (e.clientX - rect.left), hover.y - (e.clientY - rect.top)) > 40) {
        setHover({ key, x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
      return
    }
    if (hover) setHover(null)
  }

  const pop = popover && screen[popover.clearing]
  return (
    <div className="rb-frame rb-3d">
      <div ref={surface} className="rb-surface" onPointerDownCapture={(e) => (press.current = { x: e.clientX, y: e.clientY })} onClick={onClick} onPointerMove={onPointerMove}>
        {CLEARING_IDS.map((c) => {
          const s = screen[c]
          if (!s) return null
          return (
            <button
              key={c}
              className={`rb-hit ${highlight.includes(c) ? 'on' : ''}`}
              style={{ left: s.x - s.r, top: s.y - s.r, width: s.r * 2, height: s.r * 2 }}
              data-clearing={c}
              aria-label={`Clearing ${c}`}
            />
          )
        })}
      </div>
      {popover && pop && (
        <div className="rb-popover-anchor" style={{ left: pop.x, top: pop.y }}>
          <div className="rb-popover">{popover.content}</div>
        </div>
      )}
      {hover && (
        <button className="rb-info" style={{ left: hover.x + 14, top: hover.y - 34 }} onClick={() => onInfo(hover.key)} aria-label="Rules for this piece">
          i
        </button>
      )}
      <div className="rb-zoom">
        <button onClick={zoom(0.75)} aria-label="Zoom in">+</button>
        <button onClick={zoom(1 / 0.75)} aria-label="Zoom out">−</button>
      </div>
    </div>
  )
}

// ---------- building the pieces ----------

const SLOT_SIZE = 0.82 // slots are ~76 px; tiles fill them with a little margin

function buildPieces(state: GameState, group: THREE.Group) {
  // Items still in the supply sit on their printed spaces.
  const left: Partial<Record<Item, number>> = { ...state.itemSupply }
  for (const sp of ITEM_SPACES) {
    if (!left[sp.item]) continue
    left[sp.item]! -= 1
    const m = tile(pieceImage(sp.item), 0.56, 0.06, '#d8d0bf')
    m.position.copy(world(sp))
    m.userData.info = 'item'
    group.add(m)
  }

  for (const c of CLEARING_IDS) {
    const cs = state.clearings[c]
    const layout = SLOTS[c]
    const a = anchor(c)
    // The printed ruin slot keeps its ruin while it stands; buildings fill the other slots in order.
    const free = layout.slots.map((_, i) => i).filter((i) => !(cs.ruins > 0 && i === layout.ruinSlot))
    if (cs.ruins > 0 && layout.ruinSlot !== null) {
      const ruin = tile(pieceImage('ruin'), SLOT_SIZE, 0.24, '#8c8578')
      ruin.position.copy(world(layout.slots[layout.ruinSlot]))
      ruin.userData.info = 'ruin'
      group.add(ruin)
    }
    cs.buildings.forEach((b, i) => {
      const m = tile(pieceImage(b.kind), SLOT_SIZE, 0.2, FACTION_COLOR[b.faction])
      m.userData.info = b.kind
      m.position.copy(world(layout.slots[free[i]]))
      group.add(m)
    })

    // Suit banner, with a ribbon in the ruler's colour.
    const banner = suitBanner(CLEARINGS[c].suit, ruler(state, c), suitIcon(CLEARINGS[c].suit))
    banner.position.copy(world({ x: a.x + 0.045, y: a.y - 0.05 }, 0.2))
    group.add(banner)

    // Tokens and warriors go on open ground around the clearing, away from its building slots.
    const hasKeep = cs.tokens.some((t) => t.kind === 'keep')
    const wood = cs.tokens.filter((t) => t.kind === 'wood').length
    const factions = (['marquise', 'eyrie'] as Faction[]).filter((f) => cs.warriors[f] > 0)
    const spots = openGround(c, factions.length + (hasKeep ? 1 : 0) + (wood > 0 ? 1 : 0))

    factions.forEach((f) => {
      const n = cs.warriors[f]
      const base = spots.shift()!
      // Up to three meeples per faction, with a count badge.
      const offsets = [[0, 0], [-0.42, -0.34], [0.42, -0.34]].slice(0, Math.min(n, 3))
      for (const [dx, dz] of offsets) {
        const m = meeple(f)
        m.userData.info = `warrior-${f}`
        m.position.copy(base).add(new THREE.Vector3(dx, 0, dz))
        group.add(m)
      }
      const b = badge(n, f)
      b.position.copy(base).add(new THREE.Vector3(0.38, 0.2, 0.42))
      group.add(b)
    })
    if (hasKeep) {
      const k = keep()
      k.userData.info = 'keep'
      k.position.copy(spots.shift()!)
      group.add(k)
    }
    // Wood in stacks of three.
    if (wood > 0) {
      const base = spots.shift()!
      for (let i = 0; i < wood; i++) {
        const d = disc(pieceImage('wood'), 0.3, 0.09, '#b76a35')
        d.userData.info = 'wood'
        d.position.copy(base).add(new THREE.Vector3((Math.floor(i / 3) - 0.5) * 0.62, (i % 3) * 0.1, 0))
        group.add(d)
      }
    }
  }
}

// Spots around a clearing's centre that keep clear of its building slots and of each other.
function openGround(c: ClearingId, count: number): THREE.Vector3[] {
  const centre = world(anchor(c))
  const slots = SLOTS[c].slots.map((p) => world(p))
  const candidates: THREE.Vector3[] = []
  for (const r of [0.95, 1.4]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      candidates.push(centre.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r * 0.85)))
    }
  }
  candidates.push(centre.clone())
  const chosen: THREE.Vector3[] = []
  const clearance = (p: THREE.Vector3) => Math.min(...[...slots, ...chosen].map((q) => p.distanceTo(q)))
  for (let k = 0; k < count; k++) {
    // Prefer roomy spots near the centre, slightly toward the viewer.
    const best = candidates.reduce((a, b) => {
      const score = (p: THREE.Vector3) => Math.min(clearance(p), 1.3) - p.distanceTo(centre) * 0.15 + (p.z - centre.z) * 0.05
      return score(b) > score(a) ? b : a
    })
    chosen.push(best)
  }
  return chosen
}
