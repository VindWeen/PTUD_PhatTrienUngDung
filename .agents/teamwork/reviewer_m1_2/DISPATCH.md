## 2026-11-12T13:20:13Z
You are Reviewer 2 for Milestone 1: Database Layer & Migration.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m1_2
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Project Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
**Scope Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\SCOPE.md
**Worker Handoff**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m1\handoff.md

MANDATORY FIRST STEP:
Read `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md` before starting your review.

### Your Objective
Review the implementation of SQL Server migration `005_refactor_personal_vault_and_cv.sql` and `database/sqlserver/verify-refactor.mjs`.
1. Verify correctness, completeness, robustness, and conformance against requirements:
   - Migration safety and idempotence (handling constraint re-creation, transaction boundaries).
   - `app.achievements`: check constraint allows `ACTIVE`, default constraint is `ACTIVE`, existing records migrated to `ACTIVE`.
   - `app.award_periods`: `submission_deadline DATETIME2(3) NULL`.
   - `app.kpi_goals` & `app.kpi_results`: `source` column expanded to `NVARCHAR(30)` with check constraint allowing `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, `CSV`.
   - `app.cv_profiles`: table structure, FK to users, filtered unique index on `slug`.
   - `app.calendar_reminders`: table structure, FKs to users, award_periods, kpi_goals, regulation_documents.
   - `app.roles`: 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) active (`is_active = 1`), legacy roles deactivated (`is_active = 0`).
   - `app.organization_units`: root `LHU` (type `UNIVERSITY`), `FIT` and `PHARM` linked to `LHU` forming clean 3-level tree.
2. Run verification commands:
   - `node database/scripts/migrate.js status`
   - `node database/sqlserver/verify-refactor.mjs`
   - `node database/sqlserver/verify-live.mjs`
   - `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`
3. Deliver verdict: Write a comprehensive review report in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m1_2\handoff.md` with explicit verdict `APPROVE` or `REQUEST_CHANGES`. Send completion message to sub-orchestrator.
