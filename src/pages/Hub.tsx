import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES, type Game } from '../games/catalogue'
import { createRoom, normalizeCode } from '../rooms'
import { loadName, MAX_NAME_LENGTH, saveName } from '../playerName'

export default function Hub({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()

  async function host(game: Game) {
    setError(null)
    setCreating(game.id)
    saveName(trimmedName)
    try {
      const roomCode = await createRoom(game, uid, trimmedName)
      navigate(`/room/${roomCode}`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(null)
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault()
    saveName(trimmedName)
    navigate(`/room/${normalizeCode(code)}`)
  }

  return (
    <div className="hub">
      <section className="panel">
        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Sam"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <form className="join" onSubmit={join}>
          <label className="field">
            <span>Have a code?</span>
            <input
              className="code-input"
              value={code}
              maxLength={4}
              placeholder="ABCD"
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
          </label>
          <button type="submit" disabled={code.length !== 4}>
            Join game
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <h2>Start a game</h2>
      {!trimmedName && <p className="muted">Enter your name to host a game.</p>}
      <div className="catalogue">
        {GAMES.map((game) => (
          <article key={game.id} className="card">
            <div className="card-emoji">{game.emoji}</div>
            <h3>{game.name}</h3>
            <p>{game.description}</p>
            <p className="muted">
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} players`
                : `${game.minPlayers}–${game.maxPlayers} players`}
            </p>
            <button disabled={!trimmedName || creating !== null} onClick={() => host(game)}>
              {creating === game.id ? 'Creating…' : 'Host this game'}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
