# Handoff Report: OpenXML DOCX Template & Test Hardening Investigation

**Agent**: `teamwork_explorer_r2_1` (Explorer 1 for Iteration 2)  
**Date**: 2026-11-12T22:30:00Z  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_1`  
**Target Milestone**: Milestone 3 Iteration 2 (OpenXML DOCX Template & Test Hardening)

---

## 1. Observation

### 1.1 Root Cause in `backend/src/modules/cv/cvService.js` and `templates/default_cv.docx`
In `backend/src/modules/cv/cvService.js:36-43` and inside `backend/src/modules/cv/templates/default_cv.docx` (`word/document.xml`), the XML template is defined as:

```xml
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>DANH SÁCH THÀNH TÍCH TIÊU BIỂU ({achievementsCount})</w:t></w:r></w:p>
    {#achievements}
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    {/achievements}
    {^achievements}
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
    {/achievements}
```

When evaluated by `Docxtemplater` instantiated with `{ paragraphLoop: true, linebreaks: true }`, `docxtemplater` parses XML text runs (`<w:t>`). Placing `{#achievements}` as raw text directly under `<w:body>` (outside any `<w:p><w:r><w:t>`) results in:
1. `docxtemplater` ignores `{#achievements}` as a loop delimiter.
2. The inner paragraph `<w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>` is evaluated once in the root data context instead of iterating the `achievements` array:
   - `{title}` resolves to `contact.title` (e.g. `"Phó Giáo sư"`).
   - `{index}`, `{recognitionYear}`, `{type}` are missing at root, evaluating to `"undefined"`.
3. Verbatim output in the generated Word document is:
   ```xml
   {#achievements}
   <w:p><w:r><w:t xml:space="preserve">- undefined. Phó Giáo sư (undefined) - undefined</w:t></w:r></w:p>
   {/achievements}
   {^achievements}
   <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
   {/achievements}
   ```
4. Actual user achievements (e.g., `"Bằng sáng chế Giải pháp hữu ích về AI Y tế"`) are completely missing from the generated DOCX.

### 1.2 Binary Template File Priority in `cvService.js`
In `backend/src/modules/cv/cvService.js:181-192`:
```javascript
const templatePath = path.join(__dirname, 'templates', 'default_cv.docx');
let zip;

if (fs.existsSync(templatePath)) {
  const content = fs.readFileSync(templatePath, 'binary');
  zip = new PizZip(content);
} else {
  zip = new PizZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', RELS_XML);
  zip.file('word/document.xml', DOCUMENT_XML);
}
```
Because `default_cv.docx` exists on disk, `fs.readFileSync(templatePath, 'binary')` takes precedence. Even if `DOCUMENT_XML` in `cvService.js` is corrected, the service continues to load the broken binary file unless `default_cv.docx` is also repacked or replaced.

### 1.3 Shallow Assertions in `backend/tests/cv-slug-docx.test.js:180-197`
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
The test asserted only PK magic bytes and string presence of file names in the zip archive. It never parsed the archive or checked whether `{title}` or any achievement item rendered.

### 1.4 Database Schema Incompatibilities in Associated Queries
Empirical queries on the database schema (`INFORMATION_SCHEMA.COLUMNS`) identified 3 SQL Server error 207 occurrences:
1. `backend/src/modules/cv/cvRepository.js:124`:
   `COALESCE(u.full_name, u.display_name)` fails because `app.users` has no `full_name` column. The column is on `app.lecturers l`.
2. `backend/src/modules/cv/cvRepository.js:103-105`:
   `a.decision_number, a.issuing_authority` fails because `app.achievements` has neither column.
3. `backend/src/modules/kpi/kpiRepository.js:27`:
   `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1` fails with error 207 because `full_name` does not exist on `app.users`.
4. `backend/src/modules/organizations/organizationRepository.js:171, 184`:
   `SELECT c.criteria_version_id, c.code, ... FROM app.award_criteria_versions c` fails with error 207 because the column is `criterion_code`, not `code`.

---

## 2. Logic Chain

1. **Docxtemplater Paragraph Loop Mechanics**:
   - According to `docxtemplater` specifications for `{ paragraphLoop: true }`, loop delimiters `{#tag}` and `{/tag}` MUST each occupy an entire paragraph: `<w:p><w:r><w:t>{#tag}</w:t></w:r></w:p>` and `<w:p><w:r><w:t>{/tag}</w:t></w:r></w:p>`.
   - When parsed with `paragraphLoop: true`, `docxtemplater` eliminates the delimiter paragraphs themselves from the output document and clones all intermediate paragraphs for each entry in the target array.
   - For an inverted section `{^tag}...{/tag}`, enclosing `{^tag}` and `{/tag}` in their own paragraphs ensures that when the array is non-empty, the entire empty-fallback block (including its paragraph formatting) is cleanly eliminated without leaving empty blank paragraphs.
2. **Empirical Verification of Options**:
   - We tested 3 XML structures in Node.js with `Docxtemplater`:
     - *Option 1 (Separate delimiter paragraphs)*: Produced individual `<w:p>` per achievement item. On empty list, cleanly rendered only the italic notice.
     - *Option 2 (Inline tags within a single paragraph)*: Concatenated all items into a single run on a single line (`- 1. Paper- 2. Book`), breaking Word formatting.
     - *Option 3 (Single paragraph enclosing tags)*: Also merged runs into a single paragraph without clean paragraph breaks.
   - Therefore, **Option 1** is the only correct and compliant OpenXML structure.
3. **Synchronized Template Remediation**:
   - Because `cvService.exportCvDocx` attempts to load `backend/src/modules/cv/templates/default_cv.docx` before falling back to `DOCUMENT_XML`, both the string constant `DOCUMENT_XML` AND the binary template `default_cv.docx` must be updated with the exact same valid OpenXML structure.
4. **Test Hardening Requirements**:
   - Tests in `backend/tests/cv-slug-docx.test.js` must unpack `word/document.xml` using `PizZip`, assert that achievement titles and details are present, and assert that no raw loop tags or `undefined` strings exist.

---

## 3. Caveats

- Vietnamese diacritics and scientific symbols (`Σ, α, β`) are stored in UTF-8 inside `word/document.xml`. When inspecting XML via regex or substring, special characters like `&` will be XML-escaped (`&amp;`). Assertions should match raw text or XML-escaped variants (e.g. `Sáng chế &amp; Giải pháp` or `Sáng chế`).
- This investigation report does not directly modify source files, adhering to the explorer's read-only mandate. Concrete code replacement blocks are provided below for the Worker agent.

---

## 4. Conclusion & Precise Remediation Plan

### 4.1 Fix 1: `backend/src/modules/cv/cvService.js`
Replace `DOCUMENT_XML` (lines 25-44) with:

```javascript
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:document>`;
```

### 4.2 Fix 2: Repack `backend/src/modules/cv/templates/default_cv.docx`
Execute the following deterministic Node.js script to update the binary template file:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const CORRECTED_DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:document>`;

const zip = new PizZip();
zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
zip.file('_rels/.rels', RELS_XML);
zip.file('word/document.xml', CORRECTED_DOCUMENT_XML);

const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
const templatePath = path.resolve('backend/src/modules/cv/templates/default_cv.docx');
fs.writeFileSync(templatePath, buffer);
console.log('Successfully repacked default_cv.docx:', buffer.length, 'bytes');
```

### 4.3 Fix 3: Harden `backend/tests/cv-slug-docx.test.js`
Add `import PizZip from 'pizzip';` to `backend/tests/cv-slug-docx.test.js` and update tests:

```javascript
test('DOCX Binary Export: compiles valid Word package with PK signature, Unicode and scientific symbols', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'prof-export',
      headline: 'Chuyên gia AI & Deep Learning (Σ, α, β)',
      bio: 'Nghiên cứu ứng dụng công nghệ trí tuệ nhân tạo trong y tế thông minh (Đại học Lạc Hồng).',
      selected_achievement_ids: '[201]',
    }),
    getUserContact: async () => ({
      full_name: 'PGS.TS. Trần Thị Bích',
      email: 'bich.tt@lhu.edu.vn',
      phone: '0912345678',
      title: 'Phó Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      {
        achievement_id: 201,
        title: 'Bằng sáng chế Giải pháp hữu ích về AI Y tế',
        recognition_year: 2025,
        achievement_type_name: 'Sáng chế & Giải pháp',
      },
    ],
  };

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

  // Deep inspection of word/document.xml content
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  // 1. Verify profile fields rendered
  assert.ok(docXml.includes('PGS.TS. Trần Thị Bích'), 'Full name must be rendered');
  assert.ok(docXml.includes('Phó Giáo sư'), 'Title must be rendered');
  assert.ok(docXml.includes('Tiến sĩ'), 'Degree must be rendered');
  assert.ok(docXml.includes('Khoa Công nghệ thông tin'), 'Unit name must be rendered');
  assert.ok(docXml.includes('bich.tt@lhu.edu.vn'), 'Email must be rendered');
  assert.ok(docXml.includes('0912345678'), 'Phone must be rendered');

  // 2. Verify scientific symbols rendered
  for (const sym of ['Σ', 'α', 'β']) {
    assert.ok(docXml.includes(sym), `Scientific symbol ${sym} must be present`);
  }

  // 3. Verify achievements expanded genuinely
  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (1)'), 'Count must be 1');
  assert.ok(docXml.includes('Bằng sáng chế Giải pháp hữu ích về AI Y tế'), 'Achievement title must be rendered');
  assert.ok(docXml.includes('2025'), 'Recognition year must be rendered');
  assert.ok(docXml.includes('- 1.'), 'Index 1 must be rendered');

  // 4. Verify absence of unrendered tags or undefined values
  assert.equal(docXml.includes('{#achievements}'), false, 'Raw opening loop tag must not exist');
  assert.equal(docXml.includes('{/achievements}'), false, 'Raw closing loop tag must not exist');
  assert.equal(docXml.includes('{^achievements}'), false, 'Raw inverted loop tag must not exist');
  assert.equal(docXml.includes('undefined'), false, 'Output must not contain literal "undefined"');
  assert.equal(docXml.includes('Chưa có thành tích nào được chọn hiển thị.'), false, 'Empty notice must not show when achievements exist');
});

test('DOCX Binary Export: handles 0 achievements gracefully without throwing', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'prof-empty',
      headline: 'Tân giảng viên',
      bio: 'Mới gia nhập bộ môn',
      selected_achievement_ids: '[]',
    }),
    getUserContact: async () => ({
      full_name: 'ThS. Nguyễn Văn Mới',
      email: 'moi.nv@lhu.edu.vn',
      phone: '0988776655',
      title: 'Giảng viên',
      degree: 'Thạc sĩ',
      unit_name: 'Khoa Dược',
    }),
    getUserActiveAchievements: async () => [],
  };

  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(2);

  assert.equal(filename, 'CV_Export.docx');
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (0)'), 'Count must be 0');
  assert.ok(docXml.includes('Chưa có thành tích nào được chọn hiển thị.'), 'Empty notice must be rendered');
  assert.equal(docXml.includes('{#achievements}'), false);
  assert.equal(docXml.includes('{/achievements}'), false);
  assert.equal(docXml.includes('{^achievements}'), false);
  assert.equal(docXml.includes('undefined'), false);
});

test('DOCX Binary Export: renders multiple achievements (N > 1) with independent numbering and correct paragraph structure', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'prof-multi',
      headline: 'Trưởng nhóm Nghiên cứu',
      bio: 'Lĩnh vực AI',
      selected_achievement_ids: null, // all
    }),
    getUserContact: async () => ({
      full_name: 'GS.TS. Lê Văn Tám',
      email: 'tam.lv@lhu.edu.vn',
      phone: '0909112233',
      title: 'Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      { achievement_id: 1, title: 'Bài báo IEEE Q1', recognition_year: 2024, achievement_type_name: 'Bài báo' },
      { achievement_id: 2, title: 'Bằng sáng chế USPTO', recognition_year: 2025, achievement_type_name: 'Sáng chế' },
      { achievement_id: 3, title: 'Giải thưởng Sáng tạo Quốc gia', recognition_year: 2026, achievement_type_name: 'Giải thưởng' },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer } = await service.exportCvDocx(5);

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (3)'));
  assert.ok(docXml.includes('- 1. Bài báo IEEE Q1 (2024) - Bài báo'));
  assert.ok(docXml.includes('- 2. Bằng sáng chế USPTO (2025) - Sáng chế'));
  assert.ok(docXml.includes('- 3. Giải thưởng Sáng tạo Quốc gia (2026) - Giải thưởng'));
  assert.equal(docXml.includes('undefined'), false);
  assert.equal(docXml.includes('{#achievements}'), false);
  assert.equal(docXml.includes('{/achievements}'), false);
});
```

### 4.4 Fix 4: Database Query Alignments for Error 207 Prevention
1. **`backend/src/modules/cv/cvRepository.js:124`**:
   Replace `COALESCE(u.full_name, u.display_name)` with `COALESCE(l.full_name, u.display_name) AS full_name`.
2. **`backend/src/modules/cv/cvRepository.js:103-105`**:
   Replace `a.decision_number, a.issuing_authority` with `NULL AS decision_number, NULL AS issuing_authority`.
3. **`backend/src/modules/kpi/kpiRepository.js:27`**:
   Replace `SELECT user_id, full_name, email FROM app.users WHERE user_id = $1` with `SELECT user_id, display_name, email FROM app.users WHERE user_id = $1`, and on line 43 use `u.display_name || "Thành viên"`.
4. **`backend/src/modules/organizations/organizationRepository.js:171, 184`**:
   Replace `SELECT c.criteria_version_id, c.code, ...` with `SELECT c.criteria_version_id, c.criterion_code AS code, ...`.

---

## 5. Verification Method

### 5.1 Verification Commands
1. Run the hardened CV test suite:
   ```powershell
   node --test backend/tests/cv-slug-docx.test.js
   ```
   **Expected**: 9/9 tests PASS with deep XML unpack assertions.

2. Run the adversarial CV suite:
   ```powershell
   node --test backend/tests/challenger-m3-cv-adversarial.test.js
   ```

3. Run empirical node one-liner to verify DOCX output XML directly:
   ```powershell
   @'
   import { createCvService } from "./backend/src/modules/cv/cvService.js";
   import PizZip from "./backend/node_modules/pizzip/js/index.js";

   const mockRepo = {
     findProfileByUserId: async () => ({ profile_id: 'p1', headline: 'H', bio: 'B', selected_achievement_ids: '[1]' }),
     getUserContact: async () => ({ full_name: 'Tester', email: 't@lhu.edu.vn', phone: '0123' }),
     getUserActiveAchievements: async () => [{ achievement_id: 1, title: 'TARGET_ACHIEVEMENT_NAME', recognition_year: 2026, achievement_type_name: 'Award' }]
   };
   const service = createCvService(mockRepo);
   const { buffer } = await service.exportCvDocx(1);
   const zip = new PizZip(buffer);
   const xml = zip.file('word/document.xml').asText();
   console.log('CONTAINS_ACHIEVEMENT:', xml.includes('TARGET_ACHIEVEMENT_NAME'));
   console.log('NO_RAW_TAGS:', !xml.includes('{#achievements}'));
   console.log('NO_UNDEFINED:', !xml.includes('undefined'));
   process.exit((xml.includes('TARGET_ACHIEVEMENT_NAME') && !xml.includes('{#achievements}') && !xml.includes('undefined')) ? 0 : 1);
   '@ | node --input-type=module
   ```
   **Expected Success Condition**: Prints `CONTAINS_ACHIEVEMENT: true`, `NO_RAW_TAGS: true`, `NO_UNDEFINED: true`, and exits with code 0.
   **Invalidation Condition**: If code exits with 1, prints `CONTAINS_ACHIEVEMENT: false`, or includes `undefined`.
