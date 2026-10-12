"use client";
import { prefersQuietMotion } from "@/lib/table-comfort";
import { GameArtwork, StatToken } from './GameArtwork';
import type { Action } from "@/lib/rules/types";
import type { tableGuidance } from "@/lib/table-guide";
import './table-guide-polish.css';

const TURN_STEPS = [
  {label: "Roll", detail: "Find your range"},
  {label: "Move", detail: "Pick a space"},
  {label: "Encounter", detail: "Face what’s there"},
  {label: "End", detail: "Pass the turn"},
];

const PHASE_HELP: Record<string, string> = {
  roll: "Use a start-of-turn power if you want, then roll. The result tells you how far you can travel.",
  move: "Tap a glowing space to preview its rules and toll. Looking is free; your piece moves only after you confirm.",
  combat: "Pick your equipment, then confirm it. Your dice, base Combat Bonus and card effects determine the fight. Base CB is your permanent strength; equipment can add more for this fight.",
  end: "Your required encounter is complete. Shopping, trading and available powers are optional. End your turn when you are done to let the next player play.",
};

function turnTip(phase: string, attention: boolean) {
  if (!attention) return "A good time to check your Items, explore the board, or chat with the table.";
  if (phase === "move") return "You can preview several spaces before you commit to one.";
  if (phase === "combat") return "Check the displayed combat bonuses before locking in your equipment.";
  if (phase === "end") return "You do not need to shop or trade. End your turn whenever you are ready.";
  if (phase === "roll") return "Start-of-turn powers are optional. Ready to go? Roll the dice.";
  return "Finish the highlighted choice first. The next part of your turn opens automatically.";
}
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
  const quick = guide.quick;
  const questProgress = stats ? Math.min(15, Math.max(0, stats.bonus)) : 0;
  const questRemaining = stats ? Math.max(0, 15 - stats.bonus) : 15;
  const practiceTurn = guide.title.startsWith("Practice opponent");
  const actionLabel = guide.target === "available-destinations" ? "Choose where to move" : "Show my choices";
  const phaseHelp = PHASE_HELP[phase] ?? "Read the revealed card or space, then choose how to respond. The game applies automatic effects for you. If a card needs a table ruling, follow its displayed instructions.";

  return <section id="next-step-guide" tabIndex={-1} className={`table-guide play-guide${guide.attention ? " needs-you" : ""}`} aria-label="Your next step" aria-busy={busy}>
    <div className="play-guide-topline">
      <span className={`play-guide-state${offline ? " is-offline" : ""}`}>
        <span className="play-guide-status-dot" aria-hidden="true" />
        {offline ? "Connection lost" : busy ? "Saving your move…" : guide.attention ? practiceTurn ? "Practice opponent’s turn" : "Your action is needed" : "Table in play"}
      </span>
      <span className="play-guide-connection">{connection}</span>
    </div>

    <div className="play-guide-main">
      <div className="play-guide-instruction">
        <GameArtwork className="play-guide-art" kind={phase === 'roll' ? 'roll' : phase === 'move' ? 'move' : phase === 'combat' ? 'weapon' : phase === 'end' ? 'end' : 'power'} />
        <div>
          <span className="play-guide-eyebrow">{guide.attention ? "Do this next" : "At the table"}</span>
          <h2 id="next-step-title" className="play-guide-title">{guide.title}</h2>
          <p className="play-guide-detail">{guide.detail}</p>
        </div>
      </div>
      <div className="play-guide-action-area">
        {quick ? <button className="primary play-guide-action" disabled={busy || offline} onClick={() => onAction(quick.action)}><span>{busy ? "Saving…" : quick.label}</span><span aria-hidden="true">→</span></button>
          : guide.attention ? <button className="primary play-guide-action" onClick={() => jumpToTableSection(guide.target)}><span>{actionLabel}</span><span aria-hidden="true">↓</span></button>
          : <button className="quiet play-guide-action play-guide-browse" onClick={() => jumpToTableSection("table-board")}><span>Explore the board</span><span aria-hidden="true">↓</span></button>}
        {quick && <button className="quiet play-guide-secondary" onClick={() => jumpToTableSection(guide.target)}>See all available actions ↓</button>}
        <p className="play-guide-tip">{offline ? "Your table is still saved. Actions become available when the connection returns." : turnTip(phase, guide.attention)}</p>
      </div>
    </div>

    <ol className="play-guide-turn" aria-label={guide.attention ? "Your turn progress" : "Current table turn progress"}>
      {TURN_STEPS.map(({label, detail}, i) => <li key={label} className={i === step ? "is-current" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
        <span className="play-guide-step-number" aria-hidden="true">{i < step ? "✓" : i + 1}</span>
        <span className="play-guide-step-copy"><strong>{label}</strong><small>{i === step ? "Happening now" : i < step ? "Complete" : detail}</small></span>
      </li>)}
    </ol>

    {stats && <div className="play-guide-quest">
      <div className="play-guide-objective">
        <GameArtwork className="play-guide-goal-art" kind="end" />
        <div>
          <span className="play-guide-eyebrow">Your quest · reach Shangri-La</span>
          <div className="play-guide-quest-heading"><strong>{questRemaining > 0 ? `${questRemaining} more base CB to qualify` : "15 base CB reached!"}</strong><span>{stats.bonus} <small>/ 15 CB</small></span></div>
          <progress className="play-guide-quest-meter" value={questProgress} max={15} aria-label={`Base Combat Bonus: ${stats.bonus}. Reach 15 to qualify for Shangri-La.`} />
          <p>{questRemaining > 0 ? "Build your permanent strength, then complete the final challenge." : "You qualify for Shangri-La. Reach it and complete the final challenge to win."}</p>
        </div>
      </div>
      <div className="play-guide-stats" aria-label="Your current stats"><StatToken kind="health" value={`${stats.life}/${stats.maxLife}`} label="Life" /><StatToken kind="combat" value={stats.bonus} label="Base Combat Bonus" /><StatToken kind="cash" value={`$${stats.cash}`} label="Cash" /></div>
    </div>}

    <details className="play-guide-help"><summary>Need a hand with this step?</summary><div><p>{phaseHelp}</p><p><b>Life</b> is your health. <b>Cash</b> pays for items and tolls. <b>CB</b> means Combat Bonus. Your goal is 15 base CB, then Shangri-La’s final challenge.</p></div></details>
  </section>;
}
