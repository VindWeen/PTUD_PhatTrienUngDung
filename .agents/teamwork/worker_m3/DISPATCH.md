## 2026-11-12T16:06:15Z
You are the Backend Worker for Milestone 3: Backend Extended Modules (KPI, CV, Calendar & Unit AI Scan).

## State and Working Directory
- Working directory: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`
- Your state folder: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m3`
- Scope document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3\SCOPE.md`
- Master project document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md`
- Original request file: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Milestone 3 Requirements to Implement & Verify:
1. **KPI Bridge (`POST /api/v1/kpi/from-ai-gap`)**:
   - Location: `backend/src/modules/kpi/`
   - Accepts body: `{ regulationId, missingCriteria: [ { code, name, missingCount, unit } ] }`
   - Requires authenticated user (`req.user.id`).
   - Inserts into `app.kpi_goals` with `source = 'AI_GAP'`, `source_note` documenting regulationId/name and criteria details.
   - Goals should have appropriate target numbers, metrics, and start/end dates.

2. **Calendar Reminder Integration (`POST /api/v1/me/calendar/reminder`)**:
   - Location: `backend/src/modules/calendar/`
   - Accepts body: `{ title, deadlineDate, regulationId }`
   - Requires authenticated user.
   - Inserts into `app.calendar_reminders` and `app.personal_calendar_events`.
   - Returns created reminder/event with confirmation.

3. **CV Profiles, Custom Slug & DOCX Export (`cvService.js`, `cvRoutes.js`)**:
   - Location: `backend/src/modules/cv/`
   - Public route `GET /api/v1/public/cv/:slug`:
     * Unauthenticated public access.
     * Looks up user profile by `slug` in `app.cv_profiles` (or falls back to `user_id` / `uuid`).
     * When `is_public = 0`: returns `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }`.
     * When `is_public = 1`: returns `{ isPublic: true, profile: { ... }, templateId: 'Academic'|'Modern'|'Minimalist', achievements: [...] }` containing user profile, selected active achievements.
   - Profile update: `PUT /api/v1/me/cv/profile`:
     * Authenticated user updates slug, `is_public` toggle (0/1), template choice, summary/bio, and selected achievement IDs.
   - Word template export: `GET /api/v1/me/cv/export-docx`:
     * Authenticated user exports their CV as `.docx`.
     * Renders Word template using `docxtemplater` + `pizzip` (installed in node_modules).
     * If no custom template uploaded, uses a bundled default docx template (create a default valid `.docx` template in `backend/src/templates/default_cv.docx` or generate via pizzip/docxtemplater) replacing placeholders `{fullName}`, `{email}`, `{phone}`, `{department}`, loop `{achievements}` with `{title}`, `{year}`, `{issuer}`.
     * Returns binary stream `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

4. **Unit AI Scan (`POST /api/v1/organizations/units/:id/ai-scan`)**:
   - Location: `backend/src/modules/organizations/` (and integrates with `criteriaEvaluator` in `ai/`).
   - Accepts body: `{ regulationId }`.
   - Role authorization:
     * `DEPARTMENT_HEAD`: can scan members of their department (`unitId`).
     * `FACULTY_LEAD`: can scan members of any department belonging to their faculty.
     * `ADMIN`: can scan any unit.
     * Other roles (`MEMBER`): returns 403 Forbidden.
   - Evaluates each unit member against the regulation using `evaluateCriteria` from `criteriaEvaluator.js`.
   - Returns `{ unitId, regulationId, totalMembers, eligibleCount, results: [ { userId, fullName, percentage, isEligible, matched: [...], missing: [...] } ] }`.

5. **Automated Unit & Integration Test Suites**:
   - Create or update comprehensive automated tests in `backend/tests/` (e.g. `kpiAiGap.test.js`, `calendarReminder.test.js`, `cv.test.js`, `unitAiScan.test.js`).
   - Run tests using the project's test runner (e.g. `npm test` or `node backend/tests/...`).
   - Verify 100% of the new tests pass and no regression occurs in existing tests.

## Deliverables:
- Implement all services, routes, repositories, and templates cleanly.
- Ensure express app registers routes under `/api/v1`.
- Update `progress.md` in `.agents/teamwork/worker_m3/progress.md` regularly.
- When finished, write your comprehensive report to `.agents/teamwork/worker_m3/handoff.md` and send a message back with your summary and test command results.


## 2026-11-12T16:32:14Z
**Context**: Milestone 3 implementation progress check.
**Content**: Checking on current progress of M3 tasks (KPI bridge, Calendar reminder, CV profile/docx, Unit AI scan, and tests).
**Action**: Please update your progress.md with your latest status and estimated next steps.
