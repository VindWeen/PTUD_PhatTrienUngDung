## 2026-11-12T14:37:17Z
You are the Backend Remediation Worker (worker_m2_2) for Milestone 2: Backend Core Modules (Iteration 2).

Working Directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State Folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mandatory Files to Read Before Doing Any Work:
1. ORIGINAL_REQUEST.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
2. SCOPE.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2\SCOPE.md
3. Reviewer 1 Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_1\handoff.md
4. Reviewer 2 Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_2\handoff.md
5. Auditor Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\auditor_m2_1\handoff.md

Your Remediation Tasks:
1. `backend/src/modules/achievements/achievementRepository.js`:
   - Line 474 (`deleteAchievement`): Change `status = 'DRAFT'` to `status IN ('ACTIVE', 'DRAFT')`.
   - Line 480 (`restoreAchievement`): Change `status = 'DRAFT'` to `status IN ('ACTIVE', 'DRAFT')`.
   - Line 341 (`listAchievements` order by): Include `WHEN 'ACTIVE' THEN 1` so active achievements are prioritized properly.

2. `backend/src/modules/achievements/achievementService.js`:
   - Line 29 (`listCatalogs` / `listActiveTypes`): Include `'MEMBER'`, `'DEPARTMENT_HEAD'`, `'FACULTY_LEAD'` in the allowed roles array so users with standard roles can load catalogs.
   - Line 48 (`workflow: 'ACTIONABLE'`): Include `'ACTIVE'` (e.g. `['ACTIVE', 'DRAFT', 'NEED_CORRECTION']`) to resolve regression in `tests/achievement-trash.integration.js`.
   - Lines 54-68 (`listAchievements`): Expand user filter to check `roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r))` so users with standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`) see their own achievements in their vault.

3. `backend/src/modules/ai/autoDiscoveryService.js` and `backend/src/modules/ai/dossierPackagerService.js`:
   - Anti-IDOR Authorization: If `options.subjectId` is provided, verify that the caller is authorized (e.g., caller is ADMIN or caller's own lecturerId matches subjectId). Do NOT allow arbitrary subjectId access for regular members. Do not fallback blindly to `user.userId` if lecturer record is missing.
   - In `dossierPackagerService.js`: Query `app.award_records` (similar to `autoDiscoveryService.js:52-87`) and merge into records so that regulations satisfied by award records also have their evidence packaged into the ZIP.
   - In `dossierPackagerService.js`: In `archive.on('error')`, if `res.headersSent`, call `res.end()` or `res.destroy(err)`. Listen for `res.on('close', () => archive.abort())` for clean resource cleanup.
   - In `dossierPackagerService.js`: In filename sanitization, if `sanitizeFileName(title)` is empty, fallback to `'MinhChung'`.
   - Add export aliases: `export const createDossierZipStream = packageAndStreamDossierZip;` and `export const discoverAwards = discoverEligibleRegulations;`.

4. Test Verification:
   - In `backend/tests/achievement-vault-active.test.js`: Add test for deleting and restoring an `ACTIVE` achievement via repository/service.
   - Run:
     `node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/achievement-trash.integration.js tests/adversarial-vault-permissions.test.js tests/adversarial-ai-evaluator.test.js tests/challenger-m2-adversarial.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js`
   - Ensure ALL tests pass with 0 failures and 0 regressions.

5. Handoff:
   Document all changes, test commands, and verification output in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_2\handoff.md`.
   Then notify me via send_message.
