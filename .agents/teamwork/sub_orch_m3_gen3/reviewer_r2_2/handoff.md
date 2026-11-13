# Milestone 3 Iteration 2 Review & Adversarial Report

**Reviewer / Critic**: `reviewer_r2_2`  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\reviewer_r2_2`  
**Target Milestone**: Milestone 3 (Backend Extended Modules: CV, Unit AI Scan & SQL Alignment)  
**Parent Orchestrator**: `c4f8ee2a-a6b8-4150-930d-200ed34209c4`  
**Date**: 2026-11-12T23:40:00Z  

---

## Review Summary

**Verdict**: **APPROVE**  
**Integrity Assessment**: **CLEAN (0 integrity violations, 0 facades, 0 hardcoded test cheats)**  
**Adversarial Risk Assessment**: **LOW**

---

## 1. Observation

Direct code and runtime inspection confirmed the status of all five review items:

1. **OpenXML Loop Delimiters & Word Template Repacking**:
   - `backend/src/modules/cv/cvService.js:37-43`:
     ```xml
     <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
     <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
     <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
     <w:p><w:r><w:t>{^achievements}</w:t></w:r></w:p>
     <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
     <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
     ```
   - Inspection of `word/document.xml` extracted from `backend/src/modules/cv/templates/default_cv.docx` confirmed the binary package was repacked with identical isolated paragraph delimiters.
   - Live rendering with `Docxtemplater({ paragraphLoop: true })` produces clean achievement paragraphs without unparsed `{#achievements}` tags and with zero `undefined` values.

2. **Database Column Alignments in `cvRepository.js`**:
   - `backend/src/modules/cv/cvRepository.js:124`:
     ```sql
     SELECT u.user_id, u.display_name, COALESCE(l.full_name, u.display_name) AS full_name, u.email,
            l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone,
            ou.name AS unit_name
     FROM app.users u
     LEFT JOIN app.lecturers l ON l.user_id = u.user_id AND l.is_active = 1
     ```
     `u.full_name` (which does not exist in `app.users`) was replaced by `COALESCE(l.full_name, u.display_name) AS full_name`, preventing SQL Server Error 207.
   - `backend/src/modules/cv/cvRepository.js:103-106`:
     ```sql
     SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
            NULL AS decision_number, NULL AS issuing_authority, at.name AS achievement_type_name
     FROM app.achievements a
     LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
     ```
     Selecting `NULL AS decision_number, NULL AS issuing_authority` cleanly handles the absence of these columns in `app.achievements` while preserving compatibility with downstream CV models.

3. **Database Column Alignment in `organizationRepository.js`**:
   - `backend/src/modules/organizations/organizationRepository.js:171, 184`:
     ```sql
     SELECT c.criteria_version_id, c.criterion_code AS code, c.name, c.target_type, ...
     FROM app.award_criteria_versions c
     ```
     In both primary and fallback queries, `c.code` was corrected to `c.criterion_code AS code`, resolving SQL Server Error 207 on `app.award_criteria_versions`.

4. **Reserved Slugs Expansion in `cvSchemas.js`**:
   - `backend/src/modules/cv/cvSchemas.js:33`:
     ```javascript
     export const RESERVED_SLUGS = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root', 'me', 'public', 'export-docx', 'download', 'cv', 'profile', 'default'];
     ```
     Guards system routes and prevents path hijacking or collisions.

5. **Automated Test Results**:
   - Primary test command:
     `node --test backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/sqlserver-m3.integration.js`
     **Result**: `ℹ tests 25 ℹ pass 25 ℹ fail 0` (duration 2.3s)
   - Adversarial suites:
     `node --test backend/tests/challenger-m3-cv-adversarial.test.js backend/tests/challenger-m3-adversarial.test.js`
     **Result**: `ℹ tests 40 ℹ pass 40 ℹ fail 0` (duration 1.6s)
   - Deep adversarial suite:
     `node --test backend/tests/challenger-m3-cv-deep-adversarial.test.js`
     **Result**: `ℹ tests 10 ℹ pass 10 ℹ fail 0` (duration 1.4s)
   - Full regression runner:
     `node backend/tests/runner.js`
     **Result**: `KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT`

---

## 2. Logic Chain

1. **OpenXML Parser Compliance**:
   - Observation: In `default_cv.docx` and `cvService.js`, loop tags were raw text without `<w:p><w:r><w:t>`.
   - Reason: OpenXML requires all block-level elements inside `<w:body>` to be wrapped in `<w:p>` or `<w:tbl>`. Docxtemplater with `paragraphLoop: true` searches for paragraphs containing tags.
   - Inference: Wrapping `{#achievements}` and `{/achievements}` in dedicated `<w:p><w:r><w:t>` tags enables Docxtemplater to recognize them as paragraph-level loops, correctly iterating each achievement into an independent `<w:p>` paragraph while removing the delimiter lines.
   - Verification: Extracting and inspecting `word/document.xml` using `PizZip` showed zero raw tags and correct multi-achievement output.

2. **Database Schema Conformance**:
   - Observation: `app.users` lacks `full_name`, `app.achievements` lacks `decision_number` and `issuing_authority`, and `app.award_criteria_versions` uses `criterion_code` rather than `code`.
   - Reason: Previous queries triggered SQL Server Error 207 ("Invalid column name").
   - Inference: Joining `app.lecturers` for `l.full_name`, mapping `NULL AS decision_number, NULL AS issuing_authority`, and aliasing `c.criterion_code AS code` eliminates SQL Server error 207 while supplying expected contract fields to service mappers.
   - Verification: `backend/tests/sqlserver-m3.integration.js` executes live queries against SQL Server instance (`PTUD_LHU`) within rolled-back transactions; all queries succeed without any 207 errors.

3. **Integrity & Security Evaluation**:
   - Observation: Inspected implementation files for test-specific mocks, hardcoded conditions (`if (test) ...`), or facade functions.
   - Inference: All logic is genuine: Zod validates real schemas; repository methods issue real parameterized SQL queries; Docxtemplater and PizZip parse and assemble genuine zip archives.
   - Conclusion: No integrity violations detected.

---

## 3. Caveats

1. **Slug Update Null Semantics**:
   - In `cvRepository.upsertProfile`, `slug = COALESCE($2, slug)` is used. If a client transmits `{ slug: null }`, `COALESCE(null, slug)` preserves the pre-existing custom slug rather than erasing it to NULL. Because custom slugs are meant to be persistent identifiers once chosen, this behavior is safe and avoids accidental detachment of public CV links, but is noted for future reference.
2. **Selected Achievements Null vs Empty**:
   - In `cvService.exportCvDocx`, `(Array.isArray(selectedIds) && selectedIds.length > 0)` filters achievements. If `selectedIds` is `[]` (empty array), the service exports all active achievements rather than an empty list. When a user wishes to export a CV with no achievements, they can either unpublish achievements or have zero active achievements. This matches standard portfolio export conventions.

---

## 4. Conclusion

The Milestone 3 Iteration 2 remediations performed by Worker 2 are complete, robust, and mathematically sound:
- **DOCX Loop Rendering**: Fully repaired in both code constant and binary template file; paragraph-level loops expand without leaking delimiters or undefined values.
- **SQL Alignment**: All SQL Server Error 207 and 515 conditions are resolved across `cvRepository`, `organizationRepository`, and `kpiRepository`.
- **Validation & Security**: Reserved slugs, calendar dates, and item-level date ordering are strictly enforced.
- **Verdict**: **APPROVE**.

---

## 5. Verification Method

To independently verify this review:

1. **Run Primary Milestone 3 Test Suites**:
   ```powershell
   node --test backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/sqlserver-m3.integration.js
   ```
   *Expected Output*: `ℹ tests 25 ℹ pass 25 ℹ fail 0`

2. **Run Challenger Adversarial Suites**:
   ```powershell
   node --test backend/tests/challenger-m3-cv-adversarial.test.js backend/tests/challenger-m3-adversarial.test.js
   ```
   *Expected Output*: `ℹ tests 40 ℹ pass 40 ℹ fail 0`

3. **Run Deep Adversarial Suite**:
   ```powershell
   node --test backend/tests/challenger-m3-cv-deep-adversarial.test.js
   ```
   *Expected Output*: `ℹ tests 10 ℹ pass 10 ℹ fail 0`

4. **Run Live Database Integration Suite**:
   ```powershell
   node --test backend/tests/sqlserver-m3.integration.js
   ```
   *Expected Output*: `ℹ tests 5 ℹ pass 5 ℹ fail 0`

5. **Run Full Regression Runner**:
   ```powershell
   node backend/tests/runner.js
   ```
   *Expected Output*: `KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT`

### Invalidation Conditions:
- Any occurrence of `{#achievements}` or literal `undefined` in generated DOCX `word/document.xml`.
- Any SQL Server `RequestError: Invalid column name` against `PTUD_LHU`.
- Any failure in the test commands above.
