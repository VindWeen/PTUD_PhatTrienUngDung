import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import authenticate from '../src/middlewares/authenticate.js';
import { rotateRefreshToken } from '../src/modules/auth/authRepository.js';
import { changePassword, refreshLifetimeDays } from '../src/modules/auth/authService.js';
import { hashPassword } from '../src/utils/crypto.js';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';
import { AiService } from '../src/modules/ai/aiService.js';
import { evaluateStructuredCriterion, buildInputSnapshot } from '../src/modules/ai/criteriaEvaluator.js';
import { ApplicationService } from '../src/modules/awards/applicationService.js';
import { validateTargetName } from '../../scripts/restore.mjs';

const result = rows => ({ rows, rowCount: rows.length });
const user = { userId: 20 };
const subject = { subjectType: 'LECTURER', subjectId: 20 };
const criterion = { criteriaVersionId: 42, criterionCode: 'TEXTBOOKS', name: 'Giáo trình', targetType: 'INDIVIDUAL', minThreshold: 2, unitMetric: 'cuốn', isConfirmed: true, versionId: 1 };
const doc = { versionId: 1, versionNumber: '1', sha256Hash: 'a'.repeat(64), isConfirmed: true, lhuApplicationStatus: 'CONFIRMED_LHU_POLICY', effectiveFrom: '2020-01-01' };
const records = [1, 2].map(id => ({ id, type: 'ACHIEVEMENT', sourceTypeId: 8, subjectId: 20, year: 2026, status: 'VERIFIED', file: { id, sha256: 'b'.repeat(64) } }));
test.afterEach(() => setPool(null));

test('revoked regulation role is checked from DB on the actual HTTP route', async () => {
  let writes = 0;
  setPool({ query: async sql => {
    if (sql.includes('FROM app.users')) return result([{ UserId: 20, Status: 'ACTIVE', PasswordChangedAt: null }]);
    if (sql.includes('FROM app.user_roles')) return result([]);
    if (sql.includes('INSERT')) writes++;
    return result([]);
  } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const token = generateAccessToken({ userId: 20, roles: ['ADMIN'] });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/regulations`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ documentCode: 'TEST', title: 'Synthetic', documentType: 'GUIDELINE' }) });
    assert.equal(response.status, 403);
    assert.equal(writes, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('password change invalidates old access token and permits a freshly issued one', async () => {
  const change = new Date('2026-10-29T03:00:00.123Z');
  setPool({ query: async () => result([{ UserId: 20, Status: 'ACTIVE', PasswordChangedAt: change }]) });
  const run = token => new Promise(resolve => authenticate({ headers: { authorization: `Bearer ${token}` } }, {}, e => resolve(e)));
  assert.equal((await run(generateAccessToken({ userId: 20 }))).statusCode, 401);
  assert.equal(await run(generateAccessToken({ userId: 20, passwordChangedAt: change.toISOString() })), undefined);
});

test('a refresh token can be consumed only once even when requests overlap', async () => {
  let consumed = false, inserts = 0;
  const client = { release() {}, query: async sql => {
    if (sql.includes('WHERE refresh_token_id=$1')) { if (consumed) return result([]); consumed = true; return result([{ refresh_token_id: 1 }]); }
    if (sql.includes('INSERT INTO app.refresh_tokens')) { inserts++; return result([{ RefreshTokenId: 2 }]); }
    return result([]);
  } };
  setPool({ connect: async () => client });
  const values = { userId: 20, newTokenHash: 'synthetic', newExpiresAt: new Date() };
  const settled = await Promise.allSettled([rotateRefreshToken(1, values), rotateRefreshToken(1, values)]);
  assert.equal(settled.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(settled.filter(x => x.status === 'rejected' && x.reason.statusCode === 401).length, 1);
  assert.equal(inserts, 1);
});

test('remember-me lifetime is retained through refresh', () => {
  const created = Date.now();
  assert.equal(refreshLifetimeDays({ CreatedAt: new Date(created), ExpiresAt: new Date(created + 30 * 86400000) }), 30);
  assert.equal(refreshLifetimeDays({ CreatedAt: new Date(created), ExpiresAt: new Date(created + 7 * 86400000) }), 7);
});

test('password update rolls back if session revocation fails', async () => {
  const statements = [];
  const oldHash = await hashPassword('old-password', 4);
  const client = { release() {}, query: async sql => {
    statements.push(sql);
    if (sql.includes('UPDATE app.refresh_tokens')) throw Error('synthetic database failure');
    return result([]);
  } };
  setPool({ query: async () => result([{ UserId: 20, Status: 'ACTIVE', PasswordHash: oldHash }]), connect: async () => client });
  await assert.rejects(changePassword(20, 'old-password', 'new-password'), /synthetic database failure/);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
});

test('generic achievement creation rejects replacing another subject', async () => {
  const service = createAchievementService({
    findLecturerByUserId: async () => ({ lecturerId: 20, primaryUnitId: 2 }),
    findAchievementById: async () => ({ status: 'REVOKED', lecturerId: 999 }),
    createAchievement: async () => { throw Error('must not write'); },
  });
  await assert.rejects(service.createAchievement(user, { subjectType: 'LECTURER', replacesAchievementId: 99 }), e => e.statusCode === 403);
});

test('unmapped criterion never counts unrelated verified records as a pass', () => {
  const r = evaluateStructuredCriterion({ subject, criterion, documentVersion: doc, records, asOfDate: '2026-10-29' });
  assert.equal(r.thresholdMetric.actualRecorded, null);
  assert.equal(r.thresholdMetric.isSatisfied, 'UNCONFIRMED');
  assert.equal(r.humanReviewRequired, true);
  assert.ok(r.issues.includes('CRITERION_SOURCE_UNMAPPED'));
});

test('explicit criterion mapping counts only the specified source type', () => {
  const matching = [...records, { ...records[0], id: 3, sourceTypeId: 9 }];
  const rules = { sourceType: 'ACHIEVEMENT', achievementTypeIds: [8] };
  const r = evaluateStructuredCriterion({ subject, criterion, documentVersion: doc, records: matching, rules, asOfDate: '2026-10-29' });
  assert.equal(r.thresholdMetric.actualRecorded, 2);
  assert.equal(r.thresholdMetric.isSatisfied, true);
  const wrong = evaluateStructuredCriterion({ subject: { subjectType: 'UNIT', subjectId: 20 }, criterion, documentVersion: doc, records: matching, rules, asOfDate: '2026-10-29' });
  assert.equal(wrong.thresholdMetric.isSatisfied, 'UNCONFIRMED');
});

test('snapshot preserves criterion identifiers and detects changes in threshold', () => {
  const c = { criteria_version_id: 42, criterion_code: 'TEXTBOOKS', name: 'Giáo trình', target_type: 'INDIVIDUAL', min_threshold: 2, unit_metric: 'cuốn', is_confirmed: true, version_id: 1 };
  const before = buildInputSnapshot({ subject, criterion: c, documentVersion: doc, records: [], asOfDate: '2026-10-29' });
  const after = buildInputSnapshot({ subject, criterion: { ...c, min_threshold: 3 }, documentVersion: doc, records: [], asOfDate: '2026-10-29' });
  assert.equal(before.snapshot.criterion.criterionId, 42);
  assert.equal(before.snapshot.criterion.criterionCode, 'TEXTBOOKS');
  assert.equal(before.snapshot.criterion.minThreshold, 2);
  assert.notEqual(before.inputHash, after.inputHash);
});

test('staleness check reads current criterion and policy', async () => {
  const c = { criteria_version_id: 42, criterion_code: 'TEXTBOOKS', name: 'Giáo trình', target_type: 'INDIVIDUAL', min_threshold: 2, unit_metric: 'cuốn', is_confirmed: true, version_id: 1 };
  const d = { version_id: 1, version_number: '1', sha256_hash: 'a'.repeat(64), is_confirmed: true, lhu_application_status: 'CONFIRMED_LHU_POLICY', effective_from: '2020-01-01' };
  const saved = buildInputSnapshot({ subject, criterion: c, documentVersion: d, criteria: [c], documentVersions: [d], records: [], asOfDate: '2026-10-29' });
  let confirmed = true, marked = null;
  const service = new AiService({ poolUrl: '', regulations: {
    findCriteriaVersionById: async () => ({ ...c, is_confirmed: confirmed }), findVersionById: async () => d,
  }, evaluationRepo: { getEvaluationRunById: async () => ({ targetSubject: subject, inputSnapshot: saved.snapshot, inputHash: saved.inputHash, isStale: false }), markRunStale: async (_c, _id, value) => { marked = value; } } });
  service.authorizeSubjectAccess = async () => true;
  const client = { query: async () => result([]) };
  assert.equal((await service.checkEvaluationStale('run', user, client)).isStale, false);
  confirmed = false;
  assert.equal((await service.checkEvaluationStale('run', user, client)).isStale, true);
  assert.equal(marked, true);
});

test('application pagination signals additional candidates even when this page is filtered out', async () => {
  const service = new ApplicationService({ pool: () => ({ query: async () => result(Array.from({ length: 20 }, (_, id) => ({ application_id: id }))) }), roles: async () => ['COUNCIL'], scope: async () => true });
  service.reader = async () => { const { ForbiddenError } = await import('../src/utils/errors.js'); throw new ForbiddenError(); };
  const page = await service.list({ contextUnitId: 1 }, user);
  assert.equal(page.items.length, 0);
  assert.equal(page.hasMore, true);
});

test('native restore requires an isolated database name and rejects unsafe identifiers', () => {
  assert.equal(validateTargetName('PTUD_restore_abc', ['PTUD_LHU']), 'PTUD_restore_abc');
  assert.throws(() => validateTargetName('app; DROP DATABASE app'), /isolated target/);
  assert.throws(() => validateTargetName('PTUD_LHU', ['PTUD_LHU']), /isolated target/);
  assert.throws(() => validateTargetName('master_restore', ['master_restore']), /differ/);
});
