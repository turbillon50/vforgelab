import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createWebHandler,signSession,verifySession} from '../src/web-adapter.mjs';

const key='private-server-secret-for-testing-only-123456';
const session={id:'a44d456b-11cb-455b-8cb9-e02438bacf71',user_id:'b44d456b-11cb-455b-8cb9-e02438bacf72',conversation_id:'c44d456b-11cb-455b-8cb9-e02438bacf73',display_name:'Test guest'};
async function serve(t,pool,infer) {
  const server=createServer(createWebHandler({pool,env:{VFORGELAB_API_KEY:key,NEBIUS_API_KEY:'provider-secret'},infer,log:()=>{}}));
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  return `http://127.0.0.1:${server.address().port}`;
}
test('cookie signatures reject changed users, expired values and wrong signing secrets',()=>{
  const now=1800000000000; const signed=signSession(session,key,now);
  assert.deepEqual(verifySession(signed,key,now),{id:session.id,user_id:session.user_id});
  assert.equal(verifySession(signed.replace(session.user_id,session.conversation_id),key,now),null);
  assert.equal(verifySession(signed,key+'wrong',now),null);
  assert.equal(verifySession(signed,key,now+86401000),null);
});
test('public API does not accept operator secrets as browser sessions or expose raw backend routes',async t=>{
  let queries=0;const base=await serve(t,{query:async()=>{queries++;throw new Error('must not query');}});
  assert.equal((await fetch(base+'/mia/api/health')).status,200);
  assert.equal((await fetch(base+'/mia/api/chat',{method:'POST',headers:{'content-type':'application/json','x-sala-token':key},body:'{"mensaje":"hello"}'})).status,401);
  assert.equal((await fetch(base+'/api/users',{headers:{Authorization:`Bearer ${key}`}})).status,404);
  const blocked=await fetch(base+'/mia/api/session',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(blocked.status,403);assert.equal(queries,0);
});
test('chat ownership always comes from signed session; caller supplied IDs are discarded',async t=>{
  const queries=[];
  const query=async(sql,params)=>{
    queries.push({sql,params});
    if(sql.includes('FROM app.web_sessions s'))return{rows:[session]};
    if(sql.includes('UPDATE app.web_sessions')&&sql.includes('RETURNING id'))return{rows:[{id:session.id}]};
    if(sql.includes('FROM app.users')||sql.includes('FROM llm.conversations'))return{rows:[{id:session.user_id}]};
    if(sql.includes('pg_try_advisory_lock'))return{rows:[{acquired:true}]};
    if(sql.includes("VALUES ($1,$2,'assistant'"))return{rows:[{id:session.id,role:'assistant',content:'Real test reply'}]};
    if(sql.includes('RETURNING id'))return{rows:[{id:session.id}]};
    return{rows:[]};
  };
  const base=await serve(t,{query,connect:async()=>({query,release(){}})},async()=>({content:'Real test reply',provider:'nebius',model:'nvidia/test',usage:{total_tokens:10},latency_ms:1}));
  const r=await fetch(base+'/mia/api/chat',{method:'POST',headers:{Cookie:`vfl_session=${signSession(session,key)}`,'Content-Type':'application/json'},body:JSON.stringify({mensaje:'hello',user_id:session.conversation_id,conversation_id:session.id})});
  assert.equal(r.status,200);assert.equal((await r.json()).texto,'Real test reply');
  const insert=queries.find(x=>x.sql.includes("VALUES ($1,$2,'user'"));
  assert.deepEqual(insert.params,[session.conversation_id,session.user_id,'hello']);
});
