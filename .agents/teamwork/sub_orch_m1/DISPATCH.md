## 2026-11-12T12:49:30Z
You are the Sub-Orchestrator for Milestone 1: Database Layer & Migration.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1
**Scope Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\SCOPE.md
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Project Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
**Parent Conversation ID**: 1e76c276-8bfa-46e8-963a-bb64503095c8

### Milestone Scope
1. Implement migration `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`:
   - `app.achievements`: drop check constraint, alter check constraint to allow `ACTIVE`, alter default constraint to `ACTIVE`, update existing rows to `ACTIVE`.
   - `app.award_periods`: add `submission_deadline DATETIME2(3) NULL`.
   - `app.kpi_goals` & `app.kpi_results`: alter `source` column to `NVARCHAR(30)` and update check constraint to allow `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`.
   - `app.cv_profiles`: create table with `profile_id`, `user_id`, `slug`, `is_public`, `template_id`, `custom_docx_storage_key`, `selected_achievement_ids`, `bio`, `headline`, `version`, timestamps, unique filtered index on `slug`.
   - `app.calendar_reminders`: create table with `reminder_id`, `user_id`, `title`, `deadline_date`, `regulation_id`, `award_period_id`, `kpi_goal_id`, `event_id`, `is_completed`, `created_at`.
   - `app.roles`: standardize 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`), deactivate legacy roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`).
   - `app.organization_units`: insert root `LHU` (`type = 'UNIVERSITY'`), update `FIT` and `PHARM` to have `parent_id` pointing to `LHU`.
2. Apply migration via `node database/scripts/migrate.js up`.
3. Create/update verification script `database/sqlserver/verify-refactor.mjs` to comprehensively verify table creation, constraints, default values, role standardization, and org hierarchy.
4. Run schema tests: `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`.

### Orchestrator Procedure (Iteration Loop 2B)
As Sub-Orchestrator, follow the iteration loop:
- Spawn Worker (`teamwork_worker`) to implement the migration SQL and verification script. Include the MANDATORY INTEGRITY WARNING in the worker dispatch.
- Spawn Reviewers (`teamwork_reviewer`) to verify schema correctness, constraints, and migration idempotence.
- Spawn Challengers (`teamwork_challenger`) to stress-test schema constraints and test rollback / edge cases.
- Spawn Forensic Auditor (`teamwork_auditor`) to verify implementation authenticity and integrity.
- Evaluate the Gate in `GATE_STATUS.md`. On PASS, update `SCOPE.md`, record outputs in `handoff.md`, and notify parent.
