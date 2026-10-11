import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClearingId } from '../data/autumnMap'
import { EYRIE, type DecreeColumn } from '../data/factions'
import { card, FACTION_NAME, opponent } from '../engine/core'
import { nextColumn, entryPossible } from '../engine/eyrie'
import { actor, applyAction } from '../engine/game'
import { legalActions } from '../engine/legal'
import { marquiseDraws } from '../engine/marquise'
import type { Action, CardId, Faction, GameState } from '../engine/types'
import { parseState, sendAction, subscribeRootGame, type RootGameDoc } from '../sync'
import { CARD_BACK, VIZIER_IMAGE, cardImage, factionIcon, factionPortrait, leaderImage, pieceImage } from './assets'
import Board from './Board'
import { NONE, SETUP_ORDER, clickClearing, highlighted, verb, type Click, type Mode, type Verb } from './flow'
import { STEP_NAME, actionLabel, waitingFor } from './labels'
import { CardImage, FactionPanel, Log } from './Panels'
import './root.css'

export default function RootGame({ code, uid }: { code: string; uid: string }) {
  const [doc, setDoc] = useState<RootGameDoc | null | undefined>(undefined)
  useEffect(() => subscribeRootGame(code, setDoc), [code])
  const state = useMemo(() => (doc ? parseState(doc) : null), [doc])
  if (doc === undefined) return <div className="rg-screen rg-center"><p>Loading the Woodland…</p></div>
  if (!doc || !state) return <div className="rg-screen rg-center"><p>This room has no Root game data.</p></div>
  const me = doc.seats[uid]
  if (!me) return <div className="rg-screen rg-center"><p>You are watching this game.</p></div>
  return <Table code={code} state={state} me={me} />
}

type Popover = { clearing: ClearingId; click: Extract<Click, { kind: 'choose' | 'count' }> }
type Sheet = Faction | 'log' | null

function Table({ code, state, me }: { code: string; state: GameState; me: Faction }) {
  // Choices belong to the game state they were made in; any change to the game discards them.
  const version = `${state.log.length}:${state.pending.length}:${state.step}:${state.turn.resolved.length}`
  const [local, setLocal] = useState<{ version: string; mode: Mode; popover: Popover | null }>({ version, mode: NONE, popover: null })
  const [sheet, setSheet] = useState<Sheet>(null)
  const fresh = local.version === version
  const chosen = fresh ? local.mode : NONE
  const popover = fresh ? local.popover : null
  const setMode = (mode: Mode, pop: Popover | null = null) => setLocal({ version, mode, popover: pop })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const myMove = actor(state) === me
  const options = useMemo(() => (myMove ? legalActions(state).map((o) => o.action) : []), [state, myMove])
  const prompt = state.pending[0]
  const mode = defaultMode(state, me, myMove, chosen)
  const highlight = myMove ? highlighted(state, options, mode) : []

  async function act(action: Action) {
    setError(null)
    setBusy(true)
    setMode(NONE)
    try {
      applyAction(state, me, action) // validate locally for an immediate, readable error
      await sendAction(code, me, action)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function run(click: Click | null, c: ClearingId) {
    if (!click) return
    if (click.kind === 'act') return act(click.action)
    if (click.kind === 'mode') return setMode(click.mode)
    setMode(mode, { clearing: c, click })
  }

  function onClearing(c: ClearingId) {
    if (!myMove) return
    run(clickClearing(state, options, mode, c, (a) => actionLabel(state, a)), c)
  }

  const them = opponent(state, me)
  return (
    <div className={`rg-screen rg-${me} ${busy ? 'busy' : ''}`}>
      <Board
        state={state}
        highlight={highlight}
        selected={selectedClearing(mode)}
        onClearing={onClearing}
        popover={popover && {
          clearing: popover.clearing,
          content: <PopoverMenu popover={popover} onAct={act} onRun={(cl) => run(cl, popover.clearing)} onClose={() => setMode(mode)} />,
        }}
      />

      <div className="rg-players">
        {state.seating.map((f) => (
          <button key={f} className={`rg-player rg-player-${f} ${state.current === f ? 'current' : ''}`} onClick={() => setSheet(f)} title={FACTION_NAME[f]}>
            <img src={factionPortrait(f)} alt={FACTION_NAME[f]} />
            <span className="rg-badge rg-score">{state.score[f]}</span>
            <span className="rg-badge rg-handcount"><img src={CARD_BACK} alt="" />{state.hands[f].length}</span>
          </button>
        ))}
      </div>

      <div className="rg-top-right">
        <button className="rg-icon" onClick={() => setSheet('log')} title="Game log">📜</button>
        <Link className="rg-icon" to="/" title="Back to the hub">✕</Link>
      </div>

      <div className="rg-banner">
        <span>{bannerText(state, me, myMove, mode)}</span>
        {error && <span className="rg-error">{error}</span>}
      </div>

      <MyCorner state={state} me={me} onOpen={() => setSheet(me)} />

      <HandFan state={state} me={me} myMove={myMove} mode={mode} options={options} onMode={(m) => setMode(m)} onAct={act} />

      <ActionBar state={state} me={me} myMove={myMove} mode={mode} options={options} onMode={(m) => setMode(m)} onAct={act} />

      {myMove && prompt && <PromptDialog state={state} options={options} onAct={act} />}
      {state.turn.peek && state.current === me && !prompt && <PeekDialog key={version} cards={state.turn.peek} them={them} />}
      {state.winner && (
        <div className="rg-modal">
          <div className="rg-dialog rg-win">
            <img src={factionPortrait(state.winner)} alt="" />
            <h2>{FACTION_NAME[state.winner]} win!</h2>
            <Link to="/">Back to the hub</Link>
          </div>
        </div>
      )}

      {sheet && (
        <div className="rg-drawer-backdrop" onClick={() => setSheet(null)}>
          <div className="rg-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="rg-close" onClick={() => setSheet(null)}>✕</button>
            {sheet === 'log' ? (
              <>
                <h3>Game log</h3>
                <Log lines={state.log} />
              </>
            ) : (
              <FactionPanel state={state} faction={sheet} mine={sheet === me} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- modes and text ----------

// Choices that start without a button press: setup, the Decree, turn-start effects, discarding.
function defaultMode(state: GameState, me: Faction, myMove: boolean, mode: Mode): Mode {
  if (!myMove || mode.kind !== 'none') return mode
  const p = state.pending[0]
  if (p?.kind === 'setup-buildings') return { kind: 'setup-buildings', placed: [] }
  if (p?.kind === 'start-effect') return p.effect === 'cobbler' ? { kind: 'cobbler', from: null } : verb('battle')
  if (p?.kind === 'discard') return { kind: 'cards', cards: [] }
  if (p) return mode
  if (me === 'eyrie' && state.step === 'daylight') {
    const column = nextColumn(state)
    if (column) {
      const index = state.eyrie.decree[column].findIndex((_, i) => !state.turn.resolved.includes(`${column}:${i}`))
      return { kind: 'decree', column, index, from: null }
    }
  }
  if (state.step === 'add-to-decree') return { kind: 'decree-add', staged: [], card: null }
  return mode
}

function selectedClearing(mode: Mode): ClearingId | null {
  if (mode.kind === 'verb' || mode.kind === 'decree' || mode.kind === 'cobbler') return mode.from
  return null
}

const VERB_TEXT: Record<Verb, string> = {
  battle: 'Choose a clearing to battle in.',
  march: 'Choose a clearing to move warriors from.',
  recruit: 'Recruit at every recruiter.',
  build: 'Choose a clearing you rule to build in.',
  overwork: 'Choose a sawmill clearing to overwork.',
}

function bannerText(state: GameState, me: Faction, myMove: boolean, mode: Mode): string {
  if (state.winner) return `${FACTION_NAME[state.winner]} win the game!`
  const p = state.pending[0]
  if (!myMove) {
    const b = state.battle
    const dice = b && (b.step === 'effects' || b.step === 'deal') ? ` (rolled ${b.high} and ${b.low})` : ''
    const fight = b ? `${FACTION_NAME[b.attacker]} attack ${FACTION_NAME[b.defender]} in ${b.clearing}${dice}. ` : ''
    return fight + waitingFor(p, state)
  }
  switch (mode.kind) {
    case 'setup-buildings':
      return `Choose a clearing for your ${SETUP_ORDER[mode.placed.length]}.`
    case 'verb':
      if (mode.verb === 'march') {
        if (mode.from) return `March: choose where to move to (${mode.first ? 'second' : 'first'} move).`
        return mode.first ? 'Choose a clearing for a second move, or press ▶ to march with one.' : VERB_TEXT.march
      }
      if (p?.kind === 'start-effect') return 'Command Warren: choose a clearing to battle in, or press ▶ to skip.'
      return VERB_TEXT[mode.verb]
    case 'decree': {
      const entry = state.eyrie.decree[mode.column][mode.index]
      if (!entryPossible(state, mode.column, entry)) return `The Decree demands you ${mode.column}, but you cannot. Press ▶ to fall into Turmoil.`
      if (mode.column === 'move') return mode.from ? 'Decree: choose where to move to.' : 'Decree: choose a matching clearing to move warriors from.'
      return `Decree: choose a matching clearing to ${mode.column} in.`
    }
    case 'cobbler':
      return mode.from ? 'Cobbler: choose where to move to.' : 'Cobbler: choose a clearing to move from, or press ▶ to skip.'
    case 'tax':
      return 'Tax Collector: choose a clearing to remove one of your warriors.'
    case 'decree-add':
      return mode.card !== null ? 'Now choose a Decree column for that card.' : 'Add one or two cards to the Decree: pick a card, then a column. Press ▶ when done.'
    case 'cards':
      return p?.kind === 'discard' ? `Discard ${p.count} card${p.count > 1 ? 's' : ''}: select them, then press ▶.` : ''
  }
  if (p?.kind === 'setup-keep') return 'Choose a corner clearing for your keep.'
  if (p?.kind === 'new-roost') return 'A New Roost: choose a clearing.'
  if (p) return waitingFor(p, state)
  if (state.step === 'birdsong') return 'Birdsong: use a card effect, or press ▶ to continue to Daylight.'
  if (state.step === 'daylight' && me === 'marquise') {
    if (state.turn.craftingOpen) return 'Daylight: craft from your hand first, or choose an action.'
    return `Daylight: choose an action (${state.turn.actionsLeft} left), or press ▶ to end.`
  }
  if (state.step === 'daylight') return 'Daylight: press ▶ to end Daylight.'
  return STEP_NAME[state.step]
}

// ---------- bottom-left: my faction ----------

function MyCorner({ state, me, onOpen }: { state: GameState; me: Faction; onOpen: () => void }) {
  const warriors = me === 'marquise' ? state.marquise.warriors : state.eyrie.warriors
  return (
    <button className={`rg-me rg-me-${me}`} onClick={onOpen} title="Open your faction board">
      <img className="rg-me-portrait" src={factionPortrait(me)} alt="" />
      <span className="rg-badge rg-score">{state.score[me]}</span>
      <div className="rg-me-stats">
        <span><img src={factionIcon(me)} alt="warriors" />{warriors}</span>
        {me === 'marquise' ? (
          <>
            <span><img src={pieceImage('wood')} alt="wood" />{state.marquise.wood}</span>
            <span title="Cards drawn in Evening"><img className="rg-me-card" src={CARD_BACK} alt="draw" />{marquiseDraws(state)}</span>
          </>
        ) : (
          <span><img src={pieceImage('roost')} alt="roosts" />{state.eyrie.roostTrack}</span>
        )}
      </div>
    </button>
  )
}

// ---------- bottom-centre: the hand ----------

type BarProps = { state: GameState; me: Faction; myMove: boolean; mode: Mode; options: Action[]; onMode: (m: Mode) => void; onAct: (a: Action) => void }

function HandFan({ state, me, myMove, mode, options, onMode, onAct }: BarProps) {
  const hand = state.hands[me]
  const [menu, setMenu] = useState<CardId | null>(null)
  const open = menu !== null && hand.includes(menu) && mode.kind !== 'cards' && mode.kind !== 'decree-add' ? menu : null
  const selected = mode.kind === 'cards' ? mode.cards : mode.kind === 'decree-add' ? [...mode.staged.map((s) => s.card), ...(mode.card !== null ? [mode.card] : [])] : open !== null ? [open] : []

  function click(id: CardId) {
    if (mode.kind === 'cards' && myMove) {
      const p = state.pending[0]
      const max = p?.kind === 'discard' ? p.count : 1
      const has = mode.cards.includes(id)
      return onMode({ kind: 'cards', cards: has ? mode.cards.filter((c) => c !== id) : [...mode.cards, id].slice(-max) })
    }
    if (mode.kind === 'decree-add' && myMove) {
      if (mode.staged.some((s) => s.card === id)) return onMode({ ...mode, staged: mode.staged.filter((s) => s.card !== id) })
      if (mode.staged.length >= 2) return
      if (mode.card === null && mode.staged.length === 1 && card(id).suit === 'bird' && card(mode.staged[0].card).suit === 'bird') return
      return onMode({ ...mode, card: mode.card === id ? null : id })
    }
    setMenu(open === id ? null : id)
  }

  const cardActions = open !== null ? options.filter((a) => 'card' in a && a.card === open && ['craft', 'spend-bird', 'overwork'].includes(a.type)) : []
  const has = (t: string) => cardActions.some((a) => a.type === t)
  return (
    <div className="rg-hand" style={{ ['--n' as string]: hand.length }}>
      {hand.map((id, i) => (
        <button key={id} className={`rg-hand-card ${selected.includes(id) ? 'selected' : ''}`} style={{ ['--i' as string]: i }} onClick={() => click(id)} title={card(id).name}>
          <img src={cardImage(id)} alt={card(id).name} />
        </button>
      ))}
      {open !== null && (
        <div className="rg-card-menu">
          <img src={cardImage(open)} alt={card(open).name} />
          <div className="rg-card-menu-actions">
            {cardActions.length === 0 && <p>Nothing to do with this card right now.</p>}
            {has('craft') && <button onClick={() => { setMenu(null); onAct({ type: 'craft', card: open }) }}>Craft</button>}
            {has('spend-bird') && <button onClick={() => { setMenu(null); onAct({ type: 'spend-bird', card: open }) }}>Spend for an extra action</button>}
            {has('overwork') && <button onClick={() => { setMenu(null); onMode(verb('overwork', open)) }}>Overwork with it</button>}
            <button className="rg-plain" onClick={() => setMenu(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- bottom-right: actions ----------

const VERB_ICON: Record<Verb, string> = {
  battle: pieceImage('sword'), march: pieceImage('boot'), recruit: factionIcon('marquise'), build: pieceImage('sawmill'), overwork: pieceImage('wood'),
}
const COLUMN_ICON: Record<DecreeColumn, string> = {
  recruit: factionIcon('eyrie'), move: pieceImage('boot'), battle: pieceImage('sword'), build: pieceImage('roost'),
}

function ActionBar({ state, me, myMove, mode, options, onMode, onAct }: BarProps) {
  const go = myMove ? continueAction(state, me, mode, options) : null
  const effects = options.filter((a) => ['royal-claim', 'stand-and-deliver', 'codebreakers'].includes(a.type))
  const tax = options.some((a) => a.type === 'tax-collector')
  const [showEffects, setShowEffects] = useState(false)
  const verbsOpen = myMove && !state.pending[0] && state.step === 'daylight'
  return (
    <div className={`rg-bar rg-bar-${me}`}>
      {me === 'marquise' ? (
        <div className="rg-verbs">
          {(['battle', 'march', 'recruit', 'build', 'overwork'] as Verb[]).map((v) => {
            const active = mode.kind === 'verb' && mode.verb === v
            return (
              <button
                key={v}
                className={`rg-verb ${active ? 'active' : ''}`}
                disabled={!verbsOpen || !options.some((a) => a.type === v)}
                onClick={() => (v === 'recruit' ? onAct(options.find((a) => a.type === 'recruit')!) : onMode(active ? NONE : verb(v)))}
              >
                <img src={VERB_ICON[v]} alt="" />
                <span>{v}</span>
              </button>
            )
          })}
          {state.current === 'marquise' && state.step === 'daylight' && (
            <div className="rg-pips" title={`${state.turn.actionsLeft} actions left`}>
              {Array.from({ length: state.turn.actionsLeft }, (_, i) => <span key={i} />)}
            </div>
          )}
        </div>
      ) : (
        <DecreeBar state={state} mode={mode} myMove={myMove} onMode={onMode} />
      )}
      <div className="rg-bar-end">
        {(effects.length > 0 || tax) && (
          <div className="rg-effects">
            <button className="rg-icon" onClick={() => setShowEffects(!showEffects)} title="Card effects">★</button>
            {showEffects && (
              <div className="rg-effects-menu">
                {effects.map((a, i) => <button key={i} onClick={() => { setShowEffects(false); onAct(a) }}>{actionLabel(state, a)}</button>)}
                {tax && <button onClick={() => { setShowEffects(false); onMode({ kind: 'tax' }) }}>Tax Collector</button>}
              </div>
            )}
          </div>
        )}
        <div className={`rg-sun rg-sun-${STEP_NAME[state.step].split(' ')[0].toLowerCase()}`} title={STEP_NAME[state.step]} />
        <button className="rg-go" disabled={!go} onClick={() => go && onAct(go)} title="Continue">▶</button>
      </div>
    </div>
  )
}

function DecreeBar({ state, mode, myMove, onMode }: { state: GameState; mode: Mode; myMove: boolean; onMode: (m: Mode) => void }) {
  const staged = mode.kind === 'decree-add' ? mode.staged : []
  const pick = mode.kind === 'decree-add' && myMove ? mode.card : null
  const resolving = state.current === 'eyrie' && state.step === 'daylight'
  const current = resolving ? nextColumn(state) : null
  return (
    <div className="rg-decree">
      {state.eyrie.leader && <img className="rg-leader" src={leaderImage(state.eyrie.leader)} alt={state.eyrie.leader} />}
      {EYRIE.decreeColumns.map((column) => (
        <div key={column} className={`rg-column ${pick !== null ? 'droppable' : ''} ${current === column ? 'current' : ''}`}>
          <button
            className="rg-column-head"
            disabled={pick === null}
            onClick={() => mode.kind === 'decree-add' && pick !== null && onMode({ kind: 'decree-add', staged: [...mode.staged, { card: pick, column }], card: null })}
          >
            <img src={COLUMN_ICON[column]} alt="" />
            <span>{column}</span>
          </button>
          <div className="rg-column-cards">
            {state.eyrie.decree[column].map((entry, index) => {
              const key = `${column}:${index}`
              const done = resolving && state.turn.resolved.includes(key)
              const active = mode.kind === 'decree' && mode.column === column && mode.index === index
              return (
                <button
                  key={key}
                  className={`rg-decree-card ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                  disabled={!myMove || done || current !== column}
                  onClick={() => onMode({ kind: 'decree', column, index, from: null })}
                >
                  <img src={'vizier' in entry ? VIZIER_IMAGE : cardImage(entry.card)} alt="" />
                </button>
              )
            })}
            {staged.filter((s) => s.column === column).map((s) => (
              <span key={s.card} className="rg-decree-card staged"><img src={cardImage(s.card)} alt="" /></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// The ▶ button: end the phase, confirm a selection, fall into Turmoil, or skip an optional effect.
function continueAction(state: GameState, me: Faction, mode: Mode, options: Action[]): Action | null {
  const p = state.pending[0]
  if (mode.kind === 'verb' && mode.verb === 'march' && mode.first) return { type: 'march', moves: [mode.first] }
  if (mode.kind === 'decree-add') return mode.staged.length > 0 ? { type: 'add-to-decree', entries: mode.staged } : null
  if (mode.kind === 'cards' && p?.kind === 'discard') return mode.cards.length === p.count ? { type: 'discard', cards: mode.cards } : null
  if (mode.kind === 'decree') {
    const entry = state.eyrie.decree[mode.column][mode.index]
    return entry && !entryPossible(state, mode.column, entry) ? { type: 'turmoil', column: mode.column, index: mode.index } : null
  }
  if (p) return options.find((a) => a.type === 'skip') ?? null
  if (me === 'eyrie' && state.step === 'daylight' && nextColumn(state)) return null
  return options.find((a) => a.type === 'end-phase') ?? null
}

// ---------- popovers and dialogs ----------

function PopoverMenu({ popover, onAct, onRun, onClose }: { popover: Popover; onAct: (a: Action) => void; onRun: (c: Click) => void; onClose: () => void }) {
  const click = popover.click
  if (click.kind === 'choose') {
    return (
      <>
        {click.options.map((o, i) => <button key={i} onClick={() => onAct(o.action)}>{o.label}</button>)}
        <button className="rg-plain" onClick={onClose}>Cancel</button>
      </>
    )
  }
  return (
    <>
      <span>How many warriors?</span>
      <div className="rg-counts">
        {Array.from({ length: click.max }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onRun(click.finish({ ...click.move, count: n }))}>{n}</button>
        ))}
      </div>
      <button className="rg-plain" onClick={onClose}>Cancel</button>
    </>
  )
}

function PromptDialog({ state, options, onAct }: { state: GameState; options: Action[]; onAct: (a: Action) => void }) {
  const p = state.pending[0]
  const skip = options.find((a) => a.type === 'skip')
  const no = skip && <button className="rg-plain" onClick={() => onAct(skip)}>No</button>
  const dialog = (title: string, body: React.ReactNode) => (
    <div className="rg-modal">
      <div className="rg-dialog">
        <h3>{title}</h3>
        {body}
      </div>
    </div>
  )
  switch (p.kind) {
    case 'setup-leader':
    case 'choose-leader':
      return dialog('Choose your leader', (
        <div className="rg-dialog-cards">
          {options.flatMap((a) => (a.type === 'choose-leader' ? [a] : [])).map((a) => (
            <button key={a.leader} className="rg-dialog-card" onClick={() => onAct(a)}><img src={leaderImage(a.leader)} alt={a.leader} /></button>
          ))}
        </div>
      ))
    case 'ambush':
    case 'foil':
    case 'field-hospitals': {
      const title =
        p.kind === 'ambush' ? 'You are attacked! Play an ambush card?'
        : p.kind === 'foil' ? 'Ambush! Foil it with your own ambush card?'
        : `Field Hospitals: spend a card matching ${p.clearing} to return ${p.count} warrior${p.count > 1 ? 's' : ''} to the keep?`
      return dialog(title, (
        <>
          <div className="rg-dialog-cards">
            {options.flatMap((a) => ('card' in a ? [a] : [])).map((a) => (
              <button key={a.card} className="rg-dialog-card" onClick={() => onAct(a)}><img src={cardImage(a.card)} alt={card(a.card).name} /></button>
            ))}
          </div>
          {no}
        </>
      ))
    }
    case 'battle-effects':
      return dialog('Use battle cards?', (
        <div className="rg-dialog-buttons">
          {options.filter((a) => a.type === 'battle-effects').map((a, i) => <button key={i} onClick={() => onAct(a)}>{actionLabel(state, a)}</button>)}
          {no}
        </div>
      ))
    case 'removals':
      return dialog(`You take ${p.hits} hit${p.hits > 1 ? 's' : ''} in ${p.clearing}. Which pieces are removed?`, (
        <div className="rg-dialog-buttons">
          {options.map((a, i) => <button key={i} onClick={() => onAct(a)}>{actionLabel(state, a)}</button>)}
        </div>
      ))
    case 'place-wood':
      return dialog('Not enough wood for every sawmill', (
        <div className="rg-dialog-buttons">
          {options.map((a, i) => <button key={i} onClick={() => onAct(a)}>{actionLabel(state, a)}</button>)}
        </div>
      ))
    default:
      return null
  }
}

function PeekDialog({ cards, them }: { cards: CardId[]; them: Faction }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div className="rg-modal" onClick={() => setOpen(false)}>
      <div className="rg-dialog">
        <h3>Codebreakers: {FACTION_NAME[them]}'s hand</h3>
        <div className="rg-dialog-cards">{cards.map((id) => <CardImage key={id} id={id} />)}</div>
        <button className="rg-plain">Close</button>
      </div>
    </div>
  )
}
