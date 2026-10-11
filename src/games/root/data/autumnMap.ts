import type { ClearingSuit } from './types'

// Read from the print-and-play Autumn board and checked by overlaying this data on the board art.
// x/y are the clearing's centre as a fraction of the board image's width/height.
export type Clearing = {
  id: ClearingId
  suit: ClearingSuit
  slots: number
  ruins: number
  corner: boolean
  x: number
  y: number
}

export type ClearingId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

const W = 2173
const H = 1992

function clearing(id: ClearingId, suit: ClearingSuit, slots: number, ruins: number, corner: boolean, px: number, py: number): Clearing {
  return { id, suit, slots, ruins, corner, x: px / W, y: py / H }
}

export const CLEARINGS: Record<ClearingId, Clearing> = {
  A: clearing('A', 'fox', 1, 0, true, 230, 300),
  B: clearing('B', 'rabbit', 2, 0, false, 1170, 170),
  C: clearing('C', 'mouse', 2, 0, false, 230, 820),
  D: clearing('D', 'rabbit', 2, 1, false, 870, 600),
  E: clearing('E', 'fox', 2, 1, false, 700, 1150),
  F: clearing('F', 'mouse', 2, 0, true, 1910, 480),
  G: clearing('G', 'mouse', 3, 1, false, 1390, 980),
  H: clearing('H', 'fox', 2, 1, false, 1940, 1040),
  I: clearing('I', 'fox', 2, 0, false, 840, 1730),
  J: clearing('J', 'rabbit', 1, 0, true, 300, 1650),
  K: clearing('K', 'mouse', 2, 0, false, 1220, 1520),
  L: clearing('L', 'rabbit', 1, 0, true, 1790, 1700),
}

export const PATHS: [ClearingId, ClearingId][] = [
  ['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'F'], ['C', 'E'], ['C', 'J'],
  ['D', 'E'], ['D', 'F'], ['E', 'G'], ['E', 'J'], ['E', 'K'], ['F', 'H'],
  ['G', 'H'], ['G', 'L'], ['H', 'L'], ['I', 'J'], ['I', 'K'], ['K', 'L'],
]

export const DIAGONAL_CORNER: Partial<Record<ClearingId, ClearingId>> = { A: 'L', L: 'A', F: 'J', J: 'F' }
