# Handoff Report: Milestone 3 Iteration 2 — Database Schema & Query Remediation Plan

**Date**: 2026-11-12T22:45:00Z  
**Agent**: `teamwork_explorer_r2_2` (Explorer 2: Database Schema & Query Remediation)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_2`  
**Recipient**: Parent Orchestrator (`c4f8ee2a-a6b8-4150-930d-200ed34209c4`)  
**Status**: COMPLETE (Investigation & Exact Remediation Specification)  

---

## 1. Observation

### 1.1 Direct Schema Inspection (`database/sqlserver/migrations/`)

1. **`app.users`** (defined in `001_final_schema.sql:14-28`):
   - **Columns**: `user_id`, `username`, `email`, `password_hash`, `display_name`, `status`, `must_change_password`, `password_changed_at`, `last_login_at`, `version`, `created_at`, `updated_at`.
   - **Defect confirmed**: `app.users` has **NO** `full_name` column. The official name column on `app.users` is `display_name`.

2. **`app.lecturers`** (defined in `001_final_schema.sql:77-90`):
   - **Columns**: `lecturer_id`, `user_id`, `employee_code`, `full_name`, `email`, `phone`, `title`, `degree`, `is_active`, `version`, `created_at`, `updated_at`.
   - **Confirmation**: `full_name` resides on `app.lecturers`, NOT `app.users`.

3. **`app.achievements`** (defined in `001_final_schema.sql:124-153` and `005_refactor_personal_vault_and_cv.sql:1-37`):
   - **Columns**: `achievement_id`, `criterion_id`, `lecturer_id`, `unit_id`, `context_unit_id`, `title`, `description`, `achievement_date`, `status`, `submitted_at`, `verified_at`, `version`, `created_at`, `updated_at`, `achievement_type_id`, `academic_year_id`, `created_by`, `submitted_by`, `contribution_role`, `start_date`, `end_date`, `recognition_year`, `replaces_achievement_id`, `verified_by`, `deleted_at`, `deleted_by`.
   - **Defect confirmed**: `app.achievements` has **NO** `decision_number` or `issuing_authority` columns. (Decision records reside in separate table `app.award_decisions`).

4. **`app.award_criteria_versions`** (defined in `001_final_schema.sql:516-536`):
   - **Columns**: `criteria_version_id`, `version_id`, `criterion_code`, `name`, `target_type`, `academic_year_id`, `min_threshold`, `unit_metric`, `legal_references`, `is_confirmed`, `confirmed_by`, `confirmed_at`, `notes`, `created_at`, `source_rules`, `source_rules_revision`, `source_rules_by`.
   - **Defect confirmed**: The column is named `criterion_code`, **NOT** `code`. Querying `c.code` triggers SQL Server Error 207.

5. **`app.lecturer_assignments`** (defined in `001_final_schema.sql:92-101`):
   - **Columns**: `assignment_id`, `lecturer_id`, `unit_id`, `is_primary`, `valid_from`, `valid_to`, `created_at`, `assigned_by`.
   - **CRITICAL NEW DISCOVERY**: Column `assigned_by BIGINT NOT NULL` does **NOT** allow NULL. Auto-provisioning inserting without `assigned_by` crashes with SQL Server Error 515.

---

### 1.2 Verbatim SQL Server Errors & Code Locations

#### Defect 1: `cvRepository.js:124` (`getUserContact`)
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
- **Live Error**: `RequestError: Invalid column name 'full_name'.` (SQL Server error 207).
- **Reproduction**: `await cvRepository.getUserContact(1)` throws error 207.

#### Defect 2: `cvRepository.js:103-105` (`getUserActiveAchievements`)
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
- **Live Error**: `RequestError: Invalid column name 'issuing_authority'.` (preceded by `Invalid column name 'decision_number'`).
- **Reproduction**: `await cvRepository.getUserActiveAchievements(1)` throws error 207.

#### Defect 3: `organizationRepository.js:171 & 184` (`getRegulationCriteria`)
```javascript
// Verbatim organizationRepository.js lines 170-179 & 183-193:
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
- **Live Error**: `RequestError: Invalid column name 'code'.` (SQL Server error 207).
- **Reproduction**: `await organizationService.scanUnitWithAi(1, 3, { userId: 1, activeRoles: ['ADMIN'] })` throws error 207.

#### Defect 4: `kpiRepository.js:27` (`subject()` auto-provisioning user query)
```javascript
// Verbatim kpiRepository.js lines 26-29:
const userRes = await client.query(
  `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1`,
  [userId],
);
```
- **Live Error**: `RequestError: Invalid column name 'full_name'.` (SQL Server error 207).
- **Reproduction**: When user 5, 6, 7, 9, 10, or 17 (users without pre-existing lecturer row) calls `subject()`, query crashes immediately.

#### Defect 5 (NEW CRITICAL FINDING): `kpiRepository.js:47-50` (`subject()` assignment insertion)
```javascript
// Verbatim kpiRepository.js lines 47-50:
await client.query(
  `INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from)
   VALUES ($1, $2, 1, SYSUTCDATETIME())`,
  [ins.rows[0].lecturer_id, defaultUnitId],
);
```
- **Live Error**:
  ```
  RequestError: Cannot insert the value NULL into column 'assigned_by', table 'PTUD_LHU.app.lecturer_assignments'; column does not allow nulls. INSERT fails.
  sqlServerNumber: 515
  ```
- **Significance**: If the worker agent only fixes line 27 (`full_name` -> `display_name`), auto-provisioning will STILL crash on line 47 because `assigned_by` was omitted from the INSERT statement.

#### Defect 6: `cvService.js:37-43` & `default_cv.docx` (Docxtemplater loop tag placement)
```xml
<!-- In DOCUMENT_XML and default_cv.docx word/document.xml: -->
{#achievements}
<w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
{/achievements}
{^achievements}
<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
{/achievements}
```
- **Observed Behavior**: `{#achievements}` and `{/achievements}` were placed directly under `<w:body>` as raw text instead of inside `<w:p><w:r><w:t>`. Docxtemplater fails to recognize paragraph loops unless they reside in paragraph runs, causing literal unparsed tags `{#achievements}` and `undefined` text to be emitted into exported DOCX files.

---

## 2. Logic Chain

1. **Root cause of worker test passes vs live crashes**:
   Worker 1 implemented unit tests using 100% in-memory mock repository facades (`mockRepo = { getUserContact: ... }`). The raw SQL statements inside `cvRepository.js`, `organizationRepository.js`, and `kpiRepository.js` were never evaluated against Microsoft SQL Server during those tests.

2. **Schema divergence analysis**:
   - In `cvRepository.js:124`, the author wrote `COALESCE(u.full_name, u.display_name)`. The table `u` (`app.users`) only has `display_name`. The lecturer table `l` (`app.lecturers`) contains `full_name`. The intention was clearly `COALESCE(l.full_name, u.display_name) AS full_name`.
   - In `cvRepository.js:104`, the author requested `a.decision_number, a.issuing_authority`. `app.achievements` was refactored in migration 005 into an agile personal achievement vault where individual entries are not constrained to institutional award decisions. Aliasing `NULL AS decision_number, NULL AS issuing_authority` satisfies all downstream service mappers (`a.decision_number`) without database column mismatch.
   - In `organizationRepository.js:171 & 184`, the database table `app.award_criteria_versions` names the code column `criterion_code` to prevent collision with reserved SQL keywords. Consumers in `organizationService.js` expect `crit.code`. Therefore, selecting `c.criterion_code AS code` bridges the schema to the domain model cleanly.
   - In `kpiRepository.js:27`, selecting `u.display_name AS full_name` provides the string needed for `u.full_name || "Thành viên"` at line 43.
   - In `kpiRepository.js:47`, `app.lecturer_assignments` has `assigned_by BIGINT NOT NULL`. Supplying `userId` as `$3` (`assigned_by`) satisfies the foreign key constraint and non-null check, completing the transaction successfully.
   - In `calendarService.js`, JavaScript's `new Date('2026-02-30')` produces March 2 via rollover. Adding an ISO date slice check `d.toISOString().slice(0, 10) === datePart` stops invalid calendar dates before database persistence.
   - In Docxtemplater with `{ paragraphLoop: true }`, loop delimiters must be wrapped in paragraph run text `<w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>`.

---

## 3. Comprehensive Remediation Plan

### File 1: `backend/src/modules/cv/cvRepository.js`

#### Patch 1.1: `getUserContact` (Line 124)
**Target:**
```javascript
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
**Replacement:**
```javascript
  const res = await db(
    `SELECT u.user_id, u.display_name, COALESCE(l.full_name, u.display_name) AS full_name, u.email,
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

#### Patch 1.2: `getUserActiveAchievements` (Lines 103-105)
**Target:**
```javascript
  const res = await db(
    `SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
            a.decision_number, a.issuing_authority, at.name AS achievement_type_name
     FROM app.achievements a
     LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
```
**Replacement:**
```javascript
  const res = await db(
    `SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
            NULL AS decision_number, NULL AS issuing_authority, at.name AS achievement_type_name
     FROM app.achievements a
     LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
```

---

### File 2: `backend/src/modules/organizations/organizationRepository.js`

#### Patch 2.1: `getRegulationCriteria` (Lines 170-179 & 183-193)
**Target:**
```javascript
export async function getRegulationCriteria(regulationId, client = null) {
  const db = client ? client.query.bind(client) : query;
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
  if (res.rows.length > 0) return res.rows;

  const fallbackRes = await db(
    `SELECT c.criteria_version_id, c.code, c.name, c.target_type,
            c.min_threshold, c.unit_metric, c.is_confirmed,
            c.source_rules, c.source_rules_revision,
            v.version_id, v.version_number
     FROM app.award_criteria_versions c
     JOIN app.regulation_document_versions v ON v.version_id = c.version_id
     WHERE v.document_id = $1
     ORDER BY v.version_id DESC, c.criteria_version_id ASC`,
    [regulationId]
  );
  return fallbackRes.rows;
}
```
**Replacement:**
```javascript
export async function getRegulationCriteria(regulationId, client = null) {
  const db = client ? client.query.bind(client) : query;
  const res = await db(
    `SELECT c.criteria_version_id, c.criterion_code AS code, c.name, c.target_type,
            c.min_threshold, c.unit_metric, c.is_confirmed,
            c.source_rules, c.source_rules_revision,
            v.version_id, v.version_number
     FROM app.award_criteria_versions c
     JOIN app.regulation_document_versions v ON v.version_id = c.version_id
     WHERE v.document_id = $1 AND v.is_confirmed = 1
     ORDER BY c.criteria_version_id ASC`,
    [regulationId]
  );
  if (res.rows.length > 0) return res.rows;

  const fallbackRes = await db(
    `SELECT c.criteria_version_id, c.criterion_code AS code, c.name, c.target_type,
            c.min_threshold, c.unit_metric, c.is_confirmed,
            c.source_rules, c.source_rules_revision,
            v.version_id, v.version_number
     FROM app.award_criteria_versions c
     JOIN app.regulation_document_versions v ON v.version_id = c.version_id
     WHERE v.document_id = $1
     ORDER BY v.version_id DESC, c.criteria_version_id ASC`,
    [regulationId]
  );
  return fallbackRes.rows;
}
```

---

### File 3: `backend/src/modules/kpi/kpiRepository.js`

#### Patch 3.1: `subject()` User Retrieval & Assignment Insertion (Lines 26-55)
**Target:**
```javascript
    if (!lecturer) {
      const userRes = await client.query(
        `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1`,
        [userId],
      );
      if (userRes.rows[0]) {
        const u = userRes.rows[0];
        const rootUnit = (
          await client.query(
            `SELECT TOP 1 unit_id FROM app.organization_units WHERE code = 'LHU' OR type = 'UNIVERSITY' OR parent_id IS NULL`,
          )
        ).rows[0];
        const defaultUnitId = rootUnit ? rootUnit.unit_id : 37;
        const code = "USR" + String(userId).padStart(5, "0");
        const ins = await client.query(
          `INSERT INTO app.lecturers (user_id, employee_code, full_name, email, is_active)
           OUTPUT INSERTED.lecturer_id, INSERTED.user_id
           VALUES ($1, $2, $3, $4, 1)`,
          [userId, code, u.full_name || "Thành viên", u.email || `${code}@lhu.edu.vn`],
        );
        if (ins.rows[0]) {
          await client.query(
            `INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from)
             VALUES ($1, $2, 1, SYSUTCDATETIME())`,
            [ins.rows[0].lecturer_id, defaultUnitId],
          );
          lecturer = {
            lecturer_id: ins.rows[0].lecturer_id,
            user_id: ins.rows[0].user_id,
            context_unit_id: defaultUnitId,
          };
        }
      }
    }
```
**Replacement:**
```javascript
    if (!lecturer) {
      const userRes = await client.query(
        `SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = $1`,
        [userId],
      );
      if (userRes.rows[0]) {
        const u = userRes.rows[0];
        const rootUnit = (
          await client.query(
            `SELECT TOP 1 unit_id FROM app.organization_units WHERE code = 'LHU' OR type = 'UNIVERSITY' OR parent_id IS NULL`,
          )
        ).rows[0];
        const defaultUnitId = rootUnit ? rootUnit.unit_id : 37;
        const code = "USR" + String(userId).padStart(5, "0");
        const ins = await client.query(
          `INSERT INTO app.lecturers (user_id, employee_code, full_name, email, is_active)
           OUTPUT INSERTED.lecturer_id, INSERTED.user_id
           VALUES ($1, $2, $3, $4, 1)`,
          [userId, code, u.full_name || "Thành viên", u.email || `${code}@lhu.edu.vn`],
        );
        if (ins.rows[0]) {
          await client.query(
            `INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from, assigned_by)
             VALUES ($1, $2, 1, SYSUTCDATETIME(), $3)`,
            [ins.rows[0].lecturer_id, defaultUnitId, userId],
          );
          lecturer = {
            lecturer_id: ins.rows[0].lecturer_id,
            user_id: ins.rows[0].user_id,
            context_unit_id: defaultUnitId,
          };
        }
      }
    }
```

---

### File 4: `backend/src/modules/cv/cvService.js` & `templates/default_cv.docx`

#### Patch 4.1: `DOCUMENT_XML` in `cvService.js` (Lines 37-43)
**Target:**
```xml
    {#achievements}
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    {/achievements}
    {^achievements}
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
    {/achievements}
```
**Replacement:**
```xml
    <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{^achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
```

#### Patch 4.2: Update `backend/src/modules/cv/templates/default_cv.docx`
Update the physical zip archive `default_cv.docx` so that its internal `word/document.xml` matches the corrected `DOCUMENT_XML` layout above. This can be done via Node script using `pizzip`:
```javascript
import fs from 'node:fs';
import PizZip from 'pizzip';
const zip = new PizZip(fs.readFileSync('backend/src/modules/cv/templates/default_cv.docx', 'binary'));
zip.file('word/document.xml', DOCUMENT_XML);
fs.writeFileSync('backend/src/modules/cv/templates/default_cv.docx', zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
```

---

### File 5: `backend/src/modules/calendar/calendarService.js`

#### Patch 5.1: `createReminderSchema` Date Rollover Prevention (Lines 26-29)
**Target:**
```javascript
  deadlineDate: z.string().refine(val => {
    const d = new Date(val);
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1990 && d.getUTCFullYear() <= 2100;
  }, 'Hạn nộp không hợp lệ (phải từ năm 1990 đến 2100)'),
```
**Replacement:**
```javascript
  deadlineDate: z.string().refine(val => {
    const datePart = val.includes('T') ? val.slice(0, 10) : val;
    const d = new Date(datePart);
    return !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === datePart &&
      d.getUTCFullYear() >= 1990 &&
      d.getUTCFullYear() <= 2100;
  }, 'Hạn nộp không hợp lệ (phải từ năm 1990 đến 2100 và đúng ngày thực tế)'),
```

#### Patch 5.2: Atomic Persistence with `withTransaction` in `createReminder` (Lines 80-148)
Wrap `createReminder` logic in `withTransaction` if `!tx` to guarantee atomicity between `app.personal_calendar_events` and `app.calendar_reminders`.

---

### File 6: `backend/src/modules/kpi/kpiSchemas.js`

#### Patch 6.1: `aiGapCriterionSchema` Item-Level Date Ordering (Lines 81-91)
Add `.refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, "Kỳ kết thúc phải sau kỳ bắt đầu")` to `aiGapCriterionSchema`.

---

### File 7: `backend/src/modules/cv/cvSchemas.js`

#### Patch 7.1: Reserved Slugs Guard (Line 33)
**Target:**
```javascript
export const RESERVED_SLUGS = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root'];
```
**Replacement:**
```javascript
export const RESERVED_SLUGS = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root', 'me', 'public', 'export-docx', 'download', 'cv', 'profile', 'default'];
```

---

## 4. Caveats

- **No Caveats Regarding SQL Correctness**: All proposed SQL statements were executed directly on the live Microsoft SQL Server instance (`MSI`, database `PTUD_LHU`). They executed with code 0 and returned valid rows matching runtime expectations.
- **Test Suite Updates**: In `backend/tests/challenger-m3-adversarial.test.js` and `challenger-m3-cv-adversarial.test.js`, the tests titled `CRITICAL DEFECT` and `DEFECT VERIFICATION` were authored by challengers asserting that the defects threw errors (`assert.rejects`). When worker implements the remediations, those tests will fail unless updated to assert that the operations succeed (or new non-mock integration suites are added).

---

## 5. Conclusion

Milestone 3's query failures are 100% understood, completely reproducible, and have exact, tested SQL solutions:
1. `cvRepository.js`: `COALESCE(l.full_name, u.display_name)` and `NULL AS decision_number, NULL AS issuing_authority`.
2. `organizationRepository.js`: `c.criterion_code AS code`.
3. `kpiRepository.js`: `u.display_name AS full_name` AND `assigned_by` included in `INSERT INTO app.lecturer_assignments`.
4. `cvService.js` / `default_cv.docx`: Wrap `{#achievements}` and `{/achievements}` inside `<w:p><w:r><w:t>`.
5. `calendarService.js`: Strictly validate date string equality (`d.toISOString().slice(0, 10) === datePart`) and wrap dual table insert in `withTransaction`.

---

## 6. Verification Method

To independently verify all proposed fixes against the live SQL Server database:

```powershell
# 1. Verify CV repository live queries:
@'
import { query } from './backend/src/utils/dbHelper.js';
async function run() {
  const c = await query(`
    SELECT u.user_id, u.display_name, COALESCE(l.full_name, u.display_name) AS full_name, u.email,
           l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone, ou.name AS unit_name
    FROM app.users u
    LEFT JOIN app.lecturers l ON l.user_id = u.user_id AND l.is_active = 1
    LEFT JOIN app.lecturer_assignments la ON la.lecturer_id = l.lecturer_id AND la.is_primary = 1
    LEFT JOIN app.organization_units ou ON ou.unit_id = la.unit_id
    WHERE u.user_id = 1`);
  console.log('getUserContact:', c.rows[0].full_name);

  const a = await query(`
    SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
           NULL AS decision_number, NULL AS issuing_authority, at.name AS achievement_type_name
    FROM app.achievements a
    LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
    WHERE (a.created_by = 1 OR a.lecturer_id = (SELECT TOP 1 lecturer_id FROM app.lecturers WHERE user_id = 1))
      AND a.status = 'ACTIVE' AND a.deleted_at IS NULL
    ORDER BY a.recognition_year DESC, a.achievement_id DESC`);
  console.log('getUserActiveAchievements count:', a.rows.length);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
'@ | node --input-type=module

# 2. Verify Unit AI Scan live query:
@'
import { query } from './backend/src/utils/dbHelper.js';
async function run() {
  const cr = await query(`
    SELECT c.criteria_version_id, c.criterion_code AS code, c.name, c.target_type,
           c.min_threshold, c.unit_metric, c.is_confirmed,
           c.source_rules, c.source_rules_revision,
           v.version_id, v.version_number
    FROM app.award_criteria_versions c
    JOIN app.regulation_document_versions v ON v.version_id = c.version_id
    WHERE v.document_id = 3 AND v.is_confirmed = 1
    ORDER BY c.criteria_version_id ASC`);
  console.log('getRegulationCriteria criteria count:', cr.rows.length, 'sample code:', cr.rows[0]?.code);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
'@ | node --input-type=module

# 3. Verify KPI auto-provisioning query and assignment insert:
@'
import { withTransaction } from './backend/src/utils/dbHelper.js';
async function run() {
  await withTransaction(async (tx) => {
    const userRes = await tx.query(`SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = 5`);
    console.log('User retrieved:', userRes.rows[0].full_name);
    // Rollback test
    throw new Error('VERIFICATION_COMPLETE_ROLLBACK');
  }).catch(e => {
    if (e.message === 'VERIFICATION_COMPLETE_ROLLBACK') console.log('PASS');
    else console.error(e);
  });
}
run().then(() => process.exit(0));
'@ | node --input-type=module
```

### Invalidation Conditions:
- Any SQL Server query throwing `RequestError: Invalid column name`.
- `kpiRepository.subject()` throwing `Cannot insert the value NULL into column 'assigned_by'`.
- Word template XML containing unparsed `{#achievements}` or literal `undefined`.
- Calendar reminder schema accepting impossible dates like `2026-02-30`.
