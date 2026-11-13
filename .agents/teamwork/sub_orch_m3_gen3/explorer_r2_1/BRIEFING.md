# BRIEFING — 2026-11-12T22:25:00Z

## Mission
Investigate docxtemplater OpenXML loop tag requirements, unpack failure in cvService.js & default_cv.docx, and formulate precise remediation plan with test hardening for Milestone 3 Iteration 2.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
- State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_1
- Original parent: c4f8ee2a-a6b8-4150-930d-200ed34209c4
- Milestone: Milestone 3 Iteration 2 (OpenXML DOCX Template & Test Hardening)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in source code
- Address Integrity Violation from Forensic Auditor & Challenger 2
- Determine exact OpenXML syntax for docxtemplater loop tags
- Propose exact fix for backend/src/modules/cv/cvService.js, backend/src/modules/cv/templates/default_cv.docx, and backend/tests/cv-slug-docx.test.js

## Current Parent
- Conversation ID: c4f8ee2a-a6b8-4150-930d-200ed34209c4
- Updated: 2026-11-12T22:25:00Z

## Investigation State
- **Explored paths**:
  - `backend/src/modules/cv/cvService.js` (DOCUMENT_XML, exportCvDocx pipeline)
  - `backend/src/modules/cv/templates/default_cv.docx` (binary structure, document.xml)
  - `backend/src/modules/cv/cvRepository.js` (getUserContact, getUserActiveAchievements)
  - `backend/tests/cv-slug-docx.test.js` (test assertions & blind spots)
  - `backend/tests/challenger-m3-cv-adversarial.test.js` (defect verification tests)
  - `backend/tests/challenger-m3-adversarial.test.js` (live DB defect verification tests)
  - `backend/src/modules/kpi/kpiRepository.js` (app.users.full_name SQL bug)
  - `backend/src/modules/organizations/organizationRepository.js` (app.award_criteria_versions.code vs criterion_code SQL bug)
  - Database schema via `INFORMATION_SCHEMA.COLUMNS` on SQL Server
- **Key findings**:
  1. `docxtemplater` with `{ paragraphLoop: true }` requires loop delimiters enclosed in individual paragraphs: `<w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>` and `<w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>`. When placed outside `<w:p>`, tags are left raw and loops do not iterate.
  2. `default_cv.docx` contains the exact same defective XML as `DOCUMENT_XML`.
  3. Tests in `cv-slug-docx.test.js` checked only zip headers and magic bytes, omitting XML content assertions.
  4. SQL errors 207 exist in `cvRepository.js` (l.full_name, null decision_number/issuing_authority), `kpiRepository.js` (u.display_name), and `organizationRepository.js` (criterion_code AS code).
- **Unexplored areas**: None. All root causes, empirical behaviors, and verification paths are identified.

## Key Decisions Made
- Recommending Option 1 (paragraph loop with dedicated `<w:p><w:r><w:t>` tags for delimiters) as the only compliant and properly formatted WordprocessingML pattern.
- Formulated exact test assertions unpacking `word/document.xml` using `PizZip`.
- Detailed repacking script for `default_cv.docx`.

## Artifact Index
- DISPATCH.md — Initial instruction record
- progress.md — Liveness heartbeat and step tracking
- handoff.md — Comprehensive remediation plan
