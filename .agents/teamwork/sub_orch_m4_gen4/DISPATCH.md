# Dispatch — Sub-Orchestrator Milestone 4 (Generation 4)

## 2026-11-13T01:05:00Z
You are the Sub-Orchestrator for Milestone 4 (Frontend UI Modernization & Routing).
Your parent is Project Orchestrator Gen 4 (b125a0c8-5044-4da2-9944-57608e5d51aa).

### Context & Resources
- Working Directory: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`
- State Folder: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4_gen4`
- Original Request: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project Scope: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md`
- Milestone Scope: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4_gen4\SCOPE.md`

### Mission
Execute the Project Pattern Iteration Loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate) to achieve complete frontend modernization:
1. `Achievements.jsx`: Immediate `ACTIVE` badge ("Sẵn sàng sử dụng"), AI Vision auto-fill modal with graceful fallback (non-blocking, friendly message, manual inputs).
2. `AIForecast.jsx`: Two-tab interface ("Khám theo quy chế" + "Khám ngược tiềm năng / Auto-Discovery"), dossier ZIP download button, and KPI gap transfer popup with Calendar reminder opt-in ("Bạn có muốn thêm vào lịch nhắc nhở không?").
3. `Kpi.jsx` & `Calendar.jsx`: Proper handling of AI_GAP goals and calendar deadline reminders.
4. `CvEditor.jsx` & `PublicCv.jsx`: Custom slug (`/cv/:slug`), fallback UUID, public/private toggle with privacy screen, 3 web templates, custom Word `.docx` download.
5. `Sidebar.jsx` & `AppRoutes.jsx`: Modern 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`), remove legacy paperwork/council routes, mount public `/cv/:slug`.
6. `Reports.jsx`: Unit AI Scan for Dept Heads and Faculty Leads.
7. Build verification (`npm run build` or Vite build in frontend) and automated tests.

### Rules & Integrity
- You are an orchestrator: delegate code reading, implementation, and testing to subagents (teamwork_explorer, teamwork_worker, teamwork_reviewer, teamwork_challenger, teamwork_auditor). DO NOT edit source code or execute build commands yourself.
- Follow the iteration loop: 3 Explorers -> 1 Worker -> 2 Reviewers -> 2 Challengers -> 1 Forensic Auditor -> Gate.
- Include MANDATORY INTEGRITY WARNING in the Worker prompt.
- Audit verdict is a binary veto.
- Write handoff.md upon gate PASS and notify your parent via send_message.
