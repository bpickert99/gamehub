import { describe, expect, it } from 'vitest'
import { BASE_DECK } from '../data/baseDeck'
import { CLEARING_IDS } from './core'
import { applyAction, createGame } from './game'
import { setUpGame } from './testHelpers'

describe('Standard setup (5.1)', () => {
  it('removes the four dominance cards in a 2-player game and deals three cards each (5.1.3)', () => {
    const s = createGame(7)
    const all = [...s.deck, ...s.hands.marquise, ...s.hands.eyrie]
    expect(all).toHaveLength(50)
    expect(all.some((id) => BASE_DECK[id].kind === 'dominance')).toBe(false)
    expect(s.hands.marquise).toHaveLength(3)
    expect(s.hands.eyrie).toHaveLength(3)
  })

  it('places ruins in the four "R" slots (5.1.4) and forms the item supply (5.1.5)', () => {
    const s = createGame(7)
    expect(CLEARING_IDS.filter((c) => s.clearings[c].ruins > 0).sort()).toEqual(['D', 'E', 'G', 'H'])
    expect(Object.values(s.itemSupply).reduce((a, b) => a + b, 0)).toBe(12)
  })

  it('puts the keep in a corner only (6.3.2)', () => {
    const s = createGame(7)
    expect(() => applyAction(s, 'marquise', { type: 'setup-keep', clearing: 'E' })).toThrow(/corner/)
  })

  it('garrisons every clearing except the diagonally opposite corner (6.3.3)', () => {
    const s = applyAction(createGame(7), 'marquise', { type: 'setup-keep', clearing: 'A' })
    for (const c of CLEARING_IDS) expect(s.clearings[c].warriors.marquise).toBe(c === 'L' ? 0 : 1)
    expect(s.marquise.warriors).toBe(25 - 11)
  })

  it('places starting buildings only in the keep clearing or adjacent ones, within slots (6.3.4)', () => {
    const s = applyAction(createGame(7), 'marquise', { type: 'setup-keep', clearing: 'A' })
    expect(() => applyAction(s, 'marquise', { type: 'setup-buildings', sawmill: 'E', workshop: 'A', recruiter: 'C' })).toThrow(/adjacent/)
    // A has a single slot.
    expect(() => applyAction(s, 'marquise', { type: 'setup-buildings', sawmill: 'A', workshop: 'A', recruiter: 'C' })).toThrow(/slots/)
  })

  it('sets up the Eyrie diagonally opposite the keep with a roost and six warriors (7.3.2)', () => {
    const s = setUpGame('commander')
    expect(s.clearings.L.warriors.eyrie).toBe(6)
    expect(s.clearings.L.buildings).toEqual([{ faction: 'eyrie', kind: 'roost' }])
    expect(s.eyrie.roostTrack).toBe(6)
    expect(s.eyrie.warriors).toBe(14)
  })

  it('tucks the Loyal Viziers into the columns shown on the leader (7.3.4)', () => {
    const s = setUpGame('commander')
    expect(s.eyrie.decree.move).toEqual([{ vizier: true }])
    expect(s.eyrie.decree.battle).toEqual([{ vizier: true }])
    expect(s.eyrie.faceUpLeaders).not.toContain('commander')
  })

  it('leaves the leftmost space of each building track empty (6.3.5)', () => {
    const s = setUpGame()
    expect(s.marquise.track).toEqual({ sawmill: 5, workshop: 5, recruiter: 5 })
  })

  it('starts with the first player in their turn once setup is done', () => {
    const s = setUpGame()
    expect(s.pending).toEqual([])
    expect(s.current).toBe(s.seating[0])
  })
})
