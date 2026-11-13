# Task Assignment: E2E-M1 Test Infrastructure & Harness Setup

## Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

## State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m1

## Essential References (MUST READ FIRST)
- `ORIGINAL_REQUEST.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- `SCOPE.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md

## Objective
Design and implement the E2E test infrastructure and helper harness for the Smart Achievement Vault & Career Assistant.

### Deliverables
1. `TEST_INFRA.md` at project root (`c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md`) following the exact template in Project Pattern:
   - Test Philosophy (opaque-box, requirement-driven, progressive testability, Category-Partition + BVA + Pairwise + Workload Testing).
   - Feature Inventory mapping table (all 13 features across Tiers 1-4).
   - Test Architecture (Node.js test runner `node --test tests/e2e/*.test.js`, directory layout, pass/fail semantics).
   - Real-World Application Scenarios table (Tier 4 scenarios).
   - Coverage Thresholds (Tier 1: >=5 per feature, Tier 2: >=5 per feature, Tier 3: >=15 pairwise, Tier 4: >=7 scenarios, Total >=152 tests).
2. `tests/e2e/helpers/testClient.js`:
   - Lightweight, dependency-free HTTP client using Node native `fetch`.
   - Supports auth headers / mock tokens for 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
   - Base URL configurable via `process.env.TEST_API_URL || 'http://localhost:5000'`.
   - Helper methods for all 13 features:
     - Vault: create achievement (`POST /api/v1/achievements`), get list, status checks.
     - AI Vision: upload cert image/pdf (`POST /api/v1/achievements/ai-extract`), simulate fallback.
     - AI Evaluator: structured evaluation (`POST /api/v1/ai/evaluations/structured`).
     - AI Auto-Discovery: ranking query (`POST /api/v1/ai/auto-discovery`).
     - Dossier Packager: export zip (`POST /api/v1/ai/export-dossier-zip`).
     - KPI Bridge: transfer gap to KPI (`POST /api/v1/kpi/from-ai-gap`).
     - Calendar: create reminder (`POST /api/v1/me/calendar/reminder`).
     - CV: update slug, toggle public/private, get public CV (`GET /api/v1/public/cv/:slug`), export docx (`GET /api/v1/me/cv/export-docx`).
     - Organization & Roles: get tree (`GET /api/v1/organizations/tree`), unit AI scan (`POST /api/v1/organizations/units/:id/ai-scan`).
   - Clean assertions and error formatters.
   - Graceful offline / test-mode execution support (so test cases can run syntactically and validate payload schemas even if the server is offline or in mock test mode).
3. `tests/e2e/helpers/fixtures.js`:
   - Standard sample achievements, certificate files/buffers, regulation rules, mock vision responses, CV profile data, and org units.
4. `tests/e2e/runner.js` (or script in `package.json` if appropriate):
   - Standalone runner entry point that executes all tier test files and prints structured summary reports.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Handoff Requirements
Write `handoff.md` in your state folder (`c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m1\handoff.md`) with:
- Observation (files created, structure verified)
- Logic Chain (design choices, helper abstractions)
- Caveats & Assumptions
- Conclusion & Verification commands run
- Notify caller via `send_message`.


## 2026-11-12T12:53:57Z
You are assigned to Milestone E2E-M1: Test Infrastructure & Harness Setup.

### Essential File Paths (Read Before Starting Work)
- Original Request: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Specification: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- Scope Document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md
- Dispatch Task File: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m1\DISPATCH.md

### State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m1

### Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

### Objectives & Deliverables
1. Write `TEST_INFRA.md` at project root (`c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md`) following the exact template from Project Pattern:
   - Test Philosophy (opaque-box, requirement-driven, progressive testability, Category-Partition + BVA + Pairwise + Workload Testing).
   - Feature Inventory mapping table (all 13 features from PROJECT.md across Tiers 1-4).
   - Test Architecture (Node.js test runner `node --test tests/e2e/*.test.js`, directory layout, pass/fail semantics).
   - Real-World Application Scenarios (Tier 4 scenarios).
   - Coverage Thresholds (Tier 1: >=5 per feature, Tier 2: >=5 per feature, Tier 3: >=15 pairwise, Tier 4: >=7 scenarios, Total >=152 tests).
2. Create `tests/e2e/helpers/testClient.js`:
   - Lightweight, dependency-free HTTP client using Node native `fetch`.
   - Supports auth headers / mock tokens for 4 roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
   - Configurable Base URL via `process.env.TEST_API_URL || 'http://localhost:5000'`.
   - Methods for all 13 features:
     - Vault: create achievement (`POST /api/v1/achievements`), list, get by id.
     - AI Vision: upload cert image/pdf (`POST /api/v1/achievements/ai-extract`), fallback response handling.
     - AI Evaluator: structured evaluation (`POST /api/v1/ai/evaluations/structured`).
     - AI Auto-Discovery: ranking query (`POST /api/v1/ai/auto-discovery`).
     - Dossier Packager: export zip (`POST /api/v1/ai/export-dossier-zip`).
     - KPI Bridge: transfer gap to KPI (`POST /api/v1/kpi/from-ai-gap`).
     - Calendar: create reminder (`POST /api/v1/me/calendar/reminder`).
     - CV: update slug, toggle public/private, get public CV (`GET /api/v1/public/cv/:slug`), export docx (`GET /api/v1/me/cv/export-docx`).
     - Organization & Roles: get tree (`GET /api/v1/organizations/tree`), unit AI scan (`POST /api/v1/organizations/units/:id/ai-scan`).
   - Graceful offline / test simulation mode (e.g. `TEST_MODE=mock` or fallback when server is not running, so that contract schemas, response structures, and assertion logic can be validated directly).
3. Create `tests/e2e/helpers/fixtures.js`:
   - Sample achievements, mock OCR payloads, regulations data, KPI targets, CV profile inputs, and organization trees.
4. Create `tests/e2e/runner.js`:
   - Standalone runner entry point that executes tier test files and prints structured summary reports.
5. Verify test infrastructure by executing a quick smoke test or lint/syntax check with `run_command`.
