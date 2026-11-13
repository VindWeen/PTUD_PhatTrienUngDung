## 2026-11-12T21:06:33Z
You are teamwork_challenger_1 (Challenger 1 for Milestone 3: Adversarial Verification of KPI, Calendar & Unit AI Scan RBAC).

Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_1
Original request path: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
Scope document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\SCOPE.md
Project plan: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
Worker handoff report: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\worker_1\handoff.md

INSTRUCTIONS:
1. Initialize your BRIEFING.md and progress.md in your state folder.
2. Read ORIGINAL_REQUEST.md, SCOPE.md, PROJECT.md, and worker_1/handoff.md.
3. Perform empirical adversarial stress testing on:
   - `POST /api/v1/kpi/from-ai-gap`:
     - Test edge cases: negative `missingCount`, inverted date ranges, non-existent regulation ID, empty criteria array, malformed inputs.
     - Test duplicate goal logic: verify that duplicate codes in the same period update target and log correctly without violating unique DB constraints.
     - Verify role support for `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`.
   - `POST /api/v1/me/calendar/reminder`:
     - Test edge cases: blank titles, invalid or impossible dates, year bounds (1990-2100).
     - Test database persistence: verify both `app.personal_calendar_events` (`category = 'task'`) and `app.calendar_reminders` are written atomically.
   - `POST /api/v1/organizations/units/:id/ai-scan`:
     - Test RBAC boundaries rigorously:
       - `MEMBER` MUST be rejected with 403 Forbidden.
       - `DEPARTMENT_HEAD` attempting to scan another department MUST be rejected with 403 Forbidden.
       - `FACULTY_LEAD` scanning a department outside their faculty MUST be rejected with 403 Forbidden.
       - `FACULTY_LEAD` scanning a department inside their faculty MUST succeed.
       - `ADMIN` scanning any unit MUST succeed.
4. Execute empirical tests (e.g. write temporary stress scripts or run test runners) and document exact commands and results.
5. Record your findings and explicit verdict (**APPROVE** or **REQUEST_CHANGES**) in `handoff.md` in your state folder.
6. Send a message to caller with your verdict and the path to your handoff.md.
