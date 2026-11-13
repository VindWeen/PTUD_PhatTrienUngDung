## 2026-11-12T21:56:34Z
You are teamwork_explorer_r2_2 (Explorer 2 for Iteration 2: Database Schema & Query Remediation).

Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_2
Original request path: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
Scope document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\SCOPE.md
Project plan: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md

REVIEWER 2 & CHALLENGER 1 REPORTS (READ FIRST):
- Reviewer 2: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\reviewer_2\handoff.md
- Challenger 1: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_1\handoff.md
- Challenger 2: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_2\handoff.md

CONTEXT:
Milestone 3 Iteration 1 had live database crashes on SQL Server due to invalid column names in 3 repositories:
1. `cvRepository.js:124`: `getUserContact` selects `u.full_name` from `app.users` (column does not exist; `app.users` only has `display_name`, while `full_name` is on `app.lecturers`).
2. `cvRepository.js:104`: `getUserActiveAchievements` selects `a.decision_number` and `a.issuing_authority` from `app.achievements` (neither column exists in `app.achievements`).
3. `organizationRepository.js:171, 184`: `getRegulationCriteria` selects `c.code` from `app.award_criteria_versions`, but the column is `c.criterion_code AS code`.
4. `kpiRepository.js:27`: `subject()` auto-provisioning selects `full_name` from `app.users` (column does not exist; only `display_name`).

INSTRUCTIONS:
1. Initialize your BRIEFING.md and progress.md in your state folder.
2. Read the defect details in Reviewer 2, Challenger 1, and Challenger 2 handoff reports.
3. Inspect `database/sqlserver/migrations/` (`001_final_schema.sql` and `005_refactor_personal_vault_and_cv.sql`) to verify the exact column names for `app.users`, `app.lecturers`, `app.achievements`, `app.award_criteria_versions`, and `app.cv_profiles`.
4. Formulate the exact SQL query corrections for:
   - `backend/src/modules/cv/cvRepository.js`
   - `backend/src/modules/organizations/organizationRepository.js`
   - `backend/src/modules/kpi/kpiRepository.js`
5. Write your comprehensive remediation plan in `handoff.md` in your state folder and notify caller.
