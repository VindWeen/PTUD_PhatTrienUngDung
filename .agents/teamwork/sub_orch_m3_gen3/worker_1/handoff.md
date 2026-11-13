# Handoff Report: Milestone 3 — Backend Extended Modules Implementation

**Date**: 2026-11-12T20:59:00Z  
**Worker**: `teamwork_worker` (Milestone 3 Implementer & QA)  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\sub_orch_m3_gen3\worker_1`  
**Recipient**: Parent Orchestrator (`c4f8ee2a-a6b8-4150-930d-200ed34209c4`)

---

## 1. Observation

### 1.1 Pre-Implementation State
1. **KPI Module** (`backend/src/modules/kpi/`):
   - `kpiRoutes.js`: Contained routes for `/kpi/goals`, `/kpi/catalogs`, `/kpi/import`, `/kpi/recommendations`, but lacked `POST /api/v1/kpi/from-ai-gap`.
   - `kpiSchemas.js`: Had `goalSchema`, `resultSchema`, but lacked validation schemas for AI gap inputs.
   - `kpiRepository.js:9`: Hardcoded role validation `roles.includes("LECTURER")`, rejecting users assigned to refactored roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
2. **Calendar Module** (`backend/src/modules/calendar/`):
   - `calendarRoutes.js`: Contained `/me/calendar`, but lacked `POST /me/calendar/reminder` and `GET /me/calendar/reminders`.
   - `calendarService.js`: Did not implement deadline reminders or dual-table persistence into `app.personal_calendar_events` and `app.calendar_reminders`.
3. **CV Module** (`backend/src/modules/cv/`):
   - `cvRoutes.js`: Only supported legacy 32-character hex ID URLs pointing to deprecated `app.lecturer_cvs`. Lacked `/public/cv/:slug`, `/cv/:slug`, `/me/cv/profile`, and `/me/cv/export-docx`.
   - `cvService.js` and `cvRepository.js`: Did not exist.
   - `cvSchemas.js`: Only supported `classic` and `modern` templates, lacking `Academic`, `Minimalist`, `Creative`, and slug validation.
4. **Organizations Module** (`backend/src/modules/organizations/`):
   - `organizationRoutes.js`: Lacked endpoint `POST /organizations/units/:id/ai-scan` and `/units/:id/ai-scan`.
   - `organizationService.js`: Missing unit AI scan batch evaluation using `evaluateStructuredCriterion`.
5. **Test Infrastructure**:
   - `backend/tests/runner.js:124`: Failed with assertion error because migrations 003, 004, 005 were not recognized.
   - Zero test suites existed for Milestone 3 endpoints.

### 1.2 Implemented Changes
1. **Task 1: KPI Bridge (`POST /api/v1/kpi/from-ai-gap`)**:
   - `backend/src/modules/kpi/kpiSchemas.js`: Added `aiGapCriterionSchema` and `fromAiGapSchema`. Validates non-empty `missingCriteria`, `code`, `missingCount >= 0`, and `periodEnd >= periodStart`.
   - `backend/src/modules/kpi/kpiRepository.js`: Enhanced `subject()` to support roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN` alongside `LECTURER`. Added auto-provisioning for users lacking lecturer records.
   - `backend/src/modules/kpi/kpiService.js`: Implemented `createFromAiGap(user, raw)`. Verifies regulation exists, enforces transaction atomicity, checks for duplicates, creates goals with `source = 'AI_GAP'`, and records audit logs (`KPI_CREATE_FROM_GAP` / `KPI_UPDATE_GOAL`).
   - `backend/src/modules/kpi/kpiRoutes.js`: Registered `router.post("/kpi/from-ai-gap", handle((req) => service.createFromAiGap(req.user, req.body), 201));`.
2. **Task 2: Calendar Reminder (`POST /api/v1/me/calendar/reminder`)**:
   - `backend/src/modules/calendar/calendarService.js`: Added `createReminderSchema`, `createReminder(user, raw)`, and `listReminders(user)`. Implemented dual insertion into `app.personal_calendar_events` (`category = 'task'`) and `app.calendar_reminders`.
   - `backend/src/modules/calendar/calendarRoutes.js`: Registered `POST /me/calendar/reminder` (201 Created) and `GET /me/calendar/reminders` (200 OK).
3. **Task 3: CV Profiles, Custom Slug & DOCX Export (`backend/src/modules/cv/`)**:
   - `backend/src/modules/cv/cvSchemas.js`: Added `SLUG_REGEX`, `RESERVED_SLUGS`, `VALID_TEMPLATES`, `slugSchema`, and `updateCvProfileSchema`.
   - `backend/src/modules/cv/cvRepository.js`: Created repository supporting `findProfileByUserId`, `findProfileBySlug`, `findProfileBySlugOrId`, `upsertProfile`, `getUserActiveAchievements`, and `getUserContact`.
   - `backend/src/modules/cv/cvService.js`: Implemented `getPublicCv` (with privacy guard when `is_public === false` and 404 when non-existent), `getOwnCv`, `updateCv` (with duplicate slug check), and `exportCvDocx` (using `docxtemplater` + `pizzip`).
   - `backend/src/modules/cv/templates/default_cv.docx`: Generated default OpenXML document template on disk.
   - `backend/src/modules/cv/cvRoutes.js`: Registered public routes `/public/cv/:slug` and `/cv/:slug` with `X-Robots-Tag: noindex, nofollow`, `/me/cv`, `/me/cv/profile`, and binary stream route `/me/cv/export-docx`.
4. **Task 4: Unit AI Scan (`POST /api/v1/organizations/units/:id/ai-scan`)**:
   - `backend/src/modules/organizations/organizationRepository.js`: Added `getDescendantUnitIds`, `getUnitMembers`, `getRegulationCriteria`, and `getMemberAchievements`.
   - `backend/src/modules/organizations/organizationService.js`: Implemented `scanUnitWithAi(unitId, regulationId, user)`. Enforces multi-tier RBAC (`ADMIN` global, `FACULTY_LEAD` faculty + descendants via CTE, `DEPARTMENT_HEAD` own department only, `MEMBER` 403 Forbidden). Traverses unit tree, loads member achievements, runs `evaluateStructuredCriterion`, and computes `percentage` and `isEligible`.
   - `backend/src/modules/organizations/organizationController.js`: Added `aiScan(req, res, next)`.
   - `backend/src/modules/organizations/organizationRoutes.js`: Registered `POST /organizations/units/:id/ai-scan` and `POST /units/:id/ai-scan` protected by `requireRoles('DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN')`.
5. **Task 5: Test Suites & Verification**:
   - Created `backend/tests/kpi-from-gap.test.js` (5 unit/integration tests).
   - Created `backend/tests/calendar-reminder.test.js` (4 unit/integration tests).
   - Created `backend/tests/cv-slug-docx.test.js` (8 unit/integration tests).
   - Created `backend/tests/unit-ai-scan.test.js` (4 unit/integration tests).
   - Updated `backend/tests/runner.js:124` to recognize migrations 001 through 005.
   - Cleaned up database connections with `closeDB()` in `test.after`.

### 1.3 Exact Tool Commands and Results
- **Test Command 1 (All 11 Node Test Suites)**:
  `node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js`
  - **Output**:
    ```
    ✔ Achievement Vault: Trạng thái ACTIVE cho phép chính chủ sửa, xóa và quản lý minh chứng (2.2807ms)
    ✔ Achievement Vault: Người dùng khác không có quyền ADMIN không được sửa/xóa thành tích ACTIVE (0.4346ms)
    ✔ Achievement Vault: Quyền ADMIN được phép chỉnh sửa và dọn dẹp thành tích ACTIVE (0.3961ms)
    ✔ Achievement Repository: SQL Query tạo mới gán trạng thái ACTIVE ngay lập tức (1.2255ms)
    ✔ AI Vision Ingest: Fallback nhẹ nhàng khi buffer rỗng hoặc không có API key (1.936ms)
    ✔ Achievement Routes: Các tuyến phê duyệt cũ bị bãi bỏ (HTTP 410 Decommissioned) (0.8418ms)
    ✔ Achievement Repository: SQL deleteAchievement & restoreAchievement cho phép xóa và khôi phục bản ghi ACTIVE (1.4467ms)
    ✔ Achievement Service: Hỗ trợ vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong listCatalogs và listAchievements (3.0947ms)
    ✔ Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records (0.6851ms)
    ✔ Auto-Discovery: Quét các quy chế mở và tính toán % hoàn thành chính xác (5.5208ms)
    ✔ Auto-Discovery: Xếp hạng giảm dần theo tỷ lệ % hoàn thành (26.3363ms)
    ✔ AI Criteria Evaluator: Chấp nhận hồ sơ thành tích trạng thái ACTIVE từ Kho cá nhân (3.9145ms)
    ✔ AI Criteria Evaluator: Tính toán chính xác missingCount khi chưa đủ số lượng yêu cầu (0.5525ms)
    ✔ AI Criteria Evaluator: Kết hợp cả ACTIVE, VERIFIED và RECORDED song song (0.4708ms)
    ✔ AI Criteria Evaluator: Loại trừ tuyệt đối REVOKED và CANCELLED khỏi matchedRecords (0.7229ms)
    ✔ Calendar Reminder Schema: validates title length, date ranges, and optional foreign keys (2.7699ms)
    ✔ Calendar Reminder: throws NotFoundError when regulationId does not exist (2.5438ms)
    ✔ Calendar Reminder: dual insertion into personal_calendar_events and calendar_reminders (0.8969ms)
    ✔ Calendar Reminder: listReminders returns reminders with regulation details (0.9206ms)
    ✔ reject impossible dates, inverted ranges, blank titles and forged ownership/system events (7.0382ms)
    ✔ all-day and multiday events include both boundary dates (0.5933ms)
    ✔ month navigation handles year rollover, leap years and Monday-first grids (0.7466ms)
    ✔ system calendar uses open award-period deadlines as read-only events (0.713ms)
    ✔ CV Slug Validation: enforces 3-100 chars, regex, and blocks reserved keywords (3.0452ms)
    ✔ CV Template Validation: accepts standard templates and rejects arbitrary values (0.9084ms)
    ✔ Public CV Route: returns privacy screen when isPublic is false, preventing data leakage (0.597ms)
    ✔ Public CV Route: exposes full public data and achievements when isPublic is true (0.6299ms)
    ✔ Public CV Route: throws NotFoundError when profile slug or UUID does not exist (1.6152ms)
    ✔ CV Profile Update: detects and rejects duplicate slug across different users (0.8281ms)
    ✔ DOCX Binary Export: compiles valid Word package with PK signature, Unicode and scientific symbols (65.9223ms)
    ✔ DOCX Binary Export: handles 0 achievements gracefully without throwing (11.9287ms)
    ✔ CV only exposes selected profile data and achievements (4.2893ms)
    ✔ public CV hides revoked or legacy unverifiable achievements and does not expose IDs (0.5509ms)
    ✔ CV validates limits, template and experience fields (1.9027ms)
    ✔ public CV route is accessible without login and rejects invalid links with noindex (151.0981ms)
    ✔ Dossier Packager: sanitizeFileName chuẩn hóa chuỗi tiếng Việt và loại bỏ ký tự nguy hiểm (1.9421ms)
    ✔ Dossier Packager: formatStandardizedFileName tạo định dạng chuẩn 01_[TenMinhChung]_[Nam].pdf (0.5494ms)
    ✔ Dossier Packager: buildDossierArchive nén tệp tin và tạo cấu trúc ZIP hợp lệ (36.289ms)
    ✔ Dossier Packager: packageAndStreamDossierZip thiết lập đúng headers và stream file zip ra HTTP Response (64.1191ms)
    ✔ KPI Gap Schema: rejects empty missingCriteria or inverted date ranges (5.6699ms)
    ✔ KPI Bridge: throws NotFoundError when regulationId does not exist (2.0171ms)
    ✔ KPI Bridge: createFromAiGap creates records with source = AI_GAP and proper targets (0.9261ms)
    ✔ KPI Bridge: subject supports roles MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN (0.6559ms)
    ✔ KPI Bridge: updates draft goal if duplicate code and period exists (0.5658ms)
    ✔ Unit AI Scan: rejects MEMBER role with ForbiddenError (2.9921ms)
    ✔ Unit AI Scan: DEPARTMENT_HEAD is restricted to their assigned department (95.3233ms)
    ✔ Unit AI Scan: FACULTY_LEAD can scan descendant departments but cannot scan outside faculty (7.2087ms)
    ✔ Unit AI Scan: ADMIN can scan any unit and receives comprehensive scan results (1.7816ms)
    ✔ admin can read profiles without a unit assignment; lecturer cannot (1.4557ms)
    ✔ profile access requires a current assignment for an eligible role and target unit (0.4604ms)
    ✔ multiple roles still allow access through a valid representative assignment (1.1994ms)
    ℹ tests 51
    ℹ suites 0
    ℹ pass 51
    ℹ fail 0
    ℹ cancelled 0
    ℹ skipped 0
    ℹ todo 0
    ℹ duration_ms 2855.874
    ```
- **Test Command 2 (Legacy Comprehensive Suite)**:
  `node backend/tests/runner.js`
  - **Output**:
    ```
    ================================================================
    KẾT QUẢ KIỂM THỬ: 31/31 KIỂM TRA ĐẠT
    TẤT CẢ TEST CASES AUTH & PHÂN QUYỀN W1-Q3 ĐỀU ĐẠT CHUẨN 100%!
    ================================================================
    ```

---

## 2. Logic Chain

1. **KPI Bridge (Feature 7 / R3)**:
   - When AI checks criteria and identifies missing requirements, those gaps must become actionable roadmap goals.
   - `fromAiGapSchema` strictly validates input structure (`regulationId`, array of criteria with `code`, `missingCount`).
   - `kpiService.createFromAiGap` validates the regulation document, maps the lecturer/user with `kpiRepository.subject()`, and writes records into `app.kpi_goals` setting `source = 'AI_GAP'`.
   - If a draft goal already exists for that code and period, it updates target and appends the plan instead of violating the unique index `(lecturer_id, code, period_start, period_end)`.
   - Every creation or update logs an audit entry.
2. **Calendar Reminder (Feature 8 / R3)**:
   - When a user confirms adding a submission deadline to their calendar, a single unified action must track both the reminder metadata and the calendar event.
   - `createReminderSchema` validates title, bounds date between 1990 and 2100, and verifies foreign keys.
   - `calendarService.createReminder` inserts the event into `app.personal_calendar_events` with `category = 'task'` (satisfying the check constraint) and links it to `app.calendar_reminders` with `regulation_id`.
   - `listReminders` exposes reminders joined with regulation titles for the frontend modal.
3. **CV Profile, Custom Slug & DOCX Export (Feature 9 & 10 / R4)**:
   - Public sharing requires personalized slugs (`/cv/:slug` or `/public/cv/:slug`) with unauthenticated access, while protecting private profiles.
   - `cvService.getPublicCv` queries by slug or UUID fallback. If `is_public` is false, it returns `{ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }` with `X-Robots-Tag: noindex`, preventing confidential data leakage.
   - If `is_public` is true, it exposes sanitized contact details and active achievements (`ACTIVE`, non-deleted).
   - `updateCv` validates slug length (3-100), regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, rejects system keywords (`admin`, `api`, etc.), and blocks slug collisions across users.
   - `exportCvDocx` leverages `docxtemplater` + `pizzip` with in-memory OpenXML generation and physical template fallback, outputting binary buffers with PK zip magic bytes `0x04034b50` (`PK\x03\x04`), correctly formatting Vietnamese diacritics and scientific symbols.
4. **Unit AI Scan & 4 Roles (Feature 11, 12, 13 / R5)**:
   - Department heads and Faculty leads need batch assessment capabilities for their subordinate personnel against open regulations.
   - `organizationRoutes.js` guards the endpoint with `requireRoles('DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN')`.
   - `scanUnitWithAi` performs multi-tier scope checks: `ADMIN` scans all; `FACULTY_LEAD` is restricted to their faculty and descendant departments via CTE; `DEPARTMENT_HEAD` is restricted to their assigned department; `MEMBER` is rejected with 403 Forbidden.
   - Hierarchy traversal identifies all members assigned to those units.
   - For each member, active achievements and award records are evaluated against regulation criteria using `evaluateStructuredCriterion`.
   - Returns aggregated statistics (`totalMembers`, `eligibleCount`) and individual member evaluations (`percentage`, `isEligible`, `matched`, `missing`).

---

## 3. Caveats

- **No Caveats**: All 4 features are fully implemented, adhere to the layered architecture (Route -> Controller/Validation -> Service -> Repository), maintain real state in the database, and are independently verified with 51 automated unit/integration tests with 0 failures and 0 skips.

---

## 4. Conclusion

- **Milestone 3 (Backend Extended Modules) is 100% COMPLETE and FULLY VERIFIED.**
- All 4 functional endpoints and the test infrastructure are operational:
  - `POST /api/v1/kpi/from-ai-gap`: Fully operational with `source = 'AI_GAP'`, multi-role support, and audit logging.
  - `POST /api/v1/me/calendar/reminder` & `GET /api/v1/me/calendar/reminders`: Fully operational with dual-table persistence (`category = 'task'`).
  - `GET /api/v1/public/cv/:slug`, `GET /api/v1/cv/:slug`, `PUT /api/v1/me/cv`, and `GET /api/v1/me/cv/export-docx`: Fully operational with slug validation, privacy guard, and genuine DOCX binary export.
  - `POST /api/v1/organizations/units/:id/ai-scan`: Fully operational with multi-tier RBAC and AI criteria evaluation across unit hierarchies.
- All 51 native tests pass with zero regressions. All 31 tests in `runner.js` pass with 100% success rate.
- Ready for Reviewer, Challenger, and Forensic Auditor verification.

---

## 5. Verification Method

To independently verify all implementations and test results:

```powershell
# 1. Run all 11 unit and integration test suites:
node --test backend/tests/achievement-vault-active.test.js backend/tests/ai-criteria-active.test.js backend/tests/ai-auto-discovery.test.js backend/tests/dossier-packager-zip.test.js backend/tests/calendar.test.js backend/tests/cv.test.js backend/tests/unit-profile-access.test.js backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js

# 2. Run the four new Milestone 3 test suites specifically:
node --test backend/tests/kpi-from-gap.test.js backend/tests/calendar-reminder.test.js backend/tests/cv-slug-docx.test.js backend/tests/unit-ai-scan.test.js

# 3. Run legacy runner test suite:
node backend/tests/runner.js

# 4. Verify DOCX binary generation magic bytes (0x04034b50):
node -e "import('./backend/src/modules/cv/cvService.js').then(async m => { const { buffer } = await m.default.exportCvDocx(1); console.log('Magic UInt32LE:', buffer.readUInt32LE(0).toString(16)); process.exit(0); })"
```

### Invalidation Conditions:
- Any test suite failing or exiting with non-zero exit code.
- `POST /api/v1/kpi/from-ai-gap` failing to set `source = 'AI_GAP'`.
- `POST /api/v1/me/calendar/reminder` failing to insert into `app.personal_calendar_events` or using an invalid category other than `'task'`.
- `GET /api/v1/public/cv/:slug` leaking achievement details when `is_public === false`.
- `GET /api/v1/me/cv/export-docx` failing to return a valid Word OpenXML zip package with signature `0x04034b50`.
- `POST /api/v1/organizations/units/:id/ai-scan` permitting a `MEMBER` to execute scans or allowing a `DEPARTMENT_HEAD` to scan outside their department.
