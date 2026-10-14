import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { KeyPool, retryDelay } from '../src/worker.js';

function storage() {
  const values = new Map();
  const tx = { get: async key => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)) };
  let queue = Promise.resolve();
  return { ...tx, transaction(fn) { const next = queue.then(() => fn(tx)); queue = next.catch(() => {}); return next; } };
}
function setup() {
  const env = { POOL_ACCESS_TOKEN: 'test-only', GROQ_KEYS: '["synthetic-a","synthetic-b"]',
    OPENROUTER_KEYS: '["synthetic-c"]', GROQ_MODEL: 'test-groq', OPENROUTER_MODEL: 'openrouter/free' };
  const pools = new Map();
  env.POOLS = { idFromName: name => name, get(name) {
    if (!pools.has(name)) pools.set(name, new KeyPool({ storage: storage() }, env));
    return { fetch: (url, init) => pools.get(name).fetch(new Request(url, init)) };
  } };
  return env;
}
const request = (pool = 'auto', token = 'test-only', extra = {}) => new Request('https://example.com/v1/chat/completions', {
  method: 'POST', headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ pool, messages: [{ role: 'user', content: 'synthetic' }], ...extra }),
});
const completion = () => Response.json({ choices: [{ message: { content: 'synthetic' } }] });

test('retry delay respects seconds and HTTP dates', () => {
  assert.equal(retryDelay('120'), 120_000);
  assert.equal(retryDelay('Tue, 13 Oct 2026 00:01:00 GMT', Date.parse('2026-10-13T00:00:00Z')), 60_000);
  assert.equal(retryDelay(null), 60_000);
});
test('auth and request validation do not call providers', async () => {
  const env = setup();
  assert.equal((await worker.fetch(request('auto', 'wrong'), env)).status, 401);
  assert.equal((await worker.fetch(request('auto', 'test-only', { stream: true }), env)).status, 400);
});
test('keys rotate between requests', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push(init.headers.Authorization); return completion(); });
  const env = setup();
  for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(request('groq'), env)).status, 200);
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-a']);
});
test('429 cools down a key and tries another key; later calls skip it', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(init.headers.Authorization);
    return init.headers.Authorization.endsWith('synthetic-a') ? new Response('', { status: 429, headers: { 'Retry-After': '300' } }) : completion();
  });
  const env = setup();
  assert.equal((await worker.fetch(request('groq'), env)).status, 200);
  assert.equal((await worker.fetch(request('groq'), env)).status, 200);
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-b']);
});
test('auto switches pools and substitutes the provider model', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(JSON.parse(init.body).model);
    return url.includes('groq.com') ? new Response('', { status: 429 }) : completion();
  });
  const response = await worker.fetch(request(), setup());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-AI-Provider'), 'openrouter');
  assert.deepEqual(calls, ['test-groq', 'test-groq', 'openrouter/free']);
});
test('explicit groq selection never calls OpenRouter', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return new Response('', { status: 429 }); });
  assert.equal((await worker.fetch(request('groq'), setup())).status, 503);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes('groq.com')));
});
test('invalid keys are disabled and request errors are not retried', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(init.headers.Authorization);
    return new Response('', { status: init.headers.Authorization.endsWith('synthetic-a') ? 401 : 400 });
  });
  const env = setup();
  assert.equal((await worker.fetch(request('groq'), env)).status, 400);
  assert.equal((await worker.fetch(request('groq'), env)).status, 400);
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-b']);
});
test('empty pools deploy safely and reject completions with 503', async () => {
  const env = setup(); env.GROQ_KEYS = '[]'; env.OPENROUTER_KEYS = '[]';
  assert.equal((await worker.fetch(new Request('https://example.com/health'), env)).status, 200);
  assert.equal((await worker.fetch(request(), env)).status, 503);
});
