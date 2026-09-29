"use client";
import { Children, Fragment, isValidElement, useId, useState, type ReactNode, type SelectHTMLAttributes, type ChangeEvent } from 'react';
import { Axe, Shield, Skull, Users, Footprints, Dices, Heart, Coins, Sparkles, DoorOpen, ArrowRight, Check, ShoppingBag, BookOpen } from 'lucide-react';
import { CARDS, CHARACTERS } from '@/lib/rules/catalog';
import { gameAsset } from '@/lib/client-connection';
import { BOARD_SPACES } from '@/lib/board-display';
import type { Option } from '@/lib/rules/types';

function plain(node:ReactNode):string {return Children.toArray(node).map(n=>typeof n==='string'||typeof n==='number'?String(n):isValidElement<{children?:ReactNode}>(n)?plain(n.props.children):'').join('');}
export function choiceLook(label:string,value='') {
  const c=CARDS.find(c=>c.key===value.split('@')[0])??CARDS.find(c=>label.includes(c.name));
  const text=label.toLowerCase();
  const tile=BOARD_SPACES.find(s=>s.name===label||`Travel to ${s.name}`===label);
  const startKind=label==='Play now'?'roll':label==='Host online game'?'character':label==='Learn by playing'?'tutorial':undefined;
  const kind=startKind??(tile?'location':undefined)??c?.kind??(CHARACTERS.includes(label)?'character':/roll|dice|die/.test(text)?'roll':/life|heal/.test(text)?'health':/\$|cash|buy|sell/.test(text)?'cash':/move|travel|teleport|detroit|nethervoid|carnival/.test(text)?'move':/end|leave|quit|pass|finish/.test(text)?'end':'power');
  const Icon=kind==='tutorial'?BookOpen:c?.weapon?Axe:c?.use==='armor'?Shield:kind==='fiend'?Skull:kind==='homie'||kind==='character'?Users:kind==='roll'?Dices:kind==='health'?Heart:kind==='cash'?Coins:kind==='move'||kind==='location'?Footprints:kind==='end'?DoorOpen:kind==='item'?ShoppingBag:Sparkles;
  const region=typeof c?.deck==='number'?c.deck:kind==='fiend'?1:kind==='cash'?0:2;
  return {c,kind,Icon,region:tile?.region??region,tile};
}
export function ChoiceFace({label,value='',compact=false}:{label:string;value?:string;compact?:boolean}){
  const {c,kind,Icon,region,tile}=choiceLook(label,value);
  return <><span className={`choice-art region-${region}${compact?' compact':''}`} aria-hidden="true">{tile?<svg className="choice-tile" viewBox={`${tile.column*100} ${tile.row*100} 100 100`}><image href={gameAsset('board-reference.jpg')} width="800" height="800"/></svg>:<><img src={gameAsset('board-reference.jpg')} alt=""/><span className="choice-sigil"><Icon strokeWidth={1.3}/></span></>}<span className="choice-corner">✦</span></span><span className="choice-copy"><span className="choice-kind">{c?.weapon?'Weapon':kind==='power'?'Your choice':kind==='character'&&label==='Host online game'?'Online table':kind}</span><strong>{label}</strong>{c&&<span className="choice-badges">{!!c.combat&&<i>+{c.combat} combat</i>}{c.strength!==undefined&&<i>Strength {c.strength}</i>}{c.reward!==undefined&&<i>+{c.reward} CB reward</i>}</span>}</span></>;
}
export function ChoiceCard({option,disabled,onChoose}:{option:Option;disabled?:boolean;onChoose:()=>void}){
  const value=option.action.item??option.action.choice??'';
  return <button type="button" className="choice-card" aria-label={option.label} disabled={disabled} onClick={onChoose}><ChoiceFace label={option.label} value={value}/><span className="choice-foot">Choose <ArrowRight size={14}/></span></button>;
}
type Entry={value:string;label:string;disabled:boolean};
function entries(children:ReactNode):Entry[]{return Children.toArray(children).flatMap(child=>{
  if(!isValidElement<{children?:ReactNode;value?:string|number;disabled?:boolean}>(child))return [];
  if(child.type===Fragment||child.type==='optgroup')return entries(child.props.children);
  return child.type==='option'?[{value:String(child.props.value??plain(child.props.children)),label:plain(child.props.children),disabled:!!child.props.disabled}]:[];
});}
// The form value stays controlled; every choice is also a keyboard-accessible card.
export function CardSelect({children,value,onChange,disabled,...props}:SelectHTMLAttributes<HTMLSelectElement>){
  const id=useId(),[search,setSearch]=useState('');const all=entries(children),selected=String(value??all[0]?.value??'');
  const shown=all.filter(o=>!search||o.label.toLowerCase().includes(search.toLowerCase()));
  const label=props['aria-label']??'Choose an option';
  const focusValue=shown.find(o=>!o.disabled&&o.value===selected)?.value??shown.find(o=>!o.disabled)?.value;
  const choose=(v:string)=>onChange?.({target:{value:v},currentTarget:{value:v}} as ChangeEvent<HTMLSelectElement>);
  return <span className="card-select" id={props.id}>
    {all.length>8&&<span className="choice-search"><input aria-label={`Find ${label.toLowerCase()}`} placeholder={`Find ${label.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)}/><small>{shown.length} choices</small></span>}
    <span className={`choice-picker${all.length>6?' scrollable':''}`} role="radiogroup" aria-label={label} aria-disabled={disabled}>
      {shown.map((o,i)=><button key={o.value+'-'+i} id={`${id}-${i}`} type="button" role="radio" aria-checked={o.value===selected} aria-label={o.label} disabled={disabled||o.disabled} tabIndex={o.value===focusValue?0:-1} className={`choice-card choice-mini${o.value===selected?' selected':''}`} onClick={()=>choose(o.value)} onKeyDown={e=>{
        if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
        const available=shown.filter(x=>!x.disabled);let n=available.findIndex(x=>x.value===o.value);
        n=e.key==='Home'?0:e.key==='End'?available.length-1:(n+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)+available.length)%available.length;
        const next=available[n];if(next){choose(next.value);const nextIndex=shown.indexOf(next);document.getElementById(`${id}-${nextIndex}`)?.focus();}
      }}><ChoiceFace label={o.label} value={o.value} compact/><span className="choice-selected" aria-hidden="true">{o.value===selected?<Check size={13}/>:<span/>}</span></button>)}
      {!shown.length&&<span className="small">No matching choices.</span>}
    </span>
  </span>;
}
