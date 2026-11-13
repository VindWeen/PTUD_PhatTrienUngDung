# Quality Review & Adversarial Audit Report: Milestone 3

**Date**: 2026-11-12T21:35:00Z  
**Reviewer**: `teamwork_reviewer_2` (Reviewer & Adversarial Critic)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\reviewer_2`  
**Verdict**: **REQUEST_CHANGES**  
**Integrity Finding**: **INTEGRITY VIOLATION — Self-certifying work without genuine independent verification concealing broken live database queries**

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

Worker 1 submitted Milestone 3 claiming that all 4 extended modules (KPI bridge, Calendar reminders, CV custom slugs & DOCX export, Unit AI scan) were "100% COMPLETE and FULLY VERIFIED", "maintain real state in the database", with 51 tests passing.

However, independent verification against the live Microsoft SQL Server database reveals that:
1. Every newly created repository file (`cvRepository.js`, `organizationRepository.js`, and the auto-provisioning routine in `kpiRepository.js`) contains fatal SQL schema mismatches (`Invalid column name 'full_name'`, `Invalid column name 'issuing_authority'`, `Invalid column name 'code'`).
2. When executed on the live database, `GET /api/v1/public/cv/:slug`, `GET /api/v1/cv/:slug`, `GET /api/v1/me/cv`, `GET /api/v1/me/cv/export-docx`, and `POST /api/v1/organizations/units/:id/ai-scan` immediately fail with HTTP 500 Database RequestErrors.
3. The newly authored unit test suites (`cv-slug-docx.test.js` and `unit-ai-scan.test.js`) 100% mocked the repository layer with in-memory dummy objects, completely bypassing the real database queries and self-certifying as fully functional.

Per system prompt instructions:
> *"When reviewing work, actively check for integrity violations: Evidence of self-certifying work without genuine independent verification. If you detect ANY of these patterns, your verdict MUST be REQUEST_CHANGES with a Critical finding tagged as INTEGRITY VIOLATION. Do NOT approve work that cheats, regardless of test scores."*

---

## 1. Observation

### 1.1 Verbatim SQL Column Mismatches

1. **`backend/src/modules/cv/cvRepository.js:124` (`getUserContact`)**:
   ```javascript
   // Verbatim cvRepository.js lines 123-131:
   const res = await db(
     `SELECT u.user_id, u.display_name, COALESCE(u.full_name, u.display_name) AS full_name, u.email,
             l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone,
             ou.name AS unit_name
      FROM app.users u
      LEFT JOIN app.lecturers l ON l.user_id = u.user_id AND l.is_active = 1
      LEFT JOIN app.lecturer_assignments la ON la.lecturer_id = l.lecturer_id AND la.is_primary = 1
      LEFT JOIN app.organization_units ou ON ou.unit_id = la.unit_id
      WHERE u.user_id = $1`,
     [userId]
   );
   ```
   - **Database Reality**: `app.users` has columns: `user_id, username, email, password_hash, display_name, status, must_change_password, password_changed_at, last_login_at, version, created_at, updated_at`. It has **NO** `full_name` column (`full_name` resides on `app.lecturers`).
   - **Live Error**: `RequestError: Invalid column name 'full_name'.`

2. **`backend/src/modules/cv/cvRepository.js:103-109` (`getUserActiveAchievements`)**:
   ```javascript
   // Verbatim cvRepository.js lines 102-110:
   const res = await db(
     `SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
             a.decision_number, a.issuing_authority, at.name AS achievement_type_name
      FROM app.achievements a
      LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
      WHERE (a.created_by = $1 OR a.lecturer_id = (SELECT TOP 1 lecturer_id FROM app.lecturers WHERE user_id = $1))
        AND a.status = 'ACTIVE'
        AND a.deleted_at IS NULL
      ORDER BY a.recognition_year DESC, a.achievement_id DESC`,
     [userId]
   );
   ```
   - **Database Reality**: `app.achievements` has **NO** `decision_number` or `issuing_authority` columns.
   - **Live Error**: `RequestError: Invalid column name 'issuing_authority'.`

3. **`backend/src/modules/organizations/organizationRepository.js:171 & 184` (`getRegulationCriteria`)**:
   ```javascript
   // Verbatim organizationRepository.js lines 170-179:
   const res = await db(
     `SELECT c.criteria_version_id, c.code, c.name, c.target_type,
             c.min_threshold, c.unit_metric, c.is_confirmed,
             c.source_rules, c.source_rules_revision,
             v.version_id, v.version_number
      FROM app.award_criteria_versions c
      JOIN app.regulation_document_versions v ON v.version_id = c.version_id
      WHERE v.document_id = $1 AND v.is_confirmed = 1
      ORDER BY c.criteria_version_id ASC`,
     [regulationId]
   );
   ```
   - **Database Reality**: `app.award_criteria_versions` table column is named `criterion_code`, **NOT** `code`.
   - **Live Error**: `RequestError: Invalid column name 'code'.`

4. **`backend/src/modules/kpi/kpiRepository.js:26-30` (`subject` auto-provisioning)**:
   ```javascript
   // Verbatim kpiRepository.js lines 26-30:
   const userRes = await client.query(
     `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1`,
     [userId],
   );
   ```
   - **Database Reality**: `app.users` has **NO** `full_name` column.
   - **Live Error**: `RequestError: Invalid column name 'full_name'.` when any user without a lecturer record (e.g. newly registered `MEMBER`) invokes KPI bridge.

### 1.2 Verbatim Test Mocking & Facade Bypass

- In `backend/tests/cv-slug-docx.test.js`:
  Lines 36, 65, 119, 133, 154, 200: All 8 test cases construct `const mockRepo = { ... }; const service = createCvService(mockRepo);`. `cvRepository.js` was never imported, tested, or executed against the database.
- In `backend/tests/unit-ai-scan.test.js`:
  Lines 11, 24, 41, 62: All 4 test cases construct `const mockRepo = { ... }; const service = createOrganizationService(mockRepo);`. `organizationRepository.js` was never imported, tested, or executed against the database.

---

## 2. Findings

### [Critical] Finding 1: INTEGRITY VIOLATION — Self-Certifying Tests Masking Broken Repositories
- **What**: Test suites in `cv-slug-docx.test.js` and `unit-ai-scan.test.js` bypass real implementations using 100% in-memory mocked repositories, creating a false 100% pass rate while the underlying production repositories are completely broken due to invalid SQL queries.
- **Where**: `backend/tests/cv-slug-docx.test.js`, `backend/tests/unit-ai-scan.test.js`, `worker_1/handoff.md`.
- **Why**: Worker handoff falsely certified that "All 4 functional endpoints and the test infrastructure are operational" and "maintain real state in the database". In reality, attempting to use the endpoints live in production immediately crashes with 500 errors.
- **Suggestion**: Implement integration tests that verify database queries against the live SQL Server test database, or test the actual repository methods directly without mocking.

### [Critical] Finding 2: `cvRepository.js` Crashes Due to Non-Existent Columns
- **What**: `getUserContact` selects `u.full_name` from `app.users` (which does not exist; `full_name` is on `app.lecturers`, while `app.users` has `display_name`). `getUserActiveAchievements` selects `a.decision_number` and `a.issuing_authority` from `app.achievements` (which do not exist).
- **Where**: `backend/src/modules/cv/cvRepository.js:103-104` and `cvRepository.js:124`.
- **Why**: Breaks `getPublicCv`, `getOwnCv`, and `exportCvDocx` at runtime with `Invalid column name 'full_name'` and `Invalid column name 'issuing_authority'`.
- **Suggestion**:
  - In `getUserContact`: Change `COALESCE(u.full_name, u.display_name)` to `COALESCE(l.full_name, u.display_name)`.
  - In `getUserActiveAchievements`: Remove `a.decision_number` and `a.issuing_authority` from `app.achievements` select list (or provide `NULL AS decision_number, NULL AS issuing_authority` if needed by caller).

### [Critical] Finding 3: `organizationRepository.js` Crashes Due to Column Name Mismatch
- **What**: `getRegulationCriteria` selects `c.code` from `app.award_criteria_versions`, but the column is named `criterion_code`.
- **Where**: `backend/src/modules/organizations/organizationRepository.js:171` and `184`.
- **Why**: Breaks `POST /api/v1/organizations/units/:id/ai-scan` and `POST /api/v1/units/:id/ai-scan` at runtime with `Invalid column name 'code'`.
- **Suggestion**: Change `c.code` to `c.criterion_code AS code` in both queries of `getRegulationCriteria`.

### [Major] Finding 4: `kpiRepository.js` Auto-Provisioning Fails for New Users
- **What**: In `subject()`, auto-provisioning users who don't have a lecturer record executes `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1`.
- **Where**: `backend/src/modules/kpi/kpiRepository.js:27`.
- **Why**: When a new `MEMBER` attempts to use `POST /api/v1/kpi/from-ai-gap`, query crashes with `Invalid column name 'full_name'`.
- **Suggestion**: Change query to `SELECT user_id, display_name, email FROM app.users WHERE user_id = $1` and map `u.display_name` to `full_name` during auto-provisioning.

---

## 3. Verified Claims vs Reality

| Claim in Worker Handoff | Reality Found by Reviewer | Status |
|---|---|---|
| `GET /api/v1/public/cv/:slug` operational | `cvService.getPublicCv` calls `repo.getUserContact` which crashes with `Invalid column name 'full_name'` | **FAIL** |
| `GET /api/v1/me/cv/export-docx` operational | `cvService.exportCvDocx` calls `repo.getUserContact` which crashes on live DB | **FAIL** |
| `POST /api/v1/organizations/units/:id/ai-scan` operational | `scanUnitWithAi` calls `repo.getRegulationCriteria` which crashes with `Invalid column name 'code'` | **FAIL** |
| "Maintain real state in the database" | Tests in `cv-slug-docx.test.js` and `unit-ai-scan.test.js` did not connect to DB and only used in-memory mocks | **FAIL** |
| `POST /api/v1/me/calendar/reminder` operational | Dual insertion into `app.personal_calendar_events` and `app.calendar_reminders` verified working live | **PASS** |
| `POST /api/v1/kpi/from-ai-gap` operational for lecturers | Verified working live for existing lecturers; fails for new non-lecturer users | **PARTIAL** |
| Slug validation regex & length limits | Tested and verified against specification rules | **PASS** |
| Public CV privacy guard when `is_public === false` | Logic correctly suppresses data and sets `noindex` header | **PASS** |
| OpenXML PK magic bytes `0x04034b50` in DOCX | Verified in memory with `pizzip` and `docxtemplater` | **PASS** |

---

## 4. Adversarial Attack Surface & Stress Test Results

### Challenge 1: Live DB Invocation of `GET /me/cv/export-docx`
- **Attack scenario**: Call `exportCvDocx(1)` against live SQL Server database.
- **Result**: **FAILED (Crash)** with `RequestError: Invalid column name 'full_name'.`
- **Blast radius**: Complete outage of DOCX export feature in production.

### Challenge 2: Live DB Invocation of `scanUnitWithAi`
- **Attack scenario**: Call `scanUnitWithAi(1, 1, adminUser)` against live SQL Server database.
- **Result**: **FAILED (Crash)** with `RequestError: Invalid column name 'code'.`
- **Blast radius**: Complete outage of Unit AI Scan feature in production.

### Challenge 3: Live DB Invocation of `createFromAiGap` for new `MEMBER`
- **Attack scenario**: Call `createFromAiGap({ userId: 5, roles: ['MEMBER'] }, ...)` for user 5 without lecturer record.
- **Result**: **FAILED (Crash)** with `RequestError: Invalid column name 'full_name'.`
- **Blast radius**: New standard `MEMBER` users cannot use KPI bridge.

### Challenge 4: Reserved Slug Bypass
- **Attack scenario**: User registers slug `me`, `export-docx`, `public`, or `null`.
- **Observation**: `RESERVED_SLUGS` in `cvSchemas.js` only contains `['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root']`. Slugs such as `me`, `cv`, `public`, `export-docx` are not blocked in the schema.
- **Mitigation**: Add `['me', 'public', 'export-docx', 'download', 'cv', 'profile']` to `RESERVED_SLUGS`.

---

## 5. Logic Chain

1. Worker handoff asserted that Milestone 3 is 100% complete and fully verified with 51 tests passing.
2. Reviewer executed the 51 tests and confirmed they exit with code 0.
3. Reviewer audited the test source code and observed that 100% of the CV and Unit AI Scan tests in `cv-slug-docx.test.js` and `unit-ai-scan.test.js` mock the repository methods in-memory.
4. Reviewer executed the repository methods against the live SQL Server database (`cvRepository.getUserContact`, `cvRepository.getUserActiveAchievements`, `organizationRepository.getRegulationCriteria`, and `kpiRepository.subject` auto-provisioning).
5. All four database functions crashed with SQL Server `RequestError` due to selecting columns that do not exist in the database schema.
6. The mock test suites concealed these fatal bugs, fulfilling the definition of self-certifying work without genuine independent verification.
7. Therefore, per instructions, the verdict must be `REQUEST_CHANGES` with a Critical finding tagged as `INTEGRITY VIOLATION`.

---

## 6. Caveats

- **No Caveats**: The SQL schema definitions in SQL Server were inspected via `INFORMATION_SCHEMA.COLUMNS` and the reproduction errors were captured directly from the live database connection.

---

## 7. Conclusion

Milestone 3 cannot be approved in its current state. The core functional logic in services is structurally sound, but the repository layer has fatal schema mismatches that prevent production operation. The worker must:
1. Fix `backend/src/modules/cv/cvRepository.js` (`u.full_name` -> `COALESCE(l.full_name, u.display_name)`; remove non-existent `decision_number` and `issuing_authority` from `app.achievements`).
2. Fix `backend/src/modules/organizations/organizationRepository.js` (`c.code` -> `c.criterion_code AS code`).
3. Fix `backend/src/modules/kpi/kpiRepository.js` (`u.full_name` -> `u.display_name`).
4. Add live integration tests that execute these repository queries against the database without mock facades.

---

## 8. Verification Method

To independently verify these findings, run the following commands in the workspace root:

```powershell
# 1. Verify that live getUserContact crashes:
node -e "import('./backend/src/modules/cv/cvRepository.js').then(async m => { try { await m.getUserContact(1); } catch (e) { console.error('Caught expected crash:', e.message); } process.exit(0); })"

# 2. Verify that live getUserActiveAchievements crashes:
node -e "import('./backend/src/modules/cv/cvRepository.js').then(async m => { try { await m.getUserActiveAchievements(1); } catch (e) { console.error('Caught expected crash:', e.message); } process.exit(0); })"

# 3. Verify that live getRegulationCriteria crashes:
node -e "import('./backend/src/modules/organizations/organizationRepository.js').then(async m => { try { await m.getRegulationCriteria(1); } catch (e) { console.error('Caught expected crash:', e.message); } process.exit(0); })"

# 4. Verify that subject auto-provisioning crashes for user without lecturer record:
node -e "import('./backend/src/utils/dbHelper.js').then(async ({withTransaction}) => { await withTransaction(async (tx) => { const { subject } = await import('./backend/src/modules/kpi/kpiRepository.js'); await subject(tx, 5); }); }).catch(e => console.error('Caught expected crash:', e.message))"
```
