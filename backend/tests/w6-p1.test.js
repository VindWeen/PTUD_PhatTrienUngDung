import test from 'node:test';
import assert from 'node:assert/strict';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';

test('catalog read accepts current DB lecturer role without Admin', async () => {
  const rows = [{ achievement_type_id: '1', code: 'TEST', name: 'Synthetic', applicable_subject_type: 'LECTURER' }];
  const service = createAchievementService({ listActiveTypes: async () => rows }, { roles: async () => [{ Code: 'LECTURER' }] });
  assert.deepEqual(await service.listCatalogs({ userId: 1, roles: [] }), rows);
});

test('catalog read rejects revoked role even if JWT claims Admin', async () => {
  let reads = 0;
  const service = createAchievementService({ listActiveTypes: async () => { reads++; } }, { roles: async () => [] });
  await assert.rejects(service.listCatalogs({ userId: 1, roles: ['ADMIN'] }), e => e.statusCode === 403);
  assert.equal(reads, 0);
});

test('catalog read fails closed on DB role lookup failure', async () => {
  const failure = new Error('synthetic DB failure');
  let reads = 0;
  const service = createAchievementService({ listActiveTypes: async () => { reads++; } }, { roles: async () => { throw failure; } });
  await assert.rejects(service.listCatalogs({ userId: 1, roles: ['ADMIN'] }), failure);
  assert.equal(reads, 0);
});
