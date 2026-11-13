# BRIEFING — 2026-11-12T12:36:00Z

## Mission
Database & Data Architecture survey for system refactoring towards Smart Achievement Vault & Career Assistant.

## 🔒 My Identity
- Archetype: explorer
- Roles: Database & Data Architecture Explorer
- Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
- State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_1
- Original parent: 1e76c276-8bfa-46e8-963a-bb64503095c8
- Milestone: Database & Data Architecture Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT modify any code or run destructive migrations
- Regularly update progress.md as liveness heartbeat
- Produce structured 5-component handoff report

## Current Parent
- Conversation ID: 1e76c276-8bfa-46e8-963a-bb64503095c8
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `refactor_plan_achievement_vault_ai_assistant.md`
  - `database/sqlserver/migrations/` (001_final_schema.sql, 002_integrity_triggers.sql, 003_achievement_trash.sql, 004_achievement_trash_file_collation.sql)
  - `database/sqlserver/schema-manifest.json`, `seed.sql`, `verify-live.mjs`, `runner.test.mjs`, `schema.test.mjs`
  - `database/scripts/migrate.js`, `seed.js`, `seedScenario.js`
  - `backend/src/config/database.js`, `env.js`, `backend/.env`
  - `backend/src/modules/` (achievements, ai, kpi, cv, calendar, organizations)
- **Key findings**:
  1. Live DB is SQL Server on localhost:1433, db `PTUD_LHU`, user `ptud_lhu_app`. 4 migrations applied.
  2. Table count is currently 54 (003 added `app.achievement_trash_file_cleanup`). `verify-live.mjs` asserted 53, causing an assertion difference.
  3. `app.roles` currently has 6 roles (`ADMIN`, `LECTURER`, `MANAGER`, `COUNCIL`, `UNIT_REPRESENTATIVE`, `RECORDS_OFFICER`). Refactoring maps these to 4 target roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
  4. `app.achievements.status` has check constraint `ck_achievements_status` that excludes `'ACTIVE'`. Default is `DRAFT`. Migration must alter check constraint and default to allow `'ACTIVE'` and migrate existing data.
  5. `app.kpi_goals` and `app.kpi_results` have column `source NVARCHAR(10)` with check constraint `IN ('MANUAL', 'CSV')`. Needs expansion to `NVARCHAR(30)` and constraint update for `'AI_GAP'`.
  6. New tables needed: `app.cv_profiles` (with slug, is_public, template_id, custom docx key, selected achievements) and `app.calendar_reminders` (with deadline, regulation, event link).
  7. 3-level org hierarchy requires inserting root unit `LHU` (`UNIVERSITY`) and linking `FIT` and `PHARM` (`FACULTY`) under `LHU`.
- **Unexplored areas**: None for DB survey scope.

## Key Decisions Made
- Designed comprehensive migration 005 plan: `005_refactor_personal_vault_and_cv.sql` to cleanly cover R1 through R6 without breaking database trigger integrity.
- Identified non-destructive approach for retiring approval tables (deprecating endpoints while retaining schema compatibility).

## Artifact Index
- c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_1\handoff.md — Final investigation and DB refactoring blueprint
