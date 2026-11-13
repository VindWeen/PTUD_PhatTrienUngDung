# Scope: E2E Testing Track Orchestrator

## Test Philosophy
- Opaque-box, requirement-driven derived strictly from `ORIGINAL_REQUEST.md` (R1 to R6) and `PROJECT.md`.
- Independent of internal implementation details.
- Progressive testability across Tiers 1-4.
- Published `TEST_INFRA.md` and `TEST_READY.md`.

## Feature Inventory Coverage (Tiers 1 - 4)
| # | Feature | Requirement Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------------|:------:|:------:|:------:|:------:|
| 1 | Personal Achievement Vault (`ACTIVE` status) | R1 | 6 (Done) | 5 (Done) | ✓ | ✓ |
| 2 | AI Vision Auto-fill (Extract cert info) | R1 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 3 | AI Vision Graceful Fallback (manual input) | R1 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 4 | AI Regulation Gap Analysis (passed & missing) | R2 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 5 | AI Auto-Discovery (rank open regulations by %) | R2 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 6 | Dossier Packaging .ZIP (normalized file naming) | R2 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 7 | AI Gap to KPI Roadmap Bridge | R3 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 8 | Calendar Reminder Integration (deadline popup) | R3 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 9 | Public CV with Custom Slug (/cv/:slug) | R4 | 6 (Done) | 5 (Done) | ✓ | ✓ |
| 10 | CV Web & Word (.docx) Template Export | R4 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 11 | 3-Level Org Tree (Trường -> Khoa -> Bộ môn) | R5 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 12 | 4 Standard Roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) | R5 | 5 (Done) | 5 (Done) | ✓ | ✓ |
| 13 | Unit AI Scan & Reports | R5 | 5 (Done) | 5 (Done) | ✓ | ✓ |

## Test Architecture
- Test Runner: Node.js native test runner (`node --test tests/e2e/*.test.js`)
- Test Cases Location: `tests/e2e/`
- Helper utilities: `tests/e2e/helpers/testClient.js`, `tests/e2e/helpers/fixtures.js`
- Published Deliverables:
  - `TEST_INFRA.md` at project root (DONE)
  - `TEST_READY.md` at project root (DONE)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E-M1 | Test Infrastructure & Harness Setup | `TEST_INFRA.md`, `tests/e2e/helpers/testClient.js`, `tests/e2e/helpers/fixtures.js`, `tests/e2e/runner.js`, `tests/e2e/smoke.test.js` | none | DONE |
| E2E-M2 | Tier 1 Feature Coverage Tests | `tests/e2e/tier1-feature-coverage.test.js` (67 tests across 13 features) | E2E-M1 | DONE |
| E2E-M3 | Tier 2 Boundary & Corner Case Tests | `tests/e2e/tier2-boundary-corner.test.js` (65 tests across 13 features) | E2E-M1 | DONE |
| E2E-M4 | Tier 3 & Tier 4 Integration & Scenario Tests | `tests/e2e/tier3-cross-feature.test.js` (15 pairwise tests) & `tests/e2e/tier4-application-scenarios.test.js` (7 scenarios) | E2E-M2, E2E-M3 | DONE |
| E2E-M5 | Final Verification, Gate & Publish TEST_READY.md | Execute test suite discovery/runner, 4-agent Gate review, publish `TEST_READY.md` at project root | E2E-M4 | DONE |
