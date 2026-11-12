// Real HTTP/PostgreSQL integration in a fresh schema; all changes rolled back.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';
import aiService from '../src/modules/ai/aiService.js';

const schema = `criteria_rules_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^criteria_rules_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max: 1, connectionTimeoutMillis: 10000 });
let client, server, passed = 0;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='60s'");
  for (const file of (await fs.readdir(new URL('../../supabase/migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
    await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8')));
  }
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')));
  const adapted = {
    async query(sql, values) {
      if (sql === 'BEGIN') return client.query('SAVEPOINT criterion_mutation');
      if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT criterion_mutation');
      if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT criterion_mutation'); return client.query('RELEASE SAVEPOINT criterion_mutation'); }
      return client.query(rewrite(sql), values);
    },
    release() {},
  };
  setPool({ query: adapted.query, connect: async () => adapted });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function call(method, path, body, expected = 200, user = 3) {
    const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${generateAccessToken({ userId: user })}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    passed++;
    return data.data;
  }
  const catalogs = await call('GET', '/regulations/criteria/source-catalogs');
  const achievementId = Number(catalogs.ACHIEVEMENT.find(t => ['LECTURER', 'BOTH'].includes(t.applicable_subject_type)).id);
  const awardId = Number(catalogs.AWARD_RECORD.find(t => ['LECTURER', 'BOTH'].includes(t.applicable_subject_type)).id);
  const achievementRules = { sourceType: 'ACHIEVEMENT', achievementTypeIds: [achievementId] };
  const awardRules = { sourceType: 'AWARD_RECORD', awardTypeIds: [awardId] };
  const document = await call('POST', '/regulations', { documentCode: 'TEST-SOURCE-RULES', title: 'Synthetic source mapping test', documentType: 'UNIVERSITY_REGULATION' }, 201);
  const version = await call('POST', `/regulations/${document.document_id}/versions`, { versionNumber: '1', effectiveFrom: '2020-01-01' }, 201);
  await call('PATCH', `/regulations/versions/${version.version_id}/confirm`, { isConfirmed: true, lhuApplicationStatus: 'CONFIRMED_LHU_POLICY' });
  const create = (code, sourceRules) => call('POST', `/regulations/versions/${version.version_id}/criteria`, { criterionCode: code, name: code, targetType: 'INDIVIDUAL', minThreshold: 1, unitMetric: 'bản ghi', ...(sourceRules ? { sourceRules } : {}) }, 201);
  const a = await create('TEST-ACHIEVEMENT', achievementRules);
  const b = await create('TEST-AWARD', awardRules);
  const unmapped = await create('TEST-UNMAPPED');
  assert.equal(a.is_confirmed, false);
  assert.equal(a.source_rules_revision, 1);
  const path = `/regulations/criteria/${a.criteria_version_id}`;
  await call('PATCH', `${path}/source-rules`, { sourceRules: awardRules, expectedRevision: 1 }, 403, 1);
  await call('PATCH', `${path}/source-rules`, { sourceRules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [] }, expectedRevision: 1 }, 400);
  await call('PATCH', `${path}/source-rules`, { sourceRules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [999999] }, expectedRevision: 1 }, 400);
  await adapted.query('UPDATE app.achievement_types SET is_active=false WHERE achievement_type_id=$1', [achievementId]);
  await call('PATCH', `${path}/source-rules`, { sourceRules: achievementRules, expectedRevision: 1 }, 400);
  await adapted.query('UPDATE app.achievement_types SET is_active=true WHERE achievement_type_id=$1', [achievementId]);
  const wrongTarget = (await adapted.query(`INSERT INTO app.achievement_types (code,name,applicable_subject_type) VALUES ('TEST_UNIT_SOURCE','Unit only','UNIT') RETURNING achievement_type_id`)).rows[0].achievement_type_id;
  await call('PATCH', `${path}/source-rules`, { sourceRules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [Number(wrongTarget)] }, expectedRevision: 1 }, 400);
  await call('PATCH', `${path}/source-rules`, { sourceRules: { ...achievementRules, awardTypeIds: [awardId] }, expectedRevision: 1 }, 400);
  await call('PATCH', `${path}/confirm`, { isConfirmed: true }, 409);
  for (const c of [a, b, unmapped]) await call('PATCH', `/regulations/criteria/${c.criteria_version_id}/confirm`, { isConfirmed: true, expectedSourceRulesRevision: c.source_rules_revision });
  const request = { subjectType: 'LECTURER', subjectId: 1, criteriaVersionIds: [Number(a.criteria_version_id), Number(b.criteria_version_id), Number(unmapped.criteria_version_id)], forcedProvider: 'mock' };
  const run = await call('POST', '/ai/evaluations/structured', request, 201);
  assert.deepEqual(run.inputSnapshot.criteria.map(c => c.rules), [achievementRules, awardRules, null]);
  assert.equal(run.criterionResults[2].thresholdMetric.actualRecorded, null);
  assert.equal(run.criterionResults[2].humanReviewRequired, true);
  assert.equal((await call('GET', `/ai/evaluations/${run.runId}/stale-check`)).isStale, false);
  await call('POST', '/ai/evaluations/structured', { ...request, rules: awardRules }, 400);
  // Even internal callers cannot inject a shared rule to bypass server mappings.
  const withRecords = await aiService.evaluateStructured({ ...request, rules: awardRules, mockRecords: [
    { id: 90001, type: 'ACHIEVEMENT', sourceTypeId: achievementId, subjectId: 1, year: 2025, status: 'VERIFIED', hasEvidence: true },
    { id: 90002, type: 'AWARD_RECORD', sourceTypeId: awardId, subjectId: 1, year: 2025, status: 'RECORDED', hasEvidence: true },
    { id: 90003, type: 'ACHIEVEMENT', sourceTypeId: 999999, subjectId: 1, year: 2025, status: 'VERIFIED', hasEvidence: true },
  ] }, { userId: 3 });
  assert.deepEqual(withRecords.criterionResults.map(c => c.thresholdMetric.actualRecorded), [1, 1, null]);
  assert.equal(withRecords.automaticAwardGranted, false);
  const changed = await call('PATCH', `${path}/source-rules`, { sourceRules: awardRules, expectedRevision: 1 });
  assert.equal(changed.is_confirmed, false);
  assert.equal(changed.confirmed_by, null);
  assert.equal(changed.source_rules_revision, 2);
  await call('PATCH', `${path}/source-rules`, { sourceRules: achievementRules, expectedRevision: 1 }, 409);
  await call('PATCH', `${path}/confirm`, { isConfirmed: true, expectedSourceRulesRevision: 1 }, 409);
  assert.equal((await call('GET', `/ai/evaluations/${run.runId}/stale-check`)).isStale, true);
  const pendingRun = await call('POST', '/ai/evaluations/structured', { ...request, criteriaVersionIds: [Number(a.criteria_version_id)] }, 201);
  assert.equal(pendingRun.criterionResults[0].thresholdMetric.isSatisfied, 'UNCONFIRMED');
  const history = await adapted.query('SELECT * FROM app.criteria_source_rule_history WHERE criteria_version_id=$1 ORDER BY revision', [a.criteria_version_id]);
  assert.equal(history.rowCount, 2);
  assert.deepEqual(history.rows[1].previous_rules, achievementRules);
  assert.deepEqual(history.rows[1].source_rules, awardRules);
  assert.equal(Number(history.rows[1].changed_by), 3);
  await call('PATCH', `${path}/confirm`, { isConfirmed: true, expectedSourceRulesRevision: 2 });
  await call('PATCH', `/regulations/versions/${version.version_id}/confirm`, { isConfirmed: true, lhuApplicationStatus: 'SIMULATION_ONLY' });
  const simulated = await call('POST', '/ai/evaluations/structured', { ...request, criteriaVersionIds: [Number(a.criteria_version_id)] }, 201);
  assert.equal(simulated.criterionResults[0].thresholdMetric.isSatisfied, 'UNCONFIRMED');
  const removed = await call('PATCH', `${path}/source-rules`, { sourceRules: null, expectedRevision: 2 });
  assert.equal(removed.source_rules, null);
  assert.equal(removed.is_confirmed, false);
  await call('PATCH', `${path}/confirm`, { isConfirmed: true, expectedSourceRulesRevision: 2 }, 409);
  console.log(`PASS criterion source mapping: ${passed} HTTP assertions + per-criterion evaluation, revision audit, stale hashes and fail-closed checks. All database changes rolled back.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (client) { await client.query('ROLLBACK'); client.release(); }
  await pool.end();
}
