import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProfileService } from '../src/modules/profiles/profileService.js';
import { createOrganizationService } from '../src/modules/organizations/organizationService.js';

test('chặn sửa hồ sơ của người khác kể cả khi gọi thẳng service', async () => {
  const service = createProfileService({
    findLecturerById: async () => ({ lecturerId: 10, userId: 2 }),
  });
  await assert.rejects(() => service.updateProfile(1, 10, { version: 1 }), (error) => error.code === 'PROFILE_OWNER_REQUIRED');
});

test('chặn chọn đơn vị con làm cha', async () => {
  const service = createOrganizationService({
    findUnit: async () => ({ unitId: 1 }),
    hasDescendant: async () => true,
  });
  await assert.rejects(
    () => service.updateUnit(1, { parentId: 3, version: 1 }),
    (error) => error.code === 'ORGANIZATION_CYCLE'
  );
});

test('không xóa đơn vị có bất kỳ dữ liệu lịch sử nào', async () => {
  let deleted = false;
  const service = createOrganizationService({
    findUnit: async () => ({ unitId: 2 }),
    getDependencyCounts: async () => ({ children: 0, assignments: 1, achievements: 0, awards: 0, scopes: 0, representatives: 0 }),
    deleteUnit: async () => { deleted = true; },
  });
  await assert.rejects(() => service.removeUnit(2), (error) => error.code === 'ORGANIZATION_HAS_DATA');
  assert.equal(deleted, false);
});

test('điều chuyển chỉ giao cho transaction lịch sử và repository không sửa context_unit_id', async () => {
  let transferPayload;
  const service = createOrganizationService({
    findUnit: async () => ({ unitId: 3 }),
    transferLecturer: async (payload) => { transferPayload = payload; return { assignmentId: 9 }; },
  });
  await service.transferLecturer({ lecturerId: 4, unitId: 3, effectiveAt: '2026-10-01T00:00:00.000Z' }, 1);
  assert.deepEqual(transferPayload, { lecturerId: 4, unitId: 3, effectiveAt: '2026-10-01T00:00:00.000Z', assignedBy: 1 });

  const repositoryPath = fileURLToPath(new URL('../src/modules/organizations/organizationRepository.js', import.meta.url));
  const source = fs.readFileSync(repositoryPath, 'utf8');
  const transferBody = source.slice(source.indexOf('export async function transferLecturer'));
  assert.doesNotMatch(transferBody, /UPDATE\s+app\.achievements/i);
  assert.doesNotMatch(transferBody, /SET\s+context_unit_id/i);
});
