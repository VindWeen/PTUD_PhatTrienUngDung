# Review & Adversarial Stress-Test Report: Milestone 1 Database Layer & Migration

**Type**: Hard Handoff
**Date**: 2026-11-12T13:32:00Z
**Author**: Reviewer 1 (reviewer / critic)
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m1_1`
**Recipient**: sub_orch_m1 (`92669e73-f5a9-40f2-ada7-342ed3bd2f8a`)

---

## Review Summary

**Verdict**: **APPROVE**
**Overall Risk Assessment**: LOW
**Integrity Audit**: PASSED (No shortcuts, facades, fabricated outputs, or hardcoded results found)

---

## 1. Observation

### Implementation Files Inspected
1. `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql` (177 lines):
   - Lines 5-26: Drops existing `ck_achievements_status` and default constraint on `app.achievements.status` dynamically via `sys.check_constraints` and `sys.default_constraints`.
   - Line 29: Executes `UPDATE app.achievements SET status = N'ACTIVE';`.
   - Lines 32-36: Adds default constraint `df_achievements_status DEFAULT N'ACTIVE' FOR status` and check constraint `ck_achievements_status` accepting `ACTIVE`, `DRAFT`, `SUBMITTED`, `NEED_CORRECTION`, `VERIFIED`, `APPROVED`, `REJECTED`, `CANCELLED`, `REVOKED`, `RETURNED`, `PENDING`.
   - Lines 40-43: Adds `submission_deadline DATETIME2(3) NULL` to `app.award_periods`.
   - Lines 47-78: Drops previous source check constraints, alters `source` column to `NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL` on both `app.kpi_goals` and `app.kpi_results`, and attaches constraints `ck_kpi_goals_source` and `ck_kpi_results_source` allowing `MANUAL`, `CSV`, `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`.
   - Lines 82-105: Creates table `app.cv_profiles` with `profile_id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY`, foreign key `fk_cv_profiles_user` referencing `app.users(user_id)`, and filtered unique index `uq_cv_profiles_slug` where `slug IS NOT NULL`.
   - Lines 108-129: Creates table `app.calendar_reminders` with foreign keys to `app.users(user_id)`, `app.regulation_documents(document_id)`, `app.award_periods(award_period_id)`, `app.kpi_goals(goal_id)`, and `app.personal_calendar_events(event_id)`. Creates view `app.regulations` over `app.regulation_documents`.
   - Lines 132-163: Inserts and sets `is_active = 1` for `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`. Sets `is_active = 0` for `COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, and `MANAGER`.
   - Lines 166-177: Inserts root organization unit `LHU` (type `UNIVERSITY`, `parent_id = NULL`) and updates faculties `FIT` and `PHARM` to point to `LHU` (`parent_id = 37`).

2. `database/sqlserver/verify-refactor.mjs` (257 lines):
   - Performs 8 distinct live assertions querying SQL Server catalog views (`sys.check_constraints`, `sys.default_constraints`, `INFORMATION_SCHEMA.COLUMNS`, `sys.indexes`, `sys.foreign_keys`, `app.roles`, `app.organization_units`) and executes transactional insert/rejection tests.

3. `database/sqlserver/verify-live.mjs`:
   - Updated baseline table count assertion from 53 to 56: 53 baseline tables + 1 `app.achievement_trash` + 2 new tables (`app.cv_profiles`, `app.calendar_reminders`).

### Verification Commands Executed Directly by Reviewer
- `node database/scripts/migrate.js status`:
  ```
  [APPLIED] 001_final_schema.sql
  [APPLIED] 002_integrity_triggers.sql
  [APPLIED] 003_achievement_trash.sql
  [APPLIED] 004_achievement_trash_file_collation.sql
  [APPLIED] 005_refactor_personal_vault_and_cv.sql
  ```
- `node database/sqlserver/verify-refactor.mjs`:
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
- `node database/sqlserver/verify-live.mjs`:
  ```
  PASS live schema metadata { tables: 56, enabled_triggers: 5, invalid_foreign_keys: 0 }
  ```
- `node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs`:
  ```
  ℹ tests 11
  ℹ suites 0
  ℹ pass 11
  ℹ fail 0
  ```

---

## 2. Logic Chain

1. **Integrity Verification**:
   - The verification script `verify-refactor.mjs` directly queries database system tables (`sys.check_constraints`, `sys.indexes`, `INFORMATION_SCHEMA.COLUMNS`) rather than mocking return values.
   - The test runner executes real transactions, verifies constraint failure with `assert.equal(slugCollisionCaught, true)` and `assert.equal(invalidSourceCaught, true)`, and commits a rollback.
   - Live checks confirmed that all 12 achievement rows in `app.achievements` transitioned to `status = 'ACTIVE'`, matching requirement R1.
   - No hardcoded cheats, mocks, or facades were identified in any part of worker_m1's changes.

2. **Schema Correctness and Compatibility**:
   - Primary key types across `app.cv_profiles` and `app.calendar_reminders` are `UNIQUEIDENTIFIER` with `DEFAULT NEWID()`, while foreign keys linking to `app.users`, `app.award_periods`, `app.kpi_goals`, and `app.regulation_documents` use matching `BIGINT` definitions, avoiding SQL Server data type mismatch errors.
   - Column `app.award_periods.submission_deadline` is correctly declared as `DATETIME2(3) NULL`, permitting seamless scheduling for deadlines in R2 and R3.
   - Expanding `source` to `NVARCHAR(30)` on `kpi_goals` and `kpi_results` accommodates `AI_GAP` and `AI_GAP_ANALYSIS` without breaking backwards compatibility with `MANUAL` and `CSV`.
   - Creating `app.regulations` as a standard view pointing to `app.regulation_documents` provides backward and forward naming compatibility for services and joins expecting `app.regulations(regulation_id)`.

3. **Organizational Tree and Cycle Prevention**:
   - `LHU` was created with `parent_id = NULL` and `type = 'UNIVERSITY'`.
   - `FIT` and `PHARM` (`type = 'FACULTY'`) have `parent_id = 37` (`LHU`).
   - `FIT_SE` and `FIT_CS` (`type = 'DEPARTMENT'`) have `parent_id = 1` (`FIT`).
   - This forms a clean 3-level tree: Trường -> Khoa -> Bộ môn.
   - Integrity trigger `trg_prevent_organization_cycle` remained enabled and active throughout the migration.

4. **Role Standardization & Legacy Compatibility**:
   - 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) are marked `is_active = 1`.
   - Legacy administrative roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`) are marked `is_active = 0`.
   - Role `LECTURER` was intentionally retained active to allow existing seed users and backend controllers to continue functioning until downstream milestones refactor backend authentication.

---

## 3. Adversarial Stress-Test Findings

An independent adversarial stress-test suite was executed by the reviewer to challenge assumptions and probe edge cases:

| Challenge | Scenario Tested | Predicted Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **Adv 1: Achievement Status Default** | Insert row into `app.achievements` without supplying `status` column | Automatically defaults to `'ACTIVE'` | Inserted row has `status = 'ACTIVE'` | **PASS** |
| **Adv 2: Achievement Status Check Constraint** | Insert row into `app.achievements` with `status = 'BOGUS_STATUS'` | Rejected by check constraint `ck_achievements_status` | SQL Server error 547 check constraint violation caught | **PASS** |
| **Adv 3: CV Profile Non-Existent User FK** | Insert row into `app.cv_profiles` with `user_id = 999999` | Rejected by foreign key `fk_cv_profiles_user` | SQL Server error 547 foreign key violation caught | **PASS** |
| **Adv 4: CV Profile Unique Slug Filter** | Insert row with unicode slug, then insert duplicate slug | First insert succeeds; second insert rejected by `uq_cv_profiles_slug` | Duplicate slug rejected; filtered index verified | **PASS** |
| **Adv 5: CV Profile NULL Slugs** | Multiple users create profiles with `slug = NULL` | Allowed by filtered index `WHERE slug IS NOT NULL` | Both rows inserted without unique collision | **PASS** |
| **Adv 6: Calendar Reminders FK Boundaries** | Insert reminders with invalid `user_id`, `regulation_id`, `award_period_id`, `kpi_goal_id`, `event_id` | All 5 foreign keys reject invalid references | Foreign key rejections confirmed across all 5 reference columns | **PASS** |
| **Adv 7: KPI Sources Expansion** | Insert `kpi_goals` with `MANUAL`, `CSV`, `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM` | All 5 sources accepted | All 5 rows inserted successfully | **PASS** |
| **Adv 8: KPI Source String Boundary** | Insert `kpi_goals` with source length = 31 characters | Rejected by column max_length / constraint | Error caught; source length limit verified | **PASS** |
| **Adv 9: Org Unit Cycle Detection Trigger** | Attempt to update `LHU` parent to `FIT` (creating a cycle) | Trigger `trg_prevent_organization_cycle` raises error | Trigger aborted update: "Organization hierarchy cannot contain a cycle." | **PASS** |
| **Adv 10: Award Periods Deadline Nullability** | Update `submission_deadline` to valid DATETIME2 and back to NULL | Successfully stores timestamp and handles NULL | Verified both valid timestamp update and NULL assignment | **PASS** |

---

## 4. Caveats

- `LECTURER` role is currently active (`is_active = 1`) in `app.roles` alongside `MEMBER`. This is desirable because the existing backend repository and seed fixtures assign 5 users to `LECTURER`. Milestone 2 and Milestone 3 will migrate user assignments to `MEMBER` and update authorization guards accordingly.
- No other caveats. All database structures are live, tested, and idempotent.

---

## 5. Conclusion

**Verdict: APPROVE**

Milestone 1 successfully delivers the database refactoring foundation required for the Personal Achievement Vault & AI Assistant:
- Migration `005_refactor_personal_vault_and_cv.sql` is cleanly applied and tracked in `app._schema_migrations`.
- Immediate `ACTIVE` status on `app.achievements` is active with valid constraints and all 12 existing achievements migrated.
- `app.award_periods.submission_deadline` is established.
- `app.kpi_goals` & `app.kpi_results` source constraints support `AI_GAP`, `AI_GAP_ANALYSIS`, and `SYSTEM`.
- `app.cv_profiles` and `app.calendar_reminders` tables are created with proper foreign keys and filtered unique index on `slug`.
- 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) are active; legacy roles are deactivated.
- 3-level organization hierarchy (LHU -> FIT/PHARM -> FIT_SE/FIT_CS) is established.
- All 4 verification commands pass 100%.
- Adversarial stress tests confirm robustness under invalid inputs, foreign key violations, cycle conditions, and string length boundaries.

Milestone 1 is ready to be declared complete by the sub-orchestrator.

---

## 6. Verification Method

To independently reproduce the complete verification:

```powershell
# 1. Migration status
node database/scripts/migrate.js status

# 2. Refactor verification script
node database/sqlserver/verify-refactor.mjs

# 3. Live schema assertion
node database/sqlserver/verify-live.mjs

# 4. Schema unit tests and runner
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
```
