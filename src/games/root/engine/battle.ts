import type { ClearingId } from '../data/autumnMap'
import {
  FACTION_NAME, card, cardMatches, check, clearingSuit, discardCard, hasPieces, inPlayArea, log, rollDie, score, takeFromHand,
} from './core'
import { afterRemoval, planFromChoice, planHits, removePieces, type RemovalPlan } from './removal'
import type { CardId, Faction, GameState, PieceKind } from './types'

export function startBattle(s: GameState, attacker: Faction, c: ClearingId, defender: Faction): void {
  check(attacker !== defender, 'You cannot battle yourself.')
  check(s.clearings[c].warriors[attacker] > 0, 'You need warriors in the clearing to battle there (4.3).')
  check(hasPieces(s, defender, c), 'The defender has no pieces in that clearing (4.3).')
  s.battle = {
    attacker, defender, clearing: c, step: 'ambush', high: 0, low: 0,
    attackerExtra: 0, defenderExtra: 0, attackerIgnoresRolled: false, defenderIgnoresRolled: false,
    brutalTactics: false, effectsAsked: [], chosen: {},
  }
  log(s, `${FACTION_NAME[attacker]} attack ${FACTION_NAME[defender]} in ${c}.`)
}

function matchingAmbushes(s: GameState, faction: Faction, c: ClearingId): CardId[] {
  return s.hands[faction].filter((id) => card(id).kind === 'ambush' && cardMatches(id, clearingSuit(c)))
}

// Runs the battle forward until it ends or someone must decide. Called by the game loop.
export function battleStep(s: GameState): void {
  const b = s.battle!
  if (b.step === 'ambush') {
    b.step = 'roll'
    // Scouting Party: the attacker is not affected by ambush cards.
    const scouting = inPlayArea(s, b.attacker, 'Scouting Party') !== undefined
    if (!scouting && matchingAmbushes(s, b.defender, b.clearing).length > 0) {
      s.pending.push({ kind: 'ambush', faction: b.defender })
    }
    return
  }
  if (b.step === 'roll') {
    const a = rollDie(s)
    const d = rollDie(s)
    b.high = Math.max(a, d)
    b.low = Math.min(a, d)
    b.step = 'effects'
    log(s, `Dice: ${a} and ${d}. ${FACTION_NAME[b.attacker]} will deal ${b.high}, ${FACTION_NAME[b.defender]} ${b.low} (4.3.3).`)
    return
  }
  if (b.step === 'effects') {
    // After-roll effects; the attacker decides first (4.3.4).
    for (const f of [b.attacker, b.defender]) {
      if (b.effectsAsked.includes(f)) continue
      b.effectsAsked.push(f)
      if (battleEffectOptions(s, f).length > 0) {
        s.pending.push({ kind: 'battle-effects', faction: f })
        return
      }
    }
    b.step = 'deal'
    return
  }
  dealHits(s)
}

export type BattleEffect = 'armorers' | 'sappers' | 'brutalTactics'

export function battleEffectOptions(s: GameState, f: Faction): BattleEffect[] {
  const b = s.battle!
  const options: BattleEffect[] = []
  if (inPlayArea(s, f, 'Armorers') !== undefined) options.push('armorers')
  if (f === b.defender && inPlayArea(s, f, 'Sappers') !== undefined) options.push('sappers')
  if (f === b.attacker && inPlayArea(s, f, 'Brutal Tactics') !== undefined) options.push('brutalTactics')
  return options
}

export function useBattleEffects(s: GameState, f: Faction, use: Record<BattleEffect, boolean>): void {
  const b = s.battle!
  const options = battleEffectOptions(s, f)
  for (const effect of Object.keys(use) as BattleEffect[]) {
    check(!use[effect] || options.includes(effect), `You cannot use ${effect} in this battle.`)
  }
  if (use.armorers) {
    discardFromPlayArea(s, f, 'Armorers')
    if (f === b.attacker) b.attackerIgnoresRolled = true
    else b.defenderIgnoresRolled = true
    log(s, `${FACTION_NAME[f]} discard Armorers to ignore all rolled hits.`)
  }
  if (use.sappers) {
    discardFromPlayArea(s, f, 'Sappers')
    b.defenderExtra += 1
    log(s, `${FACTION_NAME[f]} discard Sappers to deal an extra hit.`)
  }
  if (use.brutalTactics) {
    b.attackerExtra += 1
    b.brutalTactics = true
    log(s, `${FACTION_NAME[f]} use Brutal Tactics: an extra hit, and ${FACTION_NAME[b.defender]} score one point.`)
    score(s, b.defender, 1)
  }
}

function discardFromPlayArea(s: GameState, f: Faction, name: string): void {
  const id = inPlayArea(s, f, name)!
  s.playArea[f].splice(s.playArea[f].indexOf(id), 1)
  discardCard(s, id)
}

// ---------- ambush (4.3.1) ----------

export function playAmbush(s: GameState, f: Faction, id: CardId): void {
  const b = s.battle!
  check(card(id).kind === 'ambush' && cardMatches(id, clearingSuit(b.clearing)), 'That ambush card does not match this clearing (2.1.2).')
  takeFromHand(s, f, id)
  b.ambush = id
  log(s, `${FACTION_NAME[f]} play an ambush card!`)
  if (matchingAmbushes(s, b.attacker, b.clearing).length > 0) {
    s.pending.unshift({ kind: 'foil', faction: b.attacker })
  } else {
    resolveAmbush(s)
  }
}

export function playFoil(s: GameState, f: Faction, id: CardId): void {
  const b = s.battle!
  check(card(id).kind === 'ambush' && cardMatches(id, clearingSuit(b.clearing)), 'That ambush card does not match this clearing (4.3.1.I).')
  takeFromHand(s, f, id)
  discardCard(s, id)
  discardCard(s, b.ambush!)
  b.ambush = undefined
  log(s, `${FACTION_NAME[f]} foil the ambush with their own ambush card.`)
}

// The defender deals two immediate hits; then the ambush card is discarded (4.3.1.II).
export function resolveAmbush(s: GameState): void {
  const b = s.battle!
  const plan = planHits(s, b.attacker, b.clearing, 2)
  if (!plan) {
    s.pending.unshift({ kind: 'removals', faction: b.attacker, clearing: b.clearing, hits: 2, context: 'ambush' })
    return
  }
  finishAmbush(s, plan)
}

export function finishAmbush(s: GameState, plan: RemovalPlan): void {
  const b = s.battle!
  const removed = removePieces(s, b.attacker, b.clearing, plan)
  discardCard(s, b.ambush!)
  b.ambush = undefined
  afterRemoval(s, b.defender, [removed], true)
  if (s.battle && s.clearings[b.clearing].warriors[b.attacker] === 0) {
    log(s, 'No attacking warriors remain, so the battle ends (4.3.1.II).')
    s.battle = null
  }
}

// ---------- counting and dealing hits (4.3.5, 4.3.6) ----------

export function battleHits(s: GameState): { byAttacker: number; byDefender: number } {
  const b = s.battle!
  const cs = s.clearings[b.clearing]
  // Rolled hits are limited by warriors in the clearing (4.3.3.I).
  const attackerRolled = Math.min(b.high, cs.warriors[b.attacker])
  const defenderRolled = Math.min(b.low, cs.warriors[b.defender])
  let byAttacker = (b.defenderIgnoresRolled ? 0 : attackerRolled) + b.attackerExtra
  const byDefender = (b.attackerIgnoresRolled ? 0 : defenderRolled) + b.defenderExtra
  // Defenseless (4.3.5.II).
  if (cs.warriors[b.defender] === 0) byAttacker += 1
  // Commander (7.8.3).
  if (b.attacker === 'eyrie' && s.eyrie.leader === 'commander') byAttacker += 1
  return { byAttacker, byDefender }
}

function dealHits(s: GameState): void {
  const b = s.battle!
  const { byAttacker, byDefender } = battleHits(s)
  const plans: Partial<Record<Faction, RemovalPlan>> = {}
  for (const [taker, hits] of [[b.defender, byAttacker], [b.attacker, byDefender]] as [Faction, number][]) {
    const chosen = b.chosen[taker]
    const plan = chosen ? planFromChoice(s, taker, b.clearing, hits, chosen) : planHits(s, taker, b.clearing, hits)
    if (!plan) {
      s.pending.push({ kind: 'removals', faction: taker, clearing: b.clearing, hits, context: 'battle' })
    } else {
      plans[taker] = plan
    }
  }
  if (s.pending.length > 0) return
  // Both sides' hits are removed together, then effects trigger (1.5.4).
  const onDefender = removePieces(s, b.defender, b.clearing, plans[b.defender]!)
  const onAttacker = removePieces(s, b.attacker, b.clearing, plans[b.attacker]!)
  s.battle = null
  afterRemoval(s, b.attacker, [onDefender], true)
  afterRemoval(s, b.defender, [onAttacker], true)
}

export function chooseRemovals(s: GameState, f: Faction, pieces: PieceKind[], prompt: { clearing: ClearingId; hits: number; context: 'ambush' | 'battle' }): void {
  const plan = planFromChoice(s, f, prompt.clearing, prompt.hits, pieces)
  if (prompt.context === 'ambush') finishAmbush(s, plan)
  else s.battle!.chosen[f] = pieces
}

