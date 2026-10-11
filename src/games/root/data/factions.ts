// Faction board data read from the print-and-play faction boards.
// Track arrays run left to right; index 0 is the leftmost space.

export type TrackSpace = { vp: number; draw: boolean }

const space = (vp: number, draw = false): TrackSpace => ({ vp, draw })

export type MarquiseBuilding = 'sawmill' | 'workshop' | 'recruiter'

export const MARQUISE = {
  warriors: 25,
  wood: 8,
  buildingsPerType: 6,
  // Wood cost printed at the top of each column (Law 6.5.4.II).
  buildCost: [0, 1, 2, 3, 3, 4],
  tracks: {
    sawmill: [space(0), space(1), space(2), space(3), space(4), space(5)],
    workshop: [space(0), space(2), space(2), space(3), space(4), space(5)],
    recruiter: [space(0), space(1), space(2, true), space(3), space(3, true), space(4)],
  } satisfies Record<MarquiseBuilding, TrackSpace[]>,
}

export type EyrieLeader = 'builder' | 'charismatic' | 'commander' | 'despot'
export type DecreeColumn = 'recruit' | 'move' | 'battle' | 'build'

export const EYRIE = {
  warriors: 20,
  roosts: 7,
  roostTrack: [space(0), space(1), space(2, true), space(3), space(4), space(4, true), space(5)],
  decreeColumns: ['recruit', 'move', 'battle', 'build'] as DecreeColumn[],
  // Loyal Vizier placement per leader (Law 7.8, confirmed on the leader cards).
  leaders: {
    builder: { viziers: ['recruit', 'move'], art: 57 },
    charismatic: { viziers: ['recruit', 'battle'], art: 58 },
    commander: { viziers: ['move', 'battle'], art: 55 },
    despot: { viziers: ['move', 'build'], art: 56 },
  } satisfies Record<EyrieLeader, { viziers: DecreeColumn[]; art: number }>,
}
