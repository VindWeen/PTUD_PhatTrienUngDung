## 2026-11-12T13:20:26Z
You are Challenger 1 for Milestone 1: Database Layer & Migration.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m1_1
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Project Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
**Scope Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\SCOPE.md
**Worker Handoff**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m1\handoff.md

MANDATORY FIRST STEP:
Read `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md` before starting your verification.

### Your Objective
Adversarially challenge and stress-test the refactored SQL Server schema.
Perform empirical testing (e.g. create a temporary test runner script or execute isolated test queries against live DB that roll back):
1. Test constraint enforcement:
   - Attempt to insert invalid status in `app.achievements` (e.g. `BOGUS_STATUS`) -> must fail check constraint.
   - Insert valid status `ACTIVE` in `app.achievements` -> must succeed.
   - Insert default without status in `app.achievements` -> must default to `ACTIVE`.
   - Attempt to insert invalid source in `app.kpi_goals` and `app.kpi_results` (e.g. `INVALID_SOURCE`) -> must fail check constraint.
   - Insert valid sources `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM` -> must succeed.
2. Test slug unique filtered index on `app.cv_profiles`:
   - Insert two rows with `slug = NULL` for different users -> must SUCCEED (filtered index allows multiple NULLs).
   - Insert two rows with duplicate non-null slug (e.g. `john-doe`) -> must FAIL with unique index violation.
3. Test foreign keys and cycle prevention:
   - Attempt to insert into `app.cv_profiles` with non-existent `user_id` -> must fail FK constraint.
   - Attempt to insert into `app.calendar_reminders` with invalid FKs -> must fail FK constraints.
   - Attempt to create cyclic org hierarchy (e.g. set `LHU.parent_id = FIT`) -> trigger `trg_prevent_organization_cycle` must reject.
4. Clean up any test mutations (run tests inside transactions and ROLLBACK, or clean up after test).
5. Deliver verdict: Write a comprehensive report in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m1_1\handoff.md` with explicit verdict `APPROVE` or `REQUEST_CHANGES`. Send completion message to sub-orchestrator.
