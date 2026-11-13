# Handoff Report: Milestone 3 Investigation (Unit AI Scan, Org Hierarchy & Test Infrastructure)

**Agent**: `teamwork_explorer_m3_3`  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_3`  
**Date**: 2026-11-12T18:55:00Z  

---

## 1. Observation

### 1.1 Organization Hierarchy & Roles Architecture
- **Database Schema**:
  - `database/sqlserver/migrations/001_final_schema.sql:50-75`: defines `app.organization_units` (`unit_id`, `code`, `name`, `parent_id`, `type`, `is_active`, `version`).
  - `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql:131-177`:
    - Standardized 4 primary roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` (active = 1); deactivated legacy roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER` active = 0).
    - Standardized 3-level tree: Trường `LHU` (type `UNIVERSITY`, `parent_id = NULL`) -> Khoa `FIT`, `PHARM` (type `FACULTY`, `parent_id = LHU`) -> Bộ môn `FIT_SE`, `FIT_CS` (type `DEPARTMENT`, `parent_id = FIT`). Verified live in `database/sqlserver/verify-refactor.mjs:154-184`.
  - Member assignment: `app.lecturers` (`user_id`, `lecturer_id`, `full_name`, `email`) and `app.lecturer_assignments` (`assignment_id`, `lecturer_id`, `unit_id`, `is_primary`, `valid_from`, `valid_to`).
  - Unit Scopes: `app.user_unit_scopes` (`user_id`, `role_id`, `unit_id`, `include_descendants`, `valid_from`, `valid_to`, `revoked_at`).

### 1.2 Current State of `backend/src/modules/organizations/`
- `backend/src/modules/organizations/organizationRoutes.js`:
  - Lines 9-15:
    ```js
    router.get('/organizations', controller.list);
    router.get('/units/:id/profile', requireUnitRead, controller.profile);
    router.post('/organizations', requireRoles('ADMIN'), controller.create);
    router.patch('/organizations/:id', requireRoles('ADMIN'), controller.update);
    router.delete('/organizations/:id', requireRoles('ADMIN'), controller.remove);
    router.post('/organizations/:id/representative', requireRoles('ADMIN'), controller.appoint);
    router.post('/lecturers/:id/assignments', requireRoles('ADMIN'), controller.transfer);
    ```
  - **MISSING**: Endpoint `POST /api/v1/organizations/units/:id/ai-scan` (or `/units/:id/ai-scan`) is not declared.
- `backend/src/modules/organizations/organizationService.js`:
  - Contains CRUD methods: `listUnits`, `getUnitProfile`, `createUnit`, `updateUnit`, `removeUnit`, `appointRepresentative`, `transferLecturer`.
  - **MISSING**: AI scan evaluation method `scanUnitWithAi(unitId, regulationId, user)` is completely absent.
- `backend/src/modules/organizations/organizationRepository.js`:
  - Has `listUnits`, `findUnit`, `hasDescendant`, `getDependencyCounts`.
  - **MISSING**: Function to fetch all descendant units recursively and list lecturers/members assigned to those units.

### 1.3 Criteria Evaluator & Unit AI Scan Integration
- `backend/src/modules/ai/criteriaEvaluator.js`:
  - `evaluateStructuredCriterion({ subject, criterion, documentVersion, records, asOfDate, rules })`:
    - Evaluates subject against criterion deterministically.
    - Accurately handles `ACTIVE`, `VERIFIED`, `RECORDED` records from achievement vault (`005_refactor_personal_vault_and_cv.sql`).
    - Strips revoked/cancelled records (`REVOKED`, `CANCELLED`).
    - Calculates `isSatisfied`, `missingCount`, `thresholdMetric`.
- `backend/src/modules/ai/autoDiscoveryService.js`:
  - Lines 31-87 demonstrate the exact pattern of querying member achievements and award records, then iterating over criteria. This exact evaluator pattern can be reused for member scanning within a unit.

### 1.4 State of Other Milestone 3 Modules
- **KPI Module** (`backend/src/modules/kpi/`):
  - `kpiRoutes.js`: Contains `goals`, `import`, `recommendations`, `external`.
  - **MISSING**: `POST /api/v1/kpi/from-ai-gap` is not registered.
  - `kpiService.js`: Missing `createFromAiGap(user, payload)`.
  - `kpiRepository.js:32-54`: `createGoal` already exists and accepts `source`.
  - `005_refactor_personal_vault_and_cv.sql:74-79`: Database constraint on `app.kpi_goals.source` already allows `AI_GAP`.
- **Calendar Module** (`backend/src/modules/calendar/`):
  - `calendarRoutes.js`: Has `GET /me/calendar`, `POST /me/calendar`, `PUT /me/calendar/:id`, `DELETE /me/calendar/:id`.
  - **MISSING**: `POST /api/v1/me/calendar/reminder` is not registered.
  - `calendarService.js`: Missing `createReminder(user, payload)`.
  - `005_refactor_personal_vault_and_cv.sql:107-123`: Table `app.calendar_reminders` is already defined with columns (`reminder_id`, `user_id`, `title`, `deadline_date`, `regulation_id`, `award_period_id`, `kpi_goal_id`, `event_id`, `is_completed`).
- **CV Module** (`backend/src/modules/cv/`):
  - `cvRoutes.js`: Only has legacy routes accessing `app.lecturer_cvs` via hex IDs.
  - **MISSING**: `cvService.js` does not exist.
  - **MISSING**: `GET /api/v1/public/cv/:slug` (unauthenticated slug route with UUID fallback and privacy screen when `is_public = 0`).
  - **MISSING**: `PUT /api/v1/me/cv/profile` and `GET /api/v1/me/cv/profile` for managing `app.cv_profiles`.
  - **MISSING**: `GET /api/v1/me/cv/export-docx` using `docxtemplater` + `pizzip`.
  - Dependencies: `docxtemplater: ^3.71.1` and `pizzip: ^3.3.0` are already installed in `backend/package.json`.

### 1.5 Test Infrastructure & Runner
- **Test Runner**:
  - `backend/package.json` specifies `"test": "node tests/runner.js"`, and Node's native runner `node --test <files>` is standard.
  - Existing M1/M2 tests run via `node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js` pass with **19/19 tests passing in 1.34s**.
  - `backend/tests/runner.js:124`: Fails with 1 assertion failure (`assert.deepStrictEqual(files, ['001_final_schema.sql', '002_integrity_triggers.sql'])`) because migrations 003, 004, 005 were added after W1-Q3.
  - Zero dedicated test coverage exists yet for M3 features (`kpi/from-ai-gap`, `calendar/reminder`, `public/cv/:slug`, `cv/export-docx`, `organizations/units/:id/ai-scan`).

---

## 2. Logic Chain

1. **Hierarchy & Roles Alignment**:
   - `005_refactor_personal_vault_and_cv.sql` established the 3-level tree (Trường -> Khoa -> Bộ môn -> Thành viên) and the 4 active roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
   - For `POST /api/v1/organizations/units/:id/ai-scan`:
     - An `ADMIN` has authority across any unit.
     - A `FACULTY_LEAD` must only scan units within their faculty (their own faculty unit or any child department of that faculty).
     - A `DEPARTMENT_HEAD` must only scan their own department unit.
     - A `MEMBER` must receive 403 Forbidden.
   - When a unit is scanned:
     - If the target unit is a `FACULTY`, it must traverse and include members of all child `DEPARTMENT` units under that faculty.
     - If the target unit is a `DEPARTMENT`, it scans members of that department.
     - If the target unit is `UNIVERSITY`, it scans members across the entire institution.

2. **Integration with `criteriaEvaluator.js`**:
   - Each member in the target unit has personal records in `app.achievements` (`ACTIVE`, `VERIFIED`, `RECORDED`) and `app.award_records`.
   - The criteria for the regulation document are pulled from `app.award_criteria_versions`.
   - Running `evaluateStructuredCriterion` per criterion per member produces:
     - `percentage`: `Math.round((satisfiedCount / totalCount) * 100)`
     - `isEligible`: `satisfiedCount === totalCount && totalCount > 0`
     - `matched`: list of matched criteria with evidence
     - `missing`: list of unmet criteria
   - Output matches the contract in `PROJECT.md`:
     `{ "unitId": id, "regulationId": regId, "results": [ { "userId": 1, "fullName": "...", "percentage": 100, "isEligible": true, "matched": [...], "missing": [...] } ] }`.

3. **Status of `worker_m3`**:
   - `worker_m3` in Generation 2 halted before writing code for M3 endpoints.
   - All 4 module extensions and tests need to be implemented by `worker_m3` in Generation 3.

---

## 3. Caveats

1. **Route Prefix Aliasing**:
   - `backend/src/app.js:69` mounts `app.use(apiPrefix, organizationRoutes)`.
   - To prevent routing mismatches between `/api/v1/organizations/units/:id/ai-scan` and `/api/v1/units/:id/ai-scan`, both paths should be mounted in `organizationRoutes.js`.
2. **Database Connection in Automated Tests**:
   - Automated test suites in `backend/tests/` should use mock database adapters (or dependency injection) to run deterministically and fast without requiring an active live SQL Server connection, matching the pattern established in `ai-auto-discovery.test.js` and `achievement-vault-active.test.js`.
3. **Legacy `backend/tests/runner.js`**:
   - Line 124 of `runner.js` hardcodes a check for only 2 migration files. This can be updated to include migrations 003, 004, 005 or tested separately.

---

## 4. Conclusion & Actionable Blueprint for `worker_m3`

`worker_m3` must execute the following 5 tasks:

### Task 1: Organization Unit AI Scan & Role Authorization
- **File**: `backend/src/modules/organizations/organizationRoutes.js`
  - Add route:
    `router.post(['/organizations/units/:id/ai-scan', '/units/:id/ai-scan'], requireRoles('DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'), controller.aiScan);`
- **File**: `backend/src/modules/organizations/organizationController.js`
  - Add `aiScan(req, res, next)`: validates `req.params.id` and `req.body.regulationId`, delegates to service.
- **File**: `backend/src/modules/organizations/organizationService.js` & `organizationRepository.js`:
  - Implement `scanUnitWithAi(unitId, regulationId, user, client)`:
    1. Check user permission against `unitId`:
       - If `ADMIN`: allow.
       - If `FACULTY_LEAD`: verify `unitId` is their faculty or a child department of their faculty.
       - If `DEPARTMENT_HEAD`: verify `unitId` is their department.
       - Else: throw `ForbiddenError`.
    2. Hierarchy traversal:
       - Query descendant units with CTE:
         `WITH DescendantUnits AS (SELECT unit_id, parent_id, type FROM app.organization_units WHERE unit_id = $1 UNION ALL SELECT u.unit_id, u.parent_id, u.type FROM app.organization_units u JOIN DescendantUnits d ON u.parent_id = d.unit_id WHERE u.is_active = 1)`
    3. Query members assigned to those units:
       - `SELECT DISTINCT l.lecturer_id, l.user_id, l.full_name, l.email FROM app.lecturers l JOIN app.lecturer_assignments a ON a.lecturer_id = l.lecturer_id WHERE a.unit_id IN (SELECT unit_id FROM DescendantUnits) AND l.is_active = 1 AND a.valid_from <= SYSUTCDATETIME() AND (a.valid_to IS NULL OR a.valid_to > SYSUTCDATETIME())`
    4. Fetch criteria for `regulationId` and run `evaluateStructuredCriterion` for each member's achievements.
    5. Construct and return `{ unitId, regulationId, results }`.

### Task 2: KPI Gap Bridge
- **File**: `backend/src/modules/kpi/kpiRoutes.js`:
  - Add `router.post('/kpi/from-ai-gap', handle(req => service.createFromAiGap(req.user, req.body), 201));`
- **File**: `backend/src/modules/kpi/kpiService.js`:
  - Implement `createFromAiGap(user, payload)`:
    - Validate schema (criterionId, goalTitle, target, measureUnit, periodStart, periodEnd, plan).
    - Insert into `app.kpi_goals` with `source = 'AI_GAP'`.

### Task 3: Calendar Deadline Reminders
- **File**: `backend/src/modules/calendar/calendarRoutes.js`:
  - Add `router.post('/me/calendar/reminder', handle(req => service.createReminder(req.user, req.body), 201));`
  - Add `router.get('/me/calendar/reminders', handle(req => service.listReminders(req.user)));`
- **File**: `backend/src/modules/calendar/calendarService.js`:
  - Implement `createReminder(user, payload)`:
    - Insert into `app.calendar_reminders` (`reminder_id = NEWID()`, `user_id = user.userId`, `title`, `deadline_date`, `regulation_id`, `award_period_id`, `kpi_goal_id`).
    - Synchronize into `app.personal_calendar_events` (`category: 'task'`).

### Task 4: CV Profiles, Custom Slug & DOCX Export
- **File**: `backend/src/modules/cv/cvService.js` (create new):
  - `getPublicCvBySlug(slugOrId)`: returns `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }` if private, or full data if public.
  - `getProfile(userId)`: retrieves `app.cv_profiles`.
  - `updateProfile(userId, payload)`: upserts `app.cv_profiles` (`slug`, `is_public`, `template_id`, `selected_achievement_ids`, `bio`, `headline`).
  - `exportDocx(userId)`: uses `docxtemplater` + `pizzip` to render docx and return buffer.
- **File**: `backend/src/modules/cv/cvRoutes.js`:
  - Add `GET /public/cv/:slug` (unauthenticated).
  - Add `GET /me/cv/profile` (authenticated).
  - Add `PUT /me/cv/profile` (authenticated).
  - Add `GET /me/cv/export-docx` (authenticated).

### Task 5: Automated Test Suites
- Create `backend/tests/milestone3-extended.test.js` (or individual test suites):
  1. `KPI Bridge`: tests `from-ai-gap` insertion, `source = 'AI_GAP'`, validation, and authorization.
  2. `Calendar Reminder`: tests scheduling deadline reminders into `app.calendar_reminders` and `personal_calendar_events`.
  3. `CV Custom Slug & DOCX Export`: tests public access with `is_public` = 0 vs 1, slug lookup, template selection, and binary DOCX rendering.
  4. `Unit AI Scan & Org Hierarchy`: tests role authorization (`DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` vs `MEMBER`), hierarchy traversal (Khoa -> Bộ môn -> Thành viên), percentage calculation, and response format.
- Update `backend/tests/runner.js:124` to expect migrations 001 through 005.

---

## 5. Verification Method

To independently verify all findings and validate future implementations:

1. **Inspect Organization Modules and Middlewares**:
   ```powershell
   Get-Content backend\src\modules\organizations\organizationRoutes.js
   Get-Content backend\src\modules\organizations\organizationService.js
   ```
2. **Run Existing Test Suites**:
   ```powershell
   node --test backend\tests\achievement-vault-active.test.js backend\tests\ai-criteria-active.test.js backend\tests\ai-auto-discovery.test.js backend\tests\dossier-packager-zip.test.js backend\tests\calendar.test.js backend\tests\cv.test.js backend\tests\unit-profile-access.test.js
   ```
   *Expected*: All 30 tests pass cleanly without errors.
3. **Verify Milestone 3 Tests (Once implemented by worker_m3)**:
   ```powershell
   node --test backend\tests\milestone3-extended.test.js
   ```
   *Pass Condition*: 100% assertions pass, zero regressions, all 4 endpoints respond with expected payloads.
