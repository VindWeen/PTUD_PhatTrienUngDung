const PROVIDERS = {
  groq: { secret: 'GROQ_KEYS', model: 'GROQ_MODEL', url: 'https://api.groq.com/openai/v1/chat/completions' },
  openrouter: { secret: 'OPENROUTER_KEYS', model: 'OPENROUTER_MODEL', url: 'https://openrouter.ai/api/v1/chat/completions' },
};
const json = (value, status = 200, headers = {}) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', ...headers },
});

export async function credentials(env, provider) {
  const raw = JSON.parse(env[PROVIDERS[provider].secret] || '[]');
  if (!Array.isArray(raw) || raw.length > 20 || raw.some(k => typeof k !== 'string' || !k.trim())) {
    throw new Error('Invalid pool configuration');
  }
  return Promise.all([...new Set(raw.map(k => k.trim()))].map(async key => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const id = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
    return { key, id };
  }));
}

export function retryDelay(value, now = Date.now()) {
  if (!value) return 60_000;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(1000, Math.min(delay, 86_400_000)) : 60_000;
}

export class KeyPool {
  constructor(ctx, env) { this.storage = ctx.storage; this.env = env; }

  async select(keys, excluded) {
    return this.storage.transaction(async tx => {
      const saved = await tx.get('pool') || { cursor: 0, states: {} };
      // Only retain hashes of credentials that still exist. Raw keys are never stored here.
      saved.states = Object.fromEntries(keys.filter(k => saved.states[k.id]).map(k => [k.id, saved.states[k.id]]));
      const now = Date.now();
      for (let offset = 0; offset < keys.length; offset++) {
        const index = (saved.cursor + offset) % keys.length;
        const entry = keys[index];
        const state = saved.states[entry.id];
        if (excluded.includes(entry.id) || state?.disabled || state?.until > now) continue;
        saved.cursor = (index + 1) % keys.length;
        await tx.put('pool', saved);
        return entry;
      }
      await tx.put('pool', saved);
      return null;
    });
  }

  async mark(id, state) {
    await this.storage.transaction(async tx => {
      const saved = await tx.get('pool') || { cursor: 0, states: {} };
      saved.states[id] = state;
      await tx.put('pool', saved);
    });
  }

  async fetch(request) {
    const { provider, payload, deadline, maxAttempts } = await request.json();
    const keys = await credentials(this.env, provider);
    const excluded = [];
    let attempts = 0;
    for (; attempts < maxAttempts && Date.now() < deadline; ) {
      const entry = await this.select(keys, excluded);
      if (!entry) break;
      excluded.push(entry.id);
      attempts++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(8000, Math.max(1, deadline - Date.now())));
      try {
        const upstream = await fetch(PROVIDERS[provider].url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${entry.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, model: this.env[PROVIDERS[provider].model], stream: false }),
          signal: controller.signal,
        });
        if (upstream.ok) {
          const result = await upstream.json();
          if (result.error || !Array.isArray(result.choices) || !result.choices.length) {
            await this.mark(entry.id, { until: Date.now() + 15_000 });
            continue;
          }
          return json(result, 200, { 'X-AI-Provider': provider, 'X-Pool-Attempts': String(attempts) });
        }
        // Do not expose upstream error bodies; they may contain credentials or prompt data.
        await upstream.body?.cancel();
        if (upstream.status === 404) {
          // Missing model/endpoint is a provider configuration issue, not a bad key.
          return json({ error: { code: 'PROVIDER_MODEL_UNAVAILABLE', provider,
            model: this.env[PROVIDERS[provider].model], upstream_status: 404 } }, 503,
            { 'X-Pool-Attempts': String(attempts) });
        }
        if (upstream.status === 401 || upstream.status === 403) {
          await this.mark(entry.id, { disabled: true });
        } else if (upstream.status === 429) {
          await this.mark(entry.id, { until: Date.now() + retryDelay(upstream.headers.get('Retry-After')) });
        } else if ([408, 500, 502, 503, 504].includes(upstream.status)) {
          await this.mark(entry.id, { until: Date.now() + 15_000 });
        } else {
          return json({ error: { code: 'UPSTREAM_REJECTED', provider, upstream_status: upstream.status } }, 400,
            { 'X-Pool-Attempts': String(attempts) });
        }
      } catch {
        await this.mark(entry.id, { until: Date.now() + 15_000 });
      } finally { clearTimeout(timer); }
    }
    return json({ error: { code: 'POOL_UNAVAILABLE', provider, attempts } }, 503,
      { 'X-Pool-Attempts': String(attempts) });
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return json({ ok: true, service: 'lhu-ai-pool' });
    if (!env.POOL_ACCESS_TOKEN) return json({ error: { code: 'ACCESS_TOKEN_NOT_CONFIGURED' } }, 503);
    if (request.headers.get('Authorization') !== `Bearer ${env.POOL_ACCESS_TOKEN}`) {
      return json({ error: { code: 'UNAUTHORIZED' } }, 401);
    }
    try {
      if (path === '/status' && request.method === 'GET') {
        const groq = await credentials(env, 'groq');
        const openrouter = await credentials(env, 'openrouter');
        return json({ configured_keys: { groq: groq.length, openrouter: openrouter.length },
          models: { groq: env.GROQ_MODEL, openrouter: env.OPENROUTER_MODEL } });
      }
      if (path !== '/v1/chat/completions' || request.method !== 'POST') {
        return json({ error: { code: 'NOT_FOUND' } }, 404);
      }
      const reader = request.body?.getReader();
      if (!reader) return json({ error: { code: 'INVALID_JSON' } }, 400);
      const chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 65_536) {
          await reader.cancel();
          return json({ error: { code: 'REQUEST_TOO_LARGE' } }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let input;
      try { input = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return json({ error: { code: 'INVALID_JSON' } }, 400); }
      const pool = input?.pool || 'auto';
      if (!['groq', 'openrouter', 'auto'].includes(pool) || !Array.isArray(input?.messages) || !input.messages.length ||
          input.stream === true || (input.max_tokens !== undefined && (!Number.isInteger(input.max_tokens) || input.max_tokens < 1 || input.max_tokens > 2048)) ||
          (input.temperature !== undefined && (typeof input.temperature !== 'number' || input.temperature < 0 || input.temperature > 2))) {
        return json({ error: { code: 'INVALID_REQUEST', message: 'Use pool groq/openrouter/auto, nonempty messages, stream false, max_tokens 1..2048, temperature 0..2.' } }, 400);
      }
      // Models are server-controlled so auto fallback always uses the matching provider's model.
      if (!env.GROQ_MODEL || !(env.OPENROUTER_MODEL === 'openrouter/free' || env.OPENROUTER_MODEL?.endsWith(':free'))) {
        return json({ error: { code: 'INVALID_MODEL_CONFIGURATION' } }, 503);
      }
      const providers = pool === 'auto' ? ['groq', 'openrouter'] : [pool];
      const deadline = Date.now() + 25_000;
      const payload = { messages: input.messages, max_tokens: input.max_tokens ?? 1024, temperature: input.temperature ?? 0.2 };
      for (const provider of providers) {
        if (Date.now() >= deadline) break;
        const stub = env.POOLS.get(env.POOLS.idFromName(provider));
        const response = await stub.fetch('https://pool.internal/complete', {
          method: 'POST', body: JSON.stringify({ provider, payload,
            deadline: pool === 'auto' && provider === 'groq' ? Math.min(deadline, Date.now() + 12_000) : deadline,
            maxAttempts: 10 }),
        });
        if (response.status !== 503 || providers.length === 1) return response;
        await response.body?.cancel();
      }
      return json({ error: { code: 'ALL_POOLS_UNAVAILABLE', message: 'No usable key, retry budget exhausted, or providers unavailable.' } }, 503);
    } catch {
      return json({ error: { code: 'POOL_CONFIGURATION_OR_SERVICE_ERROR' } }, 503);
    }
  },
};
