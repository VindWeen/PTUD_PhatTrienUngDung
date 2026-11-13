# Review Task Assignment: Reviewer 2 (Opaque-Box Verification & Robustness)

## Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

## State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_reviewer_2

## Essential References (MUST READ FIRST)
- `ORIGINAL_REQUEST.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- `TEST_INFRA.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md
- `TEST_READY.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_READY.md
- Test Suites:
  - `tests/e2e/tier1-feature-coverage.test.js`
  - `tests/e2e/tier2-boundary-corner.test.js`
  - `tests/e2e/tier3-cross-feature.test.js`
  - `tests/e2e/tier4-application-scenarios.test.js`

## Review Objectives
1. Inspect test implementation to ensure it does not couple to internal database schemas or internal implementation hacks.
2. Verify that negative test cases verify proper HTTP error codes (400, 401, 403, 404, 409, 413) and error responses.
3. Verify binary file validations: ZIP and DOCX buffers must be verified with proper PK magic bytes (`PK\x03\x04`).
4. Execute full test suite and individual tier tests.
5. Render a clear verdict: **APPROVE** or **REQUEST_CHANGES**.
6. Write `handoff.md` in your state folder and notify caller via `send_message`.


## 2026-11-12T13:42:11Z
You are Reviewer 2 for Milestone E2E-M5 Gate Verification.

### Essential File Paths (Read Before Starting Work)
- Original Request: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Specification: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- Scope Document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md
- Test Infra Spec: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md
- Test Ready Spec: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_READY.md
- Review Task Dispatch: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_reviewer_2\DISPATCH.md

### State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_reviewer_2

### Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

### Objectives
1. Inspect the complete E2E test suite in `tests/e2e/`:
   - `tests/e2e/tier1-feature-coverage.test.js`
   - `tests/e2e/tier2-boundary-corner.test.js`
   - `tests/e2e/tier3-cross-feature.test.js`
   - `tests/e2e/tier4-application-scenarios.test.js`
   - `tests/e2e/smoke.test.js`
   - `tests/e2e/helpers/testClient.js`
   - `tests/e2e/helpers/fixtures.js`
   - `tests/e2e/runner.js`
2. Evaluate:
   - Security & RBAC: Verify all 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) are tested with positive and negative access checks.
   - Binary handling: Verify ZIP and DOCX tests validate actual binary buffers (PK magic bytes `0x50 0x4B 0x03 0x04`).
   - Graceful fallback: Verify AI Vision fallback flow does not crash and enables manual input.
   - Progressive testability & layout compliance.
3. Run test verification with `run_command`:
   - `node --test tests/e2e/*.test.js`
   - `npm run test:e2e`
4. Formulate your verdict: **APPROVE** or **REQUEST_CHANGES**.
5. Write `handoff.md` in your state folder (`.agents/teamwork/teamwork_reviewer_2/handoff.md`) with Observation, Logic Chain, Caveats, Conclusion (Verdict), and Verification Method. Send completion message via `send_message`.
