# Handoff Report: Database & Data Architecture Survey for System Refactoring

## 1. Observation

### 1.1. Execution Environment & SQL Server Status
- **Connection configuration**: `backend/.env` (lines 38-45) and `backend/src/config/database.js` configure connection to SQL Server:
  - Host: `localhost:1433`, Database: `PTUD_LHU`, User: `ptud_lhu_app`.
  - Encrypt: `false`, TrustServerCertificate: `true`.
- **Migration Status**:
  Command: `node database/scripts/migrate.js status`
  Output:
  ```
  [APPLIED] 001_final_schema.sql
  [APPLIED] 002_integrity_triggers.sql
  [APPLIED] 003_achievement_trash.sql
  [APPLIED] 004_achievement_trash_file_collation.sql
  ```
- **Table Count & `verify-live.mjs` Behavior**:
  Command: `node database/sqlserver/verify-live.mjs`
  Output:
  ```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  54 !== 53
      at file:///C:/DriveD/EverythingElse/LHU/PTUD_PhatTrienUngDung/database/sqlserver/verify-live.mjs:32:10
  ```
  **Root Cause**: `001_final_schema.sql` created 53 application tables in the `app` schema. `003_achievement_trash.sql` (line 5) created the 54th table: `app.achievement_trash_file_cleanup`. `verify-live.mjs` line 32 hardcoded `assert.equal(Number(metadata.rows[0].tables), 53)`.
- **Offline Schema & Runner Tests**:
  Command: `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`
  Result: 11 tests passed, 0 failed.

### 1.2. Existing Tables & Schema Constraints
1. **Roles (`app.roles`)**:
   Query: `SELECT role_id, code, name FROM app.roles`
   Current rows:
   - 1: `ADMIN` - Quản trị viên Hệ thống
   - 2: `LECTURER` - Giảng viên / Nghiên cứu viên
   - 3: `MANAGER` - Lãnh đạo Đơn vị (Trưởng Khoa/Bộ môn)
   - 4: `COUNCIL` - Hội đồng Khen thưởng
   - 5: `UNIT_REPRESENTATIVE` - Đại diện Đơn vị
   - 6: `RECORDS_OFFICER` - Cán bộ Văn thư
2. **Organization Units (`app.organization_units`)**:
   Definition in `001_final_schema.sql` (lines 50-62):
   - Constraint `ck_units_type CHECK (type IN ('FACULTY', 'DEPARTMENT', 'DIVISION', 'OFFICE', 'CENTER', 'UNIVERSITY'))`.
   - Cycle trigger: `app.trg_prevent_organization_cycle` in `002_integrity_triggers.sql` (line 6).
   Current rows:
   - 1: `FIT` (`Khoa Công nghệ Thông tin`, type: `FACULTY`, parent_id: `NULL`)
   - 2: `FIT_SE` (`Bộ môn Kỹ thuật Phần mềm`, type: `DEPARTMENT`, parent_id: `1`)
   - 3: `FIT_CS` (`Bộ môn Khoa học Máy tính`, type: `DEPARTMENT`, parent_id: `1`)
   - 4: `PHARM` (`Khoa Dược`, type: `FACULTY`, parent_id: `NULL`)
   *Observation: No root `UNIVERSITY` record currently exists. Khoa records currently have `parent_id = NULL`.*
3. **Achievements (`app.achievements`)**:
   Definition in `001_final_schema.sql`:
   - Line 133: `status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'DRAFT'`
   - Line 150: `CONSTRAINT ck_achievements_status CHECK ( status IN ('DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RETURNED') )`
   - Current status distribution in DB (12 records):
     - `DRAFT`: 3, `SUBMITTED`: 3, `VERIFIED`: 2, `NEED_CORRECTION`: 1, `REJECTED`: 1, `CANCELLED`: 1, `REVOKED`: 1.
   *Observation: `'ACTIVE'` status does NOT exist in `ck_achievements_status`. Inserting `'ACTIVE'` causes error 547 check constraint violation.*
4. **Evidences & Evidence Files (`app.evidences`, `app.evidence_files`)**:
   - `app.evidences` links `achievement_id` to evidence files.
   - `app.evidence_files` contains: `evidence_file_id`, `evidence_id`, `version_no`, `original_file_name`, `storage_key`, `mime_type`, `file_extension`, `file_size`, `sha256_hash`, `uploaded_by`, `uploaded_at`.
5. **Regulations, Criteria, and Periods**:
   - `app.award_periods`: `award_period_id`, `code`, `name`, `start_date`, `end_date`, `status`. Currently lacks a explicit `submission_deadline DATETIME2(3)` column.
   - `app.award_criteria_versions`: holds `source_rules` (JSON) and evaluation criteria.
   - `criteriaEvaluator.js` (lines 161-165):
     ```javascript
     if (!['VERIFIED', 'RECORDED'].includes(record.status)) {
       issues.add('MISSING_DATA');
       continue;
     }
     ```
     *Observation: Currently ignores any record not marked `VERIFIED` or `RECORDED`.*
6. **KPI Goals (`app.kpi_goals`) & KPI Results (`app.kpi_results`)**:
   - `001_final_schema.sql` line 442:
     `source NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK(source IN (N'MANUAL',N'CSV'))`
   - Line 461 in `app.kpi_results`:
     `source NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK(source IN (N'MANUAL',N'CSV'))`
   *Observation: Inserting `source = 'AI_GAP'` or `'AI_GAP_ANALYSIS'` will fail due to both length (15 > 10 chars) and check constraint.*
7. **CV and Profiles**:
   - Currently only `app.lecturer_cvs` exists (`lecturer_id BIGINT PRIMARY KEY`, `public_id NVARCHAR(32)`, `draft`, `published`).
   - `app.cv_profiles` does NOT exist yet.
   - `lecturer_cvs` is tied strictly to `lecturer_id`, not general `user_id`.
8. **Calendar Events & Reminders**:
   - Currently `app.personal_calendar_events` exists (`event_id`, `user_id`, `title`, `description`, `location`, `category`, `starts_at`, `ends_at`, `all_day`, `completed`, `version`).
   - `app.calendar_reminders` does NOT exist yet.
9. **Approval Tables**:
   - Tables related to multi-tiered council approvals: `app.award_applications`, `app.award_application_inputs`, `app.award_application_histories`, `app.application_reviews`, `app.application_review_comments`, `app.award_decisions`, `app.award_decision_files`, `app.achievement_verifications`, `app.achievement_submissions`.
   - Trigger `app.immutable_award_application_input` enforces immutability on `award_application_inputs`.

---

## 2. Logic Chain

1. **R1 (Kho Lưu trữ Thành tích Cá nhân & Immediate ACTIVE)**:
   - Observation 1.2.3 shows `app.achievements` defaults to `DRAFT` and rejects `'ACTIVE'` due to `ck_achievements_status`.
   - Therefore, to support immediate `ACTIVE` status:
     a. Drop constraint `ck_achievements_status`.
     b. Add updated CHECK constraint including `'ACTIVE'`: `status IN ('ACTIVE', 'DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RETURNED')`.
     c. Alter column default: `ALTER TABLE app.achievements ADD CONSTRAINT df_achievements_status DEFAULT N'ACTIVE' FOR status`.
     d. Migrate existing valid achievements: `UPDATE app.achievements SET status = 'ACTIVE' WHERE status IN ('DRAFT', 'SUBMITTED', 'VERIFIED')`.
     e. Update backend `achievementSchemas.js` and `achievementService.js` to default status to `'ACTIVE'`.
2. **R2 (Trợ lý AI Khám Quy chế, Khám Ngược & Xuất Gói Minh Chứng .ZIP)**:
   - Observation 1.2.5 shows `criteriaEvaluator.js` filters out non-`VERIFIED` records.
   - Therefore, update line 162 of `criteriaEvaluator.js` to accept `['ACTIVE', 'VERIFIED', 'RECORDED']`.
   - In `app.award_periods`, add `submission_deadline DATETIME2(3) NULL` to support precise deadline countdowns for popup notifications and calendar integration.
   - For Zip export, join `app.achievements`, `app.evidences`, and `app.evidence_files` to retrieve file paths from `backend/storage/private/evidences` and zip with `archiver`.
3. **R3 (Lộ trình KPI & Tích hợp Lịch Nhắc nhở)**:
   - Observation 1.2.6 shows `app.kpi_goals.source` and `app.kpi_results.source` are `NVARCHAR(10)` and restricted to `('MANUAL', 'CSV')`.
   - AI Gap analysis creates KPI goals from missing criteria with source `AI_GAP`.
   - Therefore, migration must:
     a. Drop check constraints on `source` in `app.kpi_goals` and `app.kpi_results`.
     b. Alter columns: `ALTER COLUMN source NVARCHAR(30) NOT NULL`.
     c. Add new CHECK constraints allowing `IN ('MANUAL', 'CSV', 'AI_GAP', 'AI_GAP_ANALYSIS', 'SYSTEM')`.
   - For calendar deadline popups, create `app.calendar_reminders` (`reminder_id`, `user_id`, `title`, `deadline_date`, `regulation_id`, `award_period_id`, `kpi_goal_id`, `event_id`, `is_completed`, `created_at`) and sync into `app.personal_calendar_events` (`category = 'competition' / 'task'`).
4. **R4 (Hồ sơ Năng lực & CV Cá nhân hóa)**:
   - Observation 1.2.7 shows `app.lecturer_cvs` is keyed by `lecturer_id` and lacks custom slugs, template IDs, custom DOCX template paths, and selectable achievement lists.
   - Therefore, create table `app.cv_profiles`:
     - Keyed by `user_id BIGINT PRIMARY KEY REFERENCES app.users(user_id)`.
     - Fields: `slug NVARCHAR(100) NULL`, `is_public BIT DEFAULT 0`, `template_id NVARCHAR(50) DEFAULT 'modern'`, `custom_docx_storage_key NVARCHAR(255) NULL`, `selected_achievement_ids NVARCHAR(MAX) NULL`, `bio NVARCHAR(MAX) NULL`, `headline NVARCHAR(255) NULL`, `version BIGINT DEFAULT 1`, timestamps.
     - Filtered unique index: `CREATE UNIQUE INDEX uq_cv_profiles_slug ON app.cv_profiles(slug) WHERE slug IS NOT NULL;`.
5. **R5 (Tinh gọn Cây Tổ chức & 4 Vai trò Chuẩn)**:
   - Observation 1.2.1 shows 6 existing roles (`ADMIN`, `LECTURER`, `MANAGER`, `COUNCIL`, `UNIT_REPRESENTATIVE`, `RECORDS_OFFICER`).
   - The required 4 roles are: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
   - Therefore, in `app.roles`:
     - Keep `ADMIN` (role_id 1).
     - Update `LECTURER` -> `MEMBER` (`code = 'MEMBER'`, `name = N'Thành viên'`).
     - Insert `DEPARTMENT_HEAD` (`code = 'DEPARTMENT_HEAD'`, `name = N'Trưởng Bộ môn'`).
     - Insert `FACULTY_LEAD` (`code = 'FACULTY_LEAD'`, `name = N'Ban Chủ nhiệm Khoa'`).
     - Deactivate legacy roles (`MANAGER`, `COUNCIL`, `UNIT_REPRESENTATIVE`, `RECORDS_OFFICER`) with `is_active = 0`.
     - Migrate `user_roles`: User 2 (`bich.tt`) gets `FACULTY_LEAD` (Khoa CNTT); User 4 (`cuong.lh`) gets `DEPARTMENT_HEAD` (Bộ môn KHMT); User 1 (`an.nv`) gets `MEMBER` (Bộ môn KTPM).
   - In `app.organization_units`:
     - Observation 1.2.2 shows Khoa has `parent_id = NULL`.
     - Insert root unit `LHU` (`code = 'LHU'`, `name = N'Trường Đại học Lạc Hồng'`, `type = 'UNIVERSITY'`, `parent_id = NULL`).
     - Update `FIT` and `PHARM` to have `parent_id = (SELECT unit_id FROM app.organization_units WHERE code = 'LHU')`.
     - Result is a clean 3-level tree: Trường (`LHU`) -> Khoa (`FIT`, `PHARM`) -> Bộ môn (`FIT_SE`, `FIT_CS`) -> Thành viên.
6. **R6 (Triển khai Toàn diện & Script Migration)**:
   - All database updates can be packaged into a single clean migration: `005_refactor_personal_vault_and_cv.sql`.
   - Update `verify-live.mjs` (or introduce `verify-refactor.mjs`) to reflect new table counts and check constraints.

---

## 3. Caveats

1. **Foreign Key Integrity**: Approval tables (`app.award_applications`, `app.application_reviews`, etc.) have foreign key references across the schema. To avoid breaking schema integrity or trigger dependencies (`app.immutable_award_application_input`), these tables should be retired from backend API routing and marked deprecated rather than abruptly dropped with `DROP TABLE CASCADE`.
2. **`verify-live.mjs` Table Count**: The existing `verify-live.mjs` script was written expecting exactly 53 tables. Any migration adding new tables (`app.cv_profiles`, `app.calendar_reminders`) will increase the count (currently 54, becoming 56). The verification script must be updated accordingly.
3. **Collation**: SQL Server uses `Latin1_General_100_BIN2` for strict case-sensitive and unique constraints across existing columns. All new string columns (`slug`, `template_id`, `custom_docx_storage_key`) must explicitly specify `COLLATE Latin1_General_100_BIN2` for consistency.

---

## 4. Conclusion & Concrete Blueprint

### 4.1. Proposed Migration: `005_refactor_personal_vault_and_cv.sql`
A complete blueprint for the migration file:

```sql
-- 005_refactor_personal_vault_and_cv.sql
-- Refactor database schema for Smart Achievement Vault & Career Assistant

-- 1. Update app.achievements status constraint and default to ACTIVE
DECLARE @chkName SYSNAME = (
  SELECT name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'app.achievements') AND name LIKE N'%ck_achievements_status%'
);
IF @chkName IS NOT NULL EXEC(N'ALTER TABLE app.achievements DROP CONSTRAINT ' + QUOTENAME(@chkName));

ALTER TABLE app.achievements ADD CONSTRAINT ck_achievements_status
  CHECK (status IN (N'ACTIVE', N'DRAFT', N'SUBMITTED', N'NEED_CORRECTION', N'VERIFIED', N'REJECTED', N'CANCELLED', N'REVOKED', N'RETURNED'));

DECLARE @defName SYSNAME = (
  SELECT dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID(N'app.achievements') AND c.name = N'status'
);
IF @defName IS NOT NULL EXEC(N'ALTER TABLE app.achievements DROP CONSTRAINT ' + QUOTENAME(@defName));

ALTER TABLE app.achievements ADD CONSTRAINT df_achievements_status DEFAULT N'ACTIVE' FOR status;

-- Migrate existing non-terminal achievements to ACTIVE
UPDATE app.achievements SET status = N'ACTIVE' WHERE status IN (N'DRAFT', N'SUBMITTED', N'VERIFIED');

-- 2. Add submission_deadline to app.award_periods
IF COL_LENGTH(N'app.award_periods', N'submission_deadline') IS NULL
  ALTER TABLE app.award_periods ADD submission_deadline DATETIME2(3) NULL;

-- 3. Expand source column and update check constraint on app.kpi_goals
DECLARE @kpiGoalChk SYSNAME = (
  SELECT name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'app.kpi_goals') AND definition LIKE N'%source%'
);
IF @kpiGoalChk IS NOT NULL EXEC(N'ALTER TABLE app.kpi_goals DROP CONSTRAINT ' + QUOTENAME(@kpiGoalChk));

ALTER TABLE app.kpi_goals ALTER COLUMN source NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL;
ALTER TABLE app.kpi_goals ADD CONSTRAINT ck_kpi_goals_source
  CHECK (source IN (N'MANUAL', N'CSV', N'AI_GAP', N'AI_GAP_ANALYSIS', N'SYSTEM'));

-- 4. Expand source column and update check constraint on app.kpi_results
DECLARE @kpiResChk SYSNAME = (
  SELECT name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'app.kpi_results') AND definition LIKE N'%source%'
);
IF @kpiResChk IS NOT NULL EXEC(N'ALTER TABLE app.kpi_results DROP CONSTRAINT ' + QUOTENAME(@kpiResChk));

ALTER TABLE app.kpi_results ALTER COLUMN source NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL;
ALTER TABLE app.kpi_results ADD CONSTRAINT ck_kpi_results_source
  CHECK (source IN (N'MANUAL', N'CSV', N'AI_GAP', N'AI_GAP_ANALYSIS', N'SYSTEM', N'ACHIEVEMENT'));

-- 5. Create app.cv_profiles
IF OBJECT_ID(N'app.cv_profiles', N'U') IS NULL
BEGIN
  CREATE TABLE app.cv_profiles (
    profile_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    slug NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NULL,
    is_public BIT NOT NULL DEFAULT 0,
    template_id NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'modern',
    custom_docx_storage_key NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NULL,
    selected_achievement_ids NVARCHAR(MAX) NULL,
    bio NVARCHAR(MAX) NULL,
    headline NVARCHAR(255) NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_cv_profiles_user_id FOREIGN KEY (user_id) REFERENCES app.users(user_id),
    CONSTRAINT ck_cv_profiles_selected_achievements_json CHECK (selected_achievement_ids IS NULL OR ISJSON(selected_achievement_ids) = 1)
  );
  CREATE UNIQUE INDEX uq_cv_profiles_slug ON app.cv_profiles(slug) WHERE slug IS NOT NULL;
END;

-- 6. Create app.calendar_reminders
IF OBJECT_ID(N'app.calendar_reminders', N'U') IS NULL
BEGIN
  CREATE TABLE app.calendar_reminders (
    reminder_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
    deadline_date DATETIME2(3) NOT NULL,
    regulation_id BIGINT NULL,
    award_period_id BIGINT NULL,
    kpi_goal_id BIGINT NULL,
    event_id BIGINT NULL,
    is_completed BIT NOT NULL DEFAULT 0,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_calendar_reminders_user_id FOREIGN KEY (user_id) REFERENCES app.users(user_id)
  );
END;

-- 7. Standardize 4 standard roles in app.roles
UPDATE app.roles SET code = N'MEMBER', name = N'Thành viên', description = N'Khai báo thành tích số, AI Check và quản lý CV cá nhân.' WHERE role_id = 2;

IF NOT EXISTS (SELECT 1 FROM app.roles WHERE code = N'DEPARTMENT_HEAD')
  INSERT INTO app.roles (code, name, description, is_active)
  VALUES (N'DEPARTMENT_HEAD', N'Trưởng Bộ môn', N'Quản lý nhân sự bộ môn, quét AI ứng viên đạt chuẩn và báo cáo bộ môn.', 1);

IF NOT EXISTS (SELECT 1 FROM app.roles WHERE code = N'FACULTY_LEAD')
  INSERT INTO app.roles (code, name, description, is_active)
  VALUES (N'FACULTY_LEAD', N'Ban Chủ nhiệm Khoa', N'Lãnh đạo cấp khoa, quét AI ứng viên toàn khoa và xuất báo cáo thống kê.', 1);

UPDATE app.roles SET is_active = 0 WHERE code IN (N'COUNCIL', N'RECORDS_OFFICER', N'UNIT_REPRESENTATIVE', N'MANAGER');

-- 8. Standardize 3-level organization hierarchy (Trường -> Khoa -> Bộ môn)
IF NOT EXISTS (SELECT 1 FROM app.organization_units WHERE code = N'LHU')
BEGIN
  INSERT INTO app.organization_units (code, name, parent_id, type, description, is_active, version)
  VALUES (N'LHU', N'Trường Đại học Lạc Hồng', NULL, N'UNIVERSITY', N'Cấp Đại học / Trường', 1, 1);
END;

DECLARE @lhuId BIGINT = (SELECT unit_id FROM app.organization_units WHERE code = N'LHU');
UPDATE app.organization_units SET parent_id = @lhuId WHERE type = N'FACULTY' AND (parent_id IS NULL OR parent_id <> @lhuId);
```

### 4.2. Actionable Checklist for Implementation Teams
- **Database Implementer**:
  - Implement `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`.
  - Run `node database/scripts/migrate.js up` to apply.
  - Create `database/sqlserver/verify-refactor.mjs` to test all new schemas, constraints, and data integrity.
- **Backend Implementer**:
  - Install required packages: `npm i docxtemplater pizzip archiver` in `backend/`.
  - Update `achievementService.js` to create achievements directly with status `ACTIVE`.
  - Implement `POST /achievements/ai-extract` in `achievementAiIngestService.js` with Vision OCR + graceful manual fallback.
  - Update `criteriaEvaluator.js` to evaluate `ACTIVE` achievements.
  - Implement `autoDiscoveryService.js` (`POST /ai/auto-discovery`) and `dossierPackagerService.js` (`POST /ai/export-dossier-zip`).
  - Implement `kpiService.js` (`POST /kpi/from-ai-gap`) inserting into `app.kpi_goals` with `source = 'AI_GAP'`.
  - Implement `cvService.js` with `slug`, public view (`GET /public/cv/:slug`), and DOCX template rendering.
  - Implement calendar deadline integration.
- **Frontend Implementer**:
  - Update `Achievements.jsx` (remove "Pending approval" badge, show "Sẵn sàng sử dụng", integrate AI OCR drag-and-drop).
  - Update `AIForecast.jsx` (Tab 1: Check with zip export & KPI transfer popup; Tab 2: Auto-Discovery).
  - Update `Kpi.jsx` (Roadmap from AI gap).
  - Update `CvEditor.jsx` & `PublicCv.jsx` (Slug, templates, DOCX export).
  - Clean up navigation routes (remove `award-applications` and `awards` links).

---

## 5. Verification Method

### 5.1. Verification Commands
1. Check migration status:
   ```powershell
   node database/scripts/migrate.js status
   ```
2. Apply migration 005:
   ```powershell
   node database/scripts/migrate.js up
   ```
3. Run schema offline tests:
   ```powershell
   node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
   ```
4. Verify refactored database tables and constraints:
   ```powershell
   node -e "import('./backend/src/config/database.js').then(async m => { const p = new m.Pool(); const r = await p.query('SELECT role_id, code, is_active FROM app.roles'); console.log('Roles:', r.rows); const ach = await p.query('SELECT status, count(*) c FROM app.achievements GROUP BY status'); console.log('Achievements:', ach.rows); const u = await p.query('SELECT unit_id, code, type, parent_id FROM app.organization_units'); console.log('Units:', u.rows); await p.end(); });"
   ```

### 5.2. Invalidation Conditions
- If any check constraint in `005` fails due to existing unexpected values, the migration will roll back atomically.
- If `app.trg_prevent_organization_cycle` triggers when setting Khoa `parent_id = LHU`, verify that LHU does not have any parent.
- If `verify-live.mjs` table assertion fails, update expected table count from 53 to 56.
