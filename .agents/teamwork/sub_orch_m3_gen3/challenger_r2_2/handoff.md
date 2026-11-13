# Handoff Report: Milestone 3 CV Profiles, Custom Slugs & DOCX Export Adversarial Verification

**Agent**: `challenger_r2_2` (Milestone 3 CV Profiles & DOCX Export Adversarial Testing)  
**Date**: 2026-11-13T06:37:00Z  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_r2_2`  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct empirical inspection and adversarial execution revealed the following concrete metrics:

### 1.1 Deep DOCX OpenXML Template Inspection
- Inspected the physical template file `backend/src/modules/cv/templates/default_cv.docx` by unpacking `word/document.xml` using `PizZip`.
- In `default_cv.docx` lines 37–42:
  ```xml
  <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
  <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
  <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
  <w:p><w:r><w:t>{^achievements}</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
  <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
  ```
- In `backend/src/modules/cv/cvService.js` lines 37–42, the fallback constant `DOCUMENT_XML` exactly matches this structure.
- DOCX export rendering was stress-tested across 5 distinct data configurations:
  1. Multiple achievements (N = 3) with XML special characters (`&`, `<`, `>`), null years, and null types.
  2. Single achievement (N = 1) with scientific symbols (`Σ`, `α`, `β`).
  3. Subset filtering via `selected_achievement_ids`.
  4. Zero achievements (N = 0) with empty array `[]`.
  5. Missing/null profile properties (null headline, null bio, null phone).
- Empirical results across all exported buffers:
  - Raw loop tags (`{#achievements}`, `{/achievements}`, `{^achievements}`): **0 occurrences** (null match).
  - Literal `undefined`: **0 occurrences**.
  - Literal `null`: **0 occurrences**.
  - Fallback message when achievements exist: **0 occurrences**.
  - Fallback message when achievements empty: **Cleanly rendered** (`Chưa có thành tích nào được chọn hiển thị.`).

### 1.2 Custom Slugs & Reserved Slugs Stress Testing
- `backend/src/modules/cv/cvSchemas.js` (lines 32–40) enforces `slugSchema` with:
  - Length boundaries: `< 3` rejected, `> 100` rejected, exact 3 and exact 100 accepted.
  - Character set: `SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` rejects spaces, uppercase, unicode accents, consecutive hyphens, leading/trailing hyphens.
  - Reserved slugs: `RESERVED_SLUGS = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root', 'me', 'public', 'export-docx', 'download', 'cv', 'profile', 'default']`. All 15 keywords were individually verified to fail schema validation with a 400 error.
- Collision handling in `cvService.updateCv`:
  - Cross-user claim: User B attempting to claim User A's existing slug throws `ConflictError: Slug này đã có người sử dụng. Vui lòng chọn slug khác.` (HTTP 409).
  - Same-user update: User A submitting their own existing slug succeeds with version increment.
- UUID and numeric fallbacks in `cvRepository.findProfileBySlugOrId`:
  - Validated lookup by full UUID `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` when `slug` is null or empty.
  - Validated fallback by numeric `user_id`.

### 1.3 `is_public` Toggle & Privacy Isolation
- Unauthenticated access to private CV (`is_public = 0`) via `/api/v1/public/cv/:slug` or `/api/v1/cv/:slug`:
  - Returns `{ success: true, data: { isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' } }`.
  - Serialized payload payload inspection confirms **0 data leakage**: `contact`, `achievements`, `headline`, and `bio` are all `undefined` and completely omitted from JSON.
- Owner access via authenticated endpoints (`/api/v1/me/cv` and `/api/v1/me/cv/profile`):
  - Returns complete CV data (`contact`, `achievements`, `headline`, `bio`, `selectedAchievementIds`) regardless of whether `is_public` is `0` or `1`.
  - Unauthenticated access to `/api/v1/me/cv`, `/api/v1/me/cv/profile`, or `/api/v1/me/cv/export-docx` is rejected with HTTP 401 Unauthorized.
- Non-existent CVs return HTTP 404 with security header `X-Robots-Tag: noindex, nofollow`.

### 1.4 Test Suite Execution Results
- `node --test backend/tests/challenger-m3-cv-adversarial.test.js`: **15 / 15 passed** (0 failures).
- `node --test backend/tests/cv-slug-docx.test.js backend/tests/cv.test.js`: **13 / 13 passed** (0 failures).
- `node --test backend/tests/challenger-m3-cv-deep-adversarial.test.js`: **10 / 10 passed** (0 failures).
- Combined CV suite: **38 / 38 passed** (0 failures).
- Pre-existing regression suites (11 suites): **52 / 52 passed** (0 failures).
- M3 Live SQL Server integration suite: **5 / 5 passed** (0 failures).
- Legacy test runner (`backend/tests/runner.js`): **31 / 31 passed** (0 failures).

---

## 2. Logic Chain

1. **OpenXML Formatting Correctness**:
   - `Docxtemplater` with `{ paragraphLoop: true }` interprets opening and closing tags only when they encapsulate a paragraph boundary (`<w:p><w:r><w:t>{#tag}</w:t></w:r></w:p>`).
   - Observations in §1.1 demonstrate that both the binary archive `default_cv.docx` and the fallback string constant `DOCUMENT_XML` wrap each loop delimiter (`{#achievements}`, `{/achievements}`, `{^achievements}`) inside an isolated paragraph.
   - Consequently, when rendered with data, the parser replaces the loop markers without leaving orphan tag text, and correctly evaluates the inverted loop (`{^achievements}`) only when the achievements array is empty.
   - Fallback defaults in `cvService.exportCvDocx` (`|| ''`, `|| 'N/A'`, `|| 'Khen thưởng'`) guarantee that missing properties are never coerced to the string literal `"undefined"`.

2. **Slug Namespace Protection**:
   - Because public routing resolves `/cv/:slug`, reserving system words (`me`, `public`, `export-docx`, `api`, `admin`, etc.) is essential to prevent route collisions with API endpoints or future UI routing.
   - The combination of regex syntax rules (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) and `RESERVED_SLUGS.includes()` inside `slugSchema` completely insulates against malformed or reserved slugs.
   - Cross-user conflict checks in `cvService.updateCv` safeguard existing slugs against hijacking, while allowing the owner to idempotently re-save.

3. **Privacy Boundary Guarantee**:
   - When `is_public` is disabled, `getPublicCv` halts before loading contact details or mapping achievements. The returned DTO contains exclusively `{ isPublic: false, message: ... }`.
   - String serialization audits confirm that zero personal data or achievement records leak in the HTTP response.
   - Owner routes are protected by JWT Bearer authentication, allowing the owner private administrative preview.

---

## 3. Caveats

- **No Caveats**: All tests executed against the actual code implementation, binary template archive, and live SQL Server connection. Zero mock compromises or facades were observed.

---

## 4. Conclusion

**Verdict: APPROVE**

The remediated implementation of CV Profiles, Custom Slugs, and DOCX Export fulfills all functional, adversarial, and security criteria defined in `ORIGINAL_REQUEST.md` (R4) and `PROJECT.md` (Interface Contracts §4). The OpenXML loop defect is completely resolved, slug collision and reservation handling are strictly enforced, and public/private access control is fully watertight.

---

## 5. Verification Method

To independently reproduce and verify this assessment, run the following commands from the project root:

### 5.1 Run All CV Adversarial & Unit Test Suites (38 tests — ALL PASS):
```powershell
node --test backend/tests/challenger-m3-cv-adversarial.test.js backend/tests/cv-slug-docx.test.js backend/tests/cv.test.js backend/tests/challenger-m3-cv-deep-adversarial.test.js
```
Expected output:
```
ℹ tests 38
ℹ suites 0
ℹ pass 38
ℹ fail 0
```

### 5.2 Run Full M3 Adversarial & Integration Suites (30 tests — ALL PASS):
```powershell
node --test backend/tests/challenger-m3-adversarial.test.js backend/tests/sqlserver-m3.integration.js
```
Expected output:
```
ℹ tests 30
ℹ suites 0
ℹ pass 30
ℹ fail 0
```

### 5.3 Run All 11 Unit and Integration Test Suites (52 tests — ALL PASS):
```powershell
node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js
```
Expected output:
```
ℹ tests 52
ℹ suites 0
ℹ pass 52
ℹ fail 0
```

### 5.4 Run Legacy Runner (31 checks — ALL PASS):
```powershell
node backend/tests/runner.js
```
Expected output:
```
KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT
```

### Invalidation Conditions:
- Any occurrence of `{#achievements}`, `{/achievements}`, `{^achievements}`, or `undefined` inside `word/document.xml` of an exported DOCX.
- `slugSchema.safeParse('export-docx').success === true` or `slugSchema.safeParse('me').success === true`.
- User B successfully claiming User A's custom slug without receiving HTTP 409 ConflictError.
- Any personal contact or achievement information returned in `GET /api/v1/public/cv/:slug` when `is_public = 0`.
