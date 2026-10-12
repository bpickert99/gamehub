import * as THREE from 'three'
import type { ClearingId } from '../data/autumnMap'
import type { Faction, GameEvent } from '../engine/types'
import { meeple } from './pieces3d'
import { clearingCenter, walkHeight } from './world3d'

// Turns the engine's events into a queue of short animations in the 3D woodland, played the same way
// on every player's screen, with the camera gliding to each one.

type Step = {
  duration: number
  focus?: THREE.Vector3
  start?: () => void
  update?: (k: number) => void
  end?: () => void
}

export type Camera = { focus: (p: THREE.Vector3) => void }

type Piece = THREE.Object3D & { userData: { clearing?: ClearingId; faction?: Faction; info?: string } }

const WALK_SPEED = 7 // world units per second
const FILE_GAP = 0.85 // spacing of warriors walking single file

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)
const bounce = (k: number) => 1 + Math.sin(k * Math.PI) * 0.25 * (1 - k)

export class Animator {
  private queue: Step[] = []
  private current: { step: Step; t: number } | null = null
  private ghosts = new THREE.Group()

  constructor(scene: THREE.Scene, private camera: Camera) {
    scene.add(this.ghosts)
  }

  get busy(): boolean {
    return this.current !== null || this.queue.length > 0
  }

  // `before` holds the pieces as they stood before the events; `after` the freshly built pieces.
  play(events: GameEvent[], before: Piece[], after: Piece[]): void {
    const pool = [...before]
    const take = (match: (o: Piece) => boolean, n: number) => {
      const out: Piece[] = []
      for (let i = 0; i < pool.length && out.length < n; i++) {
        if (match(pool[i])) out.push(...pool.splice(i--, 1))
      }
      return out
    }
    const find = (match: (o: Piece) => boolean) => after.filter(match)

    // Placements and builds that happen together (like setup's garrison) animate together.
    const groups: GameEvent[][] = []
    for (const e of events) {
      const last = groups[groups.length - 1]
      if (last && ['place', 'build', 'wood'].includes(e.type) && last[0].type === e.type) last.push(e)
      else groups.push([e])
    }
    const at = (cs: ClearingId[]) => cs.map(clearingCenter).reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(cs.length)

    for (const group of groups) {
      const e = group[0]
      switch (e.type) {
        case 'move': this.walk(e, take, find); break
        case 'place': {
          const evs = group as Extract<GameEvent, { type: 'place' }>[]
          this.pop(evs.flatMap((p) => find((o) => o.userData.clearing === p.clearing && o.userData.faction === p.faction && o.userData.info === `warrior-${p.faction}`)), at(evs.map((p) => p.clearing)), evs.length === 1)
          break
        }
        case 'build': {
          const evs = group as Extract<GameEvent, { type: 'build' }>[]
          this.rise(evs.flatMap((b) => find((o) => o.userData.clearing === b.clearing && o.userData.info === b.kind)), at(evs.map((b) => b.clearing)), evs.length === 1)
          break
        }
        case 'wood': {
          const cs = (group as Extract<GameEvent, { type: 'wood' }>[]).flatMap((w) => w.clearings)
          this.drop(cs.flatMap((c) => find((o) => o.userData.clearing === c && o.userData.info === 'wood')), at(cs), new Set(cs).size === 1)
          break
        }
        case 'remove': this.topple(take((o) => o.userData.clearing === e.clearing && o.userData.faction === e.faction && (o.userData.info === `warrior-${e.faction}` || e.pieces.includes(o.userData.info as never)), e.warriors + e.pieces.length), clearingCenter(e.clearing)); break
        case 'battle': this.queue.push({ duration: 0.9, focus: clearingCenter(e.clearing) }); break
        case 'roll': this.queue.push({ duration: 1.6, focus: clearingCenter(e.clearing) }); break
        default: break
      }
    }
  }

  // ---------- kinds of animation ----------

  private walk(e: Extract<GameEvent, { type: 'move' }>, take: (m: (o: Piece) => boolean, n: number) => Piece[], find: (m: (o: Piece) => boolean) => Piece[]) {
    const from = clearingCenter(e.from)
    const to = clearingCenter(e.to)
    const isWarrior = (o: Piece) => o.userData.faction === e.faction && o.userData.info === `warrior-${e.faction}`
    // Arriving warriors stay hidden until the walkers reach them.
    const arrivals = find((o) => o.userData.clearing === e.to && isWarrior(o))
    const walkers = take((o) => o.userData.clearing === e.from && isWarrior(o), Math.min(e.count, 5)).map((o) => o.clone())
    while (walkers.length < Math.min(e.count, 5)) walkers.push(meeple(e.faction))
    const starts = walkers.map((w) => w.position.clone())
    const dir = to.clone().sub(from).setY(0)
    const len = dir.length()
    dir.normalize()
    const heading = Math.atan2(dir.x, dir.z)
    const along = (d: number) => {
      const p = from.clone().addScaledVector(dir, Math.max(0, Math.min(len, d)))
      p.y = walkHeight(p.x, p.z)
      return p
    }
    // 1. Gather in single file at the road's mouth.
    const file = walkers.map((_, i) => along(2 - i * FILE_GAP))
    this.queue.push({
      duration: 0.5,
      focus: from,
      start: () => {
        arrivals.forEach((o) => (o.visible = false))
        walkers.forEach((w) => this.ghosts.add(w))
      },
      update: (k) => walkers.forEach((w, i) => {
        w.position.lerpVectors(starts[i], file[i], ease(k))
        w.rotation.y = heading
      }),
    })
    // 2. Walk the road in step, keeping the file, each peeling off at the far clearing to its own place.
    const entrance = along(len - 2)
    const paths = walkers.map((_, i) => {
      const target = arrivals[i] ? arrivals[i].position.clone() : entrance.clone()
      const road = entrance.distanceTo(file[i])
      return { target, road, total: road + entrance.distanceTo(target) }
    })
    const walkTime = Math.max(...paths.map((p) => p.total)) / WALK_SPEED
    this.queue.push({
      duration: walkTime,
      focus: from.clone().lerp(to, 0.5),
      update: (k) => walkers.forEach((w, i) => {
        const { target, road, total } = paths[i]
        const d = Math.min(k * walkTime * WALK_SPEED, total)
        if (d <= road) {
          const dist = len - 2 - road + d
          w.position.copy(along(dist))
          w.position.y += Math.abs(Math.sin(dist * 3.2)) * 0.12 // a little hop in each step
        } else {
          w.position.lerpVectors(entrance, target, (d - road) / (total - road))
        }
      }),
      end: () => {
        walkers.forEach((w) => this.ghosts.remove(w))
        arrivals.forEach((o) => (o.visible = true))
      },
    })
  }

  private pop(objs: Piece[], at: THREE.Vector3, local: boolean) {
    const scales = objs.map((o) => o.scale.clone())
    this.queue.push({
      duration: 0.6,
      focus: local ? at : undefined,
      start: () => objs.forEach((o) => o.scale.setScalar(0.001)),
      update: (k) => objs.forEach((o, i) => o.scale.copy(scales[i]).multiplyScalar(Math.max(0.001, Math.min(1, k * 1.6 - i * 0.12)) * bounce(k))),
      end: () => objs.forEach((o, i) => o.scale.copy(scales[i])),
    })
  }

  private rise(objs: Piece[], at: THREE.Vector3, local: boolean) {
    const scales = objs.map((o) => o.scale.clone())
    this.queue.push({
      duration: 0.9,
      focus: local ? at : undefined,
      start: () => objs.forEach((o) => o.scale.set(o.scale.x, 0.001, o.scale.z)),
      update: (k) => objs.forEach((o, i) => o.scale.set(scales[i].x, scales[i].y * ease(k) * bounce(k), scales[i].z)),
      end: () => objs.forEach((o, i) => o.scale.copy(scales[i])),
    })
  }

  private drop(objs: Piece[], at: THREE.Vector3, local: boolean) {
    const ys = objs.map((o) => o.position.y)
    this.queue.push({
      duration: 0.7,
      focus: local ? at : undefined,
      update: (k) => objs.forEach((o, i) => (o.position.y = ys[i] + (1 - ease(Math.min(1, k * 1.3 - i * 0.1))) * 3)),
      end: () => objs.forEach((o, i) => (o.position.y = ys[i])),
    })
  }

  private topple(objs: Piece[], at: THREE.Vector3) {
    const ghosts = objs.map((o) => o.clone())
    const base = ghosts.map((g) => ({ y: g.position.y, rx: g.rotation.x }))
    this.queue.push({
      duration: 0.9,
      focus: at,
      start: () => ghosts.forEach((g) => this.ghosts.add(g)),
      update: (k) => ghosts.forEach((g, i) => {
        g.rotation.x = base[i].rx - ease(Math.min(1, k * 1.5)) * Math.PI / 2
        g.position.y = base[i].y - Math.max(0, k - 0.6) * 2
      }),
      end: () => ghosts.forEach((g) => this.ghosts.remove(g)),
    })
  }

  // ---------- per frame ----------

  tick(dt: number): void {
    if (!this.current) {
      const step = this.queue.shift()
      if (!step) return
      this.current = { step, t: 0 }
      step.start?.()
      if (step.focus) this.camera.focus(step.focus)
    }
    const c = this.current
    c.t += dt
    const k = Math.min(1, c.t / c.step.duration)
    c.step.update?.(k)
    if (k >= 1) {
      c.step.end?.()
      this.current = null
    }
  }

  // Jump to the end of everything queued (e.g. when a newer game state arrives).
  finish(): void {
    if (this.current) {
      this.current.step.update?.(1)
      this.current.step.end?.()
      this.current = null
    }
    for (const step of this.queue.splice(0)) {
      step.start?.()
      step.update?.(1)
      step.end?.()
    }
    this.ghosts.clear()
  }
}
