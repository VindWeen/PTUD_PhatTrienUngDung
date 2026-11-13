# Forensic Audit Task Assignment: Forensic Auditor 1 (Integrity Forensics)

## Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

## State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_auditor_1

## Essential References (MUST READ FIRST)
- `ORIGINAL_REQUEST.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- `TEST_INFRA.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md
- `TEST_READY.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_READY.md
- Test Files: `tests/e2e/*.test.js`, `tests/e2e/helpers/*.js`

## Audit Objectives (ZERO TOLERANCE INTEGRITY AUDIT)
Perform systematic integrity forensics on the E2E test suite:
1. Static Analysis:
   - Check for hardcoded test result bypasses (e.g., `assert.ok(true)` without evaluating response).
   - Check for tautological assertions (e.g. `assert.equal(1, 1)`).
   - Check for dummy facade shortcuts where real business logic was bypassed.
   - Verify that test assertions inspect real response structures, status codes, payload fields, and binary byte headers.
2. Runtime Tracing & Execution:
   - Execute the test suites via `node tests/e2e/runner.js` and verify real execution.
   - Verify that all test cases execute genuine calls to helper client and receive structured data.
3. Verdict:
   - If ANY cheating, hardcoded shortcut, or facade is detected: render **INTEGRITY VIOLATION**.
   - If clean, genuine, and compliant with all project requirements: render **CLEAN**.
4. Write `handoff.md` in your state folder and notify caller via `send_message`.


## 2026-11-12T13:42:37Z
You are the Forensic Auditor for Milestone E2E-M5 Gate Verification.

### Essential File Paths (Read Before Starting Work)
- Original Request: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Specification: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- Scope Document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md
- Test Infra Spec: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md
- Test Ready Spec: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_READY.md
- Audit Task Dispatch: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_auditor_1\DISPATCH.md
- Test Files to Audit:
  - `tests/e2e/tier1-feature-coverage.test.js`
  - `tests/e2e/tier2-boundary-corner.test.js`
  - `tests/e2e/tier3-cross-feature.test.js`
  - `tests/e2e/tier4-application-scenarios.test.js`
  - `tests/e2e/smoke.test.js`
  - `tests/e2e/helpers/testClient.js`
  - `tests/e2e/helpers/fixtures.js`
  - `tests/e2e/runner.js`

### State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_auditor_1

### Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

### Objectives (ZERO TOLERANCE INTEGRITY AUDIT)
Perform forensic integrity verification:
1. Static analysis:
   - Search for hardcoded dummy/facade implementations or fake test passes.
   - Verify that test assertions actually test response schemas, status codes, and data values.
   - Check that no tautological tests exist (e.g. `assert.ok(true)`).
2. Runtime analysis:
   - Run the full test suite with `node tests/e2e/runner.js`.
   - Verify that test cases genuinely execute and assert responses.
3. Deliver a strict binary verdict:
   - If any cheating, dummy facades, or hardcoded shortcuts are found: **INTEGRITY VIOLATION**.
   - If clean, genuine, and compliant: **CLEAN**.
4. Write `handoff.md` in your state folder (`.agents/teamwork/teamwork_auditor_1/handoff.md`) with Observation, Evidence, and Verdict. Send completion message via `send_message`.
