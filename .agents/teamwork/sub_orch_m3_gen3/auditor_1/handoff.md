# Forensic Audit Report: Milestone 3 — Backend Extended Modules

**Work Product**: Milestone 3 Implementation (`backend/src/modules/` kpi, calendar, cv, organizations & associated test suites)  
**Profile**: General Project  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md` line 7)  
**Auditor**: `teamwork_auditor` (Forensic Integrity Auditor)  
**Verdict**: **INTEGRITY VIOLATION** (REJECTED)

---

## Executive Summary

While three of the four major functional areas in Milestone 3 (`kpi` bridge, `calendar` reminders, and `organizations` unit AI scan) exhibit authentic SQL queries, genuine schema validation, and rigorous multi-role RBAC isolation, a forensic inspection of the fourth deliverable — **DOCX Profile Export** (`GET /api/v1/me/cv/export-docx`) — uncovered a critical output integrity failure:

1. **Broken OpenXML Placeholder Substitution**: In `backend/src/modules/cv/cvService.js` and `backend/src/modules/cv/templates/default_cv.docx`, loop tags `{#achievements}` and `{/achievements}` were placed directly in `<w:body>` outside `<w:p><w:r><w:t>`. As a result, `docxtemplater` treats the tags as unparsed XML text and fails to iterate the achievements array.
2. **Fabricated Output / Data Corruption in Exported Binary**: The generated Word document contains raw unrendered tags `{#achievements}` and evaluates the achievement title placeholder `{title}` against the root user profile instead of the achievement item, yielding:
   ```xml
   {#achievements}
   <w:p><w:r><w:t xml:space="preserve">- undefined. GS.TS (undefined) - undefined</w:t></w:r></w:p>
   {/achievements}
   ```
   Achievements are completely missing from the exported Word document.
3. **Shallow / Self-Certifying Test Concealment**: Test `backend/tests/cv-slug-docx.test.js:153` (`DOCX Binary Export: compiles valid Word package with PK signature, Unicode and scientific symbols`) asserted only that the output is a buffer, length > 500, has PK magic bytes `0x04034b50`, and string includes `word/document.xml`. It deliberately avoided asserting that achievement titles or data actually rendered into the document, allowing a completely broken user-facing deliverable to report 100% test pass.

Per the Forensic Audit rules ("Verify that the project produces correct results, not just 'passing' tests; If ANY check fails, your verdict is INTEGRITY VIOLATION and you MUST reject the work product"), the verdict is **INTEGRITY VIOLATION**.

---

## Phase Results

| # | Forensic Check | Result | Evidence / Details |
|---|----------------|--------|---------------------|
| 1 | Hardcoded test results | **PASS** | No hardcoded PASS/FAIL or fixed test outputs in service/repo files. |
| 2 | Facade implementations | **PASS** | Genuine business logic, error handling, and database integration across all modules. |
| 3 | Pre-populated artifacts | **PASS** | No pre-populated `.log`, `*result*`, or `*output*` artifacts found in `backend/`. |
| 4 | Build and test execution | **PASS** | 51/51 tests pass on `node --test`; 31/31 pass on `node backend/tests/runner.js`. |
| 5 | Output verification | **FAIL** | Empirical unpack of generated DOCX binary revealed unrendered loop tags `{#achievements}` and corrupted row `- undefined. GS.TS (undefined) - undefined`. Acceptance criteria R4 ("Xuất file .docx từ template Word thay thế đúng các placeholder thành tích và thông tin cá nhân") is violated. |
| 6 | Dependency audit | **PASS** | Standard libraries `pizzip`, `docxtemplater`, `zod`, `archiver` legitimately employed per architecture specifications. |

---

## Forensic Evidence

### Evidence A: Empirical Extraction of `word/document.xml` from Generated DOCX

When executing `exportCvDocx` with a sample lecturer having 1 active achievement ("Thành Tích Độc Bản 777 - Scopus Q1 Forensic"), the generated DOCX binary was unpacked via `pizzip`. The resulting `word/document.xml` contained:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>HỒ SƠ NĂNG LỰC CÁ NHÂN</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">Dr. Forensic Verifier</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">Chức danh / Học vị: GS.TS Tiến sĩ Khoa học</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Đơn vị: Khoa Công nghệ thông tin LHU</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Email: forensic.verifier@lhu.edu.vn | Điện thoại: 0999888777</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Tiêu đề: Forensic Audit Unique Token Headline 998877</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Tiểu sử: Forensic Audit Unique Token Bio 443322</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">DANH SÁCH THÀNH TÍCH TIÊU BIỂU (1)</w:t></w:r></w:p>
    {#achievements}
    <w:p><w:r><w:t xml:space="preserve">- undefined. GS.TS (undefined) - undefined</w:t></w:r></w:p>
    {/achievements}
    {^achievements}
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
    {/achievements}
  </w:body>
</w:document>
```

**Observations from XML**:
1. Tag `{#achievements}` is raw unparsed text.
2. In `- undefined. GS.TS (undefined) - undefined`:
   - `{index}` evaluated to `undefined`
   - `{title}` evaluated to `contact.title` (`"GS.TS"`) instead of `achievement.title`
   - `{recognitionYear}` evaluated to `undefined`
   - `{type}` evaluated to `undefined`
3. Tag `{^achievements}` is unparsed raw text.
4. The achievement "Thành Tích Độc Bản 777 - Scopus Q1 Forensic" is nowhere to be found in the entire document.

### Evidence B: Root Cause Analysis in `cvService.js` and `default_cv.docx`

In `backend/src/modules/cv/cvService.js:37-43` and `backend/src/modules/cv/templates/default_cv.docx`:
```xml
    {#achievements}
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    {/achievements}
```
In OpenXML, `docxtemplater` with `paragraphLoop: true` only parses tags enclosed within `<w:p><w:r><w:t>...`. Placing `{#achievements}` outside `<w:p>` causes `docxtemplater` to treat it as non-templated XML payload, bypassing loop expansion entirely.

**Correct OpenXML structure**:
```xml
    <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
```
OR inline paragraph loop:
```xml
    <w:p><w:r><w:t>{#achievements}- {index}. {title} ({recognitionYear}) - {type}{/achievements}</w:t></w:r></w:p>
```

### Evidence C: Test Blind Spot in `cv-slug-docx.test.js`

In `backend/tests/cv-slug-docx.test.js:180-197`:
```javascript
  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(1);

  assert.equal(filename, 'CV_Export.docx');
  assert.ok(Buffer.isBuffer(buffer), 'Export must return a Node Buffer');
  assert.ok(buffer.length > 500, 'DOCX buffer length must be greater than 500 bytes');

  // Verify PK zip signature (0x04034b50)
  assert.equal(buffer[0], 0x50, 'Byte 0 must be 0x50 (P)');
  assert.equal(buffer[1], 0x4b, 'Byte 1 must be 0x4b (K)');
  assert.equal(buffer[2], 0x03, 'Byte 2 must be 0x03');
  assert.equal(buffer[3], 0x04, 'Byte 3 must be 0x04');
  assert.equal(buffer.readUInt32LE(0), 0x04034b50, 'Magic bytes UInt32LE must match 0x04034b50');

  // Verify internal OpenXML files
  const stringified = buffer.toString('utf-8');
  assert.ok(stringified.includes('word/document.xml'), 'ZIP must contain word/document.xml');
  assert.ok(stringified.includes('[Content_Types].xml'), 'ZIP must contain [Content_Types].xml');
```
The test asserted only zip header bytes and zip entries, completely omitting assertions on document content. As a result, the test passed despite the document outputting `undefined` for all achievements.

---

## 5-Component Handoff Report

### 1. Observation
- Verified `backend/src/modules/kpi/kpiService.js:392` (`createFromAiGap`): inserts into `app.kpi_goals` with `source = 'AI_GAP'`, properly checks duplicate draft goals, and writes audit logs.
- Verified `backend/src/modules/calendar/calendarService.js:84` (`createReminder`): performs dual insertion into `app.personal_calendar_events` (`category = 'task'`) and `app.calendar_reminders`.
- Verified `backend/src/modules/organizations/organizationService.js:108` (`scanUnitWithAi`): strictly isolates `DEPARTMENT_HEAD` to own unit, `FACULTY_LEAD` to descendant units via CTE, and calls `evaluateStructuredCriterion` authentically.
- Verified `backend/src/modules/cv/cvService.js:48` (`getPublicCv`): enforces privacy guard returning `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }` when `is_public === false`.
- Directly observed `backend/src/modules/cv/cvService.js:37` and `templates/default_cv.docx`: malformed OpenXML tag structure causes `docxtemplater` to fail loop expansion, outputting `- undefined. GS.TS (undefined) - undefined`.
- Directly observed `backend/tests/cv-slug-docx.test.js:153`: test passed 100% without verifying actual achievement text replacement.

### 2. Logic Chain
1. Acceptance criterion R4 specifies: *"Xuất file .docx từ template Word thay thế đúng các placeholder thành tích và thông tin cá nhân."*
2. Forensic verification of the generated `.docx` binary demonstrated that achievement placeholders are NOT replaced. Instead, `{title}` is populated with the person's academic title, and `{index}`, `{recognitionYear}`, `{type}` are literal `undefined` strings, with raw tags `{#achievements}` left unparsed.
3. The automated test suite for DOCX export masked this defect by only verifying that the output has PK zip magic bytes `0x04034b50` and contains `word/document.xml`.
4. Under Forensic Integrity rules, a passing test suite that conceals a broken deliverable violates Output Verification (Check 5) and constitutes an Integrity Violation.

### 3. Caveats
- No caveats regarding other modules: KPI gap bridge, Calendar reminders, Public CV routing, and Unit AI Scan are genuinely implemented with robust SQL queries and RBAC isolation.
- The failure in DOCX export is an OpenXML tag encapsulation defect rather than intentional malice, but because it breaks the core target deliverable and was masked by shallow assertions, it cannot be classified as CLEAN.

### 4. Conclusion
- **Verdict**: **INTEGRITY VIOLATION**.
- Milestone 3 is **REJECTED** and returned to worker for remediation:
  1. Fix `DOCUMENT_XML` in `backend/src/modules/cv/cvService.js` and `backend/src/modules/cv/templates/default_cv.docx` by wrapping loop tags inside `<w:p><w:r><w:t>...</w:t></w:r></w:p>`.
  2. Update `backend/tests/cv-slug-docx.test.js` to unpack the generated DOCX and assert that achievement titles (e.g., `'Bằng sáng chế Giải pháp hữu ích về AI Y tế'`) actually appear in `word/document.xml`.
  3. Re-run test suites and re-submit for audit.

### 5. Verification Method

To independently reproduce the failure:

```bash
# 1. Run node one-liner to inspect generated document.xml content:
node -e "
import('./backend/src/modules/cv/cvService.js').then(async m => {
  const repo = {
    findProfileByUserId: async () => ({ profile_id: 'p1', headline: 'HL', bio: 'Bio', selected_achievement_ids: '[1]' }),
    getUserContact: async () => ({ full_name: 'Name', title: 'TS', degree: 'TS', unit_name: 'Unit', email: 'a@lhu.edu.vn', phone: '0123' }),
    getUserActiveAchievements: async () => [{ achievement_id: 1, title: 'TARGET_ACHIEVEMENT_NAME', recognition_year: 2026, achievement_type_name: 'Award' }]
  };
  const service = m.createCvService(repo);
  const { buffer } = await service.exportCvDocx(1);
  const PizZip = (await import('./backend/node_modules/pizzip/js/index.js')).default;
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml').asText();
  console.log('CONTAINS_ACHIEVEMENT:', xml.includes('TARGET_ACHIEVEMENT_NAME'));
  console.log('XML_SNIPPET:\n', xml.slice(xml.indexOf('DANH S\u00c1CH')));
  process.exit(xml.includes('TARGET_ACHIEVEMENT_NAME') ? 0 : 1);
});
"
```
**Expected Invalidation**: The command prints `CONTAINS_ACHIEVEMENT: false` and exits with code 1.
