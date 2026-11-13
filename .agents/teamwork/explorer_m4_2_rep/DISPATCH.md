## 2026-11-13T00:55:36Z
You are explorer_m4_2_rep, a teamwork_explorer for Milestone 4: Frontend UI Modernization & Routing.

Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_2_rep
Scope document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4\SCOPE.md
Project plan: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
Original user request: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md

Your parent is dec50792-b8a5-4f76-9c0b-ee100c24b34f (sub_orch_m4). Report back via send_message when done.

MANDATORY FIRST STEP:
Read c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md before doing any other work.

TASKS:
1. Thoroughly inspect `frontend/src/pages/AIForecast.jsx`, `frontend/src/pages/Kpi.jsx`, and `frontend/src/pages/Calendar.jsx`.
2. Analyze all changes needed for Requirements R2 (AI Forecast, Auto-Discovery & Dossier ZIP) and R3 (Gap-to-KPI & Calendar Reminder):
   - `AIForecast.jsx`:
     - 2 main tabs:
       1) "Khám theo quy chế": Select a regulation, evaluate via `POST /api/v1/ai/evaluations/structured`. Display matched criteria with evidence links and missing criteria with missing counts.
       2) "Khám ngược tiềm năng (Auto-Discovery)": Fetch ranked regulations by match percentage from `POST /api/v1/ai/auto-discovery`. Display cards with progress bars and quick actions.
     - Dossier Packaging (.ZIP): On regulation evaluation (when satisfied/eligible or available), provide button "Xuất gói minh chứng (.ZIP)" calling `POST /api/v1/ai/export-dossier-zip` (blob response, download as zip).
     - Gap-to-KPI: On missing criteria, provide "Chuyển thành mục tiêu KPI" button. Show friendly popup modal: "Bạn có muốn thêm vào lịch nhắc nhở không?". If user confirms:
       * Call `POST /api/v1/me/calendar/reminder` with `{ title: "Hạn nộp hồ sơ [Regulation Name]", deadlineDate: ..., regulationId: ... }`
       * Call `POST /api/v1/kpi/from-ai-gap` with `{ regulationId, missingCriteria: [...] }`
       * If user chooses "Chỉ tạo KPI không thêm lịch", only call `POST /api/v1/kpi/from-ai-gap`.
   - `Kpi.jsx`:
     - Display KPI goals with distinct source badge `AI_GAP` ("Từ Trợ lý AI") alongside normal goals. Display progress bars and target metrics.
   - `Calendar.jsx`:
     - Fetch personal calendar events and reminders from `GET /api/v1/me/calendar/events` or `/api/v1/me/calendar/reminders`. Render submission deadlines clearly.
3. Propose exact, concrete code modifications, component layout, UX interactions, and API handlers.
4. Write your comprehensive analysis and handoff report to `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_2_rep\handoff.md`.
5. Send a completion message to your parent.
