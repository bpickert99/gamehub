import { assetUrl } from '../assetUrl'

// A box on the shelf. Playable games can be hosted; the rest are coming soon.
export type Game = {
  id: string
  name: string
  tagline: string
  minPlayers: number
  maxPlayers: number
  playable: boolean
  // Box look on the shelf: colours, and for playable games the art on the lid.
  box: { color: string; accent: string; ink: string; width: number; height: number; art?: string; pattern: BoxPattern }
  logo?: string
}

export type BoxPattern = 'woodland' | 'stars' | 'feathers' | 'clocktower' | 'tiles' | 'hexes'

export const GAMES: Game[] = [
  {
    id: 'root',
    name: 'Root',
    tagline: 'A game of woodland might and right. Marquise de Cat vs Eyrie Dynasties, every rule enforced.',
    minPlayers: 2,
    maxPlayers: 2,
    playable: true,
    box: { color: '#e9dcbc', accent: '#c4472c', ink: '#1f1a17', width: 150, height: 196, art: assetUrl('/root/cards/back.webp'), pattern: 'woodland' },
    logo: assetUrl('/root/logo.png'),
  },
  {
    id: 'arcs',
    name: 'Arcs',
    tagline: 'Conflict and collapse in the Reach.',
    minPlayers: 2,
    maxPlayers: 4,
    playable: false,
    box: { color: '#1b1f3a', accent: '#e8b64c', ink: '#f2e6c9', width: 150, height: 196, pattern: 'stars' },
  },
  {
    id: 'wingspan',
    name: 'Wingspan',
    tagline: 'Attract the best birds to your wildlife preserve.',
    minPlayers: 1,
    maxPlayers: 5,
    playable: false,
    box: { color: '#efe6cf', accent: '#5b8a6e', ink: '#2c3b30', width: 150, height: 150, pattern: 'feathers' },
  },
  {
    id: 'blood-on-the-clocktower',
    name: 'Blood on the Clocktower',
    tagline: 'A social deduction game of bluffing and murder in Ravenswood Bluff.',
    minPlayers: 5,
    maxPlayers: 20,
    playable: false,
    box: { color: '#2a0c10', accent: '#b3242f', ink: '#ead8b5', width: 128, height: 200, pattern: 'clocktower' },
  },
  {
    id: 'azul',
    name: 'Azul',
    tagline: 'Draft tiles to decorate the walls of the royal palace.',
    minPlayers: 2,
    maxPlayers: 4,
    playable: false,
    box: { color: '#1d4f8f', accent: '#f2c14e', ink: '#ffffff', width: 150, height: 150, pattern: 'tiles' },
  },
  {
    id: 'catan',
    name: 'Catan',
    tagline: 'Trade, build and settle the island.',
    minPlayers: 3,
    maxPlayers: 4,
    playable: false,
    box: { color: '#c2391f', accent: '#f4c542', ink: '#fff6e0', width: 150, height: 150, pattern: 'hexes' },
  },
]

export function getGame(id: string): Game {
  const game = GAMES.find((g) => g.id === id)
  if (!game) throw new Error(`Unknown game "${id}"`)
  return game
}
