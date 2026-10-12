import { assetUrl } from '../../../assetUrl'
import { BASE_DECK } from '../data/baseDeck'
import { EYRIE, type EyrieLeader } from '../data/factions'
import type { CardSuit } from '../data/types'
import type { CardId, Faction, PieceKind } from '../engine/types'

export const cardImage = (id: CardId) => assetUrl(`/root/cards/${BASE_DECK[id].art}.webp`)
export const CARD_BACK = assetUrl('/root/cards/back.webp')
export const VIZIER_IMAGE = assetUrl('/root/cards/59.webp')
export const leaderImage = (leader: EyrieLeader) => assetUrl(`/root/cards/${EYRIE.leaders[leader].art}.webp`)
export const LEADER_BACK = assetUrl('/root/cards/leader-back.webp')

export const pieceImage = (kind: PieceKind | 'ruin' | string) => assetUrl(`/root/pieces/${kind}.png`)
export const factionIcon = (f: Faction) => assetUrl(`/root/pieces/${f}.png`)
export const factionPortrait = (f: Faction) => assetUrl(`/root/factions/${f}.webp`)
export const vpMarker = (f: Faction) => assetUrl(`/root/pieces/vp-${f}.png`)
export const suitIcon = (s: CardSuit) => assetUrl(`/root/pieces/suit-${s}.png`)
