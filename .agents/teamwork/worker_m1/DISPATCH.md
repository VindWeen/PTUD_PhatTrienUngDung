## 2026-11-12T12:51:57Z
You are the Worker for Milestone 1: Database Layer & Migration.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m1
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Project Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
**Scope Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\SCOPE.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md` before starting any work.

### Your Objective
Implement the SQL Server migration `005_refactor_personal_vault_and_cv.sql`, apply it to the database, and verify it with a comprehensive script and existing test suite.

### File Ownership
You have exclusive write ownership of:
- `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`
- `database/sqlserver/verify-refactor.mjs`
- `database/sqlserver/verify-live.mjs` (if necessary to align assertions)

### Implementation Requirements
1. Examine existing migrations in `database/sqlserver/migrations/` (001, 002, 003, 004) to match conventions, transactional style, and error handling.
2. Create `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`:
   - `app.achievements`:
     * Drop existing check constraint on `status` (check existing constraint name dynamically or by standard naming, e.g. `chk_achievements_status` or inspect sys.check_constraints).
     * Add new check constraint allowing `ACTIVE` (and keeping any valid historical states needed, e.g. `PENDING`, `APPROVED`, `REJECTED`, `ACTIVE`).
     * Drop existing default constraint on `status` and add new default constraint `DEFAULT 'ACTIVE'`.
     * Update existing rows with `status = 'APPROVED'` or other statuses to `ACTIVE` (per requirement: existing rows migrate to `ACTIVE`).
   - `app.award_periods`:
     * Add column `submission_deadline DATETIME2(3) NULL`.
   - `app.kpi_goals` & `app.kpi_results`:
     * Alter `source` column to `NVARCHAR(30)` NOT NULL (or NULL as matches existing).
     * Drop existing check constraint on `source` and add new check constraint to allow `MANUAL`, `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM` (and any existing allowed sources).
   - `app.cv_profiles`:
     * Create table `app.cv_profiles` if not exists:
       - `profile_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY`
       - `user_id UNIQUEIDENTIFIER NOT NULL REFERENCES app.users(user_id)`
       - `slug NVARCHAR(100) NULL`
       - `is_public BIT NOT NULL DEFAULT 0`
       - `template_id NVARCHAR(50) NOT NULL DEFAULT 'standard'`
       - `custom_docx_storage_key NVARCHAR(500) NULL`
       - `selected_achievement_ids NVARCHAR(MAX) NULL` (JSON array or list)
       - `bio NVARCHAR(MAX) NULL`
       - `headline NVARCHAR(255) NULL`
       - `version INT NOT NULL DEFAULT 1`
       - `created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()`
       - `updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()`
     * Create unique filtered index on `slug`: `CREATE UNIQUE INDEX uq_cv_profiles_slug ON app.cv_profiles(slug) WHERE slug IS NOT NULL`.
   - `app.calendar_reminders`:
     * Create table `app.calendar_reminders` if not exists:
       - `reminder_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY`
       - `user_id UNIQUEIDENTIFIER NOT NULL REFERENCES app.users(user_id)`
       - `title NVARCHAR(255) NOT NULL`
       - `deadline_date DATETIME2(3) NOT NULL`
       - `regulation_id UNIQUEIDENTIFIER NULL REFERENCES app.regulations(regulation_id)`
       - `award_period_id UNIQUEIDENTIFIER NULL REFERENCES app.award_periods(period_id)`
       - `kpi_goal_id UNIQUEIDENTIFIER NULL REFERENCES app.kpi_goals(goal_id)`
       - `event_id UNIQUEIDENTIFIER NULL`
       - `is_completed BIT NOT NULL DEFAULT 0`
       - `created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()`
   - `app.roles`:
     * Standardize 4 primary roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` (ensure they exist and are active: `is_active = 1`).
     * Deactivate legacy roles: `UPDATE app.roles SET is_active = 0 WHERE code IN ('COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER')`.
   - `app.organization_units`:
     * Insert root unit `LHU`: `code = 'LHU'`, `name = N'Trường Đại học Lạc Hồng'`, `type = 'UNIVERSITY'`, `parent_id = NULL`.
     * Update existing faculty units `FIT` and `PHARM` to have `parent_id` set to the `LHU` unit_id.
3. Apply migration:
   Run `node database/scripts/migrate.js up` via PowerShell command tool. Verify that it applies 005 successfully.
4. Verification:
   - Create/update `database/sqlserver/verify-refactor.mjs` to connect to the database and assert:
     * Check constraints and default constraint on `app.achievements`
     * `submission_deadline` column in `app.award_periods`
     * `source` column type and check constraints in `app.kpi_goals` & `app.kpi_results`
     * `app.cv_profiles` table exists and filtered unique index on `slug` exists
     * `app.calendar_reminders` table exists with proper foreign keys
     * 4 standard roles are active and legacy roles are inactive
     * Root org unit `LHU` exists with type `UNIVERSITY` and `FIT`/`PHARM` have `parent_id` pointing to `LHU`
   - Run verification script: `node database/sqlserver/verify-refactor.mjs`
   - Run schema test suite: `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`
5. Documentation & Handoff:
   - Write a complete handoff report to `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m1\handoff.md`.
   - Include all command outputs, SQL execution logs, verification test output, and test pass/fail results.
   - Send completion message to sub-orchestrator.
