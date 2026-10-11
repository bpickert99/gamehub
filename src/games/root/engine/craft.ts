import type { ClearingId } from '../data/autumnMap'
import type { ClearingSuit, CostSuit } from '../data/types'
import {
  CLEARING_IDS, FACTION_NAME, card, check, clearingSuit, discardCard, draw, inPlayArea, log, opponent,
  randomInt, rules, score, takeFromHand,
} from './core'
import { afterRemoval, otherPieces, removePieces, type Removed } from './removal'
import type { CardId, Faction, GameState } from './types'

const SUITS: ClearingSuit[] = ['fox', 'mouse', 'rabbit']

// Crafting pieces: Marquise workshops (6.2.1), Eyrie roosts (7.2.1). One per building, suited by its clearing.
export function craftingPieces(s: GameState, f: Faction): Record<ClearingSuit, number> {
  const kind = f === 'marquise' ? 'workshop' : 'roost'
  const out: Record<ClearingSuit, number> = { fox: 0, mouse: 0, rabbit: 0 }
  for (const c of CLEARING_IDS) {
    out[clearingSuit(c)] += s.clearings[c].buildings.filter((b) => b.faction === f && b.kind === kind).length
  }
  return out
}

function unusedPieces(s: GameState, f: Faction): Record<ClearingSuit, number> {
  const pieces = craftingPieces(s, f)
  return { fox: pieces.fox - s.turn.craftingUsed.fox, mouse: pieces.mouse - s.turn.craftingUsed.mouse, rabbit: pieces.rabbit - s.turn.craftingUsed.rabbit }
}

// Assign crafting pieces to a cost. Specific suits first, then "any" takes whatever is left.
function payment(cost: CostSuit[], available: Record<ClearingSuit, number>): Record<ClearingSuit, number> | null {
  const left = { ...available }
  const used: Record<ClearingSuit, number> = { fox: 0, mouse: 0, rabbit: 0 }
  for (const suit of cost) {
    if (suit === 'any') continue
    if (left[suit] === 0) return null
    left[suit]--
    used[suit]++
  }
  for (const suit of cost) {
    if (suit !== 'any') continue
    const pick = SUITS.find((x) => left[x] > 0)
    if (!pick) return null
    left[pick]--
    used[pick]++
  }
  return used
}

export function canCraft(s: GameState, f: Faction, id: CardId): boolean {
  const c = card(id)
  if (c.kind === 'ambush' || c.kind === 'dominance') return false
  if (!s.hands[f].includes(id)) return false
  if (c.kind === 'item' && s.itemSupply[c.item] === 0) return false
  if (c.kind === 'persistent' && inPlayArea(s, f, c.name) !== undefined) return false
  return payment(c.cost, unusedPieces(s, f)) !== null
}

export function craft(s: GameState, f: Faction, id: CardId): void {
  check(s.turn.craftingOpen, 'You can only craft at the start of Daylight, before taking other actions.')
  const c = card(id)
  check(c.kind !== 'ambush', 'Ambush cards cannot be crafted (2.1.2).')
  check(c.kind !== 'dominance', 'Dominance cards cannot be crafted (2.1.3).')
  check(s.hands[f].includes(id), 'That card is not in your hand.')
  const paid = payment(c.cost, unusedPieces(s, f))
  check(paid, 'You do not have enough unused crafting pieces of the right suits (4.1.1).')
  if (c.kind === 'item') check(s.itemSupply[c.item] > 0, 'That item is not in the supply, so the card cannot be crafted (4.1.2).')
  if (c.kind === 'persistent') check(inPlayArea(s, f, c.name) === undefined, 'You already have that effect in your play area (4.1.4).')

  takeFromHand(s, f, id)
  for (const suit of SUITS) s.turn.craftingUsed[suit] += paid[suit]
  log(s, `${FACTION_NAME[f]} craft ${c.name}.`)

  if (c.kind === 'item') {
    s.itemSupply[c.item] -= 1
    s.crafted[f].push(c.item)
    discardCard(s, id)
    // Disdain for Trade (7.2.3): Eyrie score one point for items, unless led by the Builder (7.8.1).
    const disdain = f === 'eyrie' && s.eyrie.leader !== 'builder'
    score(s, f, disdain ? 1 : c.vp)
  } else if (c.kind === 'persistent') {
    s.playArea[f].push(id)
  } else {
    // Favor of the Foxes / Rabbits / Mice: remove all enemy pieces in clearings of that suit.
    const suit = c.suit as ClearingSuit
    const removed: Removed[] = []
    const enemy = opponent(s, f)
    for (const cl of CLEARING_IDS) {
      if (clearingSuit(cl) !== suit) continue
      const warriors = s.clearings[cl].warriors[enemy]
      const pieces = otherPieces(s, enemy, cl)
      if (warriors + pieces.length > 0) removed.push(removePieces(s, enemy, cl, { warriors, pieces }))
    }
    discardCard(s, id)
    afterRemoval(s, f, removed, false)
  }
}

// ---------- persistent card actions ----------

const BIRDSONG_STEPS = ['birdsong-wood', 'emergency-orders', 'add-to-decree', 'new-roost', 'birdsong']

function usePlayAreaCard(s: GameState, f: Faction, id: CardId, name: string): void {
  check(s.playArea[f].includes(id) && card(id).name === name, `${name} is not in your play area.`)
}

function onceThisTurn(s: GameState, id: CardId): void {
  check(!s.turn.usedEffects.includes(id), 'You already used that card this turn.')
  s.turn.usedEffects.push(id)
}

export function royalClaim(s: GameState, f: Faction, id: CardId): void {
  usePlayAreaCard(s, f, id, 'Royal Claim')
  check(BIRDSONG_STEPS.includes(s.step), 'Royal Claim can only be used in Birdsong.')
  s.playArea[f].splice(s.playArea[f].indexOf(id), 1)
  discardCard(s, id)
  const ruled = CLEARING_IDS.filter((c) => rules(s, f, c)).length
  log(s, `${FACTION_NAME[f]} discard Royal Claim and score ${ruled} for the clearings they rule.`)
  score(s, f, ruled)
}

export function standAndDeliver(s: GameState, f: Faction, id: CardId): void {
  usePlayAreaCard(s, f, id, 'Stand and Deliver!')
  check(BIRDSONG_STEPS.includes(s.step), 'Stand and Deliver! can only be used in Birdsong.')
  const target = opponent(s, f)
  check(s.hands[target].length > 0, 'The other player has no cards.')
  onceThisTurn(s, id)
  const taken = s.hands[target].splice(randomInt(s, s.hands[target].length), 1)[0]
  s.hands[f].push(taken)
  log(s, `${FACTION_NAME[f]} take a random card from ${FACTION_NAME[target]}, who score one point.`)
  score(s, target, 1)
}

export function taxCollector(s: GameState, f: Faction, id: CardId, c: ClearingId): void {
  usePlayAreaCard(s, f, id, 'Tax Collector')
  check(s.step === 'daylight', 'Tax Collector can only be used in Daylight.')
  check(s.clearings[c].warriors[f] > 0, 'You have no warriors there.')
  onceThisTurn(s, id)
  const removed = removePieces(s, f, c, { warriors: 1, pieces: [] })
  draw(s, f, 1)
  log(s, `${FACTION_NAME[f]} use Tax Collector to draw a card.`)
  afterRemoval(s, null, [removed], false)
}

export function codebreakers(s: GameState, f: Faction, id: CardId): void {
  usePlayAreaCard(s, f, id, 'Codebreakers')
  check(s.step === 'daylight', 'Codebreakers can only be used in Daylight.')
  onceThisTurn(s, id)
  s.turn.peek = [...s.hands[opponent(s, f)]]
  log(s, `${FACTION_NAME[f]} use Codebreakers to look at ${FACTION_NAME[opponent(s, f)]}'s hand.`)
}

// Better Burrow Bank (start of Birdsong): you and another player draw a card.
export function betterBurrowBank(s: GameState, f: Faction): void {
  if (inPlayArea(s, f, 'Better Burrow Bank') === undefined) return
  draw(s, f, 1)
  draw(s, opponent(s, f), 1)
  log(s, `Better Burrow Bank: ${FACTION_NAME[f]} and ${FACTION_NAME[opponent(s, f)]} each draw a card.`)
}

export function birdsongOptionsAvailable(s: GameState, f: Faction): boolean {
  const royal = inPlayArea(s, f, 'Royal Claim') !== undefined
  const sad = s.playArea[f].some((id) => card(id).name === 'Stand and Deliver!' && !s.turn.usedEffects.includes(id)) && s.hands[opponent(s, f)].length > 0
  return royal || sad
}
