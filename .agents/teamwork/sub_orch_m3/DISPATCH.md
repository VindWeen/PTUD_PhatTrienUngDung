# Sub-Orchestrator M3 Dispatch History

## 2026-11-12T15:58:57Z

You are the Sub-Orchestrator for Milestone 3: Backend Extended Modules (KPI, CV, Calendar & Unit AI Scan).

## Working Context
- Working directory: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`
- Your state folder: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3`
- Parent conversation ID: `99996677-bcd3-49e3-9e61-907083da4981` (Project Orchestrator)
- Scope document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3\SCOPE.md`
- Master project document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md`
- Original request file: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md`

## Milestone 3 Functional Scope
1. **KPI Bridge (`POST /api/v1/kpi/from-ai-gap`)**:
   - Accepts `{ regulationId, missingCriteria: [ { code, name, missingCount, unit } ] }`.
   - Creates personal KPI goals in `app.kpi_goals` with `source = 'AI_GAP'`, `source_note` documenting the regulation and criteria.
2. **Calendar Reminder Integration (`POST /api/v1/me/calendar/reminder`)**:
   - Accepts `{ title, deadlineDate, regulationId }`.
   - Inserts into `app.calendar_reminders` and `app.personal_calendar_events` for the user.
3. **CV Profiles, Custom Slug & DOCX Export (`cvService.js`, `cvRoutes.js`)**:
   - Public route `GET /api/v1/public/cv/:slug`: unauthenticated access with UUID/user_id fallback.
     * When `is_public = 0`: returns `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }`.
     * When `is_public = 1`: returns full CV profile, selected active achievements, and template ID (Academic, Modern, Minimalist).
   - Profile update: `PUT /api/v1/me/cv/profile` to update slug, public toggle, template choice, and selected achievements.
   - Word template export: `GET /api/v1/me/cv/export-docx` rendering template with `docxtemplater` + `pizzip`.
4. **Unit AI Scan (`POST /api/v1/organizations/units/:id/ai-scan`)**:
   - Authorized roles: `DEPARTMENT_HEAD` (department members), `FACULTY_LEAD` (faculty members across departments), and `ADMIN`.
   - Scans unit personnel against the specified regulation using criteria evaluator and returns eligible candidates with match %.
5. **Automated Test Suites**:
   - Create comprehensive unit/integration tests for KPI AI Gap, Calendar reminder, CV public slug & DOCX export, and Unit AI Scan.
   - Verify all tests pass alongside existing regression suites.

## Iteration Loop Protocol
1. Initialize `BRIEFING.md`, `progress.md`, and `DISPATCH.md` in `.agents/teamwork/sub_orch_m3`.
2. Spawn Worker (`teamwork_worker`) to implement the services, routes, and tests. Include the mandatory integrity warning.
3. Spawn 2 Reviewers (`teamwork_reviewer`) in parallel to independently verify correctness, role permissions, and interface contracts.
4. Spawn 2 Challengers (`teamwork_challenger`) in parallel to empirically test edge cases (public/private CV access, unauthorized unit scan, invalid slugs, malformed docx template).
5. Spawn 1 Forensic Auditor (`teamwork_auditor`) for integrity verification.
6. Gate check in `GATE_STATUS.md`: All pass -> mark M3 complete, write `handoff.md`, and notify parent (`99996677-bcd3-49e3-9e61-907083da4981`).
