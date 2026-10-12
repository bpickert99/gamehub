import { assetUrl } from '../assetUrl'

export type Game = {
  id: string
  name: string
  tagline: string
  minPlayers: number
  maxPlayers: number
  logo: string
}

export const GAMES: Game[] = [
  {
    id: 'root',
    name: 'Root',
    tagline: 'A game of woodland might and right. Marquise de Cat vs Eyrie Dynasties, every rule enforced.',
    minPlayers: 2,
    maxPlayers: 2,
    logo: assetUrl('/root/logo.png'),
  },
]

export function getGame(id: string): Game {
  const game = GAMES.find((g) => g.id === id)
  if (!game) throw new Error(`Unknown game "${id}"`)
  return game
}
