# Quality & Adversarial Review Report: Milestone 3 (KPI & Calendar)

**Reviewer**: `teamwork_reviewer_1` (Roles: Reviewer, Critic)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\reviewer_1`  
**Target Work Products**:
- `POST /api/v1/kpi/from-ai-gap` in `backend/src/modules/kpi/` (`kpiRoutes.js`, `kpiSchemas.js`, `kpiService.js`, `kpiRepository.js`)
- `POST /api/v1/me/calendar/reminder` and `GET /api/v1/me/calendar/reminders` in `backend/src/modules/calendar/` (`calendarRoutes.js`, `calendarService.js`)
- Test suites: `backend/tests/kpi-from-gap.test.js`, `backend/tests/calendar-reminder.test.js`

---

## 1. Observation

### 1.1 Direct Source Code Inspection

1. **KPI Bridge Route (`backend/src/modules/kpi/kpiRoutes.js:8, 51-54`)**:
   - `router.use("/kpi", authenticate);` applies JWT authentication across all `/kpi` routes.
   - `router.post("/kpi/from-ai-gap", handle((req) => service.createFromAiGap(req.user, req.body), 201));` mounts `POST /api/v1/kpi/from-ai-gap` returning HTTP 201 with `no-store` cache control.

2. **KPI Gap Schemas (`backend/src/modules/kpi/kpiSchemas.js:81-112`)**:
   - `aiGapCriterionSchema`: Enforces code uppercase transformation (`text(80).transform(v => v.toUpperCase())`), `name: text(255)`, `missingCount: z.coerce.number().finite().min(0).default(1)`, optional `periodStart`/`periodEnd` matching `YYYY-MM-DD` between 1990 and 2100.
   - `fromAiGapSchema`: Requires `regulationId: id`, non-empty `missingCriteria` array (`.min(1)`), and date ordering check (`periodEnd >= periodStart`).
   - `parse(schema, raw)` throws `ValidationError` (HTTP 400) on validation failures.

3. **KPI Service & Transaction Handling (`backend/src/modules/kpi/kpiService.js:71-81, 392-471`)**:
   - `run(fn)` wraps execution inside `withTransaction(({ client }) => fn(client))` ensuring complete transaction atomicity.
   - Verifies regulation document: `SELECT document_id, title FROM app.regulation_documents WHERE document_id = $1`. Throws `NotFoundError` (HTTP 404) if absent.
   - Resolves subject via `repo.subject(client, user.userId, 'LECTURER')`.
   - Iterates through `missingCriteria`, resolving default periods (`${currentYear}-01-01` to `${currentYear}-12-31`), default unit (`tiêu chí`), target (`missingCount`), and source note (`Khoảng trống AI từ quy chế #${data.regulationId}: ...`).
   - Handles unique index collisions on `(lecturer_id, code, period_start, period_end)`:
     - If existing goal is `DRAFT`, it updates the goal by adding targets (`target = target + $1`) and appending the plan (`[plan] = [plan] + N' ; ' + $2`), logging `KPI_UPDATE_GOAL`.
     - If existing goal is `ACCEPTED`, it appends `-GAP` to the code and creates a new goal, logging `KPI_CREATE_FROM_GAP`.
   - Goal creation inserts `source = 'AI_GAP'`.
   - All operations are audited with `recordAuditLog`.

4. **KPI Repository & Role Resolution (`backend/src/modules/kpi/kpiRepository.js:5-60`)**:
   - `subject(client, userId, type = 'LECTURER')` queries active roles from `app.user_roles`.
   - Evaluates `isPersonalRole`:
     ```javascript
     const isPersonalRole =
       roles.length === 0 ||
       roles.some((r) =>
         ["LECTURER", "MEMBER", "DEPARTMENT_HEAD", "FACULTY_LEAD", "ADMIN"].includes(r),
       );
     ```
   - Supports all 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) as well as `LECTURER`.
   - If user does not have a record in `app.lecturers`, it auto-provisions a lecturer profile linked to the root university unit (`LHU`) with employee code `USR0000X`.

5. **Calendar Routes (`backend/src/modules/calendar/calendarRoutes.js:7, 14, 15`)**:
   - `router.use(authenticate)` enforces authentication.
   - `router.post('/me/calendar/reminder', handle(req => service.createReminder(req.user, req.body), 201));`
   - `router.get('/me/calendar/reminders', handle(req => service.listReminders(req.user)));`

6. **Calendar Service & Dual-Table Insertion (`backend/src/modules/calendar/calendarService.js:24-34, 84-173`)**:
   - `createReminderSchema` validates `title` (1-255 characters), `deadlineDate` (1990-2100), and optional foreign keys (`regulationId`, `awardPeriodId`, `kpiGoalId`).
   - Validates foreign key existence prior to insert:
     - Checks `app.regulation_documents` -> throws `NotFoundError('Không tìm thấy quy chế')`.
     - Checks `app.award_periods` -> throws `NotFoundError('Không tìm thấy kỳ khen thưởng')`.
     - Checks `app.kpi_goals` -> throws `NotFoundError('Không tìm thấy mục tiêu KPI')`.
   - Dual-table insertion:
     - Table 1: `app.personal_calendar_events`:
       - `category = 'task'` (satisfies DB CHECK constraint `category IN ('exam', 'competition', 'task', 'personal')`).
       - `title.slice(0, 160)` protects against DB truncation on `NVARCHAR(160)`.
       - `all_day = 0`, `completed = 0`.
       - Extracts inserted ID.
     - Table 2: `app.calendar_reminders`:
       - Inserts `user_id`, `title`, `deadline_date`, `regulation_id`, `award_period_id`, `kpi_goal_id`, and `event_id`.
   - `listReminders(user)`:
     - Filters strictly by `WHERE r.user_id = $1` using parameterized query.
     - Joins `app.regulation_documents`, `app.award_periods`, and `app.kpi_goals` to enrich response.

### 1.2 Tool Commands & Verbatim Test Results

- **Command 1 (Assigned M3 Target Suites)**:
  `node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js`
  - Output:
    ```
    ✔ Calendar Reminder Schema: validates title length, date ranges, and optional foreign keys (1.8265ms)
    ✔ Calendar Reminder: throws NotFoundError when regulationId does not exist (1.2901ms)
    ✔ Calendar Reminder: dual insertion into personal_calendar_events and calendar_reminders (0.5599ms)
    ✔ Calendar Reminder: listReminders returns reminders with regulation details (0.4516ms)
    ✔ KPI Gap Schema: rejects empty missingCriteria or inverted date ranges (2.5684ms)
    ✔ KPI Bridge: throws NotFoundError when regulationId does not exist (1.6737ms)
    ✔ KPI Bridge: createFromAiGap creates records with source = AI_GAP and proper targets (0.7364ms)
    ✔ KPI Bridge: subject supports roles MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN (0.6797ms)
    ✔ KPI Bridge: updates draft goal if duplicate code and period exists (0.5361ms)
    ℹ tests 9
    ℹ suites 0
    ℹ pass 9
    ℹ fail 0
    ```

- **Command 2 (Full Milestone 3 Extended Test Suite)**:
  `node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js`
  - Output:
    ```
    ℹ tests 21
    ℹ suites 0
    ℹ pass 21
    ℹ fail 0
    ```

- **Command 3 (All 11 Unit & Integration Test Suites)**:
  `node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js`
  - Output:
    ```
    ℹ tests 51
    ℹ suites 0
    ℹ pass 51
    ℹ fail 0
    ```

- **Command 4 (Legacy Auth & Scope Runner)**:
  `node backend/tests/runner.js`
  - Output:
    ```
    KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT
    TẤT CẢ TEST CASES AUTH & PHÂN QUYỀN W1-Q3 ĐỀU ĐẠT CHUẨN 100%!
    ```

---

## 2. Logic Chain

1. **Evidence-Based Contract Conformance**:
   - Interface specification §3 requires `POST /api/v1/kpi/from-ai-gap` to ingest `{ regulationId, missingCriteria: [...] }` and persist into `app.kpi_goals` with `source = 'AI_GAP'`. Source code line `kpiService.js:448, 458` explicitly passes `'AI_GAP'`. Migration `005_refactor_personal_vault_and_cv.sql:71-76` verified to have expanded the CHECK constraint on `app.kpi_goals.source` to accept `'AI_GAP'`.
   - Interface specification §3 requires `POST /api/v1/me/calendar/reminder` to insert into both `app.calendar_reminders` and `app.personal_calendar_events`. Inspection of `calendarService.js:109-142` confirms that both tables are inserted with identical owner (`user.userId`), correct foreign key linking (`event_id`), and category `'task'` adhering to database constraints.
2. **Robust Multi-Role Identity Mapping**:
   - In `kpiRepository.js:9-13`, the active roles query checks for `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`, or `LECTURER`. When an authenticated user lacks an existing `app.lecturers` row, lines 25-58 automatically provision a profile in `app.lecturers` and `app.lecturer_assignments`. This enables users assigned only the new refactored roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`) to create KPI goals seamlessly without database foreign key errors.
3. **Transaction Safety and Error Resilience**:
   - `kpiService.js` wraps all mutations in `run()`, which utilizes `withTransaction`. If an invalid regulation is passed or database error occurs mid-loop, `client.query('ROLLBACK')` is triggered, avoiding partial writes.
   - Unique constraint index `kpi_goal_person_period` collision is avoided by querying `findDuplicate` prior to insert. Existing `DRAFT` records are updated, while existing `ACCEPTED` records trigger code renaming with `-GAP` suffix.
4. **Ownership Isolation**:
   - In `calendarService.js:167`, `WHERE r.user_id = $1` with parameter `[user.userId]` guarantees that no user can access reminders created by other users.

---

## 3. Caveats

1. **Database Multi-statement Transaction in Calendar**:
   - While `kpiService.js` uses `withTransaction` for multi-item writes, `calendarService.js` performs the dual-table insert sequentially using the default `run` (pool query) helper. Because foreign keys are pre-checked, failure between the two statements is low-probability, but wrapping both inserts inside an explicit transaction or multi-statement batch is recommended for strict database hygiene.
2. **JavaScript Date Day-Rollover**:
   - `createReminderSchema` validates `deadlineDate` with `new Date(val)`. In JavaScript, date strings with impossible days (such as `2026-02-31`) silently roll over to `2026-03-03` rather than failing validation. This does not cause database crashes because SQL Server DATETIME2 accepts `2026-03-03`, but strict calendar validation could be added.

---

## 4. Integrity Assessment

- **Hardcoded test results embedded in source code**: None detected.
- **Dummy or facade implementations**: None detected. All routes perform real SQL queries and business logic.
- **Shortcuts bypassing the intended task**: None detected.
- **Fabricated verification outputs or logs**: None detected. All tests executed directly in terminal and verified independently.
- **Self-certifying work without genuine verification**: None. Independent test suites verified with 51 passing assertions.
- **Integrity Tag**: **CLEAN**

---

## 5. Review Findings & Adversarial Challenges

### Quality Review Summary
**Verdict**: **APPROVE**

#### Finding 1 (Minor / Suggestion) — Transaction Atomicity for Dual Insertion
- **What**: `calendarService.createReminder` executes two queries sequentially without `withTransaction`.
- **Where**: `backend/src/modules/calendar/calendarService.js:109-142`
- **Why**: If the second insert into `app.calendar_reminders` fails unexpectedly, the first insert into `app.personal_calendar_events` remains committed as an orphan event.
- **Suggestion**: Wrap both queries in `withTransaction` to guarantee atomic all-or-nothing persistence.

#### Finding 2 (Minor) — Strict Day Rollover Validation
- **What**: `createReminderSchema` permits invalid dates (e.g. Feb 31) because `new Date('2026-02-31')` rolls over to March 3.
- **Where**: `backend/src/modules/calendar/calendarService.js:26-29`
- **Why**: Minor discrepancy where client might accidentally input an impossible date without receiving a 400 error.
- **Suggestion**: Adopt `d.toISOString().slice(0, 10) === val` check matching `kpiSchemas.js:25`.

### Adversarial Challenge Summary
**Overall Risk Assessment**: **LOW**

#### Challenge 1 (Low) — Repeated Collision on Suffix `-GAP`
- **Assumption Challenged**: When an existing goal is in `ACCEPTED` status, appending `-GAP` to the code avoids collision.
- **Attack Scenario**: If a user runs `createFromAiGap` for code `SCOPUS` against an accepted goal (creating `SCOPUS-GAP`), and subsequently accepts `SCOPUS-GAP`, running `createFromAiGap` a third time will attempt to insert `SCOPUS-GAP` again, triggering a unique constraint error `23505`.
- **Blast Radius**: User receives a 409 Conflict error on subsequent AI gap runs for the same code once the gap goal has been accepted.
- **Mitigation**: Generate an incremental or randomized suffix (e.g. `${code}-GAP-${Date.now().toString().slice(-4)}`) if `${code}-GAP` already exists.

---

## 6. Verified Claims

| Feature / Claim | Verification Method | Result |
|---|---|---|
| `POST /api/v1/kpi/from-ai-gap` schema validation | Tested empty `missingCriteria`, invalid dates, inverted ranges | PASS |
| Non-existent regulation throws 404 `NotFoundError` | Mock & service execution verifying `document_id` lookup | PASS |
| Role support for `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` | Tested role resolution in `repo.subject` with auto-provisioning | PASS |
| KPI goal persistence with `source = 'AI_GAP'` | Verified insert query and resulting record structure | PASS |
| Duplicate goal collision handling | Verified `DRAFT` target increment / plan append and `ACCEPTED` `-GAP` handling | PASS |
| `POST /api/v1/me/calendar/reminder` schema validation | Tested blank title, date bounds (<1990, >2100), optional FKs | PASS |
| Calendar reminder dual-table insertion | Verified insert into `app.personal_calendar_events` (`category = 'task'`) and `app.calendar_reminders` | PASS |
| Calendar title truncation guard | Verified `title.slice(0, 160)` for `personal_calendar_events` and full title in `calendar_reminders` | PASS |
| `GET /api/v1/me/calendar/reminders` ownership isolation | Verified query uses parameterized `WHERE r.user_id = $1` | PASS |
| Zero regressions on entire project test suite | 51 native tests + 31 runner tests pass with 100% success | PASS |

---

## 7. Conclusion & Verdict

**VERDICT**: **APPROVE**

The implementation of `POST /api/v1/kpi/from-ai-gap`, `POST /api/v1/me/calendar/reminder`, and `GET /api/v1/me/calendar/reminders` by `worker_1` meets all requirements of Milestone 3, adheres strictly to project conventions and interface contracts, maintains real state in the database, enforces security and ownership isolation, and passes 100% of all automated test suites.

---

## 8. Verification Method

To independently reproduce and verify this review:

```powershell
# 1. Run KPI and Calendar test suites:
node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js

# 2. Run all Milestone 3 test suites:
node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js

# 3. Run all 11 unit/integration test suites:
node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js

# 4. Run legacy auth & RBAC runner:
node backend/tests/runner.js
```

### Invalidation Conditions
- Any test suite failing or exiting with non-zero exit code.
- `POST /api/v1/kpi/from-ai-gap` failing to set `source = 'AI_GAP'`.
- `POST /api/v1/me/calendar/reminder` failing to insert into `app.personal_calendar_events` with `category = 'task'`.
- `GET /api/v1/me/calendar/reminders` allowing cross-user data leakage.
