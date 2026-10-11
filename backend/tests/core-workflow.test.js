import test from 'node:test';
import assert from 'node:assert/strict';
import { createPermissionResolver } from '../src/modules/achievements/achievementPermissions.js';
import { EvidenceService } from '../src/modules/evidences/evidenceService.js';
import { setPool } from '../src/config/database.js';

const record = { subjectType: 'LECTURER', lecturerUserId: 10, createdBy: 10, submittedBy: 10, contextUnitId: 2, status: 'SUBMITTED' };
const resolve = (userId, roles, inScope = true, rep = false) => createPermissionResolver({ userId }, roles, {
  representative: async () => rep, scope: async () => inScope,
});

test('review requires current Manager scope; owner/creator/submitter cannot approve', async () => {
  assert.equal((await resolve(20, ['ADMIN'])(record)).actions.review, false);
  assert.equal((await resolve(20, ['MANAGER'], false)(record)).actions.review, false);
  assert.equal((await resolve(20, ['MANAGER'])(record)).actions.review, true);
  for (const ownField of ['lecturerUserId', 'createdBy', 'submittedBy']) {
    assert.equal((await resolve(20, ['MANAGER'])({ ...record, [ownField]: 20 })).actions.review, false);
  }
});

test('collective ownership follows current representative, not historical creator', async () => {
  const unit = { ...record, subjectType: 'UNIT', lecturerUserId: null, organizationUnitId: 3, status: 'NEED_CORRECTION' };
  const expired = (await resolve(10, ['UNIT_REPRESENTATIVE'], false, false)(unit)).actions;
  assert.equal(expired.manageEvidence, false);
  assert.equal(expired.submit, false);
  const current = (await resolve(20, ['UNIT_REPRESENTATIVE'], false, true)(unit)).actions;
  assert.equal(current.manageEvidence, true);
  assert.equal(current.submit, true);
  assert.equal(current.cancel, true);
});

test('submitted/verified files stay locked and ended records support owner replacement', async () => {
  for (const status of ['SUBMITTED', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED']) {
    const a = (await resolve(10, ['LECTURER'])({ ...record, status })).actions;
    assert.equal(a.manageEvidence, false);
    assert.equal(a.replace, ['REJECTED', 'CANCELLED', 'REVOKED'].includes(status));
  }
  assert.equal((await resolve(10, ['LECTURER'])({ ...record, status: 'DRAFT', latestRevisionNo: 1 })).actions.remove, false);
});

test('upload/delete rechecks status under submission row lock, before writing a file', async () => {
  const original = { status: 'DRAFT', lecturerId: 1, lecturer: { userId: 10 } };
  const writes = [];
  const client = { query: async sql => { writes.push(sql); return { rows: [] }; }, release() {} };
  setPool({ connect: async () => client });
  const service = new EvidenceService({
    achievementRepo: {
      findAchievementById: async () => original,
      findAchievementForUpdate: async () => ({ status: 'SUBMITTED', lecturer_id: 1, lecturerUserId: 10 }),
    },
    evidenceRepo: { findEvidenceById: async () => ({ achievementId: 1, isRemoved: false }) },
    storageAdapter: { saveFile: async () => writes.push('FILE_WRITE'), deleteFile: async () => {} },
  });
  const buffer = Buffer.from('%PDF-1.4 synthetic evidence');
  const file = { originalname: 'proof.pdf', mimetype: 'application/pdf', buffer, size: buffer.length };
  const user = { userId: 10 };
  for (const operation of [
    () => service.createEvidence({ achievementId: 1, body: { title: 'Minh chứng' }, file, user }),
    () => service.uploadFileVersion({ evidenceId: 1, file, user }),
    () => service.deleteEvidence({ evidenceId: 1, user }),
  ]) await assert.rejects(operation, /khóa bất biến/);
  assert.equal(writes.includes('FILE_WRITE'), false);
  assert.equal(writes.filter(s => s === 'ROLLBACK').length, 3);
  setPool(null);
});
