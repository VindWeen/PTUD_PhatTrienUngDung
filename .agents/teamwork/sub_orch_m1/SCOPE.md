# Scope: Milestone 1 - Database Layer & Migration

## Status: DONE (Gate PASS)

## Architecture
SQL Server database schema refactoring under `database/sqlserver/migrations/` and verification scripts.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Personal Achievement Vault with immediate ACTIVE status | Migration to alter check constraint & default constraint to ACTIVE; migrate legacy rows | M1 | R1, Survey | DONE |
| 11 | 3-Level Organization Hierarchy | Insert root UNIVERSITY unit 'LHU', set Khoa 'FIT' and 'PHARM' parent_id = LHU | M1 | R5, Survey | DONE |
| 12 | 4 Standard Roles | Standardize app.roles: MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN; deactivate legacy roles | M1 | R5, Survey | DONE |
| 14a | Database Migration & Live Verification | Write 005_refactor_personal_vault_and_cv.sql, run migrate up, create verify-refactor.mjs | M1 | R6, Survey | DONE |

## Scope Details & Deliverables
1. Migration `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`:
   - `app.achievements`: Default constraint `df_achievements_status` set to `N'ACTIVE'`; check constraint `ck_achievements_status` updated to allow `ACTIVE`; 12 pre-existing achievements migrated to `ACTIVE`.
   - `app.award_periods`: Added `submission_deadline DATETIME2(3) NULL`.
   - `app.kpi_goals` & `app.kpi_results`: Expanded `source` column to `NVARCHAR(30)` with check constraint allowing `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, `CSV`.
   - `app.cv_profiles`: Created table with 12 columns, foreign key to `app.users(user_id)`, and filtered unique index `uq_cv_profiles_slug` where `slug IS NOT NULL`.
   - `app.calendar_reminders`: Created table with 10 columns and 5 trusted foreign keys to `users`, `award_periods`, `regulation_documents`, `kpi_goals`, and `personal_calendar_events`.
   - `app.regulations`: Created backward-compatible view over `app.regulation_documents`.
   - `app.roles`: 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) set active (`is_active = 1`); legacy roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`) deactivated (`is_active = 0`).
   - `app.organization_units`: Root `LHU` (type `UNIVERSITY`, `parent_id = NULL`) inserted; `FIT` and `PHARM` linked to `LHU` forming clean 3-level hierarchy (Trường -> Khoa -> Bộ môn).
2. Live Migration Application:
   - Applied via `node database/scripts/migrate.js up` (recorded in `app._schema_migrations`).
3. Verification Suites Passed:
   - `database/sqlserver/verify-refactor.mjs`: 100% PASS (8 test groups).
   - `database/sqlserver/verify-live.mjs`: PASS (56 tables, 5 triggers, 0 invalid foreign keys).
   - `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`: 11/11 tests pass.
   - `database/sqlserver/challenger2-stress.mjs`: 49/49 assertions pass (100%).
   - `tests/empirical_challenge_m1.test.mjs`: 33/33 empirical stress tests pass (100%).

## Code Layout
- Artifacts modified / created:
  - `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`
  - `database/sqlserver/verify-refactor.mjs`
  - `database/sqlserver/verify-live.mjs`
  - `database/sqlserver/challenger2-stress.mjs`
  - `tests/empirical_challenge_m1.test.mjs`
