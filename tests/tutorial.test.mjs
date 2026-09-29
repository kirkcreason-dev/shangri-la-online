import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTutorial, tutorialStep, tutorialPhase } from '../lib/tutorial.ts';
import { makeRoom, newPlayer, applyAction, publicState, runBots, tick, CARDS } from '../lib/game.ts';

test('practice turn requires preview and confirmation and only rewards combat once',()=>{
 let s=initialTutorial();const original=structuredClone(s);
 assert.deepEqual(tutorialStep(s,{type:'move'}),s);
 for(const type of ['start','roll'])s=tutorialStep(s,{type});
 assert.equal(s.pos,0);assert.equal(s.stage,'move');
 assert.equal(tutorialStep(s,{type:'move'}).pos,0);
 s=tutorialStep(s,{type:'preview'});assert.equal(s.pos,0);
 for(const type of ['move','draw','prepare','fight','fight'])s=tutorialStep(s,{type});
 assert.equal(s.pos,3);assert.equal(s.bonus,3);assert.equal(s.stage,'result');
 s=tutorialStep(s,{type:'end'});assert.equal(s.stage,'done');
 assert.deepEqual(tutorialStep(s,{type:'restart'}),original);
 assert.deepEqual(initialTutorial(),original);
});
test('tutorial examples match the actual card values and all phases',()=>{
 const fiend=CARDS.find(c=>c.name==='Drainer Road Monk'),axe=CARDS.find(c=>c.name==='Axe');
 assert.equal(fiend.strength,6);assert.equal(fiend.reward,1);assert.equal(axe.combat,2);
 assert.deepEqual(['roll','move','encounter','card','combat','result','done'].map(tutorialPhase),[0,1,2,2,2,3,3]);
 let s=initialTutorial();for(const type of ['start','roll','preview','move','draw','prepare'])s=tutorialStep(s,{type});
 s=tutorialStep(s,{type:'weapon',weapon:'none'});assert.equal(s.weapon,'none');
 assert.equal(tutorialStep(s,{type:'fight'}).bonus,3);
});
function room(){const s=makeRoom('ABC234','host-session','Host','Digital Duke');s.players.push(newPlayer('guest-session','Guest','3 ZEE',1));return s;}
test('only authenticated host can end a match, not a forged actor or guest',()=>{
 const s=room(),snapshot=structuredClone(s);
 for(const actor of [s.players[1].id,'missing'])assert.throws(()=>applyAction(s,actor,{type:'end-game',actor:s.host}),/Only the host/);
 assert.deepEqual(s,snapshot);
 applyAction(s,s.host,{type:'end-game'});
 assert.equal(s.status,'finished');assert.equal(s.endedByHost,s.host);assert.equal(s.winner,null);assert.deepEqual(s.winners,[]);
 assert.deepEqual(s.players,snapshot.players);assert.deepEqual(s.board,snapshot.board);
 assert.match(s.log[0],/ended the game for everyone/);
 assert.equal(publicState(s,'guest-session').endedByHost,s.host);
 assert.throws(()=>applyAction(s,s.host,{type:'start'}),/finished/);
 assert.throws(()=>applyAction(s,s.host,{type:'end-game'}),/already ended/);
});
test('ending during pending choices clears every blocker and freezes final state',()=>{
 const s=room();s.status='playing';s.turn=1;s.phase='combat';
 s.flow={prompt:{player:s.players[1].id,choices:[{id:'yes'}]},answers:[]};
 s.itemPrompt={kind:'movement',player:s.players[1].id};s.pendingVictory=[s.players[1].id];
 s.combat={attacker:s.players[1].id};s.trade={from:s.players[1].id};s.penalty={winner:s.players[1].id};s.overflow={player:s.players[1].id};s.ruling={actor:s.players[1].id};s.decision={actor:s.players[1].id};s.recoil=[{player:s.players[1].id,mortal:true}];s.choices=[{region:0,pos:3}];s.endingPending=s.players[1].id;
 s.players[0].absentUntil=1;s.players[0].dead=true;
 applyAction(s,s.host,{type:'end-game',actor:s.players[1].id});
 assert.equal(s.status,'finished');assert.equal(s.phase,'end');
 for(const key of ['flow','itemPrompt','pendingVictory','combat','trade','penalty','overflow','ruling','decision','recoil','endingPending'])assert.ok(!s[key],key);
 assert.deepEqual(s.choices,[]);const snapshot=structuredClone(s);
 assert.equal(tick(s),false);runBots(s);assert.deepEqual(s,snapshot);
 assert.throws(()=>applyAction(s,s.players[1].id,{type:'card-response',choice:'yes'}),/finished/);
 assert.deepEqual(s,snapshot);
});
