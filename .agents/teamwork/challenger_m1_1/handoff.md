# Challenger 1 Empirical Assessment: Milestone 1 - Database Layer & Migration

**Type**: Hard Handoff (Adversarial Verification Complete)  
**Date**: 2026-11-12T13:38:00Z  
**Author**: challenger_m1_1 (Empirical Challenger: critic, specialist)  
**Recipient**: sub_orch_m1 (`92669e73-f5a9-40f2-ada7-342ed3bd2f8a`)  
**Verdict**: **`APPROVE`**

---

## 1. Observation

### Empirical Test Execution & Results
An automated empirical challenge test suite was authored at `tests/empirical_challenge_m1.test.mjs` executing 33 isolated stress tests against the live Microsoft SQL Server database (`PTUD_LHU` on `MSI`).

Command executed:
```powershell
node --test tests/empirical_challenge_m1.test.mjs
```

Console Output verbatim:
```text
✔ 1.1: Reject invalid status BOGUS_STATUS in app.achievements (90.8215ms)
✔ 1.2: Reject lowercase active under Latin1_General_100_BIN2 collation in app.achievements (10.1439ms)
✔ 1.3: Reject empty status string in app.achievements (9.9324ms)
✔ 1.4: Reject NULL status in app.achievements (12.752ms)
✔ 1.5: Insert valid status ACTIVE in app.achievements must succeed (13.048ms)
✔ 1.6: Insert without status column in app.achievements must default to ACTIVE (12.9089ms)
✔ 1.7: Valid historical statuses in app.achievements must all succeed (53.9654ms)
✔ 2.1: kpi_goals rejects invalid source INVALID_SOURCE (39.1156ms)
✔ 2.2: kpi_goals rejects lowercase source ai_gap under BIN2 collation (11.1608ms)
✔ 2.3: kpi_goals accepts valid sources AI_GAP, AI_GAP_ANALYSIS, SYSTEM, MANUAL, CSV (19.3072ms)
✔ 2.4: kpi_results rejects invalid source INVALID_SOURCE (21.0615ms)
✔ 2.5: kpi_results accepts valid sources AI_GAP, AI_GAP_ANALYSIS, SYSTEM, MANUAL, CSV (27.7977ms)
✔ 3.1: app.cv_profiles allows multiple rows with slug = NULL for different users (17.5708ms)
✔ 3.2: app.cv_profiles accepts valid unique non-null slug (7.7678ms)
✔ 3.3: app.cv_profiles rejects duplicate non-null slug with unique index violation (17.2799ms)
✔ 3.4: app.cv_profiles rejects updating existing row to duplicate non-null slug (27.4239ms)
✔ 3.5: app.cv_profiles rejects non-existent user_id via foreign key constraint (14.5414ms)
✔ 3.6: app.cv_profiles defaults are correctly populated on minimal insert (12.7543ms)
✔ 4.1: app.calendar_reminders rejects non-existent user_id (15.3768ms)
✔ 4.2: app.calendar_reminders rejects non-existent regulation_id (15.1339ms)
✔ 4.3: app.calendar_reminders rejects non-existent award_period_id (16.6068ms)
✔ 4.4: app.calendar_reminders rejects non-existent kpi_goal_id (23.7911ms)
✔ 4.5: app.calendar_reminders rejects non-existent event_id (18.3418ms)
✔ 4.6: app.calendar_reminders accepts valid reminder with defaults (15.3047ms)
✔ 4.7: app.calendar_reminders accepts valid reminder with all FK references populated (34.0881ms)
✔ 5.1: Direct cycle LHU -> FIT -> LHU rejected by trg_prevent_organization_cycle (55.3806ms)
✔ 5.2: Self-cycle LHU -> LHU rejected by trg_prevent_organization_cycle (35.4953ms)
✔ 5.3: Indirect 3-level cycle LHU -> FIT_SE -> FIT -> LHU rejected (27.8043ms)
✔ 5.4: Multi-level cycle involving newly inserted unit rejected (26.7414ms)
✔ 6.1: 4 standard roles are active and legacy roles are inactive (7.667ms)
✔ 6.2: app.regulations view returns documents matching app.regulation_documents (12.1722ms)
✔ 6.3: app.award_periods.submission_deadline supports DATETIME2 values (14.9402ms)
✔ 7.1: Live database cleanliness and integrity verification (70.6117ms)
ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2453.3866
```

### Specific Direct Observations
1. **Achievement Constraints & Collation**:
   - `INSERT INTO app.achievements (..., status) VALUES (..., N'BOGUS_STATUS')` fails with SQL Server Error 547 (`ck_achievements_status`).
   - `INSERT INTO app.achievements (..., status) VALUES (..., N'active')` fails with SQL Server Error 547 because the column has binary collation `Latin1_General_100_BIN2` and the check constraint specifies uppercase `N'ACTIVE'`.
   - `INSERT INTO app.achievements` omitting `status` column produces a row with `status = N'ACTIVE'`.
   - All 12 pre-existing achievement rows in `app.achievements` were inspected and confirmed to have migrated to `status = N'ACTIVE'`.
2. **KPI Source Constraints**:
   - `app.kpi_goals` and `app.kpi_results` reject `INVALID_SOURCE` and lowercase `ai_gap` with SQL Server Error 547 (`ck_kpi_goals_source` and `ck_kpi_results_source`).
   - `app.kpi_goals` and `app.kpi_results` accept `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, and `CSV`.
3. **Filtered Unique Index on `app.cv_profiles.slug`**:
   - Inserting multiple rows with `slug = NULL` across users `1`, `2`, and `3` succeeded without conflict.
   - Inserting duplicate non-null slug `slug = duplicate-slug-...` fails with SQL Server Error 2601 / 2627: violation of unique index `uq_cv_profiles_slug`.
   - Attempting to UPDATE an existing profile's slug to collide with another profile fails with SQL Server Error 2601 / 2627.
   - Inserting with non-existent `user_id = 999999999` fails with SQL Server Error 547 (`fk_cv_profiles_user`).
4. **Calendar Reminders Foreign Keys**:
   - Inserting invalid `user_id`, `regulation_id`, `award_period_id`, `kpi_goal_id`, or `event_id` fails with SQL Server Error 547.
   - Valid inserts with default values set `is_completed = 0` and populates `created_at`.
5. **Organization Hierarchy Cycle Prevention Trigger**:
   - Attempting a direct 2-node cycle (`UPDATE app.organization_units SET parent_id = FIT_id WHERE unit_id = LHU_id`) triggers `trg_prevent_organization_cycle` and raises SQL Server Error 51014: `"Organization hierarchy cannot contain a cycle."`
   - Attempting a self-cycle (`parent_id = unit_id`) triggers Error 51014.
   - Attempting an indirect 3-node cycle (`LHU -> FIT_SE -> FIT -> LHU`) triggers Error 51014.
   - Attempting a dynamically created 4-node cycle (`LHU -> NEW_UNIT -> FIT_SE -> FIT -> LHU`) triggers Error 51014.
6. **Live Database Cleanliness**:
   - Querying `app.achievements` post-run confirms exactly 12 baseline rows remain in `ACTIVE` status.
   - Querying `app.cv_profiles`, `app.calendar_reminders`, `app.kpi_goals`, and `app.organization_units` confirms zero test artifacts leaked into the live database.

---

## 2. Logic Chain

1. **Transaction Isolation & XACT_ABORT Awareness**:
   - In Tedious / node-mssql, connections operate with `SET XACT_ABORT ON` (indicated by `@@OPTIONS & 16384 == 16384`).
   - Under `XACT_ABORT ON`, any server-side statement error (such as a check constraint, unique index collision, or THROW from a trigger) immediately aborts the active transaction and resets `@@TRANCOUNT = 0`.
   - To guarantee complete test isolation without transaction leaking, our test runner `tests/empirical_challenge_m1.test.mjs` executes each test in an isolated connection context using helper `withIsolatedTx` that safely cleans up with `IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION`.
2. **Schema Correctness**:
   - The check constraint `ck_achievements_status` explicitly enumerates `N'ACTIVE'` alongside historical statuses. Because the status column is `NOT NULL DEFAULT N'ACTIVE'`, any omitted status defaults directly to `ACTIVE`, fulfilling R1 without relying on application-layer logic.
   - The filtered index `uq_cv_profiles_slug` created with `WHERE slug IS NOT NULL` complies with SQL Server's unique index semantics: multiple `NULL` values are excluded from the index b-tree, permitting all users without a customized slug to co-exist, while enforcing absolute uniqueness for vanity URLs.
   - The trigger `app.trg_prevent_organization_cycle` uses recursive CTE traversal over the full tree with `TABLOCKX, HOLDLOCK`. By evaluating `visited` ancestry paths, it detects cycles of arbitrary depth (1-hop, 2-hop, 3-hop, N-hop) and raises error 51014, guarding against tree corruption.
3. **Data Integrity & Backward Compatibility**:
   - Compatibility view `app.regulations` resolves queries expecting `app.regulations` by delegating directly to `app.regulation_documents`.
   - The 4 active roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) and 4 deactivated legacy roles (`COUNCIL`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`, `MANAGER`) are cleanly demarcated by `is_active`.
   - All 11 baseline unit tests and runner tests pass with zero regressions.

---

## 3. Caveats

- **Concurrency & High Load**: High-frequency concurrent cycle updates were not benchmarked in M1; full concurrency and lock stress testing are scheduled for Milestone 5 (Tier 5 Adversarial Coverage Hardening).
- **Frontend / API Integration**: This assessment verified the SQL Server database schema, triggers, indexes, and views directly. Backend Express route handlers and frontend React components will be verified in subsequent milestones (M2 through M5).

---

## 4. Conclusion

All required acceptance criteria for Milestone 1: Database Layer & Migration are empirically satisfied and hardened:
- `app.achievements`: Immediate `ACTIVE` default and check constraint verified.
- `app.award_periods`: `submission_deadline` column verified.
- `app.kpi_goals` & `app.kpi_results`: `source` column check constraints supporting `AI_GAP`, `AI_GAP_ANALYSIS`, `SYSTEM`, `MANUAL`, `CSV` verified.
- `app.cv_profiles`: Filtered unique index on `slug` allowing multiple NULLs while enforcing non-null uniqueness verified.
- `app.calendar_reminders`: Foreign keys and defaults verified.
- `app.organization_units`: 3-level tree (LHU -> FIT/PHARM -> FIT_SE/FIT_CS) and cycle prevention trigger verified.
- `app.roles`: 4 active standardized roles and 4 deactivated legacy roles verified.
- All 33 empirical challenge tests passed with 100% success rate, leaving zero lingering test records in the database.

**Explicit Verdict**: **`APPROVE`**

---

## 5. Verification Method

To reproduce and independently verify all 33 empirical challenge tests and baseline suites, execute the following commands from the repository root:

```powershell
# 1. Run Challenger 1 dedicated empirical test suite (33 assertions)
node --test tests/empirical_challenge_m1.test.mjs

# 2. Run Worker 1 refactor verification script
node database/sqlserver/verify-refactor.mjs

# 3. Run Live database metadata check
node database/sqlserver/verify-live.mjs

# 4. Run Schema and migration runner test suites
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
```

### Invalidation Conditions
The approval verdict is invalidated if:
1. `node --test tests/empirical_challenge_m1.test.mjs` exits with a non-zero code or any failed assertion.
2. An insert into `app.achievements` with `status = 'BOGUS_STATUS'` or lowercase `'active'` succeeds.
3. An insert into `app.cv_profiles` with a duplicate non-null slug succeeds.
4. Setting `app.organization_units` parent hierarchy into a cycle does not raise error 51014.
