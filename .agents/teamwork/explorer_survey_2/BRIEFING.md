# BRIEFING — 2026-11-12T12:47:00Z

## Mission
Investigate the current Express.js backend code in `backend/` to map all architectural and code changes required for the Smart Achievement Vault & Career Assistant refactoring.

## 🔒 My Identity
- Archetype: explorer
- Roles: Backend Survey & Architecture Analysis
- Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
- State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_2
- Original parent: 1e76c276-8bfa-46e8-963a-bb64503095c8
- Milestone: Backend Survey & Architecture Mapping

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect backend/ Express.js codebase, dependencies, modules, tests, architecture
- Write handoff.md with 5 components
- Regular progress updates in progress.md

## Current Parent
- Conversation ID: 1e76c276-8bfa-46e8-963a-bb64503095c8
- Updated: 2026-11-12T12:23:23Z

## Investigation State
- **Explored paths**:
  - `backend/package.json`
  - `backend/src/app.js`, `backend/src/config/env.js`, `backend/src/config/database.js`
  - `backend/src/modules/achievements/*` (`achievementController.js`, `achievementRoutes.js`, `achievementService.js`, `achievementRepository.js`, `achievementPermissions.js`)
  - `backend/src/modules/ai/*` (`criteriaEvaluator.js`, `aiService.js`, `aiRoutes.js`, `aiController.js`, `providers/groqProvider.js`)
  - `backend/src/modules/cv/*` (`cvRoutes.js`, `cvSchemas.js`)
  - `backend/src/modules/kpi/*` (`kpiRoutes.js`, `kpiService.js`, `kpiRepository.js`)
  - `backend/src/modules/calendar/*` (`calendarRoutes.js`, `calendarService.js`)
  - `backend/src/modules/organizations/*` (`organizationRoutes.js`, `organizationService.js`, `organizationRepository.js`)
  - `backend/src/middlewares/*` (`authenticate.js`, `requireRoles.js`, `requireUnitRead.js`, `requireLecturerRead.js`)
  - `backend/tests/*` (`runner.js`, `cv.test.js`, `w4-q1.test.js`, `calendar.test.js`, `w3-p2.test.js`, `w2-p4.test.js`)
- **Key findings**:
  - `docxtemplater`, `pizzip`, and `archiver` are missing from `backend/package.json`.
  - Achievements are currently created as `DRAFT` (line 398 in `achievementRepository.js`); editing requires `DRAFT`/`NEED_CORRECTION`; numerous administrative approval routes exist.
  - `criteriaEvaluator.js` line 162 strictly requires `record.status` to be in `['VERIFIED', 'RECORDED']`, rejecting `ACTIVE`. It also does not expose matched achievement records in criterion results.
  - `cvRoutes.js` embeds all CV logic directly without a `cvService.js`, hardcodes `status='VERIFIED'`, has no slug routing, no docx export, and only supports `['classic', 'modern']`.
  - `kpiRoutes.js` lacks `POST /kpi/from-ai-gap` and `kpiService.js` lacks roadmap generation from gap analysis.
  - Organization roles in `seed.sql` and `app.roles` contain 6 old roles; must migrate to 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
- **Unexplored areas**: Frontend integration details (delegated to explorer 3).

## Key Decisions Made
- Use native Node 18+ `fetch` for AI Vision calls (Groq / Gemini) to avoid heavy extra SDK dependencies.
- Encapsulate CV logic into a dedicated `cvService.js` with `docxtemplater` + `pizzip` export.
- Standardize ZIP packaging inside `dossierPackagerService.js` with normalized file naming `01_[TenMinhChung]_[Nam].pdf`.
- Structure handoff.md following the 5-component protocol with explicit code snippets, endpoints, error handlings, and test specifications.

## Artifact Index
- `.agents/teamwork/explorer_survey_2/DISPATCH.md` — Incoming dispatch log
- `.agents/teamwork/explorer_survey_2/BRIEFING.md` — Persistent memory
- `.agents/teamwork/explorer_survey_2/progress.md` — Heartbeat
- `.agents/teamwork/explorer_survey_2/handoff.md` — Comprehensive survey report
