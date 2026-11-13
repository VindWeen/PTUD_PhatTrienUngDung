# Handoff Report: AI Forecast, KPI Roadmap & Calendar Modernization (Milestone 4)

**Agent**: Explorer 2 (Milestone 4)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_2_gen4`  
**Working Directory**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**Handoff Type**: Hard (Investigation complete)  

---

## 1. Observation

1. **`frontend/src/pages/AIForecast.jsx` (lines 31-80, 260-267)**:
   - Contains an administrative interface with 3 tabs:
     ```jsx
     items={[
       {id: 'live', label: 'Thẩm định Trực tiếp', icon: Cpu},
       {id: 'history', label: 'Lịch sử Phiên AI', icon: History},
       {id: 'fixtures', label: 'Hồ sơ mẫu', icon: FileCheck2},
     ]}
     ```
   - In tab `live`, it prompts for Subject Type (`LECTURER` vs `UNIT`), uses `EntitySelect` for choosing lecturers, and presents a list of individual criteria checkboxes (`availableCriteria`).
   - It does not contain a Regulation Document selector to evaluate an entire regulation.
   - It has no Auto-Discovery tab.
   - It lacks any button or handler to invoke Dossier ZIP packaging (`POST /api/v1/ai/export-dossier-zip`).
   - It lacks any button or modal to transfer missing gap criteria into KPI goals (`POST /api/v1/kpi/from-ai-gap`) or schedule calendar reminders (`POST /api/v1/me/calendar/reminder`).

2. **`frontend/src/services/aiEvaluationApi.js` (lines 1-40)**:
   - Exports `aiEvaluationApi` with: `evaluateStructured`, `getEvaluationRun`, `listEvaluationRuns`, `checkEvaluationStale`, `explainEvaluation`, `listCriteria`.
   - Missing `autoDiscovery` and `exportDossierZip`.

3. **`frontend/src/pages/Kpi.jsx` (lines 350-370)**:
   - Renders goal source tag using a hardcoded dictionary:
     ```jsx
     <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
       Nguồn: {({MANUAL:'Tự thiết lập',AI:'Gợi ý AI',EXTERNAL:'Đồng bộ',CSV:'Nhập từ tệp'})[g.source] || 'Nguồn bổ sung'}
     </span>
     ```
   - SQL check constraint `ck_kpi_goals_source` in `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql:75` allows `CHECK (source IN (N'MANUAL', N'CSV', N'AI_GAP', N'AI_GAP_ANALYSIS', N'SYSTEM'))`.
   - When `g.source === 'AI_GAP'`, it evaluates to the generic fallback `"Nguồn bổ sung"`.

4. **`frontend/src/services/kpiApi.js` (lines 1-30)**:
   - Exports `kpiApi` for external mappings, recommendations, catalogs, list, create, update, remove, accept, result, draft, preview, commit, template.
   - Missing `createFromAiGap` (`POST /api/v1/kpi/from-ai-gap`).

5. **`frontend/src/pages/Calendar.jsx`**:
   - `frontend/src/pages/Calendar.jsx` does not exist in the repository.
   - Calendar UI only exists as a component dialog/card at `frontend/src/components/calendar/PersonalCalendar.jsx`.
   - `frontend/src/routes/AppRoutes.jsx` has no route for `/me/calendar` or `/calendar`.

6. **`frontend/src/services/calendarApi.js` (lines 1-14)**:
   - Exports `calendarApi` with `list`, `listSystem`, `create`, `update`, `remove`.
   - Missing `createReminder` (`POST /api/v1/me/calendar/reminder`) and `listReminders` (`GET /api/v1/me/calendar/reminders`).

7. **Backend Live Verification via Database & Node**:
   - Live query to database confirmed 4 regulation documents (e.g., `document_id: 3`, `W1-P4-SIMULATION`) with active criteria.
   - Calling `discoverEligibleRegulations({ userId: 1 })` returned valid JSON containing ranked regulations with percentage, criteria list, matchedRecords, missingCount, and deadline.
   - `packageAndStreamDossierZip` and `createZipArchive` properly stream binary zip bundles.
   - `calendarService().listReminders({ userId: 1 })` runs cleanly against `app.calendar_reminders`.
   - `npm --prefix frontend run build` completed cleanly in 21.25s (1722 modules transformed, exit code 0).

---

## 2. Logic Chain

1. **Step 1 (API Services Completeness)**:
   - Frontend cannot execute Auto-Discovery, Dossier ZIP export, Gap-to-KPI transfer, or Calendar reminders without client methods.
   - By adding `autoDiscovery` and `exportDossierZip` to `aiEvaluationApi.js`, `createFromAiGap` to `kpiApi.js`, and `createReminder` & `listReminders` to `calendarApi.js`, the frontend has all required communication channels with the backend (ref: Observation 2, 4, 6).

2. **Step 2 (AIForecast 2-Tab Redesign)**:
   - For Tab 1 ("Khám theo quy chế"): Selecting a regulation from `regulationsApi.listDocuments()` allows the user to immediately evaluate their achievements against the full set of criteria for that award (`POST /api/v1/ai/evaluations/structured`). The UI presents score prediction, pass/fail status, and matched evidence files (ref: Observation 1, 7).
   - For Tab 2 ("Khám ngược tiềm năng / Auto-Discovery"): Invoking `aiEvaluationApi.autoDiscovery()` scans all active regulations and ranks feasible awards by match percentage descending, allowing instant discovery of high-probability honors (ref: Observation 1, 7).

3. **Step 3 (Dossier Packaging & Gap-to-KPI Transfer)**:
   - Providing a "Xuất gói minh chứng (.ZIP)" button invoking `exportDossierZip({ regulationId })` creates a Blob download of the standardized zip archive (ref: Observation 1, 7).
   - Providing a "Chuyển thành mục tiêu KPI" button opens a popup showing missing criteria (`code`, `name`, `missingCount`, `unit`), asking the required prompt *"Bạn có muốn thêm vào lịch nhắc nhở không?"*. Confirming calls `kpiApi.createFromAiGap` and optionally `calendarApi.createReminder` (ref: Observation 1, 4, 6).

4. **Step 4 (Kpi.jsx Source Badge)**:
   - Updating `Kpi.jsx` to recognize `source === 'AI_GAP'` or `'AI_GAP_ANALYSIS'` and rendering a distinct purple badge with `Sparkles` icon ensures users can distinguish roadmapped AI Gap goals from manual ones (ref: Observation 3).

5. **Step 5 (Calendar Page & Synchronization)**:
   - Creating `frontend/src/pages/Calendar.jsx` and registering `/me/calendar` in `AppRoutes.jsx` displays the interactive calendar alongside the list of reminders (`calendarApi.listReminders()`), verifying that reminders scheduled from AI gaps appear in the user's personal calendar (ref: Observation 5, 6).

---

## 3. Caveats

- **API Base URL & Auth Token**: `aiEvaluationApi.exportDossierZip` requires `responseType: 'blob'`. When handling errors, the response interceptor in `apiClient.js` already checks `error.response?.data instanceof Blob` and parses JSON text to preserve error messages.
- **Calendar Timezone**: Calendar reminders default to UTC+7 Vietnam local time as standard across the backend.
- **No other caveats**: All backend tables, constraints, migrations, and routes are already operational and verified.

---

## 4. Conclusion

The frontend modernization for Milestone 4 requires:
1. Extending API client services (`aiEvaluationApi.js`, `kpiApi.js`, `calendarApi.js`).
2. Redesigning `AIForecast.jsx` into two primary tabs: "Khám theo quy chế" and "Khám ngược tiềm năng / Auto-Discovery", with Dossier ZIP export and Gap-to-KPI transfer modal.
3. Updating `Kpi.jsx` to display a dedicated badge for `source = 'AI_GAP'`.
4. Creating `Calendar.jsx` page and registering `/me/calendar` and `/calendar` routes in `AppRoutes.jsx`.

---

## 5. Verification Method

1. **Build Verification**:
   ```powershell
   npm --prefix frontend run build
   ```
   *Expected*: Zero syntax errors, builds cleanly.

2. **Automated Backend & E2E Tests**:
   ```powershell
   node --test tests/e2e/smoke.test.js
   node --test tests/e2e/tier1-feature-coverage.test.js
   node --test tests/e2e/tier3-cross-feature.test.js
   ```
   *Expected*: All tests pass 100%.

3. **Manual / Browser Verification**:
   - Navigate to `/me/ai-forecast`:
     - Test Tab 1 "Khám theo quy chế": Select a regulation, click "Kiểm tra theo quy chế". Check pass/fail breakdown. Click "Xuất gói minh chứng (.ZIP)" to download zip.
     - Test "Chuyển thành mục tiêu KPI": Click button, check "Bạn có muốn thêm vào lịch nhắc nhở không?", confirm.
     - Test Tab 2 "Khám ngược tiềm năng / Auto-Discovery": Verify regulations are ranked by % match.
   - Navigate to `/kpi`:
     - Verify newly transferred goals appear with purple "Lộ trình AI Gap" badge.
   - Navigate to `/me/calendar`:
     - Verify calendar grid displays task event and reminders list shows the newly scheduled submission deadline.

---
*Report filed by Explorer 2 to Orchestrator Parent (`90556efc-f4ca-417f-a5c8-f22148a2d853`).*
