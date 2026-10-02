import { character } from '@/lib/rules/catalog';
import { GameArtwork, StatToken } from './GameArtwork';
export function CharacterPreview({name}:{name:string}) {
  const c=character(name);
  return <section className="character-passport" aria-label={`${name} starting profile`}>
    <div className="passport-emblem"><GameArtwork kind="character"/></div><div className="passport-copy"><span>{c.allegiance} · starts at {c.startingSpace}</span><div className="passport-stats"><StatToken kind="health" value={c.startingLife} label="Starting Life"/><StatToken kind="combat" value={c.baseCombatBonus} label="Starting Base Combat Bonus"/><StatToken kind="cash" value={`$${c.startingCash}`} label="Starting Cash"/></div></div>
    <details><summary>See powers & starting gear</summary><p><b>Starting Items:</b> {c.startingItems.length?c.startingItems.join(', '):'None'}</p><ul>{c.powers.map(p=><li key={p.id}>{p.summary}</li>)}</ul></details>
  </section>;
}
