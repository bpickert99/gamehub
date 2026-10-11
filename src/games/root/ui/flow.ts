import type { ClearingId } from '../data/autumnMap'
import type { DecreeColumn, MarquiseBuilding } from '../data/factions'
import { moveWarriors, neighbours, openSlots } from '../engine/core'
import { decreeOptions, legalMoves } from '../engine/legal'
import type { Action, CardId, GameState, Move } from '../engine/types'

// What the player is in the middle of choosing. Everything else is derived from the engine's legal actions.
export type Verb = 'battle' | 'march' | 'recruit' | 'build' | 'overwork'

export type Mode =
  | { kind: 'none' }
  | { kind: 'verb'; verb: Verb; from: ClearingId | null; first: Move | null; card: CardId | null }
  | { kind: 'decree'; column: DecreeColumn; index: number; from: ClearingId | null }
  | { kind: 'cobbler'; from: ClearingId | null }
  | { kind: 'tax' }
  | { kind: 'setup-buildings'; placed: ClearingId[] }
  | { kind: 'decree-add'; staged: { card: CardId; column: DecreeColumn }[]; card: CardId | null }
  | { kind: 'cards'; cards: CardId[] }

export const NONE: Mode = { kind: 'none' }
export const verb = (v: Verb, card: CardId | null = null): Mode => ({ kind: 'verb', verb: v, from: null, first: null, card })

export const SETUP_ORDER: MarquiseBuilding[] = ['sawmill', 'workshop', 'recruiter']

// A choice the player makes on the map: highlighted clearings, and what clicking one does.
export type Click =
  | { kind: 'act'; action: Action }
  | { kind: 'mode'; mode: Mode }
  | { kind: 'choose'; options: { label: string; action: Action }[] }
  | { kind: 'count'; move: Move; max: number; finish: (m: Move) => Click }

export function moveOf(a: Action): Move | null {
  if (a.type === 'march') return a.moves[0]
  if (a.type === 'decree-move' || a.type === 'start-effect-move') return a.move
  return null
}

function clearingOf(a: Action): ClearingId | null {
  return 'clearing' in a ? a.clearing : null
}

// The legal actions the current mode is narrowing down.
export function candidates(state: GameState, options: Action[], mode: Mode): Action[] {
  switch (mode.kind) {
    case 'verb':
      switch (mode.verb) {
        case 'battle': return options.filter((a) => a.type === 'battle' || a.type === 'start-effect-battle')
        case 'march': return options.filter((a) => a.type === 'march')
        case 'recruit': return options.filter((a) => a.type === 'recruit')
        case 'build': return options.filter((a) => a.type === 'build')
        case 'overwork': return options.filter((a) => a.type === 'overwork' && (mode.card === null || a.card === mode.card))
      }
      break
    case 'decree':
      return decreeOptions(state, mode.column, mode.index)
    case 'cobbler':
      return options.filter((a) => a.type === 'start-effect-move')
    case 'tax':
      return options.filter((a) => a.type === 'tax-collector')
    case 'setup-buildings':
      return []
    default:
      return options.filter((a) => a.type === 'setup-keep' || a.type === 'new-roost')
  }
}

// Marquise March: the second move is computed after the first one is applied.
export function secondMoves(state: GameState, first: Move): Move[] {
  const draft = structuredClone(state)
  moveWarriors(draft, 'marquise', first.from, first.to, first.count)
  return legalMoves(draft, 'marquise')
}

function isMoveMode(mode: Mode): boolean {
  return (mode.kind === 'verb' && mode.verb === 'march') || (mode.kind === 'decree' && mode.column === 'move') || mode.kind === 'cobbler'
}

// The single moves on offer in a move mode (for a March's second move, the moves after the first).
export function availableMoves(state: GameState, options: Action[], mode: Mode): Move[] {
  if (mode.kind === 'verb' && mode.first) return secondMoves(state, mode.first)
  return candidates(state, options, mode).map(moveOf).filter((m): m is Move => m !== null)
}

function moveOrigin(mode: Mode): ClearingId | null {
  return mode.kind === 'verb' || mode.kind === 'decree' || mode.kind === 'cobbler' ? mode.from : null
}

function withFrom(mode: Mode, from: ClearingId | null): Mode {
  if (mode.kind === 'verb' || mode.kind === 'decree' || mode.kind === 'cobbler') return { ...mode, from }
  return mode
}

export function setupSpots(state: GameState, placed: ClearingId[]): ClearingId[] {
  const keep = state.marquise.keep!
  return [keep, ...neighbours(keep)].filter((c) => openSlots(state, c) - placed.filter((p) => p === c).length > 0)
}

export function highlighted(state: GameState, options: Action[], mode: Mode): ClearingId[] {
  if (mode.kind === 'setup-buildings') return setupSpots(state, mode.placed)
  if (isMoveMode(mode)) {
    const from = moveOrigin(mode)
    const moves = availableMoves(state, options, mode)
    return [...new Set(from ? moves.filter((m) => m.from === from).map((m) => m.to) : moves.map((m) => m.from))]
  }
  const out = new Set<ClearingId>()
  for (const a of candidates(state, options, mode)) {
    const c = clearingOf(a)
    if (c) out.add(c)
  }
  return [...out]
}

// What clicking a clearing does in the current mode.
export function clickClearing(state: GameState, options: Action[], mode: Mode, c: ClearingId, label: (a: Action) => string): Click | null {
  if (mode.kind === 'setup-buildings') {
    if (!setupSpots(state, mode.placed).includes(c)) return null
    const placed = [...mode.placed, c]
    if (placed.length < 3) return { kind: 'mode', mode: { kind: 'setup-buildings', placed } }
    return { kind: 'act', action: { type: 'setup-buildings', sawmill: placed[0], workshop: placed[1], recruiter: placed[2] } }
  }
  if (isMoveMode(mode)) return clickMove(state, options, mode, c)
  const here = candidates(state, options, mode).filter((a) => clearingOf(a) === c)
  if (here.length === 0) return null
  if (here.length === 1) return { kind: 'act', action: here[0] }
  return { kind: 'choose', options: here.map((a) => ({ label: label(a), action: a })) }
}

function clickMove(state: GameState, options: Action[], mode: Mode, c: ClearingId): Click | null {
  const moves = availableMoves(state, options, mode)
  const from = moveOrigin(mode)
  if (!from) return moves.some((m) => m.from === c) ? { kind: 'mode', mode: withFrom(mode, c) } : null
  // Clicking the origin again un-selects it.
  if (c === from) return { kind: 'mode', mode: withFrom(mode, null) }
  const max = Math.max(0, ...moves.filter((m) => m.from === from && m.to === c).map((m) => m.count))
  if (max === 0) return null
  const finish = (m: Move): Click => finishMove(state, mode, m)
  const move = { from, to: c, count: max }
  return max === 1 ? finish(move) : { kind: 'count', move, max, finish }
}

function finishMove(state: GameState, mode: Mode, m: Move): Click {
  if (mode.kind === 'decree') return { kind: 'act', action: { type: 'decree-move', column: mode.column, index: mode.index, move: m } }
  if (mode.kind === 'cobbler') return { kind: 'act', action: { type: 'start-effect-move', move: m } }
  if (mode.kind === 'verb' && mode.first) return { kind: 'act', action: { type: 'march', moves: [mode.first, m] } }
  // First move of a March: a second one may follow, or the player marches with just this one.
  if (secondMoves(state, m).length === 0) return { kind: 'act', action: { type: 'march', moves: [m] } }
  return { kind: 'mode', mode: { kind: 'verb', verb: 'march', from: null, first: m, card: null } }
}
