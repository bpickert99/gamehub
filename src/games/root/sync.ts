import { onValue, ref, runTransaction } from 'firebase/database'
import { db } from '../../firebase'
import { applyAction, createGame } from './engine/game'
import type { Action, Faction, GameState } from './engine/types'

// Stored as a JSON string: the Realtime Database drops empty arrays and nulls, which the state relies on.
export type RootGameDoc = {
  stateJson: string
  seats: Record<string, Faction>
}

// Assign factions to players in any way (5.1.1): here, at random.
export function newRootGame(playerIds: string[]): RootGameDoc {
  if (playerIds.length !== 2) throw new Error('Root needs exactly two players for Marquise vs Eyrie.')
  const flip = Math.random() < 0.5
  const seats: Record<string, Faction> = {
    [playerIds[0]]: flip ? 'marquise' : 'eyrie',
    [playerIds[1]]: flip ? 'eyrie' : 'marquise',
  }
  const state = createGame(Math.floor(Math.random() * 2 ** 32))
  return { stateJson: JSON.stringify(state), seats }
}

export function subscribeRootGame(code: string, callback: (doc: RootGameDoc | null) => void): () => void {
  return onValue(ref(db, `rooms/${code}/game`), (snap) => callback(snap.val()))
}

export function parseState(doc: RootGameDoc): GameState {
  return JSON.parse(doc.stateJson) as GameState
}

// Applies the action to the latest stored state inside a transaction, so simultaneous actions cannot clobber each other.
export async function sendAction(code: string, faction: Faction, action: Action): Promise<void> {
  let failure: unknown = null
  const result = await runTransaction(ref(db, `rooms/${code}/game`), (current: RootGameDoc | null) => {
    if (current === null) return current
    try {
      const next = applyAction(parseState(current), faction, action)
      failure = null
      return { ...current, stateJson: JSON.stringify(next) }
    } catch (e) {
      failure = e
      return undefined
    }
  })
  if (failure) throw failure
  if (!result.committed) throw new Error('The action was not saved. Please try again.')
}
