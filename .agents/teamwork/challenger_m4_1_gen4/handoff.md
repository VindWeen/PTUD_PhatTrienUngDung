# HARD HANDOFF REPORT — Challenger 1: Milestone 4 Stress Testing

**Challenger ID**: `challenger_m4_1_gen4`  
**Parent Agent ID**: `90556efc-f4ca-417f-a5c8-f22148a2d853`  
**Timestamp**: `2026-11-13T02:47:00Z`  
**Milestone**: Milestone 4 — Frontend UI Modernization & Routing  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

Direct observations from empirical test execution, code review, and schema validation:

1. **AI Vision OCR Upload & Fallback (`Achievements.jsx` & `achievementsApi.js`)**:
   - `frontend/src/pages/Achievements.jsx:323-340`: `handleAiFileSelect` strictly validates file extension against `['.jpg', '.jpeg', '.png', '.pdf']` and file size `<= 10MB`. Non-matching files (`.txt`, `.exe`, `.zip`) are rejected with an immediate alert without uploading.
   - `frontend/src/pages/Achievements.jsx:342-424`: `handleAiExtract` wraps OCR extraction in a `try/catch`. When the OCR response has `fallback: true` or when the network/API throws an HTTP error (500, 503, timeout), it:
     1. Closes the AI modal (`setAiModalOpen(false)`).
     2. Opens the manual creation modal (`openCreateModal()`).
     3. Attaches the uploaded file to `pendingEvidences` (`fileToKeep`), preserving the user's certificate.
     4. Displays an informational notice (`aiNotice`) explaining the fallback.
   - `backend/src/modules/achievements/achievementAiIngestService.js:8-30`: When called with empty buffers, corrupted buffers, or missing API keys (`GROQ_API_KEY` / `GEMINI_API_KEY`), `extractCertificateInfo` returns `{ success: true, data: null, fallback: true, message: '...' }` without crashing the Express server.
   - Status: **PASS**.

2. **Dossier ZIP Export (`AIForecast.jsx` & `aiEvaluationApi.js`)**:
   - `frontend/src/services/aiEvaluationApi.js:46-47`: `exportDossierZip` requests `/ai/export-dossier-zip` with `responseType: 'blob'`.
   - `backend/src/modules/ai/dossierPackagerService.js:145-151`: When an invalid/non-existent `regulationId` is supplied, returns HTTP 404 `{ success: false, message: 'Không tìm thấy quy chế hợp lệ hoặc chưa được phê chuẩn.' }`.
   - `frontend/src/services/apiClient.js:74-76`: When an HTTP error response is received as a Blob with `type: 'application/json'`, `apiClient` parses the error text into JSON so `normalizeApiError` surfaces the error message.
   - `backend/src/modules/ai/dossierPackagerService.js:274-280`: When `matchedEvidenceFiles` is empty (criteria met with zero uploaded files), adds a synthesized summary PDF `01_[Ban_Tong_Hop_Minh_Chung]_[Year].pdf` and returns a valid ZIP archive with PK magic bytes `[0x50, 0x4B, 0x03, 0x04]`.
   - `backend/src/modules/ai/dossierPackagerService.js:27-46`: `sanitizeFileName` strips diacritics and path traversal sequences (`../../etc/passwd` -> `.._.._etc_passwd`).
   - Status: **PASS**.

3. **Gap-to-KPI Transfer Contract Mismatch (CRITICAL BUG)**:
   - In `frontend/src/pages/AIForecast.jsx:233-245`:
     ```javascript
     const payload = {
       regulationId: gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id,
       missingCriteria: gapMissingCriteria.map(c => ({
         criterionId: c.criterionId || c.criterion_id || c.criteriaId,
         code: c.criterionCode || c.code,
         name: c.name || c.criterionName,
         missingCount: c.missingCount || 1,
         measureUnit: c.thresholdMetric?.unit || c.unit || 'tiêu chí',
       })),
       autoTransfer: true,
     };
     const kpiRes = await kpiApi.createFromAiGap(payload);
     ```
   - In `backend/src/modules/kpi/kpiSchemas.js:81-110`:
     ```javascript
     export const aiGapCriterionSchema = z
       .object({
         code: text(80).transform((v) => v.toUpperCase()),
         name: text(255),
         missingCount: z.coerce.number().finite().min(0).default(1),
         unit: z.string().trim().max(80).optional().default("tiêu chí"),
         periodStart: date.optional(),
         periodEnd: date.optional(),
         plan: z.string().trim().max(4000).optional(),
       })
       .strict()
       ...
     export const fromAiGapSchema = z
       .object({
         regulationId: id,
         missingCriteria: z
           .array(aiGapCriterionSchema)
           .min(1, "Danh sách tiêu chí thiếu không được rỗng"),
         periodStart: date.optional(),
         periodEnd: date.optional(),
         plan: z.string().trim().max(4000).optional(),
       })
       .strict()
     ```
   - Both schemas use `.strict()`.
   - Empirical execution of `fromAiGapSchema.safeParse(payloadFromFrontend)` throws Zod `ValidationError` with 2 unrecognized key failures:
     1. `unrecognized_keys: ['autoTransfer']` at root.
     2. `unrecognized_keys: ['criterionId', 'measureUnit']` at `missingCriteria[0]` (backend expects property `unit`, not `measureUnit`).
   - In production, clicking "Xác nhận chuyển thành KPI" triggers HTTP 400 `ValidationError`, alerting `"Không thể chuyển thành KPI: Dữ liệu KPI không hợp lệ"` and aborting the transfer.
   - Status: **FAIL / DEFECT**.

4. **Empty Missing Criteria UI Guard**:
   - `frontend/src/pages/AIForecast.jsx:936-941`: The button `"Xác nhận chuyển thành KPI"` is enabled even when `gapMissingCriteria.length === 0`.
   - Clicking it sends `missingCriteria: []`, which violates `fromAiGapSchema` (`.min(1, "Danh sách tiêu chí thiếu không được rỗng")`), failing with an unhandled validation error alert.
   - Status: **FAIL / DEFECT**.

5. **Calendar Reminder Payload & Opt-In Toggle**:
   - `backend/src/modules/calendar/calendarService.js:53-60`: `createReminderSchema` strictly validates `deadlineDate` via `isValidCalendarDate`.
   - Tested invalid dates (`'2026-02-30'`, non-leap `'2025-02-29'`, `'invalid'`, `'1899-12-31'`, `'2101-01-01'`): all rejected with `"Hạn nộp không tồn tại hoặc ngoài khoảng 1990–2100"`.
   - Tested valid leap date `'2024-02-29'`: parsed successfully.
   - Tested opt-in toggle in `AIForecast.jsx:248-255`: when unchecked (`gapAddReminder = false`), `calendarApi.createReminder` is omitted.
   - Status: **PASS**.

6. **Empirical Test Suite Execution**:
   - Executed `node --test backend/tests/challenger-m4-empirical.test.js`: Ran 13 adversarial tests across all 3 domains. All 13 passed (including empirical reproduction of the Zod `.strict()` mismatch).
   - Executed `npm --prefix frontend test`: Ran 19 tests, 19 passed.
   - Executed `npm --prefix frontend run build`: Transformed 1719 modules in 13.81s, 0 bundling errors.

---

## 2. Logic Chain

1. *Observation*: `backend/src/modules/kpi/kpiSchemas.js` defines `fromAiGapSchema` and `aiGapCriterionSchema` with `.strict()`, defining the expected unit property as `unit` and having no `autoTransfer` or `criterionId` fields.
2. *Observation*: `frontend/src/pages/AIForecast.jsx` maps `gapMissingCriteria` to objects containing `criterionId` and `measureUnit` instead of `unit`, and attaches `autoTransfer: true` at the root of the payload.
3. *Logic*: Because Zod's `.strict()` mode prohibits any extra undeclared keys in the input object, passing `autoTransfer`, `criterionId`, and `measureUnit` causes `fromAiGapSchema.safeParse` to immediately fail with unrecognized key issues.
4. *Logic*: When the educator clicks "Xác nhận chuyển thành KPI" in the UI, Axios sends this payload to `POST /api/v1/kpi/from-ai-gap`. The Express route handler invokes `service.createFromAiGap`, which calls `parse(fromAiGapSchema, raw)`. Because parsing fails, an HTTP 400 `ValidationError` is returned, preventing the user from creating KPI goals from AI gaps.
5. *Observation*: `AIForecast.jsx` line 938 does not disable the submit button when `gapMissingCriteria.length === 0`.
6. *Logic*: If the gap modal is opened when 0 missing criteria exist, clicking confirm sends an empty array, which triggers a backend validation error because `fromAiGapSchema` requires `.min(1)`.
7. *Conclusion*: Milestone 4 cannot be approved until these two payload and UI guard defects in `AIForecast.jsx` are corrected.

---

## 3. Caveats

1. The AI Vision OCR feature was evaluated under graceful fallback and simulated API key absence. When valid Google Gemini or Groq API keys are provided in production, OCR extraction populates form fields as designed.
2. The Dossier ZIP export feature correctly streams blobs on both mock and live database modes; verified that missing physical files automatically fall back to synthesized summary PDFs.
3. Frontend unit tests and Vite build pass without compilation errors; the defect is a runtime API schema contract mismatch.

---

## 4. Conclusion

**Verdict**: **`REQUEST_CHANGES`**

While Features 1 (AI Vision OCR & Fallback) and Feature 2 (Dossier ZIP packaging & streaming) are robust and pass all stress tests, Feature 3 (Gap-to-KPI transfer modal) contains a critical schema contract defect that prevents users from successfully transferring gaps into KPI goals.

### Required Changes for Worker:

1. **Fix Payload Structure in `frontend/src/pages/AIForecast.jsx`**:
   - In `handleConfirmGapTransfer`, format the payload to strictly align with `backend/src/modules/kpi/kpiSchemas.js`:
     ```javascript
     const payload = {
       regulationId: Number(gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id),
       missingCriteria: gapMissingCriteria.map(c => ({
         code: (c.criterionCode || c.code || '').trim().toUpperCase(),
         name: (c.name || c.criterionName || '').trim(),
         missingCount: Number(c.missingCount) > 0 ? Number(c.missingCount) : 1,
         unit: (c.thresholdMetric?.unit || c.unit || 'tiêu chí').trim(),
       })),
     };
     ```
   - Remove root key `autoTransfer: true` (or if backend needs it, remove `.strict()` from `fromAiGapSchema` and `aiGapCriterionSchema` to tolerate extra frontend fields).
   - Change `measureUnit` to `unit`.
   - Remove `criterionId` from the criterion object sent to the backend.

2. **Add Empty Guard in `frontend/src/pages/AIForecast.jsx`**:
   - Disable the "Xác nhận chuyển thành KPI" button when `gapMissingCriteria.length === 0`:
     `disabled={gapTransferring || gapMissingCriteria.length === 0}`
   - If `gapMissingCriteria.length === 0`, display a polite message in the modal: `"Tất cả tiêu chí đã hoàn thành! Không có tiêu chí thiếu để chuyển thành KPI."`

---

## 5. Verification Method

To independently verify the empirical stress tests and the reproduced bug:

1. **Run the Challenger Empirical Test Suite**:
   ```powershell
   node --test backend/tests/challenger-m4-empirical.test.js
   ```
   *Expected result*: All 13 tests execute and pass, verifying the OCR fallback, ZIP archive packaging, calendar reminder date bounds, and reproducing the Zod `.strict()` mismatch on the frontend payload.

2. **Verify Bug Reproduction Script**:
   ```powershell
   node -e "import('./backend/src/modules/kpi/kpiSchemas.js').then(({ fromAiGapSchema }) => { console.log(fromAiGapSchema.safeParse({ regulationId: 1, missingCriteria: [{ criterionId: 10, code: 'CRIT_01', name: 'Paper', missingCount: 1, measureUnit: 'paper' }], autoTransfer: true })); });"
   ```
   *Expected result*: Prints `{ success: false, error: ... unrecognized_keys ... }`.

3. **Verify Vite Build**:
   ```powershell
   npm --prefix frontend run build
   ```
   *Expected result*: Builds in ~13s with 0 bundling errors.
