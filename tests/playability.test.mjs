import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom,newPlayer,applyAction,publicState,CARDS,card,cardName,options,findSpace,runBots } from '../lib/game.ts';
import { AUTOMATIC_ENCOUNTERS,AUTOMATIC_FIENDS } from '../lib/rules/automation.ts';
function game(count=3){const s=makeRoom('ABC234','s0','Host','Violent J');for(let i=1;i<count;i++)s.players.push(newPlayer('s'+i,'Guest '+i,['Cemetery Girl','Mack Benjamin','Digital Duke'][i-1],i));s.status='playing';s.turn=0;s.turnsTaken=Object.fromEntries(s.players.map(p=>[p.id,1]));for(const p of s.players){p.items=[];p.homies=[];p.region=0;p.pos=1;p.cash=500;p.bonus=3;}return s;}
function take(s,name){for(const deck of [...s.decks,...s.discards,s.purchase,s.boneDeck,s.boneDiscard]){const i=deck.findIndex(id=>cardName(id)===name);if(i>=0)return deck.splice(i,1)[0];}throw Error('Missing '+name);}
function own(s,p,name){const id=take(s,name);p[card(id).kind==='homie'?'homies':card(id).kind==='bone'?'bones':'items'].push(id);return id;}
function act(s,p,a,rolls=[]){const saved=crypto.getRandomValues;crypto.getRandomValues=a=>{a[0]=(rolls.shift()??6)-1;return a;};try{applyAction(s,p.id,a);}finally{crypto.getRandomValues=saved;}}
function respond(s,choice,rolls=[]){assert.ok(s.flow);act(s,s.players.find(p=>p.id===s.flow.prompt.player),{type:'card-response',choice},rolls);}
function encounter(s,name){const p=s.players[0],id=take(s,name);s.board[`${p.region}:${p.pos}`]=[id];s.encounter=id;s.phase='encounter';return id;}
function combat(s,name,die=1){const p=s.players[0],id=encounter(s,name);act(s,p,{type:'resolve'});act(s,p,{type:'combat-choice',weapon:null},[die]);return id;}
const inventory=s=>[...s.decks.flat(),...s.discards.flat(),...s.purchase,...s.boneDeck,...s.boneDiscard,...Object.values(s.board).flat(),...s.players.flatMap(p=>[...p.items,...p.homies,...p.bones])].sort();

test('one action starts a ready practice table; guests cannot start one',()=>{
 const s=makeRoom('ABC234','s0','Host','Violent J');act(s,s.players[0],{type:'start-practice'},[10,2]);assert.equal(s.status,'playing');assert.equal(s.players.length,2);assert.ok(s.players[1].bot);assert.equal(s.phase,'roll');
 const q=makeRoom('BCD234','x','Host','Violent J');q.players.push(newPlayer('y','Guest','Cemetery Girl',1));assert.throws(()=>act(q,q.players[1],{type:'start-practice'}),/Only the host/);
});
test('common rewards resolve once and recovery never exceeds maximum Life',()=>{
 const s=game(),p=s.players[0];p.life=1;const id=encounter(s,'Spiritual Blessings');act(s,p,{type:'resolve'});assert.equal(p.life,2);assert.equal(p.bonus,4);assert.equal(s.phase,'end');assert.equal(s.ruling,null);assert.ok(s.discards[2].includes(id));assert.throws(()=>act(s,p,{type:'resolve'}),/No encounter/);assert.equal(p.bonus,4);
 encounter(s,'Prom Queen');p.life=p.maxLife;act(s,p,{type:'resolve'});assert.equal(p.life,p.maxLife);
});
test('optional event choices survive reload, cannot be answered by another player, and apply only once',()=>{
 let s=game(),p=s.players[0];encounter(s,'Ry Ry');act(s,p,{type:'resolve'});assert.ok(s.flow);assert.equal(p.cash,500);assert.throws(()=>act(s,s.players[1],{type:'card-response',choice:'yes'}),/controlling/);
 s=JSON.parse(JSON.stringify(s));p=s.players[0];respond(s,'yes');assert.equal(p.cash,800);assert.equal(p.skip,1);assert.equal(s.phase,'end');assert.equal(s.ruling,null);assert.throws(()=>respond(s,'yes'));
});
test('discard choices are atomic, require held cards, and retain printed player ownership',()=>{
 const s=game(),p=s.players[0];const axe=own(s,p,'Axe'),herb=own(s,p,'Herb');encounter(s,'Psychopathic Rydas');act(s,p,{type:'resolve'});assert.ok(p.items.includes(axe));assert.ok(p.items.includes(herb));assert.throws(()=>respond(s,'not-a-card'),/displayed/);respond(s,axe);assert.equal(p.items.length,0);assert.equal(s.ruling,null);
 const t=game(),a=t.players[0];const h=own(t,a,'Steve at the Office'),h2=own(t,a,'Spider');encounter(t,'J. D. Tha Weedman');act(t,a,{type:'resolve'});assert.equal(t.flow.prompt.player,t.players[1].id);respond(t,h2);assert.deepEqual(a.homies,[h]);
});
test('Bone draw and Skateboard responses complete inside the saved event without manual ruling',()=>{
 const s=game(),p=s.players[0];own(s,p,'Skateboard');encounter(s,'Dred-a-Bone');act(s,p,{type:'resolve'});assert.ok(s.flow);respond(s,'skate',[10]);assert.equal(p.bones.length,0);assert.equal(s.phase,'end');assert.equal(s.decision,null);assert.equal(s.ruling,null);
});
test('automated travel and regional penalties affect the correct players',()=>{
 const s=game(),[p,q,r]=s.players;p.region=1;q.region=1;r.region=0;const life=[p.life,q.life,r.life];encounter(s,'The Smog');act(s,p,{type:'resolve'});assert.deepEqual(s.players.map(p=>p.life),[life[0]-1,life[1]-1,life[2]]);
 const t=game(),a=t.players[0];encounter(t,'Wizard of Delray');act(t,a,{type:'resolve'},[5]);assert.deepEqual({region:a.region,pos:a.pos},findSpace('Chaos District'));assert.equal(t.ruling,null);
});
test('simple Fiend losses apply cash, Bone, discard and movement penalties automatically',()=>{
 const s=game(),p=s.players[0];combat(s,'Corrupt Cop');assert.equal(p.cash,0);assert.deepEqual({region:p.region,pos:p.pos},findSpace('Police Station'));assert.equal(s.ruling,null);
 const t=game(),q=t.players[0];const gun=own(t,q,'Automatic Rifle');combat(t,'The Tin Man');assert.ok(!q.items.includes(gun));assert.equal(t.ruling,null);
 const u=game(),r=u.players[0];const life=r.life;combat(u,'2-Dog');assert.equal(r.life,life);assert.equal(u.phase,'end');
});
test('Suburban Gangsta auto-win, R.O.C. weapon restriction and Santa rewards are enforced',()=>{
 const s=game(),p=s.players[0];own(s,p,'Steve at the Office');encounter(s,'Suburban Gangsta');act(s,p,{type:'resolve'});assert.equal(s.combat,null);assert.equal(p.bonus,4);
 const t=game(),q=t.players[0],axe=own(t,q,'Axe');encounter(t,'R. O. C.');act(t,q,{type:'resolve'});assert.throws(()=>act(t,q,{type:'combat-choice',weapon:axe}),/does not allow/);
 const u=game(),r=u.players[0];combat(u,'Santa Claws',10);assert.ok(u.flow);const item=u.flow.prompt.choices[0].id;respond(u,item);assert.ok(r.items.includes(item));assert.equal(u.ruling,null);
});
test('every newly automated encounter completes legal default choices and conserves cards',()=>{
 for(const name of AUTOMATIC_ENCOUNTERS){const s=game(),p=s.players[0];p.life=2;const id=encounter(s,name),before=inventory(s);act(s,p,{type:'resolve'},[6]);let count=0;while(s.flow&&count++<40){const opts=s.flow.prompt.choices;const pick=opts.find(c=>['no','pass','done','draw'].includes(c.id))??opts[0];respond(s,pick.id,[6]);}assert.ok(count<40,name);assert.equal(s.ruling,null,name);assert.ok(!s.flow,name);assert.deepEqual(inventory(s),before,name);if(card(id).kind==='event')assert.ok(s.discards[card(id).deck].includes(id),name);}
});
test('every newly automated Fiend resolves a victory without a manual ruling',()=>{
 for(const name of AUTOMATIC_FIENDS){const s=game(),p=s.players[0];p.cash=0;encounter(s,name);act(s,p,{type:'resolve'});if(s.combat)act(s,p,{type:'combat-choice',weapon:null},[10]);let n=0;while(s.flow&&n++<10)respond(s,s.flow.prompt.choices[0].id,[10]);assert.equal(s.ruling,null,name);assert.ok(!s.flow,name);assert.equal(s.combat,null,name);}
});
test('leaving an active turn forfeits the seat, passes host, and starts the next eligible player',()=>{
 const s=game(),p=s.players[0],id=p.id;const weapon=own(s,p,'Axe');s.phase='move';s.choices=[{region:0,pos:3,toll:0}];act(s,p,{type:'leave-game',actor:s.players[1].id});assert.ok(p.left&&p.dead);assert.equal(s.host,s.players[1].id);assert.equal(s.turn,1);assert.equal(s.phase,'roll');assert.equal(p.items.length,0);assert.ok([...s.purchase,...s.discards.flat()].includes(weapon));assert.deepEqual(options(s,id),[]);assert.equal(publicState(s,'s0').control,null);assert.throws(()=>act(s,p,{type:'roll'}),/left this match/);
});
test('leaving another players combat cancels the fight without rewarding anyone',()=>{
 const s=game(),[p,q]=s.players;act(s,p,{type:'roll'},[2]);s.phase='encounter';act(s,p,{type:'attack',target:q.id});const stats=s.players.map(p=>[p.life,p.bonus]);act(s,q,{type:'leave-game'});assert.equal(s.combat,null);assert.equal(s.phase,'end');assert.equal(s.turn,0);assert.deepEqual(s.players.map(p=>[p.life,p.bonus]),stats);assert.ok(options(s,p.id).some(o=>o.action.type==='end'));
});
test('a departure cancels uncommitted reactions; controller and host cannot remain assigned to a departed seat',()=>{
 const s=game(),[p,q]=s.players;own(s,q,'Toy Box');act(s,p,{type:'roll'},[2]);assert.equal(s.flow.prompt.player,q.id);act(s,q,{type:'leave-game'});assert.ok(!s.flow);assert.equal(s.phase,'roll');assert.equal(s.host,p.id);act(s,p,{type:'roll'},[3]);assert.equal(s.roll,3);
});
test('lobby departure frees the character and last human departure closes bot tables',()=>{
 const s=game();s.status='lobby';const p=s.players[0];act(s,p,{type:'leave-game'});assert.equal(s.players.length,2);assert.equal(s.host,s.players[0].id);assert.equal(publicState(s,'s0').me,null);
 const t=game(2),q=t.players[0];t.players[1].bot=true;act(t,q,{type:'leave-game'});assert.equal(t.status,'finished');assert.equal(t.endedBecause,'abandoned');assert.equal(t.winner,null);assert.deepEqual(t.winners,[]);const snapshot=structuredClone(t);runBots(t);assert.deepEqual(t,snapshot);
});
test('forfeiting a two-player match awards the remaining player and clears every pending choice',()=>{
 const s=game(2),p=s.players[0];s.itemPrompt={player:p.id,kind:'movement',returnPhase:'roll',raw:[2,3],values:[2,3]};s.phase='move';act(s,p,{type:'leave-game'});assert.equal(s.status,'finished');assert.equal(s.winner,s.players[1].id);for(const key of ['flow','itemPrompt','combat','penalty','decision','overflow','ruling'])assert.ok(!s[key],key);
});
test('repeated identical dice create distinct visible moments; pending dice remain private',()=>{
 const s=game(),p=s.players[0];act(s,p,{type:'roll'},[3]);const first=s.activitySeq;s.phase='roll';act(s,p,{type:'roll'},[3]);assert.ok(s.activitySeq>first);assert.deepEqual(s.activity.at(-1).dice,[3]);
 const t=game(),[a,b]=t.players;own(t,b,'Toy Box');act(t,a,{type:'roll'},[4]);assert.ok(t.flow);assert.equal(t.activity,undefined);assert.equal(publicState(t,'s1').flow,undefined);
});

test('all automated Fiend loss effects settle without a table ruling or lost cards',()=>{
 for(const name of AUTOMATIC_FIENDS){const s=game(),p=s.players[0];p.cash=0;const before=inventory(s);encounter(s,name);act(s,p,{type:'resolve'});if(s.combat)act(s,p,{type:'combat-choice',weapon:null},[1]);let n=0;while(s.flow&&n++<20)respond(s,s.flow.prompt.choices[0].id,[6]);assert.equal(s.ruling,null,name);assert.ok(!s.flow,name);assert.equal(s.combat,null,name);assert.deepEqual(inventory(s),before,name);}
});
test('a departed controlling neighbor returns control to the original player',()=>{
 const s=game(),[p,q]=s.players;const bone=own(s,p,'Skitsofrantic');p.conditions={[bone]:{controller:q.id,expiresAfterTurn:3}};assert.equal(publicState(s,'s1').control,p.id);act(s,q,{type:'leave-game'});assert.equal(publicState(s,'s0').control,p.id);act(s,p,{type:'roll'},[3]);assert.equal(s.phase,'move');
});


test('board-clearing events remove discarded cards from the pending encounter queue',()=>{
 const s=game(),p=s.players[0];encounter(s,'Mad Mad World');const herb=take(s,'Herb'),axe=take(s,'Axe');s.board[`${p.region}:${p.pos}`].push(herb,axe);s.queue=[herb,axe];const before=inventory(s);act(s,p,{type:'resolve'},[6,6]);assert.equal(s.encounter,null);assert.deepEqual(s.queue,[]);assert.equal(s.phase,'end');assert.deepEqual(inventory(s),before);
});
test('a free identical purchase card is awarded without asking which physical copy to take',()=>{
 const s=game(),p=s.players[0];encounter(s,'Don at Hatchetgear');act(s,p,{type:'resolve'});assert.ok(!s.flow);assert.equal(p.items.filter(id=>cardName(id)==='Herb').length,1);assert.equal(s.phase,'end');
});
