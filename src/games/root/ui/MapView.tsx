import { CLEARINGS, PATHS, type ClearingId } from '../data/autumnMap'
import { CLEARING_IDS, openSlots, ruler } from '../engine/core'
import type { GameState } from '../engine/types'
import { clearingArt, factionIcon, pieceImage, suitIcon } from './assets'

type Props = {
  state: GameState
  selected: ClearingId | null
  highlight: ClearingId[]
  onSelect: (c: ClearingId) => void
}

// A custom map: the Autumn clearings and paths, each clearing shown with its art from the board.
export default function MapView({ state, selected, highlight, onSelect }: Props) {
  return (
    <div className="root-map">
      <svg className="root-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
        {PATHS.map(([a, b]) => (
          <line key={a + b} x1={CLEARINGS[a].x * 100} y1={CLEARINGS[a].y * 100} x2={CLEARINGS[b].x * 100} y2={CLEARINGS[b].y * 100} />
        ))}
      </svg>
      {CLEARING_IDS.map((c) => (
        <Clearing
          key={c}
          state={state}
          id={c}
          selected={selected === c}
          highlighted={highlight.includes(c)}
          onSelect={() => onSelect(c)}
        />
      ))}
    </div>
  )
}

function Clearing({ state, id, selected, highlighted, onSelect }: { state: GameState; id: ClearingId; selected: boolean; highlighted: boolean; onSelect: () => void }) {
  const info = CLEARINGS[id]
  const cs = state.clearings[id]
  const ruledBy = ruler(state, id)
  const empty = openSlots(state, id)
  const classes = ['root-clearing', selected && 'selected', highlighted && 'highlighted', ruledBy && `ruled-${ruledBy}`].filter(Boolean).join(' ')
  return (
    <button className={classes} style={{ left: `${info.x * 100}%`, top: `${info.y * 100}%` }} onClick={onSelect} title={`Clearing ${id}`}>
      <img className="root-clearing-art" src={clearingArt(id)} alt="" />
      <img className="root-suit" src={suitIcon(info.suit)} alt={info.suit} />
      <span className="root-clearing-id">{id}</span>
      <div className="root-slots">
        {cs.buildings.map((b, i) => <img key={`b${i}`} className="root-piece" src={pieceImage(b.kind)} alt={b.kind} />)}
        {Array.from({ length: cs.ruins }, (_, i) => <img key={`r${i}`} className="root-piece" src={pieceImage('ruin')} alt="ruin" />)}
        {Array.from({ length: empty }, (_, i) => <span key={`e${i}`} className="root-slot-empty" />)}
      </div>
      <div className="root-tokens">
        {cs.tokens.map((t, i) => <img key={i} className="root-token" src={pieceImage(t.kind)} alt={t.kind} />)}
      </div>
      <div className="root-warriors">
        {(['marquise', 'eyrie'] as const).map((f) =>
          cs.warriors[f] > 0 ? (
            <span key={f} className="root-warrior">
              <img src={factionIcon(f)} alt={f} />
              <b>{cs.warriors[f]}</b>
            </span>
          ) : null,
        )}
      </div>
    </button>
  )
}
