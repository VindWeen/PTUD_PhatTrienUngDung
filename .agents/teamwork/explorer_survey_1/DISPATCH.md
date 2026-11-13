## 2026-11-12T12:23:11Z
From: 1e76c276-8bfa-46e8-963a-bb64503095c8
Priority: MESSAGE_PRIORITY_HIGH

You are an Explorer focusing on the Database & Data Architecture survey for the system refactoring.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_1
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Reference Plan**: C:\Users\fw622\.gemini\antigravity\brain\f2ea0eeb-5109-4a80-b550-ac96bd3759fc\refactor_plan_achievement_vault_ai_assistant.md

### Objective
Investigate the current database schema, existing migrations, ORM/query patterns, verification scripts, seed scripts, and roles/tables in SQL Server to map what needs to be refactored for the Smart Achievement Vault & Career Assistant.

### Tasks
1. Read `ORIGINAL_REQUEST.md` and the reference plan.
2. Inspect `database/sqlserver/` (migrations, scripts, `verify-live.mjs`, seed files).
3. Analyze current schema and tables:
   - `app.roles` (currently what roles exist vs 4 target roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
   - `app.organization_units` and users hierarchy (Trường -> Khoa -> Bộ môn -> Thành viên).
   - `app.achievements` and `app.evidence_files` (current status values, constraints, check constraints, default values). Target: `ACTIVE` status immediate.
   - `app.regulations`, criteria, and periods (submission deadlines, criteria rules).
   - CV profiles (`app.cv_profiles`): slug, is_public, template_id, custom_docx_storage_key, selected_achievement_ids.
   - Calendar reminders table (`app.calendar_reminders` or equivalent).
   - KPI goals table (`app.kpi_goals` or equivalent).
   - Redundant approval tables to decommission or clean up (`award_applications`, `application_reviews`, etc.).
4. Test/check execution environment: how `verify-live.mjs` runs, connection configuration, existing seed data.
5. Identify all DB migrations, scripts, and tables needed to satisfy Requirements R1 through R6.

### Constraints & Output
- READ-ONLY: DO NOT modify any code or run destructive migrations.
- Regularly update `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_1\progress.md`.
- Produce a thorough, structured survey report at `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_1\handoff.md`.
- Send a completion message back to the orchestrator when finished.
