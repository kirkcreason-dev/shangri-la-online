import test from 'node:test';
import assert from 'node:assert/strict';
import { parseComfort, attentionCue } from '../lib/table-comfort.ts';
import { filterCards } from '../lib/card-browser.ts';
import { CARDS } from '../lib/rules/catalog.ts';

test('comfort settings tolerate damaged storage and do not enable sound from truthy strings',()=>{
 for(const input of [null,'{broken','null','[]','{"sounds":"false","reduceMotion":1}'])assert.deepEqual(parseComfort(input),{sounds:false,reduceMotion:false,largeText:false});
 assert.deepEqual(parseComfort('{"sounds":true,"largeText":true,"unexpected":true}'),{sounds:true,reduceMotion:false,largeText:true});
});
test('turn chimes only fire when the same table newly requires attention',()=>{
 assert.equal(attentionCue({code:'ABC234',attention:false},{code:'ABC234',attention:true}),true);
 for(const [before,after] of [[{attention:false},{code:'ABC234',attention:true}],[{code:'ABC234',attention:true},{code:'ABC234',attention:true}],[{code:'ABC234',attention:false},{code:'XYZ789',attention:true}],[{code:'ABC234',attention:true},{code:'ABC234',attention:false}]])assert.equal(attentionCue(before,after),false);
});
test('the card browser combines deck, type and search filters without revealing hidden endings',()=>{
 const cards=[...CARDS,{key:'secret',name:'Hidden secret',rules:'mystery',kind:'item',deck:'ending',weapon:true}];
 assert.equal(filterCards(cards,'secret').length,0);
 assert.ok(filterCards(cards,'','weapon').length>0);
 assert.ok(filterCards(cards,'','weapon').every(c=>c.weapon&&c.deck!=='ending'));
 assert.ok(filterCards(cards,'','all','purchase').every(c=>c.deck==='purchase'));
 const healing=filterCards(cards,'  LIFE   ','all','0');
 assert.ok(healing.length>0);assert.ok(healing.every(c=>c.deck===0&&`${c.name} ${c.rules} ${c.kind}`.toLowerCase().includes('life')));
 assert.equal(filterCards(cards,'definitely-absent').length,0);
});
