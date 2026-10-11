import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getGame } from '../games/catalogue'
import {
  joinRoom,
  kickPlayer,
  leaveRoom,
  markDisconnected,
  normalizeCode,
  startGame,
  subscribeRoom,
  trackPresence,
  type Player,
  type Room,
} from '../rooms'
import { loadName, MAX_NAME_LENGTH, saveName } from '../playerName'
import RootGame from '../games/root/ui/RootGame'

type Seat = { uid: string } & Player

function sortedSeats(room: Room): Seat[] {
  return Object.entries(room.players ?? {})
    .map(([uid, player]) => ({ uid, ...player }))
    .sort((a, b) => a.joinedAt - b.joinedAt)
}

export default function RoomPage({ uid }: { uid: string }) {
  const code = normalizeCode(useParams().code!)
  // undefined = still loading, null = no such room
  const [room, setRoom] = useState<Room | null | undefined>(undefined)

  useEffect(() => subscribeRoom(code, setRoom), [code])

  const isPlayer = Boolean(room?.players?.[uid])
  usePresence(code, uid, isPlayer)

  if (room === undefined) return <p className="muted">Loading room {code}…</p>
  if (room === null) return <Notice text={`There is no game with code ${code}.`} />
  if (room.kicked?.[uid]) return <Notice text="The host removed you from this game." />
  if (!isPlayer) {
    if (room.status !== 'lobby') return <Notice text="This game has already started." />
    return <JoinForm code={code} uid={uid} room={room} />
  }
  if (room.status === 'playing') {
    if (room.gameId === 'root') return <RootGame code={code} uid={uid} />
    return <GameScreen room={room} />
  }
  return <Lobby code={code} uid={uid} room={room} />
}

// Marks this player connected while the room page is open, and disconnected when they leave the page.
function usePresence(code: string, uid: string, isPlayer: boolean) {
  const isPlayerRef = useRef(isPlayer)
  isPlayerRef.current = isPlayer

  useEffect(() => {
    if (!isPlayer) return
    const stop = trackPresence(code, uid)
    return () => {
      stop()
      // Still seated means the page is closing; a kicked or departed player has no record to update.
      if (isPlayerRef.current) markDisconnected(code, uid)
    }
  }, [code, uid, isPlayer])
}

function Notice({ text }: { text: string }) {
  return (
    <div className="panel">
      <p>{text}</p>
      <Link to="/">Back to the hub</Link>
    </div>
  )
}

function JoinForm({ code, uid, room }: { code: string; uid: string; room: Room }) {
  const game = getGame(room.gameId)
  const [name, setName] = useState(loadName)
  const [error, setError] = useState<string | null>(null)
  const seats = sortedSeats(room)
  const full = seats.length >= room.maxPlayers
  const trimmedName = name.trim()

  async function join(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    saveName(trimmedName)
    try {
      await joinRoom(code, uid, trimmedName)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="panel">
      <h2>
        {game.emoji} {game.name} · <span className="code">{code}</span>
      </h2>
      <p className="muted">
        Hosted by {room.players?.[room.hostId]?.name ?? 'someone'} · {seats.length}/{room.maxPlayers} players
      </p>
      {full ? (
        <p>This game is full.</p>
      ) : (
        <form className="join" onSubmit={join}>
          <label className="field">
            <span>Your name</span>
            <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" disabled={!trimmedName}>
            Join
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function Lobby({ code, uid, room }: { code: string; uid: string; room: Room }) {
  const game = getGame(room.gameId)
  const seats = sortedSeats(room)
  const navigate = useNavigate()
  const isHost = room.hostId === uid
  const enough = seats.length >= room.minPlayers
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const link = `${window.location.origin}/room/${code}`

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <div className="panel lobby">
      <h2>
        {game.emoji} {game.name}
      </h2>
      <div className="share">
        <div>
          <span className="muted">Game code</span>
          <div className="code big">{code}</div>
        </div>
        <button className="secondary" onClick={copyLink}>
          {copied ? 'Link copied!' : 'Copy invite link'}
        </button>
      </div>

      <h3>
        Players {seats.length}/{room.maxPlayers}
      </h3>
      <ul className="players">
        {seats.map((seat) => (
          <li key={seat.uid}>
            <span className={seat.connected ? 'dot online' : 'dot offline'} title={seat.connected ? 'Online' : 'Offline'} />
            <span className="player-name">
              {seat.name}
              {seat.uid === uid && ' (you)'}
            </span>
            {seat.uid === room.hostId && <span className="badge">Host</span>}
            {isHost && seat.uid !== uid && (
              <button className="link-button" onClick={() => run(() => kickPlayer(code, seat.uid))}>
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>

      {isHost ? (
        <>
          <button disabled={!enough} onClick={() => run(() => startGame(code, room))}>
            Start game
          </button>
          {!enough && (
            <p className="muted">
              Need at least {room.minPlayers} players to start.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="muted">Waiting for the host to start the game…</p>
          <button className="secondary" onClick={() =>
              run(async () => {
                await leaveRoom(code, uid)
                navigate('/')
              })
            }>
            Leave
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function GameScreen({ room }: { room: Room }) {
  const game = getGame(room.gameId)
  return (
    <div className="panel">
      <h2>
        {game.emoji} {game.name}
      </h2>
      <p>The game has started! (This game isn't built yet.)</p>
      <p className="muted">Playing: {sortedSeats(room).map((s) => s.name).join(', ')}</p>
    </div>
  )
}
