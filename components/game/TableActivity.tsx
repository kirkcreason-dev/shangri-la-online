"use client";
import { useEffect, useRef, useState } from 'react';
import { Axe, Coins, Footprints, Sparkles, DoorOpen, Dices, Heart, Shield, ChevronDown } from 'lucide-react';
import { ChoiceFace } from './ChoiceCards';
import { CARD_BY_KEY } from '@/lib/rules/catalog';
import type { TableMoment } from '@/lib/rules/types';
import './table-activity.css';

const momentLabels: Record<TableMoment['kind'], string> = {
  roll: 'Dice on the table',
  move: 'New ground',
  card: 'Card revealed',
  combat: 'Battle report',
  reward: 'Your spoils & costs',
  departure: 'At the table',
};
const resultLabels = { win: 'Victory', loss: 'Defeat', tie: 'Standoff' };

function MomentDice({ dice }: { dice: number[] }) {
  return <div className="moment-dice activity-dice" role="group" aria-label={`Dice results: ${dice.join(' and ')}`}>
    {dice.map((die, index) => <span className="activity-die" key={index} aria-label={`Die ${index + 1}: ${die}`}>
      <b aria-hidden="true">{die}</b><small aria-hidden="true">DIE {index + 1}</small>
    </span>)}
  </div>;
}

function Moment({ moment, featured = false }: { moment: TableMoment; featured?: boolean }) {
  const Icon = moment.kind === 'move' ? Footprints : moment.kind === 'combat' ? Axe : moment.kind === 'reward' ? Coins : moment.kind === 'departure' ? DoorOpen : moment.kind === 'roll' ? Dices : Sparkles;
  const revealedCard = moment.card ? CARD_BY_KEY[moment.card.split('@')[0]] : undefined;
  return <article className={`moment activity-moment moment-${moment.kind} ${moment.result ?? ''}${featured ? ' activity-featured' : ''}`}>
    <div className="activity-moment-topline">
      <span className="activity-kind"><Icon size={14} aria-hidden="true" />{momentLabels[moment.kind]}</span>
      {moment.result && <span className={`activity-verdict verdict-${moment.result}`}>{resultLabels[moment.result]}</span>}
      {moment.kind === 'reward' && <span className="activity-applied">Already applied</span>}
    </div>
    <div className={`activity-moment-body${moment.card ? ' has-card' : ''}`}>
      {moment.card ? <div className="moment-card activity-card-face"><ChoiceFace label={moment.title} value={moment.card} compact /></div> : <>
        <span className="moment-emblem activity-emblem" aria-hidden="true"><Icon strokeWidth={1.5} /></span>
        <div className="moment-copy"><strong>{moment.title}</strong><p>{moment.detail}</p></div>
      </>}
      {!!moment.dice?.length && <MomentDice dice={moment.dice} />}
    </div>
    {moment.card && <div className="activity-card-detail"><p>{moment.detail}</p>
      {revealedCard?.rules && <details className="activity-card-rules"><summary>Read this card’s rules <ChevronDown size={14} aria-hidden="true" /></summary><p>{revealedCard.rules}</p></details>}
    </div>}
    {!!moment.changes?.length && <div className="moment-changes activity-changes" aria-label="Changes already applied">
      {moment.changes.map((change, index) => {
        const ChangeIcon = change.label === 'Life' ? Heart : change.label === 'Cash' ? Coins : Shield;
        return <span className={`activity-change ${change.amount > 0 ? 'gain' : change.amount < 0 ? 'loss' : 'unchanged'}`} key={`${change.label}-${index}`}>
          <ChangeIcon size={18} aria-hidden="true" /><span><b>{change.amount > 0 ? '+' : change.amount < 0 ? '−' : ''}{change.label === 'Cash' ? '$' : ''}{Math.abs(change.amount)}</b><small>{change.label}</small></span>
        </span>;
      })}
    </div>}
  </article>;
}

export function TableActivity({ moments = [], roomCode, rolling = false }: { moments?: TableMoment[]; roomCode: string; rolling?: boolean }) {
  const last = useRef({ code: roomCode, id: moments.at(-1)?.id ?? 0 });
  const [visible, setVisible] = useState<TableMoment[]>(() => moments.slice(-1));
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (last.current.code !== roomCode) {
      last.current = { code: roomCode, id: moments.at(-1)?.id ?? 0 };
      setVisible(moments.slice(-1));setAnimate(false);return;
    }
    const next = moments.filter(moment => moment.id > last.current.id);
    if (next.length) {
      const recent = next.slice(-4);
      const defining = next.findLast(moment => moment.kind === 'combat') ?? next.findLast(moment => moment.kind === 'card');
      // A table-wide reward can create more than four entries; keep the encounter that caused it.
      const batch = defining && !recent.some(moment => moment.id === defining.id)
        ? [defining, ...recent.slice(-3)].sort((a, b) => a.id - b.id)
        : recent;
      setVisible(batch);setAnimate(true);last.current.id = next.at(-1)!.id;
    }
  }, [moments, roomCode]);
  if (!visible.length && !rolling) return null;
  // Keep a battle or a card in the spotlight when its roll also changes several stats.
  const featured = visible.findLast(moment => moment.kind === 'combat') ?? visible.findLast(moment => moment.kind === 'card') ?? visible.at(-1);
  const supporting = visible.filter(moment => moment.id !== featured?.id);
  const earlier = moments.filter(moment => !visible.some(current => current.id === moment.id)).slice(-8).reverse();
  return <section className={`table-moments table-activity${animate ? ' animate' : ''}`} aria-label="Table action and recent play">
    <header className="activity-heading"><span><Sparkles size={15} aria-hidden="true" />JUST HAPPENED</span><small>Every roll has a story.</small></header>
    <div className="activity-live" aria-live="polite" aria-atomic="true" aria-relevant="additions text">
      {rolling ? <div className="moment activity-moment activity-rolling">
        <span className="activity-rolling-dice" aria-hidden="true"><b>✦</b><b>✦</b></span>
        <div className="moment-copy"><span className="activity-kind">LET THEM FLY</span><strong>Rolling the dice…</strong><p>The table is waiting for your result.</p></div>
      </div> : <>
        {featured && <Moment key={featured.id} moment={featured} featured />}
        {!!supporting.length && <div className="activity-follow-through" aria-label="What happened in this action">{supporting.map(moment => <Moment key={moment.id} moment={moment} />)}</div>}
      </>}
    </div>
    {!!earlier.length && <details className="activity-recap" key={roomCode}>
      <summary>Recent table play <span>{earlier.length} earlier {earlier.length === 1 ? 'moment' : 'moments'}</span><ChevronDown size={15} aria-hidden="true" /></summary>
      <ol>{earlier.map(moment => <li key={moment.id}><span className={`activity-recap-marker recap-${moment.kind}`} aria-hidden="true" /><div><strong>{moment.title}</strong><p>{moment.detail}</p>{!!moment.changes?.length && <small>{moment.changes.map(change => `${change.amount > 0 ? '+' : ''}${change.amount} ${change.label}`).join(' · ')}</small>}</div></li>)}</ol>
    </details>}
  </section>;
}
