# Milestone 3 Handoff Report: Backend Extended Modules (KPI, CV, Calendar & Unit AI Scan)

**Milestone**: Milestone 3 — Backend Extended Modules  
**Sub-Orchestrator**: `sub_orch_m3_gen3` (Conversation ID: `c4f8ee2a-a6b8-4150-930d-200ed34209c4`)  
**Parent Orchestrator**: `a9740918-618d-4d46-a8ca-37e2348abdd9` (Project Orchestrator Gen 3)  
**Date**: 2026-11-13T06:48:00Z  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3`  
**Gate Result**: **PASS** (Unanimous APPROVE from both Reviewers, both Challengers, and CLEAN verdict from Forensic Auditor)

---

## 1. Observation

Milestone 3 covers four core functional capabilities and an automated testing suite:
1. **KPI Bridge (`POST /api/v1/kpi/from-ai-gap`)**: Converts AI gap analysis missing criteria into personal roadmap KPI goals with target metrics inserted into `app.kpi_goals` (`source = 'AI_GAP'`).
2. **Calendar Reminder Integration (`POST /api/v1/me/calendar/reminder`)**: Atomically schedules submission deadlines directly into personal calendar events and reminder triggers.
3. **Public CV Profiles, Custom Slug & DOCX Export (`GET /api/v1/public/cv/:slug`, `GET /api/v1/me/cv/export-docx`, `PUT /api/v1/me/cv/profile`)**: Public CV viewing with custom slug or UUID/numeric fallback, privacy isolation when `is_public = 0`, 15 reserved slug protections, collision handling (409 Conflict), 3 web templates (Academic, Modern, Minimalist), and dynamic `.docx` generation using `docxtemplater` + `pizzip`.
4. **Unit AI Scan (`POST /api/v1/organizations/units/:id/ai-scan`)**: Hierarchical organization evaluation across 3 levels (Trường -> Khoa -> Bộ môn -> Thành viên) scoped to `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN` with 403 Forbidden enforcement on `MEMBER`.
5. **Comprehensive Automated Test Suites**: 77 M3 integration and adversarial tests, 52 core unit tests, 5 live Microsoft SQL Server integration tests, and 31 legacy runner checks.

### Iteration & Remediation History
- **Iteration 1**: Failed Gate check due to a binary veto from Forensic Auditor `auditor_1` (malformed OpenXML loop tags in `cvService.js` and `default_cv.docx` emitting literal `{#achievements}` and `undefined` fields) and review/challenge findings of SQL Server Errors 207 & 515, and silent calendar date rollovers.
- **Iteration 2 (Remediation)**: Worker 2 resolved all defect classes:
  - OpenXML loop tags (`{#achievements}`, `{/achievements}`, `{^achievements}`) isolated in paragraph XML `<w:p><w:r><w:t>` in both code constant and binary template archive `default_cv.docx`.
  - SQL repository queries updated to align 100% with live SQL Server tables: `COALESCE(l.full_name, u.display_name) AS full_name`, `NULL AS decision_number, NULL AS issuing_authority`, `c.criterion_code AS code`, and `$3 = userId` as `assigned_by`.
  - Calendar service introduces `isValidCalendarDate` with strict Gregorian UTC round-trip verification (blocking `2026-02-30`, `2026-04-31`, etc.), and dual-table inserts wrapped in `withTransaction` for atomic rollback.
  - KPI schema enforces item-level date ordering (`periodEnd >= periodStart`).
  - Reserved slugs expanded with 15 system route keywords.
  - Test suites hardened with deep OpenXML inspection via PizZip and live SQL Server transaction fixtures.

---

## 2. Logic Chain

1. **DOCX OpenXML Conformance**:
   - Docxtemplater with `paragraphLoop: true` requires loop tags to encapsulate paragraph XML nodes (`<w:p><w:r><w:t>`). Placing tags directly inside `<w:body>` caused raw delimiters to leak.
   - By encapsulating both opening and closing delimiters in dedicated `<w:p>` nodes in `cvService.js` and repacking `default_cv.docx`, Docxtemplater cleanly recognizes the block loop, expanding each achievement into a separate paragraph while removing the tags.
   - PizZip empirical verification confirmed 0 occurrences of `{#achievements}` or literal `undefined`.

2. **Database Schema Conformance**:
   - Queries triggering SQL Server Error 207 ("Invalid column name") were resolved by querying physical columns (`app.users.display_name`, `app.award_criteria_versions.criterion_code`, `app.lecturers.full_name`) and mapping missing achievement columns to NULL.
   - Supplying `assigned_by` on `app.lecturer_assignments` resolved SQL Server Error 515.
   - Verified against live SQL Server instance `PTUD_LHU` with 5/5 passing live tests.

3. **Date Validation & Transaction Boundaries**:
   - `Date.UTC(year, month - 1, day)` standardizes calendar calculations. Any non-existent Gregorian day (e.g., February 30) rolls over to the next month (`utcDate.getUTCMonth() !== month - 1`), immediately returning `false`.
   - Dual-table writes to `app.personal_calendar_events` and `app.calendar_reminders` are bound to a single transaction client via `withTransaction`. In simulated failures, rollback guarantees 0 orphan personal events.

4. **Independent Gate Verdicts (Iteration 2)**:
   - `reviewer_r2_1`: **APPROVE** (strict date parsing, transactional atomicity, kpiRepository column fixes)
   - `reviewer_r2_2`: **APPROVE** (OpenXML templates, SQL alignments, reserved slugs, 0 regressions)
   - `challenger_r2_1`: **APPROVE** (Gregorian date validation, rollback on reminder failure, KPI date inversion, Unit AI Scan RBAC, 63/63 tests pass)
   - `challenger_r2_2`: **APPROVE** (deep DOCX OpenXML unpack verified 0 raw tags/undefined, all 15 reserved slugs blocked, 38/38 CV tests pass)
   - `auditor_r2_1`: **CLEAN** (authentic OpenXML loop expansion, live SQL Schema 100% compliant, calendar rollover blocked, deep tests valid)

---

## 3. Caveats

- **Persistent Custom Slugs**: In `cvRepository.upsertProfile`, sending `{ slug: null }` preserves the existing custom slug via `COALESCE($2, slug)`. This is intentional to prevent accidental unlinking of published CV profiles.
- **Achievement Filtering**: If `selected_achievement_ids` is empty or omitted, `exportCvDocx` exports all active achievements by default. When a user wishes to export an empty list, achievements should be unpublished or marked inactive.
- **Live Database Fixtures**: All live Microsoft SQL Server tests run in rolled-back transactions with savepoints, leaving zero pollution in the database.

---

## 4. Conclusion

**Gate Result: PASS**

Milestone 3 (Backend Extended Modules: KPI, CV, Calendar & Unit AI Scan) is fully implemented, verified, hardened, and free of defects. All 77 M3 tests, 52 core unit tests, 5 live DB integration tests, and 31 legacy runner checks pass with 100% success rate. Milestone 3 is complete and ready for Milestone 4 (Frontend Modernization & Routing).

---

## 5. Verification Method

To independently reproduce the verification results from the project root:

```powershell
# 1. Run all M3 unit, integration, and adversarial test suites (77 tests — 100% PASS):
node --test backend/tests/cv-slug-docx.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/unit-ai-scan.test.js backend/tests/sqlserver-m3.integration.js backend/tests/challenger-m3-adversarial.test.js backend/tests/challenger-m3-cv-adversarial.test.js backend/tests/challenger-m3-cv-deep-adversarial.test.js

# 2. Run core system unit test suites (52 tests — 100% PASS):
node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js

# 3. Run legacy auth & RBAC test runner (31 checks — 100% PASS):
node backend/tests/runner.js

# 4. Verify live Microsoft SQL Server database refactoring and schema metadata:
node database/sqlserver/verify-refactor.mjs
node database/sqlserver/verify-live.mjs
```
