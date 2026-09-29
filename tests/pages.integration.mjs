import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.GAME_TEST_URL||'http://127.0.0.1:4181';
const origin='https://kirkcreason-dev.github.io';
const a=randomBytes(32).toString('hex'),b=randomBytes(32).toString('hex'),spectator=randomBytes(32).toString('hex');
async function call(path,seat,data){
 const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:origin,'X-Game-Session':seat,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 assert.equal(r.headers.get('access-control-allow-origin'),origin);
 assert.equal(r.headers.get('access-control-allow-credentials'),null);
 assert.ok(!r.headers.getSetCookie().some(cookie => cookie.startsWith('qsl_session=')), 'Pages must not require a game session cookie');
 const text=await r.text();let value;try{value=JSON.parse(text)}catch{throw Error(r.status+' '+text.slice(0,300))}return {status:r.status,value};
}
const preflight=await fetch(base+'/api/rooms',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-game-session'}});
assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
const created=await call('/api/rooms',a,{name:'Pages Check Host',character:'Violent J'});assert.equal(created.status,201,JSON.stringify(created));
const path='/api/rooms/'+created.value.code;
const joined=await call(path,b,{name:'Pages Check Guest',character:'Mack Benjamin'});assert.equal(joined.status,200,JSON.stringify(joined));
assert.equal((await call(path,a)).value.me,created.value.me);
assert.equal((await call(path,b)).value.me,joined.value.me);
assert.equal((await call(path+'/chat',spectator)).status,403);
const sent=await call(path+'/chat',a,{id:randomUUID(),text:'GitHub Pages connection check'});assert.equal(sent.status,200,JSON.stringify(sent));
assert.equal((await call(path+'/chat',b)).value.messages.at(-1).text,'GitHub Pages connection check');
const readyB=await call(path+'/action',b,{type:'ready',version:joined.value.rev});assert.equal(readyB.status,200);
const action=await call(path+'/action',a,{type:'start',version:readyB.value.rev});assert.equal(action.status,200,JSON.stringify(action));
assert.equal((await call(path,b)).value.rev,action.value.rev);
const forbidden=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);
console.log(JSON.stringify({room:created.value.code,checks:['CORS preflight','create','second player join','session reconnect','chat delivery','spectator denied','start game and shared revision','untrusted origin denied'],result:'passed'}));
