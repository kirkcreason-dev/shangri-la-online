import test from 'node:test';
import assert from 'node:assert/strict';
import board from '../lib/board.json' with {type:'json'};
import { BOARD_SPACES, boardPosition, spaceInfo, searchSpaces, labelLines, destinationContext, confirmedDestination, destinationCost } from '../lib/board-display.ts';
import { character, CHARACTER_REPLACEMENTS, CHARACTERS, ROSTER } from '../lib/rules/catalog.ts';

test('rebuilt board preserves every mapped tile, position and rule',()=>{
 assert.equal(BOARD_SPACES.length,60);
 assert.equal(new Set(BOARD_SPACES.map(s=>`${s.column}:${s.row}`)).size,60);
 for(const s of BOARD_SPACES){
  assert.equal(s.name,board.regions[s.region][s.pos]);
  assert.deepEqual(boardPosition(s.region,s.pos),{x:s.column*100+50,y:s.row*100+50});
  assert.ok(spaceInfo(s).rules);
 }
 assert.deepEqual(boardPosition(3,0),{x:400,y:400});
});
test('search handles repeated names and narrows by region without conflating spaces',()=>{
 assert.equal(searchSpaces(' ALLEYWAY ').length,7);
 assert.equal(searchSpaces('alleyway Detroit').length,6);
 assert.equal(searchSpaces('  ').length,0);
 assert.equal(searchSpaces('not a location').length,0);
 assert.equal(searchSpaces('wizard')[0].name,"The Wizard's Palace");
 assert.deepEqual(labelLines('Psychopathic Records'),['Psychopathic','Records']);
 assert.ok(BOARD_SPACES.every(s=>labelLines(s.name).length<=3));
});
test('a preview cannot commit an old turn or a changed destination toll',()=>{
 const choices=[{region:1,pos:8,toll:100},{region:2,pos:6,toll:0,itemToll:true}];
 const context=destinationContext('round1:move:7',choices);
 const selection={at:{region:1,pos:8},context};
 assert.deepEqual(confirmedDestination(selection,context,choices),choices[0]);
 assert.equal(confirmedDestination(selection,destinationContext('round2:move:7',choices),choices),undefined);
 const changed=[{...choices[0],toll:0},choices[1]];
 assert.equal(confirmedDestination(selection,destinationContext('round1:move:7',changed),changed),undefined);
 assert.equal(confirmedDestination(null,context,choices),undefined);
 assert.equal(confirmedDestination({at:{region:0,pos:0},context},context,choices),undefined);
 assert.equal(destinationCost(choices[0]),'$100 toll');
 assert.equal(destinationCost(choices[1]),'Discard 1 Item at the Portal');
});
test('three replacement characters each inherit a complete retired set with unique identities',()=>{
 assert.equal(CHARACTERS.length,18);
 assert.equal(new Set(ROSTER.map(c=>c.id)).size,18);
 for(const [oldName,newName] of Object.entries(CHARACTER_REPLACEMENTS)){
  assert.ok(!CHARACTERS.includes(oldName));assert.ok(CHARACTERS.includes(newName));
  const old=character(oldName),next=character(newName);
  for(const key of ['startingLife','maxLife','baseCombatBonus','startingCash','startingItems','allegiance','startingSpace','powers']) assert.deepEqual(next[key],old[key],`${newName}: ${key}`);
  assert.notEqual(next.id,old.id);
 }
});
