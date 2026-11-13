# BRIEFING — 2026-11-12T16:07:00Z

## Mission
Implement backend extended modules for Milestone 3: KPI Bridge (`/api/v1/kpi/from-ai-gap`), Calendar Reminder (`/api/v1/me/calendar/reminder`), CV Profiles & Docx Export (`/api/v1/public/cv/:slug`, `/api/v1/me/cv/profile`, `/api/v1/me/cv/export-docx`), and Unit AI Scan (`/api/v1/organizations/units/:id/ai-scan`), with complete unit & integration tests.

## 🔒 My Identity
- Archetype: Backend Implementer & QA
- Roles: implementer, qa
- Working directory: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`
- State folder: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m3`
- Original parent: `995f7eee-8b29-450e-b470-323ba9a80d7a`
- Milestone: Milestone 3 - Backend Extended Modules

## 🔒 Key Constraints
- Genuine implementation only, no cheating or facades.
- Strict authorization (DEPARTMENT_HEAD / FACULTY_LEAD / ADMIN for Unit AI Scan, authenticated user for personal routes).
- Public CV route must handle `is_public = 0` vs `1` properly.
- Word template export using `docxtemplater` + `pizzip`.
- All tests must pass with zero regression.

## Current Parent
- Conversation ID: `995f7eee-8b29-450e-b470-323ba9a80d7a`
- Updated: 2026-11-12T16:07:00Z

## Task Summary
- **What to build**:
  1. KPI Bridge (`POST /api/v1/kpi/from-ai-gap`)
  2. Calendar Reminder Integration (`POST /api/v1/me/calendar/reminder`)
  3. CV Profiles, Custom Slug & DOCX Export (`cvRoutes.js`, `cvService.js`, `default_cv.docx`)
  4. Unit AI Scan (`POST /api/v1/organizations/units/:id/ai-scan`)
  5. Comprehensive automated tests
- **Success criteria**:
  - All 4 endpoint groups working and verified with tests.
  - Test suites pass 100%.
- **Interface contracts**: `.agents/teamwork/sub_orch_m3/SCOPE.md`, `PROJECT.md`
- **Code layout**: `backend/src/`

## Key Decisions Made
- [Initial turn] Beginning investigation of existing codebase structure, db schema, routes, and tests.

## Artifact Index
- `.agents/teamwork/worker_m3/DISPATCH.md` — Assigned requirements
- `.agents/teamwork/worker_m3/BRIEFING.md` — Working memory and state
- `.agents/teamwork/worker_m3/progress.md` — Heartbeat and progress tracker

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending initial test run
- **Lint status**: Clean
- **Tests added/modified**: Pending
