import { FACTION_NAME } from '../engine/core'
import type { Faction } from '../engine/types'
import { DECKS, MAPS, PLAYABLE_FACTIONS, chosenSeats, type RootOptions } from '../options'
import { factionPortrait } from './assets'

type Props = {
  options: RootOptions
  players: { uid: string; name: string }[]
  isHost: boolean
  onChange: (o: RootOptions) => void
}

// Root's lobby settings: who plays which faction, and (later) which map and deck.
export default function RootSetup({ options, players, isHost, onChange }: Props) {
  const random = !options.factions
  const valid = random || chosenSeats(options, players.map((p) => p.uid)) !== null

  function pick(uid: string, f: Faction) {
    const factions = { ...(options.factions ?? {}), [uid]: f }
    // Picking a faction someone else had swaps them onto your old one.
    const other = players.find((p) => p.uid !== uid && factions[p.uid] === f)
    const mine = options.factions?.[uid]
    if (other) factions[other.uid] = mine ?? PLAYABLE_FACTIONS.find((x) => x !== f)!
    onChange({ ...options, factions })
  }

  return (
    <div className="root-setup">
      <h3>Game setup</h3>
      <div className="root-setup-row">
        <span className="root-setup-label">Factions</span>
        <div className="root-setup-choices">
          <button className={random ? 'on' : ''} disabled={!isHost} onClick={() => onChange({ ...options, factions: undefined })}>Random</button>
          <button
            className={!random ? 'on' : ''}
            disabled={!isHost}
            onClick={() => onChange({ ...options, factions: Object.fromEntries(players.map((p, i) => [p.uid, PLAYABLE_FACTIONS[i % 2]])) })}
          >
            Choose
          </button>
        </div>
      </div>
      {!random && (
        <div className="root-setup-seats">
          {players.map((p) => (
            <div key={p.uid} className="root-setup-seat">
              <span>{p.name}</span>
              <div className="root-setup-factions">
                {PLAYABLE_FACTIONS.map((f) => (
                  <button key={f} className={options.factions?.[p.uid] === f ? 'on' : ''} disabled={!isHost} onClick={() => pick(p.uid, f)} title={FACTION_NAME[f]}>
                    <img src={factionPortrait(f)} alt="" />
                    {FACTION_NAME[f]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!valid && <p className="error">Each player needs a different faction.</p>}
        </div>
      )}
      <div className="root-setup-row">
        <span className="root-setup-label">Map</span>
        <div className="root-setup-choices">
          {MAPS.map((m) => (
            <button key={m.id} className={options.map === m.id ? 'on' : ''} disabled={!isHost || !m.available} onClick={() => onChange({ ...options, map: m.id })}>
              {m.name}{!m.available && <small> soon</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="root-setup-row">
        <span className="root-setup-label">Deck</span>
        <div className="root-setup-choices">
          {DECKS.map((d) => (
            <button key={d.id} className={options.deck === d.id ? 'on' : ''} disabled={!isHost || !d.available} onClick={() => onChange({ ...options, deck: d.id })}>
              {d.name}{!d.available && <small> soon</small>}
            </button>
          ))}
        </div>
      </div>
      {!isHost && <p className="muted">The host chooses the setup.</p>}
    </div>
  )
}

export function setupReady(options: RootOptions, playerIds: string[]): boolean {
  return !options.factions || chosenSeats(options, playerIds) !== null
}
