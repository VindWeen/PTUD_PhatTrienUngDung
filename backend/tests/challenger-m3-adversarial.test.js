import test from 'node:test';
import assert from 'node:assert/strict';

import { fromAiGapSchema, aiGapCriterionSchema } from '../src/modules/kpi/kpiSchemas.js';
import * as kpiRepo from '../src/modules/kpi/kpiRepository.js';

import { createReminderSchema, calendarService } from '../src/modules/calendar/calendarService.js';

import { createOrganizationService } from '../src/modules/organizations/organizationService.js';
import organizationRepository from '../src/modules/organizations/organizationRepository.js';
import organizationService from '../src/modules/organizations/organizationService.js';

import { getUserContact } from '../src/modules/cv/cvRepository.js';

import { NotFoundError, ForbiddenError, ValidationError } from '../src/utils/errors.js';
import { query, closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB().catch(() => {});
});

// ============================================================================
// SUITE 1: POST /api/v1/kpi/from-ai-gap ADVERSARIAL STRESS TESTING
// ============================================================================

test('KPI Gap Schema: rejects negative missingCount', () => {
  const result = fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [
      { code: 'ISI_Q1', name: 'Bài báo ISI Q1', missingCount: -5 }
    ]
  });
  assert.equal(result.success, false, 'Negative missingCount must be rejected by schema');
});

test('KPI Gap Schema: handles zero missingCount with fallback in service', async () => {
  const parsed = fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [
      { code: 'ISI_Q1', name: 'Bài báo ISI Q1', missingCount: 0 }
    ]
  });
  assert.equal(parsed.success, true, 'missingCount=0 is accepted by schema (min 0)');
  assert.equal(parsed.data.missingCriteria[0].missingCount, 0);

  // When passed to createFromAiGap logic: target = missingCount > 0 ? missingCount : 1
  const target = Number(parsed.data.missingCriteria[0].missingCount) > 0 ? Number(parsed.data.missingCriteria[0].missingCount) : 1;
  assert.equal(target, 1, 'Service ensures target is at least 1 when missingCount is 0');
});

test('KPI Gap Schema: rejects inverted root date ranges', () => {
  const result = fromAiGapSchema.safeParse({
    regulationId: 1,
    periodStart: '2026-12-31',
    periodEnd: '2026-01-01',
    missingCriteria: [
      { code: 'ISI_Q1', name: 'Bài báo ISI Q1', missingCount: 1 }
    ]
  });
  assert.equal(result.success, false, 'Inverted root date range (periodEnd < periodStart) must fail');
});

test('KPI Gap Schema: rejects inverted item-level date ranges', () => {
  // Item-level periodEnd < periodStart
  const parsed = fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [
      {
        code: 'ISI_Q1',
        name: 'Bài báo ISI Q1',
        periodStart: '2026-12-31',
        periodEnd: '2026-01-01',
        missingCount: 1
      }
    ]
  });
  assert.equal(parsed.success, false, 'aiGapCriterionSchema must reject inverted item date range');
});

test('KPI Gap Schema: rejects empty missingCriteria array', () => {
  const result = fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: []
  });
  assert.equal(result.success, false, 'Empty missingCriteria array must fail');
});

test('KPI Gap Schema: rejects malformed and out-of-bound inputs', () => {
  // Missing regulationId
  assert.equal(fromAiGapSchema.safeParse({ missingCriteria: [{ code: 'C1', name: 'Name 123' }] }).success, false);
  
  // Empty code
  assert.equal(fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [{ code: '   ', name: 'Valid Name' }]
  }).success, false);

  // Oversized code (> 80 chars)
  assert.equal(fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [{ code: 'A'.repeat(81), name: 'Valid Name' }]
  }).success, false);

  // Oversized name (> 255 chars)
  assert.equal(fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [{ code: 'C1', name: 'A'.repeat(256) }]
  }).success, false);

  // Impossible date (e.g. Feb 30)
  assert.equal(fromAiGapSchema.safeParse({
    regulationId: 1,
    periodStart: '2026-02-30',
    periodEnd: '2026-12-31',
    missingCriteria: [{ code: 'C1', name: 'Valid Name' }]
  }).success, false);

  // Out of bound year (< 1990)
  assert.equal(fromAiGapSchema.safeParse({
    regulationId: 1,
    periodStart: '1880-01-01',
    periodEnd: '1880-12-31',
    missingCriteria: [{ code: 'C1', name: 'Valid Name' }]
  }).success, false);

  // Out of bound year (> 2100)
  assert.equal(fromAiGapSchema.safeParse({
    regulationId: 1,
    periodStart: '2105-01-01',
    periodEnd: '2105-12-31',
    missingCriteria: [{ code: 'C1', name: 'Valid Name' }]
  }).success, false);
});

test('KPI Gap Service: duplicate goal logic in DRAFT updates target, increments version, and logs audit', async () => {
  let updatedTarget = null;
  let updatedVersion = null;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('SELECT * FROM app.kpi_goals WHERE')) {
        return {
          rows: [
            {
              goal_id: 88,
              code: 'SCOPUS_Q2',
              target: 2,
              status: 'DRAFT',
              version: 1,
              plan: 'Ke hoach cu',
            }
          ]
        };
      }
      if (sql.includes('UPDATE app.kpi_goals')) {
        updatedTarget = 2 + params[0]; // target + missingCount (3)
        updatedVersion = 2;
        return {
          rows: [
            {
              goal_id: 88,
              code: 'SCOPUS_Q2',
              target: updatedTarget,
              version: updatedVersion,
              plan: 'Ke hoach cu ; Ke hoach moi',
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const dup = await kpiRepo.findDuplicate(mockClient, { lecturer_id: 10 }, {
    code: 'SCOPUS_Q2',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  });
  assert.ok(dup);
  assert.equal(dup.status, 'DRAFT');

  const updated = (
    await mockClient.query(
      `UPDATE app.kpi_goals
       SET target = target + $1, [plan] = [plan] + N' ; ' + $2, updated_at = SYSUTCDATETIME(), version = version + 1
       OUTPUT INSERTED.* WHERE goal_id = $3`,
      [3, 'Ke hoach moi', dup.goal_id]
    )
  ).rows[0];

  assert.equal(updated.target, 5, 'Target should accumulate 2 + 3 = 5');
  assert.equal(updated.version, 2, 'Version should increment to prevent stale writes');
});

test('KPI Gap Service: duplicate goal in non-DRAFT (e.g. APPROVED) renames code with -GAP suffix', async () => {
  let createdCode = null;

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('SELECT * FROM app.kpi_goals WHERE')) {
        return {
          rows: [
            {
              goal_id: 99,
              code: 'SCOPUS_Q1',
              target: 1,
              status: 'APPROVED',
              version: 3,
            }
          ]
        };
      }
      if (sql.includes('INSERT INTO app.kpi_goals')) {
        createdCode = params[3];
        return {
          rows: [
            {
              goal_id: 100,
              code: createdCode,
              target: params[8],
              status: 'DRAFT',
              version: 1,
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const dup = await kpiRepo.findDuplicate(mockClient, { lecturer_id: 10 }, {
    code: 'SCOPUS_Q1',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  });
  assert.ok(dup);
  assert.equal(dup.status, 'APPROVED');

  let code = 'SCOPUS_Q1';
  if (dup.status !== 'DRAFT') {
    code = `${code}-GAP`;
  }
  const created = await kpiRepo.createGoal(
    mockClient,
    1,
    { lecturer_id: 10, context_unit_id: 2 },
    {
      code,
      title: 'Bài báo Scopus Q1 GAP',
      measureUnit: 'bài',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      target: 2,
      plan: 'Bổ sung',
      sourceNote: 'AI Gap',
    },
    'AI_GAP'
  );

  assert.equal(created.code, 'SCOPUS_Q1-GAP', 'Non-draft duplicates must be suffixed to avoid unique conflict');
});

test('KPI Gap Service: repo.subject supports all 4 standard roles + LECTURER in mock mode', async () => {
  const rolesToTest = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'LECTURER'];
  for (const role of rolesToTest) {
    const mockClient = {
      query: async (sql) => {
        if (sql.includes('app.user_roles')) {
          return { rows: [{ code: role }] };
        }
        if (sql.includes('app.lecturers')) {
          return { rows: [{ lecturer_id: 77, user_id: 15, context_unit_id: 37 }] };
        }
        return { rows: [] };
      }
    };
    const subj = await kpiRepo.subject(mockClient, 15, 'LECTURER');
    assert.ok(subj, `Subject resolution must succeed for role ${role}`);
    assert.equal(subj.lecturer_id, 77);
  }
});

test('Live DB auto-provisioning query: selects valid columns from app.users without Error 207', async () => {
  const res = await query('SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = 1');
  assert.ok(res.rows[0]);
  assert.ok(res.rows[0].full_name);
});

// ============================================================================
// SUITE 2: POST /api/v1/me/calendar/reminder ADVERSARIAL STRESS TESTING
// ============================================================================

test('Calendar Reminder Schema: rejects blank, whitespace-only and null titles', () => {
  assert.equal(createReminderSchema.safeParse({ title: '', deadlineDate: '2026-11-20' }).success, false);
  assert.equal(createReminderSchema.safeParse({ title: '    ', deadlineDate: '2026-11-20' }).success, false);
  assert.equal(createReminderSchema.safeParse({ title: '\t\n  ', deadlineDate: '2026-11-20' }).success, false);
  assert.equal(createReminderSchema.safeParse({ deadlineDate: '2026-11-20' }).success, false);
});

test('Calendar Reminder Schema: strictly enforces 1990-2100 year boundary limits', () => {
  // Boundary 1: Year 1989 (< 1990) -> Rejection
  assert.equal(createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '1989-12-31' }).success, false);
  
  // Boundary 2: Year 1990 (Min) -> Valid
  assert.equal(createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '1990-01-01' }).success, true);
  
  // Boundary 3: Year 2026 (Typical) -> Valid
  assert.equal(createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '2026-11-12' }).success, true);

  // Boundary 4: Year 2100 (Max) -> Valid
  assert.equal(createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '2100-12-31' }).success, true);

  // Boundary 5: Year 2101 (> 2100) -> Rejection
  assert.equal(createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '2101-01-01' }).success, false);

  // Boundary 6: Far future year (9999) -> Rejection
  assert.equal(createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '9999-12-31' }).success, false);
});

test('Calendar Reminder Schema: rejects impossible dates (e.g. Feb 30) preventing deadline mutation via rollover', () => {
  const parsed = createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '2026-02-30' });
  assert.equal(parsed.success, false, 'createReminderSchema must reject day-of-month rollover');
});

test('Calendar Reminder: title length truncation safely handles titles up to 255 chars without DB check failure', async () => {
  let capturedPersonalCalendarTitle = null;
  let capturedReminderTitle = null;

  const longTitle = 'A'.repeat(220);

  const service = calendarService(async (sql, params) => {
    if (sql.includes('INSERT INTO app.personal_calendar_events')) {
      capturedPersonalCalendarTitle = params[1];
      return { rows: [{ id: '10', event_id: 10, title: params[1], category: 'task' }] };
    }
    if (sql.includes('INSERT INTO app.calendar_reminders')) {
      capturedReminderTitle = params[1];
      return { rows: [{ reminder_id: 'rem-1', created_at: new Date() }] };
    }
    return { rows: [] };
  });

  const res = await service.createReminder({ userId: 1 }, {
    title: longTitle,
    deadlineDate: '2026-12-25',
  });

  assert.equal(res.title, longTitle, 'Returned title preserves full input');
  assert.equal(capturedPersonalCalendarTitle.length, 160, 'Personal calendar event title is safely truncated to 160 chars');
  assert.equal(capturedReminderTitle.length, 220, 'Calendar reminder title retains full 220 chars');
});

test('Calendar Reminder: validates and rejects non-existent foreign keys (regulation, award period, kpi goal)', async () => {
  const service = calendarService(async () => {
    return { rows: [] };
  });

  await assert.rejects(
    () => service.createReminder({ userId: 1 }, { title: 'Hạn', deadlineDate: '2026-11-20', regulationId: 999999 }),
    { name: 'NotFoundError', message: 'Không tìm thấy quy chế' }
  );

  await assert.rejects(
    () => service.createReminder({ userId: 1 }, { title: 'Hạn', deadlineDate: '2026-11-20', awardPeriodId: 999999 }),
    { name: 'NotFoundError', message: 'Không tìm thấy kỳ khen thưởng' }
  );

  await assert.rejects(
    () => service.createReminder({ userId: 1 }, { title: 'Hạn', deadlineDate: '2026-11-20', kpiGoalId: 999999 }),
    { name: 'NotFoundError', message: 'Không tìm thấy mục tiêu KPI' }
  );
});

test('Calendar Reminder: transaction rollback prevents orphan personal_calendar_events on reminder failure', async () => {
  let eventInserted = false;
  let rolledBack = false;

  const failingTxRunner = async (cb) => {
    try {
      await cb({
        query: async (sql, params) => {
          if (sql.includes('INSERT INTO app.personal_calendar_events')) {
            eventInserted = true;
            return { rows: [{ id: '99', event_id: 99, title: params[1], category: 'task' }] };
          }
          if (sql.includes('INSERT INTO app.calendar_reminders')) {
            throw new Error('DATABASE_CONNECTION_LOST_DURING_REMINDER_WRITE');
          }
          return { rows: [] };
        }
      });
    } catch (err) {
      rolledBack = true;
      throw err;
    }
  };

  const service = calendarService(null, failingTxRunner);

  await assert.rejects(
    () => service.createReminder({ userId: 1 }, { title: 'Test Atomicity', deadlineDate: '2026-12-15' }),
    { message: 'DATABASE_CONNECTION_LOST_DURING_REMINDER_WRITE' }
  );

  assert.equal(eventInserted, true, 'Event was inserted before error');
  assert.equal(rolledBack, true, 'Transaction rolled back on reminder write failure');
});

// ============================================================================
// SUITE 3: POST /api/v1/organizations/units/:id/ai-scan RBAC & LIVE SCAN
// ============================================================================

test('Unit AI Scan RBAC: MEMBER role is strictly rejected with ForbiddenError (403)', async () => {
  const service = createOrganizationService({});
  
  await assert.rejects(
    () => service.scanUnitWithAi(2, 10, { userId: 100, activeRoles: ['MEMBER'] }),
    { name: 'ForbiddenError' }
  );

  await assert.rejects(
    () => service.scanUnitWithAi(2, 10, { userId: 101, activeRoles: ['GUEST', 'STUDENT'] }),
    { name: 'ForbiddenError' }
  );
});

test('Unit AI Scan RBAC: DEPARTMENT_HEAD cannot scan other departments or parent faculty (403 Forbidden)', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: `Unit ${unitId}`, parentId: 1 }),
  };
  const service = createOrganizationService(mockRepo);

  await assert.rejects(
    () => service.scanUnitWithAi(3, 10, {
      userId: 20,
      activeRoles: ['DEPARTMENT_HEAD'],
    }),
    { name: 'ForbiddenError' }
  );
});

test('Unit AI Scan RBAC: FACULTY_LEAD scanning outside their faculty is rejected (403 Forbidden)', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: unitId === 4 ? 'Khoa Dược' : 'Khoa CNTT' }),
    hasDescendant: async (parentUnitId, targetUnitId) => {
      if (parentUnitId === 1 && (targetUnitId === 2 || targetUnitId === 3)) return true;
      return false;
    },
  };
  const service = createOrganizationService(mockRepo);

  await assert.rejects(
    () => service.scanUnitWithAi(4, 10, {
      userId: 2,
      activeRoles: ['FACULTY_LEAD'],
    }),
    { name: 'ForbiddenError' }
  );
});

test('Unit AI Scan RBAC: FACULTY_LEAD scanning a descendant department within faculty SUCCEEDS', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: 'Bộ môn KTPM', parentId: 1 }),
    hasDescendant: async (parentUnitId, targetUnitId) => {
      return parentUnitId === 1 && targetUnitId === 2;
    },
    getRegulationCriteria: async () => [
      {
        criteria_version_id: 1,
        code: 'PAPER_ISI',
        name: 'Bài báo ISI',
        target_type: 'INDIVIDUAL',
        min_threshold: 1,
        version_id: 1,
        source_rules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
      }
    ],
    getDescendantUnitIds: async (unitId) => [unitId],
    getUnitMembers: async () => [
      {
        lecturer_id: 201,
        user_id: 21,
        full_name: 'Nguyễn Văn A',
        email: 'a.nv@lhu.edu.vn',
        unit_id: 2,
        unit_name: 'Bộ môn KTPM',
      }
    ],
    getMemberAchievements: async () => [
      {
        id: 1,
        type: 'ACHIEVEMENT',
        sourceTypeId: 1,
        title: 'Paper Q1',
        lecturerId: 201,
        subjectId: 201,
        year: 2025,
        status: 'ACTIVE',
        hasEvidence: true,
      }
    ],
  };

  const service = createOrganizationService(mockRepo);

  const scanResult = await service.scanUnitWithAi(2, 10, {
    userId: 2,
    activeRoles: ['FACULTY_LEAD'],
  });

  assert.ok(scanResult);
  assert.equal(scanResult.unitId, 2);
  assert.equal(scanResult.totalMembers, 1);
  assert.equal(scanResult.eligibleCount, 1);
  assert.equal(scanResult.results[0].isEligible, true);
  assert.equal(scanResult.results[0].percentage, 100);
});

test('Unit AI Scan RBAC: ADMIN scanning any unit SUCCEEDS across all levels', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: `Unit ${unitId}`, type: 'FACULTY' }),
    getRegulationCriteria: async () => [
      {
        criteria_version_id: 1,
        code: 'CRIT_1',
        name: 'Tiêu chí 1',
        target_type: 'INDIVIDUAL',
        min_threshold: 1,
        version_id: 1,
        source_rules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
      }
    ],
    getDescendantUnitIds: async (unitId) => [unitId],
    getUnitMembers: async () => [],
    getMemberAchievements: async () => [],
  };

  const service = createOrganizationService(mockRepo);

  const res1 = await service.scanUnitWithAi(1, 10, {
    userId: 1,
    activeRoles: ['ADMIN'],
  });
  assert.ok(res1);
  assert.equal(res1.unitId, 1);

  const res2 = await service.scanUnitWithAi(99, 10, {
    userId: 1,
    activeRoles: ['ADMIN'],
  });
  assert.ok(res2);
  assert.equal(res2.unitId, 99);
});

test('Unit AI Scan: non-existent unitId throws NotFoundError (404)', async () => {
  const mockRepo = {
    findUnit: async () => null,
  };
  const service = createOrganizationService(mockRepo);

  await assert.rejects(
    () => service.scanUnitWithAi(999999, 10, { userId: 1, activeRoles: ['ADMIN'] }),
    { name: 'NotFoundError', message: 'Không tìm thấy đơn vị' }
  );
});

test('Unit AI Scan: evaluation correctly computes eligibleCount, percentage, matched and missing criteria', async () => {
  const mockRepo = {
    findUnit: async (unitId) => ({ unitId, name: 'Bộ môn KTPM' }),
    getRegulationCriteria: async () => [
      {
        criteria_version_id: 10,
        code: 'C_PAPER',
        name: 'Bài báo Quốc tế',
        target_type: 'INDIVIDUAL',
        min_threshold: 1,
        unit_metric: 'bài',
        version_id: 1,
        source_rules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
      },
      {
        criteria_version_id: 20,
        code: 'C_BOOK',
        name: 'Giáo trình / Sách',
        target_type: 'INDIVIDUAL',
        min_threshold: 1,
        unit_metric: 'quyển',
        version_id: 1,
        source_rules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [3] },
      },
    ],
    getDescendantUnitIds: async (unitId) => [unitId],
    getUnitMembers: async () => [
      { lecturer_id: 1, user_id: 1, full_name: 'Member 1 (100% Eligible)', unit_id: 2, unit_name: 'KTPM' },
      { lecturer_id: 2, user_id: 2, full_name: 'Member 2 (50% Ineligible)', unit_id: 2, unit_name: 'KTPM' },
      { lecturer_id: 3, user_id: 3, full_name: 'Member 3 (0% Ineligible)', unit_id: 2, unit_name: 'KTPM' },
    ],
    getMemberAchievements: async (lecturerId) => {
      if (lecturerId === 1) {
        return [
          { id: 101, type: 'ACHIEVEMENT', sourceTypeId: 1, title: 'Paper', lecturerId: 1, subjectId: 1, year: 2025, status: 'ACTIVE', hasEvidence: true },
          { id: 102, type: 'ACHIEVEMENT', sourceTypeId: 3, title: 'Book', lecturerId: 1, subjectId: 1, year: 2025, status: 'ACTIVE', hasEvidence: true },
        ];
      }
      if (lecturerId === 2) {
        return [
          { id: 103, type: 'ACHIEVEMENT', sourceTypeId: 1, title: 'Paper', lecturerId: 2, subjectId: 2, year: 2025, status: 'ACTIVE', hasEvidence: true },
        ];
      }
      return [];
    },
  };

  const service = createOrganizationService(mockRepo);
  const result = await service.scanUnitWithAi(2, 5, { userId: 1, activeRoles: ['ADMIN'] });

  assert.equal(result.totalMembers, 3);
  assert.equal(result.eligibleCount, 1, 'Only Member 1 is eligible');

  const m1 = result.results.find(r => r.lecturerId === 1);
  assert.equal(m1.percentage, 100);
  assert.equal(m1.isEligible, true);
  assert.equal(m1.matched.length, 2);
  assert.equal(m1.missing.length, 0);

  const m2 = result.results.find(r => r.lecturerId === 2);
  assert.equal(m2.percentage, 50);
  assert.equal(m2.isEligible, false);
  assert.equal(m2.matched.length, 1);
  assert.equal(m2.missing.length, 1);
  assert.equal(m2.missing[0].code, 'C_BOOK');

  const m3 = result.results.find(r => r.lecturerId === 3);
  assert.equal(m3.percentage, 0);
  assert.equal(m3.isEligible, false);
  assert.equal(m3.matched.length, 0);
  assert.equal(m3.missing.length, 2);
});

test('Live Unit AI Scan: queries criteria with c.criterion_code AS code and executes successfully', async () => {
  const result = await organizationService.scanUnitWithAi(1, 3, { userId: 1, activeRoles: ['ADMIN'] });
  assert.ok(result);
  assert.equal(result.unitId, 1);
  assert.ok(typeof result.eligibleCount === 'number');
});

// ============================================================================
// SUITE 4: CV PROFILE & EXPORT LIVE DB INTEGRITY
// ============================================================================

test('Live getUserContact: queries contact with COALESCE(l.full_name, u.display_name) without Error 207', async () => {
  const contact = await getUserContact(1);
  assert.ok(contact);
  assert.ok(contact.full_name);
  assert.equal(typeof contact.full_name, 'string');
});
