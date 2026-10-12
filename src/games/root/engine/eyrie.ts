import { DIAGONAL_CORNER, type ClearingId } from '../data/autumnMap'
import { EYRIE, type DecreeColumn, type EyrieLeader } from '../data/factions'
import type { CardSuit } from '../data/types'
import {
  CLEARING_IDS, card, canMoveFrom, canPlaceIn, check, clearingSuit, discardCard, emit, hasPieces, log, moveWarriors,
  openSlots, opponent, placeWarriors, rules, score, takeFromHand,
} from './core'
import { startBattle } from './battle'
import type { DecreeEntry, Faction, GameState, Move } from './types'

const LEADER_NAME: Record<EyrieLeader, string> = { builder: 'Builder', charismatic: 'Charismatic', commander: 'Commander', despot: 'Despot' }

// ---------- setup (7.3) ----------

export function setupEyrie(s: GameState): void {
  // With only the Marquise placed, the diagonally opposite corner is always available (7.3.2).
  const corner = DIAGONAL_CORNER[s.marquise.keep!]!
  placeRoost(s, corner)
  placeWarriors(s, 'eyrie', corner, 6)
  log(s, `Eyrie Dynasties land in ${corner} with a roost and 6 warriors.`)
}

export function chooseLeader(s: GameState, leader: EyrieLeader): void {
  check(s.eyrie.faceUpLeaders.includes(leader), 'That leader is not available (7.7.3).')
  s.eyrie.leader = leader
  s.eyrie.faceUpLeaders = s.eyrie.faceUpLeaders.filter((l) => l !== leader)
  const decree = emptyDecree()
  for (const column of EYRIE.leaders[leader].viziers) decree[column].push({ vizier: true })
  s.eyrie.decree = decree
  log(s, `Eyrie Dynasties are now led by the ${LEADER_NAME[leader]}.`)
}

export function emptyDecree(): Record<DecreeColumn, DecreeEntry[]> {
  return { recruit: [], move: [], battle: [], build: [] }
}

function placeRoost(s: GameState, c: ClearingId): void {
  s.clearings[c].buildings.push({ faction: 'eyrie', kind: 'roost' })
  s.eyrie.roostTrack -= 1
  emit(s, { type: 'build', faction: 'eyrie', clearing: c, kind: 'roost' })
}

export function roostsOnMap(s: GameState): ClearingId[] {
  return CLEARING_IDS.filter((c) => s.clearings[c].buildings.some((b) => b.faction === 'eyrie' && b.kind === 'roost'))
}

// ---------- Birdsong (7.4) ----------

export function addToDecree(s: GameState, entries: { card: number; column: DecreeColumn }[]): void {
  check(entries.length >= 1 && entries.length <= 2, 'Add one or two cards to the Decree (7.4.2).')
  check(entries.filter((e) => card(e.card).suit === 'bird').length <= 1, 'Only one card added may be a bird card (7.4.2).')
  check(new Set(entries.map((e) => e.card)).size === entries.length, 'Choose two different cards.')
  for (const e of entries) {
    check(EYRIE.decreeColumns.includes(e.column), 'Unknown Decree column.')
    takeFromHand(s, 'eyrie', e.card)
    s.eyrie.decree[e.column].push({ card: e.card })
  }
  log(s, `Eyrie Dynasties add ${entries.length} card${entries.length > 1 ? 's' : ''} to the Decree.`)
}

// A New Roost (7.4.3): the clearing(s) with the fewest warriors where a roost and warriors can be placed.
export function newRoostOptions(s: GameState): ClearingId[] {
  const candidates = CLEARING_IDS.filter((c) => openSlots(s, c) > 0 && canPlaceIn(s, 'eyrie', c))
  if (candidates.length === 0) return []
  const warriors = (c: ClearingId) => s.clearings[c].warriors.marquise + s.clearings[c].warriors.eyrie
  const fewest = Math.min(...candidates.map(warriors))
  return candidates.filter((c) => warriors(c) === fewest)
}

export function newRoost(s: GameState, c: ClearingId): void {
  check(newRoostOptions(s).includes(c), 'A new roost goes in a clearing with the fewest warriors (7.4.3).')
  placeRoost(s, c)
  placeWarriors(s, 'eyrie', c, 3)
  log(s, `Eyrie Dynasties place a new roost in ${c}.`)
}

// ---------- Daylight: resolving the Decree (7.5.2) ----------

export function entrySuit(entry: DecreeEntry): CardSuit {
  return 'vizier' in entry ? 'bird' : card(entry.card).suit
}

function matches(suit: CardSuit, c: ClearingId): boolean {
  return suit === 'bird' || clearingSuit(c) === suit
}

export function entryKey(column: DecreeColumn, index: number): string {
  return `${column}:${index}`
}

// The Decree resolves from the leftmost column to the right; within a column, in any order.
export function nextColumn(s: GameState): DecreeColumn | null {
  for (const column of EYRIE.decreeColumns) {
    if (s.eyrie.decree[column].some((_, i) => !s.turn.resolved.includes(entryKey(column, i)))) return column
  }
  return null
}

function takeEntry(s: GameState, column: DecreeColumn, index: number): CardSuit {
  check(nextColumn(s) === column, 'Resolve the Decree from left to right (7.5.2).')
  const entry = s.eyrie.decree[column][index]
  check(entry && !s.turn.resolved.includes(entryKey(column, index)), 'That Decree card is not waiting to be resolved.')
  s.turn.craftingOpen = false
  return entrySuit(entry)
}

function resolved(s: GameState, column: DecreeColumn, index: number): void {
  s.turn.resolved.push(entryKey(column, index))
}

export function decreeRecruit(s: GameState, column: DecreeColumn, index: number, c: ClearingId): void {
  check(column === 'recruit', 'That card is not in the Recruit column.')
  const suit = takeEntry(s, column, index)
  check(matches(suit, c), "The clearing must match the card's suit (7.5.2.I).")
  check(roostsOnMap(s).includes(c), 'Recruit in a clearing with a roost (7.5.2.I).')
  check(s.eyrie.warriors > 0, 'You have no warriors left to recruit.')
  const wanted = s.eyrie.leader === 'charismatic' ? 2 : 1
  const placed = placeWarriors(s, 'eyrie', c, wanted)
  resolved(s, column, index)
  log(s, `Eyrie Dynasties recruit ${placed} in ${c}.`)
  // Charismatic must place two; placing fewer means the action was not fully taken (1.5.4, 7.7).
  if (placed < wanted) turmoil(s)
}

export function decreeMove(s: GameState, column: DecreeColumn, index: number, m: Move): void {
  check(column === 'move', 'That card is not in the Move column.')
  const suit = takeEntry(s, column, index)
  check(matches(suit, m.from), "Move from a clearing matching the card's suit (7.5.2.II).")
  moveWarriors(s, 'eyrie', m.from, m.to, m.count)
  resolved(s, column, index)
}

export function decreeBattle(s: GameState, column: DecreeColumn, index: number, c: ClearingId, defender: Faction): void {
  check(column === 'battle', 'That card is not in the Battle column.')
  const suit = takeEntry(s, column, index)
  check(matches(suit, c), "Battle in a clearing matching the card's suit (7.5.2.III).")
  startBattle(s, 'eyrie', c, defender)
  resolved(s, column, index)
}

export function decreeBuild(s: GameState, column: DecreeColumn, index: number, c: ClearingId): void {
  check(column === 'build', 'That card is not in the Build column.')
  const suit = takeEntry(s, column, index)
  check(matches(suit, c), "Build in a clearing matching the card's suit (7.5.2.IV).")
  check(rules(s, 'eyrie', c), 'Build in a clearing you rule (7.5.2.IV).')
  check(!roostsOnMap(s).includes(c), 'That clearing already has a roost (7.5.2.IV).')
  check(openSlots(s, c) > 0, 'That clearing has no open building slot (2.2.3).')
  check(canPlaceIn(s, 'eyrie', c), 'Only the Marquise can place pieces in the keep clearing (6.2.2).')
  check(s.eyrie.roostTrack > 0, 'You have no roosts left.')
  placeRoost(s, c)
  resolved(s, column, index)
  log(s, `Eyrie Dynasties build a roost in ${c}.`)
}

// Whether a Decree card's action can be taken at all right now.
export function entryPossible(s: GameState, column: DecreeColumn, entry: DecreeEntry): boolean {
  const suit = entrySuit(entry)
  const clearings = CLEARING_IDS.filter((c) => matches(suit, c))
  const enemy = opponent(s, 'eyrie')
  switch (column) {
    case 'recruit':
      return s.eyrie.warriors > 0 && clearings.some((c) => roostsOnMap(s).includes(c))
    case 'move':
      return clearings.some((c) => canMoveFrom(s, 'eyrie', c))
    case 'battle':
      return clearings.some((c) => s.clearings[c].warriors.eyrie > 0 && hasPieces(s, enemy, c))
    case 'build':
      return s.eyrie.roostTrack > 0 && clearings.some((c) =>
        rules(s, 'eyrie', c) && !roostsOnMap(s).includes(c) && openSlots(s, c) > 0 && canPlaceIn(s, 'eyrie', c))
  }
}

export function declareTurmoil(s: GameState, column: DecreeColumn, index: number): void {
  check(nextColumn(s) === column, 'Resolve the Decree from left to right (7.5.2).')
  const entry = s.eyrie.decree[column][index]
  check(entry && !s.turn.resolved.includes(entryKey(column, index)), 'That Decree card is not waiting to be resolved.')
  check(!entryPossible(s, column, entry), 'You can still take that action, so you must (7.5.2).')
  turmoil(s)
}

// Turmoil (7.7): Humiliate, Purge, Depose, Rest.
function turmoil(s: GameState): void {
  const all = EYRIE.decreeColumns.flatMap((col) => s.eyrie.decree[col])
  const birds = all.filter((e) => entrySuit(e) === 'bird').length
  log(s, `Eyrie Dynasties fall into turmoil and lose ${birds} point${birds === 1 ? '' : 's'}.`)
  score(s, 'eyrie', -birds)
  for (const e of all) if ('card' in e) discardCard(s, e.card)
  s.eyrie.decree = emptyDecree()
  if (s.eyrie.faceUpLeaders.length === 0) s.eyrie.faceUpLeaders = ['builder', 'charismatic', 'commander', 'despot']
  s.eyrie.leader = null
  s.step = 'evening-start'
  s.pending.push({ kind: 'choose-leader', faction: 'eyrie' })
}

// ---------- Evening (7.6) ----------

export function roostPoints(s: GameState): number {
  const uncovered = EYRIE.roosts - s.eyrie.roostTrack
  return uncovered > 0 ? EYRIE.roostTrack[uncovered - 1].vp : 0
}

export function eyrieDraws(s: GameState): number {
  const uncovered = EYRIE.roosts - s.eyrie.roostTrack
  return 1 + EYRIE.roostTrack.slice(0, uncovered).filter((sp) => sp.draw).length
}

export function scoreRoosts(s: GameState): void {
  const points = roostPoints(s)
  log(s, `Eyrie Dynasties score ${points} for their roosts.`)
  score(s, 'eyrie', points)
}
