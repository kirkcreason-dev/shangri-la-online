import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesOrigin, remoteSession, withGameCors } from '../lib/online/cors.ts';
const api='https://game.example/api/rooms';
test('Pages preflight allows only the game methods and session header',async()=>{
 const req=new Request(api,{method:'OPTIONS',headers:{origin:pagesOrigin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-game-session'}});
 const response=await withGameCors(req,()=>{throw Error('Preflight must not reach game logic');});
 assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),pagesOrigin);
 assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
 for (const headers of [{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization'}]){
  const denied=await withGameCors(new Request(api,{method:'OPTIONS',headers:{origin:pagesOrigin,...headers}}),async()=>new Response('bad'));
  assert.equal(denied.status,403);
 }
});
test('unknown origins cannot invoke the game API',async()=>{
 const response=await withGameCors(new Request(api,{method:'POST',headers:{origin:'https://not-the-game.example'}}),()=>{throw Error('Must not run');});
 assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('Pages reads include CORS on API errors and same-origin requests preserve cookies',async()=>{
 const result=await withGameCors(new Request(api,{headers:{origin:pagesOrigin}}),async()=>Response.json({error:'Not joined'},{status:403,headers:{Vary:'Accept'}}));
 assert.equal(result.status,403);assert.equal(result.headers.get('Access-Control-Allow-Origin'),pagesOrigin);assert.match(result.headers.get('Vary'),/Accept/);
 const original=new Response('ok',{headers:{'Set-Cookie':'qsl_session=example; HttpOnly'}});
 assert.equal(await withGameCors(new Request(api,{headers:{origin:'https://game.example'}}),async()=>original),original);
});
test('Pages must supply a valid seat token; existing same-origin cookie flow stays available',()=>{
 assert.equal(remoteSession(new Headers()),null);
 assert.throws(()=>remoteSession(new Headers({origin:pagesOrigin})),e=>e.status===401);
 assert.throws(()=>remoteSession(new Headers({'X-Game-Session':'bad'})),e=>e.status===401);
 const token='ab'.repeat(32);assert.equal(remoteSession(new Headers({'X-Game-Session':token,origin:pagesOrigin})),token);
});
