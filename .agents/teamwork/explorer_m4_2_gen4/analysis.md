# Technical Analysis: AI Forecast, KPI Roadmap & Calendar Modernization (Milestone 4)

**Explorer**: Explorer 2 (Milestone 4)  
**Date**: 2026-11-13  
**Target Files**:
- `frontend/src/pages/AIForecast.jsx`
- `frontend/src/pages/Kpi.jsx`
- `frontend/src/pages/Calendar.jsx` (New Page)
- `frontend/src/services/aiEvaluationApi.js`
- `frontend/src/services/kpiApi.js`
- `frontend/src/services/calendarApi.js`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/components/common/Sidebar.jsx`

---

## 1. Executive Summary

Milestone 4 modernizes the frontend single-page application into an educator-centric **Smart Achievement Vault & Career Assistant**, retiring legacy administrative approvals. 
This analysis details the exact architecture, API integrations, and UI recipes required for:
1. **AIForecast.jsx Modernization**:
   - **Tab 1: "Khám theo quy chế"**: Regulation document dropdown selector, instant criteria evaluation (`POST /api/v1/ai/evaluations/structured`), score & percentage prediction, passed/missing criteria breakdown.
   - **Tab 2: "Khám ngược tiềm năng / Auto-Discovery"**: Automatic scan of all active regulations (`POST /api/v1/ai/auto-discovery`), ranked descending by match %, highlighting high-probability awards.
   - **Dossier ZIP Packaging**: Action button calling `POST /api/v1/ai/export-dossier-zip` and downloading the generated `.zip` bundle.
   - **AI Gap to KPI Roadmap Transfer**: Action button "Chuyển thành mục tiêu KPI" opening a modal displaying missing criteria with an explicit prompt/checkbox *"Bạn có muốn thêm vào lịch nhắc nhở không?"*. Calling `POST /api/v1/kpi/from-ai-gap` and optionally `POST /api/v1/me/calendar/reminder`.
2. **Kpi.jsx Modernization**:
   - Distinctive badge/tag for KPI goals with `source = 'AI_GAP'` or `'AI_GAP_ANALYSIS'` (`Lộ trình AI Gap` with purple badge and Sparkles icon).
   - Formatted presentation of `source_note`.
3. **Calendar.jsx Page Creation & Routing**:
   - Creation of `frontend/src/pages/Calendar.jsx` as a first-class route `/me/calendar` (with `/calendar` redirect).
   - Interactive calendar grid synchronized with `app.calendar_reminders` (`GET /me/calendar/reminders`), showcasing deadline countdowns, regulation/KPI badges, and completion toggles.
4. **Client API Service Upgrades**:
   - `aiEvaluationApi.js`: add `autoDiscovery`, `exportDossierZip`.
   - `kpiApi.js`: add `createFromAiGap`.
   - `calendarApi.js`: add `createReminder`, `listReminders`.

---

## 2. Baseline Architecture & Current State Findings

### 2.1 Backend Contract Readiness (Verified Live)
The backend routes and controllers for all required features were implemented in M2 and M3:
- `POST /api/v1/ai/evaluations/structured` (`aiRoutes.js:14`, `aiController.js:58`): Evaluates structured criteria against active achievements.
- `POST /api/v1/ai/auto-discovery` (`aiRoutes.js:25`, `aiController.js:183`): Evaluates all confirmed regulations, sorts by match percentage descending.
- `POST /api/v1/ai/export-dossier-zip` (`aiRoutes.js:26`, `aiController.js:192`): Streams binary `application/zip` bundle with standardized files `01_[Name]_[Year].pdf`.
- `POST /api/v1/kpi/from-ai-gap` (`kpiRoutes.js:52`, `kpiService.js:392`): Creates KPI goals with `source = 'AI_GAP'` and `source_note = 'AI Gap: ...'`.
- `POST /api/v1/me/calendar/reminder` (`calendarRoutes.js:14`, `calendarService.js:112`): Atomically creates both `app.personal_calendar_events` (`task`) and `app.calendar_reminders`.
- `GET /api/v1/me/calendar/reminders` (`calendarRoutes.js:15`, `calendarService.js:185`): Lists all reminders with `regulationTitle`, `kpiGoalTitle`, `awardPeriodName`.

### 2.2 Client API Services Deficiencies
1. **`frontend/src/services/aiEvaluationApi.js`**: Missing `autoDiscovery` and `exportDossierZip`.
2. **`frontend/src/services/kpiApi.js`**: Missing `createFromAiGap`.
3. **`frontend/src/services/calendarApi.js`**: Missing `createReminder` and `listReminders`.

### 2.3 `AIForecast.jsx` Deficiencies
- Currently has tabs: `live` ("Thẩm định Trực tiếp"), `history` ("Lịch sử Phiên AI"), `fixtures` ("Hồ sơ mẫu").
- In `live`, it presents an administrative interface for selecting Subject Type (`LECTURER` vs `UNIT`), searching for lecturers, and checking individual raw criteria checkboxes.
- It completely lacks:
  1. A Regulation selector dropdown (to evaluate a complete regulation package such as "Chiến sĩ thi đua cơ sở", "Bằng khen cấp Bộ", etc.).
  2. Tab 2: "Khám ngược tiềm năng / Auto-Discovery" (ranking all regulations by % match).
  3. Dossier ZIP download button calling `exportDossierZip`.
  4. "Chuyển thành mục tiêu KPI" button & modal with calendar reminder prompt.

### 2.4 `Kpi.jsx` Deficiencies
- In `frontend/src/pages/Kpi.jsx` line 368:
  ```jsx
  Nguồn: {({MANUAL:'Tự thiết lập',AI:'Gợi ý AI',EXTERNAL:'Đồng bộ',CSV:'Nhập từ tệp'})[g.source] || 'Nguồn bổ sung'}
  ```
  `AI_GAP` and `AI_GAP_ANALYSIS` are unmapped and display as the generic fallback `'Nguồn bổ sung'`.
- Needs a distinct visual badge (e.g. purple styling with `Sparkles` icon and text `Lộ trình AI Gap`).

### 2.5 `Calendar.jsx` Deficiencies
- `frontend/src/pages/Calendar.jsx` **does not exist**!
- Calendar currently only exists as a floating dialog/card component (`frontend/src/components/calendar/PersonalCalendar.jsx`) embedded in `Dashboard.jsx`.
- There is no `/me/calendar` or `/calendar` route in `frontend/src/routes/AppRoutes.jsx`.
- Reminders generated from AI Gaps (`app.calendar_reminders`) have no dedicated UI listing or deadline countdown page.

---

## 3. Detailed Component Designs

### 3.1 `frontend/src/services/` Updates

#### 1. `frontend/src/services/aiEvaluationApi.js`
Add:
```javascript
/**
 * Auto-Discovery: Khám ngược tiềm năng danh hiệu
 */
autoDiscovery: (data = {}) =>
  request({ method: 'POST', url: '/ai/auto-discovery', data }),

/**
 * Đóng gói và tải file zip minh chứng (.ZIP)
 */
exportDossierZip: (data = {}) =>
  request({ method: 'POST', url: '/ai/export-dossier-zip', data, responseType: 'blob' }),
```

#### 2. `frontend/src/services/kpiApi.js`
Add:
```javascript
/**
 * Tạo mục tiêu KPI từ tiêu chí còn thiếu của AI Gap
 */
createFromAiGap: (data) => api('POST', '/from-ai-gap', data),
```

#### 3. `frontend/src/services/calendarApi.js`
Add:
```javascript
/**
 * Tạo lịch nhắc nhở hạn nộp hồ sơ / KPI
 */
createReminder: (data) => call({ url: '/me/calendar/reminder', method: 'POST', data }),

/**
 * Lấy danh sách nhắc nhở hạn nộp hồ sơ cá nhân
 */
listReminders: () => call({ url: '/me/calendar/reminders' }),
```

---

### 3.2 `frontend/src/pages/AIForecast.jsx` Modernization

#### Tab Structure
```jsx
<UnderlineTabs
  label="Phương thức phân tích AI"
  value={activeTab}
  disabled={evaluating || discovering}
  onChange={setActiveTab}
  items={[
    { id: 'regulation', label: 'Khám theo quy chế', icon: Cpu },
    { id: 'discovery', label: 'Khám ngược tiềm năng / Auto-Discovery', icon: Sparkles },
    { id: 'history', label: 'Lịch sử Phiên AI', icon: History },
  ]}
/>
```

#### Tab 1: "Khám theo quy chế"
1. **Regulation Selector**:
   - Fetches available regulations using `regulationsApi.listDocuments()`.
   - Select component allows picking a target regulation (e.g. `document_id`).
   - When a regulation is selected:
     - Displays document metadata (Document code, title, effective dates).
     - Fetches active criteria for that regulation's version via `regulationsApi.listCriteria({ versionId })`.
     - Provides an optional `asOfDate` picker (defaults to today).
     - Button: **"Kiểm tra theo quy chế"** (`soft-btn-primary`).
2. **Evaluation Results View**:
   - Calling `POST /api/v1/ai/evaluations/structured` with `{ subjectType: 'LECTURER', subjectId, criteriaVersionIds, asOfDate }`.
   - **Score & Prediction Summary**:
     - Visual progress bar showing match percentage: `Math.round((satisfiedCount / totalCount) * 100)%`.
     - Status:
       - If 100%: Green badge `Đủ điều kiện xét thưởng` (All criteria satisfied).
       - If <100%: Amber badge `Chưa đủ điều kiện (Còn thiếu [N] tiêu chí)`.
   - **Action Bar**:
     - **Button "Xuất gói hồ sơ (.ZIP)"**: Always available or highlighted when satisfied. On click:
       ```javascript
       const handleExportZip = async (regulationId, regulationTitle) => {
         setExportingZip(true);
         try {
           const blob = await aiEvaluationApi.exportDossierZip({ regulationId });
           const url = window.URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `Goi_Minh_Chung_${regulationTitle.replace(/\s+/g, '_')}.zip`;
           document.body.appendChild(a);
           a.click();
           a.remove();
           window.URL.revokeObjectURL(url);
         } catch (err) {
           alert('Không thể xuất gói ZIP: ' + (err.message || 'Lỗi hệ thống'));
         } finally {
           setExportingZip(false);
         }
       };
       ```
     - **Button "Chuyển thành mục tiêu KPI"**: Displayed whenever there are missing criteria (`missingCount > 0`). Opens the **KPI Gap Modal**.
   - **Criteria Breakdown**:
     - Group 1: **Tiêu chí đã đạt**: Green cards showing matched active achievements with evidence file tags.
     - Group 2: **Tiêu chí còn thiếu (Gaps)**: Amber/rose cards showing target required vs actual recorded, and missing count.
     - AI Explanation collapsible (RAG explanations with citation badges).

#### Tab 2: "Khám ngược tiềm năng / Auto-Discovery"
1. **Auto-Discovery Execution**:
   - On selecting tab `discovery` (or clicking "Quét lại"), triggers `aiEvaluationApi.autoDiscovery()`.
   - Shows animated scanning indicator (`RefreshCw animate-spin` with message: *"AI đang quét toàn bộ kho quy chế và đối chiếu thành tích của bạn..."*).
2. **Ranked Regulation Cards**:
   - The returned regulations are sorted descending by `percentage` and `satisfiedCount`.
   - Each card displays:
     - Regulation title & code (`documentCode`).
     - Large percentage circle or progress bar (e.g. `100%`, `75%`, `50%`, `0%`).
     - Match stats: `[satisfiedCount]/[totalCount] tiêu chí đạt`.
     - Deadline: `Hạn nộp: [deadline]` (from award period or effective dates).
     - Feasibility badge:
       - `percentage === 100`: `Đạt chuẩn 100% - Có thể nộp ngay` (Emerald).
       - `percentage >= 50`: `Tiềm năng cao` (Teal/Sky).
       - `percentage < 50`: `Cần bổ sung nhiều tiêu chí` (Amber).
     - Card Actions:
       - **"Xuất gói hồ sơ (.ZIP)"**: Direct button invoking `exportDossierZip({ regulationId })`.
       - **"Chuyển thành KPI"**: Direct button opening the Gap-to-KPI transfer modal with this regulation's missing criteria.
       - **"Khám chi tiết"**: Switches to Tab 1 with this regulation selected.

#### AI Gap to KPI Roadmap Transfer Modal (`KpiGapModal`)
Requirements:
1. Opens popup/modal showing:
   - Regulation name.
   - List of missing criteria (code, name, missingCount, unitMetric).
   - Period start / end (defaults to current year or regulation award deadline).
2. **Explicit Checkbox / Prompt**:
   - Prompt: **"Bạn có muốn thêm vào lịch nhắc nhở không?"**
   - Checkbox default: checked (`true`).
   - When checked: displays deadline date input (pre-filled with regulation deadline or cycle end date).
3. **On Confirm**:
   - Calls `kpiApi.createFromAiGap({ regulationId, missingCriteria, periodStart, periodEnd })`.
   - If reminder checkbox is checked:
     - Calls `calendarApi.createReminder({ title: `Hạn nộp hồ sơ: ${regulationTitle}`, deadlineDate, regulationId })`.
   - Shows success toast / message: *"Đã tạo thành công [N] mục tiêu KPI và thêm hạn nộp vào Lịch cá nhân!"*.
   - Offers action buttons: "Xem Mục tiêu KPI" (`/kpi`) and "Xem Lịch cá nhân" (`/me/calendar`).

---

### 3.3 `frontend/src/pages/Kpi.jsx` Modernization

In `Kpi.jsx`, locate the goal card render (lines 350-375):
Replace the current source label:
```jsx
// BEFORE:
<span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
  Nguồn: {({MANUAL:'Tự thiết lập',AI:'Gợi ý AI',EXTERNAL:'Đồng bộ',CSV:'Nhập từ tệp'})[g.source] || 'Nguồn bổ sung'}
</span>

// AFTER:
{g.source === 'AI_GAP' || g.source === 'AI_GAP_ANALYSIS' ? (
  <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-800">
    <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
    Lộ trình AI Gap
  </span>
) : (
  <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
    Nguồn: {({
      MANUAL: 'Tự thiết lập',
      AI: 'Gợi ý AI',
      EXTERNAL: 'Đồng bộ',
      CSV: 'Nhập từ tệp',
      AI_GAP: 'Lộ trình AI Gap',
      SYSTEM: 'Hệ thống'
    })[g.source] || 'Nguồn bổ sung'}
  </span>
)}
```

In `frontend/src/services/kpiPresentation.js`:
Add support for AI Gap notes:
```javascript
export function goalSourceText(note) {
  if (!note) return '';
  if (note.startsWith('AI Gap:')) {
    return note;
  }
  if (!/^AI W4-P1;/.test(note)) return note;
  const criterion = note.match(/tiêu chí ([^;]+)/)?.[1];
  const clauses = [...note.matchAll(/"clauseReference":"([^"]+)"/g)].map(match => match[1]);
  return ['Đề xuất từ phân tích AI', criterion && `Tiêu chí ${criterion}`, ...new Set(clauses)].filter(Boolean).join(' · ');
}
```

---

### 3.4 `frontend/src/pages/Calendar.jsx` Implementation

Create `frontend/src/pages/Calendar.jsx`:
1. **Header & Context**:
   - `PageHeader` with title **"Lịch cá nhân & Nhắc nhở hạn nộp"**, subtitle **"Theo dõi lịch làm việc, hạn nộp hồ sơ thi đua khen thưởng và sự kiện từ AI Gap"**, icon `CalendarDays`.
   - Refresh button reloading both calendar events and reminders.
2. **Layout Structure**:
   - **Left Column (Desktop 65%)**:
     - Month navigation controls (`MonthControls`).
     - Interactive calendar grid (`CalendarGrid`).
     - Legend for categories (Công việc, Cuộc thi, Lịch thi, Cá nhân, Hạn kỳ đề nghị).
     - Selected day event list with add/edit/delete actions.
   - **Right Column (Desktop 35%)**:
     - **Section "Nhắc nhở hạn nộp & Lộ trình AI Gap"**:
     - Fetches `calendarApi.listReminders()`.
     - Displays cards with:
       - Title (e.g. `Hạn nộp hồ sơ: Danh hiệu Giảng viên dạy giỏi`).
       - Deadline date badge with countdown calculation:
         - `Còn X ngày` (green/amber).
         - `Hôm nay` (amber pulse).
         - `Đã quá hạn` (rose).
       - Tags:
         - If `regulationTitle`: badge `Quy chế: [regulationTitle]`.
         - If `kpiGoalTitle`: badge `Mục tiêu KPI: [kpiGoalTitle]`.
         - Badge `AI Gap Reminder` with `Sparkles` icon.
       - Quick action: "Mở ngày trên lịch" or mark as completed.
3. **Routing in `AppRoutes.jsx`**:
   ```jsx
   const Calendar = lazy(() => import('../pages/Calendar'));
   ...
   <Route path="me/calendar" element={<RequireRole roles={APP_ROLES}><Calendar /></RequireRole>} />
   <Route path="calendar" element={<Navigate to="/me/calendar" replace />} />
   ```
4. **Navigation in `Sidebar.jsx`**:
   Add `{ to: '/me/calendar', icon: CalendarDays, label: 'Lịch & Nhắc nhở', roles: APP_ROLES }` to navigation list.

---

## 4. Exact Line-by-Line Edit Proposals

### Proposal 1: `frontend/src/services/aiEvaluationApi.js`
```javascript
// Add autoDiscovery and exportDossierZip:
export const aiEvaluationApi = {
  evaluateStructured: (data) =>
    request({ method: 'POST', url: '/ai/evaluations/structured', data }),
  getEvaluationRun: (runId) =>
    request({ method: 'GET', url: `/ai/evaluations/${runId}` }),
  listEvaluationRuns: (params = {}, fresh = false) =>
    request({ method: 'GET', url: '/ai/evaluations', params, fresh }),
  checkEvaluationStale: (runId) =>
    request({ method: 'GET', url: `/ai/evaluations/${runId}/stale-check` }),
  explainEvaluation: (data) =>
    request({ method: 'POST', url: '/ai/rag/explain', data }),
  listCriteria: (params = {}, fresh = false) =>
    request({ method: 'GET', url: '/regulations/criteria', params, fresh }),
  autoDiscovery: (data = {}) =>
    request({ method: 'POST', url: '/ai/auto-discovery', data }),
  exportDossierZip: (data = {}) =>
    request({ method: 'POST', url: '/ai/export-dossier-zip', data, responseType: 'blob' }),
};
```

### Proposal 2: `frontend/src/services/kpiApi.js`
```javascript
// Add createFromAiGap:
export const kpiApi = {
  ...
  createFromAiGap: (data) => api('POST', '/from-ai-gap', data),
  ...
};
```

### Proposal 3: `frontend/src/services/calendarApi.js`
```javascript
// Add createReminder and listReminders:
export const calendarApi = {
  list: () => call({ url: '/me/calendar' }),
  listSystem: () => call({ url: '/me/calendar/system' }),
  create: data => call({ url: '/me/calendar', method: 'POST', data }),
  update: (id, data) => call({ url: `/me/calendar/${id}`, method: 'PUT', data }),
  remove: (id, version) => call({ url: `/me/calendar/${id}`, method: 'DELETE', data: { version } }),
  createReminder: data => call({ url: '/me/calendar/reminder', method: 'POST', data }),
  listReminders: () => call({ url: '/me/calendar/reminders' }),
};
```

### Proposal 4: `frontend/src/pages/Kpi.jsx`
Replace lines 367-370 to properly display `AI_GAP` badge:
```jsx
{g.source === 'AI_GAP' || g.source === 'AI_GAP_ANALYSIS' ? (
  <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-800">
    <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
    Lộ trình AI Gap
  </span>
) : (
  <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
    Nguồn: {({
      MANUAL: 'Tự thiết lập',
      AI: 'Gợi ý AI',
      EXTERNAL: 'Đồng bộ',
      CSV: 'Nhập từ tệp',
      AI_GAP: 'Lộ trình AI Gap',
      SYSTEM: 'Hệ thống'
    })[g.source] || 'Nguồn bổ sung'}
  </span>
)}
```

---

## 5. Build & Test Verification Strategy

1. **Frontend Build Verification**:
   - Run `npm --prefix frontend run build` to verify zero JSX syntax errors, clean bundle creation, and module imports.
2. **Live Backend Integration Tests**:
   - Run existing E2E and integration tests:
     - `node --test tests/e2e/smoke.test.js`
     - `node --test tests/e2e/tier1-feature-coverage.test.js`
     - `node --test tests/e2e/tier3-cross-feature.test.js`
3. **Browser Flow Check**:
   - Open `/me/ai-forecast`: Verify Tab 1 ("Khám theo quy chế") and Tab 2 ("Khám ngược tiềm năng / Auto-Discovery").
   - Test "Xuất gói minh chứng (.ZIP)": Triggers browser download with `.zip` file.
   - Test "Chuyển thành mục tiêu KPI": Opens modal, checks reminder box, confirms -> creates KPI goal and calendar event.
   - Open `/kpi`: Verify the newly created goal displays the purple "Lộ trình AI Gap" badge.
   - Open `/me/calendar`: Verify calendar shows the task event and reminders list shows the newly created deadline reminder.
