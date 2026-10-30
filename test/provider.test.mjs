import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, providerConfig } from '../src/provider.mjs';

const env = { NEBIUS_API_KEY: 'private-test-key', NEBIUS_MODEL: 'nvidia/nemotron-3-super-120b-a12b' };
test('provider refuses arbitrary hosts before exposing credentials', async () => {
  let called = false;
  await assert.rejects(generate([], { env: { ...env, NEBIUS_BASE_URL: 'https://attacker.example/v1' }, fetchImpl: async () => { called = true; } }), { code: 'invalid_provider_url' });
  assert.equal(called, false);
  assert.throws(() => providerConfig({ ...env, NEBIUS_MODEL: 'other/model' }), { code: 'nvidia_model_required' });
});
test('upstream error body never reaches application errors', async () => {
  await assert.rejects(generate([], { env, fetchImpl: async () => new Response('secret upstream content', { status: 401 }) }), error => error.code === 'provider_rejected' && !error.message.includes('secret'));
});
test('real response metadata passes through; empty reasoning-only answer fails', async () => {
  let request;
  const result = await generate([{ role: 'user', content: 'hello' }], { env, fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return Response.json({ model: env.NEBIUS_MODEL, choices: [{ message: { content: 'hello back' } }], usage: { total_tokens: 12 } });
  } });
  assert.equal(result.content, 'hello back'); assert.equal(result.provider, 'nebius'); assert.equal(result.usage.total_tokens, 12); assert.ok(request.max_tokens >= 2048);
  await assert.rejects(generate([], { env, fetchImpl: async () => Response.json({ choices: [{ message: { content: null, reasoning_content: 'thinking' } }] }) }), { code: 'provider_empty_response' });
});
test('timeout maps to a stable error code', async () => {
  await assert.rejects(generate([], { env, fetchImpl: async () => { throw new DOMException('private details', 'TimeoutError'); } }), { code: 'provider_timeout' });
});
