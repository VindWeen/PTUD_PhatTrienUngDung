## 2026-11-13T02:57:54Z

You are Worker 2 for Milestone 4 (Iteration 2 Remediation).

Your State Folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m4_2_gen4
Working Directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

Required Reference Reading:
- ORIGINAL_REQUEST.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- PROJECT.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- SCOPE.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4_gen4\SCOPE.md
- GATE_STATUS.md: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m4_gen4\GATE_STATUS.md
- Explorer 1 (Iter 2) Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_1_iter2\handoff.md
- Explorer 2 (Iter 2) Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_2_iter2\handoff.md
- Explorer 3 (Iter 2) Handoff: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\explorer_m4_3_iter2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Apply the 3 exact fixes formulated by the Explorers to achieve a 100% clean gate pass:

1. Fix Runtime Crash in `frontend/src/pages/Achievements.jsx`:
   - Remove lines 176–184 (the stale `if (actionModalOpen && targetAchievement?.achievementId) { ... }` block).
   - Clean up the dependency array at line 188 to:
     `}, [loadData, detailModalOpen, selectedAchievement?.achievementId]);`
   - Verify that no references to `actionModalOpen`, `targetAchievement`, `setActionConflict`, or `setActionError` remain in the file.

2. Fix Zod Schema Mismatch & Empty Guard in `frontend/src/pages/AIForecast.jsx`:
   - In `handleConfirmGapTransfer` (lines 229–265):
     Format payload to strictly conform to backend `fromAiGapSchema`:
     ```javascript
     const cleanMissingCriteria = gapMissingCriteria.map((g) => ({
       code: String(g.code || '').trim(),
       name: String(g.name || g.criterionName || '').trim(),
       missingCount: Math.max(1, parseInt(g.missingCount, 10) || 1),
       unit: String(g.unit || g.measureUnit || 'mục').trim().slice(0, 32),
     }));
     const payload = {
       regulationId: Number(selectedRegulationId),
       missingCriteria: cleanMissingCriteria,
     };
     ```
     Do NOT pass `autoTransfer`, `criterionId`, or `measureUnit` to `kpiApi.createFromAiGap`.
   - Guard against empty missing criteria: if `cleanMissingCriteria.length === 0`, show toast and return early.
   - In the modal JSX (around lines 876–942): disable the submit button when `gapMissingCriteria.length === 0` or when `transferringGap` is true.
   - In `useEffect` at line 96: include `selectedRegulationId` in dependency array to satisfy ESLint.

3. Fix ESLint Errors & Warnings in `frontend/src/pages/Calendar.jsx` and `frontend/src/pages/Reports.jsx`:
   - In `frontend/src/pages/Calendar.jsx:418`: replace `"Khám theo quy chế"` with `&ldquo;Khám theo quy chế&rdquo;` or `&quot;Khám theo quy chế&quot;` to resolve `react/no-unescaped-entities`.
   - In `frontend/src/pages/Reports.jsx:131`: ensure hook dependencies satisfy ESLint.

4. Execute Full Verification:
   - Run `npm --prefix frontend run lint` (MUST exit 0 with 0 errors).
   - Run `npm --prefix frontend test` (MUST pass 19/19 tests).
   - Run `npm --prefix frontend run build` (MUST build cleanly with exit code 0).
   - Run `node --test tests/e2e/smoke.test.js` (MUST pass 17/17 tests).
   - Run `node --test backend/tests/challenger-m4-empirical.test.js` (MUST pass 13/13 tests).

5. Report Results:
   - Write comprehensive progress and handoff report in `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m4_2_gen4\handoff.md`.
   - Send completion message to caller agent.
