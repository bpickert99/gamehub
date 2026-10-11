import type { BoxPattern, Game } from '../games/catalogue'

// A game box standing on the shelf: lid art (or a drawn pattern), a spine and a top, in CSS 3D.
export default function GameBox({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const { color, accent, ink, width, height, art, pattern } = game.box
  const depth = 46
  return (
    <button
      className={`gbox ${game.playable ? '' : 'soon'}`}
      style={{ ['--w' as string]: `${width}px`, ['--h' as string]: `${height}px`, ['--d' as string]: `${depth}px`, ['--c' as string]: color, ['--a' as string]: accent, ['--ink' as string]: ink }}
      onClick={onOpen}
      title={game.name}
    >
      <div className="gbox-3d">
        <div className="gbox-face gbox-front">
          {art ? <img className="gbox-art" src={art} alt="" /> : <Pattern kind={pattern} />}
          <div className="gbox-title">{game.logo ? <img src={game.logo} alt={game.name} /> : <span>{game.name}</span>}</div>
        </div>
        <div className="gbox-face gbox-side"><span>{game.name}</span></div>
        <div className="gbox-face gbox-top" />
      </div>
      {!game.playable && <span className="gbox-ribbon">Soon</span>}
    </button>
  )
}

// Simple drawn lids for games without art yet.
function Pattern({ kind }: { kind: BoxPattern }) {
  const a = 'var(--a)'
  switch (kind) {
    case 'stars':
      return (
        <svg className="gbox-pattern" viewBox="0 0 100 130">
          {Array.from({ length: 28 }, (_, i) => <circle key={i} cx={(i * 37) % 100} cy={(i * 53) % 130} r={(i % 3) * 0.5 + 0.4} fill="#fff" opacity="0.8" />)}
          <path d="M10 112 Q50 40 90 112" fill="none" stroke={a} strokeWidth="2.5" />
          <path d="M22 116 Q50 62 78 116" fill="none" stroke={a} strokeWidth="1.5" opacity="0.7" />
        </svg>
      )
    case 'feathers':
      return (
        <svg className="gbox-pattern" viewBox="0 0 100 100">
          <path d="M30 80 Q45 30 78 18 Q66 50 30 80 Z" fill={a} opacity="0.85" />
          <path d="M30 80 L74 22" stroke="#2c3b30" strokeWidth="1.2" />
          <circle cx="24" cy="34" r="9" fill="#d98f54" />
          <path d="M16 34 L8 32 L16 30 Z" fill="#2c3b30" />
        </svg>
      )
    case 'clocktower':
      return (
        <svg className="gbox-pattern" viewBox="0 0 80 130">
          <rect x="28" y="40" width="24" height="80" fill="#140507" />
          <path d="M24 42 L40 14 L56 42 Z" fill="#140507" />
          <circle cx="40" cy="58" r="9" fill="none" stroke={a} strokeWidth="2" />
          <path d="M40 58 L40 52 M40 58 L45 60" stroke={a} strokeWidth="1.5" />
          <circle cx="62" cy="22" r="10" fill="#ead8b5" opacity="0.85" />
        </svg>
      )
    case 'tiles':
      return (
        <svg className="gbox-pattern" viewBox="0 0 100 100">
          {[0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3, 4].map((c) => (
            <rect key={`${r}${c}`} x={12 + c * 16} y={12 + r * 16} width="13" height="13" rx="2"
              fill={['#f2c14e', '#d94b3d', '#1a1a1a', '#7fc4e8', '#ffffff'][(r + c * 2) % 5]} opacity="0.92" />
          )))}
        </svg>
      )
    case 'hexes':
      return (
        <svg className="gbox-pattern" viewBox="0 0 100 100">
          {[[50, 30], [32, 50], [68, 50], [50, 70], [32, 90], [68, 90], [14, 30], [86, 30]].map(([x, y], i) => (
            <polygon key={i} points={hex(x, y, 11)} fill={['#f4c542', '#5f8f3a', '#b8742c', '#9aa0a6', '#3f7a3a', '#e3c25b', '#b8742c', '#5f8f3a'][i]} stroke="#7a2412" strokeWidth="1.5" />
          ))}
        </svg>
      )
    default:
      return null
  }
}

function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const t = (Math.PI / 3) * i + Math.PI / 6
    return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`
  }).join(' ')
}
