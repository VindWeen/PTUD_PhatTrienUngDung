# Forensic Audit Report: Milestone 3 — Backend Extended Modules Remediation (Iteration 2)

**Work Product**: Milestone 3 Remediated Implementation (`backend/src/modules/` cv, organizations, calendar, kpi & associated test suites)  
**Profile**: General Project  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md` line 7)  
**Auditor**: `auditor_r2_1` (Forensic Integrity Auditor)  
**Verdict**: **CLEAN** (ACCEPTED)

---

## Executive Summary

Following the **INTEGRITY VIOLATION** issued during Iteration 1 due to malformed OpenXML loop tags in DOCX generation, template shadowing, SQL schema column mismatches (SQL Server errors 207 & 515), silent calendar date rollovers, and superficial test assertions, an independent and rigorous forensic audit was conducted on the remediated Milestone 3 codebase.

All four core forensic concerns have been resolved with genuine, production-grade engineering:
1. **OpenXML Loop Tags & DOCX Export**: Unpacked both `backend/src/modules/cv/templates/default_cv.docx` and dynamically generated DOCX buffers. All loop delimiters (`{#achievements}`, `{/achievements}`, `{^achievements}`) are properly encapsulated within `<w:p><w:r><w:t>`. In generated documents, `docxtemplater` cleanly expands multiple achievements into numbered paragraphs. Output contains **zero** raw loop tags and **zero** literal `undefined` values.
2. **SQL Schema Alignment**: Direct queries against `INFORMATION_SCHEMA.COLUMNS` on the live Microsoft SQL Server database (`PTUD_LHU`) confirm that all queries in `cvRepository.js`, `organizationRepository.js`, and `kpiRepository.js` strictly match the physical database schema. Zero column errors 207 on `app.users.full_name`, `app.achievements.decision_number`, or `app.award_criteria_versions.code`, and zero error 515 on `app.lecturer_assignments.assigned_by`.
3. **Calendar Integrity & Atomicity**: `isValidCalendarDate` strictly validates Gregorian calendar rules via UTC round-trip date parsing across 21 adversarial edge cases, blocking impossible dates (`2026-02-30`, `2026-04-31`, `2026-02-29` non-leap) from mutating deadlines via rollover. Dual-table insertion into `app.personal_calendar_events` and `app.calendar_reminders` is executed inside atomic transactional boundaries (`executeTx` / `withTransaction`), guaranteeing zero orphan records upon failure.
4. **Anti-Cheating & Test Authenticity**: Test suites (`cv-slug-docx.test.js`, `kpi-from-gap.test.js`, `calendar-reminder.test.js`, `unit-ai-scan.test.js`, `sqlserver-m3.integration.js`) have been hardened to unpack binary packages with `PizZip`, inspect raw OpenXML strings, and verify live database state inside rolled-back fixtures. No hardcoded or faked test results exist.

---

## Phase Results

| # | Forensic Check | Result | Evidence / Details |
|---|----------------|--------|---------------------|
| 1 | Hardcoded test results | **PASS** | No hardcoded PASS/FAIL or fixed test outputs in service/repository files. Genuine algorithmic computations across all modules. |
| 2 | Facade implementations | **PASS** | Genuine SQL operations, transaction controls, schema refinements, and OpenXML template compilation. |
| 3 | Pre-populated artifacts | **PASS** | Zero pre-populated `.log`, `*result*`, or `*output*` artifacts found outside `node_modules`. |
| 4 | Build and test execution | **PASS** | 77/77 M3 tests pass; 52/52 core tests pass; 31/31 legacy runner checks pass; 100% pass on live DB scripts `verify-refactor.mjs` and `verify-live.mjs`. |
| 5 | Output verification | **PASS** | Unpacked generated DOCX files empirically verified: authentic achievement items rendered into numbered paragraphs, zero raw tags, zero literal `undefined`. Calendar dates strictly validated. |
| 6 | Dependency audit | **PASS** | `docxtemplater`, `pizzip`, `zod`, `archiver` legitimately employed per architecture specifications. |

---

## Forensic Evidence

### Evidence 1: OpenXML Delimiter Encapsulation & Document Generation

#### A. Inspection of `backend/src/modules/cv/templates/default_cv.docx` (`word/document.xml`):
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>HỒ SƠ NĂNG LỰC CÁ NHÂN</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>{fullName}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chức danh / Học vị: {title} {degree}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Đơn vị: {unitName}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Email: {email} | Điện thoại: {phone}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tiêu đề: {headline}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tiểu sử: {bio}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>DANH SÁCH THÀNH TÍCH TIÊU BIỂU ({achievementsCount})</w:t></w:r></w:p>
    <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{^achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
  </w:body>
</w:document>
```
*Observation*: Every loop tag is isolated inside `<w:p><w:r><w:t>`.

#### B. Empirical Unpack of Dynamically Generated DOCX (`cvService.exportCvDocx`):
When executed with 3 achievements:
```xml
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">DANH SÁCH THÀNH TÍCH TIÊU BIỂU (3)</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">- 1. Bằng sáng chế AI Y tế (2024) - Sáng chế</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">- 2. Bài báo Q1 IEEE Transactions (2025) - Bài báo quốc tế</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">- 3. Giải nhất Sáng tạo Khoa học Kỹ thuật (2026) - Giải thưởng</w:t></w:r></w:p>
```
*Verification*:
- `xml.includes('{#achievements}') === false` (PASS)
- `xml.includes('{/achievements}') === false` (PASS)
- `xml.includes('{^achievements}') === false` (PASS)
- `xml.includes('undefined') === false` (PASS)
- All 3 items expanded cleanly into separate paragraphs with proper index numbering and metadata.

---

### Evidence 2: Live SQL Server Schema Conformance

Direct empirical inspection of `INFORMATION_SCHEMA.COLUMNS` on `PTUD_LHU` database:
1. `app.users`: Lacks `full_name`. Columns: `user_id, username, email, password_hash, display_name, status, ...`.
   - Conformance: `cvRepository.js:124` uses `COALESCE(l.full_name, u.display_name) AS full_name` joining `app.lecturers l`.
   - Conformance: `kpiRepository.js:27` uses `SELECT user_id, display_name AS full_name, email FROM app.users`.
2. `app.achievements`: Lacks `decision_number` and `issuing_authority`.
   - Conformance: `cvRepository.js:103-104` explicitly selects `NULL AS decision_number, NULL AS issuing_authority` to avoid Error 207 while cleanly supplying mappers.
3. `app.award_criteria_versions`: Column is `criterion_code`, NOT `code`.
   - Conformance: `organizationRepository.js:171, 184` aliases `c.criterion_code AS code`.
4. `app.lecturer_assignments`: `assigned_by` is `bigint NOT NULL`.
   - Conformance: `kpiRepository.js:47-49` passes `$3` (`userId`) in `INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from, assigned_by) VALUES ($1, $2, 1, SYSUTCDATETIME(), $3)`.

*Live Integration Result*: `backend/tests/sqlserver-m3.integration.js` executes 5/5 real queries and updates against the live database with 0 errors.

---

### Evidence 3: Calendar Date Validation & Transaction Atomicity

#### A. Strict Date Parsing (`isValidCalendarDate`):
Empirical evaluation across 21 edge cases:
- `2026-02-29` -> `false` (Non-leap year rejected)
- `2024-02-29` -> `true` (Leap year accepted)
- `2000-02-29` -> `true` (Century leap year accepted)
- `1900-02-29` -> `false` (Rejected, outside 1990-2100)
- `2026-02-30` -> `false` (Impossible date rejected)
- `2026-04-31` -> `false` (Impossible date rejected)
- `2026-11-31` -> `false` (Impossible date rejected)
- `2026-12-31` -> `true` (Valid date accepted)

#### B. Transactional Atomicity:
In `sqlserver-m3.integration.js`, simulating a failure on reminder insertion verifies that the companion record in `app.personal_calendar_events` is rolled back completely with zero database residue (`afterCount === initialCount`).

---

### Evidence 4: Comprehensive Test Suite Execution

All test suites executed natively via Node.js test runner:

1. **M3 Unit, Integration & Adversarial Suites** (77 tests):
   ```
   Command: node --test backend/tests/cv-slug-docx.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/unit-ai-scan.test.js backend/tests/sqlserver-m3.integration.js backend/tests/challenger-m3-adversarial.test.js backend/tests/challenger-m3-cv-adversarial.test.js backend/tests/challenger-m3-cv-deep-adversarial.test.js
   Result: ℹ tests 77 ℹ pass 77 ℹ fail 0 (duration: 3150ms)
   ```

2. **Core System Unit Suites** (52 tests):
   ```
   Command: node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js
   Result: ℹ tests 52 ℹ pass 52 ℹ fail 0 (duration: 3327ms)
   ```

3. **Legacy Auth & RBAC Runner** (31 checks):
   ```
   Command: node backend/tests/runner.js
   Result: KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT
   ```

4. **Live Database Refactor Verification**:
   ```
   Command: node database/sqlserver/verify-refactor.mjs
   Result: ALL REFACTOR VERIFICATIONS PASSED (100%)
   ```

5. **Live Schema Metadata Verification**:
   ```
   Command: node database/sqlserver/verify-live.mjs
   Result: PASS live schema metadata { tables: 56, enabled_triggers: 5, invalid_foreign_keys: 0 }
   ```

---

## 5-Component Handoff Report

### 1. Observation
- Verified `backend/src/modules/cv/templates/default_cv.docx` and `cvService.js`: OpenXML tags are enclosed within paragraph nodes `<w:p><w:r><w:t>`.
- Verified dynamically generated DOCX binary via `PizZip` unpack: expands achievement arrays into genuine, numbered text nodes with zero unparsed `{#achievements}` and zero literal `undefined`.
- Verified SQL Server schema conformance across `cvRepository.js`, `organizationRepository.js`, and `kpiRepository.js` using live `INFORMATION_SCHEMA` queries.
- Verified strict calendar date validation in `calendarService.js` and atomic dual-table insertion across `personal_calendar_events` and `calendar_reminders`.
- Verified all 77 M3 test items, 52 core unit tests, and 31 legacy runner tests pass 100% without failures.

### 2. Logic Chain
1. In Iteration 1, the work product was rejected due to unparsed loop delimiters in DOCX export, schema errors 207 & 515, silent date rollovers, and mock concealment.
2. Worker 2 remediated these issues by wrapping loop delimiters in paragraph XML, synchronizing the binary template archive, aliasing live database columns, introducing strict Gregorian calendar parsing, and wrapping multi-table inserts in transactions.
3. The forensic auditor empirically extracted `word/document.xml` from the binary output of `cvService.exportCvDocx`, validating the actual rendered XML string and verifying the absence of raw tags and `undefined` fields.
4. Live queries against SQL Server confirmed zero column mismatches, and rolled-back integration tests verified transactional atomicity.
5. All test suites perform genuine, deep assertions against live logic rather than shallow mock facades.
6. Therefore, the work product fully satisfies all integrity and functional requirements.

### 3. Caveats
- **No Caveats**: All four remediation areas were empirically validated against live execution. No dummy, placeholder, or bypass logic was found.

### 4. Conclusion
- **Verdict**: **CLEAN**.
- Milestone 3 (Backend Extended Modules Remediation) is **APPROVED** and ready to proceed to Milestone 4 (Frontend Modernization & Routing).

### 5. Verification Method
To independently reproduce and verify this clean verdict:

```bash
# 1. Empirically verify DOCX generation and OpenXML document.xml content:
node -e "
import('./backend/src/modules/cv/cvService.js').then(async m => {
  const repo = {
    findProfileByUserId: async () => ({ profile_id: 'p1', headline: 'AI Lead', bio: 'Bio', selected_achievement_ids: '[1]' }),
    getUserContact: async () => ({ full_name: 'TS. Le Van A', title: 'GVCC', degree: 'TS', unit_name: 'CNTT', email: 'a@lhu.edu.vn', phone: '0912' }),
    getUserActiveAchievements: async () => [{ achievement_id: 1, title: 'Sang che AI', recognition_year: 2026, achievement_type_name: 'Award' }]
  };
  const service = m.createCvService(repo);
  const { buffer } = await service.exportCvDocx(1);
  const PizZip = (await import('./backend/node_modules/pizzip/js/index.js')).default;
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml').asText();
  const pass = xml.includes('Sang che AI') && !xml.includes('{#achievements}') && !xml.includes('undefined');
  console.log('DOCX_VERIFICATION:', pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
});
"

# 2. Run all M3 unit, integration, and adversarial tests:
node --test backend/tests/cv-slug-docx.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/unit-ai-scan.test.js backend/tests/sqlserver-m3.integration.js backend/tests/challenger-m3-adversarial.test.js backend/tests/challenger-m3-cv-adversarial.test.js backend/tests/challenger-m3-cv-deep-adversarial.test.js

# 3. Run live database refactor verification:
node database/sqlserver/verify-refactor.mjs
```
