import {
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database'
import { db } from './firebase'
import type { Game } from './games/catalogue'
import { newRootGame, type RootGameDoc } from './games/root/sync'
import { DEFAULT_OPTIONS, type RootOptions } from './games/root/options'

export type Player = {
  name: string
  joinedAt: number
  connected: boolean
}

export type Room = {
  gameId: string
  hostId: string
  status: 'lobby' | 'playing'
  minPlayers: number
  maxPlayers: number
  createdAt: number
  players?: Record<string, Player>
  kicked?: Record<string, true>
  game?: RootGameDoc
  options?: RootOptions
}

// No I or O, so codes can't be confused with 1 and 0.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 4

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase()
}

function randomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  }
  return code
}

function roomRef(code: string) {
  return ref(db, `rooms/${code}`)
}

function newPlayer(name: string) {
  return { name, joinedAt: serverTimestamp(), connected: true }
}

export async function createRoom(game: Game, uid: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const result = await runTransaction(roomRef(code), (current) => {
      if (current !== null) return undefined
      return {
        gameId: game.id,
        hostId: uid,
        status: 'lobby',
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        createdAt: serverTimestamp(),
        players: { [uid]: newPlayer(name) },
      }
    })
    if (result.committed) return code
  }
  throw new Error('Could not find a free room code')
}

export function subscribeRoom(code: string, callback: (room: Room | null) => void): () => void {
  return onValue(roomRef(code), (snap) => callback(snap.val()))
}

export function joinRoom(code: string, uid: string, name: string): Promise<void> {
  return set(ref(db, `rooms/${code}/players/${uid}`), newPlayer(name))
}

export function leaveRoom(code: string, uid: string): Promise<void> {
  return remove(ref(db, `rooms/${code}/players/${uid}`))
}

export function kickPlayer(code: string, uid: string): Promise<void> {
  return update(roomRef(code), {
    [`players/${uid}`]: null,
    [`kicked/${uid}`]: true,
  })
}

export function startGame(code: string, room: Room): Promise<void> {
  const updates: Record<string, unknown> = { status: 'playing' }
  if (room.gameId === 'root') updates.game = newRootGame(Object.keys(room.players ?? {}), room.options ?? DEFAULT_OPTIONS)
  return update(roomRef(code), updates)
}

export function setRootOptions(code: string, options: RootOptions): Promise<void> {
  return set(ref(db, `rooms/${code}/options`), options)
}

// Keeps players/{uid}/connected in sync with this browser's connection.
// onDisconnect only fires once, so it is re-armed every time the connection comes back.
export function trackPresence(code: string, uid: string): () => void {
  const connectedRef = ref(db, `rooms/${code}/players/${uid}/connected`)
  const unsubscribe = onValue(ref(db, '.info/connected'), async (snap) => {
    if (snap.val() !== true) return
    await onDisconnect(connectedRef).set(false)
    await set(connectedRef, true)
  })
  return () => {
    unsubscribe()
    onDisconnect(connectedRef).cancel()
  }
}

export function markDisconnected(code: string, uid: string): Promise<void> {
  return set(ref(db, `rooms/${code}/players/${uid}/connected`), false)
}
