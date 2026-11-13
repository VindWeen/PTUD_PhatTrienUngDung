# Adversarial Verification & Stress Test Handoff Report: Milestone 3

**Date**: 2026-11-12T21:45:00Z  
**Agent**: `teamwork_challenger_1` (Milestone 3 Empirical Challenger)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_1`  
**Recipient**: Parent Orchestrator (`c4f8ee2a-a6b8-4150-930d-200ed34209c4`)  
**Verdict**: ⛔ **REQUEST_CHANGES**

---

## 1. Observation

Adversarial stress testing was conducted against the implementation delivered by `worker_1` for Milestone 3 across:
1. `POST /api/v1/kpi/from-ai-gap`
2. `POST /api/v1/me/calendar/reminder`
3. `POST /api/v1/organizations/units/:id/ai-scan`
4. CV profile dependencies (`cvRepository.getUserContact`)

A dedicated empirical adversarial suite was implemented at `backend/tests/challenger-m3-adversarial.test.js` containing 25 automated assertions, and live database queries were executed directly against the local Microsoft SQL Server instance (`MSI`).

### Direct Empirical Observations & Verbatim Errors:

#### 1.1 CRITICAL — Unit AI Scan crashes on live SQL Server (`Invalid column name 'code'`)
- **File**: `backend/src/modules/organizations/organizationRepository.js:171` and `backend/src/modules/organizations/organizationRepository.js:184`
- **Code**:
  ```sql
  SELECT c.criteria_version_id, c.code, c.name, c.target_type,
         c.min_threshold, c.unit_metric, c.is_confirmed,
         c.source_rules, c.source_rules_revision,
         v.version_id, v.version_number
  FROM app.award_criteria_versions c
  JOIN app.regulation_document_versions v ON v.version_id = c.version_id
  WHERE v.document_id = $1 AND v.is_confirmed = 1
  ```
- **Live Execution**: Calling `organizationService.scanUnitWithAi(1, 3, { userId: 1, activeRoles: ['ADMIN'] })` against the live database fails immediately.
- **Verbatim Error**:
  ```
  RequestError: Invalid column name 'code'.
      at handleError (tedious/request.js:447:15)
      sqlServerNumber: 207
  ```
- **Database Schema**: In `app.award_criteria_versions`, the column is named `criterion_code`, NOT `code`. Querying `c.code` causes a fatal SQL syntax error on every live scan.

---

#### 1.2 CRITICAL — KPI Subject Auto-Provisioning crashes on live SQL Server (`Invalid column name 'full_name'`)
- **File**: `backend/src/modules/kpi/kpiRepository.js:27`
- **Code**:
  ```javascript
  const userRes = await client.query(
    `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1`,
    [userId],
  );
  ```
- **Live Execution**: When any user lacking an existing row in `app.lecturers` (such as `user_id = 5, 6, 7, 9, 17` or any newly registered member) calls `createFromAiGap`, `repo.subject()` auto-provisioning triggers and fails immediately.
- **Verbatim Error**:
  ```
  RequestError: Invalid column name 'full_name'.
      at handleError (tedious/request.js:447:15)
      sqlServerNumber: 207
  ```
- **Database Schema**: In `app.users`, the name column is `display_name`, NOT `full_name`. Querying `full_name` crashes auto-provisioning for all standard `MEMBER` users.

---

#### 1.3 CRITICAL — CV Contact Retrieval crashes on live SQL Server (`Invalid column name 'full_name'`)
- **File**: `backend/src/modules/cv/cvRepository.js:124`
- **Code**:
  ```sql
  SELECT u.user_id, u.display_name, COALESCE(u.full_name, u.display_name) AS full_name, u.email,
         l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone,
         ou.name AS unit_name
  FROM app.users u ...
  ```
- **Live Execution**: Calling `cvRepository.getUserContact(1)` against the live database fails immediately.
- **Verbatim Error**:
  ```
  RequestError: Invalid column name 'full_name'.
      at handleError (tedious/request.js:447:15)
      sqlServerNumber: 207
  ```
- **Production Impact**: Any public CV access (`GET /api/v1/public/cv/:slug`), own profile retrieval (`GET /api/v1/me/cv`), or Word export (`GET /api/v1/me/cv/export-docx`) crashes with HTTP 500 when attempting to load user contact information.

---

#### 1.4 HIGH — Calendar Reminder silently mutates impossible dates via rollover
- **File**: `backend/src/modules/calendar/calendarService.js:26-29`
- **Code**:
  ```javascript
  export const createReminderSchema = z.object({
    title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
    deadlineDate: z.string().refine(val => {
      const d = new Date(val);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1990 && d.getUTCFullYear() <= 2100;
    }, 'Hạn nộp không hợp lệ (phải từ năm 1990 đến 2100)'),
  ```
- **Live Execution**: Submitting `{ title: 'Hạn nộp', deadlineDate: '2026-02-30' }` PASSES schema validation.
- **Empirical Observation**:
  - `personal_calendar_events.starts_at`: `2026-03-02T09:00:00.000Z`
  - `calendar_reminders.deadline_date`: `2026-03-02T00:00:00.000Z`
  - The non-existent date `February 30, 2026` was silently mutated into `March 2, 2026` via JavaScript `Date` rollover without rejecting the invalid calendar day.

---

#### 1.5 HIGH — Dual-table persistence in Calendar Reminders violates atomicity
- **File**: `backend/src/modules/calendar/calendarService.js:109-141`
- **Code**:
  ```javascript
  const eventRes = await run(`INSERT INTO app.personal_calendar_events ...`);
  ...
  const reminderRes = await run(`INSERT INTO app.calendar_reminders ...`);
  ```
- **Live Execution**: When the second query (`INSERT INTO app.calendar_reminders`) throws an error (e.g., transient network disconnection, FK violation, or database error), the first query (`INSERT INTO app.personal_calendar_events`) is NOT rolled back because it executed in autocommit mode without `withTransaction`.
- **Empirical Observation**:
  - `personal_calendar_events` count before: `0`
  - Reminder insertion fails with simulated/transient error.
  - `personal_calendar_events` count after: `1` (an orphan event remains committed with no linked reminder).

---

#### 1.6 MEDIUM — Inverted item-level dates bypass KPI AI Gap validation
- **File**: `backend/src/modules/kpi/kpiSchemas.js:81-91` and `103-106`
- **Code**:
  `fromAiGapSchema` applies `.refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart)` ONLY on the root object.
  `aiGapCriterionSchema` does NOT contain a date ordering check.
- **Live Execution**: Payload with `missingCriteria: [{ code: 'ISI', name: 'Paper', periodStart: '2026-12-31', periodEnd: '2026-01-01' }]` returns `success: true` in Zod validation, bypassing API validation and subsequently triggering an unhandled database CHECK constraint violation (`CHECK(period_end >= period_start)`) on `app.kpi_goals`.

---

#### 1.7 RBAC Boundary Verification Results (PASSED)
The RBAC boundaries requested in the dispatch instructions were thoroughly tested:
- `MEMBER` attempting to scan any unit: **Rejected with HTTP 403 Forbidden** (`ForbiddenError`).
- `DEPARTMENT_HEAD` scanning outside their assigned department: **Rejected with HTTP 403 Forbidden** (`ForbiddenError`).
- `FACULTY_LEAD` scanning outside their faculty: **Rejected with HTTP 403 Forbidden** (`ForbiddenError`).
- `FACULTY_LEAD` scanning a descendant department inside their faculty: **SUCCEEDED** (100% matched, eligible).
- `ADMIN` scanning any unit (University, Faculty, Department): **SUCCEEDED** across all levels.

---

## 2. Logic Chain

1. **Why worker tests passed**:
   Worker 1 created test suites in `backend/tests/unit-ai-scan.test.js`, `backend/tests/kpi-from-gap.test.js`, and `backend/tests/cv-slug-docx.test.js` that almost exclusively used mock repositories or in-memory arrays. The actual SQL query strings inside `organizationRepository.js`, `kpiRepository.js`, and `cvRepository.js` were never executed against the real SQL Server database schema during those test runs.

2. **Column naming drift in SQL Server schema**:
   - In `app.award_criteria_versions`, the column defined in `001_final_schema.sql:351` is `criterion_code NVARCHAR(50)`. Calling `c.code` causes SQL Server error 207 (`Invalid column name 'code'`).
   - In `app.users`, the column defined in `001_final_schema.sql:36` is `display_name NVARCHAR(100)`. Calling `u.full_name` causes SQL Server error 207 (`Invalid column name 'full_name'`).

3. **Blast Radius**:
   - `POST /api/v1/organizations/units/:id/ai-scan`: **100% non-functional on live system** for all roles (Department Head, Faculty Lead, Admin).
   - `POST /api/v1/kpi/from-ai-gap`: **Fails for any new user or standard member** who lacks a pre-existing record in `app.lecturers`.
   - `GET /api/v1/public/cv/:slug`, `GET /api/v1/me/cv`, `GET /api/v1/me/cv/export-docx`: **100% non-functional on live system** due to `getUserContact` failing.
   - `POST /api/v1/me/calendar/reminder`: **Data integrity degradation** via silent date rollover and potential orphan records on transient failure.

---

## 3. Caveats

- **No caveats**. All 6 defects were reproduced empirically on both isolated Node.js test harnesses and the live running Microsoft SQL Server instance (`MSI`). The exact commands, line numbers, and error traces are documented above.

---

## 4. Conclusion

- **Verdict: ⛔ REQUEST_CHANGES**
- Milestone 3 cannot be approved in its current state due to 3 critical SQL syntax/schema mismatches that completely break live execution of Unit AI Scan, KPI Subject Auto-provisioning, and CV profile retrieval.

### Actionable Remediation Guidance for Worker:

1. **Fix `backend/src/modules/organizations/organizationRepository.js` (lines 171 & 184)**:
   Change `c.code` to `c.criterion_code AS code`:
   ```sql
   SELECT c.criteria_version_id, c.criterion_code AS code, c.name, c.target_type, ...
   ```
2. **Fix `backend/src/modules/kpi/kpiRepository.js` (line 27 & 43)**:
   Change `SELECT user_id, full_name, email FROM app.users` to `SELECT user_id, display_name AS full_name, email FROM app.users`:
   ```sql
   SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = $1
   ```
3. **Fix `backend/src/modules/cv/cvRepository.js` (line 124)**:
   Change `COALESCE(u.full_name, u.display_name)` to `u.display_name`:
   ```sql
   SELECT u.user_id, u.display_name, u.display_name AS full_name, u.email, ...
   ```
4. **Fix `backend/src/modules/calendar/calendarService.js` (line 26-29 & line 84)**:
   - Add calendar day validation to `createReminderSchema`:
     ```javascript
     deadlineDate: z.string().refine(val => {
       const datePart = val.includes('T') ? val.slice(0, 10) : val;
       const d = new Date(datePart);
       return !Number.isNaN(d.getTime()) &&
         d.toISOString().slice(0, 10) === datePart &&
         d.getUTCFullYear() >= 1990 &&
         d.getUTCFullYear() <= 2100;
     }, 'Hạn nộp không tồn tại hoặc ngoài khoảng 1990–2100'),
     ```
   - Wrap `createReminder` in `withTransaction` to guarantee atomic persistence across `app.personal_calendar_events` and `app.calendar_reminders`.
5. **Fix `backend/src/modules/kpi/kpiSchemas.js` (line 81-91)**:
   Add `.refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, "Kỳ kết thúc phải sau kỳ bắt đầu")` to `aiGapCriterionSchema`.

---

## 5. Verification Method

To independently reproduce all empirical findings and verify subsequent fixes:

```powershell
# 1. Run the comprehensive adversarial suite (verifies all edge cases and reproduces findings):
node --test backend/tests/challenger-m3-adversarial.test.js

# 2. Verify live Unit AI Scan against SQL Server:
node -e "import('./backend/src/modules/organizations/organizationService.js').then(async m => { try { await m.default.scanUnitWithAi(1, 3, { userId: 1, activeRoles: ['ADMIN'] }); console.log('PASS'); } catch(e) { console.error('FAIL:', e.message); } process.exit(0); })"

# 3. Verify live CV contact retrieval against SQL Server:
node -e "import('./backend/src/modules/cv/cvRepository.js').then(async m => { try { await m.getUserContact(1); console.log('PASS'); } catch(e) { console.error('FAIL:', e.message); } process.exit(0); })"

# 4. Verify live KPI subject auto-provisioning against SQL Server:
node -e "import('./backend/src/modules/kpi/kpiRepository.js').then(async m => { const { query, closeDB } = await import('./backend/src/config/database.js'); try { await m.subject({ query }, 5, 'LECTURER'); console.log('PASS'); } catch(e) { console.error('FAIL:', e.message); } await closeDB(); process.exit(0); })"
```

### Invalidation Conditions:
- Any of commands 2, 3, or 4 throwing `Invalid column name`.
- `createReminderSchema` accepting `"2026-02-30"`.
- `createReminder` leaving orphan records in `app.personal_calendar_events` on reminder failure.
