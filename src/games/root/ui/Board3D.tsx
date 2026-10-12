import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { CLEARINGS, type ClearingId } from '../data/autumnMap'
import { ITEM_SPACES, SLOTS } from '../data/autumnLayout'
import type { Item } from '../data/types'
import { CLEARING_IDS, ruler } from '../engine/core'
import type { Faction, GameState } from '../engine/types'
import type { InfoKey } from '../data/rulesInfo'
import { pieceImage, suitIcon } from './assets'
import { WARRIOR_HEIGHT, badge, keep, meeple, ringTexture, suitBanner, tile } from './pieces3d'
import { building3d, logPile, slotMarker } from './buildings3d'
import { Animator } from './animator'
import { CLEARING_RADIUS, MIST, WORLD_H, WORLD_W, anchorFraction, buildWorld, groundHeight, isDry, isOpenGround, marketPosition, toWorld } from './world3d'

// How far from a clearing's centre its suit banner stands.
const BANNER_RADIUS = 6.3
// A banner's height in world units, and the least it may shrink to on screen, in pixels.
const BANNER_SIZE = 4.4
const BANNER_MIN_PX = 60
// The same for the warrior count badges.
const BADGE_SIZE = 1
const BADGE_MIN_PX = 24
// How close the camera comes to watch an action: a clearing fills much of the screen, as in the app.
const ACTION_VIEW = 30
// Buildings, ruins, the keep and wood are drawn this much larger than their models, to suit the
// warriors' size.
const BUILDING_SIZE = 1.45

// Board fractions → a point on the ground of the 3D woodland.
const world = (p: { x: number; y: number }, lift = 0) => {
  const v = toWorld(p.x, p.y)
  v.y = groundHeight(v.x, v.z) + lift
  return v
}
const anchor = anchorFraction

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
  animated: THREE.Object3D[]
  banners: THREE.Sprite[]
  badges: THREE.Sprite[]
  animator: Animator
}

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
  const firstBuild = useRef(true)
  // The clearings to choose from, waiting to be framed once the animations finish.
  const frameChoices = useRef<{ centre: THREE.Vector3; dist: number } | null>(null)
  const framedKey = useRef('')
  // True while the camera glides or pieces animate (tests wait for it before clicking).
  const [busy, setBusy] = useState(false)
  // The piece under the pointer, for the rules "i" button.
  // It stands just above the piece (not at the pointer), so it holds still while you reach for it.
  const [hover, setHover] = useState<{ key: InfoKey; x: number; y: number } | null>(null)
  const hovered = useRef<{ piece: THREE.Object3D; top: number } | null>(null)
  const hideTimer = useRef(0)

  // ---------- scene setup, once ----------
  useEffect(() => {
    const el = surface.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    // Above 1.5 the extra pixels cost more frame rate than they add sharpness.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(MIST)

    scene.add(new THREE.HemisphereLight('#fff4dc', '#3b4a2c', 1.25))
    const sun = new THREE.DirectionalLight('#fff0d0', 2.1)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 90 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.03
    scene.add(sun, sun.target)

    const woodland = buildWorld(scene)

    const pieces = new THREE.Group()
    const rings = new THREE.Group()
    scene.add(pieces, rings)

    // Camera: a tilted view over the board, from close to nearly straight down.
    const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 400)
    const controls = new MapControls(camera, el)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.zoomToCursor = true
    controls.minPolarAngle = 0.12
    controls.maxPolarAngle = 1.05
    controls.minAzimuthAngle = -0.6
    controls.maxAzimuthAngle = 0.6
    controls.minDistance = 7
    // Keep the camera's focus on the board so it can never drift away. The further out the camera,
    // the closer to the centre its focus is held: fully zoomed out it shows exactly the whole board,
    // never the world's edge.
    const allowedFocus = (p: THREE.Vector3, dist: number) => {
      const reach = THREE.MathUtils.clamp((controls.maxDistance - dist) / (controls.maxDistance * 0.55), 0, 1)
      return new THREE.Vector3(
        THREE.MathUtils.clamp(p.x, (-WORLD_W / 2) * reach, (WORLD_W / 2) * reach),
        p.y,
        THREE.MathUtils.clamp(p.z, (-WORLD_H / 2) * reach, (WORLD_H / 2) * reach),
      )
    }
    controls.addEventListener('change', () => {
      const t = controls.target
      const c = allowedFocus(t, camera.position.distanceTo(t))
      if (c.x !== t.x || c.z !== t.z) {
        camera.position.x += c.x - t.x
        camera.position.z += c.z - t.z
        t.copy(c)
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
    // Start over the whole woodland, tilted like the app: the closest view that still fits all four
    // corners of the board in the screen area between the overlays.
    const polar = 0.62
    controls.target.set(0, 0, 0)
    const place = (d: number) => {
      camera.position.set(0, Math.cos(polar) * d, Math.sin(polar) * d)
      camera.lookAt(controls.target)
      camera.updateMatrixWorld()
    }
    const fits = () => {
      const { height } = el.getBoundingClientRect()
      const pad = insets()
      const top = 1 - (2 * pad.top) / height
      const bottom = -1 + (2 * pad.bottom) / height
      return [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => {
        const v = new THREE.Vector3((sx * WORLD_W) / 2, 0, (sz * WORLD_H) / 2).project(camera)
        return Math.abs(v.x) <= 0.98 && v.y <= top && v.y >= bottom
      })
    }
    let lo = 10
    let hi = 400
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      place(mid)
      if (fits()) hi = mid
      else lo = mid
    }
    place(hi)
    controls.maxDistance = hi
    // Fully zoomed out the whole board stays clear; only the far woods fade into the haze.
    scene.fog = new THREE.Fog(MIST, hi * 1.05, hi * 1.6)
    controls.update()

    window.addEventListener('resize', resize)
    // The camera glides to each action as it is animated, keeping its angle, coming in to watch it if
    // it is further out; and frames the clearings to choose from when it is your choice.
    const glide = { to: null as THREE.Vector3 | null, dist: ACTION_VIEW, closerOnly: true }
    const animator = new Animator(scene, { focus: (p) => Object.assign(glide, { to: p.clone(), dist: ACTION_VIEW, closerOnly: true }) })
    three.current = { renderer, camera, controls, scene, pieces, rings, resize, animated: [], banners: [], badges: [], animator }

    let frame = 0
    const v = new THREE.Vector3()
    let last = 0
    const loop = (t: number) => {
      frame = requestAnimationFrame(loop)
      // Animations run on real time, so they take as long on a slow machine as on a fast one.
      const elapsed = last ? (t - last) / 1000 : 0
      last = t
      const choices = frameChoices.current
      if (choices && !animator.busy) {
        Object.assign(glide, { to: choices.centre, dist: Math.min(choices.dist, controls.maxDistance), closerOnly: false })
        frameChoices.current = null
      }
      if (glide.to) {
        const now = camera.position.distanceTo(controls.target)
        const want = glide.closerOnly ? Math.min(now, glide.dist) : glide.dist
        // Aim where the focus may rest at that distance, so the glide can always arrive.
        const move = allowedFocus(glide.to, want).sub(controls.target).multiplyScalar(Math.min(1, elapsed * 3))
        controls.target.add(move)
        camera.position.add(move)
        const offset = camera.position.clone().sub(controls.target)
        camera.position.copy(controls.target).add(offset.setLength(offset.length() + (want - offset.length()) * Math.min(1, elapsed * 2)))
        if (move.length() < 0.01 && Math.abs(offset.length() - want) < 0.5) glide.to = null
      }
      controls.update()
      woodland.update(t / 1000, Math.min(0.05, elapsed))
      animator.tick(elapsed)
      const moving = animator.busy || glide.to !== null
      setBusy((b) => (b === moving ? b : moving))
      // The sun's shadow box follows what you are looking at.
      sun.target.position.copy(controls.target)
      sun.position.copy(controls.target).add(new THREE.Vector3(-22, 40, 18))
      for (const o of three.current?.animated ?? []) {
        if (o.userData.spin) (o.userData.spin as THREE.Object3D).rotation.z = t / 300
        if (o.userData.flag) (o.userData.flag as THREE.Object3D).rotation.y = Math.sin(t / 400) * 0.35
      }
      // Pulse the highlight rings.
      for (const ring of rings.children as THREE.Mesh[]) {
        if (ring.userData.pulse) (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.35 * Math.sin(t / 260)
      }
      renderer.render(scene, camera)
      const rect = el.getBoundingClientRect()
      // Clearing banners never shrink below a readable size on screen, however far out you zoom.
      const perPixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / rect.height
      for (const b of three.current?.banners ?? []) {
        const s = Math.max(BANNER_SIZE, camera.position.distanceTo(b.position) * perPixel * BANNER_MIN_PX)
        b.scale.set(s * 0.7, s, 1)
      }
      // So do the warrior counts: zoomed out, they say what the tiny figures are.
      for (const b of three.current?.badges ?? []) {
        const s = Math.max(BADGE_SIZE, camera.position.distanceTo(b.position) * perPixel * BADGE_MIN_PX)
        b.scale.set(s, s, 1)
      }
      // Keep the rules button just above the hovered piece.
      const h = hovered.current
      if (h) {
        v.set(h.piece.position.x, h.top + 0.3, h.piece.position.z).project(camera)
        const x = Math.round(((v.x + 1) / 2) * rect.width)
        const y = Math.round(((1 - v.y) / 2) * rect.height)
        const key = h.piece.userData.info as InfoKey
        setHover((prev) => (prev && prev.key === key && prev.x === x && prev.y === y ? prev : { key, x, y }))
      }
      // Project clearings to the screen for the click targets and popovers.
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
    const before = [...t.pieces.children]
    t.pieces.clear()
    Object.assign(t, buildPieces(state, t.pieces))
    // Animate what just happened, except on first load (nothing has happened yet).
    if (!firstBuild.current) {
      t.animator.finish()
      t.animator.play(state.events, before, [...t.pieces.children])
    }
    firstBuild.current = false
  }, [state])

  // ---------- highlight rings ----------
  useEffect(() => {
    const t = three.current
    if (!t) return
    // A new set of clearings to choose from: bring them all into view.
    const key = highlight.join()
    if (key !== framedKey.current) {
      framedKey.current = key
      if (highlight.length > 0) {
        const points = highlight.map((c) => world(anchor(c)))
        const centre = points.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(points.length)
        const reach = Math.max(...points.map((p) => p.distanceTo(centre))) + CLEARING_RADIUS + 3
        const dist = Math.max(ACTION_VIEW, (reach / Math.tan(THREE.MathUtils.degToRad(t.camera.fov / 2))) * 1.1)
        frameChoices.current = { centre, dist }
      }
    }
    t.rings.clear()
    const geo = new THREE.PlaneGeometry(CLEARING_RADIUS * 2, CLEARING_RADIUS * 2)
    for (const c of CLEARING_IDS) {
      const kind = selected === c ? 'selected' : highlight.includes(c) ? 'on' : null
      if (!kind) continue
      // Drawn over everything, so trees and pieces never hide where you can act.
      const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ringTexture(kind), transparent: true, depthWrite: false, depthTest: false }))
      ring.renderOrder = 8
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(world(anchor(c), 0.1))
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
      window.clearTimeout(hideTimer.current)
      if (hovered.current?.piece !== o) hovered.current = { piece: o, top: new THREE.Box3().setFromObject(o).max.y }
      return
    }
    leaveHover()
  }

  // Off the piece, the button lingers a moment so the pointer can reach it.
  function leaveHover() {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      hovered.current = null
      setHover(null)
    }, 700)
  }

  const pop = popover && screen[popover.clearing]
  return (
    <div className="rb-frame rb-3d" data-busy={busy || undefined}>
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
        // Opens below a clearing in the top half of the screen, above one in the bottom half, so it
        // always has room.
        <div className={`rb-popover-anchor ${pop.y < (surface.current?.clientHeight ?? 0) / 2 ? 'below' : ''}`} style={{ left: pop.x, top: pop.y }}>
          <div className="rb-popover">{popover.content}</div>
        </div>
      )}
      {hover && (
        <button
          className="rb-info"
          style={{ left: hover.x, top: hover.y }}
          onPointerEnter={() => window.clearTimeout(hideTimer.current)}
          onPointerLeave={leaveHover}
          onClick={() => onInfo(hover.key)}
          aria-label="Rules for this piece"
        >
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

// Pieces carry what they are and where, for the rules pop-up and for animating events.
function tag<T extends THREE.Object3D>(o: T, info: InfoKey, clearing?: ClearingId, faction?: Faction): T {
  o.userData.info = info
  o.userData.clearing = clearing
  o.userData.faction = faction
  return o
}

// Returns the pieces with idle animations (saw blades, flags), and the clearings' banners.
function buildPieces(state: GameState, group: THREE.Group): { animated: THREE.Object3D[]; banners: THREE.Sprite[]; badges: THREE.Sprite[] } {
  const animated: THREE.Object3D[] = []
  const banners: THREE.Sprite[] = []
  const badges: THREE.Sprite[] = []

  // The item supply: a market table at the top left, items laid out as printed.
  const market = marketPosition()
  const table = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.25, 2.8), new THREE.MeshLambertMaterial({ color: '#7b5233' }))
  table.position.copy(market).add(new THREE.Vector3(0, 0.9, 0))
  table.castShadow = table.receiveShadow = true
  group.add(table)
  for (const [x, z] of [[-3.5, -1.2], [3.5, -1.2], [-3.5, 1.2], [3.5, 1.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), table.material)
    leg.position.copy(market).add(new THREE.Vector3(x, 0.45, z))
    group.add(leg)
  }
  const left: Partial<Record<Item, number>> = { ...state.itemSupply }
  ITEM_SPACES.forEach((sp, i) => {
    if (!left[sp.item]) return
    left[sp.item]! -= 1
    const m = tag(tile(pieceImage(sp.item), 0.95, 0.12, '#d8d0bf'), 'item')
    m.position.copy(market).add(new THREE.Vector3(((i % 6) - 2.5) * 1.2, 1.03, (Math.floor(i / 6) - 0.5) * 1.2))
    group.add(m)
  })

  for (const c of CLEARING_IDS) {
    const cs = state.clearings[c]
    const layout = SLOTS[c]
    const a = anchor(c)
    // The printed ruin slot keeps its ruin while it stands; buildings fill the other slots in order.
    const free = layout.slots.map((_, i) => i).filter((i) => !(cs.ruins > 0 && i === layout.ruinSlot))
    if (cs.ruins > 0 && layout.ruinSlot !== null) {
      const ruin = tag(building3d('ruin', null), 'ruin', c)
      ruin.scale.setScalar(BUILDING_SIZE)
      ruin.position.copy(world(layout.slots[layout.ruinSlot]))
      group.add(ruin)
    }
    free.forEach((slot, i) => {
      const at = world(layout.slots[slot])
      const b = cs.buildings[i]
      if (!b) {
        const marker = slotMarker()
        marker.scale.setScalar(BUILDING_SIZE * 0.9)
        marker.position.copy(at).add(new THREE.Vector3(0, 0.03, 0))
        group.add(marker)
        return
      }
      const m = tag(building3d(b.kind, b.faction), b.kind, c, b.faction)
      m.scale.setScalar(BUILDING_SIZE)
      m.position.copy(at)
      // Face the building toward the viewer, turned slightly toward the clearing's centre.
      m.rotation.y = Math.atan2(world(a).x - at.x, 40) * 0.6
      group.add(m)
      if (m.userData.spin || m.userData.flag) animated.push(m)
    })

    // Suit banner, with a ribbon in the ruler's colour.
    const banner = suitBanner(CLEARINGS[c].suit, ruler(state, c), suitIcon(CLEARINGS[c].suit))
    banner.position.copy(bannerSpot(c))
    group.add(banner)
    banners.push(banner)

    // Tokens and warriors go on open ground around the clearing, away from its building slots.
    const hasKeep = cs.tokens.some((t) => t.kind === 'keep')
    const wood = cs.tokens.filter((t) => t.kind === 'wood').length
    const factions = (['marquise', 'eyrie'] as Faction[]).filter((f) => cs.warriors[f] > 0)
    const spots = openGround(c, factions.length + (hasKeep ? 1 : 0) + (wood > 0 ? 1 : 0))

    factions.forEach((f) => {
      const n = cs.warriors[f]
      const base = spots.shift()!
      // Up to five meeples per faction stand together, with a count badge.
      const offsets = [[0, 0], [-0.62, -0.4], [0.62, -0.4], [-0.62, 0.45], [0.62, 0.45]].slice(0, Math.min(n, 5))
      for (const [dx, dz] of offsets) {
        const m = tag(meeple(f), `warrior-${f}` as InfoKey, c, f)
        m.position.copy(onGround(base.x + dx * WARRIOR_HEIGHT, base.z + dz * WARRIOR_HEIGHT))
        m.rotation.y = (hashAngle(c, dx, dz) - 0.5) * 0.5
        group.add(m)
      }
      const b = badge(n, f)
      b.position.copy(base).add(new THREE.Vector3(0.95, 1.25, 0.5).multiplyScalar(WARRIOR_HEIGHT))
      group.add(b)
      badges.push(b)
    })
    if (hasKeep) {
      const k = tag(keep(), 'keep', c, 'marquise')
      k.scale.setScalar(2 * BUILDING_SIZE)
      k.position.copy(spots.shift()!)
      group.add(k)
    }
    // Wood: a log pile per token, in rows of three.
    if (wood > 0) {
      const base = spots.shift()!
      for (let i = 0; i < wood; i++) {
        const pile = tag(logPile(), 'wood', c, 'marquise')
        pile.scale.setScalar(BUILDING_SIZE)
        pile.position.copy(onGround(base.x + ((i % 3) - 1) * 0.75 * BUILDING_SIZE, base.z + Math.floor(i / 3) * 0.75 * BUILDING_SIZE))
        group.add(pile)
      }
    }
  }
  return { animated, banners, badges }
}

function hashAngle(c: string, dx: number, dz: number): number {
  const s = Math.sin(c.charCodeAt(0) * 12.9 + dx * 78.2 + dz * 37.7) * 43758.5
  return s - Math.floor(s)
}

// A clearing's banner stands at its upper right edge, or the nearest spot round the edge that is
// clear of the river and roads.
function bannerSpot(c: ClearingId): THREE.Vector3 {
  const centre = world(anchor(c))
  for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2, -2, 2.4, -2.4, 2.8, -2.8]) {
    const a = -0.75 + turn
    const x = centre.x + Math.cos(a) * BANNER_RADIUS
    const z = centre.z + Math.sin(a) * BANNER_RADIUS
    // Floating a little above the ground.
    if (isOpenGround(x, z)) return new THREE.Vector3(x, groundHeight(x, z) + 1.2, z)
  }
  throw new Error(`No open ground for clearing ${c}'s banner.`)
}

// A point on the ground itself (each spot takes its own height, so nothing sinks into a slope).
function onGround(x: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, groundHeight(x, z), z)
}

// Spots around a clearing's centre, on dry ground, that keep clear of its building slots and of
// each other: room for a group of warriors, the keep, or a wood pile.
function openGround(c: ClearingId, count: number): THREE.Vector3[] {
  const centre = world(anchor(c))
  const slots = SLOTS[c].slots.map((p) => world(p))
  const candidates = [centre.clone()]
  for (const r of [1.6, 2.6, 3.6]) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      candidates.push(onGround(centre.x + Math.cos(a) * r, centre.z + Math.sin(a) * r * 0.9))
    }
  }
  // A group of warriors is about two warriors across; it must stand clear of the water too.
  const dry = candidates.filter((p) => [[0, 0], [-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]].every(([dx, dz]) => isDry(p.x + dx, p.z + dz)))
  const flat = (p: THREE.Vector3, q: THREE.Vector3) => Math.hypot(p.x - q.x, p.z - q.z)
  const chosen: THREE.Vector3[] = []
  const clearance = (p: THREE.Vector3) => Math.min(...[...slots.map((q) => flat(p, q) - (1.1 * BUILDING_SIZE + 1.6)), ...chosen.map((q) => flat(p, q) - 2.4)])
  for (let k = 0; k < count; k++) {
    // Prefer roomy spots near the centre, slightly toward the viewer.
    const best = dry.reduce((a, b) => {
      const score = (p: THREE.Vector3) => Math.min(clearance(p), 1) - flat(p, centre) * 0.12 + (p.z - centre.z) * 0.04
      return score(b) > score(a) ? b : a
    })
    chosen.push(best)
  }
  return chosen
}
