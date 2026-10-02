"use client";
import { useEffect, useReducer, useRef, useState } from 'react';
import { initialTutorial, tutorialStep, tutorialPhase } from '@/lib/tutorial';
import { gameAsset } from '@/lib/client-connection';
import { GameArtwork, StatToken } from "./GameArtwork";
import { jumpToTableSection } from './TableGuide';

const lessons = {
  welcome: ['A little luck. A stronger crew. A way in.', 'Travel the board, collect useful cards, and build your strength. Reach 15 base Combat Bonus, cross the Bridge, and face the hidden ending in Shangri-La. Getting there starts the final challenge.'],
  roll: ['First, roll to find out how far you can go.', 'The movement die tells you how many spaces to travel. Try it now. This practice roll is set to 3 so you can learn the controls.'],
  move: ['You rolled 3. Pick where to land.', 'Tap the glowing Vernor Street space to preview it. In a real turn, you will usually have more than one destination to choose from.'],
  encounter: ['You landed. Now see what happens.', 'An encounter is simply what happens where you land. Vernor Street says to draw one Action card. Open it to find out what you meet.'],
  card: ['You found a Fiend. Time for a fight.', 'Fiends are enemies. This one has strength 6. Beat it to gain 1 base Combat Bonus—permanent progress toward Shangri-La.'],
  combat: ['Pick one weapon, then roll.', 'Your combat total is a ten-sided die + your base Combat Bonus + your chosen weapon. Try the Axe for +2, or fight without it. This example rolls a 5.'],
  result: ['You won. You’re a little stronger.', 'You beat strength 6 and earned +1 base Combat Bonus. That is how winning fights brings you closer to the center. End your turn to let the next player go.'],
  done: ['That’s one whole turn. You’ve got the rhythm.', 'Roll → choose a destination → resolve what you find → end your turn. The real game adds surprises, better equipment, friends, and rival players.'],
} as const;

export function LearnToPlay({ open, onClose, onComplete, current }: {
  open: boolean; onClose: () => void; onComplete: () => void;
  current?: { title: string; detail: string; phase: string; attention: boolean; target: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'practice' | 'basics'>('practice');
  const [state, dispatch] = useReducer(tutorialStep, undefined, initialTutorial);
  const phase = tutorialPhase(state.stage);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; dialog.current?.close(); previous?.focus(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    heading.current?.focus({preventScroll:true});
    body.current?.scrollTo({top:0, behavior:'instant'});
  }, [open, state.stage, tab]);
  function finish() {
    dispatch({type:'end'});
    try { localStorage.setItem('qsl_tutorial_complete', '1'); } catch { /* Optional preference. */ }
    onComplete();
  }
  function showTable() { onClose(); jumpToTableSection(current?.target ?? 'table-controls'); }
  const [title, description] = lessons[state.stage];
  return <dialog ref={dialog} className="learn-dialog" aria-labelledby="learn-title" onCancel={onClose} onClose={onClose}>
    <div className="learn-shell">
      <header className="learn-header"><div><span>LEARN TO PLAY</span><strong>Your first trip to Shangri-La</strong></div><button className="quiet" onClick={onClose} aria-label="Close tutorial">✕</button></header>
      <div className="learn-tabs" aria-label="Tutorial sections"><button aria-pressed={tab==='practice'} onClick={()=>setTab('practice')}>Play a practice turn</button><button aria-pressed={tab==='basics'} onClick={()=>setTab('basics')}>The basics</button></div>
      <div ref={body} className="learn-body">
        {tab==='practice' ? <>
          <div className="learn-safe"><span className="live-dot"/>Practice only · No changes to your real game{current ? ' · Your table keeps running' : ''}</div>
          <ol className="learn-progress" aria-label="Practice turn progress">{['Roll','Move','Encounter','End'].map((label,i)=><li key={label} className={state.stage==='done'||i<phase?'done':i===phase?'current':''} aria-current={i===phase?'step':undefined}><span>{state.stage==='done'||i<phase?'✓':i+1}</span>{label}</li>)}</ol>
          <div className="lesson-heading"><GameArtwork kind={state.stage==='welcome'?'carnival':state.stage==='done'?'end':state.stage==='roll'?'roll':state.stage==='move'?'move':state.stage==='combat'?'weapon':state.stage==='result'?'cash':'power'}/><div><h2 id="learn-title" ref={heading} tabIndex={-1}>{title}</h2><p className="learn-description">{description}</p></div></div>
          {state.stage==='welcome' ? <>
            <div className="learn-journey" aria-label="Journey to Shangri-La"><span>Detroit</span><b>→</b><span>Nethervoid</span><b>→</b><span>Dark Carnival</span><b>→</b><span>Shangri-La</span></div>
            <div className="learn-objective"><strong>15+</strong><div>BASE COMBAT BONUS<span>Your permanent strength. Weapon bonuses don’t count toward entry.</span></div></div>
            <p className="learn-caption">About 2 minutes. No room or second player needed.</p>
          </> : state.stage==='done' ? <>
            <div className="learn-success"><span>✦</span><strong>Practice complete</strong><p>You moved, beat a Fiend, and grew stronger.</p></div>
            <div className="learn-next-tips"><p><b>In a real game:</b> follow the “Your next step” panel above the board. On your phone, tap the gold action button at the bottom to reach your choices.</p><p>Some special cards still need a table ruling. Use the listed choices to follow that card’s instructions, then finish the ruling.</p></div>
            <button className="primary learn-primary" onClick={current?showTable:onClose}>{current?'Show my table’s next step →':'I’m ready to play →'}</button><button className="quiet learn-replay" onClick={()=>dispatch({type:'restart'})}>Replay the practice turn</button>
          </> : <>
            <div className="learn-stats" aria-label="Practice stats"><StatToken kind="health" value={3} label="Life"/><StatToken kind="combat" value={state.bonus} label="Base Combat Bonus"/><StatToken kind="cash" value="$100" label="Cash"/></div>
            {['roll','move','encounter'].includes(state.stage) && <div className="learn-path" aria-label="Practice path in Detroit">
              {['Southwest','Alleyway','Mexican Town','Vernor Street'].map((name,i)=><button key={name} type="button" className={`learn-tile${i===state.pos?' occupied':''}${state.stage==='move'&&i===3?' destination':''}${state.selected&&i===3?' selected':''}`} disabled={state.stage!=='move'||i!==3} onClick={()=>dispatch({type:'preview'})} aria-label={state.stage==='move'&&i===3?'Preview Vernor Street':name}>
                <svg viewBox={`${i*100} 0 100 100`} aria-hidden="true"><image href={gameAsset('board-reference.jpg')} width="800" height="800"/></svg><span>{name}</span>{i===state.pos&&<b className="learn-token">YOU</b>}{state.stage==='move'&&i===3&&<i>3</i>}
              </button>)}
            </div>}
            {state.stage==='roll' && <><button className="learn-roll" onClick={()=>dispatch({type:'roll'})}><span className="learn-die">?</span><strong>Roll movement</strong><small>Six-sided die · how far you travel</small></button></>}
            {state.stage==='move' && <><div className="learn-roll-result"><span className="learn-die small">3</span><p>Three spaces. Your piece stays put until you confirm.</p></div>{state.selected ? <div className="learn-preview"><span>DESTINATION PREVIEW</span><h3>Vernor Street</h3><p>Draw 1 Action card. No crossing toll.</p><button className="primary learn-primary" onClick={()=>dispatch({type:'move'})}>Move to Vernor Street →</button></div> : <button className="secondary learn-primary" onClick={()=>dispatch({type:'preview'})}>Preview the glowing space</button>}</>}
            {state.stage==='encounter' && <button className="primary learn-primary" onClick={()=>dispatch({type:'draw'})}>Encounter Vernor Street · draw a card →</button>}
            {['card','combat','result'].includes(state.stage) && <div className="learn-combat-layout"><article className="learn-fiend"><span>DETROIT · FIEND</span><div className="learn-fiend-icon" aria-hidden="true"><GameArtwork kind="fiend"/></div><h3>Drainer Road Monk</h3><div className="learn-fiend-stats"><span>Strength <b>6</b></span><span>Reward <b>+1</b> base CB</span></div><p>No special effect. Beat its strength to win.</p></article><div className="learn-combat-action">
              {state.stage==='card' && <><p>This is a fixed example using a card from the game. Real Action cards can also bring Items, Homies, places, or Events.</p><button className="primary learn-primary" onClick={()=>dispatch({type:'prepare'})}>Prepare combat →</button></>}
              {state.stage==='combat' && <><fieldset className="learn-weapons"><legend>Choose your weapon</legend><label><input type="radio" name="tutorial-weapon" checked={state.weapon==='axe'} onChange={()=>dispatch({type:'weapon',weapon:'axe'})}/><GameArtwork kind="weapon"/><span>Axe <small>+2 to your combat total</small></span></label><label><input type="radio" name="tutorial-weapon" checked={state.weapon==='none'} onChange={()=>dispatch({type:'weapon',weapon:'none'})}/><GameArtwork kind="character"/><span>No weapon <small>Use your base Combat Bonus</small></span></label></fieldset><button className="primary learn-primary" onClick={()=>dispatch({type:'fight'})}>Roll combat →</button><p className="learn-caption">Use one weapon per fight. The real game handles the total.</p></>}
              {state.stage==='result' && <><div className="learn-equation"><div><b>5</b><span>Die roll</span></div><i>+</i><div><b>2</b><span>Base bonus</span></div>{state.weapon==='axe'&&<><i>+</i><div><b>2</b><span>Axe</span></div></>}<i>=</i><div className="total"><b>{state.weapon==='axe'?9:7}</b><span>Your total</span></div></div><p className="learn-win">{state.weapon==='axe'?9:7} beats 6. You win!</p><p>Your base Combat Bonus is now <b>3</b>. The Axe’s +2 helps in combat, but stays separate.</p><button className="primary learn-primary" onClick={finish}>End my practice turn →</button></>}
            </div></div>}
          </>}
        </> : <>
          <h2 id="learn-title" ref={heading} tabIndex={-1}>Only a few things to remember.</h2>
          <p className="learn-description">You don’t need to memorize the rulebook. Read the space or card when you reach it, and use the next-step panel to keep moving.</p>
          {current && <div className="learn-current"><span>YOUR TABLE RIGHT NOW</span><h3>{current.title}</h3><p>{current.detail}</p><button className="primary" onClick={showTable}>{current.attention?'Take me to my next step':'Back to my table'} →</button></div>}
          <dl className="learn-glossary"><div><dt>♥ Life</dt><dd>Your health. Keep an eye on it and look for healing when it gets low.</dd></div><div><dt>✦ Combat Bonus (CB)</dt><dd>Your fighting strength. Build your base bonus to 15 to enter Shangri-La. Equipment bonuses don’t count toward that entry requirement.</dd></div><div><dt>$ Cash</dt><dd>Buy equipment, use paid space effects, and pay the $100 inward crossing into Nethervoid.</dd></div><div><dt>Items & weapons</dt><dd>Equipment you carry. You normally have six Item slots. Pick one weapon for a fight.</dd></div><div><dt>Homies</dt><dd>Allies that travel with you and give bonuses or powers. They don’t use Item slots.</dd></div><div><dt>Fiends & Bones</dt><dd>Fiends are enemies you fight. Bones are conditions that can change your stats or choices. Read the displayed effect.</dd></div></dl>
          <div className="learn-next-tips"><h3>How to reach the center</h3><p>Build strength while exploring Detroit, Nethervoid, and the Dark Carnival. Ordinary inward crossings cost <b>$100 at the Pipeline</b> and <b>one discarded Item at the Portal</b>. Magic Ninja skips those tolls.</p><p>With <b>15 base Combat Bonus</b>, cross the Bridge into Shangri-La. A hidden ending reveals the final winning condition.</p><h3>If the game seems stuck</h3><p>Look at the next-step panel. It may be waiting for another player, a card response, combat equipment, or an Item discard. Tap the gold action button at the bottom to go directly to the choice that needs you.</p><p><b>Table ruling</b> means a special effect needs the players to apply the displayed instructions. Use the listed controls and finish the ruling to continue. This beta does not automate every card.</p></div>
          <button className="primary learn-primary" onClick={()=>{dispatch({type:'restart'});setTab('practice');}}>Try a practice turn →</button>
        </>}
      </div>
      <footer className="learn-footer"><span>{tab==='practice'?'A guided example • Same turn sequence as the game':'Keep this guide handy whenever you need it.'}</span>{tab==='practice'&&state.stage==='welcome'?<button className="primary" onClick={()=>dispatch({type:'start'})}>Start my practice turn →</button>:<button className="quiet" onClick={onClose}>{current?'Back to my table':'Close'}</button>}</footer>
    </div>
  </dialog>;
}
