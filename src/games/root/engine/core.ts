import { BASE_DECK, type Card } from '../data/baseDeck'
import { CLEARINGS, PATHS, type ClearingId } from '../data/autumnMap'
import type { CardSuit, ClearingSuit } from '../data/types'
import { RuleError, type CardId, type Faction, type GameState } from './types'

export const WIN_SCORE = 30
export const HAND_LIMIT = 5
export const CLEARING_IDS = Object.keys(CLEARINGS) as ClearingId[]

// ---------- errors ----------

export function fail(message: string): never {
  throw new RuleError(message)
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message)
}

// ---------- randomness (mulberry32, state kept in the game so games replay exactly) ----------

export function nextRandom(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function randomInt(s: GameState, n: number): number {
  return Math.floor(nextRandom(s) * n)
}

export function shuffle<T>(s: GameState, items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(s, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Battle dice are 12-sided with 0–3 three times each, so each value is equally likely.
export function rollDie(s: GameState): number {
  return randomInt(s, 4)
}

// ---------- log ----------

export function log(s: GameState, message: string): void {
  s.log.push(message)
}

export const FACTION_NAME: Record<Faction, string> = { marquise: 'Marquise de Cat', eyrie: 'Eyrie Dynasties' }

export function opponent(s: GameState, faction: Faction): Faction {
  return s.seating.find((f) => f !== faction)!
}

// ---------- cards ----------

export function card(id: CardId): Card {
  const c = BASE_DECK[id]
  check(c, `Unknown card ${id}`)
  return c
}

// Birds are wild (2.1.1): a bird card can be treated as any suit, but a bird requirement needs a bird.
export function cardMatches(id: CardId, suit: CardSuit): boolean {
  const c = card(id)
  return c.suit === suit || c.suit === 'bird'
}

export function takeFromHand(s: GameState, faction: Faction, id: CardId): void {
  const hand = s.hands[faction]
  const i = hand.indexOf(id)
  check(i >= 0, `That card is not in your hand.`)
  hand.splice(i, 1)
}

export function discardCard(s: GameState, id: CardId): void {
  s.discard.push(id)
}

export function spendFromHand(s: GameState, faction: Faction, id: CardId): void {
  takeFromHand(s, faction, id)
  discardCard(s, id)
}

// Draw from the shared deck; an empty deck is immediately refilled from the discard pile (2.1).
export function draw(s: GameState, faction: Faction, count: number): void {
  for (let i = 0; i < count; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) return
      s.deck = shuffle(s, s.discard)
      s.discard = []
      log(s, 'The discard pile is shuffled into a new deck.')
    }
    s.hands[faction].push(s.deck.pop()!)
  }
}

export function inPlayArea(s: GameState, faction: Faction, name: string): CardId | undefined {
  return s.playArea[faction].find((id) => card(id).name === name)
}

// ---------- scoring ----------

export function score(s: GameState, faction: Faction, points: number): void {
  if (points === 0 || s.winner) return
  // The score track starts at 0; losses stop there.
  s.score[faction] = Math.max(0, s.score[faction] + points)
  if (s.score[faction] >= WIN_SCORE) {
    s.winner = faction
    s.step = 'over'
    s.pending = []
    s.battle = null
    log(s, `${FACTION_NAME[faction]} reach ${WIN_SCORE} points and win the game!`)
  }
}

// ---------- map ----------

export function adjacent(a: ClearingId, b: ClearingId): boolean {
  return PATHS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export function neighbours(a: ClearingId): ClearingId[] {
  return PATHS.flatMap(([x, y]) => (x === a ? [y] : y === a ? [x] : []))
}

export function clearingSuit(c: ClearingId): ClearingSuit {
  return CLEARINGS[c].suit
}

export function openSlots(s: GameState, c: ClearingId): number {
  const cs = s.clearings[c]
  return CLEARINGS[c].slots - cs.ruins - cs.buildings.length
}

// Rule (2.5): most warriors + buildings; ties mean no one rules, except Lords of the Forest (7.2.2).
export function ruler(s: GameState, c: ClearingId): Faction | null {
  const cs = s.clearings[c]
  const presence = (f: Faction) => cs.warriors[f] + cs.buildings.filter((b) => b.faction === f).length
  const m = presence('marquise')
  const e = presence('eyrie')
  if (m > e) return 'marquise'
  if (e > m) return 'eyrie'
  return e > 0 || cs.tokens.some((t) => t.faction === 'eyrie') ? 'eyrie' : null
}

export function rules(s: GameState, faction: Faction, c: ClearingId): boolean {
  return ruler(s, c) === faction
}

export function hasPieces(s: GameState, faction: Faction, c: ClearingId): boolean {
  const cs = s.clearings[c]
  return cs.warriors[faction] > 0 || cs.buildings.some((b) => b.faction === faction) || cs.tokens.some((t) => t.faction === faction)
}

// Only the Marquise can place pieces in the keep's clearing (6.2.2).
export function canPlaceIn(s: GameState, faction: Faction, c: ClearingId): boolean {
  return faction === 'marquise' || s.marquise.keep !== c
}

export function supplyWarriors(s: GameState, faction: Faction): number {
  return faction === 'marquise' ? s.marquise.warriors : s.eyrie.warriors
}

// Place up to `count` warriors from supply; returns how many were placed (1.5.4).
export function placeWarriors(s: GameState, faction: Faction, c: ClearingId, count: number): number {
  const n = Math.min(count, supplyWarriors(s, faction))
  if (faction === 'marquise') s.marquise.warriors -= n
  else s.eyrie.warriors -= n
  s.clearings[c].warriors[faction] += n
  return n
}

// Move (4.2): any number (>0) of your warriors to an adjacent clearing, ruling origin or destination.
export function moveWarriors(s: GameState, faction: Faction, from: ClearingId, to: ClearingId, count: number): void {
  check(Number.isInteger(count) && count > 0, 'You must move at least one warrior (4.2).')
  check(adjacent(from, to), 'You can only move to an adjacent clearing (4.2).')
  check(s.clearings[from].warriors[faction] >= count, 'You do not have that many warriors there.')
  check(rules(s, faction, from) || rules(s, faction, to), 'You must rule the origin or destination clearing to move (4.2.1).')
  s.clearings[from].warriors[faction] -= count
  s.clearings[to].warriors[faction] += count
  log(s, `${FACTION_NAME[faction]} move ${count} warrior${count > 1 ? 's' : ''} from ${from} to ${to}.`)
}

export function canMoveFrom(s: GameState, faction: Faction, from: ClearingId): boolean {
  if (s.clearings[from].warriors[faction] === 0) return false
  return rules(s, faction, from) || neighbours(from).some((to) => rules(s, faction, to))
}
