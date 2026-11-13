# Challenger 1 Handoff Report: Milestone 5 Phase 2 Backend Adversarial Hardening

## 1. Observation

### Scope of Empirical Investigation
Conducted white-box adversarial stress testing across 6 core backend modules in accordance with Milestone 5 Phase 2 hardening objectives:
- `backend/src/modules/achievements/` (`achievementAiIngestService.js`, `achievementController.js`, `achievementPermissions.js`, `achievementRepository.js`, `achievementRoutes.js`, `achievementSchemas.js`)
- `backend/src/modules/ai/` (`criteriaEvaluator.js`, `autoDiscoveryService.js`, `dossierPackagerService.js`)
- `backend/src/modules/kpi/` (`kpiService.js`, `kpiRepository.js`, `kpiSchemas.js`)
- `backend/src/modules/cv/` (`cvService.js`, `cvRepository.js`, `cvSchemas.js`)
- `backend/src/modules/calendar/` (`calendarService.js`, `calendarRoutes.js`)
- `backend/src/modules/organizations/` (`organizationService.js`, `organizationRepository.js`)

### Executed Suite and Tool Command
Constructed and executed the Tier 5 Adversarial Test Suite:
```bash
node --test backend/tests/tier5-backend-adversarial.test.js
```

### Direct Tool Output
```text
✔ Achievements [SEC-01]: updateAchievementSchema strictly rejects locked status injection (1.923ms)
✔ Achievements [SEC-02]: updateAchievementSchema strictly rejects context / subject injection (0.4491ms)
✔ Achievements [PERM-01]: Permission Resolver grants full edit/evidence rights to ACTIVE status for owners (0.4647ms)
✔ Achievements [PERM-02]: Non-owners cannot edit or remove ACTIVE achievements (0.1944ms)
✔ Achievements [DEC-01]: Decommissioned workflow routes return 410 Gone (0.4283ms)
✔ Achievements [AI-01]: AI Vision extractCertificateInfo handles null, empty, and 0-byte buffers gracefully (0.5959ms)
✔ Achievements [AI-02]: AI Vision extractCertificateInfo handles corrupted binary noise safely (0.3653ms)
✔ AI Evaluator [CRIT-01]: Zero records boundary (0/N) correctly reports missingCount equal to targetMin (1.081ms)
✔ AI Evaluator [CRIT-02]: 100% boundary (records >= targetMin) satisfies criterion with missingCount = 0 (0.6607ms)
✔ AI Evaluator [CRIT-03]: REVOKED and CANCELLED records are strictly excluded and trigger human review (0.7228ms)
✔ AI Evaluator [CRIT-04]: Unmapped source rules never falsely pass criteria (0.3469ms)
✔ AI Auto-Discovery [DISC-01]: Percentage calculation resilience with 0 criteria, 0% satisfied, and 100% satisfied (0.3195ms)
✔ AI Auto-Discovery [DISC-02]: Regulations are strictly sorted by descending percentage, then satisfied count (0.2536ms)
✔ AI Dossier Packager [ZIP-01]: sanitizeFileName neutralizes path traversal, null bytes, and malicious characters (0.6577ms)
✔ AI Dossier Packager [ZIP-02]: formatStandardizedFileName enforces 01_[Title]_[Year].pdf naming standard (0.2622ms)
✔ AI Dossier Packager [ZIP-03]: buildDossierArchive safely handles missing physical files with fallback PDF buffer (23.5312ms)
✔ KPI Gap Schema [KPI-01]: fromAiGapSchema strictly enforces input boundaries and date ordering (1.2359ms)
✔ KPI Gap Duplicate Logic [KPI-02]: DRAFT duplicate accumulates target and increments version (0.2498ms)
✔ KPI Gap Duplicate Logic [KPI-03]: Non-DRAFT duplicate appends -GAP suffix to avoid PK/unique collisions (0.1383ms)
✔ CV Slug Validation [CV-01]: slugSchema rejects all reserved system slugs (0.4108ms)
✔ CV Slug Validation [CV-02]: slugSchema strictly rejects uppercase, spaces, and punctuation (0.2521ms)
✔ CV SQL Injection Resistance [CV-03]: findProfileBySlugOrId handles injection payloads safely (74.1084ms)
✔ CV Privacy Toggle [CV-04]: getPublicCv returns privacy notice and leaks zero contact or achievements when is_public = 0 (0.5408ms)
✔ CV DOCX Export [CV-05]: Corrupted DOCX template handling (17.297ms)
✔ Calendar Date Validation [CAL-01]: isValidCalendarDate strictly rejects impossible leap years and invalid dates (0.5159ms)
✔ Calendar Reminder Transaction [CAL-02]: Non-existent regulationId triggers rollback preventing orphan calendar events (1.1808ms)
✔ Calendar Concurrency [CAL-03]: Optimistic locking detects version mismatch and throws ConcurrencyConflictError (0.8548ms)
✔ Organizations Tree [ORG-01]: Circular hierarchy prevention rejects setting unit itself or descendant as parent (0.5719ms)
✔ Organizations RBAC [ORG-02]: Unit AI Scan strictly enforces role boundaries (20.3553ms)
✔ Organizations [ORG-03]: 3-level tree AI scan correctly aggregates eligible counts, percentages, and missing criteria (0.8592ms)
ℹ tests 30
ℹ suites 0
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1376.2534
```

### Detailed Observations by Subsystem
1. **Achievements Module**:
   - `achievementSchemas.js:60`: `updateAchievementSchema.strict()` strictly prevents clients from injecting locked fields (`status`, `createdBy`, `contextUnitId`, `lecturerId`). Attempts to inject `status: 'VERIFIED'` trigger validation failure.
   - `achievementRepository.js:398`: `createAchievement` hardcodes status as `'ACTIVE'`, ensuring newly created personal achievements take immediate effect without review.
   - `achievementPermissions.js:19-32`: Owners of `ACTIVE` achievements are granted `edit`, `manageEvidence`, and `remove` (when no revisions exist). Non-owners are denied (all actions `false`).
   - `achievementRoutes.js:71-86`: The 8 decommissioned administrative workflow endpoints (`/submit`, `/verify`, `/request-correction`, `/reject`, `/cancel`, `/revoke`, `/resubmit`, `/replace`) return HTTP 410 (Gone).
   - `achievementAiIngestService.js:12-29`: `extractCertificateInfo` returns `{ success: true, data: null, fallback: true }` when supplied with empty, null, or corrupted byte buffers, preserving smooth user experience.

2. **AI Module**:
   - `criteriaEvaluator.js:249-287`: When 0 records are provided, `missingCount` correctly equals `targetMin` with `isSatisfied: false`. When records >= `targetMin`, `missingCount` is 0 with `isSatisfied: true`.
   - `criteriaEvaluator.js:156-159`: Records marked `REVOKED` or `CANCELLED` are excluded from `activeRecords` and flag `REVOKED_SOURCE`, resulting in `isSatisfied: 'UNCONFIRMED'` and `humanReviewRequired: true`.
   - `autoDiscoveryService.js:169`: `const percentage = totalCount > 0 ? Math.round((satisfiedCount / totalCount) * 100) : 0;` safely guards against division-by-zero or `NaN`. Candidate rankings correctly sort by descending percentage, then satisfied count, then name.
   - `dossierPackagerService.js:27-36`: `sanitizeFileName` replaces path separators `/` and `\` with underscores `_`, neutralizing path traversal attacks (`../../etc/passwd`).
   - `dossierPackagerService.js:81-95`: `buildDossierArchive` uses `createFallbackPdfBuffer` when a physical storage file is absent on disk, preventing stream crashes and producing valid ZIP archives starting with `PK\x03\x04`.

3. **KPI Module**:
   - `kpiSchemas.js`: `fromAiGapSchema` rejects negative `missingCount`, inverted date spans (`periodEnd < periodStart`), and empty `missingCriteria` arrays.
   - `kpiService.js:428-452`: In `createFromAiGap`, duplicate goals in `DRAFT` status accumulate target (`target = target + $1`) and increment version; non-DRAFT duplicates append `-GAP` to goal codes to prevent unique constraint conflicts.

4. **CV Module**:
   - `cvSchemas.js:33-40`: `slugSchema` rejects all 15 reserved keywords (`admin`, `api`, `auth`, `system`, etc.), as well as uppercase characters, spaces, punctuation, and lengths outside 3-100 characters.
   - `cvRepository.js:21-46`: `findProfileBySlugOrId` utilizes parameterized query `$1` throughout. Adversarial SQL injection payloads (`' OR '1'='1`, `1; DROP TABLE...`) execute as literal parameter strings and return `null` without data leakage or SQL errors.
   - `cvService.js:58-63`: When `is_public = 0`, `getPublicCv` strictly returns `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }` without exposing contact details or achievements.
   - `cvService.js:181-226`: In `exportCvDocx`, corrupt non-zip binaries throw `PizZip` errors, missing `[Content_Types].xml` throws `filetype_not_identified`, and unclosed template tags throw Docxtemplater `XTTemplateError: Multi error`.

5. **Calendar Module**:
   - `calendarService.js:7-32`: `isValidCalendarDate` enforces calendar day arithmetic via UTC round-tripping, strictly rejecting non-existent calendar dates (e.g., Feb 29 on non-leap years, Feb 30, April 31) and out-of-range years (<1990 or >2100).
   - `calendarService.js:115-183`: `createReminder` executes inside a database transaction. If `regulationId` does not exist in `app.regulation_documents`, it throws `NotFoundError` and aborts before inserting into `app.personal_calendar_events`.
   - `calendarService.js:94-103`: `update` detects version mismatches and throws `ConcurrencyConflictError`.

6. **Organizations Module**:
   - `organizationService.js:27-33`: `ensureParent` prevents circular tree cycles (`ORGANIZATION_CYCLE`), rejecting any attempt to set a unit itself or any of its descendants as its parent.
   - `organizationService.js:108-148`: `scanUnitWithAi` restricts access: `MEMBER` is rejected with `ForbiddenError` (403); `DEPARTMENT_HEAD` can only scan their own department; `FACULTY_LEAD` can scan their faculty and descendant departments; `ADMIN` has global scan authority.
   - `organizationService.js:159-231`: Aggregation across descendant departments correctly totals eligible counts, percentages, and breakdowns of matched vs missing criteria.

---

## 2. Logic Chain

1. **Step 1 — Schema and Boundary Armor**:
   - Observations show that `updateAchievementSchema`, `fromAiGapSchema`, `createReminderSchema`, and `slugSchema` strictly parse and sanitize all incoming payloads.
   - Malicious inputs (such as status tampering, negative KPI counts, impossible calendar dates, SQL injection strings, and reserved slug attempts) are rejected at the edge before hitting business or persistence layers.

2. **Step 2 — Immediate ACTIVE State & Legacy Decommissioning**:
   - Observations show `createAchievement` outputs `status = 'ACTIVE'` directly without approval queues, and `achievementPermissions` gives personal owners immediate edit and delete rights.
   - All 8 legacy approval routes return HTTP 410, ensuring no administrative bottlenecks remain.

3. **Step 3 — Deterministic AI Evaluation and Graceful Fallback**:
   - `evaluateStructuredCriterion` does not rely on LLM nondeterminism for counting years or evaluating thresholds; it executes deterministic arithmetic.
   - Corrupted or missing OCR payloads fallback gracefully with Vietnamese user instructions instead of throwing unhandled exceptions.
   - In auto-discovery, regulations with 0 criteria or 0 matches compute 0% without `NaN` or division-by-zero crashes.

4. **Step 4 — Concurrency and Transaction Safety**:
   - Calendar reminders and KPI gap transfers run within transactions; foreign key validation failures abort without leaving orphan records.
   - Optimistic concurrency control via `version = version + 1` is enforced in both calendar events and KPI goals.

5. **Step 5 — Empirical Verification**:
   - 30 adversarial stress tests were written in `backend/tests/tier5-backend-adversarial.test.js` and executed with `node --test`.
   - All 30 tests passed with 0 failures, 0 skips, and 0 timeouts.
   - Existing backend tests (`npm --prefix backend test`) and E2E Tier 1 tests (`node tests/e2e/runner.js --tier=1`) continue to pass 100%.

---

## 3. Caveats & Minor Gaps Uncovered

1. **Minor Finding — `sanitizeFileName` on Whitespace / Symbol-Only Inputs**:
   - When `sanitizeFileName('   ')` or `sanitizeFileName('!@#$%')` is called, all characters are replaced by underscores and then stripped by `.replace(/^_+|_+$/g, '')`, yielding an empty string `''`.
   - Consequently, `formatStandardizedFileName(1, '   ', 2025)` produces `01_[]_[2025].pdf`.
   - While this does not compromise security (does not escape directories inside the ZIP), it is recommended as an optional hardening improvement for Worker to default to `'MinhChung'` if the sanitized title length is 0 (e.g., `return clean || 'MinhChung'`).
2. **AI Provider Network Saturation**:
   - Live external network calls to Groq/Gemini APIs under extreme rate limits were verified via mock aborts and timeout signals, but depend on external API key availability in production environments.

---

## 4. Conclusion

**Verdict**: **APPROVE** (with 1 Minor Hardening Recommendation noted in Caveats).

All 6 backend modules exhibit high adversarial resilience:
- Zero tolerance for cheating observed: genuine backend services, schemas, and queries were executed.
- Immediate `ACTIVE` vault status is strictly preserved.
- AI Evaluator and Auto-Discovery calculate boundaries accurately without NaN or divide-by-zero.
- SQL injection attempts are safely neutralized by parameterized queries.
- CV privacy flags prevent unauthenticated data leakage.
- Calendar date validator strictly prevents impossible calendar dates.
- 3-level organization hierarchy correctly prevents circular dependencies and enforces role scoping.

---

## 5. Verification Method

To independently reproduce and verify this investigation:

```bash
# 1. Execute the Tier 5 Adversarial Test Suite
node --test backend/tests/tier5-backend-adversarial.test.js

# 2. Verify entire Backend Test Suite (regression check)
npm --prefix backend test

# 3. Verify E2E Feature Coverage Suite
node tests/e2e/runner.js --tier=1
```

**Invalidation Conditions**:
- If any test in `backend/tests/tier5-backend-adversarial.test.js` fails or times out.
- If status `ACTIVE` can be altered to `VERIFIED` or `DRAFT` via `updateAchievementSchema`.
- If `findProfileBySlugOrId` throws SQL syntax errors on `' OR '1'='1`.
- If `isValidCalendarDate` returns `true` for `2025-02-29` or `2026-02-30`.
