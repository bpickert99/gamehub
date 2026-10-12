import { describe, expect, it } from 'vitest'
import { legalActions } from '../engine/legal'
import { applyAction, createGame } from '../engine/game'
import { at, cardId, giveHand, setUpGame } from '../engine/testHelpers'
import type { Action, GameState } from '../engine/types'
import { NONE, clickClearing, highlighted, verb, type Click, type Mode } from './flow'

const opts = (s: GameState) => legalActions(s).map((o) => o.action)
const label = (a: Action) => a.type

// Follow clicks the way the UI does; returns the action that would be sent.
function clicks(s: GameState, start: Mode, path: string[], count?: number): Action | Mode | null {
  let mode = start
  for (const c of path) {
    const r: Click | null = clickClearing(s, opts(s), mode, c as never, label)
    if (!r) return null
    if (r.kind === 'act') return r.action
    if (r.kind === 'mode') mode = r.mode
    if (r.kind === 'count') {
      const done = r.finish({ ...r.move, count: count ?? r.max })
      if (done.kind === 'act') return done.action
      if (done.kind === 'mode') mode = done.mode
    }
    if (r.kind === 'choose') return r.options[0].action
  }
  return mode
}

describe('Map click flow', () => {
  it('highlights the corners for the keep and places it on click', () => {
    const s = createGame(3)
    expect(highlighted(s, opts(s), NONE).sort()).toEqual(['A', 'F', 'J', 'L'])
    expect(clicks(s, NONE, ['A'])).toEqual({ type: 'setup-keep', clearing: 'A' })
  })

  it('places the three starting buildings with three clicks', () => {
    const s = applyAction(createGame(3), 'marquise', { type: 'setup-keep', clearing: 'A' })
    const start: Mode = { kind: 'setup-buildings', placed: [] }
    expect(highlighted(s, opts(s), start).sort()).toEqual(['A', 'B', 'C', 'D'])
    // A has one slot: after placing there it is no longer offered.
    const after: Mode = { kind: 'setup-buildings', placed: ['A'] }
    expect(highlighted(s, opts(s), after)).not.toContain('A')
    expect(clicks(s, start, ['A', 'B', 'C'])).toEqual({ type: 'setup-buildings', sawmill: 'A', workshop: 'B', recruiter: 'C' })
  })

  it('battles by choosing the verb then a highlighted clearing', () => {
    const s = at(setUpGame(), 'marquise', 'daylight')
    s.clearings.L.warriors.marquise = 1
    s.marquise.warriors -= 1
    expect(highlighted(s, opts(s), verb('battle'))).toEqual(['L'])
    expect(clicks(s, verb('battle'), ['L'])).toEqual({ type: 'battle', clearing: 'L', defender: 'eyrie' })
  })

  it('marches one move at a time: origin, destination and count, then the second move', () => {
    let s = at(setUpGame(), 'marquise', 'daylight')
    s.clearings.B.warriors.marquise = 3
    s.marquise.warriors -= 2
    const first = clicks(s, verb('march'), ['B', 'F'], 2)
    expect(first).toEqual({ type: 'march', move: { from: 'B', to: 'F', count: 2 } })
    // The first move goes to the table at once; the second is a prompt answered the same way.
    s = applyAction(s, 'marquise', first as Action)
    const second: Mode = { kind: 'prompt-move', from: null }
    expect(highlighted(s, opts(s), second)).toContain('F')
    expect(clicks(s, second, ['F', 'H'], 1)).toEqual({ type: 'march-move', move: { from: 'F', to: 'H', count: 1 } })
  })

  it('clicking the origin again cancels it', () => {
    const s = at(setUpGame(), 'marquise', 'daylight')
    expect(clicks(s, verb('march'), ['B', 'B'])).toMatchObject({ kind: 'verb', from: null })
  })

  it('offers a choice of buildings when several can be built in the clicked clearing', () => {
    const s = at(setUpGame(), 'marquise', 'daylight')
    const r = clickClearing(s, opts(s), verb('build'), 'B', label)
    expect(r?.kind).toBe('choose')
  })

  it('resolves an Eyrie Decree move from a matching clearing', () => {
    const s = at(setUpGame('despot'), 'eyrie', 'daylight')
    const mode: Mode = { kind: 'decree', column: 'move', index: 0, from: null }
    expect(highlighted(s, opts(s), mode)).toEqual(['L'])
    const a = clicks(s, mode, ['L', 'K'], 3)
    expect(a).toEqual({ type: 'decree-move', column: 'move', index: 0, move: { from: 'L', to: 'K', count: 3 } })
    expect(() => applyAction(s, 'eyrie', a as Action)).not.toThrow()
  })

  it('limits Overwork to sawmill clearings matching the chosen card', () => {
    const s = at(setUpGame(), 'marquise', 'daylight')
    giveHand(s, 'marquise', [cardId('Bake Sale'), cardId('Anvil')])
    expect(highlighted(s, opts(s), verb('overwork', cardId('Bake Sale')))).toEqual(['B'])
    expect(highlighted(s, opts(s), verb('overwork', cardId('Anvil')))).toEqual([])
  })
})
