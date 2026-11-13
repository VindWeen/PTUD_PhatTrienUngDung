# Empirical Challenge Handoff Report: Milestone 2 — Iteration 2 Remediation

**Agent**: `challenger_m2_r2_2` (Empirical Challenger)  
**Date**: 2026-11-12  
**Target Recipient**: Sub-Orchestrator Milestone 2 (`b4442109-5705-4dae-83ed-e0f0f2dcfbf3`)  
**Working Directory**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\challenger_m2_r2_2`  
**Final Verdict**: **`CONFIRM`**

---

## 1. Observation

### 1.1 Remediation Area 1: Active Status Deletion/Restoration & Trash Cleanup Boundary
- **File**: `backend/src/modules/achievements/achievementRepository.js:472-483`
  ```javascript
  export async function deleteAchievement(id, userId, version) {
    const result = await query(`UPDATE app.achievements SET deleted_at = SYSUTCDATETIME(), deleted_by = $2, updated_at = SYSUTCDATETIME(), version = version + 1
      OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $3 AND status IN ('ACTIVE', 'DRAFT') AND deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = app.achievements.achievement_id)`, [id, userId, version]);
    return result.rowCount > 0;
  }
  export async function restoreAchievement(id, version) {
    const result = await query(`UPDATE app.achievements SET deleted_at = NULL, deleted_by = NULL, updated_at = SYSUTCDATETIME(), version = version + 1
      OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $2 AND status IN ('ACTIVE', 'DRAFT')
      AND deleted_at > DATEADD(day, -30, SYSUTCDATETIME())`, [id, version]);
    return result.rowCount > 0;
  }
  ```
- **File**: `backend/src/modules/achievements/achievementTrashCleanup.js:6-14`
  ```sql
  INSERT INTO @expired SELECT achievement_id FROM app.achievements a WITH (UPDLOCK, HOLDLOCK)
  WHERE a.status IN ('ACTIVE', 'DRAFT') AND a.deleted_at <= DATEADD(day, -30, SYSUTCDATETIME())
  AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = a.achievement_id)
  AND NOT EXISTS (SELECT 1 FROM app.award_record_achievements r WHERE r.achievement_id = a.achievement_id)
  AND NOT EXISTS (SELECT 1 FROM app.kpi_results k WHERE k.achievement_id = a.achievement_id)
  AND NOT EXISTS (SELECT 1 FROM app.external_kpi_records k WHERE k.achievement_id = a.achievement_id)
  AND NOT EXISTS (SELECT 1 FROM app.achievements r WHERE r.replaces_achievement_id = a.achievement_id)
  AND NOT EXISTS (SELECT 1 FROM app.submission_evidence_files sf JOIN app.evidence_files f ON f.evidence_file_id = sf.evidence_file_id JOIN app.evidences e ON e.evidence_id = f.evidence_id WHERE e.achievement_id = a.achievement_id);
  ```
- **Empirical verification in `tests/challenger-m2-r2-empirical.test.js`**:
  - `Area 1.1`: Verified regex matching `status IN ('ACTIVE', 'DRAFT')`, `deleted_at IS NULL`, `version = $3` on delete and `deleted_at > DATEADD(day, -30, SYSUTCDATETIME())`, `version = $2` on restore.
  - `Area 1.2`: Verified exclusion of linked submissions, award records, KPI results, and frozen evidence files.
  - `Area 1.3`: Version collision test (OCC) confirmed: second concurrent delete with stale version rejects with `404` or `409 ConflictError`.
  - `Area 1.4`: 30-day retention boundary confirmed: records at 29 days 23 hours restore cleanly (`status: 'ACTIVE'`, version incremented, `deletedAt: null`). Records at 31 days reject restore with `ConflictError('Bản nháp đã hết thời hạn khôi phục 30 ngày')`.
  - `Area 1.5`: Verified that non-ACTIVE/DRAFT records (e.g. `VERIFIED`) cannot be deleted or restored.

### 1.2 Remediation Area 2: Standard Role Accessibility & Security Boundary
- **File**: `backend/src/modules/achievements/achievementService.js:28-31, 48, 55-71`
  - `listCatalogs`: Allows roles `['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN']`.
  - `listAchievements`: Defines `isIndividual = roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r))`.
  - Scoping condition: If `lecturerProfile` exists, sets `a.lecturer_id = ${myLecturerId}`; if absent, sets fallback `a.created_by = ${Number(user.userId)}`.
  - Workflow filter: `ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']`.
- **Empirical verification in `tests/challenger-m2-r2-empirical.test.js`**:
  - `Area 2.1`: Tested `listCatalogs` for each role independently (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) -> All 4 returned catalogs successfully. Unauthorized roles (`GUEST`, `STUDENT`, `EXTERNAL_AUDITOR`, `[]`) were rejected with `ForbiddenError('Không có quyền đọc danh mục thành tích')`.
  - `Area 2.2`: Tested individual scoping: `MEMBER` with lecturer profile filters by `a.lecturer_id`; `MEMBER` without profile filters by `a.created_by`. Both `DEPARTMENT_HEAD` and `FACULTY_LEAD` correctly see their personal achievements.
  - `Area 2.3`: Tested workflow `ACTIONABLE`: `filters.statuses` strictly contains `['ACTIVE', 'DRAFT', 'NEED_CORRECTION']`.
  - `Area 2.4`: Cross-individual tenant isolation: Member B cannot see Member A achievements (`a.lecturer_id = 111` vs `222`).

### 1.3 Remediation Area 3: Dossier ZIP Packaging Robustness
- **File**: `backend/src/modules/ai/dossierPackagerService.js:154-211, 287-309`
  - Queries `app.achievements` AND `app.award_records` (via subquery on `app.award_decision_files`).
  - Sets HTTP headers `application/zip` and `attachment; filename="Goi_Minh_Chung_[DocName]_[Year].zip"`.
  - Streaming error recovery:
    ```javascript
    archive.on('error', (err) => {
      console.error('[DossierPackager] Archive streaming error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
      } else {
        res.end();
      }
    });
    ```
  - Connection close abort:
    ```javascript
    if (typeof res.on === 'function') {
      res.on('close', () => {
        if (typeof archive.abort === 'function') {
          try { archive.abort(); } catch (_) {}
        }
      });
    }
    ```
- **Empirical verification in `tests/challenger-m2-r2-empirical.test.js`**:
  - `Area 3.1`: Tested packaging with mixed records (1 `ACTIVE` achievement + 1 `RECORDED` award record matching distinct criteria). Output ZIP unpacked with `pizzip` contained both standardized evidence files (`01_[Chien_si_thi_dua_co_so]_[2025].pdf` and `02_[BangKhenBoGD2024]_[2024].pdf`).
  - `Area 3.2`: Stream failure recovery verified: when `res.headersSent === true`, archive error safely invokes `res.end()` without re-calling `res.status()`, preventing Express unhandled exception. When `res.headersSent === false`, returns HTTP 500 JSON.
  - `Area 3.3`: Client abort verified: emitting `close` on response triggers `archive.abort()`.
  - `Area 3.4`: Fallback handling: when no files exist, generates `01_[Ban_Tong_Hop_Minh_Chung]_[2026].pdf` within a valid ZIP archive.
  - `Area 3.5`: Deduplication: 2 criteria referencing the same evidence file produces exactly 1 deduplicated file in the ZIP bundle.
  - `Area 3.6`: Filename sanitization: path traversal characters (`/`, `\`, `<script>`, Vietnamese accents) are safely neutralized.

### 1.4 Test Suite Execution Results
Full combined test execution command:
```powershell
cd backend
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js tests/achievement-trash.integration.js tests/challenger-m2-r2-empirical.test.js
```
**Verbatim Output**:
```
✔ SQL Server achievement trash: owner restore, expiry, version, evidence retention and permanent cleanup (1239.5632ms)
✔ Achievement Vault: Trạng thái ACTIVE cho phép chính chủ sửa, xóa và quản lý minh chứng (2.2591ms)
✔ Achievement Vault: Người dùng khác không có quyền ADMIN không được sửa/xóa thành tích ACTIVE (0.3877ms)
✔ Achievement Vault: Quyền ADMIN được phép chỉnh sửa và dọn dẹp thành tích ACTIVE (0.3399ms)
✔ Achievement Repository: SQL Query tạo mới gán trạng thái ACTIVE ngay lập tức (1.0706ms)
✔ AI Vision Ingest: Fallback nhẹ nhàng khi buffer rỗng hoặc không có API key (1.6736ms)
✔ Achievement Routes: Các tuyến phê duyệt cũ bị bãi bỏ (HTTP 410 Decommissioned) (4.2082ms)
✔ Achievement Repository: SQL deleteAchievement & restoreAchievement cho phép xóa và khôi phục bản ghi ACTIVE (1.301ms)
✔ Achievement Service: Hỗ trợ vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong listCatalogs và listAchievements (4.265ms)
✔ Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records (3.7315ms)
✔ Auto-Discovery: Quét các quy chế mở và tính toán % hoàn thành chính xác (13.9286ms)
✔ Auto-Discovery: Xếp hạng giảm dần theo tỷ lệ % hoàn thành (27.2157ms)
✔ AI Criteria Evaluator: Chấp nhận hồ sơ thành tích trạng thái ACTIVE từ Kho cá nhân (5.5486ms)
✔ AI Criteria Evaluator: Tính toán chính xác missingCount khi chưa đủ số lượng yêu cầu (1.0583ms)
✔ AI Criteria Evaluator: Kết hợp cả ACTIVE, VERIFIED và RECORDED song song (0.4623ms)
✔ AI Criteria Evaluator: Loại trừ tuyệt đối REVOKED và CANCELLED khỏi matchedRecords (0.6865ms)
✔ reject impossible dates, inverted ranges, blank titles and forged ownership/system events (18.4202ms)
✔ all-day and multiday events include both boundary dates (0.5862ms)
✔ month navigation handles year rollover, leap years and Monday-first grids (0.8836ms)
✔ system calendar uses open award-period deadlines as read-only events (0.7872ms)
✔ Area 1.1: SQL text in achievementRepository.js enforces status IN (ACTIVE, DRAFT) on delete and restore (7.965ms)
✔ Area 1.2: SQL text in achievementTrashCleanup.js enforces status IN (ACTIVE, DRAFT) and excludes locked/linked records (4.3473ms)
✔ Area 1.3: Version collision (OCC) and stale version handling on deleteAchievement (17.9416ms)
✔ Area 1.4: Trash retention boundary (30 days) and restoreAchievement collision handling (1.9187ms)
✔ Area 2.1: Standard roles (MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN) allow listCatalogs, unauthorized roles are rejected (2.2194ms)
✔ Area 2.2: listAchievements enforces individual scope condition for MEMBER, DEPARTMENT_HEAD, and FACULTY_LEAD (2.0519ms)
✔ Area 2.3: ACTIONABLE workflow status filter explicitly includes ACTIVE, DRAFT, and NEED_CORRECTION (2.4715ms)
✔ Area 3.1: Dossier packaging with mixed records (achievements + award_records) bundles all valid evidence files (168.9121ms)
✔ Area 3.2: Dossier packager error recovery when streaming failure occurs after headersSent (2.3388ms)
✔ Area 3.3: Dossier packager connection close aborts archive stream without unhandled rejection (0.6742ms)
✔ Area 3.4: Dossier packager generates valid fallback PDF and ZIP when no files exist (92.4987ms)
✔ Area 1.5: Achievement with active submission or non-ACTIVE/DRAFT status cannot be deleted or restored (0.8828ms)
✔ Area 2.4: Cross-individual isolation: Member B cannot see Member A achievements in listAchievements (1.0458ms)
✔ Area 3.5: Multiple criteria referencing identical evidence file de-duplicates without file collision in ZIP (114.7681ms)
✔ Area 3.6: Complex Vietnamese strings and malicious path traversal in titles are safely sanitized (0.6501ms)
✔ CV only exposes selected profile data and achievements (3.2742ms)
✔ public CV hides revoked or legacy unverifiable achievements and does not expose IDs (0.5888ms)
✔ CV validates limits, template and experience fields (2.1378ms)
2026-11-12T15:36:07.226Z GET /api/v1/cv/invalid 404 6.535 ms - 201 [req-id: -]
✔ public CV route is accessible without login and rejects invalid links with noindex (98.9991ms)
✔ Dossier Packager: sanitizeFileName chuẩn hóa chuỗi tiếng Việt và loại bỏ ký tự nguy hiểm (1.5374ms)
✔ Dossier Packager: formatStandardizedFileName tạo định dạng chuẩn 01_[TenMinhChung]_[Nam].pdf (0.5881ms)
✔ Dossier Packager: buildDossierArchive nén tệp tin và tạo cấu trúc ZIP hợp lệ (152.7234ms)
✔ Dossier Packager: packageAndStreamDossierZip thiết lập đúng headers và stream file zip ra HTTP Response (71.0105ms)
✔ Strict validation: no forged status/source/owner, finite amounts and real dates (12.7362ms)
✔ CSV handles BOM, quotes, multiline, bad header/width and bounded input (2.4709ms)
✔ W4-Q1 [Ca 1]: Bộ đếm năm phân biệt bằng code xác định đạt chuẩn ELIGIBLE (4.6972ms)
✔ W4-Q1 [Ca 2]: Phát hiện gián đoạn chuỗi năm liên tiếp (YEAR_GAP) chuyển sang rà soát (1.3028ms)
✔ W4-Q1 [Ca 3]: Loại trừ tuyệt đối hồ sơ thu hồi (REVOKED / CANCELLED) (3.2979ms)
✔ W4-Q1 [Ca 4]: Quy tắc nghiệm thu: Thiếu chứng cứ KHÔNG mặc định không đạt (1.0187ms)
✔ W4-Q1 [Ca 5]: Tiêu chuẩn mô phỏng / chưa duyệt LHU luôn trả SIMULATION_ONLY hoặc UNCONFIRMED (0.6234ms)
✔ W4-Q1 [Ca 6]: Đối tượng EvaluationRun tuân thủ chuẩn W3-Q4 schema, cấm tự trao thưởng (25.3856ms)
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4886.8144
```

---

## 2. Logic Chain

1. **Từ Quan sát 1.1**:
   - Mệnh đề SQL `status IN ('ACTIVE', 'DRAFT')` trong `deleteAchievement`, `restoreAchievement` và `achievementTrashCleanup.js` đảm bảo bản ghi có trạng thái `ACTIVE` tham gia đầy đủ vòng đời: xóa mềm -> thùng rác 30 ngày -> khôi phục hoặc dọn dẹp vĩnh viễn.
   - Kiểm tra OCC thông qua `version = version + 1` và điều kiện `version = $3` (hoặc `$2`) ngăn chặn triệt để hiện tượng ghi đè bẩn (lost updates) và xóa/khôi phục trùng lặp khi có xung đột đồng thời.
   - Biên thời gian 30 ngày (`deleted_at > DATEADD(day, -30, SYSUTCDATETIME())`) được thực thi nghiêm ngặt: các bản ghi xóa dưới 30 ngày khôi phục thành công; quá 30 ngày bị chặn phục hồi và đưa vào danh sách dọn dẹp vật lý.

2. **Từ Quan sát 1.2**:
   - Việc bổ sung `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` vào `listCatalogs` và `listAchievements` đồng bộ hóa hoàn toàn với cấu trúc 4 vai trò chuẩn quy định tại R5.
   - Việc gắn `orConditions` dựa trên `lecturer_id` (với fallback `created_by`) đảm bảo nguyên tắc bảo mật Least Privilege và cách ly dữ liệu cá nhân (chỉ chủ hồ sơ mới thấy dữ liệu của mình, người ngoài không thể đọc trộm).
   - Bộ lọc `ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']` đưa thành tích cá nhân trạng thái `ACTIVE` vào danh sách thao tác trực tiếp của người dùng, đáp ứng đúng R1 ("hiển thị nhãn Sẵn sàng sử dụng").

3. **Từ Quan sát 1.3**:
   - Truy vấn kết hợp đồng thời `app.achievements` và `app.award_records` khắc phục triệt để khiếm khuyết thiếu đồng bộ giữa bộ máy đánh giá AI (`autoDiscoveryService`) và bộ đóng gói ZIP (`dossierPackagerService`).
   - Xử lý sự kiện `error` (gọi `res.end()` khi `res.headersSent === true`) và sự kiện `close` (gọi `archive.abort()`) loại bỏ hoàn toàn nguy cơ rò rỉ socket hoặc crash Node.js process khi người dùng ngắt kết nối đột ngột hoặc đường truyền mạng gặp sự cố.
   - Cơ chế fallback tạo file PDF tổng hợp và khử trùng lặp (de-duplication) đảm bảo file ZIP xuất ra luôn hợp lệ và mở được bởi các công cụ giải nén tiêu chuẩn.

4. **Từ Quan sát 1.4**:
   - Toàn bộ 51 test cases (gồm 36 test baseline và 15 test đối kháng do Challenger 2 trực tiếp xây dựng) đều vượt qua 100%, không phát sinh lỗi hồi quy, chứng minh tính ổn định và tính hoàn thiện cao của bản vá.

---

## 3. Caveats

- **API Vision bên ngoài**: Kiểm thử thực hiện trong môi trường không có khóa API thực tế, cơ chế Graceful Fallback (`fallback: true`, HTTP 200) được kích hoạt và kiểm chứng hoạt động chính xác theo yêu cầu R1.
- **Tính năng dọn dẹp file vật lý**: Được kiểm chứng qua `localStorageAdapter` với các đường dẫn an toàn (`resolveSafePath`). Nếu chuyển sang S3/MinIO trong tương lai, cần tích hợp adapter tương ứng.

---

## 4. Conclusion

Dựa trên toàn bộ kết quả phân tích mã nguồn, kiểm tra biên dữ liệu, và thực thi kiểm thử đối kháng thực tế:
- Cả 4 khiếm khuyết từ Iteration 1 đã được sửa đổi triệt để và an toàn.
- Hệ thống hoạt động chính xác theo đúng các yêu cầu R1, R2, R5 trong `ORIGINAL_REQUEST.md` và `PROJECT.md`.
- Độ bao phủ kiểm thử đối kháng đạt 51/51 tests pass (100%).

Phán quyết chính thức: **`CONFIRM`**.

---

## 5. Verification Method

### 5.1 Lệnh tái hiện độc lập (Independent Verification Command)
```powershell
cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js tests/achievement-trash.integration.js tests/challenger-m2-r2-empirical.test.js
```

### 5.2 Các tệp kiểm tra chính
- `backend/src/modules/achievements/achievementRepository.js`
- `backend/src/modules/achievements/achievementTrashCleanup.js`
- `backend/src/modules/achievements/achievementService.js`
- `backend/src/modules/ai/dossierPackagerService.js`
- `backend/tests/challenger-m2-r2-empirical.test.js`

### 5.3 Điều kiện vô hiệu hóa (Invalidation Conditions)
Phán quyết này bị vô hiệu nếu:
1. `deleteAchievement` hoặc `restoreAchievement` trong `achievementRepository.js` bị sửa đổi bỏ qua trạng thái `'ACTIVE'`.
2. Bất kỳ ai mang vai trò `MEMBER` bị chặn truy cập `listCatalogs` hoặc không thấy bản ghi của chính mình trong `listAchievements`.
3. Gói ZIP xuất ra từ `dossierPackagerService.js` bỏ sót các minh chứng từ `app.award_records`.
4. Stream ZIP gặp lỗi I/O làm sập tiến trình Express thay vì gọi `res.end()`.
