"use client";
import { prefersQuietMotion } from "@/lib/table-comfort";
import { GameArtwork, StatToken } from './GameArtwork';
import type { Action } from "@/lib/rules/types";
import type { tableGuidance } from "@/lib/table-guide";
export function jumpToTableSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({behavior: prefersQuietMotion() ? "auto" : "smooth", block: "start"});
  element.focus({preventScroll: true});
}
export function TableGuide({guide, busy, offline, phase, stats, onAction, connection}: {
  guide: ReturnType<typeof tableGuidance>; busy: boolean; offline: boolean; phase: string;
  stats?: {life: number; maxLife: number; bonus: number; cash: number}; onAction: (a: Action) => void; connection: string;
}) {
  const step = phase === "roll" ? 0 : phase === "move" ? 1 : phase === "end" ? 3 : 2;
  return <section className={`table-guide${guide.attention ? " needs-you" : ""}`} aria-label="Your next step">
    <div className="guide-heading"><GameArtwork className="guide-illustration" kind={phase==='roll'?'roll':phase==='move'?'move':phase==='combat'?'weapon':phase==='end'?'end':'power'}/><div><span className="guide-kicker">{busy ? "SAVING YOUR MOVE…" : connection}</span><h2>{guide.title}</h2></div>
      {stats && <div className="guide-stats" aria-label="Your current stats"><StatToken kind="health" value={`${stats.life}/${stats.maxLife}`} label="Life"/><StatToken kind="combat" value={stats.bonus} label="Base Combat Bonus"/><StatToken kind="cash" value={`$${stats.cash}`} label="Cash"/></div>}
    </div>
    <p>{guide.detail}</p>
    <details className="notice"><summary>How this part works</summary><p>{phase === 'roll' ? 'Roll to find out how far you can travel. If you have an optional start-of-turn power, use it before rolling.' : phase === 'move' ? 'The glowing spaces are places you can legally reach. Select one to read what happens there. Previewing is free: your piece moves only when you confirm.' : phase === 'combat' ? 'Choose your equipment, then confirm it. Combat uses the displayed dice, combat bonuses and card effects. Your base Combat Bonus is permanent strength; equipment can add more for this fight.' : phase === 'end' ? 'Your required encounter is complete. Shopping, trading and available powers are optional. End your turn when you are finished so the next player can play.' : 'Read the revealed card or space, then use the available choices below. The game applies automated effects for you. If an effect needs a table ruling, follow its displayed instructions.'}</p><p><b>Your goal:</b> Build your base Combat Bonus to 15 to qualify for Shangri-La, then complete the final challenge. <b>Life</b> is your health. <b>Cash</b> pays for items and tolls. <b>CB</b> means Combat Bonus.</p></details>
    <div className="guide-bottom"><ol className="turn-progress" aria-label="Turn progress">{["Roll", "Move", "Encounter", "End"].map((label, i) => <li key={label} className={i === step ? "current" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}><span>{i < step ? "✓" : i + 1}</span>{label}</li>)}</ol>
      <div className="guide-buttons">{guide.quick && <button className="primary" disabled={busy || offline} onClick={() => onAction(guide.quick!.action)}>{guide.quick.label}</button>}<button className="quiet" onClick={() => jumpToTableSection(guide.target)}>{guide.target === "available-destinations" ? "Choose where to move ↓" : guide.attention ? "Continue here · show choices ↓" : "View table details ↓"}</button></div>
    </div>
  </section>;
}
