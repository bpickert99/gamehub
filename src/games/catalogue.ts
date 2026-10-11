export type Game = {
  id: string
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
  emoji: string
}

// Placeholder entries: the catalogue and lobby flow work end to end, the games themselves come later.
export const GAMES: Game[] = [
  {
    id: 'connect-four',
    name: 'Connect Four',
    description: 'Drop discs and line up four in a row before your opponent does.',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '🔴',
  },
  {
    id: 'yahtzee',
    name: 'Yahtzee',
    description: 'Roll five dice, pick your categories, chase the big score.',
    minPlayers: 2,
    maxPlayers: 6,
    emoji: '🎲',
  },
  {
    id: 'word-guess',
    name: 'Word Guess',
    description: 'Give one-word clues and help your team find the right cards.',
    minPlayers: 4,
    maxPlayers: 8,
    emoji: '🕵️',
  },
]

export function getGame(id: string): Game {
  const game = GAMES.find((g) => g.id === id)
  if (!game) throw new Error(`Unknown game "${id}"`)
  return game
}
