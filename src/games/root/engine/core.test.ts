import { describe, expect, it } from 'vitest'
import { cardMatches, draw, ruler, score } from './core'
import { act, at, cardId, clear, setUpGame } from './testHelpers'

describe('Rule (2.5)', () => {
  it('goes to the faction with more warriors and buildings combined', () => {
    const s = setUpGame()
    expect(ruler(s, 'B')).toBe('marquise') // 1 warrior + sawmill
    expect(ruler(s, 'L')).toBe('eyrie')
  })

  it('ignores tokens', () => {
    const s = setUpGame()
    clear(s, 'E')
    s.clearings.E.tokens.push({ faction: 'marquise', kind: 'wood' })
    expect(ruler(s, 'E')).toBe(null)
  })

  it('gives ties to the Eyrie if they have a piece there: Lords of the Forest (7.2.2)', () => {
    const s = setUpGame()
    clear(s, 'E')
    s.clearings.E.warriors = { marquise: 2, eyrie: 2 }
    expect(ruler(s, 'E')).toBe('eyrie')
  })
})

describe('Birds are wild (2.1.1)', () => {
  it('lets a bird card match any suit, but not the other way round', () => {
    expect(cardMatches(cardId('Armorers'), 'fox')).toBe(true)
    expect(cardMatches(cardId('Anvil'), 'bird')).toBe(false)
  })
})

describe('Drawing (2.1)', () => {
  it('reshuffles the discard pile when the deck runs out', () => {
    const s = setUpGame()
    s.discard.push(...s.deck)
    s.deck = []
    const before = s.discard.length
    draw(s, 'eyrie', 2)
    expect(s.deck.length).toBe(before - 2)
    expect(s.discard).toEqual([])
  })
})

describe('Move (4.2)', () => {
  it('requires ruling the origin or the destination (4.2.1)', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    clear(s, 'H')
    clear(s, 'G')
    s.clearings.G.warriors = { marquise: 1, eyrie: 3 }
    // G is Eyrie-ruled and H is empty: no rule on either end.
    expect(() => act(s, 'marquise', { type: 'march', moves: [{ from: 'G', to: 'H', count: 1 }] })).toThrow(/rule/)
    s = act(s, 'marquise', { type: 'march', moves: [{ from: 'B', to: 'F', count: 1 }] })
    expect(s.clearings.F.warriors.marquise).toBe(2)
  })

  it('only follows paths to adjacent clearings', () => {
    const s = at(setUpGame(), 'marquise', 'daylight')
    expect(() => act(s, 'marquise', { type: 'march', moves: [{ from: 'A', to: 'L', count: 1 }] })).toThrow(/adjacent/)
  })
})

describe('Victory (3.1)', () => {
  it('ends the game as soon as a player reaches 30 points', () => {
    const s = setUpGame()
    score(s, 'eyrie', 30)
    expect(s.winner).toBe('eyrie')
    expect(s.step).toBe('over')
  })
})
