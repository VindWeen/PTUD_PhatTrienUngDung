import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedRead, clearReadCache, invalidateReadCache } from '../src/services/readCache.js';
import { readCacheKey } from '../src/services/readCachePolicy.js';

test('simultaneous reads share a request; fresh cache avoids fetching again', async () => {
  clearReadCache();
  let calls = 0;
  const read = async () => { calls += 1; return { count: 4 }; };
  const results = await Promise.all([cachedRead('summary', read), cachedRead('summary', read)]);
  assert.deepEqual(results, [{ count: 4 }, { count: 4 }]);
  assert.deepEqual(await cachedRead('summary', read), { count: 4 });
  assert.equal(calls, 1);
});

test('session/write invalidation prevents an old pending response from replacing new data', async () => {
  clearReadCache();
  let finish;
  const old = cachedRead('profile', () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  clearReadCache();
  assert.equal(await cachedRead('profile', async () => 'new account'), 'new account');
  finish('old account');
  await old;
  assert.equal(await cachedRead('profile', async () => 'incorrect'), 'new account');
});

test('failed requests are retryable and expired entries fetch fresh data', async () => {
  clearReadCache();
  await assert.rejects(cachedRead('criteria', async () => { throw new Error('offline'); }));
  assert.equal(await cachedRead('criteria', async () => 'recovered', 0), 'recovered');
  assert.equal(await cachedRead('criteria', async () => 'updated'), 'updated');
});

test('refreshing one list preserves cached data on other pages', async () => {
  clearReadCache();
  await cachedRead('goals', async () => 'old goals');
  await cachedRead('reports', async () => 'reports');
  invalidateReadCache('goals');
  assert.equal(await cachedRead('goals', async () => 'new goals'), 'new goals');
  assert.equal(await cachedRead('reports', async () => 'incorrect'), 'reports');
});

test('a response started before manual refresh cannot overwrite its replacement', async () => {
  clearReadCache();
  let finish;
  const old = cachedRead('list', () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  invalidateReadCache('list');
  assert.equal(await cachedRead('list', async () => 'new'), 'new');
  finish('old');
  await old;
  assert.equal(await cachedRead('list', async () => 'incorrect'), 'new');
});

test('each page, filter and pagination has an isolated cache key', () => {
  for (const url of ['/admin/users', '/admin/roles', '/admin/scopes', '/admin/user-roles', '/admin/representatives', '/admin/academic-years', '/admin/achievement-types', '/admin/award-types', '/achievements', '/achievements/1/history', '/kpi/goals', '/kpi/catalogs', '/kpi/recommendations', '/award-cycles', '/award-applications', '/reports', '/notifications', '/ai/evaluations', '/ai/evaluations/1', '/award-records']) {
    assert.ok(readCacheKey({ url }), url);
  }
  const key = readCacheKey({ url: '/reports', params: { page: 1, search: 'test', subjectType: undefined } });
  assert.equal(key, readCacheKey({ url: '/reports', params: { search: 'test', page: '1' } }));
  assert.notEqual(key, readCacheKey({ url: '/reports', params: { page: 2, search: 'test' } }));
  assert.notEqual(key, readCacheKey({ url: '/reports', params: { page: 1, search: 'different' } }));
  assert.notEqual(readCacheKey({ url: '/notifications', params: { unreadOnly: true } }), readCacheKey({ url: '/notifications', params: { unreadOnly: false } }));
});

test('mutations, auth, file downloads and live stale checks never use page cache', () => {
  for (const config of [{ method: 'POST', url: '/kpi/goals' }, { method: 'PATCH', url: '/achievements/1' }, { url: '/auth/me' }, { url: '/reports/export.csv' }, { url: '/kpi/template.csv' }, { url: '/ai/evaluations/1/stale-check' }, { url: '/reports', responseType: 'blob' }]) {
    assert.equal(readCacheKey(config), null);
  }
});
