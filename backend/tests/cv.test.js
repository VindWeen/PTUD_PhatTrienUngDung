import test from 'node:test';
import assert from 'node:assert/strict';
import { cvSchema, emptyDraft, buildPublicCv, filterPublishedAchievements } from '../src/modules/cv/cvSchemas.js';
import app from '../src/app.js';

test('CV only exposes selected profile data and achievements', () => {
  const draft = cvSchema.parse({ ...emptyDraft, showEmail: true, workHistoryIds: [2], achievementIds: [3], experiences: [{ organization: 'Công ty A', position: 'Kỹ sư', period: '2020', description: 'Dự án' }] });
  const profile = { fullName: 'An', email: 'an@example.test', phone: 'secret', userId: 1, workHistory: [{ assignmentId: 1, unitName: 'A' }, { assignmentId: 2, unitName: 'B', period: '2020', unitId: 99 }] };
  const cv = buildPublicCv(draft, profile, [{ achievementId: 3, title: 'Bài báo', recognitionYear: 2026, description: 'private' }, { achievementId: 4, title: 'Khác' }]);
  assert.equal(cv.email, 'an@example.test'); assert.equal(cv.phone, null);
  assert.deepEqual(cv.workHistory.map(item => item.unitName), ['B']);
  assert.deepEqual(cv.achievements, [{ achievementId: 3, title: 'Bài báo', recognitionYear: 2026 }]);
  assert.equal(JSON.stringify(cv).includes('secret'), false); assert.equal(JSON.stringify(cv).includes('private'), false);
});

test('public CV hides revoked or legacy unverifiable achievements and does not expose IDs', () => {
  const snapshot = { fullName: 'An', achievements: [{ achievementId: 3, title: 'Còn hiệu lực' }, { achievementId: 4, title: 'Đã thu hồi' }, { title: 'Bản cũ không có ID' }] };
  assert.deepEqual(filterPublishedAchievements(snapshot, [{ achievementId: 3 }]).achievements, [{ title: 'Còn hiệu lực', recognitionYear: undefined }]);
});

test('CV validates limits, template and experience fields', () => {
  assert.equal(cvSchema.safeParse({ ...emptyDraft, template: 'other' }).success, false);
  assert.equal(cvSchema.safeParse({ ...emptyDraft, experiences: [{ organization: '', position: 'A', period: '', description: '' }] }).success, false);
  assert.equal(cvSchema.safeParse({ ...emptyDraft, showPhone: 'true' }).success, false);
  assert.equal(cvSchema.safeParse({ ...emptyDraft, secret: 'x' }).success, false);
  const { education, specialties, ...oldDraft } = emptyDraft;
  const migrated = cvSchema.parse(oldDraft);
  assert.deepEqual(migrated.education, []); assert.equal(migrated.specialties, '');
});

test('public CV route is accessible without login and rejects invalid links with noindex', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/cv/invalid`);
    assert.equal(res.status, 404); assert.match(res.headers.get('x-robots-tag'), /noindex/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
