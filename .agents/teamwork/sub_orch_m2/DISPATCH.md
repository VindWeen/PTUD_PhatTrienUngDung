## 2026-11-12T13:42:46Z
You are the Sub-Orchestrator for Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP).

**Working Directory**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
**State Folder**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2
**Scope Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2\SCOPE.md
**Original Request Path**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
**Project Document**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
**Backend Survey Handoff**: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_2\handoff.md
**Parent Conversation ID**: 1e76c276-8bfa-46e8-963a-bb64503095c8

### Responsibilities
1. Install backend dependencies: `npm install docxtemplater pizzip archiver` in `backend/` and verify ESM imports.
2. Refactor `backend/src/modules/achievements`:
   - `achievementRepository.js`: Create achievements with immediate status `'ACTIVE'`.
   - `achievementPermissions.js`: Allow owners to edit, delete, and view their `ACTIVE` achievements.
   - `achievementAiIngestService.js` (NEW): Implement AI Vision extraction using Groq / Google AI Studio API. Include robust error handling and fallback: if no API key or AI call fails, return `{ success: true, data: null, fallback: true, message: '...' }` with HTTP 200 without throwing errors, ensuring smooth manual input.
   - `achievementRoutes.js`: Add `POST /achievements/ai-extract`. Clean up / decommission obsolete approval routes.
3. Refactor `backend/src/modules/ai`:
   - `criteriaEvaluator.js` & `aiService.js`: Accept `status IN ('ACTIVE', 'VERIFIED', 'RECORDED')`. In `evaluateStructuredCriterion`, return `matchedRecords` (array of matching achievements and evidence files) and `missingCount` (number).
   - `autoDiscoveryService.js` (NEW): Scan all open regulations (`is_confirmed = 1`), evaluate active achievements, compute completion percentage, rank awards descending.
   - `dossierPackagerService.js` (NEW): Gather matched evidence files, create ZIP stream with `archiver`, standardize filenames as `01_[TenMinhChung]_[Nam].pdf`, stream directly to HTTP response.
   - `aiRoutes.js`: Expose `POST /ai/auto-discovery` and `POST /ai/export-dossier-zip`.
4. Create and run backend unit/integration tests in `backend/tests/`:
   - `achievement-vault-active.test.js`
   - `ai-criteria-active.test.js`
   - `ai-auto-discovery.test.js`
   - `dossier-packager-zip.test.js`
   Ensure existing tests continue to pass without regressions.

### Orchestrator Procedure (Iteration Loop 2B)
- Spawn Worker (`teamwork_worker`) to implement the changes and tests. Include the MANDATORY INTEGRITY WARNING in the worker dispatch.
- Spawn Reviewers (`teamwork_reviewer`) to verify correctness, API contracts, and error handling.
- Spawn Challengers (`teamwork_challenger`) to stress-test fallback modes, ZIP streaming, and criteria evaluation.
- Spawn Forensic Auditor (`teamwork_auditor`) to verify implementation authenticity.
- Evaluate the Gate in `GATE_STATUS.md`. On PASS, update `SCOPE.md`, deliver `handoff.md`, and notify parent.


## 2026-11-12T14:47:42Z
**Context**: User requested pause ("dừng teamwork tí đi")
**Content**: Please pause your current iteration loop immediately. Keep all current code and database changes intact without spawning new workers.
**Action**: Transition to PAUSED state and standby.
