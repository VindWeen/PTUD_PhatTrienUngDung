# Task Assignment: E2E-M4 Tier 3 Cross-Feature & Tier 4 Real-World Application Scenario Tests

## Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

## State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m4

## Essential References (MUST READ FIRST)
- `ORIGINAL_REQUEST.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- `TEST_INFRA.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md (Check Section 4: Real-World Application Scenarios SC-01 through SC-07)
- `SCOPE.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md
- Helper Test Client: `tests/e2e/helpers/testClient.js`
- Test Fixtures: `tests/e2e/helpers/fixtures.js`
- Existing Tier 1 & 2 tests: `tests/e2e/tier1-feature-coverage.test.js`, `tests/e2e/tier2-boundary-corner.test.js`

## Exclusive File Ownership
You exclusively own and write:
1. `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\tier3-cross-feature.test.js`
2. `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\tier4-application-scenarios.test.js`
Do NOT write to other test files.

## Objective
Implement Milestone E2E-M4 covering:
1. **Tier 3: Cross-Feature Combinations (`tests/e2e/tier3-cross-feature.test.js`)**:
   Implement at least 15 tests covering pairwise feature interactions:
   - Pair 1: AI Vision OCR -> Achievement Vault creation (`ACTIVE` status)
   - Pair 2: AI Vision Fallback -> Manual Vault Entry -> `ACTIVE` status & label
   - Pair 3: Achievement Vault -> AI Structured Gap Evaluation
   - Pair 4: Achievement Vault -> AI Auto-Discovery Ranking (%)
   - Pair 5: Auto-Discovery 100% Match -> Dossier Packaging .ZIP export
   - Pair 6: AI Gap Evaluation (unmet criteria) -> KPI Roadmap Goal Bridge (`source = 'AI_GAP'`)
   - Pair 7: KPI Goal from Gap -> Personal Calendar Deadline Reminder
   - Pair 8: Achievement Vault -> Personal CV Profile inclusion
   - Pair 9: Custom Slug -> Public CV View (`/cv/:slug`)
   - Pair 10: Custom Slug -> Unauthenticated Privacy Screen (`is_public = 0`)
   - Pair 11: Personal CV -> Word (.docx) Custom Template Export
   - Pair 12: 3-Level Organization Hierarchy -> Department Head Unit AI Scan
   - Pair 13: Faculty Lead -> Multi-Department Faculty Unit AI Scan
   - Pair 14: Member Vault -> Department Head Scan Visibility
   - Pair 15: Role Permission Guard: `MEMBER` attempting Unit Scan vs `DEPARTMENT_HEAD` attempting Faculty Scan

2. **Tier 4: Real-World Application Scenarios (`tests/e2e/tier4-application-scenarios.test.js`)**:
   Implement all 7 end-to-end multi-step scenarios defined in `TEST_INFRA.md` Section 4:
   - **SC-01**: New Lecturer Vault Onboarding & AI OCR Auto-Fill (Upload certificate -> AI extract -> review & adjust -> create `ACTIVE` achievement).
   - **SC-02**: 100% Match Auto-Discovery & Instant Dossier ZIP Packaging (Auto-discover 100% feasible awards -> view gap analysis -> export standardized zip dossier `01_[Title]_[Year].pdf`).
   - **SC-03**: Regulation Gap Analysis & AI Gap to KPI Action Plan Bridge (Candidate evaluates against criteria -> identifies missing item -> bridges missing criterion to KPI goal with `source = 'AI_GAP'`).
   - **SC-04**: Deadline Reminder Integration to Personal Calendar (AI gap transfer triggers friendly popup -> user confirms -> deadline event scheduled into personal calendar).
   - **SC-05**: Public Career CV Custom Slug & DOCX Export Flow (Set custom slug -> choose web template -> publish -> guest visits `/cv/:slug` -> export custom docx).
   - **SC-06**: Department & Faculty Lead Unit-wide AI Audit Scan (Department Head scans department members -> Faculty Lead scans whole faculty -> export statistics report).
   - **SC-07**: End-to-End Annual Award Campaign Lifecycle (Comprehensive lifecycle connecting Admin tree verification -> Member achievements & Auto-Discovery -> Gap-to-KPI bridge -> Dossier ZIP export -> Department Head unit evaluation).

## Verification
1. Run `node --test tests/e2e/tier3-cross-feature.test.js` (>=15 tests pass)
2. Run `node --test tests/e2e/tier4-application-scenarios.test.js` (>=7 scenarios pass)
3. Run `node tests/e2e/runner.js` and verify full suite passes 100%.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Handoff Requirements
Write `handoff.md` in your state folder with Observation, Logic Chain, Caveats, Conclusion, and Verification commands/results, then notify caller via `send_message`.
