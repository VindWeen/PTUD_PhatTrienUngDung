import test from 'node:test';
import assert from 'node:assert/strict';
import { PoolProvider } from '../src/integrations/ai/providers/poolProvider.js';

const options = { poolUrl: 'https://synthetic-pool.example', poolToken: 'synthetic-token', poolMode: 'auto' };
const response = (provider = 'groq', extra = {}) => Response.json({
  model: provider === 'groq' ? 'openai/gpt-oss-20b' : 'nvidia/synthetic:free',
  choices: [{ message: { content: 'Synthetic explanation', reasoning: 'DO NOT RETURN' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0 }, ...extra,
}, { headers: { 'X-AI-Provider': provider } });

test('pool request forwards only content parameters and normalizes actual fallback provider', async t => {
  let captured;
  t.mock.method(globalThis, 'fetch', async (url, init) => { captured = { url, ...init }; return response('openrouter'); });
  const provider = new PoolProvider(options.poolUrl, options.poolToken, options.poolMode);
  const result = await provider.complete({ prompt: 'SYNTHETIC', systemPrompt: 'SYSTEM' });
  assert.equal(captured.url, `${options.poolUrl}/v1/chat/completions`);
  assert.equal(captured.headers.Authorization, 'Bearer synthetic-token');
  assert.equal(JSON.parse(captured.body).pool, 'auto');
  assert.equal(JSON.parse(captured.body).model, undefined);
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.isMock, false);
  assert.equal(result.reasoning, undefined);
  assert.deepEqual(result.usage, { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
});
test('pool validates actual model, provider identity, cost and malformed output', async t => {
  const p = new PoolProvider(options.poolUrl, options.poolToken);
  t.mock.method(globalThis, 'fetch', async () => response('openrouter', { model: 'paid-model' }));
  await assert.rejects(p.complete({ prompt: 'SYNTHETIC' }), { code: 'AI_INVALID_FREE_MODEL' });
  globalThis.fetch = async () => response('openrouter', { usage: { cost: 0.01 } });
  await assert.rejects(p.complete({ prompt: 'SYNTHETIC' }), { code: 'AI_PROVIDER_UNAVAILABLE' });
  globalThis.fetch = async () => Response.json({ choices: [] });
  await assert.rejects(p.complete({ prompt: 'SYNTHETIC' }), { code: 'AI_PROVIDER_UNAVAILABLE' });
  globalThis.fetch = async () => response('openrouter');
  await assert.rejects(new PoolProvider(options.poolUrl, options.poolToken, 'groq').complete({ prompt: 'SYNTHETIC' }), { code: 'AI_PROVIDER_UNAVAILABLE' });
});
test('429 and abort preserve typed errors; model overrides rejected before network', async t => {
  const p = new PoolProvider(options.poolUrl, options.poolToken);
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429, headers: { 'Retry-After': '9' } }));
  await assert.rejects(p.complete({ prompt: 'SYNTHETIC' }), e => e.code === 'AI_RATE_LIMIT_EXCEEDED' && e.retryAfterSeconds === 9);
  globalThis.fetch = async () => { throw new DOMException('synthetic abort', 'AbortError'); };
  await assert.rejects(p.complete({ prompt: 'SYNTHETIC' }), { code: 'AI_REQUEST_TIMEOUT' });
  await assert.rejects(p.complete({ prompt: 'SYNTHETIC', model: 'paid-model' }), { code: 'VALIDATION_ERROR' });
});
