# BRIEFING — 2026-11-12T22:45:00Z

## Mission
Investigate and formulate exact SQL query and repository remediations for SQL Server schema mismatches in `cvRepository.js`, `organizationRepository.js`, `kpiRepository.js`, and related modules.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
- State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_2
- Original parent: c4f8ee2a-a6b8-4150-930d-200ed34209c4
- Milestone: Milestone 3 Iteration 2 (Database Schema & Query Remediation)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Verify exact SQL Server schema column names and all affected repository queries
- Provide exact remediation code snippets and patches for downstream implementer

## Current Parent
- Conversation ID: c4f8ee2a-a6b8-4150-930d-200ed34209c4
- Updated: 2026-11-12T22:45:00Z

## Investigation State
- **Explored paths**:
  - `database/sqlserver/migrations/` (`001_final_schema.sql`, `005_refactor_personal_vault_and_cv.sql`, `003_achievement_trash.sql`)
  - `backend/src/modules/cv/cvRepository.js`
  - `backend/src/modules/organizations/organizationRepository.js`
  - `backend/src/modules/kpi/kpiRepository.js`
  - `backend/src/modules/cv/cvService.js` and `default_cv.docx`
  - `backend/src/modules/calendar/calendarService.js`
  - `backend/src/modules/kpi/kpiSchemas.js`
  - `backend/src/modules/cv/cvSchemas.js`
  - Reviewer 2, Challenger 1, Challenger 2 handoff reports
- **Key findings**:
  - `app.users` has NO `full_name`; only `display_name`. `full_name` is on `app.lecturers`.
  - `app.achievements` has NO `decision_number` or `issuing_authority`.
  - `app.award_criteria_versions` column is `criterion_code`, NOT `code`.
  - NEW DISCOVERY: `app.lecturer_assignments.assigned_by BIGINT NOT NULL` causes auto-provisioning to crash if `assigned_by` is omitted.
  - Docxtemplater loop tag malformation in `DOCUMENT_XML` and `default_cv.docx`.
  - Calendar date rollover and transaction atomicity fixes.
- **Unexplored areas**: None. All queries and edge cases verified directly on live SQL Server.

## Key Decisions Made
- Executed all proposed SQL queries directly against live Microsoft SQL Server (`MSI`) with code 0.
- Empirically proved Docxtemplater paragraph loop fix eliminating unparsed `{#achievements}` and `undefined` values.
- Documented full remediation plan in `handoff.md`.

## Artifact Index
- `BRIEFING.md` — persistent memory index
- `progress.md` — liveness heartbeat
- `DISPATCH.md` — incoming task log
- `handoff.md` — comprehensive 5-component remediation handoff report
