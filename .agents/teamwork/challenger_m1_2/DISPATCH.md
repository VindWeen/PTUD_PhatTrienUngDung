## 2026-11-12T13:20:45Z
You are Challenger 2 for Milestone 1: Database Layer & Migration.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m1_2
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Project Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
**Scope Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\SCOPE.md
**Worker Handoff**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m1\handoff.md

MANDATORY FIRST STEP:
Read `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md` before starting your verification.

### Your Objective
Adversarially challenge and stress-test the refactored SQL Server schema.
Perform empirical testing (e.g. create a temporary test runner script or execute isolated test queries against live DB that roll back):
1. Test migration idempotence and schema migration tracking:
   - Check `app._schema_migrations` table for entry `005_refactor_personal_vault_and_cv.sql`.
   - Run `node database/scripts/migrate.js up` again -> verify it reports 0 pending migrations and does not throw error.
2. Test schema edge cases:
   - Verify boundary conditions for `app.award_periods.submission_deadline` (valid DATETIME2, nullability).
   - Verify `app.cv_profiles` columns: test inserting large JSON in `selected_achievement_ids`, max string length for `slug` (100 chars), `headline` (255 chars), unicode in `bio`.
   - Verify `app.calendar_reminders` columns: test inserting reminders with various foreign key permutations (all null FKs except user, vs populated FKs).
   - Test roles: ensure inactive roles (`COUNCIL`, `RECORDS_OFFICER`, etc.) cannot be assigned if business rules require active roles, and standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) are present.
3. Clean up any test mutations (run tests inside transactions and ROLLBACK, or clean up after test).
4. Deliver verdict: Write a comprehensive report in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m1_2\handoff.md` with explicit verdict `APPROVE` or `REQUEST_CHANGES`. Send completion message to sub-orchestrator.
