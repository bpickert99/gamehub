import { BASE_DECK, ITEM_SUPPLY } from '../data/baseDeck'
import { CLEARINGS, type ClearingId } from '../data/autumnMap'
import { EYRIE, MARQUISE } from '../data/factions'
import {
  CLEARING_IDS, FACTION_NAME, HAND_LIMIT, check, discardCard, draw, fail, inPlayArea, log, moveWarriors, shuffle,
  takeFromHand,
} from './core'
import { battleStep, chooseRemovals, playAmbush, playFoil, resolveAmbush, startBattle, useBattleEffects } from './battle'
import { betterBurrowBank, birdsongOptionsAvailable, codebreakers, craft, royalClaim, standAndDeliver, taxCollector } from './craft'
import * as marquise from './marquise'
import * as eyrie from './eyrie'
import type { Action, ClearingState, Faction, GameState, Prompt, TurnState } from './types'

function freshTurn(): TurnState {
  return { craftingUsed: { fox: 0, mouse: 0, rabbit: 0 }, craftingOpen: false, usedEffects: [], actionsLeft: 0, recruited: false, resolved: [], peek: null }
}

// Standard setup (5.1) for a 2-player game: Marquise de Cat vs Eyrie Dynasties.
export function createGame(seed: number): GameState {
  const clearings = {} as Record<ClearingId, ClearingState>
  for (const c of CLEARING_IDS) {
    clearings[c] = { warriors: { marquise: 0, eyrie: 0 }, buildings: [], tokens: [], ruins: CLEARINGS[c].ruins }
  }
  const s: GameState = {
    rng: seed >>> 0,
    seating: ['marquise', 'eyrie'],
    current: 'marquise',
    step: 'setup',
    turn: freshTurn(),
    deck: [],
    discard: [],
    hands: { marquise: [], eyrie: [] },
    playArea: { marquise: [], eyrie: [] },
    crafted: { marquise: [], eyrie: [] },
    itemSupply: { ...ITEM_SUPPLY },
    score: { marquise: 0, eyrie: 0 },
    clearings,
    marquise: { warriors: MARQUISE.warriors, wood: MARQUISE.wood, track: { sawmill: 6, workshop: 6, recruiter: 6 }, keep: null },
    eyrie: { warriors: EYRIE.warriors, roostTrack: EYRIE.roosts, leader: null, faceUpLeaders: ['builder', 'charismatic', 'commander', 'despot'], decree: eyrie.emptyDecree() },
    pending: [{ kind: 'setup-keep', faction: 'marquise' }],
    battle: null,
    winner: null,
    log: [],
  }
  // Random starting player and seating (5.1.1).
  s.seating = shuffle(s, s.seating)
  s.current = s.seating[0]
  // Two players: remove the four dominance cards, shuffle, draw three each (5.1.3).
  s.deck = shuffle(s, BASE_DECK.map((_, i) => i).filter((i) => BASE_DECK[i].kind !== 'dominance'))
  for (const f of s.seating) draw(s, f, 3)
  log(s, `${FACTION_NAME[s.seating[0]]} will take the first turn.`)
  return s
}

// Who has to act next: whoever owes a pending choice, otherwise the player whose turn it is.
export function actor(s: GameState): Faction | null {
  if (s.winner) return null
  return s.pending[0]?.faction ?? s.current
}

export function applyAction(state: GameState, faction: Faction, action: Action): GameState {
  const s = structuredClone(state)
  check(!s.winner, 'The game is over.')
  const prompt = s.pending[0]
  if (prompt) {
    check(prompt.faction === faction, `Waiting for ${FACTION_NAME[prompt.faction]}.`)
    s.pending.shift()
    answerPrompt(s, faction, prompt, action)
  } else {
    check(faction === s.current, `It is ${FACTION_NAME[s.current]}'s turn.`)
    turnAction(s, faction, action)
  }
  advance(s)
  return s
}

function answerPrompt(s: GameState, f: Faction, p: Prompt, a: Action): void {
  const wrong = () => fail('That is not an answer to the current question.')
  switch (p.kind) {
    case 'setup-keep':
      if (a.type !== 'setup-keep') return wrong()
      marquise.setupKeep(s, a.clearing)
      s.pending.unshift({ kind: 'setup-buildings', faction: 'marquise' })
      return
    case 'setup-buildings':
      if (a.type !== 'setup-buildings') return wrong()
      marquise.setupBuildings(s, { sawmill: a.sawmill, workshop: a.workshop, recruiter: a.recruiter })
      eyrie.setupEyrie(s)
      s.pending.unshift({ kind: 'setup-leader', faction: 'eyrie' })
      return
    case 'setup-leader':
      if (a.type !== 'choose-leader') return wrong()
      eyrie.chooseLeader(s, a.leader)
      startTurn(s, s.seating[0])
      return
    case 'choose-leader':
      if (a.type !== 'choose-leader') return wrong()
      eyrie.chooseLeader(s, a.leader)
      return
    case 'place-wood':
      if (a.type !== 'place-wood') return wrong()
      marquise.placeChosenWood(s, a.clearings)
      s.step = 'birdsong'
      return
    case 'new-roost':
      if (a.type !== 'new-roost') return wrong()
      eyrie.newRoost(s, a.clearing)
      s.step = 'birdsong'
      return
    case 'start-effect':
      if (a.type === 'skip') return
      if (p.effect === 'command-warren' && a.type === 'start-effect-battle') return startBattle(s, f, a.clearing, a.defender)
      if (p.effect === 'cobbler' && a.type === 'start-effect-move') return moveWarriors(s, f, a.move.from, a.move.to, a.move.count)
      return wrong()
    case 'ambush':
      if (a.type === 'skip') return
      if (a.type !== 'ambush') return wrong()
      return playAmbush(s, f, a.card)
    case 'foil':
      if (a.type === 'skip') return resolveAmbush(s)
      if (a.type !== 'foil') return wrong()
      return playFoil(s, f, a.card)
    case 'battle-effects':
      if (a.type === 'skip') return
      if (a.type !== 'battle-effects') return wrong()
      return useBattleEffects(s, f, { armorers: a.armorers, sappers: a.sappers, brutalTactics: a.brutalTactics })
    case 'removals':
      if (a.type !== 'removals') return wrong()
      return chooseRemovals(s, f, a.pieces, p)
    case 'field-hospitals':
      if (a.type === 'skip') return
      if (a.type !== 'field-hospitals') return wrong()
      return marquise.fieldHospitals(s, a.card, p.clearing, p.count)
    case 'discard':
      if (a.type !== 'discard') return wrong()
      check(a.cards.length === p.count, `Discard exactly ${p.count} card${p.count === 1 ? '' : 's'} (hand limit ${HAND_LIMIT}).`)
      for (const id of a.cards) {
        takeFromHand(s, f, id)
        discardCard(s, id)
      }
      log(s, `${FACTION_NAME[f]} discard down to ${HAND_LIMIT} cards.`)
      endTurn(s)
      return
  }
}

function turnAction(s: GameState, f: Faction, a: Action): void {
  check(!s.battle, 'Finish the battle first.')
  // Persistent card actions usable at their printed timing.
  switch (a.type) {
    case 'royal-claim': return royalClaim(s, f, a.card)
    case 'stand-and-deliver': return standAndDeliver(s, f, a.card)
    case 'tax-collector': return taxCollector(s, f, a.card, a.clearing)
    case 'codebreakers': return codebreakers(s, f, a.card)
  }
  if (s.step === 'birdsong') {
    check(a.type === 'end-phase', 'In Birdsong you can use Birdsong card effects or move on to Daylight.')
    s.step = 'daylight-start'
    return
  }
  if (s.step === 'add-to-decree') {
    check(f === 'eyrie' && a.type === 'add-to-decree', 'Add one or two cards to the Decree (7.4.2).')
    eyrie.addToDecree(s, a.entries)
    s.step = 'new-roost'
    return
  }
  check(s.step === 'daylight', 'That cannot be done right now.')
  if (a.type === 'craft') return craft(s, f, a.card)
  if (f === 'marquise') {
    switch (a.type) {
      case 'battle': return marquise.battle(s, a.clearing, a.defender)
      case 'march': return marquise.march(s, a.moves)
      case 'recruit': return marquise.recruit(s, a.clearings)
      case 'build': return marquise.build(s, a.clearing, a.building, a.wood)
      case 'overwork': return marquise.overwork(s, a.card, a.clearing)
      case 'spend-bird': return marquise.spendBird(s, a.card)
      case 'end-phase':
        s.step = 'evening-start'
        return
    }
  } else {
    switch (a.type) {
      case 'decree-recruit': return eyrie.decreeRecruit(s, a.column, a.index, a.clearing)
      case 'decree-move': return eyrie.decreeMove(s, a.column, a.index, a.move)
      case 'decree-battle': return eyrie.decreeBattle(s, a.column, a.index, a.clearing, a.defender)
      case 'decree-build': return eyrie.decreeBuild(s, a.column, a.index, a.clearing)
      case 'turmoil': return eyrie.declareTurmoil(s, a.column, a.index)
      case 'end-phase':
        check(eyrie.nextColumn(s) === null, 'You must resolve the whole Decree first (7.5.2).')
        s.step = 'evening-start'
        return
    }
  }
  fail('That cannot be done right now.')
}

// ---------- turn structure (1.4) ----------

function startTurn(s: GameState, f: Faction): void {
  s.current = f
  s.turn = freshTurn()
  s.step = 'birdsong-start'
  log(s, `— ${FACTION_NAME[f]}'s turn —`)
}

function endTurn(s: GameState): void {
  const i = s.seating.indexOf(s.current)
  startTurn(s, s.seating[(i + 1) % s.seating.length])
}

// Run automatic steps until someone has to decide.
export function advance(s: GameState): void {
  while (!s.winner && s.pending.length === 0) {
    if (s.battle) {
      battleStep(s)
      continue
    }
    if (!autoStep(s)) return
  }
}

// Performs one automatic step; returns false when the turn player must act.
function autoStep(s: GameState): boolean {
  const f = s.current
  switch (s.step) {
    case 'setup':
    case 'over':
    case 'daylight':
      return false
    case 'birdsong-start':
      betterBurrowBank(s, f)
      s.step = f === 'marquise' ? 'birdsong-wood' : 'emergency-orders'
      return true
    case 'birdsong-wood': {
      const sawmills = marquise.sawmillClearings(s)
      if (s.marquise.wood >= sawmills.length) {
        marquise.placeWood(s, sawmills)
        s.step = 'birdsong'
      } else if (s.marquise.wood === 0) {
        s.step = 'birdsong'
      } else {
        s.pending.push({ kind: 'place-wood', faction: 'marquise', count: s.marquise.wood })
      }
      return true
    }
    case 'emergency-orders':
      if (s.hands.eyrie.length === 0) {
        draw(s, 'eyrie', 1)
        log(s, 'Emergency Orders: Eyrie Dynasties draw a card.')
      }
      s.step = 'add-to-decree'
      return true
    case 'add-to-decree':
      if (s.hands.eyrie.length > 0) return false
      s.step = 'new-roost'
      return true
    case 'new-roost': {
      s.step = 'birdsong'
      if (eyrie.roostsOnMap(s).length > 0) return true
      const options = eyrie.newRoostOptions(s)
      if (options.length === 1) eyrie.newRoost(s, options[0])
      else if (options.length > 1) {
        s.step = 'new-roost'
        s.pending.push({ kind: 'new-roost', faction: 'eyrie', options })
      }
      return true
    }
    case 'birdsong':
      if (birdsongOptionsAvailable(s, f)) return false
      s.step = 'daylight-start'
      return true
    case 'daylight-start':
      s.step = 'daylight'
      s.turn.craftingOpen = true
      s.turn.actionsLeft = f === 'marquise' ? 3 : 0
      if (inPlayArea(s, f, 'Command Warren') !== undefined) {
        s.pending.push({ kind: 'start-effect', faction: f, effect: 'command-warren' })
      }
      return true
    case 'evening-start':
      s.turn.craftingOpen = false
      s.step = f === 'marquise' ? 'evening-draw' : 'evening-score'
      if (inPlayArea(s, f, 'Cobbler') !== undefined) {
        s.pending.push({ kind: 'start-effect', faction: f, effect: 'cobbler' })
      }
      return true
    case 'evening-score':
      eyrie.scoreRoosts(s)
      s.step = 'evening-draw'
      return true
    case 'evening-draw': {
      const n = f === 'marquise' ? marquise.marquiseDraws(s) : eyrie.eyrieDraws(s)
      draw(s, f, n)
      log(s, `${FACTION_NAME[f]} draw ${n} card${n === 1 ? '' : 's'}.`)
      s.step = 'evening-discard'
      return true
    }
    case 'evening-discard': {
      const excess = s.hands[f].length - HAND_LIMIT
      if (excess > 0) s.pending.push({ kind: 'discard', faction: f, count: excess })
      else endTurn(s)
      return true
    }
  }
}

