import { useState } from 'react'
import type { ClearingId } from '../data/autumnMap'
import { EYRIE, type DecreeColumn, type EyrieLeader, type MarquiseBuilding } from '../data/factions'
import { card, FACTION_NAME, moveWarriors, neighbours, openSlots } from '../engine/core'
import { decreeOptions, legalMoves } from '../engine/legal'
import { entryPossible, nextColumn } from '../engine/eyrie'
import type { Action, CardId, Faction, GameState, Move, Prompt } from '../engine/types'
import { leaderImage } from './assets'
import { actionLabel, moveLabel, waitingFor } from './labels'
import { CardImage, Decree } from './Panels'

export type Ui = {
  clearing: ClearingId | null
  cards: CardId[]
  entry: { column: DecreeColumn; index: number } | null
  columns: Partial<Record<CardId, DecreeColumn>>
  firstMove: Move | null
}

export const EMPTY_UI: Ui = { clearing: null, cards: [], entry: null, columns: {}, firstMove: null }

type Props = {
  state: GameState
  me: Faction
  options: Action[]
  ui: Ui
  setUi: (ui: Ui) => void
  act: (a: Action) => void
}

export default function ActionPanel(props: Props) {
  const { state, me } = props
  if (state.winner) return <div className="root-banner">{FACTION_NAME[state.winner]} win the game!</div>
  const p = state.pending[0]
  const actor = p?.faction ?? state.current
  if (actor !== me) return <p className="root-waiting">{waitingFor(p, state)}</p>
  if (p) return <PromptPanel {...props} prompt={p} />
  if (state.step === 'birdsong') return <BirdsongPanel {...props} />
  if (state.step === 'add-to-decree') return <AddToDecree {...props} />
  if (state.step === 'daylight') return me === 'marquise' ? <MarquiseDaylight {...props} /> : <EyrieDaylight {...props} />
  return <p className="root-waiting">…</p>
}

// ---------- shared pieces ----------

function Buttons({ state, actions, act }: { state: GameState; actions: Action[]; act: (a: Action) => void }) {
  return (
    <div className="root-buttons">
      {actions.map((a, i) => <button key={i} className="secondary" onClick={() => act(a)}>{actionLabel(state, a)}</button>)}
    </div>
  )
}

function MovePicker({ moves, from, onPick, label }: { moves: Move[]; from: ClearingId | null; onPick: (m: Move) => void; label: string }) {
  const froms = [...new Set(moves.map((m) => m.from))]
  const [origin, setOrigin] = useState<ClearingId | ''>(from && froms.includes(from) ? from : '')
  const tos = [...new Set(moves.filter((m) => m.from === origin).map((m) => m.to))]
  const [dest, setDest] = useState<ClearingId | ''>('')
  const max = Math.max(0, ...moves.filter((m) => m.from === origin && m.to === dest).map((m) => m.count))
  const [count, setCount] = useState(1)
  if (moves.length === 0) return <p className="muted">No legal moves.</p>
  return (
    <div className="root-move">
      <select value={origin} onChange={(e) => { setOrigin(e.target.value as ClearingId); setDest(''); setCount(1) }}>
        <option value="">From…</option>
        {froms.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={dest} onChange={(e) => { setDest(e.target.value as ClearingId); setCount(1) }} disabled={!origin}>
        <option value="">To…</option>
        {tos.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input type="number" min={1} max={max || 1} value={count} disabled={!dest} onChange={(e) => setCount(Math.max(1, Math.min(max, Number(e.target.value))))} />
      <button disabled={!origin || !dest} onClick={() => onPick({ from: origin as ClearingId, to: dest as ClearingId, count })}>{label}</button>
    </div>
  )
}

function byClearing(actions: Action[], c: ClearingId | null): Action[] {
  if (!c) return actions
  return actions.filter((a) => 'clearing' in a && a.clearing === c)
}

function of<T extends Action['type']>(options: Action[], type: T): Extract<Action, { type: T }>[] {
  return options.filter((a): a is Extract<Action, { type: T }> => a.type === type)
}

function CardEffects({ state, options, act }: Props) {
  const effects = options.filter((a) => ['royal-claim', 'stand-and-deliver', 'codebreakers', 'tax-collector'].includes(a.type))
  if (effects.length === 0) return null
  return (
    <div className="root-section">
      <h4>Card effects</h4>
      <Buttons state={state} actions={effects} act={act} />
    </div>
  )
}

function SelectedCardActions({ state, options, ui, act }: Props) {
  const id = ui.cards[0]
  if (id === undefined) return <p className="muted">Select a card in your hand to craft or spend it.</p>
  const actions = options.filter((a) => 'card' in a && a.card === id && ['craft', 'spend-bird', 'overwork'].includes(a.type))
  return (
    <div className="root-section">
      <h4>{card(id).name}</h4>
      {actions.length === 0 && <p className="muted">Nothing to do with this card right now.</p>}
      <div className="root-buttons">
        {actions.map((a, i) => (
          <button key={i} className="secondary" onClick={() => act(a)}>
            {a.type === 'craft' ? 'Craft it' : a.type === 'spend-bird' ? 'Spend for an extra action' : actionLabel(state, a)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- prompts ----------

function PromptPanel({ prompt, ...props }: Props & { prompt: Prompt }) {
  const { state, options, act, ui } = props
  const skip = options.find((a) => a.type === 'skip')
  const skipButton = skip && <button className="secondary" onClick={() => act(skip)}>No</button>
  switch (prompt.kind) {
    case 'setup-keep':
      return <Section title="Place your keep in a corner clearing (6.3.2)"><Buttons state={state} actions={options} act={act} /></Section>
    case 'setup-buildings':
      return <SetupBuildings state={state} act={act} />
    case 'setup-leader':
    case 'choose-leader':
      return (
        <Section title="Choose your leader (7.3.3)">
          <div className="root-leaders">
            {of(options, 'choose-leader').map((a) => (
              <button key={a.leader} className="root-card" onClick={() => act(a)}><img src={leaderImage(a.leader as EyrieLeader)} alt={a.leader} /></button>
            ))}
          </div>
        </Section>
      )
    case 'place-wood':
    case 'new-roost':
    case 'removals':
      return <Section title={promptTitle(prompt)}><Buttons state={state} actions={options} act={act} /></Section>
    case 'start-effect':
      if (prompt.effect === 'command-warren') {
        return <Section title="Command Warren: battle at the start of Daylight?"><Buttons state={state} actions={of(options, 'start-effect-battle')} act={act} />{skipButton}</Section>
      }
      return (
        <Section title="Cobbler: take a move at the start of Evening?">
          <MovePicker moves={of(options, 'start-effect-move').map((a) => a.move)} from={ui.clearing} label="Move" onPick={(move) => act({ type: 'start-effect-move', move })} />
          {skipButton}
        </Section>
      )
    case 'ambush':
    case 'foil':
    case 'field-hospitals': {
      const cards = options.filter((a): a is Extract<Action, { card: CardId }> => 'card' in a)
      return (
        <Section title={promptTitle(prompt)}>
          <div className="root-hand">{cards.map((a) => <CardImage key={a.card} id={a.card} onClick={() => act(a)} />)}</div>
          {skipButton}
        </Section>
      )
    }
    case 'battle-effects':
      return <Section title="Use battle cards? (after the roll)"><Buttons state={state} actions={of(options, 'battle-effects')} act={act} />{skipButton}</Section>
    case 'discard':
      return (
        <Section title={`Discard ${prompt.count} card${prompt.count > 1 ? 's' : ''} (hand limit 5). Select them in your hand.`}>
          <button disabled={ui.cards.length !== prompt.count} onClick={() => act({ type: 'discard', cards: ui.cards })}>Discard selected</button>
        </Section>
      )
  }
}

function promptTitle(p: Prompt): string {
  switch (p.kind) {
    case 'place-wood': return 'Not enough wood for every sawmill: choose where it goes.'
    case 'new-roost': return 'A New Roost: choose a clearing (7.4.3).'
    case 'removals': return `Take ${p.hits} hit${p.hits > 1 ? 's' : ''} in ${p.clearing}: choose which pieces to remove (4.3.6).`
    case 'ambush': return 'You are being attacked. Play an ambush card? (4.3.1)'
    case 'foil': return 'Ambush! Foil it with a matching ambush card? (4.3.1.I)'
    case 'field-hospitals': return `Field Hospitals: spend a card matching ${p.clearing} to return ${p.count} warrior${p.count > 1 ? 's' : ''} to the keep? (6.2.3)`
    default: return ''
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="root-section">
      <h4>{title}</h4>
      {children}
    </div>
  )
}

function SetupBuildings({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const keep = state.marquise.keep!
  const spots = [keep, ...neighbours(keep)].filter((c) => openSlots(state, c) > 0)
  const [pick, setPick] = useState<Record<MarquiseBuilding, ClearingId>>({ sawmill: spots[0], workshop: spots[0], recruiter: spots[0] })
  return (
    <Section title="Place a sawmill, workshop and recruiter in the keep clearing or next to it (6.3.4)">
      {(['sawmill', 'workshop', 'recruiter'] as MarquiseBuilding[]).map((kind) => (
        <label key={kind} className="root-inline">
          {kind}
          <select value={pick[kind]} onChange={(e) => setPick({ ...pick, [kind]: e.target.value as ClearingId })}>
            {spots.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      ))}
      <button onClick={() => act({ type: 'setup-buildings', ...pick })}>Place buildings</button>
    </Section>
  )
}

// ---------- turn steps ----------

function BirdsongPanel(props: Props) {
  return (
    <>
      <CardEffects {...props} />
      <button onClick={() => props.act({ type: 'end-phase' })}>Continue to Daylight</button>
    </>
  )
}

function AddToDecree({ state, ui, setUi, act }: Props) {
  const chosen = ui.cards.slice(0, 2)
  const entries = chosen.map((id) => ({ card: id, column: ui.columns[id] ?? ('recruit' as DecreeColumn) }))
  const birds = chosen.filter((id) => card(id).suit === 'bird').length
  return (
    <Section title="Add one or two cards to the Decree (at most one bird). Select them in your hand.">
      {chosen.map((id) => (
        <label key={id} className="root-inline">
          {card(id).name} →
          <select value={ui.columns[id] ?? 'recruit'} onChange={(e) => setUi({ ...ui, columns: { ...ui.columns, [id]: e.target.value as DecreeColumn } })}>
            {EYRIE.decreeColumns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      ))}
      {birds > 1 && <p className="error">Only one bird card can be added each turn (7.4.2).</p>}
      <button disabled={chosen.length === 0 || birds > 1} onClick={() => act({ type: 'add-to-decree', entries })}>Add to Decree</button>
      {state.hands.eyrie.length === 0 && <p className="muted">No cards to add.</p>}
    </Section>
  )
}

function MarquiseDaylight(props: Props) {
  const { state, options, ui, setUi, act } = props
  const marchMoves = of(options, 'march').map((a) => a.moves[0])
  const secondMoves = (() => {
    if (!ui.firstMove) return []
    const draft = structuredClone(state)
    moveWarriors(draft, 'marquise', ui.firstMove.from, ui.firstMove.to, ui.firstMove.count)
    return legalMoves(draft, 'marquise')
  })()
  const recruit = of(options, 'recruit')[0]
  const end = options.find((a) => a.type === 'end-phase')
  return (
    <>
      <p><b>{state.turn.actionsLeft}</b> action{state.turn.actionsLeft === 1 ? '' : 's'} left{state.turn.craftingOpen && ' · you can still craft'}</p>
      <SelectedCardActions {...props} />
      <Section title={ui.clearing ? `In clearing ${ui.clearing}` : 'Battle, build and recruit'}>
        <Buttons state={state} actions={[...byClearing(of(options, 'battle'), ui.clearing), ...(ui.clearing ? byClearing(of(options, 'build'), ui.clearing) : [])]} act={act} />
        {!ui.clearing && of(options, 'build').length > 0 && <p className="muted">Select a clearing on the map to build there.</p>}
        {recruit && <button className="secondary" onClick={() => act(recruit)}>Recruit at every recruiter</button>}
      </Section>
      <Section title="March (up to two moves)">
        {!ui.firstMove ? (
          <MovePicker key={ui.clearing ?? ''} moves={marchMoves} from={ui.clearing} label="First move" onPick={(m) => setUi({ ...ui, firstMove: m })} />
        ) : (
          <>
            <p>First move: {moveLabel(ui.firstMove)}</p>
            <button className="secondary" onClick={() => act({ type: 'march', moves: [ui.firstMove!] })}>March with just this move</button>
            <MovePicker moves={secondMoves} from={ui.firstMove.to} label="Add second move and march" onPick={(m) => act({ type: 'march', moves: [ui.firstMove!, m] })} />
            <button className="link-button" onClick={() => setUi({ ...ui, firstMove: null })}>Cancel</button>
          </>
        )}
      </Section>
      <CardEffects {...props} />
      {end && <button onClick={() => act(end)}>End Daylight</button>}
    </>
  )
}

function EyrieDaylight(props: Props) {
  const { state, options, ui, setUi, act } = props
  const column = nextColumn(state)
  const entry = ui.entry
  const entryActions = entry ? decreeOptions(state, entry.column, entry.index) : []
  const canTurmoil = entry && !entryPossible(state, entry.column, state.eyrie.decree[entry.column][entry.index])
  const end = options.find((a) => a.type === 'end-phase')
  return (
    <>
      {state.turn.craftingOpen && <SelectedCardActions {...props} />}
      <Section title={column ? `Resolve the Decree: ${column} column. Pick a card.` : 'The Decree is resolved.'}>
        <Decree
          state={state}
          active={entry ? `${entry.column}:${entry.index}` : null}
          onEntry={(c, i) => c === column && setUi({ ...ui, entry: { column: c, index: i } })}
        />
      </Section>
      {entry && (
        <Section title={`${entry.column} in a matching clearing`}>
          {entry.column === 'move' ? (
            <MovePicker
              key={ui.clearing ?? ''}
              moves={of(entryActions, 'decree-move').map((a) => a.move)}
              from={ui.clearing}
              label="Move"
              onPick={(move) => act({ type: 'decree-move', column: entry.column, index: entry.index, move })}
            />
          ) : (
            <Buttons state={state} actions={byClearing(entryActions, ui.clearing)} act={act} />
          )}
          {canTurmoil && (
            <>
              <p className="error">This action cannot be taken. The Eyrie fall into Turmoil (7.7).</p>
              <button onClick={() => act({ type: 'turmoil', column: entry.column, index: entry.index })}>Fall into Turmoil</button>
            </>
          )}
        </Section>
      )}
      <CardEffects {...props} />
      {end && <button onClick={() => act(end)}>End Daylight</button>}
    </>
  )
}
