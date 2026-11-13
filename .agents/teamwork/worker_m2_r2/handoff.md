# Handoff Report: Milestone 2 Backend Core Modules — Iteration 2 Remediation

**Worker**: `worker_m2_r2` (Implementer / QA)  
**Date**: 2026-11-12  
**Target Recipient**: Sub-Orchestrator Milestone 2 (`b4442109-5705-4dae-83ed-e0f0f2dcfbf3`)  
**Working Directory**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**State Folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\worker_m2_r2`  

---

## 1. Observation

### 1.1 Remediation Finding 1: Xóa và khôi phục thành tích trạng thái ACTIVE trên Database
- **Tệp**: `backend/src/modules/achievements/achievementRepository.js:474, 480`
- **Mã nguồn trước sửa đổi**:
  ```javascript
  export async function deleteAchievement(id, userId, version) {
    const result = await query(`UPDATE app.achievements SET deleted_at = SYSUTCDATETIME(), deleted_by = $2, updated_at = SYSUTCDATETIME(), version = version + 1
      OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $3 AND status = 'DRAFT' AND deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = app.achievements.achievement_id)`, [id, userId, version]);
    return result.rowCount > 0;
  }
  export async function restoreAchievement(id, version) {
    const result = await query(`UPDATE app.achievements SET deleted_at = NULL, deleted_by = NULL, updated_at = SYSUTCDATETIME(), version = version + 1
      OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $2 AND status = 'DRAFT'
      AND deleted_at > DATEADD(day, -30, SYSUTCDATETIME())`, [id, version]);
    return result.rowCount > 0;
  }
  ```
- **Triển khai khắc phục**:
  Cả hai câu lệnh UPDATE được chuyển thành `AND status IN ('ACTIVE', 'DRAFT')`.
  Đồng thời, rà soát phát hiện tệp liên đới `backend/src/modules/achievements/achievementTrashCleanup.js:8` cũng có câu truy vấn lọc rác hết hạn cứng `WHERE a.status = 'DRAFT'` khiến các thành tích `ACTIVE` trong thùng rác không được dọn dẹp sau 30 ngày. Đã cập nhật thành `WHERE a.status IN ('ACTIVE', 'DRAFT')`.

### 1.2 Remediation Finding 2: Quyền vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong `achievementService.js`
- **Tệp**: `backend/src/modules/achievements/achievementService.js:28-30, 48, 54-71`
- **Mã nguồn trước sửa đổi**:
  - `listCatalogs`: Chỉ cho phép danh sách vai trò cũ `['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN']`.
  - `filters.statuses`: `ACTIONABLE: ['DRAFT', 'NEED_CORRECTION']`.
  - `listAchievements`: Chỉ kiểm tra `if (isLecturer || isManager || isUnitRep)`, bỏ qua các vai trò mới chuẩn hóa trong Milestone 1 (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`).
- **Triển khai khắc phục**:
  - Dòng 29: Cho phép `['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN']`.
  - Dòng 48: Cập nhật `ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']`.
  - Dòng 55-71: Thêm `const isIndividual = roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r));` và nạp điều kiện `a.lecturer_id = ${myLecturerId}` (hoặc fallback `a.created_by = ${user.userId}`) vào `orConditions`.

### 1.3 Remediation Finding 3: Đồng bộ `dossierPackagerService.js` với `autoDiscoveryService.js` và `aiService.js`
- **Tệp**: `backend/src/modules/ai/dossierPackagerService.js:154-195, 267-275`
- **Mã nguồn trước sửa đổi**:
  - Chỉ truy vấn đơn lẻ `app.achievements`, bỏ qua toàn bộ bảng `app.award_records` và `app.award_decision_files`.
  - Sự kiện `archive.on('error')` không gọi `res.end()` khi `res.headersSent` là `true`.
- **Triển khai khắc phục**:
  - Bổ sung truy vấn `app.award_records` kèm subquery lấy file quyết định khen thưởng từ `app.award_decision_files` (lấy các trường `decision_file_id`, `sha256_hash`, `original_file_name`, `storage_key`, `file_extension`).
  - Kết hợp đồng thời bản ghi từ cả 2 nguồn vào mảng `records` chuẩn bị cho bước thẩm định `evaluateStructuredCriterion`.
  - Trong `archive.on('error')`, thêm nhánh `else { res.end(); }` và lắng nghe sự kiện `res.on('close')` để gọi `archive.abort()` nếu có lỗi bất thường ngắt kết nối.

### 1.4 Remediation Finding 4: Bổ sung Unit/Integration Tests trong `achievement-vault-active.test.js`
- **Tệp**: `backend/tests/achievement-vault-active.test.js`
- **Triển khai**:
  - Thêm test case 7: `Achievement Repository: SQL deleteAchievement & restoreAchievement cho phép xóa và khôi phục bản ghi ACTIVE` (kiểm tra regex ràng buộc SQL trong `achievementRepository.js` và `achievementTrashCleanup.js`).
  - Thêm test case 8: `Achievement Service: Hỗ trợ vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong listCatalogs và listAchievements` (kiểm tra đọc catalogs cho cả 3 role, kiểm tra `scopeCondition` nạp đúng `lecturer_id`, kiểm tra workflow `ACTIONABLE` chứa `ACTIVE`).
  - Thêm test case 9: `Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records` (kiểm tra packager truy vấn đầy đủ cả 2 bảng và xử lý `res.end()` khi lỗi).

---

## 2. Logic Chain

1. **Từ Quan sát 1.1**:
   - Khi tạo mới thành tích cá nhân, hệ thống gán trực tiếp trạng thái `'ACTIVE'`.
   - Trước khi sửa, lệnh SQL xóa mềm và khôi phục trong `achievementRepository.js` gán cứng `status = 'DRAFT'`. Do đó, câu lệnh `UPDATE` trên bản ghi `ACTIVE` trả về `rowCount === 0`.
   - Tầng Service nhận `deleted === false` và ném `ConflictError('Không thể xóa bản ghi thành tích')`.
   - Bằng việc thay thế bằng mệnh đề `status IN ('ACTIVE', 'DRAFT')` tại dòng 474 và 480 của `achievementRepository.js`, và dòng 8 của `achievementTrashCleanup.js`, các bản ghi `ACTIVE` giờ đây có thể được xóa vào thùng rác, khôi phục trong vòng 30 ngày, và được dọn dẹp vĩnh viễn khi hết hạn một cách nhất quán.

2. **Từ Quan sát 1.2**:
   - Milestone 1 đã chuyển đổi vai trò người dùng sang 4 vai trò chuẩn: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
   - Trước khi sửa, `achievementService.js` kiểm tra vai trò cứng theo mã cũ `LECTURER`, dẫn đến người dùng mang vai trò `MEMBER` bị ném lỗi 403 Forbidden khi tải danh mục loại thành tích và nhận danh sách rỗng `{ items: [] }` khi mở kho cá nhân.
   - Thêm `isIndividual` bao quát các vai trò chuẩn giúp thành viên bình thường truy cập trơn tru danh mục loại thành tích và kho lưu trữ của chính mình.
   - Bổ sung `'ACTIVE'` vào bộ lọc trạng thái `ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']` giúp các thành tích cá nhân hiển thị ngay trong danh sách thao tác của người dùng.

3. **Từ Quan sát 1.3**:
   - AI Auto-Discovery (`autoDiscoveryService.js`) và AI Gap Analysis (`aiService.js`) đọc cả hai nguồn: thành tích cá nhân (`app.achievements`) và danh hiệu khen thưởng đã được cấp từ quyết định khen thưởng (`app.award_records`).
   - Trước khi sửa, `dossierPackagerService.js` chỉ đọc `app.achievements`. Nếu một quy chế đòi hỏi danh hiệu đã đạt trong quá khứ lưu ở `award_records`, Auto-Discovery tính toán đạt 100%, nhưng khi người dùng tải gói minh chứng ZIP thì tiêu chí đó bị đánh giá thiếu minh chứng.
   - Việc bổ sung truy vấn `app.award_records` và file đính kèm từ `app.award_decision_files` đảm bảo sự đồng bộ 100% giữa khâu rà soát khám phá và khâu xuất gói hồ sơ minh chứng.
   - Việc thêm `res.end()` và `archive.abort()` giải quyết triệt để nguy cơ treo kết nối HTTP streaming khi có lỗi I/O phát sinh.

4. **Từ Quan sát 1.4**:
   - 3 bài test mới trong `achievement-vault-active.test.js` và việc chạy qua toàn bộ test suite (bao gồm `achievement-trash.integration.js`, `adversarial-vault-permissions.test.js`, `adversarial-ai-evaluator.test.js`, `challenger-m2-adversarial.test.js`) xác nhận toàn bộ các kịch bản đối kháng và biên dữ liệu đều đạt chuẩn.

---

## 3. Caveats

- **API Vision thật**: Môi trường local sử dụng graceful fallback khi không có `GROQ_API_KEY` hoặc `GEMINI_API_KEY`, trả về HTTP 200 `{ success: true, fallback: true, data: null }` hướng dẫn người dùng nhập tay đúng thiết kế R1.
- **Không có thay đổi cấu trúc Database**: Các thay đổi chỉ can thiệp tầng logic SQL và Express Service của Backend, không yêu cầu chạy thêm migration DB mới vì schema hiện tại đã có đầy đủ các cột và bảng tương ứng.

---

## 4. Conclusion

Tất cả 4 khiếm khuyết được chỉ ra bởi Reviewer 1, Reviewer 2 và Forensic Auditor trong Iteration 1 đã được giải quyết dứt điểm và triệt để:
1. `achievementRepository.js`: `deleteAchievement` & `restoreAchievement` hoạt động chuẩn xác với trạng thái `ACTIVE` và `DRAFT`.
2. `achievementService.js`: Hỗ trợ đầy đủ các vai trò chuẩn `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`; bộ lọc `ACTIONABLE` chứa `ACTIVE`.
3. `dossierPackagerService.js`: Đồng bộ hóa hoàn toàn với `autoDiscoveryService.js`, nạp cả `app.achievements` và `app.award_records`; hoàn thiện error handling cho HTTP stream.
4. `achievement-vault-active.test.js`: Đã bổ sung 3 test cases mới, nâng tổng số test suite chính thức lên 35 tests (100% pass, 0 fail).
5. `achievementTrashCleanup.js` & `achievement-trash.integration.js`: Đã mở rộng dọn dẹp thùng rác cho cả bản ghi `ACTIVE` quá hạn và kiểm chứng thành công.

---

## 5. Verification Method

### 5.1 Lệnh kiểm thử chính thức (Test Execution Command)
Thực thi tại thư mục `backend/`:
```powershell
cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js
```

### 5.2 Kết quả thực tế ghi nhận (Verbatim Test Output)
```
✔ Achievement Vault: Trạng thái ACTIVE cho phép chính chủ sửa, xóa và quản lý minh chứng (2.5738ms)
✔ Achievement Vault: Người dùng khác không có quyền ADMIN không được sửa/xóa thành tích ACTIVE (0.4031ms)
✔ Achievement Vault: Quyền ADMIN được phép chỉnh sửa và dọn dẹp thành tích ACTIVE (0.3379ms)
✔ Achievement Repository: SQL Query tạo mới gán trạng thái ACTIVE ngay lập tức (2.0022ms)
✔ AI Vision Ingest: Fallback nhẹ nhàng khi buffer rỗng hoặc không có API key (1.0985ms)
✔ Achievement Routes: Các tuyến phê duyệt cũ bị bãi bỏ (HTTP 410 Decommissioned) (0.6641ms)
✔ Achievement Repository: SQL deleteAchievement & restoreAchievement cho phép xóa và khôi phục bản ghi ACTIVE (1.3292ms)
✔ Achievement Service: Hỗ trợ vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong listCatalogs và listAchievements (6.7459ms)
✔ Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records (1.4911ms)
✔ Auto-Discovery: Quét các quy chế mở và tính toán % hoàn thành chính xác (8.0823ms)
✔ Auto-Discovery: Xếp hạng giảm dần theo tỷ lệ % hoàn thành (26.8991ms)
✔ AI Criteria Evaluator: Chấp nhận hồ sơ thành tích trạng thái ACTIVE từ Kho cá nhân (7.1312ms)
✔ AI Criteria Evaluator: Tính toán chính xác missingCount khi chưa đủ số lượng yêu cầu (1.8333ms)
✔ AI Criteria Evaluator: Kết hợp cả ACTIVE, VERIFIED và RECORDED song song (0.8137ms)
✔ AI Criteria Evaluator: Loại trừ tuyệt đối REVOKED và CANCELLED khỏi matchedRecords (0.9426ms)
✔ reject impossible dates, inverted ranges, blank titles and forged ownership/system events (4.6738ms)
✔ all-day and multiday events include both boundary dates (0.468ms)
✔ month navigation handles year rollover, leap years and Monday-first grids (0.7512ms)
✔ system calendar uses open award-period deadlines as read-only events (0.6508ms)
✔ CV only exposes selected profile data and achievements (3.8584ms)
✔ public CV hides revoked or legacy unverifiable achievements and does not expose IDs (0.5307ms)
✔ CV validates limits, template and experience fields (1.9072ms)
2026-11-12T15:21:39.729Z GET /api/v1/cv/invalid 404 6.073 ms - 201 [req-id: -]
✔ public CV route is accessible without login and rejects invalid links with noindex (80.91ms)
✔ Dossier Packager: sanitizeFileName chuẩn hóa chuỗi tiếng Việt và loại bỏ ký tự nguy hiểm (2.4645ms)
✔ Dossier Packager: formatStandardizedFileName tạo định dạng chuẩn 01_[TenMinhChung]_[Nam].pdf (0.6439ms)
✔ Dossier Packager: buildDossierArchive nén tệp tin và tạo cấu trúc ZIP hợp lệ (38.4976ms)
✔ Dossier Packager: packageAndStreamDossierZip thiết lập đúng headers và stream file zip ra HTTP Response (71.2746ms)
✔ Strict validation: no forged status/source/owner, finite amounts and real dates (14.0808ms)
✔ CSV handles BOM, quotes, multiline, bad header/width and bounded input (2.1304ms)
✔ W4-Q1 [Ca 1]: Bộ đếm năm phân biệt bằng code xác định đạt chuẩn ELIGIBLE (4.4526ms)
✔ W4-Q1 [Ca 2]: Phát hiện gián đoạn chuỗi năm liên tiếp (YEAR_GAP) chuyển sang rà soát (0.6529ms)
✔ W4-Q1 [Ca 3]: Loại trừ tuyệt đối hồ sơ thu hồi (REVOKED / CANCELLED) (0.5016ms)
✔ W4-Q1 [Ca 4]: Quy tắc nghiệm thu: Thiếu chứng cứ KHÔNG mặc định không đạt (0.9882ms)
✔ W4-Q1 [Ca 5]: Tiêu chuẩn mô phỏng / chưa duyệt LHU luôn trả SIMULATION_ONLY hoặc UNCONFIRMED (0.871ms)
✔ W4-Q1 [Ca 6]: Đối tượng EvaluationRun tuân thủ chuẩn W3-Q4 schema, cấm tự trao thưởng (9.5159ms)
ℹ tests 35
ℹ suites 0
ℹ pass 35
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2757.8844
```

### 5.3 Lệnh kiểm tra kiểm thử hồi quy & đối kháng mở rộng
```powershell
cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
node --test tests/achievement-trash.integration.js tests/adversarial-vault-permissions.test.js tests/adversarial-ai-evaluator.test.js tests/challenger-m2-adversarial.test.js
```
Kết quả: 32/32 tests pass (100% pass, 0 fail).

### 5.4 Điều kiện vô hiệu hóa (Invalidation Conditions)
Báo cáo này bị vô hiệu nếu:
1. `deleteAchievement` hoặc `restoreAchievement` trong `achievementRepository.js` bị hoàn nguyên về `status = 'DRAFT'`.
2. Người dùng chỉ mang vai trò `MEMBER` bị từ chối đọc danh mục thành tích (`listCatalogs`) hoặc nhận danh sách rỗng trong `listAchievements`.
3. `dossierPackagerService.js` không đọc được dữ liệu `app.award_records` dẫn đến thiếu bằng chứng khi xuất ZIP.
