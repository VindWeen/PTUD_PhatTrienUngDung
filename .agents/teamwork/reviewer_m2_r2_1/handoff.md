# Handoff Report: Reviewer 1 — Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP) — Iteration 2

**Vai trò**: Reviewer 1 (Quality Reviewer & Adversarial Critic)  
**Ngày đánh giá**: 2026-11-12  
**Đối tượng nhận**: Sub-Orchestrator Milestone 2 (`b4442109-5705-4dae-83ed-e0f0f2dcfbf3`)  
**Thư mục làm việc**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**State folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_r2_1`  

---

## Review Summary

**Verdict**: **`APPROVE`**

Toàn bộ 4 nội dung khiếm khuyết được phát hiện ở Iteration 1 đã được Worker `worker_m2_r2` sửa đổi và hoàn thiện một cách triệt để, chính xác và có chiều sâu:
1. `backend/src/modules/achievements/achievementRepository.js`: Cả `deleteAchievement` và `restoreAchievement` đã sử dụng `AND status IN ('ACTIVE', 'DRAFT')`. Tệp liên đới `achievementTrashCleanup.js` cũng đã cập nhật `WHERE a.status IN ('ACTIVE', 'DRAFT')`.
2. `backend/src/modules/achievements/achievementService.js`: `listCatalogs` cho phép đầy đủ các vai trò chuẩn `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`. `listAchievements` mở rộng `isIndividual` bao quát các vai trò chuẩn với fallback an toàn `a.created_by = ${Number(user.userId)}`. Bộ lọc `ACTIONABLE` đã bao gồm `ACTIVE`.
3. `backend/src/modules/ai/dossierPackagerService.js`: Đồng bộ hóa hoàn toàn với `autoDiscoveryService.js`, truy vấn cả `app.achievements` và `app.award_records` (kèm file quyết định từ `app.award_decision_files`). Cơ chế stream ZIP đã bổ sung `res.end()` khi `res.headersSent` là `true` và `archive.abort()` khi socket đóng bất thường.
4. `backend/tests/achievement-vault-active.test.js`: Đã bổ sung 3 test cases mới (Test 7, Test 8, Test 9) bao quát SQL regex, vai trò chuẩn và đồng bộ dossier packager.

Kiểm toán tính liêm chính (Integrity Audit) xác nhận: Không có mã giả (dummy facade), không có hardcoded expected outputs, không có hành vi gian lận kết quả test.
Toàn bộ test suite chính thức (35/35 tests) và integration test trên SQL Server thực tế (1/1 test) đều đạt 100% pass.

---

## 1. Observation (Quan Sát Trực Tiếp)

### 1.1 Khắc phục Khiếm khuyết 1: Xóa và khôi phục thành tích trạng thái ACTIVE trên Database
- **Tệp**: `backend/src/modules/achievements/achievementRepository.js:472-483`
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
- **Tệp liên đới**: `backend/src/modules/achievements/achievementTrashCleanup.js:8`
  ```javascript
  WHERE a.status IN ('ACTIVE', 'DRAFT') AND a.deleted_at <= DATEADD(day, -30, SYSUTCDATETIME())
  ```
- **Xác minh thực tế**: Kiểm tra qua bài test tích hợp live transaction trên Microsoft SQL Server (`backend/tests/achievement-trash.integration.js`):
  Tạo bản ghi `ACTIVE` $\to$ gọi `service.deleteAchievement` (chuyển vào thùng rác thành công) $\to$ gọi `service.restoreAchievement` (khôi phục thành công với `status = 'ACTIVE'`) $\to$ xóa lại và dọn dẹp sau 30 ngày (xóa vĩnh viễn thành công). Toàn bộ luồng kết thúc mã 0 trong 536ms.

### 1.2 Khắc phục Khiếm khuyết 2: Vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong `achievementService.js`
- **Tệp**: `backend/src/modules/achievements/achievementService.js:28-30`
  ```javascript
  async function listCatalogs(user) {
    const active = (await roles(user.userId)).map(r => typeof r === 'string' ? r : r.Code || r.code);
    if (!active.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'].includes(r)))
      throw new ForbiddenError('Không có quyền đọc danh mục thành tích');
    return repo.listActiveTypes();
  }
  ```
- **Tệp**: `backend/src/modules/achievements/achievementService.js:48, 55-71`
  ```javascript
  filters.statuses = { ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION'], PENDING: ['SUBMITTED'], VERIFIED: ['VERIFIED'], ENDED: ['REJECTED', 'REVOKED', 'CANCELLED'] }[queryParams.workflow];
  ...
  const isIndividual = roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r));
  ...
  if (isIndividual) {
    const lecturerProfile = await repo.findLecturerByUserId(user.userId);
    if (lecturerProfile) {
      myLecturerId = lecturerProfile.lecturerId;
      orConditions.push(`a.lecturer_id = ${myLecturerId}`);
    } else if (user.userId && Number.isSafeInteger(Number(user.userId))) {
      orConditions.push(`a.created_by = ${Number(user.userId)}`);
    }
  }
  ```
- **Xác minh thực tế**:
  1. Người dùng mang vai trò thuần `MEMBER` gọi `listCatalogs` nhận kết quả hợp lệ, không bị ném `ForbiddenError`.
  2. Người dùng `MEMBER` không có hồ sơ trong bảng `lecturers` tự động kích hoạt fallback an toàn `a.created_by = ${user.userId}` (có `Number.isSafeInteger` chống SQL injection), không còn bị trả về danh sách rỗng `{ items: [] }`.
  3. Khi gọi `listAchievements` với `workflow: 'ACTIONABLE'`, bộ lọc bao gồm cả `ACTIVE`, `DRAFT`, `NEED_CORRECTION`.

### 1.3 Khắc phục Khiếm khuyết 3: Đồng bộ hóa `dossierPackagerService.js` với `autoDiscoveryService.js`
- **Tệp**: `backend/src/modules/ai/dossierPackagerService.js:154-211`
  Đã bổ sung câu lệnh truy vấn song song `app.achievements` (`achSql`) và `app.award_records` (`awardSql`), trích xuất các trường `decision_file_id`, `sha256_hash`, `original_file_name`, `storage_key`, `file_extension` từ `app.award_decision_files`, sau đó hợp nhất vào mảng `records`.
- **Tệp**: `backend/src/modules/ai/dossierPackagerService.js:292-309`
  ```javascript
  archive.on('error', (err) => {
    console.error('[DossierPackager] Archive streaming error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
    } else {
      res.end();
    }
  });

  if (typeof res.on === 'function') {
    res.on('close', () => {
      if (typeof archive.abort === 'function') {
        try {
          archive.abort();
        } catch (_) {}
      }
    });
  }
  ```
- **Xác minh thực tế (Adversarial Script Execution)**:
  Đã thiết lập kịch bản đối kháng độc lập: Quy chế thi đua yêu cầu tiêu chí từ nguồn `AWARD_RECORD` (Chiến sĩ thi đua cấp cơ sở năm 2025). Dịch vụ `packageAndStreamDossierZip` đã định vị chính xác file quyết định khen thưởng, đánh giá tiêu chí đạt và nén tệp tin `01_[Chien_si_thi_dua_cap_co_so]_[2025].pdf` vào gói ZIP xuất ra. Khi stream lỗi sau khi `headersSent = true`, `res.end()` được gọi lập tức, ngăn ngừa triệt để hiện tượng treo socket HTTP.

### 1.4 Kiểm tra độc lập Bộ Kiểm Thử
- **Lệnh thực thi**:
  ```powershell
  cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
  node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js
  ```
- **Kết quả ghi nhận**:
  `tests 35`, `pass 35`, `fail 0`, `duration_ms: ~3412ms`. 100% tests vượt qua.
- **Lệnh kiểm tra bổ sung đối kháng & rác dữ liệu**:
  ```powershell
  node --test tests/achievement-trash.integration.js tests/adversarial-vault-permissions.test.js tests/adversarial-ai-evaluator.test.js tests/challenger-m2-adversarial.test.js
  ```
  `tests 32`, `pass 32`, `fail 0`, `duration_ms: ~2939ms`. 100% tests vượt qua.

---

## 2. Logic Chain (Chuỗi Lập Luận Đánh Giá)

1. **Khắc phục lỗi xóa/khôi phục ACTIVE**:
   - Từ Quan sát 1.1, câu lệnh UPDATE trong `achievementRepository.js` và DELETE trong `achievementTrashCleanup.js` đã mở rộng điều kiện lọc sang `status IN ('ACTIVE', 'DRAFT')`.
   - Kết quả là bản ghi thành tích mới tạo (`status = 'ACTIVE'`) khi bị xóa sẽ được gán `deleted_at`, ghi `version = version + 1`, và có thể được khôi phục nguyên vẹn bởi chủ sở hữu trong 30 ngày.
   - Thao tác này đã được kiểm chứng trên cả tầng Unit Test (kiểm tra regex ràng buộc) và tầng Integration Test (thực thi truy vấn SQL Server trực tiếp với rollback). Logic hoàn toàn nhất quán giữa Service và Database.

2. **Khắc phục phân quyền vai trò chuẩn**:
   - Từ Quan sát 1.2, Milestone 1 đã chuẩn hóa 4 vai trò chính (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
   - Việc thêm `['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD']` vào `listCatalogs` và gom nhóm `isIndividual` trong `listAchievements` đảm bảo người dùng thông thường không bị chặn 403 Forbidden khi tải giao diện và luôn nhìn thấy thành tích cá nhân của mình.
   - Fallback `created_by = ${user.userId}` (với kiểm tra `Number.isSafeInteger`) giải quyết triệt để trường hợp người dùng chưa được map vào bảng `lecturers`.
   - Bổ sung `ACTIVE` vào `ACTIONABLE` workflow giúp giao diện hiển thị ngay các thành tích sẵn sàng sử dụng.

3. **Khắc phục đồng bộ nguồn hồ sơ cho Dossier Packager**:
   - Từ Quan sát 1.3, `dossierPackagerService` giờ đây nạp đủ 2 nguồn hồ sơ tương thích 100% với `autoDiscoveryService.js` và `aiService.js`.
   - Khi một tiêu chí yêu cầu bằng chứng từ `AWARD_RECORD` (quyết định khen thưởng), hệ thống trích xuất file quyết định từ `app.award_decision_files` và đóng gói với tên chuẩn `XX_[Ten]_[Nam].pdf`.
   - Xử lý lỗi `res.end()` và `archive.abort()` bảo vệ server khỏi rò rỉ tài nguyên (resource leak) và treo kết nối HTTP.

4. **Kiểm toán Liêm chính & Đối kháng (Integrity & Adversarial Review)**:
   - Tất cả các trường dữ liệu đều được sinh ra từ quá trình tính toán logic thật (không có mock cố định `return { pass: true }` hay hardcoded IDs).
   - Kiểm tra OCC (Optimistic Concurrency Control) ngăn chặn race condition khi nhiều người dùng hoặc tiến trình đồng thời thao tác trên cùng một bản ghi.

---

## 3. Caveats (Giả Định & Điểm Chưa Khảo Sát)

- **Groq / Gemini Vision API live credentials**: Môi trường CI/CD local không cấu hình sẵn API key thương mại. Cơ chế Graceful Fallback (`HTTP 200`, `fallback: true`, `data: null`) đã được kiểm thử và đáp ứng hoàn toàn yêu cầu nghiệp vụ R1.
- **Vệ sinh tên tệp tin (Minor Observation)**: Trong hàm `sanitizeFileName`, chuỗi `..` chưa bị gộp thành `_` (chỉ các ký tự `/`, `\`, v.v. bị đổi thành `_`). Tuy nhiên do tệp tin được gói vào root của ZIP và không chứa dấu gạch chéo `/`, rủi ro Zip Slip / Path Traversal là không tồn tại. Đề xuất nhóm cân nhắc bổ sung regex `.replace(/\.{2,}/g, '_')` trong các đợt hoàn thiện frontend/backend sau này.

---

## 4. Conclusion (Kết Luận Thẩm Định)

### Kết luận:
**`APPROVE`** — Nghiệm thu thành công Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP) — Iteration 2.

Hệ thống đã đạt toàn bộ các tiêu chí chấp thuận (Acceptance Criteria) của R1 và R2:
- Kho thành tích cá nhân gán trạng thái `ACTIVE` ngay lập tức, hỗ trợ xóa mềm, khôi phục trong 30 ngày và dọn dẹp rác tự động.
- AI Vision Fallback hoạt động tin cậy và không làm gián đoạn luồng sử dụng.
- Khám quy chế và Khám ngược (Auto-Discovery) tính toán chính xác % và xếp hạng giảm dần.
- Xuất gói minh chứng (.ZIP) nén đầy đủ bằng chứng từ cả `app.achievements` và `app.award_records` với định dạng chuẩn hóa `01_[TenMinhChung]_[Nam].pdf`.
- Phân quyền vai trò chuẩn `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` hoạt động hoàn hảo.

---

## 5. Verification Method (Phương Pháp Tái Kiểm Minh Độc Lập)

Bất kỳ reviewer, auditor hoặc orchestrator nào cũng có thể kiểm chứng độc lập báo cáo này bằng cách thực thi chuỗi lệnh sau tại thư mục gốc:

```powershell
cd backend
# 1. Chạy toàn bộ 35 bài test chính thức của Milestone 2
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js

# 2. Chạy kiểm thử tích hợp giao dịch thực trên Microsoft SQL Server
node --test tests/achievement-trash.integration.js

# 3. Chạy toàn bộ bộ kiểm thử đối kháng và bảo mật
node --test tests/adversarial-vault-permissions.test.js tests/adversarial-ai-evaluator.test.js tests/challenger-m2-adversarial.test.js
```

**Điều kiện nghiệm thu đạt**:
- Toàn bộ 68 test cases đều trả về `pass` (0 fail, mã thoát 0).
- Không có exception hay unhandled rejection nào trong quá trình stream ZIP.
