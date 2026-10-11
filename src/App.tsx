import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from './firebase'
import Hub from './pages/Hub'
import RoomPage from './pages/RoomPage'

export default function App() {
  const [uid, setUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Anonymous sign-in gives each browser a stable id, which is how a refreshed tab gets its seat back.
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (user) setUid(user.uid)
        else signInAnonymously(auth).catch((e: Error) => setError(e.message))
      }),
    [],
  )

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo">
          🎲 Game Hub
        </Link>
      </header>
      <main>
        {error ? (
          <p className="error">Could not connect: {error}</p>
        ) : !uid ? (
          <p className="muted">Connecting…</p>
        ) : (
          <Routes>
            <Route path="/" element={<Hub uid={uid} />} />
            <Route path="/room/:code" element={<RoomPage uid={uid} />} />
          </Routes>
        )}
      </main>
    </div>
  )
}
