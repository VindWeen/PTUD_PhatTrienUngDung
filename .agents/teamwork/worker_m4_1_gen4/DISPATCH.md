## 2026-11-13T01:36:00Z
You are Worker 1 for Milestone 4 (Frontend UI Modernization & Routing).

Your State Folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m4_1_gen4
Working Directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

Required Reference Reading:
- ORIGINAL_REQUEST.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- PROJECT.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- SCOPE.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4_gen4\SCOPE.md
- Explorer 1 Report: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_1_gen4\handoff.md (and analysis.md)
- Explorer 2 Report: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_2_gen4\handoff.md (and analysis.md)
- Explorer 3 Report: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_3_gen4\handoff.md (and analysis.md)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Implement all frontend components, routing, and automated frontend tests according to the specifications in the 3 Explorer handoff reports.

1. Achievements Vault & AI Vision OCR Modal:
   - `frontend/src/services/achievementsApi.js`: add `aiExtract(file)` sending multipart/form-data to `/achievements/ai-extract`.
   - `frontend/src/pages/Achievements.jsx`:
     - Add `ACTIVE` badge with label "Sẵn sàng sử dụng" (emerald color).
     - Update `canCreate` so all authenticated users (Boolean(user)) can create vault records.
     - Remove decommissioned approval action buttons (submit, verify, requestCorrection, reject, cancel, revoke) and action modal (actionModalOpen).
     - Add AI Vision Certificate OCR Modal ("✨ Quét AI Bằng khen"): file upload/drag-and-drop, scanner animation, auto-filling `title`, `recognitionYear`, `issueDate` (`startDate`/`endDate`), `issuer`/`decisionNumber` (`description`), and auto-attaching uploaded file to `pendingEvidences`.
     - Implement graceful fallback: on `fallback: true` or 503/error, show a friendly notification, keep the uploaded file in `pendingEvidences`, and open manual creation form without blocking the user.
   - `frontend/src/components/PortfolioAchievements.jsx`: add `ACTIVE` ("Sẵn sàng sử dụng") to `statuses` and `statusStyles`.

2. AI Forecast, Dossier ZIP, KPI & Calendar:
   - `frontend/src/services/aiEvaluationApi.js`: add `autoDiscovery()` (POST `/ai/auto-discovery`) and `exportDossierZip({ regulationId })` (POST `/ai/export-dossier-zip` with responseType: 'blob').
   - `frontend/src/services/kpiApi.js`: add `createFromAiGap({ regulationId, missingCriteria, autoTransfer })` (POST `/kpi/from-ai-gap`).
   - `frontend/src/services/calendarApi.js`: add `createReminder({ title, deadlineDate, regulationId, description })` (POST `/me/calendar/reminder`) and `listReminders()` (GET `/me/calendar/reminders`).
   - `frontend/src/pages/AIForecast.jsx`:
     - Redesign into 2 clear tabs:
       - Tab 1: "Khám theo quy chế": Regulation selector, run structured evaluation (`evaluateStructured`), display score prediction, pass/fail criteria breakdown, matched evidence list, missing gap list, and "Xuất gói minh chứng (.ZIP)" button triggering ZIP blob download.
       - Tab 2: "Khám ngược tiềm năng / Auto-Discovery": Scan all active regulations (`autoDiscovery`), rank by match percentage descending, highlight highest probability honors.
     - Gap-to-KPI roadmap transfer modal: "Chuyển thành mục tiêu KPI", shows missing criteria, prompt checkbox: "Bạn có muốn thêm vào lịch nhắc nhở không?" (with deadline date picker or auto-date), on confirm calls `kpiApi.createFromAiGap` and optionally `calendarApi.createReminder`.
   - `frontend/src/pages/Kpi.jsx`: dedicated badge for `source === 'AI_GAP'` or `source === 'AI_GAP_ANALYSIS'` ("Lộ trình AI Gap" in purple with Sparkles icon).
   - `frontend/src/pages/Calendar.jsx`: create page displaying synchronized award deadlines and reminder events from AI Gap (calling `calendarApi.listReminders()`).

3. Profile CV Editor, Public CV, Routing, and Reports:
   - `frontend/src/pages/CvEditor.jsx`:
     - Support custom slug input with regex validation (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 3-100 chars, no reserved words).
     - Display fallback UUID link if slug is empty (`/cv/:profileId`).
     - Public/private toggle switch (`isPublic`).
     - 3 templates selection: Academic (Hàn lâm), Modern (Hiện đại), Minimalist (Tối giản).
     - Word `.docx` download action calling `GET /api/v1/me/cv/export-docx` with responseType: 'blob'.
   - `frontend/src/pages/PublicCv.jsx`:
     - Route param reads `slug || id`.
     - Calls `GET /api/v1/public/cv/:slug`.
     - If profile is private (`is_public = 0`, or `isPublic === false` or 403), render an elegant Privacy Screen ("Hồ sơ này hiện đang được đặt ở chế độ riêng tư" with shield/lock illustration and back button) rather than crashing.
     - Render the 3 templates (Academic, Modern, Minimalist).
   - `frontend/src/routes/AppRoutes.jsx` & `frontend/src/components/common/Sidebar.jsx`:
     - Standardize on the 4 roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` (with backward-compatibility mapping for legacy roles).
     - Route cleanup: remove legacy paperwork and council routes (`/awards`, `/award-applications`).
     - Mount unauthenticated public routes `/cv/:slug` and `/cv/:id`.
     - Register `/calendar` and `/me/calendar` route.
   - `frontend/src/pages/Reports.jsx`:
     - Add Unit AI Scan tab ("Quét AI Đơn vị") for `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`.
     - Unit selector, regulation selector, scan button calling `POST /api/v1/organizations/units/:id/ai-scan`, animated progress bar, KPI summary cards (total members, eligible count, % eligible), and member breakdown table (matched and missing criteria tags).

4. Automated Frontend Unit Tests & Build Verification:
   - Add `frontend/tests/cvSlugValidation.test.mjs` (validating slug regex, min/max length, reserved words).
   - Add `frontend/tests/publicCvPrivacy.test.mjs` (testing privacy fallback logic and error handling).
   - Run `npm --prefix frontend run build` to verify clean Vite build with 0 errors.
   - Run existing and new tests (`node --test`).

5. Report Results:
   - Write comprehensive progress and handoff report in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m4_1_gen4\handoff.md`.
   - Send completion message to caller agent.
