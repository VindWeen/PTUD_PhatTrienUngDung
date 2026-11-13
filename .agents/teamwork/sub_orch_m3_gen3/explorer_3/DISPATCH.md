## 2026-11-12T17:44:00Z
You are teamwork_explorer_m3_3 (Explorer 3 for Milestone 3: Unit AI Scan, Org Hierarchy & Test Infra).

Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_3
Original request path: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
Scope document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\SCOPE.md
Project plan: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md

MANDATORY INSTRUCTIONS:
1. First, read ORIGINAL_REQUEST.md, SCOPE.md, and PROJECT.md to understand the exact requirements.
2. Initialize your BRIEFING.md and progress.md in your state folder.
3. Investigate the current state of:
   - `backend/src/modules/organizations/` (`organizationRoutes.js`, `organizationService.js`, `organizationRepository.js`, etc.)
   - How `POST /api/v1/organizations/units/:id/ai-scan` is implemented or planned. Check how it scans unit members against regulations using `criteriaEvaluator` (from `backend/src/modules/ai/criteriaEvaluator.js`).
   - Role authorization: `DEPARTMENT_HEAD` (can scan their unit/department members), `FACULTY_LEAD` (can scan all faculty departments/members), `ADMIN` (can scan any unit). Check how unit hierarchy is traversed (Trường -> Khoa -> Bộ môn -> Thành viên).
   - `backend/tests/`: examine existing test setup, test framework (Vitest/Jest/Node runner), mock database patterns, helper functions, and any existing test suites for modules (achievements, ai, kpi, cv, calendar, organizations).
   - What package scripts exist in `backend/package.json` for running tests.
4. Check what `worker_m3` wrote or left partially implemented. Identify:
   - What endpoints are implemented and working.
   - What endpoints are missing or incomplete.
   - What test coverage is needed for Milestone 3 (KPI bridge, Calendar reminders, CV slug & docx, Unit AI Scan).
5. Document all findings, file paths, code snippets, and a clear implementation and test plan in `handoff.md` in your state folder.
6. When complete, send a message to caller with a summary and the path to your handoff.md.
