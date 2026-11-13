## 2026-11-12T21:54:53Z
You are teamwork_explorer_r2_1 (Explorer 1 for Iteration 2: OpenXML DOCX Template & Test Hardening).

Working directory: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung
State folder: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\explorer_r2_1
Original request path: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
Scope document: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\SCOPE.md
Project plan: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md

FORENSIC AUDITOR FULL EVIDENCE REPORT (READ FIRST):
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\auditor_1\handoff.md
CHALLENGER 2 REPORT:
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\challenger_2\handoff.md

CONTEXT:
Milestone 3 Iteration 1 failed the Forensic Audit with an INTEGRITY VIOLATION.
Specifically:
1. `backend/src/modules/cv/cvService.js` and `backend/src/modules/cv/templates/default_cv.docx`: Loop tags `{#achievements}` and `{/achievements}` were placed directly in `<w:body>` outside `<w:p><w:r><w:t>`. As a result, `docxtemplater` treats them as unparsed text and fails to iterate the achievements list.
2. In the exported document, achievements are completely missing and rendered as:
   `{#achievements}`
   `- undefined. GS.TS (undefined) - undefined`
   `{/achievements}`
3. `backend/tests/cv-slug-docx.test.js` only asserted PK magic bytes and `word/document.xml` existence, concealing this critical defect.

INSTRUCTIONS:
1. Initialize your BRIEFING.md and progress.md in your state folder.
2. Read the full Auditor report in `auditor_1/handoff.md` and Challenger 2 report in `challenger_2/handoff.md`.
3. Investigate the exact OpenXML syntax required by `docxtemplater` for paragraph loops and inline loops.
4. Formulate the precise fix for:
   - `backend/src/modules/cv/cvService.js`: the template string `DOCUMENT_XML`.
   - `backend/src/modules/cv/templates/default_cv.docx`: the binary template file.
   - `backend/tests/cv-slug-docx.test.js`: adding assertions that unpack `word/document.xml` and verify that achievement titles, years, and types are genuinely present and rendered.
5. Write your comprehensive remediation plan in `handoff.md` in your state folder and notify caller.
