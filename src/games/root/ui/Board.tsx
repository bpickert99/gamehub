import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CLEARINGS, type ClearingId } from '../data/autumnMap'
import { BOARD, ITEM_SPACES, SLOTS } from '../data/autumnLayout'
import type { Item } from '../data/types'
import { CLEARING_IDS, ruler } from '../engine/core'
import type { Faction, GameState } from '../engine/types'
import { factionIcon, pieceImage, suitIcon } from './assets'

// The clearing's open ground, in board fractions. Clearing coordinates were measured on the full
// board including the score track, which board.webp crops off (2391 → 2225 px tall).
export function anchor(c: ClearingId): { x: number; y: number } {
  return { x: CLEARINGS[c].x, y: (CLEARINGS[c].y * 2391) / BOARD.height }
}

type View = { scale: number; x: number; y: number }

type Props = {
  state: GameState
  highlight: ClearingId[]
  selected: ClearingId | null
  onClearing: (c: ClearingId) => void
  // Rendered at a clearing, unscaled, e.g. a choice menu.
  popover: { clearing: ClearingId; content: ReactNode } | null
}

export default function Board({ state, highlight, selected, onClearing, popover }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ scale: 0.3, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: number; pinch: number | null }>({ moved: 0, pinch: null })

  // Space taken by the overlays around the edges. The board starts inside it and can be dragged
  // past the edges by this much, so nothing stays hidden under the action bar or the players.
  const insets = (width: number) => (width < 760 ? { top: 110, right: 8, bottom: 200, left: 8 } : { top: 70, right: 70, bottom: 150, left: 96 })

  // Start with the whole board in view (zoomed in a little on phones, like the app).
  useLayoutEffect(() => {
    const el = frame.current!
    const fit = () => {
      const { width, height } = el.getBoundingClientRect()
      const pad = insets(width)
      const w = width - pad.left - pad.right
      const h = height - pad.top - pad.bottom
      const contain = Math.min(w / BOARD.width, h / BOARD.height)
      const scale = width < 760 ? Math.min(h / BOARD.height, contain * 2.2) : contain
      setView({ scale, x: pad.left + (w - BOARD.width * scale) / 2, y: pad.top + (h - BOARD.height * scale) / 2 })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Keep the board within reach: its edges can be dragged up to the overlays, never further.
  const clamp = (v: View): View => {
    const { width, height } = frame.current!.getBoundingClientRect()
    const pad = insets(width)
    const scale = Math.min(2, Math.max(Math.min(width / BOARD.width, height / BOARD.height) * 0.6, v.scale))
    const axis = (pos: number, size: number, frameSize: number, lo: number, hi: number) => {
      const min = frameSize - hi - size
      const max = lo
      return min <= max ? Math.min(max, Math.max(min, pos)) : Math.min(min, Math.max(max, pos))
    }
    return {
      scale,
      x: axis(v.x, BOARD.width * scale, width, pad.left, pad.right),
      y: axis(v.y, BOARD.height * scale, height, pad.top, pad.bottom),
    }
  }

  const zoomAt = (factor: number, px: number, py: number) =>
    setView((v) => {
      const scale = v.scale * factor
      return clamp({ scale, x: px - ((px - v.x) * scale) / v.scale, y: py - ((py - v.y) * scale) / v.scale })
    })

  useEffect(() => {
    const el = frame.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) gesture.current = { moved: 0, pinch: null }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, next)
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const r = frame.current!.getBoundingClientRect()
      if (gesture.current.pinch) zoomAt(dist / gesture.current.pinch, (pts[0].x + pts[1].x) / 2 - r.left, (pts[0].y + pts[1].y) / 2 - r.top)
      gesture.current.pinch = dist
      gesture.current.moved += 10
      return
    }
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    gesture.current.moved += Math.abs(dx) + Math.abs(dy)
    if (gesture.current.moved > 6) setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current.pinch = null
  }

  // A clearing click only counts if the pointer did not drag the map.
  const click = (c: ClearingId) => () => {
    if (gesture.current.moved <= 6) onClearing(c)
  }

  const zoomButton = (factor: number) => () => {
    const r = frame.current!.getBoundingClientRect()
    zoomAt(factor, r.width / 2, r.height / 2)
  }

  return (
    <div
      ref={frame}
      className="rb-frame"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="rb-layer"
        style={{ width: BOARD.width, height: BOARD.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        <img className="rb-image" src={BOARD.image} alt="The Autumn map" draggable={false} />
        <ItemSupply state={state} />
        {CLEARING_IDS.map((c) => (
          <ClearingPieces key={c} state={state} id={c} />
        ))}
        {CLEARING_IDS.map((c) => {
          const a = anchor(c)
          const on = highlight.includes(c)
          return (
            <button
              key={c}
              className={`rb-target ${on ? 'on' : ''} ${selected === c ? 'selected' : ''}`}
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
              onClick={click(c)}
              aria-label={`Clearing ${c}`}
            />
          )
        })}
        {popover && (
          <div className="rb-popover-anchor" style={{ left: `${anchor(popover.clearing).x * 100}%`, top: `${anchor(popover.clearing).y * 100}%`, transform: `scale(${1 / view.scale})` }}>
            <div className="rb-popover" onPointerDown={(e) => e.stopPropagation()}>{popover.content}</div>
          </div>
        )}
      </div>
      <div className="rb-zoom">
        <button onClick={zoomButton(1.3)} aria-label="Zoom in">+</button>
        <button onClick={zoomButton(1 / 1.3)} aria-label="Zoom out">−</button>
      </div>
    </div>
  )
}

function ItemSupply({ state }: { state: GameState }) {
  // Items still in the supply sit on their printed spaces; crafted ones leave a space empty.
  const left: Partial<Record<Item, number>> = { ...state.itemSupply }
  return (
    <>
      {ITEM_SPACES.map((sp, i) => {
        if (!left[sp.item]) return null
        left[sp.item]! -= 1
        return <img key={i} className="rb-item" src={pieceImage(sp.item)} alt={sp.item} style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }} />
      })}
    </>
  )
}

const RULER_COLOR: Record<Faction, string> = { marquise: '#d9662b', eyrie: '#3f63c8' }

function ClearingPieces({ state, id }: { state: GameState; id: ClearingId }) {
  const cs = state.clearings[id]
  const layout = SLOTS[id]
  const a = anchor(id)
  // The printed ruin slot shows the ruin while it stands; buildings fill the other slots in order.
  const free = layout.slots.map((_, i) => i).filter((i) => !(cs.ruins > 0 && i === layout.ruinSlot))
  const ruled = ruler(state, id)
  const warriors = (['marquise', 'eyrie'] as Faction[]).filter((f) => cs.warriors[f] > 0)
  return (
    <>
      {cs.ruins > 0 && layout.ruinSlot !== null && (
        <img className="rb-building" src={pieceImage('ruin')} alt="ruin" style={pos(layout.slots[layout.ruinSlot])} />
      )}
      {cs.buildings.map((b, i) => (
        <img key={i} className="rb-building" src={pieceImage(b.kind)} alt={b.kind} style={pos(layout.slots[free[i]])} />
      ))}
      <div className="rb-banner" style={pos({ x: a.x + 0.045, y: a.y - 0.055 })}>
        <div className="rb-diamond"><img src={suitIcon(CLEARINGS[id].suit)} alt={CLEARINGS[id].suit} /></div>
        <div className="rb-ribbon" style={{ background: ruled ? RULER_COLOR[ruled] : '#cdbb94' }} />
      </div>
      <div className="rb-stack" style={pos({ x: a.x, y: a.y + 0.015 })}>
        {cs.tokens.map((t, i) => <img key={`t${i}`} className="rb-token" src={pieceImage(t.kind)} alt={t.kind} />)}
        {warriors.map((f) => (
          <div key={f} className={`rb-warrior rb-warrior-${f}`}>
            <img src={factionIcon(f)} alt={f} />
            <span>{cs.warriors[f]}</span>
          </div>
        ))}
      </div>
    </>
  )
}

const pos = (p: { x: number; y: number }) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%` })
