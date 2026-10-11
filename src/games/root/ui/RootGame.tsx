import { useEffect, useMemo, useState } from 'react'
import type { ClearingId } from '../data/autumnMap'
import { FACTION_NAME, opponent } from '../engine/core'
import { actor, applyAction } from '../engine/game'
import { decreeOptions, legalActions } from '../engine/legal'
import type { Action, CardId, Faction, GameState } from '../engine/types'
import { parseState, sendAction, subscribeRootGame, type RootGameDoc } from '../sync'
import ActionPanel, { EMPTY_UI, type Ui } from './ActionPanel'
import { STEP_NAME } from './labels'
import MapView from './MapView'
import { CardImage, FactionPanel, Hand, Log } from './Panels'
import { factionIcon } from './assets'
import './root.css'

export default function RootGame({ code, uid }: { code: string; uid: string }) {
  const [doc, setDoc] = useState<RootGameDoc | null | undefined>(undefined)
  useEffect(() => subscribeRootGame(code, setDoc), [code])
  const state = useMemo(() => (doc ? parseState(doc) : null), [doc])
  if (doc === undefined) return <p className="muted">Loading the Woodland…</p>
  if (!doc || !state) return <p className="error">This room has no Root game data.</p>
  const me = doc.seats[uid]
  if (!me) return <p className="muted">You are watching this game.</p>
  return <Table code={code} state={state} me={me} />
}

function Table({ code, state, me }: { code: string; state: GameState; me: Faction }) {
  // Selections belong to the game state they were made in; any change to the game discards them,
  // so a stale selection (e.g. a Decree card that Turmoil just removed) is never rendered.
  const version = `${state.log.length}:${state.pending.length}:${state.step}`
  const [selection, setSelection] = useState<{ version: string; ui: Ui }>({ version, ui: EMPTY_UI })
  const ui = selection.version === version ? selection.ui : EMPTY_UI
  const setUi = (next: Ui) => setSelection({ version, ui: next })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const myTurnToAct = actor(state) === me
  const options = useMemo(() => (myTurnToAct ? legalActions(state).map((o) => o.action) : []), [state, myTurnToAct])

  async function act(action: Action) {
    setError(null)
    setBusy(true)
    try {
      applyAction(state, me, action) // validate locally for an immediate, readable error
      await sendAction(code, me, action)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const highlight = useMemo(() => highlights(state, options, ui), [state, options, ui])
  const prompt = state.pending[0]
  const handLimit = prompt?.kind === 'discard' && prompt.faction === me ? prompt.count : state.step === 'add-to-decree' && myTurnToAct ? 2 : 1

  function toggleCard(id: CardId) {
    const has = ui.cards.includes(id)
    const cards = has ? ui.cards.filter((c) => c !== id) : handLimit === 1 ? [id] : [...ui.cards, id].slice(-handLimit)
    setUi({ ...ui, cards })
  }

  const them = opponent(state, me)
  return (
    <div className={`root-table ${busy ? 'busy' : ''}`}>
      <div className="root-status">
        <span>
          <img src={factionIcon(state.current)} alt="" /> {FACTION_NAME[state.current]} · {STEP_NAME[state.step]}
        </span>
        <span className="muted">Room {code}</span>
      </div>
      {state.battle && <BattleBox state={state} />}
      <div className="root-main">
        <MapView state={state} selected={ui.clearing} highlight={highlight} onSelect={(c) => setUi({ ...ui, clearing: ui.clearing === c ? null : c })} />
        <aside className="root-side">
          <div className="root-actions panel">
            <ActionPanel state={state} me={me} options={options} ui={ui} setUi={setUi} act={act} />
            {error && <p className="error">{error}</p>}
          </div>
          {state.turn.peek && state.current === me && (
            <div className="panel">
              <h4>Codebreakers: {FACTION_NAME[them]}'s hand</h4>
              <div className="root-hand">{state.turn.peek.map((id) => <CardImage key={id} id={id} small />)}</div>
            </div>
          )}
        </aside>
      </div>
      <div className="panel">
        <h4>Your hand</h4>
        <Hand cards={state.hands[me]} selected={ui.cards} onToggle={toggleCard} />
      </div>
      <div className="root-factions">
        <FactionPanel state={state} faction={me} mine />
        <FactionPanel state={state} faction={them} mine={false} />
      </div>
      <details className="panel">
        <summary>Game log</summary>
        <Log lines={state.log} />
      </details>
    </div>
  )
}

function BattleBox({ state }: { state: GameState }) {
  const b = state.battle!
  const rolled = b.step === 'effects' || b.step === 'deal'
  return (
    <div className="root-battle">
      ⚔️ {FACTION_NAME[b.attacker]} attack {FACTION_NAME[b.defender]} in {b.clearing}
      {rolled && <span> · dice {b.high} / {b.low}</span>}
    </div>
  )
}

// Clearings worth pointing at for the current choices.
function highlights(state: GameState, options: Action[], ui: Ui): ClearingId[] {
  const out = new Set<ClearingId>()
  const actions = ui.entry ? decreeOptions(state, ui.entry.column, ui.entry.index) : options
  for (const a of actions) {
    if ('clearing' in a) out.add(a.clearing)
    if ('move' in a) out.add(ui.clearing && a.move.from === ui.clearing ? a.move.to : a.move.from)
    if (a.type === 'march') out.add(ui.clearing && a.moves[0].from === ui.clearing ? a.moves[0].to : a.moves[0].from)
  }
  return [...out]
}
