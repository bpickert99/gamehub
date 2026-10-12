import { describe, expect, it } from 'vitest'
import { CLEARING_IDS, ruler } from './core'
import type { GameState } from './types'
import { act, at, cardId, clear, giveHand, givePlayArea, setUpGame } from './testHelpers'

function marquiseDaylight(): GameState {
  return at(setUpGame(), 'marquise', 'daylight')
}

describe('Crafting (4.1)', () => {
  it('activates workshops matching the cost and takes the item for its points (4.1.1, 4.1.2)', () => {
    let s = marquiseDaylight()
    giveHand(s, 'marquise', [cardId('Anvil')]) // cost: fox; workshop is in A (fox)
    s = act(s, 'marquise', { type: 'craft', card: cardId('Anvil') })
    expect(s.crafted.marquise).toEqual(['hammer'])
    expect(s.itemSupply.hammer).toBe(0)
    expect(s.score.marquise).toBe(2)
  })

  it('activates each crafting piece only once per turn (4.1.1)', () => {
    let s = marquiseDaylight()
    giveHand(s, 'marquise', [cardId('Anvil'), cardId('Crossbow')])
    s = act(s, 'marquise', { type: 'craft', card: cardId('Anvil') })
    expect(() => act(s, 'marquise', { type: 'craft', card: cardId('Crossbow') })).toThrow(/crafting pieces/)
  })

  it('needs crafting pieces of the right suit', () => {
    const s = marquiseDaylight()
    giveHand(s, 'marquise', [cardId('Root Tea')]) // cost: mouse
    expect(() => act(s, 'marquise', { type: 'craft', card: cardId('Root Tea') })).toThrow(/crafting pieces/)
  })

  it('cannot craft an item missing from the supply (4.1.2)', () => {
    const s = marquiseDaylight()
    s.itemSupply.hammer = 0
    giveHand(s, 'marquise', [cardId('Anvil')])
    expect(() => act(s, 'marquise', { type: 'craft', card: cardId('Anvil') })).toThrow(/supply/)
  })

  it('cannot craft ambush cards (2.1.2)', () => {
    const s = marquiseDaylight()
    giveHand(s, 'marquise', [cardId('Ambush!', 2)])
    expect(() => act(s, 'marquise', { type: 'craft', card: cardId('Ambush!', 2) })).toThrow(/Ambush/)
  })

  it('puts persistent effects in the play area, without duplicates (4.1.3, 4.1.4)', () => {
    let s = marquiseDaylight()
    giveHand(s, 'marquise', [cardId('Armorers', 0), cardId('Armorers', 1)])
    s = act(s, 'marquise', { type: 'craft', card: cardId('Armorers', 0) })
    expect(s.playArea.marquise).toEqual([cardId('Armorers', 0)])
    s.turn.craftingUsed.fox = 0
    expect(() => act(s, 'marquise', { type: 'craft', card: cardId('Armorers', 1) })).toThrow(/already/)
  })

  it('closes crafting once the Marquise takes an action (6.5)', () => {
    let s = marquiseDaylight()
    giveHand(s, 'marquise', [cardId('Anvil')])
    s = act(s, 'marquise', { type: 'march', move: { from: 'B', to: 'F', count: 1 } })
    s = act(s, 'marquise', { type: 'skip' }) // no second move
    expect(() => act(s, 'marquise', { type: 'craft', card: cardId('Anvil') })).toThrow(/start of Daylight/)
  })

  it('Eyrie score only one point for items: Disdain for Trade (7.2.3)', () => {
    let s = at(setUpGame('despot'), 'eyrie', 'daylight')
    s.clearings.D.buildings.push({ faction: 'eyrie', kind: 'roost' })
    s.eyrie.roostTrack -= 1
    giveHand(s, 'eyrie', [cardId('Bake Sale')]) // cost rabbit rabbit, +3
    s = act(s, 'eyrie', { type: 'craft', card: cardId('Bake Sale') })
    expect(s.score.eyrie).toBe(1)
  })

  it('the Builder ignores Disdain for Trade (7.8.1)', () => {
    let s = at(setUpGame('builder'), 'eyrie', 'daylight')
    s.clearings.D.buildings.push({ faction: 'eyrie', kind: 'roost' })
    s.eyrie.roostTrack -= 1
    giveHand(s, 'eyrie', [cardId('Bake Sale')])
    s = act(s, 'eyrie', { type: 'craft', card: cardId('Bake Sale') })
    expect(s.score.eyrie).toBe(3)
  })

  it('Favor of the Foxes removes all enemy pieces in fox clearings and scores them', () => {
    let s = marquiseDaylight()
    for (const c of ['E', 'H', 'I'] as const) {
      clear(s, c)
      s.clearings[c].buildings.push({ faction: 'marquise', kind: 'workshop' })
      s.marquise.track.workshop -= 1
    }
    s.turn.craftingUsed.fox = 1 // A's workshop is already used
    s.clearings.E.warriors.eyrie = 2
    s.clearings.H.buildings.push({ faction: 'eyrie', kind: 'roost' })
    s.eyrie.roostTrack -= 1
    giveHand(s, 'marquise', [cardId('Favor of the Foxes')])
    s = act(s, 'marquise', { type: 'craft', card: cardId('Favor of the Foxes') })
    expect(s.clearings.E.warriors.eyrie).toBe(0)
    expect(s.clearings.H.buildings.filter((b) => b.faction === 'eyrie')).toEqual([])
    expect(s.score.marquise).toBe(1)
    expect(s.discard).toContain(cardId('Favor of the Foxes'))
  })
})

describe('Persistent card effects', () => {
  it('Royal Claim: discard in Birdsong to score per ruled clearing', () => {
    let s = at(setUpGame(), 'marquise', 'birdsong')
    givePlayArea(s, 'marquise', [cardId('Royal Claim')])
    const ruled = CLEARING_IDS.filter((c) => ruler(s, c) === 'marquise').length
    s = act(s, 'marquise', { type: 'royal-claim', card: cardId('Royal Claim') })
    expect(s.score.marquise).toBe(ruled)
    expect(s.playArea.marquise).toEqual([])
  })

  it('Stand and Deliver!: take a random card in Birdsong; that player scores a point', () => {
    let s = at(setUpGame(), 'marquise', 'birdsong')
    givePlayArea(s, 'marquise', [cardId('Stand and Deliver!')])
    giveHand(s, 'marquise', [])
    giveHand(s, 'eyrie', [cardId('Anvil')])
    s = act(s, 'marquise', { type: 'stand-and-deliver', card: cardId('Stand and Deliver!') })
    expect(s.hands.marquise).toEqual([cardId('Anvil')])
    expect(s.score.eyrie).toBe(1)
  })

  it('Tax Collector: once in Daylight, remove one of your warriors to draw a card', () => {
    let s = marquiseDaylight()
    givePlayArea(s, 'marquise', [cardId('Tax Collector')])
    giveHand(s, 'marquise', [])
    s = act(s, 'marquise', { type: 'tax-collector', card: cardId('Tax Collector'), clearing: 'D' })
    expect(s.clearings.D.warriors.marquise).toBe(0)
    expect(s.hands.marquise).toHaveLength(1)
    // The drawn card may match D, which offers Field Hospitals for the removed warrior (6.2.3).
    if (s.pending[0]?.kind === 'field-hospitals') s = act(s, 'marquise', { type: 'skip' })
    expect(() => act(s, 'marquise', { type: 'tax-collector', card: cardId('Tax Collector'), clearing: 'E' })).toThrow(/already/)
  })

  it('Codebreakers: look at the other hand once in Daylight', () => {
    let s = marquiseDaylight()
    givePlayArea(s, 'marquise', [cardId('Codebreakers')])
    giveHand(s, 'eyrie', [cardId('Anvil')])
    s = act(s, 'marquise', { type: 'codebreakers', card: cardId('Codebreakers') })
    expect(s.turn.peek).toEqual([cardId('Anvil')])
  })

  it('Better Burrow Bank: at start of Birdsong, you and another player draw', () => {
    let s = at(setUpGame(), 'eyrie', 'daylight')
    s.eyrie.decree = { recruit: [], move: [], battle: [], build: [] }
    givePlayArea(s, 'marquise', [cardId('Better Burrow Bank')])
    giveHand(s, 'marquise', [])
    giveHand(s, 'eyrie', [])
    s = act(s, 'eyrie', { type: 'end-phase' })
    // Eyrie draw 1 in Evening, then the Marquise's Birdsong starts with Better Burrow Bank.
    expect(s.current).toBe('marquise')
    expect(s.hands.marquise).toHaveLength(1)
    expect(s.hands.eyrie).toHaveLength(2)
  })

  it('Command Warren: may battle at the start of Daylight', () => {
    let s = at(setUpGame(), 'marquise', 'daylight-start')
    givePlayArea(s, 'marquise', [cardId('Command Warren')])
    s = act(at(s, 'marquise', 'birdsong'), 'marquise', { type: 'end-phase' })
    expect(s.pending[0]).toMatchObject({ kind: 'start-effect', effect: 'command-warren' })
    s = act(s, 'marquise', { type: 'skip' })
    expect(s.step).toBe('daylight')
    expect(s.turn.actionsLeft).toBe(3)
  })
})
