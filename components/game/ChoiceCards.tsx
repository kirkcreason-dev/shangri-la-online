"use client";
import { Children, Fragment, isValidElement, useId, useState, type ReactNode, type SelectHTMLAttributes, type ChangeEvent } from 'react';
import { Axe, Shield, Skull, Users, Footprints, Dices, Heart, Coins, Sparkles, DoorOpen, ArrowRight, Check, ShoppingBag, BookOpen } from 'lucide-react';
import { CARDS, CHARACTERS } from '@/lib/rules/catalog';
import { GameArtwork, cardArtwork } from './GameArtwork';
import { gameAsset } from '@/lib/client-connection';
import { BOARD_SPACES } from '@/lib/board-display';
import type { Option } from '@/lib/rules/types';
import './choice-polish.css';

function plain(node:ReactNode):string {return Children.toArray(node).map(n=>typeof n==='string'||typeof n==='number'?String(n):isValidElement<{children?:ReactNode}>(n)?plain(n.props.children):'').join('');}
export function choiceLook(label:string,value='',characterChoice=false) {
  const c=characterChoice?undefined:CARDS.find(c=>c.key===value.split('@')[0])??CARDS.find(c=>label.includes(c.name));
  const text=label.trim().toLowerCase();
  const equipment=!characterChoice&&/^(fight(?:ing)? unarmed|no weapon)$/.test(text)?{kind:'weapon',label:'Combat style'}:!characterChoice&&text==='save my drinks'?{kind:'drink',label:'Keep your drink'}:!characterChoice&&/^no armou?r$/.test(text)?{kind:'armor',label:'Defense'}:undefined;
  const tile=BOARD_SPACES.find(s=>s.name===label||`Travel to ${s.name}`===label);
  const startKind=label==='Play now'?'roll':label==='Host online game'?'character':label==='Learn by playing'?'tutorial':undefined;
  const kind=(characterChoice?'character':undefined)??equipment?.kind??startKind??(tile?'location':undefined)??c?.kind??(CHARACTERS.includes(label)?'character':/roll|dice|die/.test(text)?'roll':/life|heal/.test(text)?'health':/\$|cash|buy|sell/.test(text)?'cash':/move|travel|teleport|detroit|nethervoid|carnival/.test(text)?'move':/end|leave|quit|pass|finish/.test(text)?'end':'power');
  const Icon=kind==='tutorial'?BookOpen:c?.weapon||kind==='weapon'?Axe:c?.use==='armor'||kind==='armor'?Shield:kind==='fiend'?Skull:kind==='homie'||kind==='character'?Users:kind==='roll'?Dices:kind==='health'?Heart:kind==='cash'?Coins:kind==='move'||kind==='location'?Footprints:kind==='end'?DoorOpen:kind==='item'||kind==='drink'?ShoppingBag:Sparkles;
  const region=typeof c?.deck==='number'?c.deck:kind==='fiend'?1:kind==='cash'?0:2;
  return {c,kind,Icon,artKind:c?cardArtwork(c):kind,region:tile?.region??region,tile,equipmentLabel:equipment?.label};
}
export function ChoiceFace({label,value='',compact=false,characterChoice=false,category}:{label:string;value?:string;compact?:boolean;characterChoice?:boolean;category?:string}){
  const {c,kind,Icon,artKind,region,tile,equipmentLabel}=choiceLook(label,value,characterChoice);
  const kindLabel=category??equipmentLabel??(c?.weapon?'Weapon':kind==='power'?'Card effect':kind==='character'&&label==='Host online game'?'Online table':kind==='roll'?'Dice':kind==='health'?'Life':kind==='cash'?'Cash':kind==='end'?'Turn':kind);
  const signed=(n:number)=>`${n>0?'+':''}${n}`;
  return <><span className={`choice-art region-${region}${compact?' compact':''}`} aria-hidden="true">{tile?<svg className="choice-tile" viewBox={`${tile.column*100} ${tile.row*100} 100 100`}><image href={gameAsset('board-reference.jpg')} width="800" height="800"/></svg>:<GameArtwork kind={artKind}/>}<span className="choice-corner">✦</span></span><span className="choice-copy"><span className="choice-kind"><Icon size={11} aria-hidden="true"/>{kindLabel}</span><strong>{label}</strong>{c&&<span className="choice-badges">{!!c.combat&&<i>{signed(c.combat)} combat</i>}{c.strength!==undefined&&<i>Strength {c.strength}</i>}{c.reward!==undefined&&<i>{signed(c.reward)} CB reward</i>}</span>}</span></>;
}
type Cue={detail:string;next:string;tone?:'gain'|'risk'|'power'};
function choiceCue({action:a,label}:Option):Cue {
  switch(a.type){
    case 'roll':return /ending/i.test(label)?{detail:'Carry out the revealed ending’s turn effect.',next:'Resolve ending',tone:'power'}:a.choice==='pick'?{detail:'Roll two dice, then pick the die you want to use.',next:'Roll & pick a die'}:a.choice==='two'||a.choice==='truck'?{detail:'Add both dice together for your movement.',next:'Roll two dice'}:{detail:'Roll for movement, then choose a highlighted space.',next:'Roll the dice'};
    case 'movement-choice':return {detail:'Use this die’s value to reveal your destinations.',next:'Show destinations'};
    case 'move':return {detail:'Move your piece here and encounter the space.',next:'Travel here'};
    case 'end':return {detail:'Finish your turn and hand play to the next player.',next:'Next player'};
    case 'location':return {detail:a.choice==='club'?'Spend $100 for +2 on the club roll.':'Apply this space’s rules or encounter its waiting cards.',next:'Encounter this space'};
    case 'ignore-location':return {detail:'Your character skips this space’s effect.',next:'Skip location effect'};
    case 'resolve':return label==='Prepare combat'?{detail:'Review your equipment before the fight begins.',next:'Prepare your fight',tone:'risk'}:{detail:'Apply the revealed card’s rules.',next:'Resolve this card'};
    case 'attack':return {detail:'Challenge this player instead of encountering the space.',next:'Prepare the challenge',tone:'risk'};
    case 'ranged':return {detail:'Use a ranged Weapon to challenge this adjacent target.',next:'Prepare ranged combat',tone:'risk'};
    case 'buy':return {detail:'Pay the shown price and add this Item to your inventory.',next:'Buy this Item',tone:'gain'};
    case 'sell':return {detail:'Return this Item to the shop and collect its sale value.',next:'Sell this Item'};
    case 'heal':return {detail:'Recover Life at the Hospital. Health Insurance covers the cost.',next:'Recover Life',tone:'gain'};
    case 'herb':return {detail:'Consume this Herb before rolling to recover the shown Life.',next:'Use Herb & heal',tone:'gain'};
    case 'cure-bone':return {detail:'Pay the shown Hospital fee to remove this Bone card.',next:'Pay & cure',tone:'gain'};
    case 'overflow-discard':return {detail:'Remove this Item to get back within your carry limit.',next:'Discard this Item',tone:'risk'};
    case 'penalty':return a.choice==='cash'?{detail:'Collect Cash from the defeated player.',next:'Take the Cash',tone:'gain'}:a.choice==='item'?{detail:'Take this Item from the defeated player.',next:'Claim this Item',tone:'gain'}:a.choice==='homie'?{detail:'The defeated player loses this Homie.',next:'Discard their Homie',tone:'risk'}:{detail:'Choose Life loss as the defeated player’s penalty.',next:'Apply Life penalty',tone:'risk'};
    case 'trade-accept':return {detail:'Exchange the Items and Cash in the offered trade.',next:'Complete this trade',tone:'gain'};
    case 'trade-decline':return {detail:'Close the offer and keep your possessions.',next:'Decline the offer'};
    case 'peek':return {detail:'Inspect the top card of this region’s deck.',next:'Look into the deck',tone:'power'};
    case 'ending-accept':return {detail:'Begin the revealed ending and follow its winning condition.',next:'Begin this ending',tone:'power'};
    case 'ending-replace':return {detail:'Discard Psychopathic Ring to reveal a replacement ending.',next:'Use Ring & replace',tone:'power'};
    case 'ending-roll':return {detail:'Roll d6 plus previous failed attempts. Reach 6 to win.',next:'Face The Wraith',tone:'power'};
    case 'ending-target':return {detail:'Apply your current ending’s effect to this player.',next:'Choose this opponent',tone:'risk'};
    case 'bone-decision':return a.target?{detail:'This player draws the Bone card instead of you.',next:'Transfer the Bone draw',tone:'power'}:a.choice==='skateboard'?{detail:'Roll d10. A result of 4 or more avoids the Bone draw.',next:'Try the Skateboard',tone:'power'}:{detail:'Draw and apply a Bone card to your character.',next:'Draw the Bone card',tone:'risk'};
    case 'ruling-die':return {detail:'Roll an unmodified die for the table’s current ruling.',next:`Roll d${a.amount??6}`};
    case 'ruling-finish':return {detail:'Confirm the table has applied the card’s effects.',next:a.choice==='keep'?'Keep & continue':a.choice==='leave'?'Leave & continue':a.choice==='discard'?'Discard & continue':'Continue play'};
    case 'card-response':return {detail:'Continue the card with the result you select.',next:'Confirm this result'};
    case 'power':{
      const powers:Record<string,Cue>={
        purchase_extra_turn:{detail:'Spend $200 to gain an extra turn.',next:'Buy an extra turn',tone:'gain'},
        paid_training:{detail:'Spend $300 and lose a turn to gain +1 base Combat Bonus.',next:'Pay & train',tone:'gain'},
        fiend_victory_extra_turn:{detail:'Roll d10. A result of 6 or more gives you an extra turn.',next:'Roll for another turn',tone:'power'},
        bribe_fiend:{detail:'Pay $100 to leave this Fiend fight and move to your turn’s end.',next:'Pay & avoid the fight'},
        evade_on_common_spaces:{detail:'Leave this fight and move to your turn’s end.',next:'Evade this fight'},
        consume_homies:{detail:'Discard this Homie to recover 1 Life.',next:'Trade Homie for Life',tone:'gain'},
        cash_in_homies:{detail:'Discard this Homie and roll for a Cash payout.',next:'Trade Homie for Cash'},
        change_allegiance:{detail:'Switch allegiance; lose cards that require your old allegiance.',next:'Switch allegiance',tone:'risk'},
        take_cash:{detail:'Take up to $100 from this player.',next:'Collect their Cash',tone:'gain'},
        steal_item:{detail:'Roll d10. On 8 or more, take this Item.',next:'Attempt the steal',tone:'power'},
        steal_homie:{detail:'Roll d10. On 8 or more, take this Homie.',next:'Attempt the steal',tone:'power'},
        steal_vehicle:{detail:'Take this vehicle using your character’s power.',next:'Take the vehicle',tone:'power'},
        redirect_next_turn_loot:{detail:'Roll d10. On 6 or more, claim their next-turn loot.',next:'Roll to redirect loot',tone:'power'},
        replace_event:{detail:'Discard this Event and draw a replacement card.',next:'Replace this Event',tone:'power'},
        ignore_event_effect:{detail:'Discard this Event without applying its effect.',next:'Skip this Event',tone:'power'},
      };
      return powers[a.power??'']??{detail:'Apply your character’s named power.',next:'Activate this power',tone:'power'};
    }
    case 'item-use':return {detail:a.target?'Apply this card’s effect to the named player.':/discard|consume/i.test(label)?'Use this card’s effect, then discard it.':/roll d6/i.test(label)?'Roll a six-sided die and apply this card’s result.':'Apply the Item or Homie effect shown above.',next:a.target?'Use on this player':/roll d6/i.test(label)?'Roll for this card':'Activate this card',tone:'power'};
    default:return {detail:'',next:'Confirm selection'};
  }
}
export function ChoiceCard({option,disabled,onChoose}:{option:Option;disabled?:boolean;onChoose:()=>void}){
  const value=option.action.item??option.action.choice??'',cue=choiceCue(option),hintId=useId();
  return <button type="button" className={`choice-card action-choice${cue.tone?` choice-${cue.tone}`:''}`} aria-label={option.label} aria-describedby={cue.detail?hintId:undefined} disabled={disabled} onClick={onChoose}><ChoiceFace label={option.label} value={value} category={option.group}/>{cue.detail&&<span className="choice-result" id={hintId}>{cue.detail}</span>}<span className="choice-foot">{cue.next}<ArrowRight size={14} aria-hidden="true"/></span></button>;
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
      }}><ChoiceFace label={o.label} value={o.value} compact characterChoice={/character/i.test(String(label))}/><span className="choice-selected" aria-hidden="true">{o.value===selected?<Check size={13}/>:<span/>}</span></button>)}
      {!shown.length&&<span className="small">No matching choices.</span>}
    </span>
  </span>;
}
