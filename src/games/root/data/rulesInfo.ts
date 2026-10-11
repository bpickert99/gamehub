// What each piece on the board does, quoted from The Law of Root (August 21, 2025).
// Shown by the "i" pop-up when hovering a piece.

export type RuleQuote = { section: string; title: string; text: string }
export type PieceInfo = { name: string; rules: RuleQuote[] }

export type InfoKey =
  | 'warrior-marquise' | 'warrior-eyrie' | 'sawmill' | 'workshop' | 'recruiter' | 'roost'
  | 'wood' | 'keep' | 'ruin' | 'clearing' | 'item'

const RULE: RuleQuote = {
  section: '2.5',
  title: 'Rule',
  text: 'A player rules a clearing if they have more total warriors and buildings in it than each other player. (Tokens and pawns do not contribute to rule.) If there is a tie between players in a clearing, no one rules it.',
}

const MOVE: RuleQuote = {
  section: '4.2',
  title: 'Move',
  text: 'When you move, take any number (more than zero) of your warriors and pawns from one clearing and move them on a linking path (2.2) to one adjacent clearing. You Must Rule: To take a move, you must rule the origin clearing, destination clearing, or both.',
}

const SLOTS: RuleQuote = {
  section: '2.2.3',
  title: 'Slots',
  text: 'Each clearing has a number of building slots (white boxes). Whenever you place a building, it fills an open slot. You cannot place a building in a clearing with no open slots.',
}

const REMOVING: RuleQuote = {
  section: '3.2.1',
  title: 'Removing Buildings and Tokens',
  text: "Whenever you remove an enemy's building or token, you score one victory point.",
}

const CRAFT_COST: RuleQuote = {
  section: '4.1.1',
  title: 'Cost',
  text: "To craft a card, you must activate crafting pieces of the suits listed in the card's bottom-left corner. A crafting piece's suit matches its clearing. Each crafting piece may be activated only once per turn.",
}

export const PIECE_INFO: Record<InfoKey, PieceInfo> = {
  'warrior-marquise': {
    name: 'Marquise de Cat warrior',
    rules: [
      RULE,
      MOVE,
      {
        section: '6.2.3',
        title: 'Field Hospitals',
        text: "Whenever any number of Marquise warriors are removed from a clearing, the Marquise may spend a card matching that clearing to place those warriors in the clearing with the keep token instead of the Marquise's supply.",
      },
    ],
  },
  'warrior-eyrie': {
    name: 'Eyrie Dynasties warrior',
    rules: [
      RULE,
      {
        section: '7.2.2',
        title: 'Lords of the Forest',
        text: 'The Eyrie rule a clearing when tied for most combined warriors and buildings there, and they have at least one Eyrie piece there.',
      },
      MOVE,
    ],
  },
  sawmill: {
    name: 'Sawmill (Marquise building)',
    rules: [
      { section: '6.4', title: 'Birdsong', text: 'Place wood tokens in each clearing with any number of sawmills, one wood per sawmill there.' },
      { section: '6.5.5', title: 'Overwork', text: "Spend a card matching the clearing of a sawmill to place a wood token there." },
      REMOVING,
    ],
  },
  workshop: {
    name: 'Workshop (Marquise building)',
    rules: [
      { section: '6.2.1', title: 'Crafting', text: 'The Marquise crafts during Daylight by activating workshops.' },
      CRAFT_COST,
      REMOVING,
    ],
  },
  recruiter: {
    name: 'Recruiter (Marquise building)',
    rules: [
      { section: '6.5.3', title: 'Recruit', text: 'Place one warrior at each recruiter. You may take this action only once per turn.' },
      REMOVING,
    ],
  },
  roost: {
    name: 'Roost (Eyrie building)',
    rules: [
      { section: '7.2.1', title: 'Crafting', text: 'The Eyrie craft before resolving the Decree during Daylight by activating roosts.' },
      { section: '7.6.1', title: 'Score Points', text: 'Score the victory points listed on the rightmost empty space of your Roosts track.' },
      { section: '7.4.3', title: 'A New Roost', text: 'If you have no roosts on the map, place a roost and three warriors in a clearing with the fewest warriors where all those pieces can be placed.' },
      REMOVING,
    ],
  },
  wood: {
    name: 'Wood (Marquise token)',
    rules: [
      {
        section: '6.5.4.II',
        title: 'Pay Cost',
        text: "Find the chosen building's cost at the top of its column. Remove wood tokens equal in number to the cost from the chosen clearing, any adjacent clearings you rule, or any clearings connected to the chosen clearing you rule through any number of clearings you rule.",
      },
      { section: '2.5', title: 'Rule', text: 'Tokens and pawns do not contribute to rule.' },
      REMOVING,
    ],
  },
  keep: {
    name: 'The Keep (Marquise token)',
    rules: [
      {
        section: '6.2.2',
        title: 'The Keep',
        text: 'The Marquise can place pieces in the clearing with the keep token, and other players cannot. (Pieces may be moved into it. If the keep is removed, there is no way to place it on the map again.)',
      },
      REMOVING,
    ],
  },
  ruin: {
    name: 'Ruin',
    rules: [
      {
        section: '2.2.4',
        title: 'Ruins',
        text: "Slots marked with a small “R” begin the game filled with ruins. Ruins cannot be removed unless explicitly instructed (such as by the Vagabond's Explore action, 9.5.3).",
      },
      SLOTS,
    ],
  },
  clearing: {
    name: 'Clearing',
    rules: [
      { section: '2.2.1', title: 'Adjacency', text: 'A clearing is adjacent to all other clearings linked to it by a path.' },
      { section: '2.2.2', title: 'Suit', text: 'Each clearing has a suit: mouse, rabbit, or fox.' },
      SLOTS,
      RULE,
    ],
  },
  item: {
    name: 'Item (item supply)',
    rules: [
      {
        section: '4.1.2',
        title: 'Immediate Effects',
        text: 'If it shows an item, take the corresponding item from the item supply on the map and place it in the Crafted Items box on your faction board. If the card lists an item not in the item supply, the card cannot be crafted.',
      },
      { section: '3.2.2', title: 'Crafting Items', text: 'Whenever you craft an item (4.1), score the victory points listed on the card.' },
    ],
  },
}
