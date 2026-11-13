# Handoff Report: Milestone 3 — Challenger 2 (Adversarial Verification of CV Profiles, Slug & DOCX Export)

**Date**: 2026-11-12T21:50:00Z  
**Agent**: `teamwork_challenger_2` (Critic & Specialist)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_2`  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Observation

### 1.1 Scope & Test Harness Execution
I designed and executed an empirical adversarial verification suite in `backend/tests/challenger-m3-cv-adversarial.test.js` containing 15 test cases specifically targeting:
1. `GET /api/v1/public/cv/:slug` and `GET /api/v1/cv/:slug` (unauthenticated access, privacy screen, 404 missing slug/UUID).
2. `PUT /api/v1/me/cv` (slug length boundaries, regex format, reserved system slugs, 409 conflict on collision, template ID whitelist).
3. `GET /api/v1/me/cv/export-docx` (binary stream, Content-Type, Content-Disposition, OpenXML PK signature `0x04034b50`, 0-achievement edge case, Unicode Vietnamese accents and scientific symbols).
4. Direct empirical execution of `cvRepository` against the live SQL Server database.

Command executed:
```powershell
node --test backend/tests/challenger-m3-cv-adversarial.test.js
```

Output:
```
✔ Slug Validation: All reserved keywords must be rejected with 400 (1.5795ms)
✔ Slug Validation: Length boundaries (< 3 and > 100) must be rejected with 400 (0.4401ms)
✔ Slug Validation: Invalid characters, uppercase, and formatting must be rejected with 400 (0.3297ms)
✔ Slug Validation: Duplicate slug collision across different users throws ConflictError (409) (1.1235ms)
✔ Template ID Validation: Standard templates allowed, arbitrary strings rejected with 400 (0.4642ms)
✔ Privacy Screen: Private profile strictly hides contact and achievements without leaking in payload (0.4034ms)
✔ Public CV: Non-existent slug and non-existent UUID fallback throw NotFoundError (404) (0.6217ms)
✔ Public CV: Valid public profile exposes full data and active achievements with template ID (0.3143ms)
✔ HTTP Public CV: Unauthenticated access permitted, X-Robots-Tag: noindex, nofollow enforced (122.2311ms)
✔ DOCX Export: Valid OpenXML binary stream, PK zip signature 0x04034b50 (42.8274ms)
✔ DOCX Export: Edge case of 0 achievements produces valid document without crashing (9.6318ms)
✔ DOCX Export: Profile unicode and scientific symbols (Σ, α, β) rendered in document.xml (7.0128ms)
✔ DEFECT VERIFICATION 1: cvRepository.getUserContact fails on live SQL query due to invalid column "full_name" (14.3048ms)
✔ DEFECT VERIFICATION 2: cvRepository.getUserActiveAchievements fails on live SQL query due to non-existent columns (4.6692ms)
✔ DEFECT VERIFICATION 3: DOCX Template malformation fails to expand achievements loop in docxtemplater (5.8467ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ duration_ms 1319.8419
```

### 1.2 Confirmed Critical Defects Discovered

#### Defect 1: SQL Server Error 207 in `cvRepository.getUserContact`
- **Location**: `backend/src/modules/cv/cvRepository.js:124`
- **Observed Code**:
  ```sql
  SELECT u.user_id, u.display_name, COALESCE(u.full_name, u.display_name) AS full_name, u.email,
         l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone,
         ou.name AS unit_name
  FROM app.users u
  LEFT JOIN app.lecturers l ON l.user_id = u.user_id AND l.is_active = 1
  ```
- **Verbatim Error**:
  ```
  RequestError: Invalid column name 'full_name'.
      at handleError (backend/node_modules/mssql/lib/tedious/request.js:447:15)
    code: 'EREQUEST',
    number: 207,
    lineNumber: 1
  ```
- **Database Reality**: `app.users` has columns `user_id`, `username`, `email`, `password_hash`, `display_name`, `status`, `must_change_password`, `password_changed_at`, `last_login_at`, `version`, `created_at`, `updated_at`. It has **no** `full_name` column! The column `full_name` is on `app.lecturers l`.
- **Runtime Impact**: Any call to `cvRepository.getUserContact(userId)` crashes with 500 Internal Server Error. This breaks `GET /api/v1/public/cv/:slug` (when `is_public = 1`), `GET /api/v1/me/cv`, `GET /api/v1/me/cv/profile`, and `GET /api/v1/me/cv/export-docx`.

#### Defect 2: SQL Server Error 207 in `cvRepository.getUserActiveAchievements`
- **Location**: `backend/src/modules/cv/cvRepository.js:103-105`
- **Observed Code**:
  ```sql
  SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
         a.decision_number, a.issuing_authority, at.name AS achievement_type_name
  FROM app.achievements a
  ```
- **Verbatim Error**:
  ```
  RequestError: Invalid column name 'issuing_authority'.
  precedingErrors: [ RequestError: Invalid column name 'decision_number'. ]
    code: 'EREQUEST',
    number: 207,
    lineNumber: 2
  ```
- **Database Reality**: `app.achievements` contains `achievement_id`, `criterion_id`, `lecturer_id`, `unit_id`, `context_unit_id`, `title`, `description`, `achievement_date`, `status`, `submitted_at`, `verified_at`, `version`, `created_at`, `updated_at`, `achievement_type_id`, `academic_year_id`, `created_by`, `submitted_by`, `contribution_role`, `start_date`, `end_date`, `recognition_year`, `replaces_achievement_id`, `verified_by`, `deleted_at`, `deleted_by`. Columns `decision_number` and `issuing_authority` **do not exist** on `app.achievements`.
- **Runtime Impact**: Any attempt to load active achievements from the database crashes with 500 Internal Server Error.

#### Defect 3: Malformed OpenXML Template Breaks Docxtemplater Achievement Loop
- **Location**: `backend/src/modules/cv/templates/default_cv.docx` and `backend/src/modules/cv/cvService.js:37-43`
- **Observed Code**:
  ```xml
  {#achievements}
  <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
  {/achievements}
  {^achievements}
  <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
  {/achievements}
  ```
- **Observed Rendered Output inside `word/document.xml`**:
  ```xml
  {#achievements}
  <w:p><w:r><w:t xml:space="preserve">- undefined. Phó Giáo sư (undefined) - undefined</w:t></w:r></w:p>
  {/achievements}
  {^achievements}
  <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
  {/achievements}
  ```
- **Analysis**: In WordprocessingML, children of `<w:body>` must be block elements (`<w:p>`). `{#achievements}` and `{/achievements}` were placed as raw text nodes directly under `<w:body>`. As a consequence, Docxtemplater never parses them as loop tags:
  1. The literal tag text `{#achievements}` remains verbatim in the exported Word document.
  2. Achievement titles are **never rendered**.
  3. The inner `{title}` is evaluated against the root object's `contact.title` (yielding the user's academic rank e.g. "Phó Giáo sư" instead of the achievement title).
  4. `{index}`, `{recognitionYear}`, and `{type}` are evaluated against root scope where they are missing, printing literal `undefined`.
  5. Both the malformed row and the `{^achievements}` fallback text are displayed at the same time.

---

## 2. Logic Chain

1. **Why worker_1's test suite passed despite fatal database and export bugs**:
   - In `backend/tests/cv-slug-docx.test.js`, worker_1 implemented mock objects for `cvRepository` (e.g. `mockRepo.getUserContact` and `mockRepo.getUserActiveAchievements` returning hardcoded JavaScript object literals).
   - In `backend/tests/cv-slug-docx.test.js:180-197`, worker_1 tested DOCX export by only checking `buffer.length > 500`, `readUInt32LE(0) === 0x04034b50`, and `buffer.toString().includes('word/document.xml')`. Worker 1 **never checked** whether the achievement list was actually expanded in `word/document.xml`.
   - Therefore, unit tests passed because they mocked away the broken SQL queries and never asserted rendered content.
2. **Why this causes production failure**:
   - When a user navigates to `/api/v1/public/cv/:slug` for an active, public CV, `cvService.getPublicCv` invokes the live `cvRepository.getUserContact(profile.user_id)`.
   - SQL Server rejects the query with error 207 (`Invalid column name 'full_name'`), causing Express to return HTTP 500 Internal Server Error to the end user.
   - Even if `getUserContact` were fixed, `cvRepository.getUserActiveAchievements` immediately triggers SQL Server error 207 for `decision_number` and `issuing_authority`.
   - When an authenticated user downloads their DOCX export (`GET /api/v1/me/cv/export-docx`), the document displays unexpanded `{#achievements}` tags and `undefined` values instead of their accomplishments.

---

## 3. Caveats

- **Scope Scrutinized**: This challenge focused strictly on Feature 9 (Public CV with Custom Slug) and Feature 10 (CV Templates & DOCX Export). Features 7 (KPI Gap), 8 (Calendar Reminder), and 13 (Unit AI Scan) were verified in existing suites and regression tests.
- **Implemented Code Integrity**: In accordance with the Challenger role constraints ("Review-only — do NOT modify implementation code"), I have **not** modified `cvRepository.js`, `cvService.js`, or `default_cv.docx`. All fixes must be implemented by the Worker agent.

---

## 4. Conclusion

- **Verdict: REQUEST_CHANGES**
- The CV module cannot be approved for Milestone 3 gate until the following 3 concrete fixes are implemented by `teamwork_worker`:

### Required Remediation Items:
1. **Fix `backend/src/modules/cv/cvRepository.js:124`**:
   Replace `COALESCE(u.full_name, u.display_name) AS full_name` with:
   ```sql
   COALESCE(l.full_name, u.display_name) AS full_name
   ```
2. **Fix `backend/src/modules/cv/cvRepository.js:103-105`**:
   Remove `a.decision_number, a.issuing_authority` from the SELECT statement in `getUserActiveAchievements`, or alias them as:
   ```sql
   SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
          NULL AS decision_number, NULL AS issuing_authority, at.name AS achievement_type_name
   FROM app.achievements a
   ```
3. **Fix `backend/src/modules/cv/templates/default_cv.docx` and `backend/src/modules/cv/cvService.js:37-43`**:
   Enclose loop tags inside valid paragraph run structures so Docxtemplater parses them correctly:
   ```xml
   <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
   <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
   <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
   <w:p><w:r><w:t>{^achievements}</w:t></w:r></w:p>
   <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
   <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
   ```
   Ensure this is updated both in the physical file `backend/src/modules/cv/templates/default_cv.docx` and in `DOCUMENT_XML` in `cvService.js`.

---

## 5. Verification Method

To verify these findings and confirm remediation:

1. **Run the Challenger Adversarial Suite**:
   ```powershell
   node --test backend/tests/challenger-m3-cv-adversarial.test.js
   ```
   *Currently passes, documenting the existence of the 3 defects.*
2. **Direct Verification of live SQL queries**:
   ```powershell
   node -e "import('./backend/src/modules/cv/cvRepository.js').then(async r => { console.log(await r.getUserContact(1)); process.exit(0); })"
   node -e "import('./backend/src/modules/cv/cvRepository.js').then(async r => { console.log(await r.getUserActiveAchievements(1)); process.exit(0); })"
   ```
   *Throws RequestError 207 prior to remediation; must return valid rows without error post-remediation.*
3. **Direct Verification of DOCX loop expansion**:
   ```powershell
   node -e "import('./backend/src/modules/cv/cvService.js').then(async ({ default: cvService }) => { const { buffer } = await cvService.exportCvDocx(1); const PizZip = (await import('pizzip')).default; const zip = new PizZip(buffer); const xml = zip.file('word/document.xml').asText(); console.log('Has raw loop tag:', xml.includes('{#achievements}'), 'Has undefined:', xml.includes('undefined')); process.exit(0); })"
   ```
   *Must report `false` for both `Has raw loop tag` and `Has undefined` post-remediation.*
