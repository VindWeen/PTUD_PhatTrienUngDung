## 2026-11-12T14:56:15Z

You are the Sub-Orchestrator for Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP).

## Working Context
- Working directory: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`
- Your state folder: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2_r2`
- Parent conversation ID: `99996677-bcd3-49e3-9e61-907083da4981` (Project Orchestrator)
- Scope document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m2_r2\SCOPE.md`
- Master project document: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md`
- Original request file: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md`

## Prior State & Iteration 1 Findings
Milestone 2 was previously in progress and paused during Iteration 1 gate check.
Read the following prior reports:
- Reviewer 1 report: `.agents/teamwork/reviewer_m2_1/handoff.md`
- Reviewer 2 report: `.agents/teamwork/reviewer_m2_2/handoff.md`
- Auditor report: `.agents/teamwork/auditor_m2_1/handoff.md`
- Previous gate status: `.agents/teamwork/sub_orch_m2/GATE_STATUS.md`

Reviewers requested changes on 4 specific findings:
1. `backend/src/modules/achievements/achievementRepository.js`: Lines 474 & 480 have hardcoded `AND status = 'DRAFT'`. Change both `deleteAchievement` and `restoreAchievement` to `AND status IN ('ACTIVE', 'DRAFT')`.
2. `backend/src/modules/achievements/achievementService.js`: Lines 28-30 (`listActiveTypes`) and lines 50-68 (`listAchievements`) must support standard roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` so members can view active types and query their own active achievements.
3. `backend/src/modules/ai/dossierPackagerService.js`: Lines 154-187 (`packageAndStreamDossierZip`) must query both `app.achievements` AND `app.award_records` (with decision files) to synchronize with `autoDiscoveryService.js`. Also, in archive error handling, call `res.end()` if `res.headersSent` is true.
4. `backend/tests/achievement-vault-active.test.js`: Add tests verifying deletion/restoration SQL logic on `ACTIVE` achievements.

## Your Workflow: Iteration 2 Loop
Initialize your `BRIEFING.md` and `progress.md` in your state folder `.agents/teamwork/sub_orch_m2_r2`.
1. Spawn 1 Worker (`teamwork_worker`) to implement the 4 fixes above. Include the mandatory integrity warning. Worker must run the full test suite:
   `node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js`
2. Spawn 2 Reviewers (`teamwork_reviewer`) in parallel to independently verify all changes, correctness, completeness, and role compatibility.
3. Spawn 2 Challengers (`teamwork_challenger`) in parallel to stress-test adversarial edge cases (e.g. deletion of active items, non-admin role access, zip stream error recovery).
4. Spawn 1 Forensic Auditor (`teamwork_auditor`) for integrity verification.
5. Perform Gate check in `GATE_STATUS.md`:
   - All pass -> mark M2 complete, write `handoff.md`, and send message to parent (`99996677-bcd3-49e3-9e61-907083da4981`).
   - Any fail -> loop back with feedback.
