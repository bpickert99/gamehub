import type { ClearingId } from '../data/autumnMap'
import { BASE_DECK } from '../data/baseDeck'
import type { EyrieLeader } from '../data/factions'
import { rollDie } from './core'
import { applyAction, createGame } from './game'
import type { Action, CardId, Faction, GameState, Step } from './types'

// A game after standard setup: keep in A (so the Eyrie start in L), buildings in A/B/C, chosen leader.
export function setUpGame(leader: EyrieLeader = 'despot', seed = 1): GameState {
  let s = createGame(seed)
  s = applyAction(s, 'marquise', { type: 'setup-keep', clearing: 'A' })
  s = applyAction(s, 'marquise', { type: 'setup-buildings', sawmill: 'B', workshop: 'A', recruiter: 'C' })
  s = applyAction(s, 'eyrie', { type: 'choose-leader', leader })
  return s
}

// Put the game at a given step of a faction's turn, with nothing pending.
export function at(s: GameState, faction: Faction, step: Step): GameState {
  const t = structuredClone(s)
  t.current = faction
  t.step = step
  t.pending = []
  t.battle = null
  t.turn = { craftingUsed: { fox: 0, mouse: 0, rabbit: 0 }, craftingOpen: step === 'daylight', usedEffects: [], actionsLeft: faction === 'marquise' && step === 'daylight' ? 3 : 0, recruited: false, resolved: [], peek: null }
  return t
}

export function act(s: GameState, faction: Faction, action: Action): GameState {
  return applyAction(s, faction, action)
}

// Find a card id by name (the n-th copy).
export function cardId(name: string, n = 0): CardId {
  const ids = BASE_DECK.flatMap((c, i) => (c.name === name ? [i] : []))
  if (ids[n] === undefined) throw new Error(`No card ${name} #${n}`)
  return ids[n]
}

// Give a faction exactly these cards in hand (removing them from wherever they were).
export function giveHand(s: GameState, faction: Faction, cards: CardId[]): void {
  for (const f of ['marquise', 'eyrie'] as Faction[]) s.hands[f] = s.hands[f].filter((c) => !cards.includes(c))
  s.deck = s.deck.filter((c) => !cards.includes(c))
  s.discard = s.discard.filter((c) => !cards.includes(c))
  s.hands[faction] = [...cards]
}

export function givePlayArea(s: GameState, faction: Faction, cards: CardId[]): void {
  s.deck = s.deck.filter((c) => !cards.includes(c))
  s.playArea[faction].push(...cards)
}

// Set the RNG so the next two battle dice come up `a` then `b`.
export function rigDice(s: GameState, a: number, b: number): void {
  for (let seed = 0; seed < 100000; seed++) {
    const probe = { rng: seed } as GameState
    if (rollDie(probe) === a && rollDie(probe) === b) {
      s.rng = seed
      return
    }
  }
  throw new Error('No seed found')
}

// Empty a clearing of all pieces.
export function clear(s: GameState, c: ClearingId): void {
  const cs = s.clearings[c]
  s.marquise.warriors += cs.warriors.marquise
  s.eyrie.warriors += cs.warriors.eyrie
  cs.warriors = { marquise: 0, eyrie: 0 }
  for (const b of cs.buildings) {
    if (b.kind === 'roost') s.eyrie.roostTrack += 1
    else s.marquise.track[b.kind as 'sawmill' | 'workshop' | 'recruiter'] += 1
  }
  cs.buildings = []
  s.marquise.wood += cs.tokens.filter((t) => t.kind === 'wood').length
  if (cs.tokens.some((t) => t.kind === 'keep')) s.marquise.keep = null
  cs.tokens = []
}

