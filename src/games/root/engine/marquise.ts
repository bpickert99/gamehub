import { CLEARINGS, DIAGONAL_CORNER, type ClearingId } from '../data/autumnMap'
import { MARQUISE, type MarquiseBuilding } from '../data/factions'
import {
  CLEARING_IDS, card, cardMatches, check, clearingSuit, log, moveWarriors, neighbours, openSlots, placeWarriors, rules,
  score, spendFromHand,
} from './core'
import { startBattle } from './battle'
import type { CardId, Faction, GameState, Move } from './types'

// ---------- setup (6.3) ----------

export function setupKeep(s: GameState, c: ClearingId): void {
  check(CLEARINGS[c].corner, 'The keep goes in a corner clearing (6.3.2).')
  s.marquise.keep = c
  s.clearings[c].tokens.push({ faction: 'marquise', kind: 'keep' })
  // Garrison: a warrior in every clearing except the diagonally opposite corner (6.3.3).
  for (const cl of CLEARING_IDS) if (cl !== DIAGONAL_CORNER[c]) placeWarriors(s, 'marquise', cl, 1)
  log(s, `Marquise de Cat place the keep in ${c} and garrison the Woodland.`)
}

export function setupBuildings(s: GameState, placement: Record<MarquiseBuilding, ClearingId>): void {
  const keep = s.marquise.keep!
  const allowed = [keep, ...neighbours(keep)]
  const perClearing: Partial<Record<ClearingId, number>> = {}
  for (const kind of ['sawmill', 'workshop', 'recruiter'] as MarquiseBuilding[]) {
    const c = placement[kind]
    check(allowed.includes(c), 'Starting buildings go in the keep clearing or adjacent clearings (6.3.4).')
    perClearing[c] = (perClearing[c] ?? 0) + 1
  }
  for (const [c, n] of Object.entries(perClearing) as [ClearingId, number][]) {
    check(openSlots(s, c) >= n, `Clearing ${c} does not have enough open building slots.`)
  }
  for (const kind of ['sawmill', 'workshop', 'recruiter'] as MarquiseBuilding[]) {
    s.clearings[placement[kind]].buildings.push({ faction: 'marquise', kind })
    s.marquise.track[kind] -= 1
  }
  log(s, 'Marquise de Cat place a sawmill, workshop, and recruiter.')
}

// ---------- Birdsong (6.4) ----------

export function sawmillClearings(s: GameState): ClearingId[] {
  return CLEARING_IDS.flatMap((c) => s.clearings[c].buildings.filter((b) => b.faction === 'marquise' && b.kind === 'sawmill').map(() => c))
}

export function placeWood(s: GameState, clearings: ClearingId[]): void {
  for (const c of clearings) {
    s.clearings[c].tokens.push({ faction: 'marquise', kind: 'wood' })
    s.marquise.wood -= 1
  }
  if (clearings.length) log(s, `Marquise de Cat place ${clearings.length} wood.`)
}

// When wood runs short, the Marquise chooses which sawmills get wood (1.5.4).
export function placeChosenWood(s: GameState, clearings: ClearingId[]): void {
  const available = sawmillClearings(s)
  check(clearings.length === Math.min(s.marquise.wood, available.length), `Place exactly ${Math.min(s.marquise.wood, available.length)} wood.`)
  for (const c of clearings) {
    const i = available.indexOf(c)
    check(i >= 0, `There is no unfilled sawmill in ${c}.`)
    available.splice(i, 1)
  }
  placeWood(s, clearings)
}

// ---------- Daylight (6.5) ----------

function useAction(s: GameState): void {
  check(s.turn.actionsLeft > 0, 'You have no actions left. Spend a bird card for another (6.5).')
  s.turn.actionsLeft -= 1
  s.turn.craftingOpen = false
}

export function battle(s: GameState, c: ClearingId, defender: Faction): void {
  useAction(s)
  startBattle(s, 'marquise', c, defender)
}

export function march(s: GameState, moves: Move[]): void {
  check(moves.length >= 1 && moves.length <= 2, 'March is up to two moves (6.5.2).')
  useAction(s)
  for (const m of moves) moveWarriors(s, 'marquise', m.from, m.to, m.count)
}

export function recruiterClearings(s: GameState): ClearingId[] {
  return CLEARING_IDS.flatMap((c) => s.clearings[c].buildings.filter((b) => b.faction === 'marquise' && b.kind === 'recruiter').map(() => c))
}

export function recruit(s: GameState, chosen?: ClearingId[]): void {
  check(!s.turn.recruited, 'You can recruit only once per turn (6.5.3).')
  const recruiters = recruiterClearings(s)
  check(recruiters.length > 0, 'You have no recruiters.')
  let targets = recruiters
  if (s.marquise.warriors < recruiters.length) {
    check(chosen && chosen.length === s.marquise.warriors, `You only have ${s.marquise.warriors} warriors: choose which recruiters get one.`)
    const left = [...recruiters]
    for (const c of chosen) {
      const i = left.indexOf(c)
      check(i >= 0, `There is no recruiter left to fill in ${c}.`)
      left.splice(i, 1)
    }
    targets = chosen
  }
  useAction(s)
  s.turn.recruited = true
  for (const c of targets) placeWarriors(s, 'marquise', c, 1)
  log(s, `Marquise de Cat recruit ${targets.length} warrior${targets.length === 1 ? '' : 's'}.`)
}

// Clearings connected to `c` through any number of clearings the Marquise rules (6.5.4.II).
export function connectedRuled(s: GameState, c: ClearingId): ClearingId[] {
  const seen = new Set<ClearingId>([c])
  const queue = [c]
  while (queue.length) {
    const cur = queue.shift()!
    for (const n of neighbours(cur)) {
      if (!seen.has(n) && rules(s, 'marquise', n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return [...seen]
}

export function buildCost(s: GameState, kind: MarquiseBuilding): { cost: number; vp: number } | null {
  const remaining = s.marquise.track[kind]
  if (remaining === 0) return null
  const index = MARQUISE.buildingsPerType - remaining
  return { cost: MARQUISE.buildCost[index], vp: MARQUISE.tracks[kind][index].vp }
}

export function build(s: GameState, c: ClearingId, kind: MarquiseBuilding, wood: Partial<Record<ClearingId, number>>): void {
  check(rules(s, 'marquise', c), 'You can only build in a clearing you rule (6.5.4.I).')
  check(openSlots(s, c) > 0, 'That clearing has no open building slot (2.2.3).')
  const price = buildCost(s, kind)
  check(price, `You have no ${kind}s left to build.`)
  const reachable = connectedRuled(s, c)
  let paid = 0
  for (const [from, n] of Object.entries(wood) as [ClearingId, number][]) {
    if (!n) continue
    check(reachable.includes(from), `Wood in ${from} is not connected to ${c} through clearings you rule (6.5.4.II).`)
    const there = s.clearings[from].tokens.filter((t) => t.kind === 'wood').length
    check(there >= n, `There is not enough wood in ${from}.`)
    paid += n
  }
  check(paid === price.cost, `Building that ${kind} costs exactly ${price.cost} wood.`)
  useAction(s)
  for (const [from, n] of Object.entries(wood) as [ClearingId, number][]) {
    for (let i = 0; i < (n ?? 0); i++) {
      const tokens = s.clearings[from].tokens
      tokens.splice(tokens.findIndex((t) => t.kind === 'wood'), 1)
      s.marquise.wood += 1
    }
  }
  s.clearings[c].buildings.push({ faction: 'marquise', kind })
  s.marquise.track[kind] -= 1
  log(s, `Marquise de Cat build a ${kind} in ${c} for ${price.cost} wood.`)
  score(s, 'marquise', price.vp)
}

export function overwork(s: GameState, id: CardId, c: ClearingId): void {
  check(sawmillClearings(s).includes(c), 'Overwork needs a sawmill in that clearing (6.5.5).')
  check(cardMatches(id, clearingSuit(c)), "The card must match the sawmill's clearing (6.5.5).")
  check(s.marquise.wood > 0, 'You have no wood left in your supply.')
  check(s.hands.marquise.includes(id), 'That card is not in your hand.')
  useAction(s)
  spendFromHand(s, 'marquise', id)
  placeWood(s, [c])
}

export function spendBird(s: GameState, id: CardId): void {
  check(card(id).suit === 'bird', 'Only bird cards give extra actions (6.5).')
  spendFromHand(s, 'marquise', id)
  s.turn.actionsLeft += 1
  log(s, 'Marquise de Cat spend a bird card for an extra action.')
}

// Field Hospitals (6.2.3): spend a card matching the clearing to place the removed warriors at the keep.
export function fieldHospitals(s: GameState, id: CardId, c: ClearingId, count: number): void {
  check(cardMatches(id, clearingSuit(c)), `The card must match clearing ${c} (6.2.3).`)
  spendFromHand(s, 'marquise', id)
  const placed = placeWarriors(s, 'marquise', s.marquise.keep!, count)
  log(s, `Field Hospitals: ${placed} warrior${placed === 1 ? '' : 's'} return to the keep.`)
}

// ---------- Evening (6.6) ----------

export function marquiseDraws(s: GameState): number {
  const uncovered = MARQUISE.buildingsPerType - s.marquise.track.recruiter
  return 1 + MARQUISE.tracks.recruiter.slice(0, uncovered).filter((sp) => sp.draw).length
}
