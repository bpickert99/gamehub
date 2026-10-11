export type ClearingSuit = 'fox' | 'mouse' | 'rabbit'
export type CardSuit = ClearingSuit | 'bird'
// 'any' is the three-color question mark: a crafting piece of any suit (Law 4.1.1).
export type CostSuit = ClearingSuit | 'any'
export type Item = 'bag' | 'boot' | 'crossbow' | 'hammer' | 'sword' | 'tea' | 'coins'
