# Root, Phase 1: Core rules + Marquise de Cat vs Eyrie Dynasties

Source of truth: *The Law of Root*, edition of August 21, 2025. Section numbers below (e.g. 4.3.3) refer to it.
Everything here is enforced by the engine; anything not listed is out of scope for phase 1.

## Scope

- Map: Autumn (M.1, no special rules).
- Factions: Marquise de Cat (6), Eyrie Dynasties (7).
- Players: 2 (Marquise + Eyrie). Reach 10 + 7 = 17, which meets the 2-player minimum of 17+ (5.2).
- Deck: base 54-card shared deck. In a 2-player game all four dominance cards are removed (5.1.3), so dominance (3.3) is **not** needed in phase 1. It comes in phase 2 with 3+ players.
- Standard Setup only (5.1). Advanced Setup, hirelings, landmarks and bots are out of scope.

## Engine shape

- Pure TypeScript: `state + action -> new state`, or a rejection that cites the Law section broken.
- Every rule gets a unit test, written before the UI exists.
- Randomness (shuffles, dice) goes through one seeded RNG stored in the state, so any game can be replayed exactly.
- Hidden information: each hand is shown only to its owner on screen. The free Firebase plan has no server, so the data itself is readable by a determined player (accepted trade-off).

## Golden rules the engine needs (1)

- Card text overrides the Law (1.1.1). `Cannot` is absolute (1.1.2).
- When simultaneous effects or a choice is ambiguous, the player whose turn it is decides (1.1.3).
- Hand **size** is public, contents private (1.2.1). The discard pile is public (1.2.2).
- No consent needed for actions (1.3.3); players cannot give cards unless instructed (1.3.2).
- Turn = Birdsong, Daylight, Evening (1.4.1). Actions cannot be interrupted unless an effect allows it (1.4.2).
- Piece limits are hard: no proxies (1.5.1). If told to place/take/remove more than possible, do the maximum possible (1.5.4). Pieces removed simultaneously are all removed before triggered effects resolve.

## Key concepts (2)

- **Cards** (2.1): draw from shared deck; if the deck empties, shuffle the discard into a new deck immediately.
  - Birds are wild (2.1.1), with reverse substitution banned: a bird requirement can only be met by a bird card (2.1.1.II). Forced discards of a suit must use birds if no other card qualifies (2.1.1.I).
  - Ambush cards (2.1.2): 1 mouse, 1 rabbit, 1 fox, 2 bird; cannot be crafted; played in battle for immediate hits.
  - Play area (2.1.4): crafted persistent effects live here.
- **Clearings and paths** (2.2): adjacency via paths; each clearing has a suit and building slots; 4 ruin slots ("R") start filled.
- **Rivers** (2.3) are not paths for phase 1 factions.
- **Forests** (2.4) exist on the map but no phase 1 piece enters them.
- **Rule** (2.5): most warriors + buildings combined; ties mean nobody rules. Tokens don't count.
  - Exception, Eyrie **Lords of the Forest** (7.2.2): the Eyrie rule when tied, if they have at least one piece there.

## Victory (3)

- First to 30 VP wins immediately (3.1). The game checks after every point scored.
- Scoring (3.2): +1 VP per enemy building or token removed (3.2.1); crafting items scores the card's listed VP (3.2.2).
  - Eyrie **Disdain for Trade** (7.2.3): items score 1 VP instead of the listed value (unless the Builder leader is in charge, 7.8.1).

## Key actions (4)

### Craft (4.1)
- Activate crafting pieces matching the suits on the card's cost; each crafting piece once per turn (4.1.1).
  - Marquise crafting pieces: workshops (6.2.1). Eyrie: roosts (7.2.1).
- Immediate effects resolve then discard; items move from the map's item supply to the faction's Crafted Items box; can't craft an item that's not in supply (4.1.2).
- Persistent effects go to the play area (4.1.3); no duplicates (4.1.4).

### Move (4.2)
- Move any number (>0) of your warriors from one clearing to an adjacent one; you must rule origin or destination (4.2.1). No movement limits (4.2.2).

### Battle (4.3)
1. Defender may play a matching ambush card; attacker may cancel with a matching ambush (Foil). If not foiled: defender deals 2 hits immediately, then the ambush card is discarded; if no attacking warriors remain, the battle ends (4.3.1).
2. Before-roll effects (4.3.2).
3. Roll two dice: attacker deals the higher, defender the lower. Rolled hits are capped by each side's warriors in the clearing (4.3.3).
4. After-roll effects (4.3.4).
5. Count hits: extra hits (not capped), defenseless (+1 hit for attacker if the defender has no warriors there), ignored hits (4.3.5).
6. Deal hits: the side taking hits chooses order, but all warriors go before buildings or tokens (4.3.6). +1 VP per enemy building/token removed.
- Eyrie **Commander** leader: +1 hit as attacker (7.8.3). **Despot**: +1 VP when removing at least one enemy building/token in battle (7.8.4).

## Standard setup (5.1)

1. Assign factions; random first player and seating.
2. Score markers to 0.
3. 2-player: remove the 4 dominance cards. Shuffle; each player draws 3.
4. Ruins in the 4 "R" slots.
5. Item supply: 2 bags, 2 boots, 1 crossbow, 1 hammer, 2 swords, 2 teas, 2 coins. *(Icons in 5.1.5 to be confirmed against the art.)*
6. Dice near map.
7. Factions set up in order (Marquise is setup order A, Eyrie B; to confirm on faction boards).

## Marquise de Cat (6)

**Setup (6.3):** 25 warriors, 8 wood. Keep in any corner clearing. One warrior in every clearing except the corner diagonally opposite the keep. Place 1 sawmill, 1 workshop, 1 recruiter among the keep clearing and adjacent clearings. Remaining 5 of each building go on the tracks right to left (leftmost space empty).

**Abilities:**
- **The Keep** (6.2.2): other players cannot place pieces in the keep clearing; pieces can move in. If removed, it never returns.
- **Field Hospitals** (6.2.3): when Marquise warriors are removed, she may spend a card matching that clearing to put them in the keep clearing instead of supply.

**Birdsong (6.4):** 1 wood per sawmill.

**Daylight (6.5):** first craft with workshops, then up to 3 actions, +1 per bird card spent:
- Battle; March (2 moves); Recruit (warrior at each recruiter, once per turn); Build.
- **Build** (6.5.4): choose a ruled clearing and a building type; pay the cost shown above the leftmost building on that track in wood, taking wood from the chosen clearing, adjacent ruled clearings, or clearings connected through any chain of ruled clearings; place it; score the VP uncovered.
- **Overwork** (6.5.5): spend a card matching a sawmill's clearing to place a wood token there.

**Evening (6.6):** draw 1 + uncovered draw bonuses; discard down to 5.

## Eyrie Dynasties (7)

**Setup (7.3):** 20 warriors. 1 roost + 6 warriors in a corner clearing that is not another player's starting corner, diagonally opposite if possible. With only the Marquise on the board, the diagonal corner is always free, so the engine places the Eyrie there. Choose 1 of 4 leaders; the rest face up. Tuck the leader's 2 Loyal Viziers into the Decree columns shown on the leader. 6 remaining roosts on the Roosts track, right to left.

**Abilities:** Crafting via roosts (7.2.1); Lords of the Forest (7.2.2); Disdain for Trade (7.2.3).

**Birdsong (7.4):**
1. Emergency Orders: if no cards in hand, draw 1.
2. Add to the Decree: must add 1 or 2 cards to any columns (revealed); at most one of them may be a bird.
3. A New Roost: if no roosts on the map, place a roost + 3 warriors in the clearing with the fewest warriors where all those pieces can be placed.

**Daylight (7.5):** craft with roosts, then resolve the Decree left to right; within a column, all cards in any order:
- Recruit: warrior in a clearing with a roost matching the card's suit.
- Move: from a clearing matching the card's suit (at least one warrior).
- Battle: in a clearing matching the card's suit.
- Build: roost in a ruled clearing matching the card's suit with no roost.
- Bird cards match any clearing (birds are wild, 2.1.1).
- If any card can't be fully resolved: **Turmoil** immediately.

**Evening (7.6):** score VP shown on the rightmost empty Roosts space; draw 1 + uncovered draw bonuses; discard to 5.

**Turmoil (7.7):** lose 1 VP per bird card in the Decree (including Viziers); discard the Decree except the Viziers; depose the leader (face down) and pick a new face-up one, flipping all face up if none remain; tuck the Viziers per the new leader; end Daylight and go to Evening.

**Leaders (7.8):**
- Builder: Viziers on Recruit + Move; ignores Disdain for Trade.
- Charismatic: Recruit + Battle; Recruit places 2 warriors.
- Commander: Move + Battle; +1 hit as attacker.
- Despot: Move + Build; +1 VP when removing enemy building/token in battle.

## Data missing from the Law (needed from the art)

The Law defines rules but not the printed data on components. Phase 1 needs:

1. **Autumn map:** 12 clearings with their suit, building slots, ruin slots, paths, and which 4 are corners (and which corners are diagonal). Rivers and forests for later phases.
2. **The 54-card base deck:** name, suit, crafting cost, and effect of each card (immediate, item + VP, or persistent), plus the ambush and dominance cards.
3. **Marquise faction board:** wood cost and VP for each space on the sawmill, workshop and recruiter tracks; which spaces show draw bonuses.
4. **Eyrie faction board:** VP and draw bonuses for each Roosts track space; Decree column layout.
5. **Eyrie leader cards** (to confirm the Vizier placements above).
6. **Score track** (for display only).

## Open questions for you

- Crafted card effects: the Law says to follow card text (1.1.1). Phase 1 implements every card in the base deck; if any card's text is unclear, I'll list it for you to rule on before coding it.
