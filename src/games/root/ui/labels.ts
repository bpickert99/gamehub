import { card, FACTION_NAME } from '../engine/core'
import { buildCost } from '../engine/marquise'
import type { Action, GameState, Move, PieceKind, Prompt, Step } from '../engine/types'

export const moveLabel = (m: Move) => `${m.count} from ${m.from} to ${m.to}`

const PIECE_NAME: Record<PieceKind, string> = {
  sawmill: 'sawmill', workshop: 'workshop', recruiter: 'recruiter', roost: 'roost', wood: 'wood', keep: 'the keep',
}

export function actionLabel(s: GameState, a: Action): string {
  switch (a.type) {
    case 'battle':
    case 'start-effect-battle':
      return `Battle in ${a.clearing}`
    case 'decree-battle':
      return `Battle in ${a.clearing}`
    case 'decree-recruit':
      return `Recruit in ${a.clearing}`
    case 'decree-build':
      return `Build a roost in ${a.clearing}`
    case 'build': {
      const price = buildCost(s, a.building)!
      return `Build a ${a.building} in ${a.clearing} (${price.cost} wood, +${price.vp} VP)`
    }
    case 'overwork':
      return `Overwork in ${a.clearing} with ${card(a.card).name}`
    case 'tax-collector':
      return `Tax Collector: remove a warrior in ${a.clearing}`
    case 'removals':
      return `Remove ${a.pieces.map((p) => PIECE_NAME[p]).join(' and ')}`
    case 'battle-effects': {
      const used = [a.armorers && 'Armorers', a.sappers && 'Sappers', a.brutalTactics && 'Brutal Tactics'].filter(Boolean)
      return `Use ${used.join(' + ')}`
    }
    case 'new-roost':
      return `New roost in ${a.clearing}`
    case 'setup-keep':
      return `Keep in ${a.clearing}`
    case 'place-wood':
      return `Place wood in ${a.clearings.join(', ')}`
    case 'recruit':
      return 'Recruit'
    case 'codebreakers':
      return "Codebreakers: look at your opponent's hand"
    case 'royal-claim':
      return 'Royal Claim: discard to score per ruled clearing'
    case 'stand-and-deliver':
      return 'Stand and Deliver!: take a random card'
    default:
      return a.type
  }
}

export const STEP_NAME: Record<Step, string> = {
  setup: 'Setup',
  'birdsong-start': 'Birdsong',
  'birdsong-wood': 'Birdsong',
  'emergency-orders': 'Birdsong',
  'add-to-decree': 'Birdsong',
  'new-roost': 'Birdsong',
  birdsong: 'Birdsong',
  'daylight-start': 'Daylight',
  daylight: 'Daylight',
  'evening-start': 'Evening',
  'evening-score': 'Evening',
  'evening-draw': 'Evening',
  'evening-discard': 'Evening',
  over: 'Game over',
}

export function waitingFor(p: Prompt | undefined, s: GameState): string {
  if (!p) return `${FACTION_NAME[s.current]} are taking their turn.`
  const who = FACTION_NAME[p.faction]
  switch (p.kind) {
    case 'setup-keep': return `${who} are choosing where to put the keep.`
    case 'setup-buildings': return `${who} are placing their starting buildings.`
    case 'setup-leader':
    case 'choose-leader': return `${who} are choosing a leader.`
    case 'ambush': return `${who} are deciding whether to ambush.`
    case 'foil': return `${who} are deciding whether to foil the ambush.`
    case 'battle-effects': return `${who} are deciding on battle cards.`
    case 'removals': return `${who} are choosing which pieces to lose.`
    case 'field-hospitals': return `${who} are deciding on Field Hospitals.`
    case 'discard': return `${who} are discarding down to five cards.`
    default: return `${who} are deciding.`
  }
}
