"use client";
import { card } from "@/lib/rules/catalog";
import { GameArtwork, cardArtwork } from "./GameArtwork";
export function CardView({ id, onUse }: { id: string; onUse?: (id: string) => void }) {
  const c = card(id);
  return (
    <article className="game-card">
      <div className="row">
        <span className="eyebrow">
          {c.weapon ? "Weapon" : c.kind}
          {c.allegiance ? ` · ${c.allegiance}` : ""}
        </span>
        {c.strength !== undefined && (
          <span className="pill">
            Strength {c.strength} · +{c.reward} CB
          </span>
        )}
      </div>
      <div className={`card-illustration card-illustration-${c.kind}`}><GameArtwork kind={cardArtwork(c)}/></div>
      <h3>{c.name}</h3>
      <p>{c.rules}</p>
      {!c.automatic && (
        <span className="manual-label">
          Apply special effects with table controls
        </span>
      )}
      {!c.verified && (
        <p className="small">Source uncertainty: {c.notes?.join(" ")}</p>
      )}
      <div className="row">
        {onUse && !c.automatic && (
          <button className="quiet" onClick={() => onUse(id)}>
            Use / resolve effect
          </button>
        )}
        {c.source && (
          <a className="small" href={c.source} target="_blank" rel="noreferrer">
            Source image ↗
          </a>
        )}
      </div>
    </article>
  );
}
