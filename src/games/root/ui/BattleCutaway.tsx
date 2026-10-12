import { useEffect, useState } from 'react'
import { FACTION_NAME } from '../engine/core'
import type { Faction } from '../engine/types'
import { factionPortrait, pieceImage } from './assets'
import { meepleSvg } from './meepleArt'

export type BattleView = {
  attacker: Faction
  defender: Faction
  clearing: string
  // Warriors and buildings/tokens each side had when the battle began.
  sides: Record<Faction, { warriors: number; pieces: string[] }>
  // Dice and the rolled hits each side deals once rolled; null while still to roll.
  roll: { dice: [number, number]; hits: { attacker: number; defender: number } } | null
  // Pieces lost so far on each side.
  lost: Record<Faction, { warriors: number; pieces: number }>
  ambush: Faction | null
}

// A cutaway scene of a battle: the two sides facing off, the dice tumbling in the middle, and the
// fallen toppling over as hits are dealt.
export default function BattleCutaway({ battle }: { battle: BattleView }) {
  return (
    <div className="bc">
      <div className="bc-frame">
        <header className="bc-header">
          <Banner faction={battle.attacker} role="Attacker" />
          <span className="bc-vs">VS</span>
          <Banner faction={battle.defender} role="Defender" right />
        </header>
        <div className="bc-scene">
          <div className="bc-hills" />
          <Side faction={battle.attacker} battle={battle} />
          <Side faction={battle.defender} battle={battle} right />
          {battle.ambush && <div className="bc-ambush">Ambush!</div>}
          <Dice roll={battle.roll} attacker={battle.attacker} defender={battle.defender} />
        </div>
      </div>
    </div>
  )
}

function Banner({ faction, role, right }: { faction: Faction; role: string; right?: boolean }) {
  return (
    <div className={`bc-banner bc-banner-${faction} ${right ? 'right' : ''}`}>
      <img src={factionPortrait(faction)} alt="" />
      <div>
        <strong>{FACTION_NAME[faction]}</strong>
        <small>{role}</small>
      </div>
    </div>
  )
}

function Side({ faction, battle, right }: { faction: Faction; battle: BattleView; right?: boolean }) {
  const side = battle.sides[faction]
  const lost = battle.lost[faction]
  const shown = Math.min(side.warriors, 7)
  // The fallen are those nearest the enemy, toppling into the open ground between the sides.
  const fallenCount = Math.min(lost.warriors, shown)
  const fallen = (i: number) => (right ? i < fallenCount : i >= shown - fallenCount)
  return (
    <div className={`bc-side ${right ? 'right' : ''}`}>
      {/* Buildings and tokens stand at the back, warriors in front. */}
      <div className="bc-row">
        {side.pieces.map((p, i) => (
          <img key={i} className={`bc-building ${i < lost.pieces ? 'fallen' : ''}`} src={pieceImage(p)} alt={p} />
        ))}
      </div>
      <div className="bc-row">
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className={`bc-meeple ${fallen(i) ? 'fallen' : ''}`}
            style={{ ['--i' as string]: i }}
            dangerouslySetInnerHTML={{ __html: meepleSvg(faction, right) }}
          />
        ))}
        {side.warriors > shown && <span className="bc-more">+{side.warriors - shown}</span>}
      </div>
    </div>
  )
}

const TUMBLE_MS = 1100

// Root's battle dice are twelve-sided with faces 0–3. They tumble, then land on the rolled values.
function Dice({ roll, attacker, defender }: { roll: BattleView['roll']; attacker: Faction; defender: Faction }) {
  const dice = roll?.dice ?? null
  const [faces, setFaces] = useState<[number, number]>([0, 0])
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!dice) return
    setSettled(false)
    // The tumble lasts a set time, however slowly the page is drawing.
    const start = performance.now()
    const id = window.setInterval(() => {
      if (performance.now() - start >= TUMBLE_MS) {
        window.clearInterval(id)
        setFaces(dice)
        setSettled(true)
      } else {
        setFaces([Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)])
      }
    }, 80)
    return () => window.clearInterval(id)
  }, [dice])
  if (!dice) return <div className="bc-dice waiting"><span className="bc-die">?</span><span className="bc-die">?</span></div>
  return (
    <div className={`bc-dice ${settled ? 'settled' : 'rolling'}`}>
      <span className="bc-die">{faces[0]}</span>
      <span className="bc-die">{faces[1]}</span>
      {settled && (
        <p className="bc-result">
          {FACTION_NAME[attacker]} deal <b>{roll!.hits.attacker}</b> · {FACTION_NAME[defender]} deal <b>{roll!.hits.defender}</b>
        </p>
      )}
    </div>
  )
}
