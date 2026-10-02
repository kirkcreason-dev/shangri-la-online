"use client";
import { useState } from 'react';
import { card } from '@/lib/rules/catalog';
import { GameArtwork, cardArtwork } from './GameArtwork';
import { CardView } from './GameCard';

type Group = 'items' | 'homies' | 'bones';
export function InventoryTray({items,homies,bones,capacity,conditions=[],onUse}:{items:string[];homies:string[];bones:string[];capacity:number;conditions?:{id:string;name:string;rules:string;turns:number|null;branch:string|null}[];onUse?:(id:string)=>void}) {
  const [group,setGroup]=useState<Group>('items'),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
  const groups={items,homies,bones}, visible=groups[group].filter(id=>`${card(id).name} ${card(id).rules}`.toLowerCase().includes(query.trim().toLowerCase()));
  const active=visible.includes(selected)?selected:visible[0];
  return <section className="inventory-tray" aria-label="Your card tray">
    <div className="tray-heading"><h3>Your cards</h3><span>{items.length} / {capacity} Item slots</span></div>
    <div className="tray-tabs" role="group" aria-label="Card collection">{(['items','homies','bones'] as const).map(k=><button key={k} aria-pressed={group===k} onClick={()=>{setGroup(k);setQuery('');setSelected('');}}><GameArtwork kind={k==='items'?'item':k==='homies'?'homie':'bone'}/><span>{k==='bones'?'Bones':k==='items'?'Items':'Homies'} <b>{groups[k].length}</b></span></button>)}</div>
    {groups[group].length>3&&<label className="tray-search"><span className="sr-only">Search your {group}</span><input type="search" placeholder={`Find in your ${group}…`} value={query} onChange={e=>setQuery(e.target.value)}/></label>}
    {!visible.length?<div className="tray-empty"><GameArtwork kind={group==='items'?'item':group==='homies'?'homie':'bone'}/><strong>{query?'No matching cards':group==='items'?'Room for discoveries':group==='homies'?'Build your crew':'No Bone cards'}</strong><p>{query?'Try another name or clear the search.':group==='items'?'Items you buy or find will appear here.':group==='homies'?'Homies join you through encounters. They use no Item slots.':'Bone cards change your stats or choices. Read their effects here when you receive one.'}</p></div>:<>
      <div className="tray-hand" role="group" aria-label={`Choose one of your ${group}`}>{visible.map(id=>{const c=card(id);return <button key={id} aria-pressed={id===active} onClick={()=>setSelected(id)}><GameArtwork kind={cardArtwork(c)}/><strong>{c.name}</strong>{!!c.combat&&<small>+{c.combat} combat</small>}</button>;})}</div>
      <div className="tray-detail" aria-live="polite"><CardView id={active} onUse={onUse}/></div>
    </>}
    {conditions.length>0&&<details className="condition-summary"><summary>Active conditions · {conditions.length}</summary>{conditions.map(c=><p key={c.id}><strong>{c.name}</strong>{c.turns!==null?` · ${c.turns} future turn(s)`:''}{c.branch?` · ${c.branch}`:''}<span>{c.rules}</span></p>)}</details>}
  </section>;
}
