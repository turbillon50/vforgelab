import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { authorized, createHandler } from '../src/server.mjs';
import { ProviderError } from '../src/provider.mjs';

const key = 'a'.repeat(40);
test('authorization requires exact bearer secret and a configured strong key', () => {
  assert.equal(authorized(`Bearer ${key}`, key), true);
  for (const input of [undefined, key, `Bearer ${key}x`, 'Bearer wrong']) assert.equal(authorized(input, key), false);
  assert.equal(authorized('Bearer short', 'short'), false);
});
test('health is public but API and malformed bodies cannot touch database', async t => {
  let calls = 0;
  const server = createServer(createHandler({ pool: { query: async () => { calls++; throw new Error('db password'); } }, env: { VFORGELAB_API_KEY: key }, log: () => {} }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/api/status`)).status, 401);
  const malformed = await fetch(`${base}/api/users`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400); assert.equal(calls, 0);
  const failed = await fetch(`${base}/api/status`, { headers: { Authorization: `Bearer ${key}` } });
  assert.equal(failed.status, 500); assert.equal((await failed.text()).includes('password'), false);
});

test('conversation ownership is checked before inference or message writes', async t => {
  const userId = '46d923cb-b990-4b74-b56d-32870a772a4c';
  const conversationId = '7d8402b5-4f41-4c2c-9118-d28d7a292030';
  let called = false; let released = false; const queries = [];
  const db = { query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows: sql.includes('FROM app.users') ? [{ id: userId }] : [] };
  }, release: () => { released = true; } };
  const server = createServer(createHandler({ pool: { connect: async () => db }, env: { VFORGELAB_API_KEY: key }, infer: async () => { called = true; } }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, conversation_id: conversationId, message: 'hello' }) });
  assert.equal(r.status, 404); assert.equal(called, false); assert.equal(released, true);
  assert.deepEqual(queries.find(x => x.sql.includes('FROM llm.conversations')).params, [conversationId, userId]);
  assert.equal(queries.some(x => x.sql.includes('INSERT INTO llm.messages')), false);
});

test('provider failure records a failed run and never invents an assistant message', async t => {
  const userId = '46d923cb-b990-4b74-b56d-32870a772a4c';
  const conversationId = '7d8402b5-4f41-4c2c-9118-d28d7a292030';
  const queries = [];
  const db = { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FROM app.users') || sql.includes('FROM llm.conversations')) return { rows: [{ id: userId }] };
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
    if (sql.includes('RETURNING id')) return { rows: [{ id: '46d923cb-b990-4b74-b56d-32870a772a4d' }] };
    return { rows: [] };
  }, release: () => {} };
  const server = createServer(createHandler({ pool: { connect: async () => db }, env: { VFORGELAB_API_KEY: key, NEBIUS_API_KEY: 'test-key' }, infer: async () => { throw new ProviderError('provider_rejected'); } }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, conversation_id: conversationId, message: 'hello' }) });
  assert.equal(r.status, 502);
  assert.equal(queries.some(x => x.sql.includes("VALUES ($1,$2,'user'")), true);
  assert.equal(queries.some(x => x.sql.includes("VALUES ($1,$2,'assistant'")), false);
  assert.equal(queries.find(x => x.sql.includes("SET status='failed'")).params[1], 'provider_rejected');
});
