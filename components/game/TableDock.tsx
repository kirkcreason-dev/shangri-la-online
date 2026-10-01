"use client";
import type { Action } from '@/lib/rules/types';
import type { tableGuidance } from '@/lib/table-guide';
import { jumpToTableSection } from './TableGuide';

export function TableDock({guide,busy,offline,reconnecting,hasCards=false,onAction}:{guide:ReturnType<typeof tableGuidance>;busy:boolean;offline:boolean;reconnecting:boolean;hasCards?:boolean;onAction:(a:Action)=>void}) {
  const movement=guide.target==='available-destinations';
  const label=busy?'Saving…':guide.quick?.label??(movement?'Choose destination':guide.attention?'Open my choices':'Table details');
  return <nav className="table-dock" aria-label="Table shortcuts">
    <div className="dock-status"><span>{offline?'OFFLINE':reconnecting?'RECONNECTING':guide.attention?'YOUR NEXT STEP':'AT THE TABLE'}</span><strong>{guide.title}</strong></div>
    <div className="dock-links"><button onClick={()=>jumpToTableSection('table-board')}>◇ Board</button>{hasCards&&<button onClick={()=>jumpToTableSection('table-character')}>My cards</button>}<button onClick={()=>jumpToTableSection('table-chat')}>Chat</button></div>
    <button className={guide.attention?'primary dock-action':'secondary dock-action'} disabled={busy||!!guide.quick&&(offline||reconnecting)} onClick={()=>guide.quick?onAction(guide.quick.action):jumpToTableSection(guide.target)}>{label}{!guide.quick?' ↑':''}</button>
  </nav>;
}

export function QuestProgress({bonus,region,dead,ending}:{bonus:number;region:number;dead?:boolean;ending?:string}) {
  if(dead)return null;
  const ready=bonus>=15,arrived=region===3;
  return <details className="quest-progress"><summary><span>YOUR QUEST</span><strong>{arrived?'Face the final challenge':ready?'You can cross the Bridge':`${15-bonus} more base CB to reach 15`}</strong><span aria-hidden="true">⌄</span></summary>
    <div className="quest-progress-track" role="progressbar" aria-label="Base Combat Bonus needed to enter Shangri-La" aria-valuemin={0} aria-valuemax={15} aria-valuenow={Math.min(15,Math.max(0,bonus))} aria-valuetext={`${bonus} base Combat Bonus; 15 needed`}><span style={{width:`${Math.min(100,Math.max(0,bonus/15*100))}%`}}/></div>
    <ol><li>Win fights and resolve encounters to build your base Combat Bonus.</li><li>Reach <strong>15 base CB</strong>, then cross the Bridge in the Dark Carnival.</li><li>{ending?`Complete ${ending}.`:'Reveal and complete the ending in Shangri-La.'}</li></ol>
    <p>Weapon and Homie bonuses help you fight, but do not count toward the 15 base CB needed to cross.</p>
    <dl><div><dt>Life ♥</dt><dd>Your remaining health.</dd></div><div><dt>CB</dt><dd>Your base combat strength.</dd></div><div><dt>Cash $</dt><dd>Spend on Items, tolls and services.</dd></div></dl>
  </details>;
}
