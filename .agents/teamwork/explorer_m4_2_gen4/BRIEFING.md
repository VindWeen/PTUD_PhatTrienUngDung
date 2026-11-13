# BRIEFING — 2026-11-13T01:32:00Z

## Mission
Investigate and analyze frontend implementation requirements for AIForecast.jsx, Kpi.jsx, Calendar.jsx, and related API services for Milestone 4 (AI Forecast 2 tabs, Dossier ZIP export, AI Gap to KPI Roadmap transfer & Calendar reminder integration).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
- State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_2_gen4
- Original parent: 90556efc-f4ca-417f-a5c8-f22148a2d853
- Milestone: Milestone 4 (Frontend UI Modernization & Routing)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect frontend pages: AIForecast.jsx, Kpi.jsx, Calendar.jsx, and API services
- Analyze requirements for 2-tab AI Forecast, Dossier ZIP export, AI Gap to KPI Roadmap transfer with Calendar reminder, KPI badge for AI_GAP, and Calendar event display

## Current Parent
- Conversation ID: 90556efc-f4ca-417f-a5c8-f22148a2d853
- Updated: 2026-11-13T01:32:00Z

## Investigation State
- **Explored paths**:
  - `frontend/src/pages/AIForecast.jsx`
  - `frontend/src/components/ai/EvaluationResults.jsx`
  - `frontend/src/services/aiEvaluationApi.js`
  - `frontend/src/pages/Kpi.jsx`
  - `frontend/src/services/kpiApi.js`
  - `frontend/src/services/kpiPresentation.js`
  - `frontend/src/components/calendar/PersonalCalendar.jsx`
  - `frontend/src/components/calendar/calendarModel.js`
  - `frontend/src/services/calendarApi.js`
  - `frontend/src/routes/AppRoutes.jsx`
  - `frontend/src/components/common/Sidebar.jsx`
  - `backend/src/modules/ai/aiRoutes.js`, `aiController.js`, `autoDiscoveryService.js`, `dossierPackagerService.js`, `aiService.js`
  - `backend/src/modules/kpi/kpiRoutes.js`, `kpiService.js`, `kpiSchemas.js`
  - `backend/src/modules/calendar/calendarRoutes.js`, `calendarService.js`
  - `database/sqlserver/migrations/005_refactor_personal_vault_and_cv.sql`
- **Key findings**:
  1. `AIForecast.jsx`: Currently only has legacy form with SubjectType (Lecturer/Unit), provider, and raw criteriaVersionId checkboxes. Lacks regulation dropdown, Auto-Discovery tab, ZIP export button, and Gap-to-KPI transfer modal.
  2. Missing client API methods:
     - `aiEvaluationApi`: needs `autoDiscovery()` and `exportDossierZip()`
     - `kpiApi`: needs `createFromAiGap()`
     - `calendarApi`: needs `createReminder()` and `listReminders()`
  3. `Kpi.jsx`: Only displays labels for MANUAL, AI, EXTERNAL, CSV. Lacks badge and label for `AI_GAP` / `AI_GAP_ANALYSIS` (falls back to generic 'Nguồn bổ sung').
  4. `Calendar.jsx`: There is currently NO `frontend/src/pages/Calendar.jsx`. Calendar only exists as a dialog/card component (`PersonalCalendar.jsx`). A dedicated `Calendar.jsx` page is required under `frontend/src/pages/Calendar.jsx` and routed at `/me/calendar` (and `/calendar`) in `AppRoutes.jsx` to display calendar events and deadline reminders created from AI gaps (`calendarApi.listReminders()`).
  5. Current frontend builds cleanly (`npm --prefix frontend run build` exit code 0).
- **Unexplored areas**: None for this milestone phase.

## Key Decisions Made
- Outlined complete specifications and code diffs for Worker to implement cleanly.

## Artifact Index
- DISPATCH.md — incoming task dispatch
- BRIEFING.md — working memory
- progress.md — liveness heartbeat
- analysis.md — comprehensive technical analysis and code recipes
- handoff.md — 5-component handoff report
