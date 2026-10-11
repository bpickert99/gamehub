// Generated from the print-and-play Autumn board (board.webp, 2607x2225). Coordinates are fractions of width/height.
import { assetUrl } from '../../../assetUrl'
import type { ClearingId } from './autumnMap'
import type { Item } from './types'

export const BOARD = { image: assetUrl('/root/board.webp'), width: 2607, height: 2225 }

type Point = { x: number; y: number }

// Building slots in print order; `ruinSlot` is the slot holding the printed ruin.
export const SLOTS: Record<ClearingId, { slots: Point[]; ruinSlot: number | null }> = {
  A: { slots: [{ x: 0.0898, y: 0.1378 }], ruinSlot: null },
  B: { slots: [{ x: 0.513, y: 0.082 }, { x: 0.5648, y: 0.0746 }], ruinSlot: null },
  C: { slots: [{ x: 0.1268, y: 0.3966 }, { x: 0.0834, y: 0.4926 }], ruinSlot: null },
  D: { slots: [{ x: 0.384, y: 0.2845 }, { x: 0.4402, y: 0.3649 }], ruinSlot: 1 },
  E: { slots: [{ x: 0.3512, y: 0.5849 }, { x: 0.3097, y: 0.6371 }], ruinSlot: 0 },
  F: { slots: [{ x: 0.8705, y: 0.2337 }, { x: 0.8926, y: 0.2852 }], ruinSlot: null },
  G: { slots: [{ x: 0.6157, y: 0.484 }, { x: 0.6513, y: 0.5187 }, { x: 0.6103, y: 0.5582 }], ruinSlot: 2 },
  H: { slots: [{ x: 0.9112, y: 0.5187 }, { x: 0.8669, y: 0.5744 }], ruinSlot: 0 },
  I: { slots: [{ x: 0.3951, y: 0.9049 }, { x: 0.3786, y: 0.9699 }], ruinSlot: null },
  J: { slots: [{ x: 0.1484, y: 0.8715 }], ruinSlot: null },
  K: { slots: [{ x: 0.5796, y: 0.782 }, { x: 0.547, y: 0.8445 }], ruinSlot: null },
  L: { slots: [{ x: 0.8082, y: 0.9254 }], ruinSlot: null },
}

// The 12 printed item spaces: top row bag, boot, crossbow, sword, tea, coins; bottom row with hammer for crossbow.
export const ITEM_SPACES: { item: Item; x: number; y: number }[] = [
  { item: 'bag', x: 0.2231, y: 0.037 },
  { item: 'boot', x: 0.26, y: 0.037 },
  { item: 'crossbow', x: 0.2969, y: 0.037 },
  { item: 'sword', x: 0.3331, y: 0.037 },
  { item: 'tea', x: 0.37, y: 0.037 },
  { item: 'coins', x: 0.4062, y: 0.037 },
  { item: 'bag', x: 0.2231, y: 0.0793 },
  { item: 'boot', x: 0.26, y: 0.0793 },
  { item: 'hammer', x: 0.2969, y: 0.0793 },
  { item: 'sword', x: 0.3331, y: 0.0793 },
  { item: 'tea', x: 0.37, y: 0.0793 },
  { item: 'coins', x: 0.4062, y: 0.0793 },
]
