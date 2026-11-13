# Review & Adversarial Critic Report: Milestone 1 - Database Layer & Migration

**Reviewer**: Reviewer 2 (`reviewer_m1_2`)
**Roles**: Reviewer, Adversarial Critic
**Date**: 2026-11-12T13:31:00Z
**Target Implementation**: `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`, `database/sqlserver/verify-refactor.mjs`, `database/sqlserver/verify-live.mjs`
**Verdict**: **APPROVE**

---

## 1. Observation

### Verification Commands & Direct Outputs

1. **Migration Status**:
   - Command: `node database/scripts/migrate.js status`
   - Output:
     ```
     [APPLIED] 001_final_schema.sql
     [APPLIED] 002_integrity_triggers.sql
     [APPLIED] 003_achievement_trash.sql
     [APPLIED] 004_achievement_trash_file_collation.sql
     [APPLIED] 005_refactor_personal_vault_and_cv.sql
     ```
   - Direct database observation: `app._schema_migrations` contains record with `migration_id = 5`, `name = '005_refactor_personal_vault_and_cv.sql'`, checksum matches sha256 of migration file.

2. **Dedicated Milestone 1 Verification Script**:
   - Command: `node database/sqlserver/verify-refactor.mjs`
   - Output:
     ```
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
     ```

3. **Live Schema Metadata Verification**:
   - Command: `node database/sqlserver/verify-live.mjs`
   - Output:
     ```
     PASS live schema metadata { tables: 56, enabled_triggers: 5, invalid_foreign_keys: 0 }
     ```

4. **Schema Unit & Runner Test Suite**:
   - Command: `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`
   - Output:
     ```
     ✔ migration parser handles GO and checksum normalizes CRLF (2.6059ms)
     ✔ already applied files are validated and not executed again (5.514ms)
     ✔ checksum mismatch fails closed and rolls back (2.7646ms)
     ✔ failed schema batch rolls back the whole run without recording a migration (2.2256ms)
     ✔ demo seed requires explicit authorization before opening a connection (0.4835ms)
     ✔ baseline has all 53 final tables and columns from all 31 archived migrations (21.261ms)
     ✔ native T-SQL has no surviving PostgreSQL executable syntax (1.2338ms)
     ✔ all baseline foreign keys point at existing columns, without duplicate relationships (1.2447ms)
     ✔ dropped evidence schema index does not survive; application versions/handoff preserved (0.4188ms)
     ✔ database safeguards include set-based cycle, range, immutable input and source rule tracking (0.4543ms)
     ✔ demo seed checks every application table and never deletes existing data (0.8594ms)
     ℹ tests 11
     ℹ suites 0
     ℹ pass 11
     ℹ fail 0
     ```

### Schema & Metadata Direct Observations

- `app.achievements`:
  - Check constraint `ck_achievements_status` definition:
    `([status]=N'PENDING' OR [status]=N'RETURNED' OR [status]=N'REVOKED' OR [status]=N'CANCELLED' OR [status]=N'REJECTED' OR [status]=N'APPROVED' OR [status]=N'VERIFIED' OR [status]=N'NEED_CORRECTION' OR [status]=N'SUBMITTED' OR [status]=N'DRAFT' OR [status]=N'ACTIVE')`
  - Default constraint `df_achievements_status` definition: `(N'ACTIVE')`
  - All 12 rows migrated to `status = 'ACTIVE'`.
- `app.award_periods`:
  - Column `submission_deadline` is `DATETIME2(3) NULL`.
- `app.kpi_goals` & `app.kpi_results`:
  - Column `source` is `NVARCHAR(30)` (`max_length = 60`) with binary collation `Latin1_General_100_BIN2`.
  - Check constraints `ck_kpi_goals_source` and `ck_kpi_results_source` enforce:
    `([source]=N'SYSTEM' OR [source]=N'AI_GAP_ANALYSIS' OR [source]=N'AI_GAP' OR [source]=N'CSV' OR [source]=N'MANUAL')`.
- `app.cv_profiles`:
  - Primary key: `profile_id UNIQUEIDENTIFIER DEFAULT NEWID()`.
  - Foreign key: `fk_cv_profiles_user` references `app.users(user_id)` (`is_disabled = 0`, `is_not_trusted = 0`).
  - Index: `uq_cv_profiles_slug` is unique, filtered with `WHERE ([slug] IS NOT NULL)`.
  - All 12 specified columns present (`profile_id`, `user_id`, `slug`, `is_public`, `template_id`, `custom_docx_storage_key`, `selected_achievement_ids`, `bio`, `headline`, `version`, `created_at`, `updated_at`).
- `app.calendar_reminders`:
  - Primary key: `reminder_id UNIQUEIDENTIFIER DEFAULT NEWID()`.
  - 5 Foreign keys all active and trusted:
    - `fk_calendar_reminders_user` -> `app.users(user_id)`
    - `fk_calendar_reminders_regulation` -> `app.regulation_documents(document_id)`
    - `fk_calendar_reminders_award_period` -> `app.award_periods(award_period_id)`
    - `fk_calendar_reminders_kpi_goal` -> `app.kpi_goals(goal_id)`
    - `fk_calendar_reminders_event` -> `app.personal_calendar_events(event_id)`
- `app.regulations`:
  - View mapping `document_id AS regulation_id, document_id, document_code, title, ...` from `app.regulation_documents`.
- `app.roles`:
  - 4 standard roles are active (`is_active = 1`): `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
  - Legacy workflow roles are deactivated (`is_active = 0`): `COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`.
  - Note: Legacy role `LECTURER` remains active (`is_active = 1`), preserving login and route authorization for demo users (`an.nv`, `bich.tt`, etc.) until M2/M3 backend refactor is introduced.
- `app.organization_units`:
  - Root unit `LHU` (type `UNIVERSITY`, `parent_id = NULL`, `unit_id = 37`).
  - Faculties `FIT` and `PHARM` have `parent_id = 37` (`LHU`).
  - Departments `FIT_SE` and `FIT_CS` have `parent_id = 1` (`FIT`).
  - Hierarchy forms a clean 3-level tree: LHU -> FIT/PHARM -> FIT_SE/FIT_CS.
  - Cycle prevention trigger `trg_prevent_organization_cycle` remains active and verified.

---

## 2. Logic Chain

1. **Idempotence & Safety of Migration Script**:
   - `005_refactor_personal_vault_and_cv.sql` dynamically queries `sys.check_constraints` and `sys.default_constraints` using column IDs to drop pre-existing anonymous or named constraints before re-creating them deterministically.
   - Batch delimiters (`GO`) are positioned around schema modification statements so that new columns (such as `submission_deadline`) and new tables (`cv_profiles`, `calendar_reminders`) are compiled and created before dependent queries or index creation statements are evaluated.
   - The migration runner wraps each migration in a transactional lock (`sp_getapplock` on `lhu_sqlserver_schema_migrations`), ensuring concurrency safety and rollback guarantees.

2. **Schema Correctness and Conformance**:
   - `app.achievements`: Default constraint `df_achievements_status` default value `N'ACTIVE'` ensures that any newly created achievements (e.g. `POST /achievements`) immediately gain `ACTIVE` status without administrative approval, fulfilling Requirement R1. All 12 pre-existing achievements were successfully migrated to `ACTIVE`.
   - `app.award_periods`: `submission_deadline DATETIME2(3) NULL` fulfills the prerequisite for Milestone 2/3 AI discovery ranking and deadline scheduling.
   - `app.kpi_goals` & `app.kpi_results`: Expanding `source` to `NVARCHAR(30)` with binary collation `Latin1_General_100_BIN2` and updating check constraints to include `AI_GAP`, `AI_GAP_ANALYSIS`, and `SYSTEM` directly enables Milestone 3 Requirement R3 (Gap Analysis to KPI Bridge).
   - `app.cv_profiles`: Filtered unique index on `slug` (`WHERE slug IS NOT NULL`) ensures vanity URL uniqueness (`/cv/:slug`) while cleanly supporting multiple unconfigured profiles with `slug = NULL`. Collation `Latin1_General_100_CI_AS_SC_UTF8` prevents case-variant slug collisions (e.g., `my-slug` vs `MY-SLUG`).
   - `app.calendar_reminders`: Referenced ID types strictly match SQL Server identity types (`BIGINT` for `users`, `award_periods`, `regulation_documents`, `kpi_goals`, `personal_calendar_events`), avoiding SQL Server Error 1778 (type mismatch in foreign keys).

3. **Integrity & Zero-Violation Assessment**:
   - Checked `database/sqlserver/verify-refactor.mjs` for hardcoded passes or mock bypasses: queries are executed dynamically against `sys.tables`, `sys.columns`, `sys.check_constraints`, `sys.foreign_keys`, and live tables.
   - Live functional testing includes real transactions executing inserts, duplicate slug collisions, NULL slug handling, reminder inserts, and invalid source check violations.

---

## 3. Adversarial Stress Test Results

Independent adversarial tests were executed directly against the live SQL Server instance:

| # | Stress Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|----------------------|-------------------|-----------------|--------|
| 1 | Achievement insertion without explicit status | Defaults to `'ACTIVE'` | Inserted row status = `'ACTIVE'` | **PASS** |
| 2 | Achievement insertion with invalid status (`'BOGUS_STATUS'`) | Rejected by check constraint `ck_achievements_status` | Conflict on CHECK constraint `ck_achievements_status` (SQL error 547) | **PASS** |
| 3 | Circular hierarchy update (`LHU.parent_id = FIT.unit_id`) | Rejected by `trg_prevent_organization_cycle` | Error: "Organization hierarchy cannot contain a cycle." (SQL error 50000) | **PASS** |
| 4 | Foreign key rejection on `calendar_reminders` (5 permutations) | Non-existent `user_id`, `regulation_id`, `award_period_id`, `kpi_goal_id`, `event_id` rejected | All 5 foreign key constraints raised FK violation errors | **PASS** |
| 5 | KPI source insertion with all 5 valid enum strings | All 5 sources (`AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, `CSV`) accepted | All 5 rows inserted successfully | **PASS** |
| 6 | KPI source insertion with lowercase variant (`'ai_gap'`) | Rejected by `ck_kpi_goals_source` under `Latin1_General_100_BIN2` collation | Conflict on CHECK constraint `ck_kpi_goals_source` | **PASS** |
| 7 | Duplicate non-null CV slug collision | Rejected by filtered unique index `uq_cv_profiles_slug` | Threw unique index duplicate key error | **PASS** |
| 8 | Multiple CV profiles with `slug = NULL` | Allowed without unique violation | Multiple NULL slug profiles inserted cleanly | **PASS** |

---

## 4. Integrity Attestation

- **Integrity Mode**: development
- **Hardcoded test outputs in source code**: None detected.
- **Dummy or facade implementations**: None detected.
- **Shortcuts bypassing task requirements**: None detected.
- **Fabricated verification outputs or logs**: None detected.
- **Self-certifying work without genuine verification**: None detected.

---

## 5. Caveats

1. **Role `LECTURER` Active Status**: In `005_refactor_personal_vault_and_cv.sql`, role `LECTURER` was kept `is_active = 1` while legacy workflow roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`) were deactivated (`is_active = 0`). This was intentional: existing backend endpoints and demo users (`an.nv`, `bich.tt`, etc.) rely on `LECTURER` until Milestone 2/3 refactors backend authorization to `MEMBER`.
2. **View `app.regulations`**: The base schema defines `app.regulation_documents` (PK `document_id`). To support external and future queries referencing `app.regulations`, a standard T-SQL view was added without altering audited historical tables.

---

## 6. Conclusion

The database layer implementation for Milestone 1 satisfies all requirements outlined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `SCOPE.md`.
- Schema changes are safe, transactional, and idempotent.
- All constraints, tables, indexes, roles, and hierarchy structures are verified live.
- Zero integrity violations or regressions detected.

**Final Verdict**: **APPROVE**

---

## 7. Verification Method

To independently reproduce and verify this review, run:

```powershell
# 1. Verify migration status
node database/scripts/migrate.js status

# 2. Run dedicated refactor verification suite
node database/sqlserver/verify-refactor.mjs

# 3. Run live schema metadata assertions
node database/sqlserver/verify-live.mjs

# 4. Run schema unit test suite
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
```
