import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { act, at, cardId, clear, giveHand, setUpGame } from './testHelpers'

function wood(s: GameState, c: 'A' | 'B' | 'C' | 'D' | 'F' | 'L', n: number): void {
  for (let i = 0; i < n; i++) s.clearings[c].tokens.push({ faction: 'marquise', kind: 'wood' })
  s.marquise.wood -= n
}

function noWoodOnMap(s: GameState): void {
  for (const cs of Object.values(s.clearings)) {
    const w = cs.tokens.filter((t) => t.kind === 'wood').length
    cs.tokens = cs.tokens.filter((t) => t.kind !== 'wood')
    s.marquise.wood += w
  }
}

describe('Marquise de Cat (6)', () => {
  it('Birdsong places one wood per sawmill (6.4)', () => {
    let s = at(setUpGame(), 'eyrie', 'daylight')
    s.eyrie.decree = { recruit: [], move: [], battle: [], build: [] }
    noWoodOnMap(s)
    giveHand(s, 'marquise', [])
    s = act(s, 'eyrie', { type: 'end-phase' })
    expect(s.current).toBe('marquise')
    expect(s.clearings.B.tokens.filter((t) => t.kind === 'wood')).toHaveLength(1)
    expect(s.step).toBe('daylight')
  })

  it('Build pays the column cost in wood and scores the uncovered space (6.5.4)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    noWoodOnMap(s)
    wood(s, 'B', 1)
    s = act(s, 'marquise', { type: 'build', clearing: 'B', building: 'workshop', wood: { B: 1 } })
    expect(s.marquise.track.workshop).toBe(4)
    expect(s.score.marquise).toBe(2)
    expect(s.clearings.B.tokens.filter((t) => t.kind === 'wood')).toHaveLength(0)
  })

  it('Build can use wood connected through ruled clearings, but not beyond (6.5.4.II)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    noWoodOnMap(s)
    wood(s, 'A', 1)
    // A is connected to C through ruled clearings.
    s = act(s, 'marquise', { type: 'build', clearing: 'C', building: 'sawmill', wood: { A: 1 } })
    expect(s.score.marquise).toBe(1)
    const t = at(setUpGame(), 'marquise', 'daylight')
    noWoodOnMap(t)
    wood(t, 'L', 1)
    expect(() => act(t, 'marquise', { type: 'build', clearing: 'C', building: 'sawmill', wood: { L: 1 } })).toThrow(/connected/)
  })

  it('Build must pay the exact cost', () => {
    const s = at(setUpGame(), 'marquise', 'daylight')
    noWoodOnMap(s)
    wood(s, 'B', 2)
    expect(() => act(s, 'marquise', { type: 'build', clearing: 'B', building: 'workshop', wood: { B: 2 } })).toThrow(/exactly 1/)
  })

  it('Recruit places a warrior at each recruiter, once per turn (6.5.3)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    s = act(s, 'marquise', { type: 'recruit' })
    expect(s.clearings.C.warriors.marquise).toBe(2)
    expect(() => act(s, 'marquise', { type: 'recruit' })).toThrow(/once per turn/)
  })

  it('takes three actions, plus one per bird card spent (6.5)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    giveHand(s, 'marquise', [cardId('Armorers')])
    const move = { type: 'march' as const, moves: [{ from: 'B' as const, to: 'F' as const, count: 1 }, { from: 'F' as const, to: 'B' as const, count: 1 }] }
    s = act(s, 'marquise', move)
    s = act(s, 'marquise', move)
    s = act(s, 'marquise', move)
    expect(() => act(s, 'marquise', move)).toThrow(/no actions left/)
    s = act(s, 'marquise', { type: 'spend-bird', card: cardId('Armorers') })
    s = act(s, 'marquise', move)
    expect(s.turn.actionsLeft).toBe(0)
  })

  it('Overwork: spend a card matching a sawmill clearing for a wood (6.5.5)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    noWoodOnMap(s)
    giveHand(s, 'marquise', [cardId('Bake Sale'), cardId('Anvil')]) // B is a rabbit clearing
    expect(() => act(s, 'marquise', { type: 'overwork', card: cardId('Anvil'), clearing: 'B' })).toThrow(/match/)
    s = act(s, 'marquise', { type: 'overwork', card: cardId('Bake Sale'), clearing: 'B' })
    expect(s.clearings.B.tokens.filter((t) => t.kind === 'wood')).toHaveLength(1)
  })

  it('Evening draws one plus uncovered draw bonuses, then discards to five (6.6)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    s.marquise.track.recruiter = 3 // two more recruiters built: the +2 draw space is uncovered
    giveHand(s, 'marquise', [cardId('Anvil'), cardId('Sword'), cardId('Crossbow'), cardId('Bake Sale'), cardId('Cobbler')])
    s = act(s, 'marquise', { type: 'end-phase' })
    expect(s.hands.marquise).toHaveLength(7)
    expect(s.pending[0]).toMatchObject({ kind: 'discard', count: 2 })
    s = act(s, 'marquise', { type: 'discard', cards: [cardId('Anvil'), cardId('Sword')] })
    expect(s.hands.marquise).toHaveLength(5)
    expect(s.current).toBe('eyrie')
  })

  it('Only the Marquise can place pieces in the keep clearing (6.2.2)', () => {
    let s = at(setUpGame(), 'eyrie', 'daylight')
    clear(s, 'B')
    s.clearings.A.warriors = { marquise: 0, eyrie: 3 }
    s.clearings.A.buildings = [] // free A's only slot so only the keep stops the roost
    s.marquise.track.workshop += 1
    s.eyrie.decree = { recruit: [], move: [], battle: [], build: [{ vizier: true }] }
    expect(() => act(s, 'eyrie', { type: 'decree-build', column: 'build', index: 0, clearing: 'A' })).toThrow(/keep/)
    s = act(s, 'eyrie', { type: 'turmoil', column: 'build', index: 0 }) // no other clearing can take a roost
    expect(s.pending[0]).toMatchObject({ kind: 'choose-leader' })
  })
})

describe('Eyrie Dynasties (7)', () => {
  it('adds one or two cards to the Decree, at most one bird (7.4.2)', () => {
    const s = at(setUpGame(), 'eyrie', 'add-to-decree')
    giveHand(s, 'eyrie', [cardId('Armorers', 0), cardId('Armorers', 1), cardId('Anvil')])
    expect(() => act(s, 'eyrie', { type: 'add-to-decree', entries: [{ card: cardId('Armorers', 0), column: 'move' }, { card: cardId('Armorers', 1), column: 'battle' }] })).toThrow(/bird/)
    const t = act(s, 'eyrie', { type: 'add-to-decree', entries: [{ card: cardId('Armorers', 0), column: 'move' }, { card: cardId('Anvil'), column: 'recruit' }] })
    expect(t.eyrie.decree.recruit).toEqual([{ card: cardId('Anvil') }])
    expect(t.step).toBe('daylight')
  })

  it('Emergency Orders draw a card when the hand is empty (7.4.1)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    giveHand(s, 'eyrie', [])
    giveHand(s, 'marquise', [])
    s = act(s, 'marquise', { type: 'end-phase' })
    expect(s.current).toBe('eyrie')
    expect(s.step).toBe('add-to-decree')
    expect(s.hands.eyrie).toHaveLength(1)
  })

  it('places a new roost and three warriors when none are on the map (7.4.3)', () => {
    let s = at(setUpGame(), 'eyrie', 'add-to-decree')
    clear(s, 'L')
    giveHand(s, 'eyrie', [cardId('Anvil')])
    s = act(s, 'eyrie', { type: 'add-to-decree', entries: [{ card: cardId('Anvil'), column: 'recruit' }] })
    // L is now empty with 0 warriors: the only clearing with the fewest warriors and an open slot.
    expect(s.clearings.L.buildings).toEqual([{ faction: 'eyrie', kind: 'roost' }])
    expect(s.clearings.L.warriors.eyrie).toBe(3)
  })

  it('resolves the Decree from left to right (7.5.2)', () => {
    const s = at(setUpGame('despot'), 'eyrie', 'daylight')
    // Despot viziers: move and build. Build cannot go before move.
    expect(() => act(s, 'eyrie', { type: 'decree-build', column: 'build', index: 0, clearing: 'L' })).toThrow(/left to right/)
  })

  it('recruits in a matching clearing with a roost (7.5.2.I); Charismatic places two (7.8.2)', () => {
    let s = at(setUpGame('charismatic'), 'eyrie', 'daylight')
    s = act(s, 'eyrie', { type: 'decree-recruit', column: 'recruit', index: 0, clearing: 'L' })
    expect(s.clearings.L.warriors.eyrie).toBe(8)
  })

  it('cannot declare turmoil while the action is still possible', () => {
    const s = at(setUpGame('charismatic'), 'eyrie', 'daylight')
    expect(() => act(s, 'eyrie', { type: 'turmoil', column: 'recruit', index: 0 })).toThrow(/still take/)
  })

  it('Turmoil: lose a point per bird, purge, depose, and go to Evening (7.7)', () => {
    let s = at(setUpGame('despot'), 'eyrie', 'daylight')
    s.score.eyrie = 5
    s.eyrie.decree.recruit.push({ card: cardId('Anvil') }) // fox card: no roost in a fox clearing
    s = act(s, 'eyrie', { type: 'turmoil', column: 'recruit', index: 0 })
    expect(s.score.eyrie).toBe(3) // two viziers are birds
    expect(s.discard).toContain(cardId('Anvil'))
    expect(s.eyrie.faceUpLeaders).not.toContain('despot')
    s = act(s, 'eyrie', { type: 'choose-leader', leader: 'builder' })
    expect(s.eyrie.decree.recruit).toEqual([{ vizier: true }])
    expect(s.eyrie.decree.move).toEqual([{ vizier: true }])
    expect(s.current).toBe('marquise') // Evening ran and the turn passed
  })

  it('scores the rightmost empty Roosts space and draws its bonuses in Evening (7.6)', () => {
    let s = at(setUpGame(), 'eyrie', 'daylight')
    s.eyrie.decree = { recruit: [], move: [], battle: [], build: [] }
    s.eyrie.roostTrack = 4 // three roosts on the map
    giveHand(s, 'eyrie', [])
    s = act(s, 'eyrie', { type: 'end-phase' })
    expect(s.score.eyrie).toBe(2)
    expect(s.hands.eyrie.length).toBeGreaterThanOrEqual(2)
  })
})
