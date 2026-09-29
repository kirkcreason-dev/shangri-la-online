import { ask } from './reactions.ts';
import { card, cardName, character, COUNTS, findSpace, spaceName, spaceRule } from './catalog.ts';
import { absent, protectedItem } from './conditions.ts';
import type { Player, State } from './types.ts';

export type CardRuntime = {
  damage: (p: Player, amount: number) => void;
  heal: (p: Player, amount: number) => void;
  cash: (p: Player, amount: number) => void;
  bonus: (p: Player, amount: number) => void;
  loseTurn: (p: Player) => void;
  bone: (p: Player) => void;
  remove: (p: Player, id: string) => void;
  receive: (p: Player, id: string, homie?: boolean) => void;
  transfer: (from: Player, to: Player, id: string, homie?: boolean) => void;
  discard: (id: string) => void;
  removeBoard: (ids: string[]) => void;
  move: (p: Player, region: number, pos: number) => void;
  die: (p: Player, sides?: number) => number;
  log: (text: string) => void;
};
const living = (s: State) => s.players.filter(p => !p.dead && !p.respawn && !absent(p));
export function neighbor(s: State, p: Player, direction: number) {
  const start = s.players.indexOf(p);
  for (let n = 1; n < s.players.length; n++) {
    const q = s.players[(start + direction * n + s.players.length * n) % s.players.length];
    if (!q.dead && !q.left && !q.respawn && !absent(q)) return q;
  }
  return p;
}
export const uniqueCards = (ids:string[]) => [...new Map(ids.map(id=>[card(id).key,id])).values()];
function choose(p: Player, message: string, choices: {id:string;label:string}[]) {
  if (!choices.length) return null;
  return choices.length === 1 ? choices[0].id : ask({player:p.id,message,choices});
}
function optional(p: Player, message: string, label: string) {
  return ask({player:p.id,message,choices:[{id:'yes',label},{id:'no',label:'Pass · keep what I have'}]}) === 'yes';
}
export function discardChoice(s: State, p: Player, fx: CardRuntime, kind: 'items'|'homies', count=1, chooser=p, filter=(id:string)=>true) {
  for (let i=0;i<count;i++) {
    const held = p[kind].filter(id=>!protectedItem(p,id)&&filter(id));
    const id=choose(chooser,`${p.name} must discard ${count>1?`${i+1} of ${count}`:'one'} ${kind==='items'?'Item':'Homie'}.`,held.map(id=>({id,label:`Discard ${cardName(id)}`})));
    if (!id) break;
    fx.remove(p,id);
    fx.log(`${p.name} resolved the discard of ${cardName(id)}.`);
  }
}
function destination(p:Player, region:number, message:string) {
  const id=choose(p,message,Array.from({length:COUNTS[region]},(_,pos)=>({id:`${region}:${pos}`,label:spaceName(region,pos)})))!;
  return Number(id.split(':')[1]);
}
export function encounterEffect(s: State, p: Player, id:string, fx:CardRuntime) {
  const name=cardName(id);
  const moveTo=(name:string)=>{const at=findSpace(name);fx.move(p,at.region,at.pos);};
  switch(name) {
    case 'Dred-a-Bone': case 'Bugz on My Nugz': fx.bone(p); break;
    case 'Prom Queen': fx.heal(p,1); break;
    case 'Spiritual Blessings': fx.heal(p,1);fx.bonus(p,1);break;
    case 'Fritz Tha Cat': break;
    case 'Samantha':
      fx.bonus(p,1);
      if(p.character==='Magic Ninja'){fx.heal(p,p.maxLife);if(optional(p,name,'Take an extra turn'))p.extraTurns++;}break;
    case 'Ry Ry': if(optional(p,name,'Lose one turn · gain $300')){fx.cash(p,300);fx.loseTurn(p);}break;
    case 'Hazad': fx.cash(p,-500);break;
    case 'P Born': discardChoice(s,p,fx,'items',1,p,id=>!!card(id).weapon);fx.cash(p,-300);break;
    case 'Psychopathic Rydas': discardChoice(s,p,fx,'items',2);break;
    case 'J. D. Tha Weedman': discardChoice(s,p,fx,'homies',1,neighbor(s,p,1));break;
    case 'Don at Hatchetgear': {
      const herb=choose(p,name,uniqueCards(s.purchase.filter(id=>card(id).use==='herb')).map(id=>({id,label:`Take ${cardName(id)}`})));
      if(herb){s.purchase.splice(s.purchase.indexOf(herb),1);fx.receive(p,herb);}break;
    }
    case 'N²': {
      for(let i=0,limit=p.items.length;i<limit;i++){
        const items=p.items.filter(id=>!protectedItem(p,id));if(!items.length)break;
        const sold=ask({player:p.id,message:'Sell any Items for $200 each.',choices:[...items.map(id=>({id,label:`Sell ${cardName(id)} · gain $200`})),{id:'done',label:'Finish selling'}]});
        if(sold==='done')break;fx.remove(p,sold);fx.cash(p,200);
      }break;
    }
    case 'The NX Challenge': fx.loseTurn(p);break;
    case 'Wizard of the Hood': case 'Dark Lotus':
      if(p.allegiance===(name==='Dark Lotus'?'Dark Carnival':'Nethervoid'))fx.heal(p,1);else fx.loseTurn(p);break;
    case 'The Smog': for(const q of living(s).filter(q=>q.region===1))fx.damage(q,1);break;
    case 'Kottonmouth Kings':
      for(const q of living(s).filter(q=>q.region===1)){const r=fx.die(q);if(r<=2)fx.damage(q,1);else if(r===3)discardChoice(s,q,fx,'homies');else if(r===4)fx.loseTurn(q);}break;
    case 'Ghetto Freak Show':
      for(const q of living(s).filter(q=>q.region===2)){fx.loseTurn(q);if(fx.die(q,10)<=5)fx.damage(q,1);}break;
    case 'Wheel of Bone': {
      const r=fx.die(p);
      for(const q of living(s).filter(q=>q.region===2)){
        const hit=[q.items.some(id=>card(id).weapon),q.homies.length>0,q.life===q.maxLife,q.life<q.maxLife,q.cash>=500,q.cash<500][r-1];
        if(hit)fx.damage(q,1);
      }break;
    }
    case 'Under the Big Top':
      if(optional(p,name,'Roll · risk Life or a Homie for +2 Combat Bonus')){const r=fx.die(p);if(r<=2)fx.damage(p,1);else if(r<=4)discardChoice(s,p,fx,'homies');else fx.bonus(p,2);}break;
    case "Joker's Wild Show": {
      const r=fx.die(p);if(r<=2)discardChoice(s,p,fx,'items',2);else {fx.cash(p,-p.cash);if(r<=4)fx.bone(p);}break;
    }
    case 'Night of the Axe': {
      const homies=[...p.homies];if(fx.die(p)<=2)fx.damage(p,1);
      if(!p.dead&&!p.respawn)for(const id of homies){if(p.homies.includes(id)&&fx.die(p)<=2)fx.remove(p,id);}break;
    }
    case 'Ryden Dirtay': {const r=fx.die(p,10);if(r===10||r>p.bonus)fx.damage(p,1);break;}
    case 'Mad Mad World': case 'Demonic Hoard':
      {const cleared=new Set<string>();
      for(const [space,ids] of Object.entries(s.board))if(space.startsWith(name==='Mad Mad World'?'0:':'1:'))for(const c of [...ids])if(fx.die(p)>=3){fx.removeBoard([c]);fx.discard(c);cleared.add(c);fx.log(`${cardName(c)} was cleared from the board.`);}
      s.queue=s.queue.filter(id=>!cleared.has(id));
      if(s.encounter&&cleared.has(s.encounter)){s.encounter=s.queue.shift()??null;s.phase=s.encounter?'encounter':'end';}
      break;}
    case 'Steve Extra': case 'Wizard of Delray': {
      const spaces=name==='Steve Extra'?['The Road','Military Street','Zug Island','Police Station','Mexican Town','The Dark Forest']:['Knapp Cemetery','Echoside','The Dark Forest','Valley of the Crow','Chaos District','Halls of Illusions'];
      const r=fx.die(p);if(spaces[r-1])moveTo(spaces[r-1]);break;
    }
    case "Stank and Poot's Parents": moveTo(character(p.character).startingSpace);break;
    case 'Sugar Bear': {
      const target=choose(p,name,living(s).filter(q=>q.region!==3).map(q=>({id:q.id,label:`Move ${q.name} to Chaos District`})));const q=s.players.find(q=>q.id===target);
      if(q){const at=findSpace('Chaos District');fx.move(q,at.region,at.pos);}break;
    }
    case 'Missy': if(p.cash>=100&&optional(p,name,'Pay $100 · travel anywhere in Nethervoid')){const pos=destination(p,1,'Choose your Nethervoid destination.');fx.cash(p,-100);fx.move(p,1,pos);}break;
    case 'John Kickjazz': case 'Myzery': {
      const homie=name==='Myzery',key=homie?'homies':'items';
      const choices=living(s).filter(q=>q.id!==p.id&&(homie||q.region===0)).flatMap(q=>q[key].filter(id=>!protectedItem(q,id)).map(id=>({id:`${q.id}|${id}`,label:`Pay $100 · take ${cardName(id)} from ${q.name}`})));
      if(p.cash>=100&&choices.length){const selection=ask({player:p.id,message:name,choices:[...choices,{id:'pass',label:'Pass · keep my cash'}]});if(selection!=='pass'){const [target,item]=selection.split('|');const q=s.players.find(q=>q.id===target)!;fx.cash(p,-100);fx.transfer(q,p,item,homie);}}break;
    }
    case 'Tom Hay': {let pos=destination(p,0,'Choose your destination in Detroit.');const r=fx.die(p);if(r<=2){pos=(pos+1)%COUNTS[0];fx.damage(p,1);}if(!p.dead&&!p.respawn)fx.move(p,0,pos);break;}
    case 'Sticky Icky Situation':
      if(p.homies.length&&optional(p,name,'Discard a Homie · prevent 1 Life loss'))discardChoice(s,p,fx,'homies');else fx.damage(p,1);break;
    case 'Pop Truck': if(p.life<p.maxLife&&optional(p,name,'Heal 1 Life'))fx.heal(p,1);break;
    case "Joker's Gallery": if(optional(p,name,'Enter · gain 1 Combat Bonus'))fx.bonus(p,1);break;
    case 'Mystery Seminar': if(optional(p,name,'Roll · chance to gain 1 Combat Bonus')){const r=fx.die(p);if(r<=2)fx.loseTurn(p);else if(r>=5)fx.bonus(p,1);}break;
    case 'Guts on the Ceiling': case 'Juggalo Gathering':
      if(p.allegiance===(name==='Juggalo Gathering'?'Dark Carnival':'Nethervoid')){if(optional(p,name,'Take an extra turn'))p.extraTurns++;}else fx.damage(p,1);break;
    case 'Mike E. Clark': {
      const at=ask({player:p.id,message:name,choices:[...['Psychopathic Records',"St. Andrew's",'Zug Island','Oz'].map(id=>({id,label:`Travel to ${id}`})),{id:'pass',label:'Stay here'}]});if(at!=='pass')moveTo(at);break;
    }
    case 'Street Team': if(optional(p,name,'Roll · travel to a new space')){const r=fx.die(p),at=['Police Station','Knapp Cemetery','Psychopathic Records','Clark Park','Casino','The Loon District'][r-1];if(at)moveTo(at);}break;
    case "Spudler's Black Market": case 'Three 6 Mafia Trunk Sale': {
      const at=findSpace(name==="Spudler's Black Market"?'Southwest':'Oz');
      const prices=spaceRule(at.region,at.pos).effects.find((e:any)=>e.type==='shop').buy.prices;
      for(let i=0,limit=s.purchase.length;i<limit;i++){
        const choices=uniqueCards(s.purchase).flatMap(id=>{const base=prices[cardName(id).toLowerCase()];const cost=base===undefined?Infinity:Math.max(name==="Spudler's Black Market"?100:0,base-100);return cost<=p.cash?[{id,label:`Buy ${cardName(id)} · $${cost}`}]:[];});
        if(!choices.length)break;
        const item=ask({player:p.id,message:name,choices:[...choices,{id:'done',label:'Finish shopping'}]});if(item==='done')break;
        const base=prices[cardName(item).toLowerCase()],cost=Math.max(name==="Spudler's Black Market"?100:0,base-100);
        fx.cash(p,-cost);s.purchase.splice(s.purchase.indexOf(item),1);fx.receive(p,item);
      }break;
    }
    default: throw Error('This card does not have an automatic encounter.');
  }
  fx.log(`${p.name} resolved ${name}.`);
}

export function fiendLoss(s:State,p:Player,id:string,fx:CardRuntime){
  const n=cardName(id),move=(name:string)=>{const at=findSpace(name);fx.move(p,at.region,at.pos);};
  if(['Steve Stitchmore','Ape Boy'].includes(n))fx.cash(p,-100);
  if(n==='Father Duckett')fx.cash(p,-200);
  if(['T. Dub','Corrupt Cop','Police Chief','Golden Goldies'].includes(n))fx.cash(p,-p.cash);
  if(n==='T. Dub'){fx.removeBoard([id]);fx.discard(id);}
  if(['Backstage Sluts','Mr. Sesame Seed','Roxie Carol'].includes(n))fx.bone(p);
  if(["Hornswagglin' Hillbilly",'Scarecrow'].includes(n))fx.loseTurn(p);
  if(n==='Pickle')move('Freer Bar');
  if(n==='1/2 Ton Hillbilly')move('Hospital');
  if(['Corrupt Cop','Police Chief'].includes(n))move('Police Station');
  if(n==='Ape Boy')discardChoice(s,p,fx,'items');
  if(['Southwest Strangla','Green Willy','Bandalog Death Beast'].includes(n))discardChoice(s,p,fx,'homies',1,neighbor(s,p,-1));
  if(n==='Bootleg Greg'||n==='Big Silva')discardChoice(s,p,fx,'items',1,neighbor(s,p,n==='Big Silva'?-1:1));
  const items=p.items.filter(id=>n==='Police Chief'?(card(id).weapon||card(id).use==='herb'):n==='The Tin Man'?card(id).ranged:n==='Soopa Villains'?card(id).vehicle:n==="Big Stank and Li'l Poot"?['Blow-up Doll','PuBu Gear'].includes(cardName(id)):false);
  for(const id of items)fx.remove(p,id);
  if(n==='The Lion')for(const id of [...p.homies])if(card(id).female)fx.remove(p,id);
}
