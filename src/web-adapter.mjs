import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { createHandler } from './server.mjs';

const COOKIE = 'vfl_session';
const TTL = 86400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function signature(value, key) { return createHmac('sha256', key).update(value).digest('base64url'); }
export function signSession(session, key, now = Date.now()) {
  const payload = `${session.id}.${session.user_id}.${Math.floor(now / 1000) + TTL}`;
  return `${payload}.${signature(payload, key)}`;
}
export function verifySession(value, key, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 250 || typeof key !== 'string' || key.length < 32) return null;
  const [id, user_id, exp, signed, ...extra] = value.split('.');
  if (extra.length || !UUID.test(id || '') || !UUID.test(user_id || '') || !/^\d{10}$/.test(exp || '') || Number(exp) <= now / 1000 || Number(exp) > now / 1000 + TTL + 60 || !signed) return null;
  const expected = Buffer.from(signature(`${id}.${user_id}.${exp}`, key)); const actual = Buffer.from(signed);
  return expected.length === actual.length && timingSafeEqual(actual, expected) ? { id, user_id } : null;
}
function cookieValue(req) {
  const part = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`));
  return part ? part.slice(COOKIE.length + 1) : '';
}
function cookie(res, value, expired = false) { res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expired ? 0 : TTL}`); }
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function fail(code, status = 400) { const e = new Error(code); e.code = code; e.status = status; throw e; }
async function body(req) {
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? JSON.stringify(req.body) : req.body.toString();
  else {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 65536) fail('body_too_large', 413); chunks.push(chunk); }
    raw = Buffer.concat(chunks).toString();
  }
  if (Buffer.byteLength(raw) > 65536) fail('body_too_large', 413);
  if (!raw.trim()) return {};
  try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('invalid_json'); return parsed; }
  catch { fail('invalid_json'); }
}
function route(req) {
  const url = new URL(req.url, 'https://localhost');
  const viaQuery = req.query?.route || url.searchParams.get('route');
  if (viaQuery) return String(Array.isArray(viaQuery) ? viaQuery.join('/') : viaQuery).replace(/^\/+|\/+$/g, '');
  return url.pathname.replace(/^\/(?:mia\/)?api\//, '').replace(/\/+$/, '');
}
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
function ipHash(req, key) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return createHmac('sha256', key).update(`session-ip:${ip}`).digest('hex');
}
async function sessionInfo(pool, session) {
  let messages = [];
  if (session?.conversation_id) {
    const found = await pool.query('SELECT role,content FROM (SELECT id,role,content,created_at FROM llm.messages WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30) recent ORDER BY created_at ASC,id ASC',[session.conversation_id,session.user_id]);
    messages = found.rows;
  }
  return {ok:true,authenticated:Boolean(session),...(session ? {user:{id:session.user_id,display_name:session.display_name},messages} : {})};
}
async function internalChat(handler, payload) {
  const req = Readable.from([Buffer.from(JSON.stringify(payload))]);
  req.url = '/api/chat'; req.method = 'POST'; req.headers = { 'content-type': 'application/json' };
  let status = 500; let result;
  const res = {
    headersSent: false,
    writeHead(code) { status = code; this.headersSent = true; },
    end(value) { try { result = JSON.parse(value || '{}'); } catch { result = { error: 'internal_error' }; } },
  };
  return { req, res, run: async key => { req.headers.authorization = `Bearer ${key}`; await handler(req,res); return { status, result }; } };
}

export function createWebHandler({ pool, env = process.env, infer, log = console.error }) {
  const backend = createHandler({ pool, env, ...(infer ? { infer } : {}), log });
  return async (req, res) => {
    try {
      if (!env.VFORGELAB_API_KEY || env.VFORGELAB_API_KEY.length < 32) fail('service_unavailable',503);
      const path = route(req);
      if (req.method === 'GET' && path === 'health') return send(res,200,{ok:true,status:'ok'});
      if (!['session','chat','energia','branches'].includes(path)) fail('not_found',404);
      if (['POST','DELETE','PUT','PATCH'].includes(req.method) && !sameOrigin(req)) fail('origin_rejected',403);
      const signed = verifySession(cookieValue(req),env.VFORGELAB_API_KEY);
      let session = null;
      if (signed) {
        const found = await pool.query('SELECT s.id,s.user_id,s.conversation_id,u.display_name FROM app.web_sessions s JOIN app.users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>now()',[signed.id,signed.user_id]);
        session = found.rows[0] || null;
      }
      if (path === 'session' && req.method === 'GET') return send(res,200,await sessionInfo(pool,session));
      if (path === 'session' && req.method === 'DELETE') {
        if (session) await pool.query('UPDATE app.web_sessions SET expires_at=now() WHERE id=$1',[session.id]);
        cookie(res,'',true); return send(res,200,{ok:true,authenticated:false});
      }
      if (path === 'session' && req.method === 'POST') {
        const b = await body(req);
        if (!session) {
          const db = await pool.connect(); const hashed = ipHash(req,env.VFORGELAB_API_KEY);
          try {
            await db.query('BEGIN');
            await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`web-session:${hashed}`]);
            const count = await db.query("SELECT count(*)::int AS count FROM app.web_sessions WHERE ip_hash=$1 AND created_at>now()-interval '1 hour'",[hashed]);
            if (Number(count.rows[0]?.count) >= 10) fail('session_rate_limited',429);
            const user = await db.query("INSERT INTO app.users(display_name) VALUES ('Hackathon guest') RETURNING id,display_name");
            const created = await db.query("INSERT INTO app.web_sessions(user_id,ip_hash,expires_at) VALUES ($1,$2,now()+interval '24 hours') RETURNING id,user_id,conversation_id",[user.rows[0].id,hashed]);
            session = {...created.rows[0],display_name:user.rows[0].display_name};
            await db.query('COMMIT');
          } catch (error) { try { await db.query('ROLLBACK'); } catch {} throw error; }
          finally { db.release(); }
          cookie(res,signSession(session,env.VFORGELAB_API_KEY));
        } else if (b.new_conversation === true) {
          await pool.query('UPDATE app.web_sessions SET conversation_id=NULL WHERE id=$1',[session.id]);
          session.conversation_id = null;
        }
        return send(res,200,await sessionInfo(pool,session));
      }
      if (!session) fail('session_required',401);
      if (path === 'energia' && req.method === 'GET') {
        const latest = await pool.query("SELECT metrics,observed_at FROM app.telemetry_events WHERE source='server-hetzner' ORDER BY observed_at DESC LIMIT 1");
        const reading = latest.rows[0];
        if (!reading) return send(res,200,{ok:true,available:false,observed_at:null,disco:null,ram:null,load:[],procesos:[],message:'Todavía no hay una lectura del servidor.'});
        const m = reading.metrics || {};
        return send(res,200,{ok:true,available:true,source:'server-hetzner',observed_at:reading.observed_at,stale:Date.now()-new Date(reading.observed_at).getTime()>120000,disco:m.disco || null,ram:m.ram || null,load:Array.isArray(m.load)?m.load:[],procesos:Array.isArray(m.procesos)?m.procesos:[],daemon:m.daemon || null});
      }
      if (path === 'branches' && req.method === 'GET') return send(res,200,{ok:true,connected:false,worktrees:[],message:'Escáner sin conectar. No se ha ejecutado ninguna limpieza.'});
      if (path === 'chat' && req.method === 'POST') {
        const b = await body(req);
        if (typeof b.mensaje !== 'string' || !b.mensaje.trim() || b.mensaje.length>16000) fail('invalid_message');
        const gate = await pool.query("UPDATE app.web_sessions SET requests=CASE WHEN last_window<now()-interval '1 hour' THEN 1 ELSE requests+1 END,last_window=CASE WHEN last_window<now()-interval '1 hour' THEN now() ELSE last_window END WHERE id=$1 AND expires_at>now() AND (last_window<now()-interval '1 hour' OR requests<30) RETURNING id",[session.id]);
        if (!gate.rows.length) fail('chat_rate_limited',429);
        const conversationId = b.new_conversation === true ? null : session.conversation_id;
        const call = await internalChat(backend,{user_id:session.user_id,...(conversationId ? {conversation_id:conversationId}:{}),message:b.mensaje});
        const response = await call.run(env.VFORGELAB_API_KEY);
        if (response.status !== 200) return send(res,response.status,{ok:false,error:response.result?.error || 'chat_failed',trace_id:response.result?.trace_id});
        await pool.query('UPDATE app.web_sessions SET conversation_id=$2 WHERE id=$1',[session.id,response.result.conversation_id]);
        return send(res,200,{ok:true,texto:response.result.message.content,conversation_id:response.result.conversation_id,model:response.result.model,provider:response.result.provider,usage:response.result.usage,trace_id:response.result.trace_id,latency_ms:response.result.latency_ms});
      }
      fail('method_not_allowed',405);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status === 500) log(JSON.stringify({error:'web_adapter_failed',trace_id:randomUUID()}));
      if (!res.headersSent) send(res,status,{ok:false,error:status === 500 ? 'internal_error':error.code || 'request_failed'});
      else res.end();
    }
  };
}
