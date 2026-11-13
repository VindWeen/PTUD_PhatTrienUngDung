## 2026-11-12T15:00:39Z

You are the Implementation Worker for Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP) — Iteration 2 Remediation.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
- Working directory: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`
- Your state folder: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_r2`
- Original request file: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md` (READ THIS FIRST)
- Master project document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md`
- Scope document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2_r2\SCOPE.md`
- Prior Reviewer 1 report: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_1\handoff.md`
- Prior Reviewer 2 report: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_2\handoff.md`
- Prior Auditor report: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\auditor_m2_1\handoff.md`

## Remediation Tasks (Implement the 4 Findings)
1. `backend/src/modules/achievements/achievementRepository.js`:
   - In `deleteAchievement` (around line 474): change `AND status = 'DRAFT'` to `AND status IN ('ACTIVE', 'DRAFT')`.
   - In `restoreAchievement` (around line 480): change `AND status = 'DRAFT'` to `AND status IN ('ACTIVE', 'DRAFT')`.

2. `backend/src/modules/achievements/achievementService.js`:
   - In `listCatalogs` / `listActiveTypes` (around line 28-30): update role check to allow standard roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` in addition to existing roles so that members can load catalog types.
   - In `listAchievements` (around line 50-68): support standard roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` (e.g. `isIndividual = roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r))`), querying their profile via `findLecturerByUserId` to push `a.lecturer_id = ${myLecturerId}` into `orConditions`.
   - In `filters.statuses` (around line 48): update `ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']`.

3. `backend/src/modules/ai/dossierPackagerService.js`:
   - In `packageAndStreamDossierZip` (lines 154-187): synchronize with `autoDiscoveryService.js` (lines 52-87) and `aiService.js` (lines 346-379) by querying BOTH `app.achievements` AND `app.award_records` (including award decision files if present), combining them into the candidate records pool before running criteria evaluation.
   - In archive error handling (around line 267-273): if `res.headersSent` is true, call `res.end()` (and optionally register `res.on('close', () => archive.abort())`) so HTTP connection does not hang.

4. `backend/tests/achievement-vault-active.test.js`:
   - Add unit/integration tests verifying deletion and restoration SQL logic on `ACTIVE` achievements (asserting that `deleteAchievement` and `restoreAchievement` SQL contains `status IN ('ACTIVE', 'DRAFT')` and handles active records).

## Verification Requirements
You MUST run the full backend test suite in `backend/`:
`node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js`
Ensure ALL tests pass with 0 failures.

## Output
Write your comprehensive handoff report to:
`c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_r2\handoff.md`
Report must contain: Observation, Logic Chain, Caveats, Conclusion, Verification Method with test command and stdout.
Notify orchestrator via message when complete.
