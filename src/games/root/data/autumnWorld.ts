// The 3D Autumn woodland, laid out after the printed board. Positions are fractions of the board
// image (x across, y down), traced from a water mask of the board art.

type P = [number, number]
const px = (x: number, y: number): P => [x / 652, y / 556]

// River centre line, from where it enters at the top to the lake at the bottom left.
export const RIVER: P[] = [
  px(378, -30), px(372, 0), px(350, 45), px(318, 92), px(285, 130), px(270, 160), px(288, 186), px(330, 200),
  px(372, 212), px(415, 228), px(438, 246), px(425, 272), px(402, 305), px(380, 340), px(366, 372),
  px(372, 408), px(392, 436), px(372, 458), px(330, 455), px(282, 449), px(240, 455), px(205, 438),
  px(165, 434), px(122, 452), px(78, 478), px(40, 500),
]

// The lake in the bottom-left corner, running off the edge of the board.
export const LAKE: P[] = [
  px(-80, 300), px(0, 312), px(24, 340), px(30, 380), px(18, 420), px(30, 455), px(52, 485), px(70, 520),
  px(78, 556), px(70, 640), px(-80, 640),
]

// A small pond beside clearing L, as printed.
export const PONDS: { at: P; r: number }[] = [{ at: px(548, 498), r: 0.018 }]

// Rocky outcrops and cliffs printed around the edges of the board.
export const ROCKS: { at: P; size: number }[] = [
  { at: px(612, 210), size: 3.2 }, { at: px(630, 300), size: 3.6 }, { at: px(596, 370), size: 2.6 },
  { at: px(622, 140), size: 2.4 }, { at: px(128, 70), size: 1.6 }, { at: px(150, 60), size: 1.2 },
  { at: px(420, 30), size: 1.8 }, { at: px(560, 30), size: 2.0 }, { at: px(20, 210), size: 1.6 },
  { at: px(36, 250), size: 1.2 }, { at: px(470, 520), size: 1.0 },
]

// Where the item supply market stands (the printed item spaces, top left).
export const MARKET: P = px(130, 20)
