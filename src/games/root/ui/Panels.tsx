import { EYRIE, MARQUISE, type MarquiseBuilding } from '../data/factions'
import { card, FACTION_NAME } from '../engine/core'
import type { CardId, Faction, GameState } from '../engine/types'
import { CARD_BACK, VIZIER_IMAGE, cardImage, factionPortrait, leaderImage, pieceImage, vpMarker } from './assets'

export function CardImage({ id, selected, onClick, small }: { id: CardId; selected?: boolean; onClick?: () => void; small?: boolean }) {
  const c = card(id)
  return (
    <button className={`root-card ${small ? 'small' : ''} ${selected ? 'selected' : ''}`} onClick={onClick} disabled={!onClick} title={c.name}>
      <img src={cardImage(id)} alt={c.name} />
    </button>
  )
}

export function Hand({ cards, selected, onToggle }: { cards: CardId[]; selected: CardId[]; onToggle: (id: CardId) => void }) {
  return (
    <div className="root-hand">
      {cards.length === 0 && <p className="muted">No cards in hand.</p>}
      {cards.map((id) => <CardImage key={id} id={id} selected={selected.includes(id)} onClick={() => onToggle(id)} />)}
    </div>
  )
}

export function FactionPanel({ state, faction, mine }: { state: GameState; faction: Faction; mine: boolean }) {
  return (
    <section className={`root-faction root-faction-${faction}`}>
      <header>
        <img className="root-portrait" src={factionPortrait(faction)} alt="" />
        <div>
          <h3>{FACTION_NAME[faction]}{mine && ' (you)'}</h3>
          <div className="root-score">
            <img src={vpMarker(faction)} alt="VP" /> <b>{state.score[faction]}</b>
            <span className="muted"> · {faction === 'marquise' ? state.marquise.warriors : state.eyrie.warriors} warriors in supply</span>
          </div>
          {!mine && (
            <div className="root-backs" title="Cards in hand">
              {state.hands[faction].map((_, i) => <img key={i} src={CARD_BACK} alt="" />)}
              <span className="muted">{state.hands[faction].length} in hand</span>
            </div>
          )}
        </div>
      </header>
      {faction === 'marquise' ? <MarquiseBoard state={state} /> : <EyrieBoard state={state} />}
      {state.playArea[faction].length > 0 && (
        <div className="root-row">
          <span className="root-label">Play area</span>
          {state.playArea[faction].map((id) => <CardImage key={id} id={id} small />)}
        </div>
      )}
      {state.crafted[faction].length > 0 && (
        <div className="root-row">
          <span className="root-label">Crafted items</span>
          {state.crafted[faction].map((item, i) => <img key={i} className="root-item" src={pieceImage(item)} alt={item} />)}
        </div>
      )}
    </section>
  )
}

function MarquiseBoard({ state }: { state: GameState }) {
  const rows: MarquiseBuilding[] = ['sawmill', 'workshop', 'recruiter']
  return (
    <div className="root-tracks">
      <div className="root-track-row">
        <span className="root-label">Cost</span>
        {MARQUISE.buildCost.map((c, i) => <span key={i} className="root-track-cell cost">{c}<img src={pieceImage('wood')} alt="wood" /></span>)}
      </div>
      {rows.map((kind) => {
        const uncovered = MARQUISE.buildingsPerType - state.marquise.track[kind]
        return (
          <div key={kind} className="root-track-row">
            <span className="root-label">{kind}s</span>
            {MARQUISE.tracks[kind].map((sp, i) => (
              <span key={i} className="root-track-cell">
                {i < uncovered ? <span className="vp">{i === 0 ? '' : `+${sp.vp}`}{sp.draw && ' 🂠'}</span> : <img src={pieceImage(kind)} alt={kind} />}
              </span>
            ))}
          </div>
        )
      })}
      <div className="root-row">
        <img className="root-item" src={pieceImage('wood')} alt="wood" /> {state.marquise.wood} wood in supply
        {!state.marquise.keep && <span className="muted"> · the keep has been destroyed</span>}
      </div>
    </div>
  )
}

function EyrieBoard({ state }: { state: GameState }) {
  const uncovered = EYRIE.roosts - state.eyrie.roostTrack
  return (
    <div className="root-tracks">
      <div className="root-track-row">
        <span className="root-label">Roosts</span>
        {EYRIE.roostTrack.map((sp, i) => (
          <span key={i} className="root-track-cell">
            {i < uncovered ? <span className="vp">+{sp.vp}{sp.draw && ' 🂠'}</span> : <img src={pieceImage('roost')} alt="roost" />}
          </span>
        ))}
      </div>
      <div className="root-row root-decree-row">
        {state.eyrie.leader && <img className="root-leader" src={leaderImage(state.eyrie.leader)} alt={state.eyrie.leader} />}
        <Decree state={state} />
      </div>
    </div>
  )
}

export function Decree({ state, onEntry, active }: { state: GameState; onEntry?: (column: (typeof EYRIE.decreeColumns)[number], index: number) => void; active?: string | null }) {
  return (
    <div className="root-decree">
      {EYRIE.decreeColumns.map((column) => (
        <div key={column} className="root-decree-col">
          <span className="root-label">{column}</span>
          {state.eyrie.decree[column].map((entry, index) => {
            const key = `${column}:${index}`
            const done = state.turn.resolved.includes(key) && state.current === 'eyrie'
            return (
              <button
                key={key}
                className={`root-card small ${done ? 'done' : ''} ${active === key ? 'selected' : ''}`}
                onClick={onEntry ? () => onEntry(column, index) : undefined}
                disabled={!onEntry || done}
              >
                <img src={'vizier' in entry ? VIZIER_IMAGE : cardImage(entry.card)} alt="" />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function Log({ lines }: { lines: string[] }) {
  return (
    <div className="root-log">
      {lines.slice(-40).reverse().map((l, i) => <p key={i} className={l.startsWith('—') ? 'turn' : ''}>{l}</p>)}
    </div>
  )
}
