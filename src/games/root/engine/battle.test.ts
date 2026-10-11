import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { act, at, cardId, clear, giveHand, givePlayArea, rigDice, setUpGame } from './testHelpers'

// Clearing E (fox) with chosen forces; Marquise to act in Daylight.
function arena(marquise: number, eyrie: number, leader: 'despot' | 'commander' = 'despot'): GameState {
  const s = at(setUpGame(leader), 'marquise', 'daylight')
  clear(s, 'E')
  s.clearings.E.warriors = { marquise, eyrie }
  s.marquise.warriors -= marquise
  s.eyrie.warriors -= eyrie
  giveHand(s, 'marquise', [])
  giveHand(s, 'eyrie', [])
  return s
}

describe('Battle (4.3)', () => {
  it('attacker deals the higher roll, defender the lower (4.3.3)', () => {
    let s = arena(3, 3)
    rigDice(s, 1, 2)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.clearings.E.warriors).toEqual({ marquise: 2, eyrie: 1 })
  })

  it('caps rolled hits at the warriors in the clearing (4.3.3.I)', () => {
    let s = arena(1, 3)
    rigDice(s, 3, 3)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.clearings.E.warriors).toEqual({ marquise: 0, eyrie: 2 })
  })

  it('deals an extra hit to a defenseless defender (4.3.5.II) and scores buildings removed (3.2.1)', () => {
    let s = arena(2, 0)
    s.clearings.E.buildings.push({ faction: 'eyrie', kind: 'roost' })
    s.eyrie.roostTrack -= 1
    rigDice(s, 0, 0)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.clearings.E.buildings).toEqual([])
    expect(s.eyrie.roostTrack).toBe(6) // back on the track (G.24)
    expect(s.score.marquise).toBe(1)
  })

  it('removes warriors before buildings and tokens (4.3.6)', () => {
    let s = arena(3, 1)
    s.clearings.E.buildings.push({ faction: 'eyrie', kind: 'roost' })
    s.eyrie.roostTrack -= 1
    rigDice(s, 1, 0)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.clearings.E.warriors.eyrie).toBe(0)
    expect(s.clearings.E.buildings).toHaveLength(1)
  })

  it('lets the side taking hits choose which buildings or tokens go (4.3.6)', () => {
    let s = arena(0, 3)
    // Eyrie attack a Marquise clearing holding a sawmill and wood.
    s = at(s, 'eyrie', 'daylight')
    s.clearings.E.buildings.push({ faction: 'marquise', kind: 'sawmill' })
    s.marquise.track.sawmill -= 1
    s.clearings.E.tokens.push({ faction: 'marquise', kind: 'wood' })
    s.marquise.wood -= 1
    s.eyrie.decree.battle.push({ card: cardId('Anvil') })
    s.turn.resolved = []
    s.eyrie.decree.recruit = []
    s.eyrie.decree.move = []
    rigDice(s, 1, 0)
    s = act(s, 'eyrie', { type: 'decree-battle', column: 'battle', index: 0, clearing: 'E', defender: 'marquise' })
    // 1 rolled hit + 1 defenseless: 2 hits on two different pieces, so no choice. Despot scores the extra point.
    expect(s.clearings.E.buildings).toEqual([])
    expect(s.clearings.E.tokens).toEqual([])
    expect(s.score.eyrie).toBe(3)
  })

  it('asks the side taking hits when the order matters', () => {
    let s = arena(0, 3)
    s = at(s, 'eyrie', 'daylight')
    s.clearings.E.buildings.push({ faction: 'marquise', kind: 'sawmill' })
    s.marquise.track.sawmill -= 1
    s.clearings.E.tokens.push({ faction: 'marquise', kind: 'wood' })
    s.marquise.wood -= 1
    s.eyrie.decree = { recruit: [], move: [], battle: [{ card: cardId('Anvil') }], build: [] }
    rigDice(s, 0, 0)
    s = act(s, 'eyrie', { type: 'decree-battle', column: 'battle', index: 0, clearing: 'E', defender: 'marquise' })
    expect(s.pending[0]).toMatchObject({ kind: 'removals', faction: 'marquise', hits: 1 })
    s = act(s, 'marquise', { type: 'removals', pieces: ['wood'] })
    expect(s.clearings.E.buildings).toHaveLength(1)
    expect(s.clearings.E.tokens).toEqual([])
  })

  describe('Ambush (4.3.1)', () => {
    it('deals two immediate hits and can end the battle (4.3.1.II)', () => {
      let s = arena(2, 1)
      giveHand(s, 'eyrie', [cardId('Ambush!', 2)]) // fox ambush, E is a fox clearing
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      expect(s.pending[0]).toMatchObject({ kind: 'ambush', faction: 'eyrie' })
      s = act(s, 'eyrie', { type: 'ambush', card: cardId('Ambush!', 2) })
      expect(s.clearings.E.warriors).toEqual({ marquise: 0, eyrie: 1 })
      expect(s.battle).toBe(null)
      expect(s.discard).toContain(cardId('Ambush!', 2))
    })

    it('only matches the clearing suit or birds (2.1.2)', () => {
      let s = arena(2, 1)
      giveHand(s, 'eyrie', [cardId('Ambush!', 3)]) // rabbit ambush
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      expect(s.pending.some((p) => p.kind === 'ambush')).toBe(false)
    })

    it('can be foiled by a matching ambush from the attacker (4.3.1.I)', () => {
      let s = arena(2, 1)
      giveHand(s, 'eyrie', [cardId('Ambush!', 0)]) // bird
      giveHand(s, 'marquise', [cardId('Ambush!', 1)]) // bird
      rigDice(s, 0, 0)
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      s = act(s, 'eyrie', { type: 'ambush', card: cardId('Ambush!', 0) })
      expect(s.pending[0]).toMatchObject({ kind: 'foil', faction: 'marquise' })
      s = act(s, 'marquise', { type: 'foil', card: cardId('Ambush!', 1) })
      expect(s.clearings.E.warriors.marquise).toBe(2)
      expect(s.discard).toEqual(expect.arrayContaining([cardId('Ambush!', 0), cardId('Ambush!', 1)]))
    })

    it('does not affect an attacker with Scouting Party', () => {
      let s = arena(2, 1)
      givePlayArea(s, 'marquise', [cardId('Scouting Party')])
      giveHand(s, 'eyrie', [cardId('Ambush!', 0)])
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      expect(s.pending.some((p) => p.kind === 'ambush')).toBe(false)
    })
  })

  describe('Battle cards', () => {
    it('Armorers: discard to ignore all rolled hits taken', () => {
      let s = arena(3, 3)
      givePlayArea(s, 'eyrie', [cardId('Armorers')])
      rigDice(s, 3, 3)
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      s = act(s, 'eyrie', { type: 'battle-effects', armorers: true, sappers: false, brutalTactics: false })
      expect(s.clearings.E.warriors).toEqual({ marquise: 0, eyrie: 3 })
      expect(s.playArea.eyrie).toEqual([])
    })

    it('Sappers: the defender discards to deal an extra hit', () => {
      let s = arena(3, 3)
      givePlayArea(s, 'eyrie', [cardId('Sappers')])
      rigDice(s, 0, 0)
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      s = act(s, 'eyrie', { type: 'battle-effects', armorers: false, sappers: true, brutalTactics: false })
      expect(s.clearings.E.warriors.marquise).toBe(2)
    })

    it('Brutal Tactics: an extra hit for the attacker, a point for the defender', () => {
      let s = arena(3, 3)
      givePlayArea(s, 'marquise', [cardId('Brutal Tactics')])
      rigDice(s, 0, 0)
      s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
      s = act(s, 'marquise', { type: 'battle-effects', armorers: false, sappers: false, brutalTactics: true })
      expect(s.clearings.E.warriors.eyrie).toBe(2)
      expect(s.score.eyrie).toBe(1)
    })
  })

  it('Commander leader deals an extra hit as attacker (7.8.3)', () => {
    let s = arena(3, 3, 'commander')
    s = at(s, 'eyrie', 'daylight')
    s.eyrie.decree = { recruit: [], move: [], battle: [{ vizier: true }], build: [] }
    rigDice(s, 0, 0)
    s = act(s, 'eyrie', { type: 'decree-battle', column: 'battle', index: 0, clearing: 'E', defender: 'marquise' })
    expect(s.clearings.E.warriors.marquise).toBe(2)
  })

  it('Field Hospitals return removed warriors to the keep for a matching card (6.2.3)', () => {
    let s = arena(3, 3)
    giveHand(s, 'marquise', [cardId('Anvil')]) // fox card, E is fox
    rigDice(s, 2, 2)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.pending[0]).toMatchObject({ kind: 'field-hospitals', clearing: 'E', count: 2 })
    const keepBefore = s.clearings.A.warriors.marquise
    s = act(s, 'marquise', { type: 'field-hospitals', card: cardId('Anvil') })
    expect(s.clearings.A.warriors.marquise).toBe(keepBefore + 2)
    expect(s.hands.marquise).toEqual([])
  })
})
