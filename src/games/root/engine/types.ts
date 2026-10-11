import type { ClearingId } from '../data/autumnMap'
import type { DecreeColumn, EyrieLeader, MarquiseBuilding } from '../data/factions'
import type { ClearingSuit, Item } from '../data/types'

export type Faction = 'marquise' | 'eyrie'
export const FACTIONS: Faction[] = ['marquise', 'eyrie']

// Index into BASE_DECK.
export type CardId = number

export type BuildingKind = MarquiseBuilding | 'roost'
export type TokenKind = 'wood' | 'keep'
export type PieceKind = BuildingKind | TokenKind

export type Building = { faction: Faction; kind: BuildingKind }
export type Token = { faction: Faction; kind: TokenKind }

export type ClearingState = {
  warriors: Record<Faction, number>
  buildings: Building[]
  tokens: Token[]
  ruins: number
}

export type DecreeEntry = { card: CardId } | { vizier: true }

export type Step =
  | 'setup'
  | 'birdsong-start'
  | 'birdsong-wood'
  | 'emergency-orders'
  | 'add-to-decree'
  | 'new-roost'
  | 'birdsong'
  | 'daylight-start'
  | 'daylight'
  | 'evening-start'
  | 'evening-score'
  | 'evening-draw'
  | 'evening-discard'
  | 'over'

export type Prompt =
  | { kind: 'setup-keep'; faction: 'marquise' }
  | { kind: 'setup-buildings'; faction: 'marquise' }
  | { kind: 'setup-leader'; faction: 'eyrie' }
  | { kind: 'choose-leader'; faction: 'eyrie' }
  | { kind: 'place-wood'; faction: 'marquise'; count: number }
  | { kind: 'new-roost'; faction: 'eyrie'; options: ClearingId[] }
  | { kind: 'start-effect'; faction: Faction; effect: 'command-warren' | 'cobbler' }
  | { kind: 'ambush'; faction: Faction }
  | { kind: 'foil'; faction: Faction }
  | { kind: 'battle-effects'; faction: Faction }
  | { kind: 'removals'; faction: Faction; clearing: ClearingId; hits: number; context: RemovalContext }
  | { kind: 'field-hospitals'; faction: 'marquise'; clearing: ClearingId; count: number }
  | { kind: 'discard'; faction: Faction; count: number }

// Why pieces are being removed, so the engine knows how to continue once the choice is made.
export type RemovalContext = 'ambush' | 'battle'

export type Battle = {
  attacker: Faction
  defender: Faction
  clearing: ClearingId
  step: 'ambush' | 'roll' | 'effects' | 'deal'
  // Rolled values: attacker deals `high`, defender deals `low` (Law 4.3.3).
  high: number
  low: number
  attackerExtra: number
  defenderExtra: number
  attackerIgnoresRolled: boolean
  defenderIgnoresRolled: boolean
  brutalTactics: boolean
  // Ambush card played by the defender, until it is discarded.
  ambush?: CardId
  effectsAsked: Faction[]
  // Pieces each side chose to remove when the order mattered.
  chosen: Partial<Record<Faction, PieceKind[]>>
}

export type TurnState = {
  // Crafting pieces activated this turn, counted per suit (Law 4.1.1).
  craftingUsed: Record<ClearingSuit, number>
  craftingOpen: boolean
  // Card ids whose "once per" effect was used this turn.
  usedEffects: CardId[]
  // Marquise
  actionsLeft: number
  recruited: boolean
  // Eyrie: decree entries resolved this turn, as "column:index".
  resolved: string[]
  // Codebreakers: hand revealed to the turn player.
  peek: CardId[] | null
}

export type GameState = {
  rng: number
  seating: Faction[]
  current: Faction
  step: Step
  turn: TurnState
  deck: CardId[]
  discard: CardId[]
  hands: Record<Faction, CardId[]>
  playArea: Record<Faction, CardId[]>
  crafted: Record<Faction, Item[]>
  itemSupply: Record<Item, number>
  score: Record<Faction, number>
  clearings: Record<ClearingId, ClearingState>
  marquise: {
    warriors: number
    wood: number
    track: Record<MarquiseBuilding, number>
    keep: ClearingId | null
  }
  eyrie: {
    warriors: number
    roostTrack: number
    leader: EyrieLeader | null
    faceUpLeaders: EyrieLeader[]
    decree: Record<DecreeColumn, DecreeEntry[]>
  }
  pending: Prompt[]
  battle: Battle | null
  winner: Faction | null
  log: string[]
}

export type Move = { from: ClearingId; to: ClearingId; count: number }

export type Action =
  | { type: 'setup-keep'; clearing: ClearingId }
  | { type: 'setup-buildings'; sawmill: ClearingId; workshop: ClearingId; recruiter: ClearingId }
  | { type: 'choose-leader'; leader: EyrieLeader }
  | { type: 'place-wood'; clearings: ClearingId[] }
  | { type: 'new-roost'; clearing: ClearingId }
  | { type: 'end-phase' }
  | { type: 'craft'; card: CardId }
  | { type: 'royal-claim'; card: CardId }
  | { type: 'stand-and-deliver'; card: CardId }
  | { type: 'tax-collector'; card: CardId; clearing: ClearingId }
  | { type: 'codebreakers'; card: CardId }
  | { type: 'start-effect-battle'; clearing: ClearingId; defender: Faction }
  | { type: 'start-effect-move'; move: Move }
  | { type: 'skip' }
  | { type: 'battle'; clearing: ClearingId; defender: Faction }
  | { type: 'march'; moves: Move[] }
  | { type: 'recruit'; clearings?: ClearingId[] }
  | { type: 'build'; clearing: ClearingId; building: MarquiseBuilding; wood: Partial<Record<ClearingId, number>> }
  | { type: 'overwork'; card: CardId; clearing: ClearingId }
  | { type: 'spend-bird'; card: CardId }
  | { type: 'add-to-decree'; entries: { card: CardId; column: DecreeColumn }[] }
  | { type: 'decree-recruit'; column: DecreeColumn; index: number; clearing: ClearingId }
  | { type: 'decree-move'; column: DecreeColumn; index: number; move: Move }
  | { type: 'decree-battle'; column: DecreeColumn; index: number; clearing: ClearingId; defender: Faction }
  | { type: 'decree-build'; column: DecreeColumn; index: number; clearing: ClearingId }
  | { type: 'turmoil'; column: DecreeColumn; index: number }
  | { type: 'ambush'; card: CardId }
  | { type: 'foil'; card: CardId }
  | { type: 'battle-effects'; armorers: boolean; sappers: boolean; brutalTactics: boolean }
  | { type: 'removals'; pieces: PieceKind[] }
  | { type: 'field-hospitals'; card: CardId }
  | { type: 'discard'; cards: CardId[] }

export class RuleError extends Error {}
