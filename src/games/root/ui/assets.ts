import { BASE_DECK } from '../data/baseDeck'
import { EYRIE, type EyrieLeader } from '../data/factions'
import type { ClearingSuit } from '../data/types'
import type { CardId, Faction, PieceKind } from '../engine/types'

export const cardImage = (id: CardId) => `/root/cards/${BASE_DECK[id].art}.webp`
export const CARD_BACK = '/root/cards/back.webp'
export const VIZIER_IMAGE = '/root/cards/59.webp'
export const leaderImage = (leader: EyrieLeader) => `/root/cards/${EYRIE.leaders[leader].art}.webp`
export const LEADER_BACK = '/root/cards/leader-back.webp'

export const pieceImage = (kind: PieceKind | 'ruin' | string) => `/root/pieces/${kind}.png`
export const factionIcon = (f: Faction) => `/root/pieces/${f}.png`
export const factionPortrait = (f: Faction) => `/root/factions/${f}.webp`
export const vpMarker = (f: Faction) => `/root/pieces/vp-${f}.png`
export const suitIcon = (s: ClearingSuit) => `/root/pieces/suit-${s}.png`
export const clearingArt = (c: string) => `/root/clearings/${c}.webp`
