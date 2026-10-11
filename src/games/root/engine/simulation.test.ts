import { describe, expect, it } from 'vitest'
import { CLEARING_IDS } from './core'
import { applyAction, createGame } from './game'
import { legalActions } from './legal'
import type { GameState } from './types'

// Simple deterministic chooser so failures reproduce.
function pick<T>(items: T[], n: number): T {
  return items[n % items.length]
}

function checkInvariants(s: GameState): void {
  const onMap = (f: 'marquise' | 'eyrie') => CLEARING_IDS.reduce((n, c) => n + s.clearings[c].warriors[f], 0)
  expect(onMap('marquise') + s.marquise.warriors).toBe(25)
  expect(onMap('eyrie') + s.eyrie.warriors).toBe(20)
  const wood = CLEARING_IDS.reduce((n, c) => n + s.clearings[c].tokens.filter((t) => t.kind === 'wood').length, 0)
  expect(wood + s.marquise.wood).toBe(8)
  const roosts = CLEARING_IDS.reduce((n, c) => n + s.clearings[c].buildings.filter((b) => b.kind === 'roost').length, 0)
  expect(roosts + s.eyrie.roostTrack).toBe(7)
  for (const kind of ['sawmill', 'workshop', 'recruiter'] as const) {
    const built = CLEARING_IDS.reduce((n, c) => n + s.clearings[c].buildings.filter((b) => b.kind === kind).length, 0)
    expect(built + s.marquise.track[kind]).toBe(6)
  }
  const decreeCards = Object.values(s.eyrie.decree).flat().filter((e) => 'card' in e).length
  const ambushInPlay = s.battle?.ambush !== undefined ? 1 : 0
  const cards = s.deck.length + s.discard.length + s.hands.marquise.length + s.hands.eyrie.length +
    s.playArea.marquise.length + s.playArea.eyrie.length + decreeCards + ambushInPlay
  expect(cards).toBe(50)
  for (const c of CLEARING_IDS) expect(s.clearings[c].buildings.length + s.clearings[c].ruins).toBeLessThanOrEqual(3)
  expect(s.score.marquise).toBeGreaterThanOrEqual(0)
  expect(s.score.eyrie).toBeGreaterThanOrEqual(0)
}

describe('Random full games', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`plays seed ${seed} without breaking a rule or losing a piece`, () => {
      let s = createGame(seed)
      let steps = 0
      while (!s.winner && steps < 4000) {
        const options = legalActions(s)
        expect(options.length, `no legal action at step ${steps} (${s.step}, pending ${JSON.stringify(s.pending[0])})`).toBeGreaterThan(0)
        // Prefer doing things over ending phases, so games progress.
        const doing = options.filter((o) => o.action.type !== 'end-phase' && o.action.type !== 'skip')
        const choice = doing.length > 0 && (steps * 7 + seed) % 5 !== 0 ? pick(doing, steps * 31 + seed) : pick(options, steps + seed)
        s = applyAction(s, choice.faction, choice.action)
        checkInvariants(s)
        steps++
      }
      expect(s.winner !== null || steps === 4000).toBe(true)
    })
  }
})
