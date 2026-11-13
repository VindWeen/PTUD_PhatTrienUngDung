# Worker 2 Progress - Milestone 3 Iteration 2 Remediation

Last visited: 2026-11-12T23:25:00Z

## Remediation Plan & Execution Checklist

- [x] Task 1: Fix OpenXML DOCX Template & Binary Package
  - [x] 1.1 In `backend/src/modules/cv/cvService.js`: Update `DOCUMENT_XML` so loop delimiters `{#achievements}` and `{/achievements}` each occupy their own paragraph `<w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>`. Also wrapped `{^achievements}` and `{/achievements}` similarly.
  - [x] 1.2 Repacked `backend/src/modules/cv/templates/default_cv.docx` with the corrected `word/document.xml`.
- [x] Task 2: Fix Database SQL Queries (resolve Error 207 & Error 515)
  - [x] 2.1 In `backend/src/modules/cv/cvRepository.js`:
    - `getUserContact`: replaced `COALESCE(u.full_name, u.display_name)` with `COALESCE(l.full_name, u.display_name) AS full_name`.
    - `getUserActiveAchievements`: select only valid columns from `app.achievements` (`achievement_id`, `title`, `type`, `description`, `achievement_date`, `recognition_year`, `status`, `NULL AS decision_number, NULL AS issuing_authority`, `at.name AS achievement_type_name`).
  - [x] 2.2 In `backend/src/modules/organizations/organizationRepository.js`:
    - `getRegulationCriteria`: select `c.criterion_code AS code`, NOT `c.code`.
  - [x] 2.3 In `backend/src/modules/kpi/kpiRepository.js`:
    - In `subject()`: select `user_id, display_name AS full_name, email FROM app.users`.
    - In `INSERT INTO app.lecturer_assignments`, include `assigned_by` column ($3 = `userId`).
- [x] Task 3: Fix Calendar Atomicity & Strict Date Validation
  - [x] 3.1 In `backend/src/modules/calendar/calendarService.js`:
    - Implemented `isValidCalendarDate` strictly checking UTC round-trip equality against ISO pattern.
    - Updated `createReminderSchema` to use `isValidCalendarDate`.
    - Wrapped dual-table writes in `createReminder` in `executeTx` using `withTransaction` in production and supporting injected transactional runners.
  - [x] 3.2 In `backend/src/modules/kpi/kpiSchemas.js`:
    - Added item-level refinement to `aiGapCriterionSchema`: `.refine((v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, "Kỳ kết thúc phải sau kỳ bắt đầu")`.
  - [x] 3.3 In `backend/src/modules/cv/cvSchemas.js`:
    - Expanded `RESERVED_SLUGS` with common reserved routes (`me`, `public`, `export-docx`, `download`, `cv`, `profile`, `default`).
- [x] Task 4: Test Hardening & Test Verification
  - [x] 4.1 Updated `backend/tests/cv-slug-docx.test.js` with deep PizZip inspection asserting title, year, type, index, and absence of `{#achievements}` / `undefined`. (9/9 PASS)
  - [x] 4.2 Updated adversarial test suites `challenger-m3-adversarial.test.js` and `challenger-m3-cv-adversarial.test.js` to assert the remediated behaviors. (40/40 PASS)
  - [x] 4.3 Ran and passed all 11 unit & integration test suites. (52/52 PASS)
  - [x] 4.4 Ran and passed legacy `node backend/tests/runner.js`. (31/31 PASS)
  - [x] 4.5 Created and verified live database integration suite `backend/tests/sqlserver-m3.integration.js`. (5/5 PASS)
- [x] Task 5: Document in `handoff.md` and notify parent orchestrator.
