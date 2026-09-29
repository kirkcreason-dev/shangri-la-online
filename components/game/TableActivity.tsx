"use client";
import { useEffect, useRef, useState } from 'react';
import { Axe, Coins, Footprints, Sparkles, DoorOpen } from 'lucide-react';
import { ChoiceFace } from './ChoiceCards';
import type { TableMoment } from '@/lib/rules/types';
export function TableActivity({moments=[],roomCode,rolling=false}:{moments?:TableMoment[];roomCode:string;rolling?:boolean}){
  const last=useRef({code:roomCode,id:moments.at(-1)?.id??0});
  const [visible,setVisible]=useState<TableMoment[]>(()=>moments.slice(-1));
  const [animate,setAnimate]=useState(false);
  useEffect(()=>{
    if(last.current.code!==roomCode){last.current={code:roomCode,id:moments.at(-1)?.id??0};setVisible(moments.slice(-1));setAnimate(false);return;}
    const next=moments.filter(m=>m.id>last.current.id);
    if(next.length){setVisible(next.slice(-4));setAnimate(true);last.current.id=next.at(-1)!.id;}
  },[moments,roomCode]);
  if(!visible.length&&!rolling)return null;
  return <section className={`table-moments${animate?' animate':''}`} aria-label="Latest table action" aria-live="polite" aria-atomic="true">
    {rolling?<div className="moment rolling"><span className="moment-dice"><b>✦</b><b>✦</b></span><div><span className="eyebrow">ON THE TABLE</span><strong>Rolling the dice…</strong></div></div>:visible.map(m=>{
      const Icon=m.kind==='move'?Footprints:m.kind==='combat'?Axe:m.kind==='reward'?Coins:m.kind==='departure'?DoorOpen:Sparkles;
      return <article key={m.id} className={`moment moment-${m.kind} ${m.result??''}`}>
        {m.card?<span className="moment-card"><ChoiceFace label={m.title} value={m.card} compact/></span>:<span className="moment-emblem"><Icon strokeWidth={1.5}/></span>}
        {!m.card&&<div className="moment-copy"><span className="eyebrow">{m.kind==='reward'?'APPLIED AUTOMATICALLY':'AT THE TABLE'}</span><strong>{m.title}</strong><p>{m.detail}</p></div>}
        {!!m.dice?.length&&<span className="moment-dice" aria-label={`Rolled ${m.dice.join(' and ')}`}>{m.dice.map((d,i)=><b key={i}>{d}</b>)}</span>}
        {m.changes&&<span className="moment-changes">{m.changes.map(c=><b className={c.amount>0?'gain':'loss'} key={c.label}>{c.amount>0?'+':'−'}{c.label==='Cash'?'$':''}{Math.abs(c.amount)}<small>{c.label}</small></b>)}</span>}
      </article>;
    })}
  </section>;
}
