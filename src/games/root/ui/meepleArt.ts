import type { Faction } from '../engine/types'

// The warriors' outlines and printed faces, traced from photos of the physical pieces (pixel
// coordinates, y down). Used for the 3D meeples and the battle cutaway.

export type Cmd = readonly ['M' | 'L', number, number] | readonly ['Q', number, number, number, number]
export type MeepleArt = { outline: Cmd[]; box: { x: number; y: number; w: number; h: number }; face: string }

export const MEEPLE_COLOR: Record<Faction, string> = { marquise: '#e2702a', eyrie: '#2f5fc4' }

export const MEEPLE_ART: Record<Faction, MeepleArt> = {
  marquise: {
    // Wide body, short rounded ears at the corners, a shallow dip between them.
    outline: [
      ['M', 48, 522], ['L', 408, 522], ['L', 405, 240], ['Q', 403, 175, 378, 140], ['L', 338, 62],
      ['Q', 330, 52, 322, 60], ['L', 268, 108], ['Q', 216, 128, 165, 113], ['L', 120, 76],
      ['Q', 111, 68, 104, 78], ['L', 70, 150], ['Q', 42, 180, 40, 240],
    ],
    box: { x: 40, y: 52, w: 368, h: 470 },
    face: `<g fill="none" stroke="#14100c" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">
      <path d="M70 198 L203 252 Q200 308 140 309 Q74 306 70 198 Z"/>
      <path d="M350 194 L229 248 Q232 305 292 306 Q348 302 350 194 Z"/>
      <path d="M182 320 Q196 356 215 332 Q234 356 248 320"/></g>
      <g fill="#14100c"><path d="M128 233 L203 252 Q201 283 174 289 Q131 290 128 233 Z"/>
      <path d="M296 230 L229 248 Q231 281 258 286 Q295 286 296 230 Z"/>
      <path d="M196 291 L234 291 L215 314 Z"/></g>`,
  },
  eyrie: {
    // Flat base, upright back rising to a rounded crown, sloped front with a beak pointing left.
    outline: [
      ['M', 85, 535], ['L', 407, 535], ['L', 384, 190], ['Q', 368, 62, 296, 70],
      ['Q', 190, 84, 108, 205], ['L', 24, 290], ['L', 104, 318], ['L', 85, 535],
    ],
    box: { x: 24, y: 64, w: 383, h: 471 },
    face: `<g fill="none" stroke="#14100c" stroke-width="9" stroke-linecap="round">
      <circle cx="247" cy="266" r="50"/><path d="M212 206 Q222 176 252 188"/></g>
      <path d="M216 288 Q218 252 247 250 Q276 252 278 288 Q262 312 247 313 Q232 312 216 288 Z" fill="#14100c"/>`,
  },
}

export function outlinePath(f: Faction): string {
  return MEEPLE_ART[f].outline.map((c) => c.join(' ')).join(' ') + ' Z'
}

// A meeple as an SVG string, optionally mirrored to face left.
export function meepleSvg(f: Faction, mirror = false): string {
  const { box, face } = MEEPLE_ART[f]
  const flip = mirror ? `transform="translate(${box.x * 2 + box.w} 0) scale(-1 1)"` : ''
  return `<svg viewBox="${box.x - 10} ${box.y - 10} ${box.w + 20} ${box.h + 20}" xmlns="http://www.w3.org/2000/svg"><g ${flip}><path d="${outlinePath(f)}" fill="${MEEPLE_COLOR[f]}" stroke="#14100c" stroke-width="8" stroke-linejoin="round"/>${face}</g></svg>`
}
