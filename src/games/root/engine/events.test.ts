import { describe, expect, it } from 'vitest'
import { act, at, cardId, clear, giveHand, rigDice, setUpGame } from './testHelpers'

describe('Events for the table to animate', () => {
  it('a march records its moves in order, and only this action\'s events', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    s.events = [{ type: 'turn', faction: 'eyrie' }]
    s = act(s, 'marquise', { type: 'march', moves: [{ from: 'B', to: 'F', count: 1 }, { from: 'F', to: 'H', count: 2 }] })
    expect(s.events).toEqual([
      { type: 'move', faction: 'marquise', from: 'B', to: 'F', count: 1 },
      { type: 'move', faction: 'marquise', from: 'F', to: 'H', count: 2 },
    ])
  })

  it('a battle records its start, the dice, and the removals', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    clear(s, 'E')
    s.clearings.E.warriors = { marquise: 3, eyrie: 2 }
    s.marquise.warriors -= 3
    s.eyrie.warriors -= 2
    giveHand(s, 'eyrie', [])
    rigDice(s, 2, 1)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.events.map((e) => e.type)).toEqual(['battle', 'roll', 'remove', 'remove'])
    expect(s.events[1]).toMatchObject({ type: 'roll', dice: [2, 1], high: 2, low: 1, hits: { attacker: 2, defender: 1 } })
    expect(s.events[2]).toMatchObject({ type: 'remove', faction: 'eyrie', clearing: 'E', warriors: 2 })
  })

  it('the roll reports rolled hits limited by each side\'s warriors (4.3.3.I)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    clear(s, 'E')
    s.clearings.E.warriors = { marquise: 1, eyrie: 2 }
    s.marquise.warriors -= 1
    s.eyrie.warriors -= 2
    giveHand(s, 'eyrie', [])
    rigDice(s, 3, 2)
    s = act(s, 'marquise', { type: 'battle', clearing: 'E', defender: 'eyrie' })
    expect(s.events[1]).toMatchObject({ type: 'roll', high: 3, low: 2, hits: { attacker: 1, defender: 2 } })
  })

  it('building records the building and the points scored', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    s.clearings.B.tokens.push({ faction: 'marquise', kind: 'wood' })
    s.marquise.wood -= 1
    s = act(s, 'marquise', { type: 'build', clearing: 'B', building: 'workshop', wood: { B: 1 } })
    expect(s.events).toEqual([
      { type: 'build', faction: 'marquise', clearing: 'B', kind: 'workshop' },
      { type: 'score', faction: 'marquise', points: 2 },
    ])
  })

  it('crafting records the card', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    giveHand(s, 'marquise', [cardId('Anvil')])
    s = act(s, 'marquise', { type: 'craft', card: cardId('Anvil') })
    expect(s.events[0]).toEqual({ type: 'craft', faction: 'marquise', card: cardId('Anvil') })
  })
})
