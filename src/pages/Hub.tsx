import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES, type Game } from '../games/catalogue'
import GameBox from './GameBox'
import { createRoom, normalizeCode } from '../rooms'
import { loadName, MAX_NAME_LENGTH, saveName } from '../playerName'

const PER_SHELF = 3

export default function Hub({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [chosen, setChosen] = useState<Game | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmedName = name.trim()

  async function host(game: Game) {
    setError(null)
    setCreating(true)
    saveName(trimmedName)
    try {
      navigate(`/room/${await createRoom(game, uid, trimmedName)}`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault()
    saveName(trimmedName)
    navigate(`/room/${normalizeCode(code)}`)
  }

  const shelves: Game[][] = []
  for (let i = 0; i < GAMES.length; i += PER_SHELF) shelves.push(GAMES.slice(i, i + PER_SHELF))

  return (
    <div className="den">
      <section className="den-plaque">
        <label className="field">
          <span>Your name</span>
          <input value={name} maxLength={MAX_NAME_LENGTH} placeholder="e.g. Sam" onChange={(e) => setName(e.target.value)} />
        </label>
        <form className="join" onSubmit={join}>
          <label className="field">
            <span>Have a code?</span>
            <input className="code-input" value={code} maxLength={4} placeholder="ABCD" onChange={(e) => setCode(normalizeCode(e.target.value))} />
          </label>
          <button type="submit" disabled={code.length !== 4}>Join game</button>
        </form>
      </section>

      <div className="bookcase">
        {shelves.map((row, i) => (
          <div key={i} className="shelf">
            <div className="shelf-games">
              {row.map((game) => (
                <GameBox key={game.id} game={game} onOpen={() => setChosen(game)} />
              ))}
            </div>
            <div className="shelf-plank" />
          </div>
        ))}
      </div>

      {chosen && (
        <div className="den-modal" onClick={() => setChosen(null)}>
          <div className="den-detail" onClick={(e) => e.stopPropagation()}>
            {chosen.logo ? <img className="den-logo" src={chosen.logo} alt={chosen.name} /> : <h2>{chosen.name}</h2>}
            <p className="den-tagline">{chosen.tagline}</p>
            <p className="muted">
              {chosen.minPlayers === chosen.maxPlayers ? `${chosen.minPlayers} players` : `${chosen.minPlayers}–${chosen.maxPlayers} players`}
            </p>
            {chosen.playable ? (
              <>
                {!trimmedName && <p className="muted">Enter your name above to host.</p>}
                <button disabled={!trimmedName || creating} onClick={() => host(chosen)}>{creating ? 'Setting up the table…' : 'Host this game'}</button>
              </>
            ) : (
              <p className="den-soon">Coming soon — next on the build list.</p>
            )}
            {error && <p className="error">{error}</p>}
            <button className="link-button den-close" onClick={() => setChosen(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
