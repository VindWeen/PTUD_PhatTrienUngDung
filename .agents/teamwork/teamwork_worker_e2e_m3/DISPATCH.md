# Task Assignment: E2E-M3 Tier 2 Boundary & Corner Case Tests

## Working Directory
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung

## State Folder
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\teamwork_worker_e2e_m3

## Essential References (MUST READ FIRST)
- `ORIGINAL_REQUEST.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\PROJECT.md
- `TEST_INFRA.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\TEST_INFRA.md
- `SCOPE.md`: c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_e2e\SCOPE.md

## Exclusive File Ownership
You exclusively own and write:
`c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\tests\e2e\tier2-boundary-corner.test.js`
Do NOT write to other test files.

## Objective
Implement Milestone E2E-M3: Tier 2 Boundary & Corner Case Tests.
Build at least 65 test cases (>=5 tests per feature for all 13 features) exercising boundary value limits, edge-case parameters, rate limits, empty collections, missing API keys, oversized payloads, and unauthenticated/unauthorized access using `node:test`, `node:assert/strict`, and `createTestClient` from `./helpers/testClient.js`.

### 13 Features to Cover (>=5 tests each = >=65 tests total):
1. **Personal Achievement Vault Boundaries**: Empty title rejection, future year boundary, past historical year boundary, max description length, invalid category enum handling.
2. **AI Vision Auto-fill Edge Cases**: Zero-byte file, unsupported MIME type (e.g. .exe/.txt), corrupted image header, oversized file, missing file field.
3. **AI Vision Fallback Conditions**: Network timeout simulation, missing API key trigger, illegible/blurred cert image, partial OCR payload with null fields, special characters in cert text.
4. **AI Regulation Gap Analysis Extremes**: Candidate with 0 achievements (0% match), candidate with all criteria met (100% match), non-existent regulation ID, duplicate criteria IDs, boundary asOfDate values.
5. **AI Auto-Discovery Extremes**: Empty regulations catalog, ties in ranking percentage, expired regulation filtering, future active date filtering, single regulation scenario.
6. **Dossier Packaging .ZIP Corner Cases**: Exporting for regulation with 0 matched achievements (graceful rejection), non-existent regulation ID, rapid repeated requests, filenames with Vietnamese diacritics / unicode, file extension validation.
7. **AI Gap to KPI Bridge Boundaries**: Empty missing criteria array, missing count zero, duplicate goal code, target date in the past, extreme notes length.
8. **Calendar Reminder Edge Cases**: Invalid date format, reminder date in the past, missing title, duplicate reminder for same regulation, maximum reminder title length.
9. **Public CV Custom Slug Corner Cases**: Privacy screen when `is_public = 0` (non-authenticated returns 403 / private message), slug with special characters/spaces, slug too short / too long, non-existent slug returns 404, reserved slug words.
10. **CV Web & Word Templates Edge Cases**: Invalid template ID, empty profile achievements, custom template with missing placeholders, corrupted docx template buffer, export with special unicode characters.
11. **3-Level Org Tree Boundaries**: Circular parent reference guard, orphaned unit handling, deep nesting > 3 levels guard, empty unit name, non-existent parent unit ID.
12. **4 Standard Roles Authorization Violations**: Unauthenticated request (401), invalid JWT token (401), privilege escalation: `MEMBER` attempting unit scan (403), `DEPARTMENT_HEAD` attempting other department scan (403), revoked role handling.
13. **Unit AI Scan Extremes**: Scanning unit with 0 members, non-existent unit ID, non-existent regulation ID, invalid requester role (`MEMBER` forbidden), large unit batch scan simulation.

## Verification
Run `node --test tests/e2e/tier2-boundary-corner.test.js` and verify that all 65+ tests pass with 0 failures.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Handoff Requirements
Write `handoff.md` in your state folder with Observation, Logic Chain, Caveats, Conclusion, and Verification commands/results, then notify caller via `send_message`.


## 2026-11-12T13:10:18Z
Dispatched from parent 91e2fc0f-14dc-43fa-9185-12a362a3ff8a for Milestone E2E-M3: Tier 2 Boundary & Corner Case Tests.
