## 2026-11-12T12:23:23Z
You are an Explorer focusing on the Backend Layer survey for the system refactoring.

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_2
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Reference Plan**: C:\Users\fw622\.gemini\antigravity\brain\f2ea0eeb-5109-4a80-b550-ac96bd3759fc\refactor_plan_achievement_vault_ai_assistant.md

### Objective
Investigate the current backend code in `backend/` (Express.js, modules, services, routes, middleware, dependencies, tests) to map all required changes for the Smart Achievement Vault & Career Assistant.

### Tasks
1. Read `ORIGINAL_REQUEST.md` and the reference plan.
2. Inspect `backend/package.json` for installed packages vs missing packages (`docxtemplater`, `pizzip`, `archiver`, AI SDKs or vision APIs).
3. Investigate the modules:
   - `backend/src/modules/achievements`: creation workflow (setting `ACTIVE`), removal of approval steps, new AI vision extraction endpoint `POST /achievements/ai-extract` (file upload, Groq / Google AI Studio / Gemini fallback, manual error handling without breaking user flow).
   - `backend/src/modules/ai`: `criteriaEvaluator.js` (evaluating against `ACTIVE` achievements, detailed criteria breakdown), `autoDiscoveryService.js` (`POST /ai/auto-discovery`), `dossierPackagerService.js` (ZIP packager with `archiver` and normalized naming `01_[TenMinhChung]_[Nam].pdf`).
   - `backend/src/modules/kpi`: `kpiService.js` (create roadmap goals directly from missing criteria in AI gap analysis).
   - `backend/src/modules/cv`: `cvService.js` (public CV by slug with fallback UUID/ID, `is_public` toggle, web template data, custom docx template export using `docxtemplater` + `pizzip`).
   - `backend/src/modules/calendar`: reminder integration for submission deadlines.
   - `backend/src/modules/organizations` & auth middleware: 4 simplified roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`), department/faculty reporting and scanning.
4. Review existing backend test setup (`npm test`, vitest/jest/node test runner, test files).
5. Document exact required service functions, endpoints, error handling, and test requirements.

### Constraints & Output
- READ-ONLY: DO NOT modify any code.
- Regularly update `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_2\progress.md`.
- Produce a thorough, structured survey report at `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_2\handoff.md`.
- Send a completion message back to the orchestrator when finished.
