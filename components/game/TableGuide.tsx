"use client";
import { GameArtwork, StatToken } from './GameArtwork';
import type { Action } from "@/lib/rules/types";
import type { tableGuidance } from "@/lib/table-guide";
export function jumpToTableSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
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
    <div className="guide-bottom"><ol className="turn-progress" aria-label="Turn progress">{["Roll", "Move", "Encounter", "End"].map((label, i) => <li key={label} className={i === step ? "current" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}><span>{i < step ? "✓" : i + 1}</span>{label}</li>)}</ol>
      <div className="guide-buttons">{guide.quick && <button className="primary" disabled={busy || offline} onClick={() => onAction(guide.quick!.action)}>{guide.quick.label}</button>}<button className="quiet" onClick={() => jumpToTableSection(guide.target)}>{guide.target === "available-destinations" ? "Choose where to move ↓" : "Show my choices ↓"}</button></div>
    </div>
  </section>;
}
