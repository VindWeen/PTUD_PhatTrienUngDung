import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrganizationService } from '../src/modules/organizations/organizationService.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB().catch(() => {});
});

test('Unit AI Scan: rejects MEMBER role with ForbiddenError', async () => {
  const service = createOrganizationService({});
  await assert.rejects(
    async () => {
      await service.scanUnitWithAi(1, 10, {
        userId: 99,
        activeRoles: ['MEMBER'],
      });
    },
    { name: 'ForbiddenError' }
  );
});

test('Unit AI Scan: DEPARTMENT_HEAD is restricted to their assigned department', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: 'Bộ môn KTPM', parentId: 1 }),
  };
  const service = createOrganizationService(mockRepo);

  await assert.rejects(
    async () => {
      await service.scanUnitWithAi(3, 10, {
        userId: 20,
        activeRoles: ['DEPARTMENT_HEAD'],
      });
    },
    { name: 'ForbiddenError' }
  );
});

test('Unit AI Scan: FACULTY_LEAD can scan descendant departments but cannot scan outside faculty', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: unitId === 4 ? 'Khoa Dược' : 'Khoa CNTT' }),
    hasDescendant: async (parentUnitId, targetUnitId) => {
      if (parentUnitId === 1 && (targetUnitId === 2 || targetUnitId === 3)) return true;
      return false;
    },
  };
  const service = createOrganizationService(mockRepo);

  await assert.rejects(
    async () => {
      await service.scanUnitWithAi(4, 10, {
        userId: 2,
        activeRoles: ['FACULTY_LEAD'],
      });
    },
    { name: 'ForbiddenError' }
  );
});

test('Unit AI Scan: ADMIN can scan any unit and receives comprehensive scan results', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: 'Khoa Công nghệ thông tin', type: 'FACULTY' }),
    getRegulationCriteria: async (regId) => [
      {
        criteria_version_id: 1,
        code: 'PAPER_ISI',
        name: 'Bài báo Quốc tế Scopus/ISI',
        target_type: 'INDIVIDUAL',
        min_threshold: 1,
        unit_metric: 'bài',
        version_id: 1,
        source_rules: {
          sourceType: 'ACHIEVEMENT',
          achievementTypeIds: [1],
        },
      },
      {
        criteria_version_id: 2,
        code: 'AWARD_MINISTRY',
        name: 'Bằng khen cấp Bộ',
        target_type: 'INDIVIDUAL',
        min_threshold: 1,
        unit_metric: 'bằng khen',
        version_id: 1,
        source_rules: {
          sourceType: 'ACHIEVEMENT',
          achievementTypeIds: [2],
        },
      },
    ],
    getDescendantUnitIds: async (unitId) => [1, 2, 3],
    getUnitMembers: async (unitIds) => [
      {
        lecturer_id: 101,
        user_id: 11,
        full_name: 'Nguyễn Văn Đạt',
        email: 'dat.nv@lhu.edu.vn',
        unit_id: 2,
        unit_name: 'Bộ môn Kỹ thuật phần mềm',
      },
      {
        lecturer_id: 102,
        user_id: 12,
        full_name: 'Lê Thị Thiếu',
        email: 'thieu.lt@lhu.edu.vn',
        unit_id: 3,
        unit_name: 'Bộ môn Khoa học máy tính',
      },
    ],
    getMemberAchievements: async (lecturerId) => {
      if (lecturerId === 101) {
        return [
          {
            id: 1,
            type: 'ACHIEVEMENT',
            sourceTypeId: 1,
            title: 'Bài báo ISI Q1',
            lecturerId: 101,
            subjectId: 101,
            year: 2025,
            status: 'ACTIVE',
            hasEvidence: true,
          },
          {
            id: 2,
            type: 'ACHIEVEMENT',
            sourceTypeId: 2,
            title: 'Bằng khen Bộ GD&ĐT',
            lecturerId: 101,
            subjectId: 101,
            year: 2024,
            status: 'ACTIVE',
            hasEvidence: true,
          },
        ];
      }
      if (lecturerId === 102) {
        return [
          {
            id: 3,
            type: 'ACHIEVEMENT',
            sourceTypeId: 1,
            title: 'Bài báo Scopus Q3',
            lecturerId: 102,
            subjectId: 102,
            year: 2025,
            status: 'ACTIVE',
            hasEvidence: true,
          },
        ];
      }
      return [];
    },
  };

  const service = createOrganizationService(mockRepo);
  const result = await service.scanUnitWithAi(1, 10, {
    userId: 1,
    activeRoles: ['ADMIN'],
  });

  assert.equal(result.unitId, 1);
  assert.equal(result.regulationId, 10);
  assert.equal(result.totalMembers, 2);
  assert.equal(result.eligibleCount, 1);
  assert.equal(result.results.length, 2);

  // Check Lecturer 101 (eligible)
  const member1 = result.results.find(m => m.lecturerId === 101);
  assert.ok(member1);
  assert.equal(member1.percentage, 100);
  assert.equal(member1.isEligible, true);
  assert.equal(member1.matched.length, 2);
  assert.equal(member1.missing.length, 0);

  // Check Lecturer 102 (not fully eligible, missing AWARD_MINISTRY)
  const member2 = result.results.find(m => m.lecturerId === 102);
  assert.ok(member2);
  assert.equal(member2.percentage, 50);
  assert.equal(member2.isEligible, false);
  assert.equal(member2.matched.length, 1);
  assert.equal(member2.missing.length, 1);
  assert.equal(member2.missing[0].code, 'AWARD_MINISTRY');
});
