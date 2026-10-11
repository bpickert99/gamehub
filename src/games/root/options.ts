import type { Faction } from './engine/types'

// Lobby choices for a Root game, set by the host before starting.
export type RootOptions = {
  // Which faction each player (by uid) takes; missing means "assign at random".
  factions?: Record<string, Faction>
  map: MapId
  deck: DeckId
}

export type MapId = 'autumn' | 'winter' | 'lake' | 'mountain'
export type DeckId = 'base' | 'exiles-partisans'

export const MAPS: { id: MapId; name: string; available: boolean }[] = [
  { id: 'autumn', name: 'Autumn', available: true },
  { id: 'winter', name: 'Winter', available: false },
  { id: 'lake', name: 'Lake', available: false },
  { id: 'mountain', name: 'Mountain', available: false },
]

export const DECKS: { id: DeckId; name: string; available: boolean }[] = [
  { id: 'base', name: 'Base deck', available: true },
  { id: 'exiles-partisans', name: 'Exiles & Partisans', available: false },
]

export const PLAYABLE_FACTIONS: Faction[] = ['marquise', 'eyrie']

export const DEFAULT_OPTIONS: RootOptions = { map: 'autumn', deck: 'base' }

// Chosen factions are valid when every player has a different one.
export function chosenSeats(options: RootOptions, playerIds: string[]): Record<string, Faction> | null {
  const f = options.factions
  if (!f) return null
  const picked = playerIds.map((id) => f[id])
  if (picked.some((x) => !x) || new Set(picked).size !== picked.length) return null
  return Object.fromEntries(playerIds.map((id) => [id, f[id]]))
}
