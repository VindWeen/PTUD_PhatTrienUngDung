# Handoff Report: Investigation of Milestone 3 (KPI & Calendar)

**Date**: 2026-11-12T17:50:00Z  
**Agent**: `teamwork_explorer_m3_1`  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_1`  
**Target Milestone**: Milestone 3 — Backend Extended Modules (KPI & Calendar)

---

## 1. Observation

### 1.1 Database Schema & Migration Status
- **File**: `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`
  - Lines 71-78:
    ```sql
    ALTER TABLE app.kpi_goals ALTER COLUMN source NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL;
    ALTER TABLE app.kpi_results ALTER COLUMN source NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL;

    ALTER TABLE app.kpi_goals ADD CONSTRAINT ck_kpi_goals_source
      CHECK (source IN (N'MANUAL', N'CSV', N'AI_GAP', N'AI_GAP_ANALYSIS', N'SYSTEM'));
    ```
  - Lines 107-123:
    ```sql
    IF OBJECT_ID(N'app.calendar_reminders', N'U') IS NULL
    BEGIN
      CREATE TABLE app.calendar_reminders (
        reminder_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        user_id BIGINT NOT NULL CONSTRAINT fk_calendar_reminders_user FOREIGN KEY REFERENCES app.users(user_id),
        title NVARCHAR(255) NOT NULL,
        deadline_date DATETIME2(3) NOT NULL,
        regulation_id BIGINT NULL CONSTRAINT fk_calendar_reminders_regulation FOREIGN KEY REFERENCES app.regulation_documents(document_id),
        award_period_id BIGINT NULL CONSTRAINT fk_calendar_reminders_award_period FOREIGN KEY REFERENCES app.award_periods(award_period_id),
        kpi_goal_id BIGINT NULL CONSTRAINT fk_calendar_reminders_kpi_goal FOREIGN KEY REFERENCES app.kpi_goals(goal_id),
        event_id BIGINT NULL CONSTRAINT fk_calendar_reminders_event FOREIGN KEY REFERENCES app.personal_calendar_events(event_id),
        is_completed BIT NOT NULL DEFAULT 0,
        created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
    ```
- **File**: `database/sqlserver/migrations/001_final_schema.sql`
  - Lines 430-455: `app.kpi_goals` table definition. Constraints include:
    - `CHECK ((lecturer_id IS NULL AND unit_id IS NOT NULL) OR (lecturer_id IS NOT NULL AND unit_id IS NULL))`
    - `CHECK(period_end >= period_start)`
    - `CHECK(period_start >= '1990-01-01' AND period_end <= '2100-12-31')`
    - `context_unit_id BIGINT NOT NULL` (references `app.organization_units`)
    - Unique index: `CREATE UNIQUE INDEX kpi_goal_person_period ON app.kpi_goals(lecturer_id,code,period_start,period_end) WHERE lecturer_id IS NOT NULL;`
  - Lines 711-726: `app.personal_calendar_events` table definition:
    - `CHECK (category IN (N'exam',N'competition',N'task',N'personal'))`
    - `title NVARCHAR(160) NOT NULL CHECK (LEN(LTRIM(RTRIM(title))) > 0)`
    - `CHECK(ends_at >= starts_at)`
- **Verification execution**:
  - Command: `node database/sqlserver/verify-refactor.mjs`
  - Result:
    ```
    ALL REFACTOR VERIFICATIONS PASSED (100%)
    app.kpi_goals and app.kpi_results source columns updated and constraints validated
    app.calendar_reminders: table exists with valid, trusted foreign keys
    ```

### 1.2 Route Registration in `backend/src/app.js`
- Lines 2, 3:
  ```js
  import calendarRoutes from './modules/calendar/calendarRoutes.js';
  import kpiRoutes from './modules/kpi/kpiRoutes.js';
  ```
- Lines 60, 76, 78:
  ```js
  const apiPrefix = config.API_PREFIX || '/api/v1';
  app.use(apiPrefix, calendarRoutes);
  app.use(apiPrefix, kpiRoutes);
  ```
- Any sub-route in `calendarRoutes.js` prefixed with `/me/calendar` resolves to `/api/v1/me/calendar`.
- Any sub-route in `kpiRoutes.js` prefixed with `/kpi` resolves to `/api/v1/kpi`.

### 1.3 State of `backend/src/modules/kpi/`
- **`kpiRoutes.js`** (lines 1-95):
  - Line 8: `router.use("/kpi", authenticate);`
  - Routes present: `/kpi/external`, `/kpi/template.csv`, `/kpi/recommendations`, `/kpi/catalogs`, `/kpi/import/preview`, `/kpi/import/commit`, `/kpi/goals` (GET, POST, PATCH, DELETE), `/kpi/goals/:id/accept`, `/kpi/goals/:id/result`.
  - **MISSING**: `POST /kpi/from-ai-gap` does not exist.
- **`kpiService.js`** (lines 1-388):
  - Implements: `list`, `create`, `mutateGoal`, `result`, `catalogs`, `importCsv`.
  - **MISSING**: `createFromAiGap` does not exist.
- **`kpiRepository.js`** (lines 1-78):
  - `subject()` in line 9 checks: `if (type === "LECTURER" && roles.includes("LECTURER"))`.
  - Note: Legacy role check only looks for `LECTURER`. Users with refactored role `MEMBER` or `ADMIN` or without a lecturer entry will be rejected by `repo.subject` unless handled properly.
- **`kpiSchemas.js`** (lines 1-170):
  - Contains schemas for `goalFields`, `goalSchema`, `resultSchema`, etc.
  - **MISSING**: Schema for AI gap input (`fromAiGapSchema`).

### 1.4 State of `backend/src/modules/calendar/`
- **`calendarRoutes.js`** (lines 1-17):
  - Line 7: `router.use(authenticate);`
  - Routes present:
    - `GET /me/calendar`
    - `GET /me/calendar/system`
    - `POST /me/calendar`
    - `PUT /me/calendar/:id`
    - `DELETE /me/calendar/:id`
  - **MISSING**: `POST /me/calendar/reminder` and `GET /me/calendar/reminders` do not exist.
- **`calendarService.js`** (lines 1-76):
  - Factory function `calendarService(run = query)` returning object with `list`, `listSystem`, `create`, `update`, `remove`, `missing`.
  - **MISSING**: `createReminder` and `listReminders` do not exist.

### 1.5 Predecessor `worker_m3` Status
- Checked git status: zero modifications in `backend/src/modules/kpi/` or `backend/src/modules/calendar/`.
- Checked `.agents/teamwork/worker_m3/progress.md`: Worker was paused during Gen 2 before completing any code changes.

---

## 2. Logic Chain

1. **Requirement Alignment**:
   - `ORIGINAL_REQUEST.md` (R3): Gap Analysis criteria not met must bridge directly to personal KPI goals with tracking metrics; and user must be able to save submission deadlines to Calendar.
   - `PROJECT.md` § 3 explicitly specifies:
     - `POST /api/v1/kpi/from-ai-gap`: Body `{ regulationId, missingCriteria: [...] }` -> inserts `app.kpi_goals` with `source = 'AI_GAP'`, `source_note = '...'`.
     - `POST /api/v1/me/calendar/reminder`: Body `{ title, deadlineDate, regulationId }` -> inserts into both `app.calendar_reminders` and `app.personal_calendar_events`.
2. **Database Integrity & Constraints Analysis**:
   - For `app.kpi_goals`:
     - Must satisfy `CHECK(source IN ('MANUAL', 'CSV', 'AI_GAP', 'AI_GAP_ANALYSIS', 'SYSTEM'))` -> using `'AI_GAP'` matches constraint.
     - `lecturer_id` and `unit_id`: for individual KPI, `lecturer_id IS NOT NULL` and `unit_id IS NULL`.
     - If a user lacks a record in `app.lecturers` (e.g. User 17 or new user), inserting directly would fail the foreign key `fk_kpi_goals_lecturer_id`. The service must resolve or auto-provision the lecturer record.
     - `context_unit_id` is NOT NULL: Must be retrieved from primary assignment or fallback to university root unit (LHU, `unit_id = 37`).
     - Unique index `kpi_goal_person_period(lecturer_id, code, period_start, period_end)`: If an existing DRAFT goal for the same code and period exists, the service should update the target or append plan/source_note rather than crashing on duplicate key.
     - Transactionality: Multiple criteria in `missingCriteria` must be inserted atomically via `withTransaction`.
   - For `app.calendar_reminders` & `app.personal_calendar_events`:
     - `app.personal_calendar_events.category` constraint strictly enforces `CHECK (category IN (N'exam',N'competition',N'task',N'personal'))`. Reminders MUST use category `'task'`.
     - `app.personal_calendar_events.title` max length is 160 characters and cannot be whitespace. Reminders title must be validated and safely clipped to 160.
     - `app.calendar_reminders` foreign keys to `app.regulation_documents(document_id)`, `app.award_periods(award_period_id)`, and `app.kpi_goals(goal_id)`: Invalid non-existent IDs should be verified to return `NotFoundError` (404) rather than raw DB error 547.
     - Both table records (`app.calendar_reminders` and `app.personal_calendar_events`) must be written in a single database transaction.

---

## 3. Caveats

1. **Role Resolution**: In M1, 4 roles are active: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`. The previous `kpiRepository.subject()` function had hard-coded checks for legacy `LECTURER` and `UNIT_REPRESENTATIVE`. For personal KPI from AI Gap, any authenticated user (`req.user`) who is an active user should be permitted to establish their personal KPI goals.
2. **Date Format Tolerance**: Frontend or AI check may supply date as `YYYY-MM-DD` or full ISO string `YYYY-MM-DDTHH:mm:ssZ`. The calendar reminder parser should support both and normalize to local wall clock time.
3. **No Direct Code Modifications in this Phase**: In compliance with the Teamwork Explorer read-only role, no source code has been altered during this turn. All changes are designed and ready for the worker.

---

## 4. Conclusion & Actionable Blueprint

### 4.1 Endpoint Contract 1: `POST /api/v1/kpi/from-ai-gap`
- **Route**: `backend/src/modules/kpi/kpiRoutes.js`:
  ```javascript
  router.post('/kpi/from-ai-gap', handle(req => service.createFromAiGap(req.user, req.body), 201));
  ```
- **Validation Schema** (`backend/src/modules/kpi/kpiSchemas.js`):
  ```javascript
  export const aiGapCriterionSchema = z.object({
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(255),
    missingCount: z.coerce.number().finite().min(0).default(1),
    unit: z.string().trim().max(80).optional().default('tiêu chí'),
    periodStart: date.optional(),
    periodEnd: date.optional(),
    plan: z.string().trim().max(4000).optional(),
  }).strict();

  export const fromAiGapSchema = z.object({
    regulationId: id,
    missingCriteria: z.array(aiGapCriterionSchema).min(1, 'Danh sách tiêu chí thiếu không được rỗng'),
    periodStart: date.optional(),
    periodEnd: date.optional(),
    plan: z.string().trim().max(4000).optional(),
  }).strict();
  ```
- **Service Logic** (`backend/src/modules/kpi/kpiService.js`):
  1. Validate `fromAiGapSchema.parse(raw)`.
  2. Query `SELECT document_id, title FROM app.regulation_documents WHERE document_id = $1`. If not found, throw `NotFoundError('Không tìm thấy quy chế')`.
  3. Resolve or create lecturer in `app.lecturers` for `user.userId`, and determine `context_unit_id` (fallback to LHU unit 37).
  4. In `withTransaction`:
     - For each criterion:
       - Default `period_start` to current year `YYYY-01-01` and `period_end` to `YYYY-12-31`.
       - Check if goal exists for `(lecturer_id, code, period_start, period_end)`. If exists and DRAFT, update target and note; if not, insert with `source = 'AI_GAP'`.
       - Record audit log `KPI_CREATE_FROM_GAP`.
  5. Return `{ goals: createdGoals, count: createdGoals.length, regulationId }`.

### 4.2 Endpoint Contract 2: `POST /api/v1/me/calendar/reminder` & `GET /api/v1/me/calendar/reminders`
- **Route** (`backend/src/modules/calendar/calendarRoutes.js`):
  ```javascript
  router.post('/me/calendar/reminder', handle(req => service.createReminder(req.user, req.body), 201));
  router.get('/me/calendar/reminders', handle(req => service.listReminders(req.user)));
  ```
- **Validation Schema** (`backend/src/modules/calendar/calendarService.js`):
  ```javascript
  export const createReminderSchema = z.object({
    title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
    deadlineDate: z.string().refine(val => {
      const d = new Date(val);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1990 && d.getUTCFullYear() <= 2100;
    }, 'Hạn nộp không hợp lệ (phải từ năm 1990 đến 2100)'),
    regulationId: idSchema.optional().nullable(),
    awardPeriodId: idSchema.optional().nullable(),
    kpiGoalId: idSchema.optional().nullable(),
    description: z.string().trim().max(4000).optional(),
  }).strict();
  ```
- **Service Logic** (`backend/src/modules/calendar/calendarService.js`):
  1. Validate payload.
  2. If `regulationId` provided, check exists in `app.regulation_documents`. If missing -> `NotFoundError('Không tìm thấy quy chế')`.
  3. If `awardPeriodId` provided, check exists in `app.award_periods`. If missing -> `NotFoundError('Không tìm thấy kỳ khen thưởng')`.
  4. If `kpiGoalId` provided, check exists in `app.kpi_goals`. If missing -> `NotFoundError('Không tìm thấy mục tiêu KPI')`.
  5. Format start/end time:
     - `startsAt`: `deadlineDate.includes('T') ? deadlineDate.slice(0, 16) : `${deadlineDate}T09:00``
     - `endsAt`: `deadlineDate.includes('T') ? deadlineDate.slice(0, 16) : `${deadlineDate}T10:00``
  6. In `withTransaction`:
     - Insert into `app.personal_calendar_events`:
       - `user_id`: `user.userId`, `title`: `title.slice(0, 160)`, `category`: `'task'`, `starts_at`, `ends_at`, `all_day`: false, `completed`: false.
       - Returns `event_id`.
     - Insert into `app.calendar_reminders`:
       - `user_id`: `user.userId`, `title`: `title`, `deadline_date`: `new Date(deadlineDate)`, `regulation_id`: `regulationId || null`, `award_period_id`: `awardPeriodId || null`, `kpi_goal_id`: `kpiGoalId || null`, `event_id`: `event_id`.
       - Returns `reminder_id`.
  7. Return `{ reminderId, eventId, title, deadlineDate, regulationId }`.
  8. `listReminders(user)`: Query `app.calendar_reminders` for `user_id` with regulation title join.

### 4.3 Test Suite Plan
Create two comprehensive automated test files in `backend/tests/`:
1. `backend/tests/kpi-from-ai-gap.test.js`:
   - Unit tests: schema rejection on missing `regulationId`, non-array `missingCriteria`, invalid dates, empty titles.
   - Integration tests: 401 unauthorized, 404 for nonexistent regulation, 201 success on creating KPI goals from gap criteria, verification of `source = 'AI_GAP'`, deduplication/upsert idempotency.
2. `backend/tests/calendar-reminder.test.js`:
   - Unit tests: schema rejection on empty title, invalid date format, invalid foreign key IDs.
   - Integration tests: 401 unauthorized, 404 for nonexistent regulation, 201 dual insertion into `app.calendar_reminders` and `app.personal_calendar_events`, verification in `GET /api/v1/me/calendar` and `GET /api/v1/me/calendar/reminders`, user data isolation.

---

## 5. Verification Method

To verify the investigation and subsequent implementation independently, run:
```powershell
# 1. Run database refactor check to ensure tables & constraints are intact
node database/sqlserver/verify-refactor.mjs

# 2. Run existing calendar tests to establish non-regression baseline
node --test backend/tests/calendar.test.js

# 3. After worker implements, run the new KPI & Calendar test suites:
node --test backend/tests/kpi-from-ai-gap.test.js
node --test backend/tests/calendar-reminder.test.js
```
All commands are repeatable, isolated in database transactions, and require zero mock server configuration.
