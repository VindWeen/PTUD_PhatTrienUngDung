# Milestone 3 Iteration 2 Investigation & Remediation Report: Calendar Atomicity, Date Validation & Live DB Integration Tests

**Date**: 2026-11-12T22:50:00Z  
**Agent**: `teamwork_explorer_r2_3` (Explorer 3: Calendar Atomicity, Date Validation & Live DB Integration Tests)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_3`  
**Recipient**: Parent Orchestrator (`c4f8ee2a-a6b8-4150-930d-200ed34209c4`)  
**Verdict**: 🛠️ **REMEDIATION_READY**

---

## 1. Observation

Adversarial review and empirical stress testing of Milestone 3 identified four key deficiencies across calendar management, schema validation, and test fidelity:

### 1.1 Dual-Table Non-Atomic Writes in `calendarService.js`
- **Location**: `backend/src/modules/calendar/calendarService.js:109-141`
- **Observed Behavior**:
  `createReminder` executes two distinct SQL queries sequentially using the injected `run` function (which defaults to `query` in `backend/src/utils/dbHelper.js`):
  ```javascript
  const eventRes = await run(`INSERT INTO app.personal_calendar_events ...`);
  ...
  const reminderRes = await run(`INSERT INTO app.calendar_reminders ...`);
  ```
- **Consequence**:
  Because each `query()` call checks out a pooled connection in autocommit mode, the first insert commits immediately. When the second query fails (e.g. transient network disconnect, deadlocks, foreign key check failure, or schema constraint violation), the transaction is NOT rolled back.
- **Empirical Proof**:
  Executing `calendarService.createReminder` with simulated reminder table failure demonstrated that `app.personal_calendar_events` count increased by 1 and remained committed, leaving an orphan personal calendar event with no linked reminder.

---

### 1.2 Silent Calendar Date Rollover (e.g. `2026-02-30`) in `calendarService.js`
- **Location**: `backend/src/modules/calendar/calendarService.js:26-29`
- **Observed Code**:
  ```javascript
  export const createReminderSchema = z.object({
    title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
    deadlineDate: z.string().refine(val => {
      const d = new Date(val);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1990 && d.getUTCFullYear() <= 2100;
    }, 'Hạn nộp không hợp lệ (phải từ năm 1990 đến 2100)'),
  ```
- **Live Empirical Demonstration**:
  - Command:
    ```powershell
    node -e "import('./backend/src/modules/calendar/calendarService.js').then(async m => { const service = m.calendarService(); const res = await service.createReminder({ userId: 1 }, { title: 'Test 2026-02-30', deadlineDate: '2026-02-30' }); console.log('CREATED SILENTLY:', res); })"
    ```
  - Result:
    The non-existent date `2026-02-30` passed Zod validation without error.
  - Database Inspection:
    ```json
    {
      "event_id": 10,
      "starts_at": "2026-03-02T09:00:00.000Z",
      "ends_at": "2026-03-02T10:00:00.000Z"
    }
    ```
    JavaScript's permissive `Date` constructor silently rolled over February 30 to March 2, mutating the user's intended deadline by 2 days in the database.

---

### 1.3 Inverted Item-Level Date Bypass in `kpiSchemas.js`
- **Location**: `backend/src/modules/kpi/kpiSchemas.js:81-106`
- **Observed Code**:
  `fromAiGapSchema` applies `.refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart)` only at the root object level. `aiGapCriterionSchema` does NOT contain date ordering validation.
- **Empirical Demonstration**:
  - Code:
    ```javascript
    fromAiGapSchema.safeParse({
      regulationId: 1,
      missingCriteria: [
        { code: 'ISI_Q1', name: 'Paper', periodStart: '2026-12-31', periodEnd: '2026-01-01', missingCount: 1 }
      ]
    });
    ```
  - Result: `success: true`.
  - Impact: The API bypasses input validation with HTTP 200/201 and crashes downstream at the database level when `INSERT INTO app.kpi_goals` triggers the SQL Server check constraint `ck_kpi_goals_period CHECK (period_end >= period_start)` with an unhandled 500 error.

---

### 1.4 Test Mock Blind Spot & SQL Column Schema Mismatches
- **Location**:
  - `backend/tests/cv-slug-docx.test.js` (lines 36, 65, 119, 133, 154, 200)
  - `backend/tests/unit-ai-scan.test.js` (lines 11, 24, 41, 62)
- **Observed Behavior**:
  Both test suites constructed in-memory mock repositories (`createCvService(mockRepo)`, `createOrganizationService(mockRepo)`). Real SQL queries were never executed against the live Microsoft SQL Server database.
- **Live Database Crash Verifications**:
  1. `cvRepository.getUserContact(1)` -> `RequestError: Invalid column name 'full_name'`. (`app.users` has `display_name`, not `full_name`).
  2. `cvRepository.getUserActiveAchievements(1)` -> `RequestError: Invalid column name 'issuing_authority'`. (`app.achievements` has no `issuing_authority` or `decision_number`).
  3. `organizationRepository.getRegulationCriteria(1)` -> `RequestError: Invalid column name 'code'`. (`app.award_criteria_versions` column is `criterion_code`).
  4. `kpiRepository.subject(client, 5)` auto-provisioning -> `RequestError: Invalid column name 'full_name'`.

---

## 2. Logic Chain

1. **Root Cause of Mock Test Blind Spot**:
   Unit tests that mock the persistence layer test only business logic dispatch; they cannot detect SQL syntax errors, invalid column identifiers, or database constraint mismatches. To guarantee production reliability, genuine integration tests running real queries against the SQL Server instance are mandatory.
2. **Transaction Isolation Requirement**:
   In `calendarService.js`, inserting a personal event and a calendar reminder constitutes a single logical unit of work. If the second step fails, the first step must be rolled back. Leveraging the existing `withTransaction` utility from `backend/src/utils/dbHelper.js` provides automatic `BEGIN ... COMMIT / ROLLBACK` lifecycle management while maintaining dependency injection compatibility for unit tests.
3. **Date Rollover Mechanics**:
   `new Date('YYYY-MM-DD')` standardizes out-of-range days (e.g. day 30 in February) by calculating day offsets from the start of the month, resulting in a silent rollover to the next month. A strict calendar validator must compare the extracted year, month, and day against the UTC representation of the reconstructed `Date` object:
   ```javascript
   utcDate.getUTCFullYear() === year &&
   utcDate.getUTCMonth() === month - 1 &&
   utcDate.getUTCDate() === day
   ```
   If any component differs, the calendar date does not exist (e.g., Feb 30, April 31, or Feb 29 on non-leap years) and must be rejected immediately.
4. **Hierarchical Schema Refinement**:
   In Zod schemas with nested arrays (`missingCriteria: z.array(aiGapCriterionSchema)`), constraints on array element properties must be defined directly on the item schema (`aiGapCriterionSchema.refine(...)`), otherwise nested invalid fields escape root-level refinement.

---

## 3. Caveats

1. **Live Test Concurrency**:
   Microsoft SQL Server connections via the tedious driver allow only one active request per connection. Integration tests running transactions must either serialize queries sequentially or use separate connection instances from the pool. The existing `rollbackFixture` pattern in `tests/sqlserver-core.integration.js` handles this via a chained promise queue.
2. **Database State Cleanliness**:
   All integration tests must execute inside rolled-back transactions (`BEGIN ... ROLLBACK`) so no test fixtures persist after the test run completes.

---

## 4. Conclusion & Concrete Remediation Plan

The following concrete remediation steps provide an airtight solution for Worker implementation:

### 4.1 Calendar Atomicity & Transaction Support (`calendarService.js`)
Refactor `calendarService` to accept an optional `txRunner` parameter that defaults to `withTransaction` in production when `run === query`:

```javascript
// backend/src/modules/calendar/calendarService.js
import { z } from 'zod';
import { query, withTransaction } from '../../utils/dbHelper.js';
import { ConcurrencyConflictError, NotFoundError } from '../../utils/errors.js';

export function calendarService(run = query, txRunner = null) {
  // If run is default query, use real DB withTransaction.
  // If run is custom/mocked in unit tests without txRunner, execute callback inline with run.
  const executeTx = txRunner || (run === query ? withTransaction : async (cb) => cb({ query: run, client: null }));

  return {
    // ... existing list, listSystem, create, update, remove methods ...

    async createReminder(user, raw) {
      const e = createReminderSchema.parse(raw);

      return executeTx(async ({ query: txQuery }) => {
        if (e.regulationId) {
          const reg = (await txQuery('SELECT document_id, title FROM app.regulation_documents WHERE document_id = $1', [e.regulationId])).rows[0];
          if (!reg) throw new NotFoundError('Không tìm thấy quy chế');
        }
        if (e.awardPeriodId) {
          const ap = (await txQuery('SELECT award_period_id, name FROM app.award_periods WHERE award_period_id = $1', [e.awardPeriodId])).rows[0];
          if (!ap) throw new NotFoundError('Không tìm thấy kỳ khen thưởng');
        }
        if (e.kpiGoalId) {
          const kg = (await txQuery('SELECT goal_id, title FROM app.kpi_goals WHERE goal_id = $1', [e.kpiGoalId])).rows[0];
          if (!kg) throw new NotFoundError('Không tìm thấy mục tiêu KPI');
        }

        let startsAt;
        let endsAt;
        if (e.deadlineDate.includes('T')) {
          startsAt = e.deadlineDate.slice(0, 16);
          endsAt = e.deadlineDate.slice(0, 16);
        } else {
          startsAt = `${e.deadlineDate}T09:00`;
          endsAt = `${e.deadlineDate}T10:00`;
        }

        const eventRes = await txQuery(
          `INSERT INTO app.personal_calendar_events
            (user_id, title, description, location, category, starts_at, ends_at, all_day, completed)
            OUTPUT ${outputProjection}
            VALUES ($1, $2, $3, $4, 'task', $5, $6, 0, 0)`,
          [
            user.userId,
            e.title.slice(0, 160),
            e.description || `Nhắc nhở hạn nộp: ${e.title}`,
            '',
            new Date(`${startsAt}:00Z`),
            new Date(`${endsAt}:00Z`),
          ]
        );
        const eventRow = eventRes.rows[0];
        const eventId = eventRow ? (eventRow.id || eventRow.event_id) : null;

        const reminderRes = await txQuery(
          `INSERT INTO app.calendar_reminders
            (user_id, title, deadline_date, regulation_id, award_period_id, kpi_goal_id, event_id, is_completed)
            OUTPUT INSERTED.reminder_id, INSERTED.created_at
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
          [
            user.userId,
            e.title,
            new Date(e.deadlineDate.includes('T') ? e.deadlineDate : `${e.deadlineDate}T00:00:00Z`),
            e.regulationId || null,
            e.awardPeriodId || null,
            e.kpiGoalId || null,
            eventId,
          ]
        );
        const reminderRow = reminderRes.rows[0] || {};

        return {
          reminderId: reminderRow.reminder_id,
          eventId,
          title: e.title,
          deadlineDate: e.deadlineDate,
          regulationId: e.regulationId || null,
          awardPeriodId: e.awardPeriodId || null,
          kpiGoalId: e.kpiGoalId || null,
          createdAt: reminderRow.created_at,
        };
      });
    },

    // ... existing listReminders, missing methods ...
  };
}
```

---

### 4.2 Strict Calendar Day Validation (`calendarService.js`)
Implement `isValidCalendarDate` and update `createReminderSchema`:

```javascript
// backend/src/modules/calendar/calendarService.js
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function isValidCalendarDate(val) {
  if (typeof val !== 'string') return false;
  const match = val.match(ISO_DATE_PATTERN);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Strict calendar day validation via UTC round-trip
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return false;
  }

  // Ensure full string parses to a finite date
  const parsed = new Date(val.includes('T') ? val : `${val}T00:00:00Z`);
  return Number.isFinite(parsed.getTime());
}

export const createReminderSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
  deadlineDate: z.string().refine(isValidCalendarDate, 'Hạn nộp không tồn tại hoặc ngoài khoảng 1990–2100'),
  regulationId: idSchema.optional().nullable(),
  awardPeriodId: idSchema.optional().nullable(),
  kpiGoalId: idSchema.optional().nullable(),
  description: z.string().trim().max(4000).optional(),
}).strict();
```

---

### 4.3 Item-Level Date Ordering in `kpiSchemas.js`
Update `aiGapCriterionSchema` to validate that `periodEnd >= periodStart`:

```javascript
// backend/src/modules/kpi/kpiSchemas.js lines 81-91
export const aiGapCriterionSchema = z
  .object({
    code: text(80).transform((v) => v.toUpperCase()),
    name: text(255),
    missingCount: z.coerce.number().finite().min(0).default(1),
    unit: z.string().trim().max(80).optional().default("tiêu chí"),
    periodStart: date.optional(),
    periodEnd: date.optional(),
    plan: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine(
    (v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart,
    "Kỳ kết thúc phải sau kỳ bắt đầu",
  );
```

---

### 4.4 Repository SQL Schema Mismatch Fixes
These fixes are required for live database operations to succeed:

1. **`backend/src/modules/cv/cvRepository.js:124`**:
   Replace `COALESCE(u.full_name, u.display_name)` with `COALESCE(l.full_name, u.display_name)`:
   ```sql
   SELECT u.user_id, u.display_name, COALESCE(l.full_name, u.display_name) AS full_name, u.email,
          l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone,
          ou.name AS unit_name
   FROM app.users u
   LEFT JOIN app.lecturers l ON l.user_id = u.user_id AND l.is_active = 1
   LEFT JOIN app.lecturer_assignments la ON la.lecturer_id = l.lecturer_id AND la.is_primary = 1
   LEFT JOIN app.organization_units ou ON ou.unit_id = la.unit_id
   WHERE u.user_id = $1
   ```

2. **`backend/src/modules/cv/cvRepository.js:103-104`**:
   Remove non-existent columns `decision_number` and `issuing_authority` (or supply `NULL AS ...`), and check valid active status:
   ```sql
   SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
          NULL AS decision_number, NULL AS issuing_authority, at.name AS achievement_type_name
   FROM app.achievements a
   LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
   WHERE (a.created_by = $1 OR a.lecturer_id = (SELECT TOP 1 lecturer_id FROM app.lecturers WHERE user_id = $1))
     AND a.status IN ('ACTIVE', 'VERIFIED')
     AND a.deleted_at IS NULL
   ORDER BY a.recognition_year DESC, a.achievement_id DESC
   ```

3. **`backend/src/modules/organizations/organizationRepository.js:171 & 184`**:
   Change `c.code` to `c.criterion_code AS code`:
   ```sql
   SELECT c.criteria_version_id, c.criterion_code AS code, c.name, c.target_type,
          c.min_threshold, c.unit_metric, c.is_confirmed,
          c.source_rules, c.source_rules_revision,
          v.version_id, v.version_number
   FROM app.award_criteria_versions c
   JOIN app.regulation_document_versions v ON v.version_id = c.version_id
   WHERE v.document_id = $1 AND v.is_confirmed = 1
   ORDER BY c.criteria_version_id ASC
   ```

4. **`backend/src/modules/kpi/kpiRepository.js:27`**:
   Select `display_name` from `app.users`:
   ```javascript
   const userRes = await client.query(
     `SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = $1`,
     [userId],
   );
   ```

---

### 4.5 Live Database Integration Test Suite Design (`tests/sqlserver-m3.integration.js`)
Create a dedicated live SQL Server integration test suite `backend/tests/sqlserver-m3.integration.js` covering all 4 Milestone 3 endpoints using real queries inside rolled-back transactions:

```javascript
/**
 * Live Microsoft SQL Server Integration Suite for Milestone 3
 * Tests real SQL queries, atomicity, date validation, and repository joins.
 * Uses rollbackFixture to ensure 100% database isolation with zero residue.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import PizZip from 'pizzip';

import { connectDB, closeDB, setPool } from '../src/config/database.js';
import { calendarService, createReminderSchema } from '../src/modules/calendar/calendarService.js';
import * as cvRepository from '../src/modules/cv/cvRepository.js';
import { createCvService } from '../src/modules/cv/cvService.js';
import organizationRepository from '../src/modules/organizations/organizationRepository.js';
import organizationService from '../src/modules/organizations/organizationService.js';
import * as kpiRepo from '../src/modules/kpi/kpiRepository.js';
import { fromAiGapSchema } from '../src/modules/kpi/kpiSchemas.js';
import { createFromAiGap } from '../src/modules/kpi/kpiService.js';

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

test('SQL Server: Milestone 3 Live Database Integration (rolled back)', { timeout: 60000 }, async (t) => {
  const pool = await connectDB();

  await t.test('1. CV Module: Live SQL queries and DOCX export', async () => {
    await rollbackFixture(pool, async (client) => {
      // 1.1 Live getUserContact
      const contact = await cvRepository.getUserContact(1, client);
      assert.ok(contact, 'Contact record must exist for user 1');
      assert.ok(contact.full_name, 'Full name must not be empty');
      assert.equal(typeof contact.full_name, 'string');

      // 1.2 Live getUserActiveAchievements
      const achievements = await cvRepository.getUserActiveAchievements(1, null, client);
      assert.ok(Array.isArray(achievements), 'Achievements must return an array');

      // 1.3 End-to-end DOCX export with live repositories
      const service = createCvService(cvRepository);
      const { buffer, filename } = await service.exportCvDocx(1);
      assert.ok(buffer instanceof Buffer);
      assert.ok(filename.endsWith('.docx'));
      assert.equal(buffer.slice(0, 4).toString('hex'), '504b0304', 'Valid OpenXML PK zip header');
    });
  });

  await t.test('2. Unit AI Scan: Live Criteria & RBAC scan', async () => {
    await rollbackFixture(pool, async (client) => {
      // 2.1 Live getRegulationCriteria with c.criterion_code AS code
      const criteria = await organizationRepository.getRegulationCriteria(1, client);
      assert.ok(Array.isArray(criteria), 'Criteria list must be an array');
      if (criteria.length > 0) {
        assert.ok(criteria[0].code, 'Criterion code alias must be populated');
      }

      // 2.2 End-to-end live scanUnitWithAi as ADMIN
      const adminUser = { userId: 1, activeRoles: ['ADMIN'] };
      const result = await organizationService.scanUnitWithAi(1, 1, adminUser);
      assert.ok(result, 'Scan result must be returned');
      assert.equal(result.unitId, 1);
      assert.ok(typeof result.eligibleCount === 'number');
      assert.ok(typeof result.percentage === 'number');
    });
  });

  await t.test('3. KPI Bridge: Live Subject Auto-Provisioning & Item-Level Validation', async () => {
    await rollbackFixture(pool, async (client) => {
      // 3.1 Item-level inverted date validation in schema
      const invalidPayload = {
        regulationId: 1,
        missingCriteria: [
          { code: 'ISI', name: 'Paper', periodStart: '2026-12-31', periodEnd: '2026-01-01', missingCount: 1 }
        ]
      };
      assert.equal(fromAiGapSchema.safeParse(invalidPayload).success, false, 'Must reject inverted item dates');

      // 3.2 Live auto-provisioning for user without lecturer record
      const uniqueCode = `USR_TEST_${randomUUID().slice(0, 8)}`;
      const newUser = (await client.query(
        `INSERT INTO app.users (username, email, password_hash, display_name)
         OUTPUT INSERTED.user_id
         VALUES ($1, $2, 'hash123', N'Giảng viên Mới Test')`,
        [uniqueCode, `${uniqueCode}@lhu.edu.vn`]
      )).rows[0];

      const lecturer = await kpiRepo.subject(client, newUser.user_id, 'LECTURER');
      assert.ok(lecturer, 'Auto-provisioned lecturer record must be returned');
      assert.equal(Number(lecturer.user_id), Number(newUser.user_id));
    });
  });

  await t.test('4. Calendar: Strict Rollover Prevention & Atomic Transaction Rollback', async () => {
    // 4.1 Strict calendar date validation
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-02-30' }).success, false);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-02-29' }).success, false);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2028-02-29' }).success, true);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-04-30' }).success, true);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-04-31' }).success, false);

    // 4.2 Atomicity: failure during reminder insertion rolls back personal_calendar_events
    await rollbackFixture(pool, async (client) => {
      const initialCount = (await client.query(
        'SELECT COUNT(*) AS cnt FROM app.personal_calendar_events WHERE user_id = 1'
      )).rows[0].cnt;

      const failingTxRunner = async (cb) => {
        // Run first insert normally, fail on second
        await cb({
          query: async (sql, params) => {
            if (sql.includes('INSERT INTO app.calendar_reminders')) {
              throw new Error('SIMULATED_TRANSACTION_FAILURE');
            }
            return client.query(sql, params);
          }
        });
      };

      const testService = calendarService(client.query.bind(client), failingTxRunner);

      await assert.rejects(
        () => testService.createReminder({ userId: 1 }, { title: 'Test Atomicity', deadlineDate: '2026-12-15' }),
        { message: 'SIMULATED_TRANSACTION_FAILURE' }
      );

      const afterCount = (await client.query(
        'SELECT COUNT(*) AS cnt FROM app.personal_calendar_events WHERE user_id = 1'
      )).rows[0].cnt;

      assert.equal(afterCount, initialCount, 'No orphan personal_calendar_events record must remain');
    });
  });
});
```

---

## 5. Verification Method

Once Worker implements the remediation plan, verify completely via the following test suite commands:

```powershell
# 1. Run the comprehensive adversarial suite (re-validates all edge cases and defects):
node --test backend/tests/challenger-m3-adversarial.test.js
node --test backend/tests/challenger-m3-cv-adversarial.test.js

# 2. Run the dedicated M3 live SQL Server integration suite:
node --test backend/tests/sqlserver-m3.integration.js

# 3. Verify calendar unit tests:
node --test backend/tests/calendar-reminder.test.js

# 4. Verify live DB execution directly via Node:
# 4.1 CV contact retrieval:
node -e "import('./backend/src/modules/cv/cvRepository.js').then(async m => { const r = await m.getUserContact(1); console.log('PASS contact:', r.full_name); process.exit(0); })"

# 4.2 Unit AI scan:
node -e "import('./backend/src/modules/organizations/organizationService.js').then(async m => { const r = await m.default.scanUnitWithAi(1, 1, { userId: 1, activeRoles: ['ADMIN'] }); console.log('PASS scan eligibleCount:', r.eligibleCount); process.exit(0); })"

# 4.3 KPI auto-provisioning:
node -e "import('./backend/src/utils/dbHelper.js').then(async ({withTransaction}) => { await withTransaction(async (tx) => { const { subject } = await import('./backend/src/modules/kpi/kpiRepository.js'); const s = await subject(tx.client, 5); console.log('PASS subject:', s.user_id); }); process.exit(0); })"

# 4.4 Calendar reminder rejection of 2026-02-30:
node -e "import('./backend/src/modules/calendar/calendarService.js').then(async m => { const r = m.createReminderSchema.safeParse({ title: 'Test', deadlineDate: '2026-02-30' }); console.log('PASS reject 2026-02-30:', !r.success); process.exit(0); })"
```

### Invalidation Conditions:
- `createReminderSchema.safeParse({ title: 'Test', deadlineDate: '2026-02-30' }).success === true`
- `aiGapCriterionSchema.safeParse({ periodStart: '2026-12-31', periodEnd: '2026-01-01' }).success === true`
- Any `RequestError: Invalid column name` thrown against the live SQL Server instance
- `app.personal_calendar_events` containing orphan rows without matching `app.calendar_reminders`
