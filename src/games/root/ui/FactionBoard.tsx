import { assetUrl } from '../../../assetUrl'
import { EYRIE, MARQUISE, type MarquiseBuilding } from '../data/factions'
import { FACTION_NAME } from '../engine/core'
import type { CardId, Faction, GameState } from '../engine/types'
import { CARD_BACK, VIZIER_IMAGE, cardImage, factionIcon, leaderImage, pieceImage } from './assets'

// Spaces on the printed faction boards, measured on a 1100 x 854 render and checked by overlay.
const W = 1100
const H = 854
const at = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` })
const SPACE = { width: `${(64 / W) * 100}%` }

const MARQUISE_COLS = [568, 653, 740, 826, 911, 993]
const MARQUISE_ROWS: Record<MarquiseBuilding, number> = { sawmill: 366, workshop: 452, recruiter: 538 }
const EYRIE_ROOSTS = [552, 628, 706, 784, 862, 940, 1018]
const CRAFTED_BOX: Record<Faction, { x: number; y: number; w: number }> = {
  marquise: { x: 782, y: 150, w: 248 },
  eyrie: { x: 748, y: 252, w: 268 },
}
// Decree column centres along the top band of the Eyrie board.
const DECREE_X = [125, 408, 695, 980]

type Props = { state: GameState; faction: Faction; mine: boolean; onZoom: (id: CardId) => void }

export default function FactionBoard({ state, faction, mine, onZoom }: Props) {
  const crafted = CRAFTED_BOX[faction]
  return (
    <div className={`fb fb-${faction}`}>
      <header className="fb-header">
        <h2>{FACTION_NAME[faction]}{mine && <span> (you)</span>}</h2>
        <div className="fb-stats">
          <Stat icon={pieceImage(`vp-${faction}`)} label="Victory points" value={state.score[faction]} />
          <Stat icon={factionIcon(faction)} label="Warriors in supply" value={faction === 'marquise' ? state.marquise.warriors : state.eyrie.warriors} />
          {faction === 'marquise' && <Stat icon={pieceImage('wood')} label="Wood in supply" value={state.marquise.wood} />}
          <Stat icon={CARD_BACK} label="Cards in hand" value={state.hands[faction].length} card />
        </div>
      </header>

      {faction === 'eyrie' && (
        <div className="fb-decree">
          {EYRIE.decreeColumns.map((column, i) => (
            <div key={column} className="fb-decree-col" style={{ left: `${(DECREE_X[i] / W) * 100}%` }}>
              {state.eyrie.decree[column].map((entry, j) =>
                'vizier' in entry ? (
                  <img key={j} src={VIZIER_IMAGE} alt="Loyal Vizier" />
                ) : (
                  <button key={j} onClick={() => onZoom(entry.card)}><img src={cardImage(entry.card)} alt="" /></button>
                ),
              )}
            </div>
          ))}
        </div>
      )}

      <div className="fb-board">
        <img className="fb-art" src={assetUrl(`/root/factions/${faction}-board.webp`)} alt={`${FACTION_NAME[faction]} faction board`} />

        {faction === 'marquise' &&
          (Object.keys(MARQUISE_ROWS) as MarquiseBuilding[]).map((kind) => {
            // Buildings still on the track sit on its rightmost spaces; the leftmost ones are uncovered.
            const uncovered = MARQUISE.buildingsPerType - state.marquise.track[kind]
            return MARQUISE_COLS.map((x, i) =>
              i >= uncovered ? <img key={`${kind}${i}`} className="fb-piece" src={pieceImage(kind)} alt={kind} style={{ ...at(x, MARQUISE_ROWS[kind]), ...SPACE }} /> : null,
            )
          })}

        {faction === 'eyrie' && (
          <>
            {EYRIE_ROOSTS.map((x, i) =>
              i >= EYRIE.roosts - state.eyrie.roostTrack ? <img key={i} className="fb-piece" src={pieceImage('roost')} alt="roost" style={{ ...at(x, 392), ...SPACE }} /> : null,
            )}
            {state.eyrie.leader && (
              <img className="fb-leader" src={leaderImage(state.eyrie.leader)} alt={state.eyrie.leader} style={{ ...at(934, 647), width: `${(232 / W) * 100}%` }} />
            )}
          </>
        )}

        <div className="fb-crafted" style={{ ...at(crafted.x, crafted.y), width: `${(crafted.w / W) * 100}%` }}>
          {state.crafted[faction].map((item, i) => <img key={i} src={pieceImage(item)} alt={item} title={item} />)}
        </div>
      </div>

      {state.playArea[faction].length > 0 && (
        <section className="fb-play-area">
          <h3>Crafted effects</h3>
          <div>
            {state.playArea[faction].map((id) => (
              <button key={id} onClick={() => onZoom(id)}><img src={cardImage(id)} alt="" /></button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ icon, label, value, card }: { icon: string; label: string; value: number; card?: boolean }) {
  return (
    <span className="fb-stat" title={label}>
      <img className={card ? 'fb-stat-card' : ''} src={icon} alt="" />
      <b>{value}</b>
      <small>{label}</small>
    </span>
  )
}
