import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom, joinRoom, cardName, CHARACTERS} from '../lib/game.ts';
function started() { const s=makeRoom('JOIN01','host','Host','Cemetery Girl'); s.status='playing'; return s; }
test('late joining allocates real stock and preserves the ongoing turn',()=>{
 const s=started(); const pending={kind:'test'}; s.pending=pending; s.turn=0;s.round=4;
 const stock=[...s.purchase]; const p=joinRoom(s,'friend','Friend','Violent J');
 assert.equal(p.ready,true); assert.equal(s.turn,0);assert.equal(s.round,4);assert.equal(s.pending,pending);
 assert.ok(p.items.length>0);for(const id of p.items){assert.ok(stock.includes(id));assert.ok(!s.purchase.includes(id));assert.ok(!id.includes('@setup'));}
 assert.equal(joinRoom(s,'friend','Again','Violent J'),p);assert.equal(s.players.length,2);
});
test('unavailable equipment leaves the room untouched',()=>{
 const s=started();s.purchase=s.purchase.filter(id=>cardName(id)!=='Axe');const before=JSON.stringify(s);
 assert.throws(()=>joinRoom(s,'friend','Friend','Violent J'),/equipment/);assert.equal(JSON.stringify(s),before);
});
test('finished and full tables explain why joining is unavailable',()=>{
 const s=started();s.status='finished';assert.throws(()=>joinRoom(s,'friend','Friend','Violent J'),/ended/);
 s.status='playing';s.players=Array.from({length:6},()=>s.players[0]);assert.throws(()=>joinRoom(s,'friend','Friend','Violent J'),/full/);
});
test('lobby joining excludes retired characters and legacy rules',()=>{
 const s=makeRoom('JOIN02','host','Host','Cemetery Girl');s.usedCharacters=['Violent J'];
 const p=joinRoom(s,'friend','Friend','Violent J');assert.notEqual(p.character,'Violent J');assert.ok(CHARACTERS.includes(p.character));
 s.rulesVersion=2;assert.throws(()=>joinRoom(s,'third','Third','Violent J'),/corrected rules/);
});
