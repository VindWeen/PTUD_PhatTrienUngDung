# Handoff Report: Milestone 1 - Database Layer & Migration

**Type**: Hard Handoff (Milestone Complete)  
**Date**: 2026-11-12T13:41:00Z  
**Author**: sub_orch_m1 (Sub-Orchestrator for Milestone 1)  
**Recipient**: Project Orchestrator (`1e76c276-8bfa-46e8-963a-bb64503095c8`)  
**Scope Document**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\SCOPE.md`  
**Gate Status**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m1\GATE_STATUS.md` (**PASS**)  

---

## 1. Observation

### Milestone Deliverables Completed
1. **Migration File `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`**:
   - `app.achievements`: Dropped existing check/default constraints, migrated 12 existing rows to `status = 'ACTIVE'`, added `df_achievements_status DEFAULT N'ACTIVE'`, added check constraint `ck_achievements_status` supporting `ACTIVE` alongside historical statuses.
   - `app.award_periods`: Added column `submission_deadline DATETIME2(3) NULL`.
   - `app.kpi_goals` & `app.kpi_results`: Altered `source` column to `NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL`, updated check constraints `ck_kpi_goals_source` and `ck_kpi_results_source` to permit `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, `CSV`.
   - `app.cv_profiles`: Created table with 12 columns, primary key `profile_id UNIQUEIDENTIFIER DEFAULT NEWID()`, foreign key to `app.users(user_id)`, and filtered unique index `uq_cv_profiles_slug` where `slug IS NOT NULL`.
   - `app.calendar_reminders`: Created table with 10 columns, primary key `reminder_id UNIQUEIDENTIFIER DEFAULT NEWID()`, and 5 trusted foreign keys to `app.users`, `app.award_periods`, `app.regulation_documents`, `app.kpi_goals`, and `app.personal_calendar_events`.
   - `app.regulations`: Created backward-compatible view over `app.regulation_documents`.
   - `app.roles`: Standardized 4 active roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) with `is_active = 1`. Deactivated legacy approval roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`) with `is_active = 0`.
   - `app.organization_units`: Inserted root unit `LHU` (`code = 'LHU'`, `type = 'UNIVERSITY'`, `parent_id = NULL`), updated faculties `FIT` and `PHARM` to have `parent_id` pointing to `LHU`, establishing a clean 3-level tree (LHU -> FIT/PHARM -> FIT_SE/FIT_CS).
2. **Migration Execution**:
   - Applied via `node database/scripts/migrate.js up`. Tracked in `app._schema_migrations` with checksum `d019c12c89eb...`.
3. **Dedicated Verification Script**:
   - Created `database/sqlserver/verify-refactor.mjs` verifying all tables, columns, constraints, defaults, roles, and org tree across 8 live verification groups.

### Multi-Agent Verification & Gate Verdicts
- **Worker (`worker_m1`)**: Complete. All tests passing.
- **Reviewer 1 (`reviewer_m1_1`)**: **APPROVE** (10 independent adversarial tests passed; low risk; no shortcuts).
- **Reviewer 2 (`reviewer_m1_2`)**: **APPROVE** (Quality, robustness, and collation checks passed; zero integrity violations).
- **Challenger 1 (`challenger_m1_1`)**: **APPROVE** (33 empirical stress tests executed and passed 100% against live SQL Server).
- **Challenger 2 (`challenger_m1_2`)**: **APPROVE** (49 boundary & edge-case stress tests executed and passed 100% against live SQL Server).
- **Forensic Auditor (`auditor_m1_1`)**: **CLEAN** (All 5 integrity checks passed: zero hardcoded results, zero facades, zero fabricated logs, genuine catalog objects confirmed, 9 stress tests passed).

**Gate Verdict**: **PASS** (recorded in `GATE_STATUS.md`).

---

## 2. Logic Chain

1. **Foreign Key Typing and SQL Server Identity Semantics**:
   - In SQL Server, referencing columns must match the exact data type of the target primary key. `app.users.user_id`, `app.award_periods.award_period_id`, `app.kpi_goals.goal_id`, `app.regulation_documents.document_id`, and `app.personal_calendar_events.event_id` are defined as `BIGINT`. Typing the referencing foreign keys as `BIGINT` in `app.cv_profiles` and `app.calendar_reminders` prevents SQL Server Error 1778 while maintaining strict relational constraints.
2. **Filtered Unique Indexing**:
   - A standard unique index in SQL Server permits only a single `NULL` value. By declaring `CREATE UNIQUE INDEX uq_cv_profiles_slug ON app.cv_profiles(slug) WHERE slug IS NOT NULL`, multiple unconfigured profiles (`slug = NULL`) can co-exist while vanity slugs (`slug = 'john-doe'`) are guaranteed globally unique.
3. **Set-Based Organization Hierarchy and Cycle Trigger**:
   - Inserting `LHU` as root (`parent_id = NULL`) and re-parenting `FIT` and `PHARM` to `LHU` created a non-cyclic 3-level tree. Adversarial testing confirmed that `trg_prevent_organization_cycle` strictly prevents any cyclic updates (1-hop, 2-hop, 3-hop) by throwing Error 51014.
4. **Immediate ACTIVE Status**:
   - Dropping the approval check constraint, altering the default constraint to `N'ACTIVE'`, and migrating existing rows ensures that all personal achievements created or retrieved are immediately actionable without administrative approval bottleneck, satisfying requirement R1.

---

## 3. Caveats

- **Driver Transaction Abort Behavior**: In `backend/src/config/database.js`, Tedious is configured with `abortTransactionOnError: true`. Any query that causes an intentional constraint error (e.g. testing negative assertions) immediately aborts the active transaction on the server. Automated test harnesses must run negative tests on isolated connections or execute cleanup queries in `finally` blocks.
- **Role `LECTURER` Active Status**: Role `LECTURER` remains active (`is_active = 1`) in `app.roles` alongside `MEMBER` to preserve backwards compatibility for existing demo seed accounts (`an.nv`, `bich.tt`) until Milestone 2/3 refactors backend authentication and user role assignments to `MEMBER`.
- **View `app.regulations`**: Implemented as a view pointing to `app.regulation_documents` to support queries referencing `app.regulations` without altering the base table structure.

---

## 4. Conclusion

Milestone 1: Database Layer & Migration is **100% COMPLETE and VERIFIED**.
All schema migrations, constraints, tables, indexes, roles, and hierarchy structures are live in SQL Server 2022 (`PTUD_LHU`). Zero regressions, zero integrity violations, and zero database pollution were verified across 82 empirical stress test assertions.

Milestone 1 is ready for final sign-off. Milestone 2 (Backend Core Services & APIs) can proceed immediately.

---

## 5. Verification Method

To independently reproduce the complete verification suite from the project root:

```powershell
# 1. Check applied migration status (5/5 applied)
node database/scripts/migrate.js status

# 2. Re-run migration up to verify idempotence (0 pending)
node database/scripts/migrate.js up

# 3. Run Milestone 1 dedicated verification script (8/8 pass)
node database/sqlserver/verify-refactor.mjs

# 4. Run live schema metadata assertions (56 tables, 5 triggers, 0 invalid FKs)
node database/sqlserver/verify-live.mjs

# 5. Run Challenger 1 empirical challenge suite (33/33 pass)
node --test tests/empirical_challenge_m1.test.mjs

# 6. Run Challenger 2 adversarial stress suite (49/49 pass)
node database/sqlserver/challenger2-stress.mjs

# 7. Run schema unit & runner tests (11/11 pass)
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
```
