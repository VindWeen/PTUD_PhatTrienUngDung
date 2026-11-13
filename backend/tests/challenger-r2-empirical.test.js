/**
 * Challenger Round 2 Empirical Test Suite (Milestone 3)
 * Adversarial stress testing for:
 * 1. Strict Gregorian Date Validation & Silent Rollover Prevention (Calendar & KPI)
 * 2. Calendar Transaction Atomicity (Prevention of Orphan Personal Events on Failure)
 * 3. KPI Date Inversion (periodEnd < periodStart at item & root levels)
 * 4. Unit AI Scan Role-Based Access Control (MEMBER blocked, DEPT_HEAD/FACULTY_LEAD/ADMIN authorized)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { isValidCalendarDate, createReminderSchema, calendarService } from '../src/modules/calendar/calendarService.js';
import { aiGapCriterionSchema, fromAiGapSchema } from '../src/modules/kpi/kpiSchemas.js';
import * as kpiRepo from '../src/modules/kpi/kpiRepository.js';
import { createOrganizationService } from '../src/modules/organizations/organizationService.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../src/utils/errors.js';
import { connectDB, closeDB, setPool } from '../src/config/database.js';

test.after(async () => {
  await closeDB().catch(() => {});
});

// Helper for live SQL server rollback fixture
async function rollbackFixture(pool, work) {
  const client = await pool.connect();
  await client.query('BEGIN');
  let pending = Promise.resolve();
  const run = (text, params = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)(?: TRANSACTION)?$/i.test(text.trim())) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    const result = pending.then(() => client.query(text, params)).catch(error => {
      error.integrationSql = text;
      throw error;
    });
    pending = result.catch(() => {});
    return result;
  };
  const sharedClient = { query: run, release: async () => {} };
  const sharedPool = { query: run, ready: async () => sharedPool, connect: async () => sharedClient };
  setPool(sharedPool);
  try {
    return await work(sharedClient);
  } finally {
    await pending;
    await client.query('ROLLBACK');
    await client.release();
    setPool(pool);
  }
}

// ============================================================================
// MISSION 1: INVALID DATE HANDLING & SILENT ROLLOVER PREVENTION
// ============================================================================
test('Empirical Challenger: Calendar Strict Date Validation & Rollover Prevention', async (t) => {
  await t.test('Rejects non-existent dates in leap and non-leap years without rollover', () => {
    // 2026 is non-leap
    assert.equal(isValidCalendarDate('2026-02-29'), false, 'Feb 29 in non-leap year (2026) must be false');
    assert.equal(isValidCalendarDate('2026-02-30'), false, 'Feb 30 must be false (no rollover to March 2)');
    assert.equal(isValidCalendarDate('2026-02-31'), false, 'Feb 31 must be false (no rollover to March 3)');

    // 30-day months cannot have day 31
    assert.equal(isValidCalendarDate('2026-04-31'), false, 'April 31 must be false (no rollover to May 1)');
    assert.equal(isValidCalendarDate('2026-06-31'), false, 'June 31 must be false (no rollover to July 1)');
    assert.equal(isValidCalendarDate('2026-09-31'), false, 'Sept 31 must be false (no rollover to Oct 1)');
    assert.equal(isValidCalendarDate('2026-11-31'), false, 'Nov 31 must be false (no rollover to Dec 1)');

    // Out-of-bounds days and months
    assert.equal(isValidCalendarDate('2026-00-10'), false, 'Month 00 must be false');
    assert.equal(isValidCalendarDate('2026-13-10'), false, 'Month 13 must be false');
    assert.equal(isValidCalendarDate('2026-01-00'), false, 'Day 00 must be false');
    assert.equal(isValidCalendarDate('2026-01-32'), false, 'Day 32 must be false');

    // Year boundaries (1990 - 2100)
    assert.equal(isValidCalendarDate('1989-12-31'), false, 'Year 1989 (< 1990) must be false');
    assert.equal(isValidCalendarDate('1990-01-01'), true, 'Year 1990 (Min) must be true');
    assert.equal(isValidCalendarDate('2100-12-31'), true, 'Year 2100 (Max) must be true');
    assert.equal(isValidCalendarDate('2101-01-01'), false, 'Year 2101 (> 2100) must be false');

    // Genuine leap years
    assert.equal(isValidCalendarDate('2024-02-29'), true, 'Feb 29 in leap year (2024) must be true');
    assert.equal(isValidCalendarDate('2028-02-29'), true, 'Feb 29 in leap year (2028) must be true');
    assert.equal(isValidCalendarDate('2000-02-29'), true, 'Feb 29 in 400-year leap (2000) must be true');
    assert.equal(isValidCalendarDate('1900-02-29'), false, 'Feb 29 in 100-year non-leap (1900) must be false (and < 1990)');
  });

  await t.test('Rejects invalid date strings with ISO timestamps and offsets', () => {
    assert.equal(isValidCalendarDate('2026-02-29T10:00:00Z'), false, 'Feb 29 ISO timestamp in non-leap year must be false');
    assert.equal(isValidCalendarDate('2026-02-30T14:30:00+07:00'), false, 'Feb 30 ISO timestamp must be false');
    assert.equal(isValidCalendarDate('2026-04-31T23:59:59Z'), false, 'April 31 ISO timestamp must be false');
    assert.equal(isValidCalendarDate('2024-02-29T10:00:00Z'), true, 'Valid leap ISO timestamp must be true');
  });

  await t.test('createReminderSchema rejects invalid dates with informative validation error', () => {
    const invalidDates = [
      '2026-02-30',
      '2026-02-29',
      '2026-04-31',
      '2026-06-31',
      '2026-09-31',
      '2026-11-31',
      '1989-12-31',
      '2101-01-01',
      'not-a-date',
      '2026/02/28',
      '2026-02-28; DROP TABLE',
    ];

    for (const d of invalidDates) {
      const res = createReminderSchema.safeParse({
        title: 'Hạn nộp hồ sơ thi đua',
        deadlineDate: d,
      });
      assert.equal(res.success, false, `Expected deadlineDate "${d}" to fail schema validation`);
    }

    const validDates = [
      '2026-02-28',
      '2024-02-29',
      '2026-04-30',
      '2026-12-31',
      '2026-11-20T09:00:00Z',
    ];

    for (const d of validDates) {
      const res = createReminderSchema.safeParse({
        title: 'Hạn nộp hợp lệ',
        deadlineDate: d,
      });
      assert.equal(res.success, true, `Expected deadlineDate "${d}" to pass schema validation`);
    }
  });
});

test('Empirical Challenger: KPI Schema Strict Date Validation', async (t) => {
  await t.test('Rejects impossible dates in KPI root and item periodStart/periodEnd', () => {
    const invalidDates = ['2026-02-29', '2026-02-30', '2026-04-31', '2026-11-31', '1989-12-31', '2101-01-01'];

    for (const badDate of invalidDates) {
      // Root level periodStart
      assert.equal(
        fromAiGapSchema.safeParse({
          regulationId: 1,
          periodStart: badDate,
          periodEnd: '2026-12-31',
          missingCriteria: [{ code: 'C1', name: 'Valid Title', missingCount: 1 }],
        }).success,
        false,
        `KPI root periodStart="${badDate}" must be rejected`
      );

      // Root level periodEnd
      assert.equal(
        fromAiGapSchema.safeParse({
          regulationId: 1,
          periodStart: '2026-01-01',
          periodEnd: badDate,
          missingCriteria: [{ code: 'C1', name: 'Valid Title', missingCount: 1 }],
        }).success,
        false,
        `KPI root periodEnd="${badDate}" must be rejected`
      );

      // Item level periodStart
      assert.equal(
        aiGapCriterionSchema.safeParse({
          code: 'C1',
          name: 'Valid Title',
          periodStart: badDate,
          periodEnd: '2026-12-31',
          missingCount: 1,
        }).success,
        false,
        `KPI item periodStart="${badDate}" must be rejected`
      );

      // Item level periodEnd
      assert.equal(
        aiGapCriterionSchema.safeParse({
          code: 'C1',
          name: 'Valid Title',
          periodStart: '2026-01-01',
          periodEnd: badDate,
          missingCount: 1,
        }).success,
        false,
        `KPI item periodEnd="${badDate}" must be rejected`
      );
    }
  });
});

// ============================================================================
// MISSION 2: CALENDAR TRANSACTION ATOMICITY VERIFICATION
// ============================================================================
test('Empirical Challenger: Calendar Transaction Atomicity under Reminder Failure', async (t) => {
  await t.test('Mock Transaction: Failure on reminder write causes rollback and zero orphan events', async () => {
    const mockDbEvents = new Map();
    const mockDbReminders = new Map();
    let currentEventId = 100;

    const atomicTxRunner = async (callback) => {
      // Snapshot state at transaction start
      const eventSnapshot = new Map(mockDbEvents);
      const reminderSnapshot = new Map(mockDbReminders);

      const txQuery = async (sql, params) => {
        if (sql.includes('INSERT INTO app.personal_calendar_events')) {
          const id = String(++currentEventId);
          const row = { id, event_id: currentEventId, title: params[1], user_id: params[0] };
          mockDbEvents.set(id, row);
          return { rows: [row] };
        }
        if (sql.includes('INSERT INTO app.calendar_reminders')) {
          // Simulate failure during reminder insertion
          throw new Error('SIMULATED_DB_ERROR_DUPLICATE_KEY_OR_TIMEOUT');
        }
        return { rows: [] };
      };

      try {
        return await callback({ query: txQuery });
      } catch (err) {
        // Transaction Rollback restores snapshot
        mockDbEvents.clear();
        for (const [k, v] of eventSnapshot) mockDbEvents.set(k, v);
        mockDbReminders.clear();
        for (const [k, v] of reminderSnapshot) mockDbReminders.set(k, v);
        throw err;
      }
    };

    const service = calendarService(null, atomicTxRunner);

    await assert.rejects(
      () => service.createReminder({ userId: 42 }, {
        title: 'Hạn nộp hồ sơ kiểm thử nguyên tử',
        deadlineDate: '2026-11-20',
      }),
      { message: 'SIMULATED_DB_ERROR_DUPLICATE_KEY_OR_TIMEOUT' }
    );

    // Verify empirical state of mock store: NO orphan personal event must exist
    assert.equal(mockDbEvents.size, 0, 'No orphan personal_calendar_events record should remain after rollback');
    assert.equal(mockDbReminders.size, 0, 'No calendar_reminders record should exist');
  });

  await t.test('Live SQL Server: Failure during reminder insertion leaves ZERO orphan personal events', async () => {
    const pool = await connectDB();

    await rollbackFixture(pool, async (client) => {
      const testTitle = `ATOMIC_TEST_${randomUUID()}`;

      // Verify baseline count for test title
      const beforeRes = await client.query(
        'SELECT COUNT(*) AS cnt FROM app.personal_calendar_events WHERE title = $1',
        [testTitle]
      );
      assert.equal(Number(beforeRes.rows[0].cnt), 0, 'Baseline: 0 records with test title');

      const failingTxRunner = async (cb) => {
        await client.query('SAVE TRANSACTION reminder_savepoint');
        try {
          await cb({
            query: async (sql, params) => {
              if (sql.includes('INSERT INTO app.calendar_reminders')) {
                throw new Error('FORCED_SIMULATED_FAILURE_ON_REMINDER_INSERT');
              }
              return client.query(sql, params);
            }
          });
        } catch (err) {
          await client.query('ROLLBACK TRANSACTION reminder_savepoint');
          throw err;
        }
      };

      const liveService = calendarService(client.query.bind(client), failingTxRunner);

      await assert.rejects(
        () => liveService.createReminder({ userId: 1 }, {
          title: testTitle,
          deadlineDate: '2026-11-30',
        }),
        { message: 'FORCED_SIMULATED_FAILURE_ON_REMINDER_INSERT' }
      );

      // Verify database state: personal event was completely rolled back
      const afterRes = await client.query(
        'SELECT COUNT(*) AS cnt FROM app.personal_calendar_events WHERE title = $1',
        [testTitle]
      );
      assert.equal(Number(afterRes.rows[0].cnt), 0, 'Database: exactly 0 orphan personal_calendar_events records remain');
    });
  });

  await t.test('Live SQL Server: Successful reminder creation commits both event and reminder atomically', async () => {
    const pool = await connectDB();

    await rollbackFixture(pool, async (client) => {
      const testTitle = `SUCCESS_REMINDER_${randomUUID()}`;

      const normalTxRunner = async (cb) => {
        await client.query('SAVE TRANSACTION reminder_ok_savepoint');
        try {
          return await cb({ query: client.query.bind(client) });
        } catch (err) {
          await client.query('ROLLBACK TRANSACTION reminder_ok_savepoint');
          throw err;
        }
      };

      const liveService = calendarService(client.query.bind(client), normalTxRunner);

      const result = await liveService.createReminder({ userId: 1 }, {
        title: testTitle,
        deadlineDate: '2026-12-20',
      });

      assert.ok(result.reminderId, 'Reminder ID should be generated');
      assert.ok(result.eventId, 'Personal event ID should be generated');

      // Verify both rows exist in DB
      const eventRes = await client.query(
        'SELECT event_id, title FROM app.personal_calendar_events WHERE event_id = $1',
        [result.eventId]
      );
      assert.equal(eventRes.rows.length, 1, 'Event record must exist in DB');

      const reminderRes = await client.query(
        'SELECT reminder_id, event_id, title FROM app.calendar_reminders WHERE reminder_id = $1',
        [result.reminderId]
      );
      assert.equal(reminderRes.rows.length, 1, 'Reminder record must exist in DB');
      assert.equal(String(reminderRes.rows[0].event_id), String(result.eventId), 'Reminder FK must match Event ID');
    });
  });
});

// ============================================================================
// MISSION 3: KPI DATE INVERSION (periodEnd < periodStart)
// ============================================================================
test('Empirical Challenger: KPI Date Inversion Rejection', async (t) => {
  await t.test('aiGapCriterionSchema strictly rejects periodEnd < periodStart at item level', () => {
    const invertedItems = [
      {
        code: 'PAPER_ISI',
        name: 'Bài báo ISI',
        periodStart: '2026-12-31',
        periodEnd: '2026-01-01',
        missingCount: 1,
      },
      {
        code: 'SCIENTIFIC_BOOK',
        name: 'Sách chuyên khảo',
        periodStart: '2026-06-02',
        periodEnd: '2026-06-01', // 1 day before start
        missingCount: 1,
      },
      {
        code: 'RESEARCH_PROJECT',
        name: 'Đề tài NCKH',
        periodStart: '2026-10-15',
        periodEnd: '2025-10-15', // 1 year before start
        missingCount: 2,
      },
    ];

    for (const item of invertedItems) {
      const res = aiGapCriterionSchema.safeParse(item);
      assert.equal(res.success, false, `Item with periodStart=${item.periodStart} and periodEnd=${item.periodEnd} must be rejected`);
      const errorMsg = res.error.issues[0]?.message;
      assert.equal(errorMsg, 'Kỳ kết thúc phải sau kỳ bắt đầu');
    }
  });

  await t.test('aiGapCriterionSchema permits valid and boundary dates at item level', () => {
    // Same day start and end is valid (1-day duration)
    const sameDay = aiGapCriterionSchema.safeParse({
      code: 'ONE_DAY_TASK',
      name: 'Nhiệm vụ 1 ngày',
      periodStart: '2026-06-15',
      periodEnd: '2026-06-15',
      missingCount: 1,
    });
    assert.equal(sameDay.success, true, 'periodStart === periodEnd should be accepted');

    // End after start
    const normal = aiGapCriterionSchema.safeParse({
      code: 'SEMESTER_TASK',
      name: 'Nhiệm vụ học kỳ',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      missingCount: 1,
    });
    assert.equal(normal.success, true, 'periodEnd > periodStart should be accepted');

    // Only periodStart specified
    const startOnly = aiGapCriterionSchema.safeParse({
      code: 'START_ONLY',
      name: 'Chỉ có ngày bắt đầu',
      periodStart: '2026-01-01',
      missingCount: 1,
    });
    assert.equal(startOnly.success, true, 'start-only should be accepted');

    // Only periodEnd specified
    const endOnly = aiGapCriterionSchema.safeParse({
      code: 'END_ONLY',
      name: 'Chỉ có ngày kết thúc',
      periodEnd: '2026-12-31',
      missingCount: 1,
    });
    assert.equal(endOnly.success, true, 'end-only should be accepted');
  });

  await t.test('fromAiGapSchema rejects multi-item payload if any item has inverted dates', () => {
    const payload = {
      regulationId: 1,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      missingCriteria: [
        { code: 'VALID_ITEM_1', name: 'Tiêu chí hợp lệ 1', missingCount: 1, periodStart: '2026-01-01', periodEnd: '2026-06-30' },
        { code: 'INVERTED_ITEM_2', name: 'Tiêu chí ngược ngày', missingCount: 2, periodStart: '2026-12-01', periodEnd: '2026-11-01' },
        { code: 'VALID_ITEM_3', name: 'Tiêu chí hợp lệ 3', missingCount: 1, periodStart: '2026-07-01', periodEnd: '2026-12-31' },
      ]
    };

    const res = fromAiGapSchema.safeParse(payload);
    assert.equal(res.success, false, 'Payload containing any inverted item must fail entirely');
  });
});

// ============================================================================
// MISSION 4: UNIT AI SCAN ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================================
test('Empirical Challenger: Unit AI Scan RBAC Enforcement', async (t) => {
  const dummyCriteria = [
    {
      criteria_version_id: 1,
      code: 'CRIT_1',
      name: 'Tiêu chí thi đua 1',
      target_type: 'INDIVIDUAL',
      min_threshold: 1,
      version_id: 1,
      source_rules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
    }
  ];

  const createMockRepo = () => ({
    findUnit: async (unitId) => ({
      unitId,
      name: unitId === 1 ? 'Trường LHU' : unitId === 2 ? 'Khoa CNTT' : unitId === 3 ? 'Bộ môn KTPM' : 'Khoa Dược',
      parentId: unitId === 3 ? 2 : unitId === 2 ? 1 : null,
      type: unitId === 1 ? 'UNIVERSITY' : unitId === 2 ? 'FACULTY' : 'DEPARTMENT',
    }),
    hasDescendant: async (parentUnitId, targetUnitId) => {
      // University (1) -> Faculty CNTT (2) -> Dept KTPM (3)
      if (parentUnitId === 1 && (targetUnitId === 2 || targetUnitId === 3)) return true;
      if (parentUnitId === 2 && targetUnitId === 3) return true;
      return false;
    },
    getRegulationCriteria: async () => dummyCriteria,
    getDescendantUnitIds: async (unitId) => [unitId],
    getUnitMembers: async () => [
      { lecturer_id: 10, user_id: 10, full_name: 'Giảng viên A', email: 'gv.a@lhu.edu.vn', unit_id: 3, unit_name: 'Bộ môn KTPM' }
    ],
    getMemberAchievements: async () => [],
  });

  await t.test('MEMBER role alone is unconditionally rejected with 403 ForbiddenError', async () => {
    const service = createOrganizationService(createMockRepo());

    // Single MEMBER role
    await assert.rejects(
      () => service.scanUnitWithAi(3, 1, { userId: 50, activeRoles: ['MEMBER'] }),
      { name: 'ForbiddenError', message: 'Yêu cầu một trong các vai trò: DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN' }
    );

    // Other non-authorized roles
    await assert.rejects(
      () => service.scanUnitWithAi(3, 1, { userId: 51, activeRoles: ['STUDENT'] }),
      { name: 'ForbiddenError' }
    );
    await assert.rejects(
      () => service.scanUnitWithAi(3, 1, { userId: 52, activeRoles: ['GUEST'] }),
      { name: 'ForbiddenError' }
    );
    await assert.rejects(
      () => service.scanUnitWithAi(3, 1, { userId: 53, activeRoles: [] }),
      { name: 'ForbiddenError' }
    );
  });

  await t.test('DEPARTMENT_HEAD is restricted to own department only', async () => {
    const service = createOrganizationService(createMockRepo());

    // Department Head assigned to unit 3 (Bộ môn KTPM)
    // Note: getLecturerProfile mock or user profile check
    // When getLecturerProfile is called, we test scanning wrong unit
    await assert.rejects(
      () => service.scanUnitWithAi(2, 1, { userId: 20, activeRoles: ['DEPARTMENT_HEAD'] }),
      { name: 'ForbiddenError' }
    );

    await assert.rejects(
      () => service.scanUnitWithAi(4, 1, { userId: 20, activeRoles: ['DEPARTMENT_HEAD'] }),
      { name: 'ForbiddenError' }
    );
  });

  await t.test('FACULTY_LEAD cannot scan outside their faculty hierarchy', async () => {
    const service = createOrganizationService(createMockRepo());

    // Faculty Lead trying to scan an unrelated faculty (e.g. Unit 4: Khoa Dược when assigned to Unit 2)
    await assert.rejects(
      () => service.scanUnitWithAi(4, 1, { userId: 2, activeRoles: ['FACULTY_LEAD'] }),
      { name: 'ForbiddenError' }
    );
  });

  await t.test('ADMIN role has unrestricted authorization across all unit levels', async () => {
    const service = createOrganizationService(createMockRepo());
    const adminUser = { userId: 1, activeRoles: ['ADMIN'] };

    // Root university
    const resUniv = await service.scanUnitWithAi(1, 1, adminUser);
    assert.equal(resUniv.unitId, 1);
    assert.ok(Array.isArray(resUniv.results));

    // Faculty level
    const resFaculty = await service.scanUnitWithAi(2, 1, adminUser);
    assert.equal(resFaculty.unitId, 2);

    // Department level
    const resDept = await service.scanUnitWithAi(3, 1, adminUser);
    assert.equal(resDept.unitId, 3);
  });

  await t.test('Multi-role user with MEMBER + ADMIN is authorized through highest privilege', async () => {
    const service = createOrganizationService(createMockRepo());
    const multiRoleUser = { userId: 99, activeRoles: ['MEMBER', 'ADMIN'] };

    const res = await service.scanUnitWithAi(3, 1, multiRoleUser);
    assert.ok(res);
    assert.equal(res.unitId, 3);
  });
});
