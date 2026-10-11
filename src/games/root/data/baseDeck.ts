import type { CardSuit, CostSuit, Item } from './types'

// The 54-card base shared deck, read from the print-and-play card fronts.
// `art` is the page number of the card's front in Root_PNP_Final_Base_Cards_Fronts.pdf.
// Text is as printed on that (original) printing; card text overrides the Law (Law 1.1.1).

type CardBase = { id: string; name: string; suit: CardSuit; art: number }

export type AmbushCard = CardBase & { kind: 'ambush' }
export type DominanceCard = CardBase & { kind: 'dominance' }
export type ItemCard = CardBase & { kind: 'item'; cost: CostSuit[]; item: Item; vp: number }
export type EffectCard = CardBase & { kind: 'persistent' | 'immediate'; cost: CostSuit[]; text: string }
export type Card = AmbushCard | DominanceCard | ItemCard | EffectCard

const ambush = (art: number, suit: CardSuit): AmbushCard => ({ id: `ambush-${suit}-${art}`, name: 'Ambush!', suit, art, kind: 'ambush' })
const dominance = (art: number, suit: CardSuit): DominanceCard => ({ id: `dominance-${suit}`, name: `${suit[0].toUpperCase()}${suit.slice(1)} Dominance`, suit, art, kind: 'dominance' })
const item = (art: number, name: string, suit: CardSuit, cost: CostSuit[], it: Item, vp: number): ItemCard => ({ id: `${slug(name)}-${art}`, name, suit, art, kind: 'item', cost, item: it, vp })
const persistent = (art: number, name: string, suit: CardSuit, cost: CostSuit[], text: string): EffectCard => ({ id: `${slug(name)}-${art}`, name, suit, art, kind: 'persistent', cost, text })
const immediate = (art: number, name: string, suit: CardSuit, cost: CostSuit[], text: string): EffectCard => ({ id: `${slug(name)}-${art}`, name, suit, art, kind: 'immediate', cost, text })

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const ARMORERS = 'In battle, may discard this to ignore all rolled hits taken.'
const SAPPERS = 'In battle as defender, may discard this to deal an extra hit.'
const BRUTAL_TACTICS = 'In battle as attacker, may deal an extra hit, but defender scores one point.'
const STAND_AND_DELIVER = 'In Birdsong, may take a random card from another player. That player scores one point.'
const TAX_COLLECTOR = 'Once in Daylight, may remove one of your warriors to draw a card.'
const COMMAND_WARREN = 'At start of Daylight, may initiate a battle.'
const BETTER_BURROW_BANK = 'At start of Birdsong, you and another player draw a card.'
const COBBLER = 'At start of Evening, may take a move.'
const SCOUTING_PARTY = 'As attacker in battle, you are not affected by ambush cards.'
const CODEBREAKERS = "Once in Daylight, may look at another player's hand."

export const BASE_DECK: Card[] = [
  // Bird
  ambush(1, 'bird'),
  ambush(2, 'bird'),
  item(3, 'Birdy Bindle', 'bird', ['mouse'], 'bag', 1),
  persistent(4, 'Armorers', 'bird', ['fox'], ARMORERS),
  persistent(5, 'Armorers', 'bird', ['fox'], ARMORERS),
  item(6, 'Woodland Runners', 'bird', ['rabbit'], 'boot', 1),
  item(7, 'Arms Trader', 'bird', ['fox', 'fox'], 'sword', 2),
  item(8, 'Crossbow', 'bird', ['fox'], 'crossbow', 1),
  persistent(9, 'Sappers', 'bird', ['mouse'], SAPPERS),
  persistent(10, 'Sappers', 'bird', ['mouse'], SAPPERS),
  persistent(11, 'Brutal Tactics', 'bird', ['fox', 'fox'], BRUTAL_TACTICS),
  persistent(12, 'Brutal Tactics', 'bird', ['fox', 'fox'], BRUTAL_TACTICS),
  persistent(13, 'Royal Claim', 'bird', ['any', 'any', 'any', 'any'], 'In Birdsong, may discard this to score one point per clearing you rule.'),
  // Fox
  ambush(14, 'fox'),
  item(15, 'Gently Used Knapsack', 'fox', ['mouse'], 'bag', 1),
  item(16, 'Root Tea', 'fox', ['mouse'], 'tea', 2),
  item(17, 'Travel Gear', 'fox', ['rabbit'], 'boot', 1),
  item(18, 'Protection Racket', 'fox', ['rabbit', 'rabbit'], 'coins', 3),
  item(19, 'Foxfolk Steel', 'fox', ['fox', 'fox'], 'sword', 2),
  item(20, 'Anvil', 'fox', ['fox'], 'hammer', 2),
  persistent(21, 'Stand and Deliver!', 'fox', ['mouse', 'mouse', 'mouse'], STAND_AND_DELIVER),
  persistent(22, 'Stand and Deliver!', 'fox', ['mouse', 'mouse', 'mouse'], STAND_AND_DELIVER),
  persistent(23, 'Tax Collector', 'fox', ['rabbit', 'fox', 'mouse'], TAX_COLLECTOR),
  persistent(24, 'Tax Collector', 'fox', ['rabbit', 'fox', 'mouse'], TAX_COLLECTOR),
  persistent(25, 'Tax Collector', 'fox', ['rabbit', 'fox', 'mouse'], TAX_COLLECTOR),
  immediate(26, 'Favor of the Foxes', 'fox', ['fox', 'fox', 'fox'], 'Remove all enemy pieces in fox clearings, then discard.'),
  // Rabbit
  ambush(27, 'rabbit'),
  item(28, "Smuggler's Trail", 'rabbit', ['mouse'], 'bag', 1),
  item(29, 'Root Tea', 'rabbit', ['mouse'], 'tea', 2),
  item(30, 'A Visit to Friends', 'rabbit', ['rabbit'], 'boot', 1),
  item(31, 'Bake Sale', 'rabbit', ['rabbit', 'rabbit'], 'coins', 3),
  persistent(32, 'Command Warren', 'rabbit', ['rabbit', 'rabbit'], COMMAND_WARREN),
  persistent(33, 'Command Warren', 'rabbit', ['rabbit', 'rabbit'], COMMAND_WARREN),
  persistent(34, 'Better Burrow Bank', 'rabbit', ['rabbit', 'rabbit'], BETTER_BURROW_BANK),
  persistent(35, 'Better Burrow Bank', 'rabbit', ['rabbit', 'rabbit'], BETTER_BURROW_BANK),
  persistent(36, 'Cobbler', 'rabbit', ['rabbit', 'rabbit'], COBBLER),
  persistent(37, 'Cobbler', 'rabbit', ['rabbit', 'rabbit'], COBBLER),
  immediate(38, 'Favor of the Rabbits', 'rabbit', ['rabbit', 'rabbit', 'rabbit'], 'Remove all enemy pieces in rabbit clearings, then discard.'),
  // Mouse
  ambush(39, 'mouse'),
  item(40, 'Mouse-in-a-Sack', 'mouse', ['mouse'], 'bag', 1),
  item(41, 'Root Tea', 'mouse', ['mouse'], 'tea', 2),
  item(42, 'Travel Gear', 'mouse', ['rabbit'], 'boot', 1),
  item(43, 'Investments', 'mouse', ['rabbit', 'rabbit'], 'coins', 3),
  item(44, 'Sword', 'mouse', ['fox', 'fox'], 'sword', 2),
  item(45, 'Crossbow', 'mouse', ['fox'], 'crossbow', 1),
  persistent(46, 'Scouting Party', 'mouse', ['mouse', 'mouse'], SCOUTING_PARTY),
  persistent(47, 'Scouting Party', 'mouse', ['mouse', 'mouse'], SCOUTING_PARTY),
  persistent(48, 'Codebreakers', 'mouse', ['mouse'], CODEBREAKERS),
  persistent(49, 'Codebreakers', 'mouse', ['mouse'], CODEBREAKERS),
  immediate(50, 'Favor of the Mice', 'mouse', ['mouse', 'mouse', 'mouse'], 'Remove all enemy pieces in mouse clearings, then discard.'),
  // Dominance (removed in 2-player games, Law 5.1.3)
  dominance(51, 'rabbit'),
  dominance(52, 'mouse'),
  dominance(53, 'bird'),
  dominance(54, 'fox'),
]

// Item supply at setup (Law 5.1.5): 2 bags, 2 boots, 1 crossbow, 1 hammer, 2 swords, 2 teas, 2 coins.
export const ITEM_SUPPLY: Record<Item, number> = { bag: 2, boot: 2, crossbow: 1, hammer: 1, sword: 2, tea: 2, coins: 2 }
