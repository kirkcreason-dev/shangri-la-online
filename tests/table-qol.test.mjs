import test from 'node:test';
import assert from 'node:assert/strict';
import {roomCodeFromInput,parseRecentTables,rememberTable} from '../lib/table-preferences.ts';
import {tableGuidance} from '../lib/table-guide.ts';
import {gameFetch} from '../lib/client-connection.ts';
test('joining accepts codes and copied invite links without following external URLs',()=>{
 assert.equal(roomCodeFromInput(' abc-234 '),'ABC234');
 assert.equal(roomCodeFromInput('https://kirkcreason-dev.github.io/shangri-la-online/?room=abc234#table'),'ABC234');
 assert.equal(roomCodeFromInput('https://example.com/?room=ABC234'),'ABC234');
 for(const invalid of ['ABC123','javascript:alert(1)','https://example.com/','https://?room=ABC234','https://example.com/?room=ABC234XYZ'])assert.equal(roomCodeFromInput(invalid),null);
});
test('recent tables migrate old codes, deduplicate, and tolerate damaged storage',()=>{
 assert.deepEqual(parseRecentTables('["ABC234","abc234",null,5,{"code":"XYZ789","round":3,"players":2,"status":"playing"}]'),[{code:'ABC234'},{code:'XYZ789',status:'playing',round:3,players:2}]);
 assert.deepEqual(parseRecentTables('{broken'),[]);
 assert.deepEqual(parseRecentTables('{"code":"ABC234"}'),[]);
 const latest=rememberTable([{code:'XYZ789'},{code:'ABC234'}],{code:'ABC234',round:4});
 assert.deepEqual(latest,[{code:'ABC234',round:4},{code:'XYZ789'}]);
});
const room=()=>({status:'playing',phase:'roll',turn:0,me:'a',control:'a',players:[{id:'a',name:'Alice',controller:'a'},{id:'b',name:'Bob',controller:'b'}],options:[{label:'Roll movement',action:{type:'roll',actor:'a'}}]});
test('the next-step panel only offers a server-listed action to its controlling player',()=>{
 assert.equal(tableGuidance(room()).quick.action.type,'roll');
 const s=room();s.me='b';s.control='b';assert.equal(tableGuidance(s).quick,undefined);assert.equal(tableGuidance(s).attention,false);
 s.control='a';assert.equal(tableGuidance(s).quick.action.actor,'a');
 s.options=[];assert.equal(tableGuidance(s).quick,undefined);
});
test('pending responses override normal turn guidance and shortcuts',()=>{
 const s=room();s.pendingCard={player:'b'};
 const waiting=tableGuidance(s);assert.match(waiting.title,/Bob/);assert.equal(waiting.quick,undefined);assert.equal(waiting.attention,false);
 s.players[1].controller='a';assert.equal(tableGuidance(s).attention,true);
 delete s.pendingCard;s.ruling={actor:'a'};assert.equal(tableGuidance(s).quick,undefined);
 s.combat={attacker:'a',defender:'b',choices:{}};assert.match(tableGuidance(s).title,/equipment/);
 s.combat.choices.a={};assert.equal(tableGuidance(s).attention,false);
});
test('game requests forward cancellation without retrying a write',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_,options)=>{calls++;return new Promise((_,reject)=>{if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});};
 try{const abort=new AbortController();const result=gameFetch('/api/rooms',{method:'POST',signal:abort.signal});abort.abort();await assert.rejects(result);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

test('out-of-turn winners and inventory owners receive the right guidance',()=>{
 const s=room();s.me='b';s.control='b';s.phase='penalty';s.penalty={winner:'b'};
 assert.equal(tableGuidance(s).attention,true);assert.match(tableGuidance(s).title,/combat reward/);assert.equal(tableGuidance(s).quick,undefined);
 delete s.penalty;s.phase='overflow';s.overflow={player:'a'};
 assert.equal(tableGuidance(s).attention,false);assert.match(tableGuidance(s).title,/Alice/);
});

test('movement shortcuts point to destinations, but pending responses still point to choices',()=>{
 const s=room();s.phase='move';s.options=[];
 assert.equal(tableGuidance(s).target,'available-destinations');
 s.itemPrompt={player:'a'};
 assert.equal(tableGuidance(s).target,'table-controls');assert.equal(tableGuidance(s).attention,true);
 delete s.itemPrompt;s.pendingCard={player:'b'};
 assert.equal(tableGuidance(s).target,'table-controls');assert.equal(tableGuidance(s).attention,false);
});
test('finished and departed seats cannot receive a playable shortcut',()=>{
 const s=room();s.status='finished';assert.equal(tableGuidance(s).quick,undefined);
 s.status='playing';s.players[0].left=true;assert.equal(tableGuidance(s).attention,false);assert.equal(tableGuidance(s).quick,undefined);
});
