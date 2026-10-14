import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dashboard/worker.js';

function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(new URL('../dashboard/schema.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const prepare = sql => ({ bind: (...args) => statement(sql, args), ...statement(sql, []) });
  const statement = (sql, args) => ({ sql, args, run: async () => sqlite.prepare(sql).run(...args) });
  const DB = { prepare, batch: async statements => {
    sqlite.exec('BEGIN');
    try {
      const result = statements.map(s => ({ results: sqlite.prepare(s.sql).all(...s.args) }));
      sqlite.exec('COMMIT'); return result;
    } catch (err) { sqlite.exec('ROLLBACK'); throw err; }
  } };
  return { DB, POOL_ACCESS_TOKEN: 'synthetic-token', GROQ_KEYS: '["synthetic-a","synthetic-b"]',
    OPENROUTER_KEYS: '["synthetic-c"]', GROQ_MODEL: 'synthetic-groq', OPENROUTER_MODEL: 'openrouter/free' };
}
const request = pool => new Request('https://example.com/v1/chat/completions', { method: 'POST',
  headers: { Authorization: 'Bearer synthetic-token' },
  body: JSON.stringify({ pool, messages: [{ role: 'user', content: 'synthetic' }] }) });
const success = () => Response.json({ choices: [{ message: { content: 'synthetic' } }] });

test('D1 SQL persists round-robin cursor across Worker calls', async t => {
  const env = setup(t); const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push(init.headers.Authorization); return success(); });
  for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(request('groq'), env)).status, 200);
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-a']);
});
test('D1 cooldown persists and auto switches to OpenRouter', async t => {
  const env = setup(t); const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(init.headers.Authorization);
    return url.includes('groq.com') ? new Response('', { status: 429, headers: { 'Retry-After': '300' } }) : success();
  });
  for (let i = 0; i < 2; i++) {
    const response = await worker.fetch(request('auto'), env);
    assert.equal(response.status, 200); assert.equal(response.headers.get('X-AI-Provider'), 'openrouter');
  }
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-c', 'Bearer synthetic-c']);
});
test('dashboard setup works before keys are supplied, with database readiness check', async t => {
  const env = setup(t); env.GROQ_KEYS = '[]'; env.OPENROUTER_KEYS = '[]';
  const response = await worker.fetch(new Request('https://example.com/status', { headers: { Authorization: 'Bearer synthetic-token' } }), env);
  assert.deepEqual(await response.json(), { database: 'ready', configured_keys: { groq: 0, openrouter: 0 },
    models: { groq: 'synthetic-groq', openrouter: 'openrouter/free' } });
  assert.equal((await worker.fetch(request('auto'), env)).status, 503);
});
test('D1 disabled credential persists; invalid requests stop without fallback', async t => {
  const env = setup(t); const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(init.headers.Authorization);
    return new Response('', { status: init.headers.Authorization.endsWith('synthetic-a') ? 401 : 400 });
  });
  for (let i = 0; i < 2; i++) assert.equal((await worker.fetch(request('auto'), env)).status, 400);
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-b']);
});

test('model 404 switches provider in auto without disabling or trying every Groq key', async t => {
  const env = setup(t); const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(init.headers.Authorization);
    return url.includes('groq.com') ? new Response('', { status: 404 }) : success();
  });
  const auto = await worker.fetch(request('auto'), env);
  assert.equal(auto.status, 200);
  assert.equal(auto.headers.get('X-AI-Provider'), 'openrouter');
  assert.deepEqual(calls, ['Bearer synthetic-a', 'Bearer synthetic-c']);
  const explicit = await worker.fetch(request('groq'), env);
  assert.equal(explicit.status, 503);
  const body = await explicit.json();
  assert.equal(body.error.code, 'PROVIDER_MODEL_UNAVAILABLE');
  assert.equal(body.error.upstream_status, 404);
  const rows = await env.DB.batch([env.DB.prepare('SELECT COUNT(*) AS n FROM key_states')]);
  assert.equal(rows[0].results[0].n, 0);
});
