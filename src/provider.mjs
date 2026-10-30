const NEBIUS_HOSTS = new Set(['api.studio.nebius.com', 'api.tokenfactory.nebius.com']);

export class ProviderError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
  }
}

export function providerConfig(env = process.env) {
  let base;
  try { base = new URL(env.NEBIUS_BASE_URL || 'https://api.studio.nebius.com/v1'); }
  catch { throw new ProviderError('invalid_provider_url', 503); }
  if (base.protocol !== 'https:' || !NEBIUS_HOSTS.has(base.hostname) || base.username || base.password || base.search || base.hash || (base.port && base.port !== '443') || !/^\/v1\/?$/.test(base.pathname)) {
    throw new ProviderError('invalid_provider_url', 503);
  }
  const model = env.NEBIUS_MODEL || 'nvidia/nemotron-3-super-120b-a12b';
  if (!/^nvidia\/[a-zA-Z0-9._/-]+$/.test(model)) throw new ProviderError('nvidia_model_required', 503);
  if (!env.NEBIUS_API_KEY) throw new ProviderError('provider_not_configured', 503);
  return {
    apiKey: env.NEBIUS_API_KEY,
    baseUrl: base.href.replace(/\/$/, ''),
    model,
    timeoutMs: Math.min(120000, Math.max(1000, Number(env.NEBIUS_TIMEOUT_MS) || 120000)),
    maxTokens: Math.min(8192, Math.max(2048, Number(env.NEBIUS_MAX_TOKENS) || 4096)),
  };
}

export async function generate(messages, { env = process.env, fetchImpl = fetch } = {}) {
  const config = providerConfig(env);
  const started = Date.now();
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, temperature: 0.35, max_tokens: config.maxTokens }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new ProviderError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'provider_timeout' : 'provider_unreachable', 502);
  }
  if (!response.ok) throw new ProviderError(response.status === 429 ? 'provider_rate_limited' : 'provider_rejected', response.status === 429 ? 429 : 502);
  let data;
  try { data = await response.json(); } catch { throw new ProviderError('provider_invalid_response'); }
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new ProviderError('provider_empty_response');
  if (data.model && !String(data.model).startsWith('nvidia/')) throw new ProviderError('unexpected_provider_model');
  return {
    content: text.trim(), provider: 'nebius', model: data.model || config.model,
    usage: data.usage && typeof data.usage === 'object' ? data.usage : {},
    latency_ms: Date.now() - started,
    provider_request_id: response.headers.get('x-request-id') || data.id || null,
  };
}
