import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Animator } from './animator'
import { clearingCenter } from './world3d'

// A stand-in for a warrior on the board.
function warrior(clearing: string, at: THREE.Vector3) {
  const o = new THREE.Object3D()
  o.position.copy(at)
  o.userData = { clearing, faction: 'marquise', info: 'warrior-marquise' }
  return o
}

describe('Animator: a move', () => {
  it('walks the warriors single file down the road, then spreads them over their places', () => {
    const scene = new THREE.Scene()
    const focuses: THREE.Vector3[] = []
    const animator = new Animator(scene, { focus: (p) => focuses.push(p.clone()) })
    const from = clearingCenter('A')
    const to = clearingCenter('B')
    const before = [0, 1, 2].map((i) => warrior('A', from.clone().add(new THREE.Vector3(i, 0, 0))))
    const after = [0, 1, 2].map((i) => warrior('B', to.clone().add(new THREE.Vector3(i - 1, 0, 1))))

    animator.play([{ type: 'move', faction: 'marquise', from: 'A', to: 'B', count: 3 }], before, after)
    const ghosts = scene.children[0]
    const dir = to.clone().sub(from).setY(0).normalize()
    const along = (p: THREE.Vector3) => p.clone().sub(from).setY(0).dot(dir)
    const offRoad = (p: THREE.Vector3) => p.clone().sub(from).setY(0).cross(dir).length()

    let last = -Infinity
    let walking = 0
    let walkers: THREE.Object3D[] = []
    while (animator.busy) {
      animator.tick(1 / 30)
      if (ghosts.children.length === 0) continue
      walkers = [...ghosts.children]
      expect(after.every((o) => !o.visible)).toBe(true) // arrivals wait for the walkers
      const lead = ghosts.children[0].position
      // On the road (before the leader reaches the far clearing): in single file, each a step behind the one ahead.
      if (focuses.length === 2 && along(lead) < from.distanceTo(to) - 2) {
        walking++
        for (const w of ghosts.children) expect(offRoad(w.position)).toBeLessThan(0.01)
        for (let i = 1; i < ghosts.children.length; i++) {
          expect(along(ghosts.children[i - 1].position) - along(ghosts.children[i].position)).toBeCloseTo(0.85, 5)
        }
        expect(along(lead)).toBeGreaterThanOrEqual(last)
        last = along(lead)
      }
    }
    expect(walking).toBeGreaterThan(10)
    // The camera follows: the start, then along the road.
    expect(focuses.map((p) => (p.distanceTo(from) < 0.01 ? 'from' : 'road'))).toEqual(['from', 'road'])
    // Each walker ended at its own place before vanishing into the real piece.
    expect(walkers).toHaveLength(3)
    walkers.forEach((w, i) => expect(w.position.distanceTo(after[i].position)).toBeLessThan(1e-6))
    // Done: the walkers are gone and the real pieces stand in their places.
    expect(ghosts.children).toHaveLength(0)
    expect(after.every((o) => o.visible)).toBe(true)
  })

  it('takes as long in real time however few frames are drawn', () => {
    const animator = new Animator(new THREE.Scene(), { focus: () => {} })
    const before = [warrior('A', clearingCenter('A'))]
    const after = [warrior('B', clearingCenter('B'))]
    animator.play([{ type: 'move', faction: 'marquise', from: 'A', to: 'B', count: 1 }], before, after)
    // Two steps (gather, walk), each finished by one long frame.
    for (let i = 0; i < 2; i++) animator.tick(30)
    expect(animator.busy).toBe(false)
  })
})
