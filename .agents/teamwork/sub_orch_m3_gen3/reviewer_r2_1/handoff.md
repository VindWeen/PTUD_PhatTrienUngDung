# Review & Adversarial Challenge Report: Milestone 3 Iteration 2 (KPI & Calendar)

**Reviewer**: `reviewer_r2_1` (Roles: Reviewer, Critic)  
**Date**: 2026-11-12T23:45:00Z  
**Target Milestone**: Milestone 3 Iteration 2 Remediation (Backend Extended Modules: KPI & Calendar)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\reviewer_r2_1`  
**Parent Orchestrator**: `c4f8ee2a-a6b8-4150-930d-200ed34209c4`  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct empirical examination of the codebase, schemas, and live database queries revealed the following:

### 1.1 Calendar Module: Strict Date Validation & Transactional Dual-Insert Atomicity
- **File**: `backend/src/modules/calendar/calendarService.js:7-32`
  - Function `isValidCalendarDate(val)` enforces regex parsing `ISO_DATE_PATTERN`, checks bounds (`1990 <= year <= 2100`, `1 <= month <= 12`, `1 <= day <= 31`), and performs strict UTC round-trip validation:
    ```javascript
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return false;
    }
    const parsed = new Date(val.includes('T') ? val : `${val}T00:00:00Z`);
    return Number.isFinite(parsed.getTime());
    ```
  - In `backend/src/modules/calendar/calendarService.js:53-60`: `createReminderSchema` applies `.refine(isValidCalendarDate, 'Hạn nộp không tồn tại hoặc ngoài khoảng 1990–2100')` to `deadlineDate`.
  - In `backend/src/modules/calendar/calendarService.js:70-71, 112-183`: `calendarService(run = query, txRunner = null)` defines `executeTx = txRunner || (run === query ? withTransaction : async (cb) => cb({ query: run, client: null }))`. Inside `createReminder`, both `app.personal_calendar_events` and `app.calendar_reminders` are executed inside `executeTx(async ({ query: txQuery }) => { ... })` using `txQuery`, guaranteeing dual-insert atomicity and automatic `ROLLBACK` on any database failure.
  - Safe string truncation: `calendarService.js:146` safely truncates personal calendar title to `e.title.slice(0, 160)` to strictly conform to `app.personal_calendar_events.title` (NVARCHAR(160) NOT NULL CHECK(LEN(LTRIM(RTRIM(title))) > 0)), while `calendar_reminders` stores the full 255-character title.

### 1.2 KPI Schema: Item-Level Date Ordering Refinement
- **File**: `backend/src/modules/kpi/kpiSchemas.js:81-95`
  - `aiGapCriterionSchema` now incorporates item-level refinement:
    ```javascript
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
  - Direct execution confirms that inverted dates on individual criteria (`periodStart: '2026-12-31', periodEnd: '2026-01-01'`) are rejected with `false` and validation error `"Kỳ kết thúc phải sau kỳ bắt đầu"`.

### 1.3 KPI Repository: SQL Server Error 207 & 515 Remediations
- **File**: `backend/src/modules/kpi/kpiRepository.js:26-58`
  - In auto-provisioning fallback: `SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = $1` corrects the invalid column name `full_name`, preventing SQL Server Error 207.
  - In `app.lecturer_assignments` insertion:
    ```javascript
    await client.query(
      `INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from, assigned_by)
       VALUES ($1, $2, 1, SYSUTCDATETIME(), $3)`,
      [ins.rows[0].lecturer_id, defaultUnitId, userId],
    );
    ```
    Inserts `$3 = userId` into `assigned_by`, which is `BIGINT NOT NULL`, preventing SQL Server Error 515.

### 1.4 Test Executions
1. `node --test backend/tests/calendar-reminder.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar.test.js backend/tests/sqlserver-m3.integration.js`:
   - Output: `ℹ tests 18 ℹ pass 18 ℹ fail 0` (duration 2.22s)
2. `node --test backend/tests/challenger-m3-adversarial.test.js`:
   - Output: `ℹ tests 25 ℹ pass 25 ℹ fail 0` (duration 0.96s)
3. `node --test backend/tests/challenger-m3-cv-adversarial.test.js`:
   - Output: `ℹ tests 15 ℹ pass 15 ℹ fail 0` (duration 1.48s)
4. `node --test backend/tests/achievement-vault-active.test.js ...` (all 11 test files):
   - Output: `ℹ tests 52 ℹ pass 52 ℹ fail 0` (duration 3.40s)
5. `node backend/tests/runner.js`:
   - Output: `31/31 KIỂM TRA ĐẠT`

---

## 2. Logic Chain

1. **Date Validation Logic**:
   - `Date.UTC(year, month - 1, day)` standardizes calendar calculations without local timezone shifts.
   - For an invalid date such as `2026-02-30`, `Date.UTC(2026, 1, 30)` rolls over to `2026-03-02`. `utcDate.getUTCMonth()` evaluates to `2` (March), while `month - 1` evaluates to `1` (February).
   - Because `2 !== 1`, `isValidCalendarDate` strictly returns `false`.
   - For a non-leap year `2026-02-29`, it rolls over to March 1, and is rejected.
   - For a valid leap date `2024-02-29`, month and day match, returning `true`.
   - For April 31 (`2026-04-31`), it rolls over to May 1, and is rejected.
   - Therefore, silent rollover date mutation in the database is completely prevented.

2. **Transactional Boundary Logic**:
   - `calendarService` executes both queries (`app.personal_calendar_events` and `app.calendar_reminders`) inside `executeTx`.
   - In production, `executeTx` uses `withTransaction`, which executes `BEGIN`, runs both queries on the same pooled connection client, and executes `COMMIT` on success or `ROLLBACK` in the `catch` block on error.
   - In `sqlserver-m3.integration.js` (Test 4.2), a simulated error during `INSERT INTO app.calendar_reminders` verified that the count of records in `app.personal_calendar_events` remained unchanged, proving that orphan events cannot be created.

3. **Schema Refinement Logic**:
   - `fromAiGapSchema` now applies `aiGapCriterionSchema` to each entry in `missingCriteria`.
   - Because `aiGapCriterionSchema` itself has `.refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart)`, any criterion with `periodEnd < periodStart` causes `.safeParse()` to return `false` before reaching the service layer or database.
   - If omitted, dates safely fall back to the root range or current calendar year boundaries.

4. **Database Query Integrity Logic**:
   - `INFORMATION_SCHEMA.COLUMNS` confirmed that `app.users` contains `display_name` and does not contain `full_name`. Querying `display_name AS full_name` eliminates SQL Server error 207.
   - `INFORMATION_SCHEMA.COLUMNS` confirmed that `app.lecturer_assignments.assigned_by` is `BIGINT NOT NULL`. Providing `userId` as `$3` prevents SQL Server error 515.

5. **Integrity Violation Analysis**:
   - No hardcoded test responses or facade bypasses were found in `calendarService.js`, `kpiSchemas.js`, or `kpiRepository.js`.
   - All tests execute actual business logic, zod parsers, and live SQL Server queries.

---

## 3. Caveats

- **No Caveats**: All 4 remediation items have been directly verified, stress-tested, and confirmed passing with zero regressions across both legacy and new test suites.

---

## 4. Conclusion & Verdict

**Verdict**: **APPROVE**

All Milestone 3 Iteration 2 requirements and remediations are implemented with high engineering standards:
- Strict UTC date validation prevents deadline date mutation via calendar rollovers.
- Dual-table writes to `personal_calendar_events` and `calendar_reminders` are fully enclosed in transactional boundaries with automatic rollback.
- Item-level date ordering refinement prevents inverted date ranges in KPI gap criteria.
- SQL queries and columns align 100% with Microsoft SQL Server database schema constraints.
- Test suites pass 100% (18/18 M3 core, 25/25 M3 adversarial, 15/15 CV adversarial, 52/52 complete M3 suite, 31/31 legacy checks).

---

## 5. Verification Method

To independently verify this verdict, execute the following commands in powershell from the project root:

### 5.1 Run Core M3 Unit & Live Integration Suites (18 tests — PASS):
```powershell
node --test backend/tests/calendar-reminder.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar.test.js backend/tests/sqlserver-m3.integration.js
```
*Expected*: `ℹ tests 18 ℹ pass 18 ℹ fail 0`

### 5.2 Run M3 Adversarial Challenger Test Suite (25 tests — PASS):
```powershell
node --test backend/tests/challenger-m3-adversarial.test.js
```
*Expected*: `ℹ tests 25 ℹ pass 25 ℹ fail 0`

### 5.3 Run CV Adversarial Challenger Test Suite (15 tests — PASS):
```powershell
node --test backend/tests/challenger-m3-cv-adversarial.test.js
```
*Expected*: `ℹ tests 15 ℹ pass 15 ℹ fail 0`

### 5.4 Run Complete M3 Test Suites (52 tests — PASS):
```powershell
node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js
```
*Expected*: `ℹ tests 52 ℹ pass 52 ℹ fail 0`

### 5.5 Invalidation Conditions:
- `createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-02-30' }).success === true`
- `aiGapCriterionSchema.safeParse({ code: 'TEST', name: 'Test', periodStart: '2026-12-31', periodEnd: '2026-01-01' }).success === true`
- Failure during `createReminder` leaving an orphan row in `app.personal_calendar_events`
- Any SQL Server Error 207 or Error 515 thrown during user auto-provisioning or KPI/Calendar operations
