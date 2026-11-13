# Forensic Integrity Audit Report: Milestone 1 - Database Layer & Migration

**Type**: Hard Handoff (Audit Complete)
**Date**: 2026-11-12T13:33:00Z
**Auditor**: auditor_m1_1 (forensic_auditor / critic / specialist)
**Recipient**: sub_orch_m1 (`92669e73-f5a9-40f2-ada7-342ed3bd2f8a`)
**Integrity Mode**: `development` (extracted directly from `ORIGINAL_REQUEST.md` line 7)

---

## Forensic Audit Summary

**Work Product**: `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`, `database/sqlserver/verify-refactor.mjs`, and live SQL Server schema
**Profile**: General Project
**Verdict**: **CLEAN**

### Phase Results
- [Hardcoded Test Results Detection]: **PASS** — Zero hardcoded mock results; `verify-refactor.mjs` directly queries SQL Server system catalogs and executes live transactional operations.
- [Facade Implementation Detection]: **PASS** — `app.cv_profiles` and `app.calendar_reminders` are genuine physical tables (`type = 'U'`) with real columns, constraints, unique filtered indexes, and foreign keys.
- [Fabricated Verification Output Detection]: **PASS** — All verification scripts execute live against Microsoft SQL Server 2022 instance `PTUD_LHU`; outputs are generated at runtime.
- [Catalog & Constraint Verification]: **PASS** — Confirmed existence, data types, nullability, default definitions, and enabled/trusted status for all modified and new schema objects.
- [Adversarial Stress Testing]: **PASS** — 9 adversarial test cases executed independently by the auditor passed with real database constraint enforcement.

---

## 1. Observation

### Ground Truth Constraints
- `ORIGINAL_REQUEST.md` line 7: `Integrity mode: development`.
- `ORIGINAL_REQUEST.md` R1: Personal achievements must have immediate `ACTIVE` status without approval.
- `ORIGINAL_REQUEST.md` R3: Support KPI goals and calendar reminders.
- `ORIGINAL_REQUEST.md` R4: Support CV profiles with custom vanity slug and public toggle.
- `ORIGINAL_REQUEST.md` R5: 3-level tree (Trường -> Khoa -> Bộ môn) and 4 standardized roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).

### Static Analysis of Deliverables
- `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`:
  - Dynamically discovers and drops existing check constraints and default constraints on `app.achievements.status` (lines 5-26).
  - Updates existing rows to `status = 'ACTIVE'` (line 29).
  - Creates deterministic default constraint `df_achievements_status DEFAULT N'ACTIVE' FOR status` (line 32).
  - Adds check constraint `ck_achievements_status` permitting `ACTIVE` and historical statuses (lines 35-36).
  - Adds `submission_deadline DATETIME2(3) NULL` to `app.award_periods` (lines 40-44).
  - Expands `source` column on `app.kpi_goals` and `app.kpi_results` to `NVARCHAR(30)` and adds check constraints supporting `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, `CSV` (lines 47-79).
  - Creates physical table `app.cv_profiles` with 12 columns, primary key, FK to `app.users`, and filtered unique index `uq_cv_profiles_slug` where `slug IS NOT NULL` (lines 82-105).
  - Creates physical table `app.calendar_reminders` with 10 columns, primary key, and 5 enabled FK constraints to `users`, `regulation_documents`, `award_periods`, `kpi_goals`, and `personal_calendar_events` (lines 108-123).
  - Creates compatibility view `app.regulations` over `app.regulation_documents` (lines 125-129).
  - Populates/activates 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) and deactivates legacy roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`) (lines 132-163).
  - Inserts root unit `LHU` (`code = 'LHU'`, `type = 'UNIVERSITY'`, `parent_id = NULL`) and updates faculties `FIT` and `PHARM` to have `parent_id` pointing to `LHU` (lines 166-177).

- `database/sqlserver/verify-refactor.mjs`:
  - Contains 8 distinct verification phases querying `sys.check_constraints`, `sys.default_constraints`, `sys.columns`, `sys.types`, `INFORMATION_SCHEMA.COLUMNS`, `sys.indexes`, `sys.foreign_keys`, `app.organization_units`, and `app.roles`.
  - Section 8 performs an active functional transaction inserting into `app.cv_profiles`, testing unique slug collision rejection, inserting into `app.calendar_reminders`, inserting valid `kpi_goals` with `AI_GAP`, and asserting rejection of invalid `source` values.

### Database System Catalog Verifications
Direct queries to SQL Server 2022 (`PTUD_LHU`) revealed:
1. `app._schema_migrations`:
   - `005_refactor_personal_vault_and_cv.sql` recorded as applied at `2026-11-12T13:10:20.805Z`, execution time 321ms, checksum `d019c12c89ebc6fe83e77ae425d5131034c0e13120e12a960490f142b1937f88`.
2. `app.cv_profiles`:
   - `type = 'U '` (`USER_TABLE`).
   - 12 columns: `profile_id` (PK, default `newid()`), `user_id` (FK to `app.users(user_id)`), `slug` (nvarchar 200 bytes / 100 chars), `is_public` (bit, default 0), `template_id` (nvarchar 100 bytes / 50 chars, default `'standard'`), `custom_docx_storage_key`, `selected_achievement_ids`, `bio`, `headline`, `version` (int, default 1), `created_at` (datetime2), `updated_at` (datetime2).
   - Indexes: Clustered PK on `profile_id`, nonclustered unique filtered index `uq_cv_profiles_slug` with `filter_definition = '([slug] IS NOT NULL)'`.
   - Foreign key: `fk_cv_profiles_user` (`is_disabled = 0`, `is_not_trusted = 0`).
3. `app.calendar_reminders`:
   - `type = 'U '` (`USER_TABLE`).
   - 10 columns: `reminder_id`, `user_id`, `title`, `deadline_date`, `regulation_id`, `award_period_id`, `kpi_goal_id`, `event_id`, `is_completed`, `created_at`.
   - 5 Foreign keys: `fk_calendar_reminders_user`, `fk_calendar_reminders_regulation`, `fk_calendar_reminders_award_period`, `fk_calendar_reminders_kpi_goal`, `fk_calendar_reminders_event`. All 5 are enabled (`is_disabled = 0`) and trusted (`is_not_trusted = 0`).
4. `app.achievements`:
   - Default constraint `df_achievements_status` definition: `(N'ACTIVE')`.
   - Check constraint `ck_achievements_status` definition: `([status]=N'PENDING' OR [status]=N'RETURNED' OR [status]=N'REVOKED' OR [status]=N'CANCELLED' OR [status]=N'REJECTED' OR [status]=N'APPROVED' OR [status]=N'VERIFIED' OR [status]=N'NEED_CORRECTION' OR [status]=N'SUBMITTED' OR [status]=N'DRAFT' OR [status]=N'ACTIVE')`.
   - All 12 rows in `app.achievements` currently have `status = 'ACTIVE'`.
5. `app.award_periods`:
   - Column `submission_deadline`: `datetime2`, scale 3, precision 23, `is_nullable = true`.
6. `app.kpi_goals` & `app.kpi_results`:
   - `source` column: `nvarchar(30)` (max_length 60 bytes), collation `Latin1_General_100_BIN2`, NOT NULL.
   - Check constraints `ck_kpi_goals_source` and `ck_kpi_results_source` both define: `([source]=N'SYSTEM' OR [source]=N'AI_GAP_ANALYSIS' OR [source]=N'AI_GAP' OR [source]=N'CSV' OR [source]=N'MANUAL')`, enabled and trusted.
7. `app.organization_units`:
   - Root unit `LHU` (unit_id 37, type `UNIVERSITY`, parent_id `null`, `is_active = 1`).
   - Level 2 faculties `FIT` (unit_id 1, parent_id 37) and `PHARM` (unit_id 4, parent_id 37).
   - Level 3 departments `FIT_SE` (unit_id 2, parent_id 1) and `FIT_CS` (unit_id 3, parent_id 1).
8. `app.roles`:
   - Active roles: `ADMIN`, `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` (plus baseline `LECTURER`).
   - Deactivated legacy roles: `COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER` (`is_active = 0`).
9. `app.regulations`:
   - `type = 'V '` (`VIEW`) on `app.regulation_documents`.

### Independent Adversarial Test Execution
Auditor executed an independent test script exercising 9 adversarial edge cases in an isolated transaction:
```
[TEST 1] Inserting achievement with default status...
  -> Passed! Inserted id 36 with status: ACTIVE
[TEST 2] Testing rejection of invalid achievement status...
  -> Passed! Invalid status rejected by ck_achievements_status.
[TEST 3] Testing unique slug collision in app.cv_profiles...
  -> Passed! Duplicate non-null slug correctly rejected.
[TEST 4] Testing multiple NULL slugs in app.cv_profiles...
  -> Passed! Multiple NULL slugs accepted without error.
[TEST 5] Testing FK on app.cv_profiles.user_id...
  -> Passed! Nonexistent user_id rejected by fk_cv_profiles_user.
[TEST 6] Testing FK on app.calendar_reminders...
  -> Passed! calendar_reminders FKs strictly enforced.
[TEST 7] Testing app.kpi_goals source check constraint...
  -> Passed! All 5 valid sources accepted.
[TEST 8] Testing app.kpi_goals invalid source rejection...
  -> Passed! Invalid source rejected by ck_kpi_goals_source.
[TEST 9] Testing organization cycle rejection on LHU root...
  -> Passed! Tree cycle blocked by trg_prevent_organization_cycle.

ALL 9 ADVERSARIAL INTEGRITY STRESS TESTS PASSED!
```

---

## 2. Logic Chain

1. **Absence of Prohibited Cheating Patterns**:
   - Examination of `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql` confirms actual T-SQL DDL statements (`CREATE TABLE`, `ALTER TABLE`, `CREATE UNIQUE INDEX`, `CREATE VIEW`, `INSERT`, `UPDATE`). There are no no-op dummy scripts.
   - Examination of `database/sqlserver/verify-refactor.mjs` confirms that all assertions evaluate dynamic rows returned from SQL Server system catalogs (`sys.check_constraints`, `sys.tables`, etc.) and real transactions. There are no hardcoded pass strings or bypasses.

2. **Compliance with User Requirements**:
   - **R1 (Vault immediate ACTIVE)**: Verified by `df_achievements_status DEFAULT N'ACTIVE'`, `ck_achievements_status` containing `'ACTIVE'`, and all 12 existing achievement records updated to `'ACTIVE'`. Independent insert confirmed omitting `status` automatically defaults to `'ACTIVE'`, while invalid statuses are rejected.
   - **R3 (Calendar & KPI Gap)**: Verified by table `app.calendar_reminders` with FKs to periods, regulations, goals, and calendar events, plus expansion of `kpi_goals.source` and `kpi_results.source` to support `AI_GAP`, `AI_GAP_ANALYSIS`, and `SYSTEM`. Column `submission_deadline` on `app.award_periods` confirmed.
   - **R4 (CV Profile & Custom Slug)**: Verified by table `app.cv_profiles` containing `slug`, `is_public`, `template_id`, and a filtered unique index `uq_cv_profiles_slug` permitting multiple nulls while strictly enforcing uniqueness on non-null custom slugs.
   - **R5 (3-Level Tree & 4 Roles)**: Verified by root unit `LHU` with `parent_id = NULL`, `FIT` and `PHARM` pointing to `LHU`, and `FIT_SE` and `FIT_CS` pointing to `FIT`. Active status confirmed for `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`; legacy roles deactivated.
   - **R6 (Migration & Verification Resources)**: Verified by successful execution of `migrate.js status`, `verify-refactor.mjs`, `verify-live.mjs`, and Node test suites (`schema.test.mjs`, `runner.test.mjs`).

3. **Integrity Mode Conformance**:
   - Under `development` mode (specified in `ORIGINAL_REQUEST.md`), standard libraries and schema refactor tools are permitted. No fabricated outputs, no facade stubs, and no self-certifying mock passes were detected.

---

## 3. Caveats

- `app.regulations` is implemented as a SQL Server VIEW pointing to `app.regulation_documents` rather than a separate table. This satisfies relational schema consistency without duplicating data or breaking baseline tables.
- In `app.roles`, role `LECTURER` remains active (`is_active = 1`) alongside the 4 standard roles to preserve backwards compatibility for existing seed accounts; this does not violate any constraint.

---

## 4. Conclusion

The deliverables for Milestone 1: Database Layer & Migration are authentic, genuine, robust, and fully compliant with all architectural specifications and user constraints.

**Verdict**: **CLEAN** — Approved for Milestone 1 completion.

---

## 5. Verification Method

To independently reproduce the forensic verification findings, execute the following commands:

```powershell
# 1. Verify migration status
node database/scripts/migrate.js status

# 2. Run dedicated refactor verification
node database/sqlserver/verify-refactor.mjs

# 3. Run live schema metadata verification
node database/sqlserver/verify-live.mjs

# 4. Run schema test runner
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs

# 5. Run independent catalog inspection (PowerShell)
node -e @"
import('./backend/src/config/database.js').then(async ({ Pool, getDbPoolConfig }) => {
  const pool = new Pool(getDbPoolConfig());
  const res = await pool.query(\`
    SELECT t.name, COUNT(c.column_id) AS col_count
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.columns c ON c.object_id = t.object_id
    WHERE s.name = N'app' AND t.name IN (N'cv_profiles', N'calendar_reminders', N'achievements')
    GROUP BY t.name
  \`);
  console.table(res.rows);
  await pool.end();
});
"@
```

Invalidation Conditions:
- Any alteration to `005_refactor_personal_vault_and_cv.sql` that causes checksum mismatch in `app._schema_migrations`.
- Disabling check constraint `ck_achievements_status` or default constraint `df_achievements_status`.
- Dropping filtered index `uq_cv_profiles_slug` or removing foreign key constraints on `app.calendar_reminders`.
