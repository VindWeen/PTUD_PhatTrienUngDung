## 2026-11-12T13:45:00Z
You are the Backend Worker for Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP).

Working Directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State Folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mandatory Files to Read Before Doing Any Work:
1. ORIGINAL_REQUEST.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
2. SCOPE.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2\SCOPE.md
3. PROJECT.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
4. Backend Survey Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_survey_2\handoff.md

Your Responsibilities:
1. Dependencies:
   In `backend/`, install: `npm install docxtemplater pizzip archiver`.
   Verify ESM compatibility with a quick check (e.g. `node -e "import('docxtemplater'); import('pizzip'); import('archiver'); console.log('OK');"`).

2. Refactor `backend/src/modules/achievements`:
   - `achievementRepository.js`:
     When creating achievements, set status immediately to `'ACTIVE'`.
   - `achievementPermissions.js`:
     Update permissions so owners can view, edit, and delete their achievements with status `'ACTIVE'`.
   - `achievementAiIngestService.js` (NEW):
     Implement AI Vision extraction service:
     Extract certificate title, recognitionYear, issueDate, issuer, decisionNumber from image/PDF buffer via Groq Vision or Google AI Studio (Gemini) API.
     CRITICAL: Implement robust error handling and fallback. If no API key is configured or AI call fails/times out, return `{ success: true, data: null, fallback: true, message: '...' }` with HTTP 200 without throwing errors, ensuring smooth manual input.
   - `achievementRoutes.js`:
     Add route `POST /achievements/ai-extract` (using multer upload for file) invoking `achievementAiIngestService`.
     Clean up or decommission obsolete administrative approval routes (`submit`, `verify`, `request-correction`, `reject`, `cancel`, `revoke`, etc.).

3. Refactor `backend/src/modules/ai`:
   - `criteriaEvaluator.js` & `aiService.js`:
     Support and accept status `IN ('ACTIVE', 'VERIFIED', 'RECORDED')`.
     In `evaluateStructuredCriterion`, compute and return `matchedRecords` (array of matching achievements and their evidence files) and `missingCount` (number of missing achievements/records to satisfy criterion).
   - `autoDiscoveryService.js` (NEW):
     Implement Auto-Discovery (Khám Ngược):
     Scan all open regulation document versions (`is_confirmed = 1`), evaluate active achievements against their criteria, compute completion percentage (`(satisfiedCount / totalCount) * 100`), and rank regulations/awards descending by percentage.
   - `dossierPackagerService.js` (NEW):
     Gather matched evidence files from satisfied criteria for a regulation, create ZIP stream with `archiver`, standardize filenames as `01_[TenMinhChung]_[Nam].pdf` (sanitized ASCII/Unicode safe), and stream directly to HTTP response (`Content-Type: application/zip`, `Content-Disposition: attachment; filename=...`).
   - `aiRoutes.js`:
     Expose `POST /ai/auto-discovery` and `POST /ai/export-dossier-zip`.

4. Test Suite Creation and Verification:
   Create comprehensive automated tests in `backend/tests/`:
   - `achievement-vault-active.test.js`
   - `ai-criteria-active.test.js`
   - `ai-auto-discovery.test.js`
   - `dossier-packager-zip.test.js`
   Run all these new tests AND existing tests (`cv.test.js`, `calendar.test.js`, `w4-q1.test.js`, `w3-p2.test.js`) to verify 0 regressions.

5. Handoff:
   Document all your findings, changes, test results, commands executed, and verification output in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_1\handoff.md`.
   Then notify me via send_message.
