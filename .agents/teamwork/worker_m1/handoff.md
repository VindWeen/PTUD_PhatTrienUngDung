# Handoff Report: Milestone 1 - Database Layer & Migration

**Type**: Hard Handoff (Task Complete)
**Date**: 2026-11-12T13:19:00Z
**Author**: worker_m1 (implementer / qa / specialist)
**Recipient**: sub_orch_m1 (`92669e73-f5a9-40f2-ada7-342ed3bd2f8a`)

---

## 1. Observation

### Existing Database State Prior to Migration
- Applied migrations: `001_final_schema.sql`, `002_integrity_triggers.sql`, `003_achievement_trash.sql`, `004_achievement_trash_file_collation.sql`.
- `app.achievements`: Contained check constraint `ck_achievements_status` restricting statuses to `('DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RETURNED')` and default constraint defaulting to `N'DRAFT'`. 12 existing rows were populated with historical statuses.
- `app.award_periods`: Did not possess a `submission_deadline` column.
- `app.kpi_goals` & `app.kpi_results`: `source` column was `NVARCHAR(10)` with anonymous system check constraints `CK__kpi_goals__sourc__...` and `CK__kpi_resul__sourc__...` permitting only `N'CSV'` and `N'MANUAL'`.
- `app.cv_profiles`: Table did not exist.
- `app.calendar_reminders`: Table did not exist.
- `app.roles`: Only 6 roles existed: `ADMIN`, `LECTURER`, `MANAGER`, `COUNCIL`, `UNIT_REPRESENTATIVE`, `RECORDS_OFFICER`. Roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` were missing.
- `app.organization_units`: Contained `FIT`, `FIT_SE`, `FIT_CS`, `PHARM`. Root university unit `LHU` was missing; `FIT` and `PHARM` had `parent_id = NULL`.

### Changes Applied
- Authored `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`:
  - Dynamically dropped `ck_achievements_status` and default constraint on `app.achievements.status`.
  - Migrated existing 12 achievement rows to `status = 'ACTIVE'`.
  - Added new default constraint `df_achievements_status DEFAULT N'ACTIVE' FOR status`.
  - Added updated check constraint `ck_achievements_status` supporting `ACTIVE` and historical statuses.
  - Added column `submission_deadline DATETIME2(3) NULL` to `app.award_periods`.
  - Dropped system check constraints on `app.kpi_goals.source` and `app.kpi_results.source`, altered columns to `NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL`, and added check constraints `ck_kpi_goals_source` and `ck_kpi_results_source` allowing `MANUAL`, `CSV`, `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`.
  - Created table `app.cv_profiles` with `profile_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID()`, `user_id BIGINT NOT NULL REFERENCES app.users(user_id)`, `slug NVARCHAR(100) NULL`, `is_public BIT NOT NULL DEFAULT 0`, `template_id NVARCHAR(50) NOT NULL DEFAULT 'standard'`, timestamps, and filtered unique index `uq_cv_profiles_slug` where `slug IS NOT NULL`.
  - Created table `app.calendar_reminders` with `reminder_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID()`, `user_id BIGINT NOT NULL REFERENCES app.users(user_id)`, `title NVARCHAR(255) NOT NULL`, `deadline_date DATETIME2(3) NOT NULL`, `regulation_id BIGINT NULL REFERENCES app.regulation_documents(document_id)`, `award_period_id BIGINT NULL REFERENCES app.award_periods(award_period_id)`, `kpi_goal_id BIGINT NULL REFERENCES app.kpi_goals(goal_id)`, `event_id BIGINT NULL REFERENCES app.personal_calendar_events(event_id)`, `is_completed BIT NOT NULL DEFAULT 0`, `created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()`.
  - Created compatibility view `app.regulations` pointing to `app.regulation_documents`.
  - Inserted 4 standardized roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) with `is_active = 1`. Deactivated legacy roles `COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER` (`is_active = 0`).
  - Inserted root unit `LHU` (`code = 'LHU'`, `name = N'Trường Đại học Lạc Hồng'`, `type = 'UNIVERSITY'`, `parent_id = NULL`) and linked `FIT` and `PHARM` to have `parent_id` pointing to `LHU`.
- Applied migration via `node database/scripts/migrate.js up`:
  ```
  Applied SQL Server migration 005_refactor_personal_vault_and_cv.sql
  { appliedCount: 1, total: 5 }
  ```
- Authored verification script `database/sqlserver/verify-refactor.mjs`.
- Aligned table count assertion in `database/sqlserver/verify-live.mjs` from 53 to 56 (53 baseline + 1 trash cleanup + 2 new tables).

---

## 2. Logic Chain

1. **Foreign Key Integrity with SQL Server Identity Columns**: In `001_final_schema.sql`, `app.users.user_id`, `app.award_periods.award_period_id`, `app.kpi_goals.goal_id`, and `app.regulation_documents.document_id` are defined as `BIGINT`. A `UNIQUEIDENTIFIER` column in SQL Server cannot establish a foreign key reference to a `BIGINT` column (error 1778). Therefore, in `app.cv_profiles` and `app.calendar_reminders`, the referencing columns are typed as `BIGINT` with strict FK constraints to preserve relational integrity.
2. **Dynamic Constraint Management**: T-SQL auto-generated constraint names vary across environments. By querying `sys.check_constraints` and `sys.default_constraints` using `parent_object_id` and `COLUMNPROPERTY`, the migration safely and idempotently locates and drops previous constraints before creating deterministic named constraints.
3. **Set-Based Org Unit Hierarchy and Trigger Safety**: In `002_integrity_triggers.sql`, `trg_prevent_organization_cycle` validates recursive parent hierarchy. Inserting `LHU` with `parent_id = NULL` followed by updating `FIT` and `PHARM` to point to `LHU` produces a non-cyclic 3-level tree (`LHU` -> `FIT`/`PHARM` -> `FIT_SE`/`FIT_CS`), passing the trigger validation cleanly.
4. **Filtered Indexing on Slugs**: `uq_cv_profiles_slug` with `WHERE slug IS NOT NULL` allows uncustomized user profiles to share `NULL` slugs without collision while enforcing uniqueness for public vanity URLs.

---

## 3. Caveats

- In the existing SQL Server schema, regulations are managed in `app.regulation_documents` (PK `document_id`). To satisfy external queries expecting `app.regulations` without altering the audited base schema, a standard T-SQL view `app.regulations` was created.
- In `verify-live.mjs`, `--seed-rollback` is designed for an empty development database; the live test instance already contains development seed rows, so normal verification runs without `--seed-rollback`.

---

## 4. Conclusion

Milestone 1 database refactoring is fully completed:
- Migration `005_refactor_personal_vault_and_cv.sql` is applied to the live SQL Server instance and tracked in `app._schema_migrations`.
- Immediate `ACTIVE` status on `app.achievements` is active with valid constraints and all 12 existing achievements migrated.
- `app.award_periods.submission_deadline` is established.
- `app.kpi_goals` & `app.kpi_results` source constraints support `AI_GAP`, `AI_GAP_ANALYSIS`, and `SYSTEM`.
- `app.cv_profiles` and `app.calendar_reminders` tables are created with proper foreign keys and filtered unique index on `slug`.
- 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) are active; legacy roles are deactivated.
- 3-level organization hierarchy (LHU -> FIT/PHARM -> FIT_SE/FIT_CS) is established.
- All test suites (`verify-refactor.mjs`, `verify-live.mjs`, `schema.test.mjs`, `runner.test.mjs`) pass with 100% success.

---

## 5. Verification Method

To independently verify the database changes, execute the following commands from the workspace root:

```powershell
# 1. Verify migration status
node database/scripts/migrate.js status

# 2. Run Milestone 1 dedicated verification script
node database/sqlserver/verify-refactor.mjs

# 3. Run live schema verification
node database/sqlserver/verify-live.mjs

# 4. Run test runner and schema unit test suite
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
```

### Verification Command Outputs
```
[APPLIED] 001_final_schema.sql
[APPLIED] 002_integrity_triggers.sql
[APPLIED] 003_achievement_trash.sql
[APPLIED] 004_achievement_trash_file_collation.sql
[APPLIED] 005_refactor_personal_vault_and_cv.sql

--- Starting Milestone 1 Refactor Verification ---
1. Verifying app.achievements constraints & statuses...
  ✓ app.achievements: constraint allows ACTIVE, defaults to ACTIVE, 12 rows migrated
2. Verifying app.award_periods.submission_deadline...
  ✓ app.award_periods.submission_deadline DATETIME2(3) NULL confirmed
3. Verifying app.kpi_goals & app.kpi_results source column and constraints...
  ✓ app.kpi_goals and app.kpi_results source columns updated and constraints validated
4. Verifying app.cv_profiles...
  ✓ app.cv_profiles: table, 12 columns, and filtered unique index on slug confirmed
5. Verifying app.calendar_reminders...
  ✓ app.calendar_reminders: table exists with valid, trusted foreign keys
6. Verifying app.roles...
  ✓ app.roles: 4 primary roles active, 4 legacy roles deactivated
7. Verifying app.organization_units hierarchy...
  ✓ app.organization_units: 3-level tree confirmed (LHU [37] -> FIT/PHARM -> FIT_SE/FIT_CS)
8. Functional validation in isolated transaction...
  ✓ Functional insertions and constraint rejections verified (rolled back cleanly)

========================================
ALL REFACTOR VERIFICATIONS PASSED (100%)
========================================

PASS live schema metadata { tables: 56, enabled_triggers: 5, invalid_foreign_keys: 0 }

✔ migration parser handles GO and checksum normalizes CRLF
✔ already applied files are validated and not executed again
✔ checksum mismatch fails closed and rolls back
✔ failed schema batch rolls back the whole run without recording a migration
✔ demo seed requires explicit authorization before opening a connection
✔ baseline has all 53 final tables and columns from all 31 archived migrations
✔ native T-SQL has no surviving PostgreSQL executable syntax
✔ all baseline foreign keys point at existing columns, without duplicate relationships
✔ dropped evidence schema index does not survive; application versions/handoff preserved
✔ database safeguards include set-based cycle, range, immutable input and source rule tracking
✔ demo seed checks every application table and never deletes existing data
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
```
