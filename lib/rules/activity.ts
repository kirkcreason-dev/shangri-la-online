import { cardName, spaceName } from './catalog.ts';
import type { State, TableMoment } from './types.ts';
export function addMoment(s:State, moment:Omit<TableMoment,'id'>){
  const id=(s.activitySeq??0)+1;s.activitySeq=id;
  s.activity=[...(s.activity??[]),{...moment,id}].slice(-24);
}
export function recordActivity(before:State,s:State){
  // A suspended action has not committed any dice, payment, or reward yet.
  if(s.flow)return;
  // Match the unchanged suffix rather than the newest text: identical rolls may log identical lines.
  let common=0;
  while(common<before.log.length&&common<s.log.length&&before.log[before.log.length-1-common]===s.log[s.log.length-1-common])common++;
  const added=s.log.slice(0,s.log.length-common);
  if(JSON.stringify(s.lastCombat)!==JSON.stringify(before.lastCombat)&&s.lastCombat){
    const c=s.lastCombat,p=s.players.find(p=>p.id===c.actor);
    addMoment(s,{kind:'combat',player:c.actor,title:c.result==='win'?'Combat won':c.result==='loss'?'Combat lost':'Combat tied',detail:`${p?.name}: ${c.total} · ${c.opponent}: ${c.opposingTotal}`,dice:c.dice,result:c.result});
  }else if(s.lastDice.length&&(JSON.stringify(s.lastDice)!==JSON.stringify(before.lastDice)||added.some(l=>/rolled/.test(l)))){
    addMoment(s,{kind:'roll',title:'The dice are in',detail:added.find(l=>/rolled/.test(l))??`Rolled ${s.lastDice.join(' + ')}`,dice:s.lastDice});
  }
  for(const p of s.players){const old=before.players.find(q=>q.id===p.id);if(!old)continue;
    if(!p.dead&&(p.region!==old.region||p.pos!==old.pos))addMoment(s,{kind:'move',player:p.id,title:spaceName(p.region,p.pos),detail:`${p.name} arrived from ${spaceName(old.region,old.pos)}.`});
    const changes=[{label:'Life',amount:p.life-old.life},{label:'Combat Bonus',amount:p.bonus-old.bonus},{label:'Cash',amount:p.cash-old.cash}].filter(c=>c.amount!==0);
    if(changes.length&&!p.left)addMoment(s,{kind:'reward',player:p.id,title:`${p.name}'s rewards & costs`,detail:p.character,changes});
  }
  if(s.encounter&&s.encounter!==before.encounter)addMoment(s,{kind:'card',title:cardName(s.encounter),detail:'An encounter is waiting at the table.',card:s.encounter});
}
