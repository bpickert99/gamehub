import type { ClearingId } from '../data/autumnMap'
import { FACTION_NAME, cardMatches, check, clearingSuit, log, score } from './core'
import type { Faction, GameState, PieceKind } from './types'

export type RemovalPlan = { warriors: number; pieces: PieceKind[] }

// The non-warrior pieces a faction has in a clearing, in a fixed order.
export function otherPieces(s: GameState, faction: Faction, c: ClearingId): PieceKind[] {
  const cs = s.clearings[c]
  return [
    ...cs.buildings.filter((b) => b.faction === faction).map((b) => b.kind),
    ...cs.tokens.filter((t) => t.faction === faction).map((t) => t.kind),
  ]
}

// Hits remove warriors first, then buildings and tokens chosen by the side taking hits (4.3.6).
// Returns null when the player has a real choice to make.
export function planHits(s: GameState, faction: Faction, c: ClearingId, hits: number): RemovalPlan | null {
  const warriors = Math.min(hits, s.clearings[c].warriors[faction])
  const rest = hits - warriors
  const others = otherPieces(s, faction, c)
  if (rest === 0) return { warriors, pieces: [] }
  if (rest >= others.length) return { warriors, pieces: others }
  if (new Set(others).size === 1) return { warriors, pieces: others.slice(0, rest) }
  return null
}

export function planFromChoice(s: GameState, faction: Faction, c: ClearingId, hits: number, chosen: PieceKind[]): RemovalPlan {
  const warriors = s.clearings[c].warriors[faction]
  check(warriors < hits, 'All warriors are removed before buildings or tokens (4.3.6).')
  const rest = Math.min(hits - warriors, otherPieces(s, faction, c).length)
  check(chosen.length === rest, `Choose exactly ${rest} piece${rest === 1 ? '' : 's'} to remove.`)
  const available = otherPieces(s, faction, c)
  for (const kind of chosen) {
    const i = available.indexOf(kind)
    check(i >= 0, `You have no ${kind} there to remove.`)
    available.splice(i, 1)
  }
  return { warriors, pieces: chosen }
}

export type Removed = { faction: Faction; clearing: ClearingId; warriors: number; buildingsAndTokens: number; pieces: PieceKind[] }

// Take pieces off the map (G.24): warriors to supply, buildings back to the rightmost empty track space,
// wood to supply, and the keep is gone for good.
export function removePieces(s: GameState, faction: Faction, c: ClearingId, plan: RemovalPlan): Removed {
  const cs = s.clearings[c]
  cs.warriors[faction] -= plan.warriors
  if (faction === 'marquise') s.marquise.warriors += plan.warriors
  else s.eyrie.warriors += plan.warriors
  for (const kind of plan.pieces) {
    if (kind === 'wood' || kind === 'keep') {
      const i = cs.tokens.findIndex((t) => t.faction === faction && t.kind === kind)
      cs.tokens.splice(i, 1)
      if (kind === 'wood') s.marquise.wood += 1
      else s.marquise.keep = null
    } else {
      const i = cs.buildings.findIndex((b) => b.faction === faction && b.kind === kind)
      cs.buildings.splice(i, 1)
      if (kind === 'roost') s.eyrie.roostTrack += 1
      else s.marquise.track[kind] += 1
    }
  }
  if (plan.warriors + plan.pieces.length > 0) {
    log(s, `${FACTION_NAME[faction]} lose ${describe(plan)} in ${c}.`)
  }
  return { faction, clearing: c, warriors: plan.warriors, buildingsAndTokens: plan.pieces.length, pieces: plan.pieces }
}

function describe(plan: RemovalPlan): string {
  const parts: string[] = []
  if (plan.warriors) parts.push(`${plan.warriors} warrior${plan.warriors > 1 ? 's' : ''}`)
  parts.push(...plan.pieces)
  return parts.join(', ')
}

// After simultaneous removals: score buildings/tokens (3.2.1) and trigger Field Hospitals (6.2.3).
// `remover` is the faction that removed the pieces, or null if a player removed their own.
export function afterRemoval(s: GameState, remover: Faction | null, removed: Removed[], inBattle: boolean): void {
  if (remover) {
    const points = removed.filter((r) => r.faction !== remover).reduce((n, r) => n + r.buildingsAndTokens, 0)
    score(s, remover, points)
    // Despot (7.8.4): one extra point when removing at least one enemy building or token in battle.
    if (inBattle && points > 0 && remover === 'eyrie' && s.eyrie.leader === 'despot') score(s, 'eyrie', 1)
  }
  if (s.winner) return
  for (const r of removed) {
    const hasMatch = s.hands.marquise.some((id) => cardMatches(id, clearingSuit(r.clearing)))
    if (r.faction === 'marquise' && r.warriors > 0 && s.marquise.keep && hasMatch) {
      s.pending.push({ kind: 'field-hospitals', faction: 'marquise', clearing: r.clearing, count: r.warriors })
    }
  }
}
