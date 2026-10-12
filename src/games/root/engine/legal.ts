import type { ClearingId } from '../data/autumnMap'
import { EYRIE, type DecreeColumn, type EyrieLeader, type MarquiseBuilding } from '../data/factions'
import { battleEffectOptions } from './battle'
import { canCraft, birdsongOptionsAvailable } from './craft'
import {
  CLEARING_IDS, card, cardMatches, clearingSuit, hasPieces, neighbours, opponent, openSlots, rules,
} from './core'
import * as eyrie from './eyrie'
import * as marquise from './marquise'
import { otherPieces } from './removal'
import { actor } from './game'
import type { Action, Faction, GameState, Move, PieceKind } from './types'

// Every single-warrior-count move the faction could make (counts 1..n from each clearing).
export function legalMoves(s: GameState, f: Faction, from?: ClearingId[]): Move[] {
  const out: Move[] = []
  for (const a of from ?? CLEARING_IDS) {
    const n = s.clearings[a].warriors[f]
    if (n === 0) continue
    for (const b of neighbours(a)) {
      if (!rules(s, f, a) && !rules(s, f, b)) continue
      for (let count = 1; count <= n; count++) out.push({ from: a, to: b, count })
    }
  }
  return out
}

export function battleTargets(s: GameState, f: Faction, among?: ClearingId[]): ClearingId[] {
  const enemy = opponent(s, f)
  return (among ?? CLEARING_IDS).filter((c) => s.clearings[c].warriors[f] > 0 && hasPieces(s, enemy, c))
}

// Wood for a Marquise build: take it from the closest connected ruled clearings first.
export function woodPayment(s: GameState, c: ClearingId, cost: number): Partial<Record<ClearingId, number>> | null {
  const pay: Partial<Record<ClearingId, number>> = {}
  let left = cost
  for (const from of marquise.connectedRuled(s, c)) {
    if (left === 0) break
    const there = s.clearings[from].tokens.filter((t) => t.kind === 'wood').length
    const take = Math.min(there, left)
    if (take > 0) pay[from] = take
    left -= take
  }
  return left === 0 ? pay : null
}

export function buildOptions(s: GameState): { clearing: ClearingId; building: MarquiseBuilding; wood: Partial<Record<ClearingId, number>> }[] {
  const out = []
  for (const c of CLEARING_IDS) {
    if (!rules(s, 'marquise', c) || openSlots(s, c) === 0) continue
    for (const building of ['sawmill', 'workshop', 'recruiter'] as MarquiseBuilding[]) {
      const price = marquise.buildCost(s, building)
      if (!price) continue
      const wood = woodPayment(s, c, price.cost)
      if (wood) out.push({ clearing: c, building, wood })
    }
  }
  return out
}

function matchingClearings(suit: string): ClearingId[] {
  return CLEARING_IDS.filter((c) => suit === 'bird' || clearingSuit(c) === suit)
}

function subsets<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (items.length < size) return []
  const [first, ...rest] = items
  return [...subsets(rest, size - 1).map((x) => [first, ...x]), ...subsets(rest, size)]
}

// All legal actions for whoever must act now.
export function legalActions(s: GameState): { faction: Faction; action: Action }[] {
  const f = actor(s)
  if (!f) return []
  const out: Action[] = []
  const p = s.pending[0]
  if (p) {
    switch (p.kind) {
      case 'setup-keep':
        for (const c of ['A', 'F', 'J', 'L'] as ClearingId[]) out.push({ type: 'setup-keep', clearing: c })
        break
      case 'setup-buildings': {
        const keep = s.marquise.keep!
        const spots = [keep, ...neighbours(keep)]
        for (const sawmill of spots) for (const workshop of spots) for (const recruiter of spots) {
          const need: Partial<Record<ClearingId, number>> = {}
          for (const c of [sawmill, workshop, recruiter]) need[c] = (need[c] ?? 0) + 1
          if (Object.entries(need).every(([c, n]) => openSlots(s, c as ClearingId) >= n!)) out.push({ type: 'setup-buildings', sawmill, workshop, recruiter })
        }
        break
      }
      case 'setup-leader':
      case 'choose-leader':
        for (const leader of s.eyrie.faceUpLeaders as EyrieLeader[]) out.push({ type: 'choose-leader', leader })
        break
      case 'place-wood': {
        const mills = marquise.sawmillClearings(s)
        out.push({ type: 'place-wood', clearings: mills.slice(0, Math.min(s.marquise.wood, mills.length)) })
        break
      }
      case 'new-roost':
        for (const c of p.options) out.push({ type: 'new-roost', clearing: c })
        break
      case 'second-move':
        out.push({ type: 'skip' })
        for (const m of legalMoves(s, f)) out.push({ type: 'march-move', move: m })
        break
      case 'start-effect':
        out.push({ type: 'skip' })
        if (p.effect === 'command-warren') for (const c of battleTargets(s, f)) out.push({ type: 'start-effect-battle', clearing: c, defender: opponent(s, f) })
        else for (const m of legalMoves(s, f)) out.push({ type: 'start-effect-move', move: m })
        break
      case 'ambush':
      case 'foil': {
        out.push({ type: 'skip' })
        const b = s.battle!
        for (const id of s.hands[f]) {
          if (card(id).kind === 'ambush' && cardMatches(id, clearingSuit(b.clearing))) out.push({ type: p.kind, card: id })
        }
        break
      }
      case 'battle-effects': {
        out.push({ type: 'skip' })
        const opts = battleEffectOptions(s, f)
        for (const set of [1, 2, 3].flatMap((n) => subsets(opts, n))) {
          out.push({ type: 'battle-effects', armorers: set.includes('armorers'), sappers: set.includes('sappers'), brutalTactics: set.includes('brutalTactics') })
        }
        break
      }
      case 'removals': {
        const others = otherPieces(s, f, p.clearing)
        const rest = Math.min(p.hits - s.clearings[p.clearing].warriors[f], others.length)
        const seen = new Set<string>()
        for (const set of subsets(others, rest)) {
          const key = [...set].sort().join(',')
          if (!seen.has(key)) {
            seen.add(key)
            out.push({ type: 'removals', pieces: set as PieceKind[] })
          }
        }
        break
      }
      case 'field-hospitals':
        out.push({ type: 'skip' })
        for (const id of s.hands.marquise) if (cardMatches(id, clearingSuit(p.clearing))) out.push({ type: 'field-hospitals', card: id })
        break
      case 'discard':
        out.push({ type: 'discard', cards: s.hands[f].slice(0, p.count) })
        break
    }
    return out.map((action) => ({ faction: f, action }))
  }

  // Persistent card actions.
  for (const id of s.playArea[f]) {
    const name = card(id).name
    const birdsong = ['birdsong', 'add-to-decree'].includes(s.step)
    if (name === 'Royal Claim' && birdsong) out.push({ type: 'royal-claim', card: id })
    if (name === 'Stand and Deliver!' && birdsong && !s.turn.usedEffects.includes(id) && s.hands[opponent(s, f)].length > 0) out.push({ type: 'stand-and-deliver', card: id })
    if (name === 'Tax Collector' && s.step === 'daylight' && !s.turn.usedEffects.includes(id)) {
      for (const c of CLEARING_IDS) if (s.clearings[c].warriors[f] > 0) out.push({ type: 'tax-collector', card: id, clearing: c })
    }
    if (name === 'Codebreakers' && s.step === 'daylight' && !s.turn.usedEffects.includes(id)) out.push({ type: 'codebreakers', card: id })
  }

  if (s.step === 'birdsong' && birdsongOptionsAvailable(s, f)) out.push({ type: 'end-phase' })
  if (s.step === 'add-to-decree') {
    const hand = s.hands.eyrie
    for (const a of hand) for (const column of EYRIE.decreeColumns) out.push({ type: 'add-to-decree', entries: [{ card: a, column }] })
    for (const [a, b] of subsets(hand, 2)) {
      if (card(a).suit === 'bird' && card(b).suit === 'bird') continue
      out.push({ type: 'add-to-decree', entries: [{ card: a, column: 'move' }, { card: b, column: 'battle' }] })
    }
  }
  if (s.step === 'daylight') {
    if (s.turn.craftingOpen) for (const id of s.hands[f]) if (canCraft(s, f, id)) out.push({ type: 'craft', card: id })
    if (f === 'marquise') {
      if (s.turn.actionsLeft > 0) {
        for (const c of battleTargets(s, f)) out.push({ type: 'battle', clearing: c, defender: 'eyrie' })
        for (const m of legalMoves(s, f)) out.push({ type: 'march', move: m })
        if (!s.turn.recruited && marquise.recruiterClearings(s).length > 0 && s.marquise.warriors > 0) {
          const recruiters = marquise.recruiterClearings(s)
          out.push(s.marquise.warriors >= recruiters.length ? { type: 'recruit' } : { type: 'recruit', clearings: recruiters.slice(0, s.marquise.warriors) })
        }
        for (const b of buildOptions(s)) out.push({ type: 'build', ...b })
        if (s.marquise.wood > 0) {
          for (const c of new Set(marquise.sawmillClearings(s))) {
            for (const id of s.hands.marquise) if (cardMatches(id, clearingSuit(c))) out.push({ type: 'overwork', card: id, clearing: c })
          }
        }
      }
      for (const id of s.hands.marquise) if (card(id).suit === 'bird') out.push({ type: 'spend-bird', card: id })
      out.push({ type: 'end-phase' })
    } else {
      const column = eyrie.nextColumn(s)
      if (!column) out.push({ type: 'end-phase' })
      else {
        s.eyrie.decree[column].forEach((entry, index) => {
          if (s.turn.resolved.includes(eyrie.entryKey(column, index))) return
          const options = decreeOptions(s, column, index)
          if (options.length === 0 && !eyrie.entryPossible(s, column, entry)) out.push({ type: 'turmoil', column, index })
          out.push(...options)
        })
      }
    }
  }
  return out.map((action) => ({ faction: f, action }))
}

export function decreeOptions(s: GameState, column: DecreeColumn, index: number): Action[] {
  const suit = eyrie.entrySuit(s.eyrie.decree[column][index])
  const clearings = matchingClearings(suit)
  const out: Action[] = []
  switch (column) {
    case 'recruit':
      if (s.eyrie.warriors > 0) for (const c of clearings) if (eyrie.roostsOnMap(s).includes(c)) out.push({ type: 'decree-recruit', column, index, clearing: c })
      break
    case 'move':
      for (const m of legalMoves(s, 'eyrie', clearings)) out.push({ type: 'decree-move', column, index, move: m })
      break
    case 'battle':
      for (const c of battleTargets(s, 'eyrie', clearings)) out.push({ type: 'decree-battle', column, index, clearing: c, defender: 'marquise' })
      break
    case 'build':
      if (s.eyrie.roostTrack > 0) {
        for (const c of clearings) {
          if (rules(s, 'eyrie', c) && !eyrie.roostsOnMap(s).includes(c) && openSlots(s, c) > 0 && s.marquise.keep !== c) out.push({ type: 'decree-build', column, index, clearing: c })
        }
      }
      break
  }
  return out
}

