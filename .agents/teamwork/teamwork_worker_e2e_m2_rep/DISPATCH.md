## 2026-11-12T13:17:03Z
You are assigned to Milestone E2E-M2: Tier 1 Feature Coverage Tests (Replacement Worker).

### Essential File Paths (Read Before Starting Work)
- Original Request: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- Project Specification: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- Test Infra Spec: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md
- Scope Document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md
- Dispatch Task File: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m2_rep\DISPATCH.md
- Helper Test Client: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\helpers\testClient.js
- Test Fixtures: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\helpers\fixtures.js
- Smoke Test: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\smoke.test.js

### State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m2_rep

### Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

### Exclusive File Ownership
You exclusively own and write:
`c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\tier1-feature-coverage.test.js`

### Objectives & Deliverables
Implement `tests/e2e/tier1-feature-coverage.test.js` with at least 65 test cases (>=5 test cases per feature for ALL 13 features) exercising nominal happy paths and contract adherence using `node:test`, `node:assert/strict`, and `createTestClient` from `./helpers/testClient.js` with fixtures from `./helpers/fixtures.js`.

The 13 features to cover (>=5 tests each):
1. Personal Achievement Vault (immediate `ACTIVE` status, no approval required, get, list, update)
2. AI Vision Auto-fill (extract title, year, issuer, decision number from cert image/pdf)
3. AI Vision Graceful Fallback (unreadable cert / no API key -> fallback flag, seamless manual input)
4. AI Regulation Gap Analysis (structured evaluation, satisfied criteria with evidence, missing criteria count)
5. AI Auto-Discovery (rank regulations by %, satisfied vs total criteria)
6. Dossier Packaging .ZIP (export zip with standardized names `01_[Title]_[Year].pdf`, valid PK zip header)
7. AI Gap to KPI Roadmap Bridge (missing criteria -> `app.kpi_goals` with `source = 'AI_GAP'`)
8. Calendar Reminder Integration (friendly popup -> deadline in personal calendar events)
9. Public CV with Custom Slug (set slug, access `/cv/:slug`, UUID fallback, public/private toggle)
10. CV Web & Word (.docx) Template Export (3 web templates, export docx with PK docx buffer)
11. 3-Level Organization Hierarchy (tree query: Trường -> Khoa -> Bộ môn)
12. 4 Standard Roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` authorization matrix)
13. Unit AI Scan & Reports (unit-level AI scan for Department Head and Faculty Lead)

### Verification
Run `node --test tests/e2e/tier1-feature-coverage.test.js` and verify that all 65+ tests pass with 0 failures.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Reporting
Write `handoff.md` in your state folder (`.agents/teamwork/teamwork_worker_e2e_m2_rep/handoff.md`) with Observation, Logic Chain, Caveats, Conclusion, and Verification commands/results. Then send a completion message back to the caller using `send_message`.
