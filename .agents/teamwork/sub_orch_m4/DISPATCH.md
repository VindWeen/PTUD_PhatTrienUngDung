## 2026-11-12T23:50:03Z

You are sub_orch_m4, the Sub-Orchestrator for Milestone 4: Frontend UI Modernization & Routing.

Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4
Scope document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4\SCOPE.md
Project plan: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
Original user request: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md

Your parent is a9740918-618d-4d46-a8ca-37e2348abdd9 (Project Orchestrator Gen 3). Send all progress updates and final handoff to your parent via send_message.

## Mission
Modernize the entire frontend application (React 18 + Vite + Tailwind CSS) to align with the Smart Achievement Vault & Career Assistant architecture, fulfilling Requirements R1 through R6.

Scope:
1. `Achievements.jsx`:
   - "Sẵn sàng sử dụng" / `ACTIVE` badge on achievements.
   - AI Vision certificate upload modal calling `POST /api/v1/achievements/ai-extract`.
   - Graceful fallback: Gentle notification when API key is missing or extraction fails, allowing seamless manual input without interruption.
2. `AIForecast.jsx`:
   - 2 tabs: "Khám theo quy chế" and "Khám ngược tiềm năng (Auto-Discovery)".
   - Tab 1: Matched criteria with evidence links and missing criteria. "Xuất gói minh chứng (.ZIP)" button calling `POST /api/v1/ai/export-dossier-zip`.
   - Tab 2: Ranked regulations by percentage match.
   - Gap-to-KPI: "Chuyển thành mục tiêu KPI" button with friendly popup: "Bạn có muốn thêm vào lịch nhắc nhở không?". If confirmed, adds deadline to Calendar (`POST /api/v1/me/calendar/reminder`) and inserts KPI goal (`POST /api/v1/kpi/from-ai-gap`).
3. `Kpi.jsx` & `Calendar.jsx`:
   - `Kpi.jsx`: Display KPI goals with `AI_GAP` source label and progress tracking.
   - `Calendar.jsx`: Display submission deadline events on the personal calendar.
4. `CvEditor.jsx` & `PublicCv.jsx`:
   - `CvEditor.jsx`: Custom slug (`/cv/:slug`), UUID fallback, `is_public` toggle, 3 templates (Academic, Modern, Minimalist), and Word (.docx) export button calling `GET /api/v1/me/cv/export-docx`.
   - `PublicCv.jsx` (Route `/cv/:slug`): Public access without authentication. If `is_public = 0`: show polite privacy screen. If `is_public = 1`: render complete styled CV.
5. `AppRoutes.jsx` & `Sidebar.jsx`:
   - Decommission and remove legacy approval/council/paperwork workflows.
   - Streamline navigation for 4 standard roles: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
6. `Reports.jsx`:
   - Department Heads and Faculty Leads scan unit staff via `POST /api/v1/organizations/units/:id/ai-scan` and view/export statistics.
7. Verification:
   - Vite build succeeds (`npm run build` in `frontend/`) with 0 errors.
   - Comprehensive automated frontend tests pass.

## Iteration Loop Procedure
1. Spawn 3 Explorers (`teamwork_explorer`) to inspect current pages in `frontend/src/` (`Achievements.jsx`, `AIForecast.jsx`, `Kpi.jsx`, `CvEditor.jsx`, `PublicCv.jsx`, `Reports.jsx`, `AppRoutes.jsx`, `Sidebar.jsx`) and detail exact component modifications needed.
2. Spawn 1 Worker (`teamwork_worker`) with Explorer findings + MANDATORY INTEGRITY WARNING to implement all page updates, routing, test suites, and run `npm run build`.
3. Spawn 2 Reviewers (`teamwork_reviewer`) in parallel to review UX flow, responsiveness, API alignment, and role permissions.
4. Spawn 2 Challengers (`teamwork_challenger`) in parallel to test edge cases, error fallbacks, public/private slug routing, and ZIP/DOCX download triggers.
5. Spawn 1 Forensic Auditor (`teamwork_auditor`) to verify genuine frontend implementation (no dummy hardcodes, authentic backend API integration).
6. Record gate check in `GATE_STATUS.md`. Gate must PASS.
7. Write `handoff.md` and report back to parent via `send_message`.


## 2026-11-12T23:53:07Z

[From Parent a9740918-618d-4d46-a8ca-37e2348abdd9]
**Context**: Milestone 4 Orchestration
**Content**: Status received. 3 Explorers running in parallel. Proceed with synthesis and Worker dispatch once reports are in.
**Action**: Continue execution and notify when worker completes or gate verdicts are recorded.
