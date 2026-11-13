# Handoff Report: Milestone 3 Adversarial Challenge & Empirical Verification (Round 2)

**Agent**: `challenger_r2_1` (Milestone 3 Empirical Challenger)  
**Date**: 2026-11-12T23:45:00Z  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_r2_1`  
**Parent Orchestrator**: `c4f8ee2a-a6b8-4150-930d-200ed34209c4`  
**Verdict**: **APPROVE** (All 4 verification missions passed 100% across live database and adversarial stress harnesses)

---

## 1. Observation

### 1.1 Direct Source Code Observations
1. **Calendar Date Validation & Rollover Prevention (`backend/src/modules/calendar/calendarService.js:7-32`)**:
   ```javascript
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

     const parsed = new Date(val.includes('T') ? val : `${val}T00:00:00Z`);
     return Number.isFinite(parsed.getTime());
   }
   ```
   - In `createReminderSchema` (`calendarService.js:53-60`): `deadlineDate: z.string().refine(isValidCalendarDate, 'Hạn nộp không tồn tại hoặc ngoài khoảng 1990–2100')`.

2. **Calendar Transaction Atomicity (`backend/src/modules/calendar/calendarService.js:70-71, 115-183`)**:
   ```javascript
   export function calendarService(run = query, txRunner = null) {
     const executeTx = txRunner || (run === query ? withTransaction : async (cb) => cb({ query: run, client: null }));
     ...
     async createReminder(user, raw) {
       const e = createReminderSchema.parse(raw);
       return executeTx(async ({ query: txQuery }) => {
         ...
         const eventRes = await txQuery(`INSERT INTO app.personal_calendar_events ...`);
         ...
         const reminderRes = await txQuery(`INSERT INTO app.calendar_reminders ...`);
         ...
       });
     }
   }
   ```
   - Production default uses `withTransaction` (`backend/src/utils/dbHelper.js:64-90`) which initiates `BEGIN`, passes transactional `txQuery` bound to client, executes `COMMIT` on success, or invokes `ROLLBACK` on any thrown error before releasing the client.

3. **KPI Date Inversion Validation (`backend/src/modules/kpi/kpiSchemas.js:81-110`)**:
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

   export const fromAiGapSchema = z
     .object({
       regulationId: id,
       missingCriteria: z
         .array(aiGapCriterionSchema)
         .min(1, "Danh sách tiêu chí thiếu không được rỗng"),
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
   - `aiGapCriterionSchema` guards date ordering at the individual item level, while `fromAiGapSchema` guards it at the root request level.

4. **Unit AI Scan RBAC (`backend/src/modules/organizations/organizationRoutes.js:11` and `organizationService.js:112-149`)**:
   - Route level:
     ```javascript
     router.post(['/organizations/units/:id/ai-scan', '/units/:id/ai-scan'], requireRoles('DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'), controller.aiScan);
     ```
   - Service level:
     ```javascript
     const isAdmin = activeRoles.includes('ADMIN');
     const isFacultyLead = activeRoles.includes('FACULTY_LEAD');
     const isDeptHead = activeRoles.includes('DEPARTMENT_HEAD');

     if (!isAdmin && !isFacultyLead && !isDeptHead) {
       throw new ForbiddenError('Yêu cầu một trong các vai trò: DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN');
     }
     ```
   - Scoping restrictions: `DEPARTMENT_HEAD` cannot scan outside their assigned department; `FACULTY_LEAD` cannot scan outside their faculty tree; `ADMIN` has system-wide access.

### 1.2 Tool Commands and Execution Results
1. **Adversarial Regression Test (`backend/tests/challenger-m3-adversarial.test.js`)**:
   - Command: `node --test backend/tests/challenger-m3-adversarial.test.js`
   - Output: `ℹ tests 25 ℹ pass 25 ℹ fail 0 ℹ duration_ms 958.5277` (Exited with code 0).
2. **Dedicated Empirical Test Suite Authored by Challenger (`backend/tests/challenger-r2-empirical.test.js`)**:
   - Command: `node --test backend/tests/challenger-r2-empirical.test.js`
   - Output: `ℹ tests 20 ℹ pass 20 ℹ fail 0 ℹ duration_ms 1118.9962` (Exited with code 0).
3. **Live Microsoft SQL Server Integration (`backend/tests/sqlserver-m3.integration.js`)**:
   - Command: `node --test backend/tests/sqlserver-m3.integration.js`
   - Output: `ℹ tests 5 ℹ pass 5 ℹ fail 0 ℹ duration_ms 1173.8291` (Exited with code 0).
4. **Unit Test Suites (`kpi-from-gap`, `calendar-reminder`, `unit-ai-scan`)**:
   - Command: `node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/unit-ai-scan.test.js`
   - Output: `ℹ tests 13 ℹ pass 13 ℹ fail 0 ℹ duration_ms 1160.7122` (Exited with code 0).
5. **Full M3 Combined Test Suite**:
   - Command: `node --test backend/tests/challenger-m3-adversarial.test.js backend/tests/challenger-r2-empirical.test.js backend/tests/sqlserver-m3.integration.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/unit-ai-scan.test.js`
   - Output: `ℹ tests 63 ℹ pass 63 ℹ fail 0 ℹ duration_ms 2692.9329` (Exited with code 0).
6. **Overall Legacy Suite**:
   - Command: `node backend/tests/runner.js`
   - Output: `KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT` (Exited with code 0).

---

## 2. Logic Chain

1. **Mission 1: Invalid Date Handling & Rollover Prevention**:
   - **Hypothesis**: Dates with impossible Gregorian days (e.g. `2026-02-30`, `2026-02-29` non-leap, `2026-04-31`) would parse via `new Date(val)` and rollover into subsequent months (`2026-03-02`, `2026-03-01`, `2026-05-01`), altering user deadlines without warning.
   - **Empirical Test**: `isValidCalendarDate` was tested against `2026-02-29`, `2026-02-30`, `2026-02-31`, `2026-04-31`, `2026-06-31`, `2026-09-31`, `2026-11-31`, `2026-00-10`, `2026-13-10`, `2026-01-00`, `2026-01-32`, `1989-12-31`, `2101-01-01`, and invalid ISO timestamps (`2026-02-30T14:30:00+07:00`). Valid leap days (`2024-02-29`, `2028-02-29`, `2000-02-29`) were confirmed to pass.
   - **Deduction**: Because the UTC round-trip check compares `utcDate.getUTCMonth() === month - 1` and `utcDate.getUTCDate() === day`, any rollover changes the month/day and immediately returns `false`. `createReminderSchema` and `fromAiGapSchema` reject all impossible dates at the validation gateway.

2. **Mission 2: Calendar Transaction Atomicity under Reminder Failure**:
   - **Hypothesis**: If inserting into `app.calendar_reminders` fails (due to DB disconnection, unique constraint violation, or server error), the prior insert into `app.personal_calendar_events` could remain committed as an orphan event.
   - **Empirical Test**:
     - *Mock Test*: Simulated failure during reminder insertion; verified mock event store size reverted to 0.
     - *Live Database Test*: Executed `createReminder` against live SQL Server with a savepoint/transaction runner throwing `FORCED_SIMULATED_FAILURE_ON_REMINDER_INSERT`. Polled `app.personal_calendar_events` for the specific unique test title.
   - **Deduction**: Query returned `COUNT(*) = 0`. Because both inserts share the single transactional client under `withTransaction`, the rollback cleanly removed the inserted personal event. No orphan records survive.

3. **Mission 3: KPI Date Inversion (`periodEnd < periodStart`)**:
   - **Hypothesis**: Inverted date ranges inside `missingCriteria` items could bypass root-level checks if root dates were omitted.
   - **Empirical Test**: Tested `aiGapCriterionSchema` with inverted items (`2026-12-31` to `2026-01-01`, `2026-06-02` to `2026-06-01`, `2026-10-15` to `2025-10-15`). Also tested multi-item arrays in `fromAiGapSchema` where one item was inverted while other items were valid.
   - **Deduction**: All inverted items were rejected with `ValidationError: "Kỳ kết thúc phải sau kỳ bắt đầu"`. Single-day periods (`periodStart === periodEnd`) and single-boundary periods remain valid.

4. **Mission 4: Unit AI Scan Role-Based Access Control (RBAC)**:
   - **Hypothesis**: `MEMBER` users could potentially trigger unit scanning, or `DEPARTMENT_HEAD`/`FACULTY_LEAD` could scan outside their organizational scope.
   - **Empirical Test**:
     - Evaluated `scanUnitWithAi` with `MEMBER` alone, `STUDENT`, `GUEST`, and empty role list -> all threw `ForbiddenError` (403).
     - Evaluated `DEPARTMENT_HEAD` attempting to scan another department or parent faculty -> threw `ForbiddenError` (403).
     - Evaluated `FACULTY_LEAD` attempting to scan another faculty -> threw `ForbiddenError` (403).
     - Evaluated `FACULTY_LEAD` scanning child department within faculty -> SUCCEEDED.
     - Evaluated `ADMIN` scanning root university, faculty, and department -> SUCCEEDED.
     - Evaluated multi-role user `['MEMBER', 'ADMIN']` -> SUCCEEDED via highest privilege.
   - **Deduction**: Double barrier protection (Express route middleware `requireRoles` + service-level checks) completely prevents unauthorized scans and enforces unit hierarchy boundaries.

---

## 3. Caveats

- **No Caveats Regarding Production Readiness**: All four required validation criteria have been empirically verified with both mock harnesses and live SQL Server queries.
- **Rollback Fixtures**: Live database integration tests execute inside rolled-back transactions with savepoints, guaranteeing zero residue in the production database.

---

## 4. Conclusion

**Verdict: APPROVE**

The remediations implemented by Worker 2 for Milestone 3 satisfy all architectural, security, and integrity requirements:
1. Strict Gregorian calendar date validation prevents silent rollovers across Calendar and KPI schemas.
2. Calendar dual-table insertion is fully atomic under `withTransaction`; failure during reminder creation leaves zero orphan personal events.
3. KPI item-level date inversion is strictly rejected by schema validation.
4. Unit AI Scan RBAC strictly enforces role and hierarchical boundaries (`MEMBER` 403 blocked; `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN` properly authorized).
5. All 63 automated tests pass with 0 failures and 0 regressions.

---

## 5. Verification Method

To independently reproduce and verify this assessment:

1. **Run Challenger Round 2 Empirical Test Suite**:
   ```powershell
   node --test backend/tests/challenger-r2-empirical.test.js
   ```
   *Expected Output*: `ℹ tests 20 ℹ pass 20 ℹ fail 0`

2. **Run Challenger Round 1 Adversarial Suite**:
   ```powershell
   node --test backend/tests/challenger-m3-adversarial.test.js
   ```
   *Expected Output*: `ℹ tests 25 ℹ pass 25 ℹ fail 0`

3. **Run Live Microsoft SQL Server Integration Suite**:
   ```powershell
   node --test backend/tests/sqlserver-m3.integration.js
   ```
   *Expected Output*: `ℹ tests 5 ℹ pass 5 ℹ fail 0`

4. **Run Milestone 3 Unit Tests**:
   ```powershell
   node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/unit-ai-scan.test.js
   ```
   *Expected Output*: `ℹ tests 13 ℹ pass 13 ℹ fail 0`

5. **Invalidation Conditions**:
   - `isValidCalendarDate('2026-02-30') === true` or `isValidCalendarDate('2026-04-31') === true`
   - `aiGapCriterionSchema.safeParse({ code: 'X', name: 'Test', periodStart: '2026-12-31', periodEnd: '2026-01-01' }).success === true`
   - Any personal event row persisting in `app.personal_calendar_events` when reminder creation aborts
   - Any HTTP 200 response or non-403 outcome when a user with only `MEMBER` role calls unit AI scan
