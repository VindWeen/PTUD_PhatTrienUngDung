# Handoff Report: Reviewer 1 — Milestone 2: Backend Core Modules

**Vai trò**: Reviewer & Adversarial Critic  
**Ngày đánh giá**: 2026-11-12  
**Đối tượng bàn giao**: Sub-Orchestrator Milestone 2 (`83c8f951-06e2-4a54-989d-22102953315c`) & Worker M2 (`worker_m2_1`)  
**Thư mục làm việc**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**State folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_1`  

---

## Review Summary

**Verdict**: **`REQUEST_CHANGES`**

Hệ thống đã triển khai được phần lớn khối lượng công việc theo yêu cầu R1 và R2 (ESM dependencies, AI Vision Fallback, Criteria Evaluator `ACTIVE` & `matchedRecords`/`missingCount`, Auto-Discovery xếp hạng %, và Dossier ZIP stream). Toàn bộ 32 unit tests chạy qua (`pass 32, fail 0`). Không phát hiện hành vi gian lận cố ý (hardcoded outputs hay dummy facade).

Tuy nhiên, qua rà soát đối kháng chuyên sâu (Adversarial Stress-Testing) trên tầng tương tác dữ liệu thực tế, phát hiện **1 lỗi nghiêm trọng (Critical)** vi phạm trực tiếp Điều kiện vô hiệu hóa (Invalidation Condition) trong báo cáo của Worker, cùng **2 lỗi lớn (Major)** và **1 lỗi nhỏ (Minor)** ảnh hưởng đến tính toàn vẹn của nghiệp vụ.

---

## 1. Observation (Quan Sát Trực Tiếp)

### 1.1 Kiểm tra độc lập Bộ Kiểm Thử
- **Lệnh thực thi**:
  ```powershell
  cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
  node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js
  ```
- **Kết quả ghi nhận**:
  `pass 32`, `fail 0`, `duration_ms: ~3022ms`. 100% tests vượt qua.
- **Quan sát mã kiểm thử**:
  Trong `tests/achievement-vault-active.test.js`, bài test quyền xóa (dòng 12-38) chỉ gọi hàm `createPermissionResolver` trên đối tượng JavaScript in-memory; hoàn toàn **không gọi** hàm `deleteAchievement` của `achievementService` hay `achievementRepository`.

### 1.2 Khiếm khuyết tầng Repository (`achievementRepository.js`)
- Tệp: `backend/src/modules/achievements/achievementRepository.js:472-483`
- Mã nguồn hiện tại:
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
- **Phát hiện**: Cả hai câu truy vấn SQL đều cố định điều kiện `AND status = 'DRAFT'`.

### 1.3 Khiếm khuyết phân quyền vai trò chuẩn (`achievementService.js`)
- Tệp: `backend/src/modules/achievements/achievementService.js:28-30`
  ```javascript
  const active = (await roles(user.userId)).map(r => typeof r === 'string' ? r : r.Code || r.code);
  if (!active.some(r => ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'].includes(r)))
    throw new ForbiddenError('Không có quyền đọc danh mục thành tích');
  ```
  Vai trò chuẩn `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` không có trong danh sách cho phép đọc catalog thành tích.
- Tệp: `backend/src/modules/achievements/achievementService.js:50-68`
  ```javascript
  const isAdmin = roles.includes('ADMIN');
  const isManager = roles.includes('MANAGER');
  const isRecordsOfficer = roles.includes('RECORDS_OFFICER');
  const isUnitRep = roles.includes('UNIT_REPRESENTATIVE');
  const isLecturer = roles.includes('LECTURER');

  if (!isAdmin) {
    const orConditions = [];
    if (isLecturer || isManager || isUnitRep) {
      const lecturerProfile = await repo.findLecturerByUserId(user.userId);
      if (lecturerProfile) {
        myLecturerId = lecturerProfile.lecturerId;
        orConditions.push(`a.lecturer_id = ${myLecturerId}`);
      }
    }
  ...
    if (orConditions.length === 0) {
      return { items: [], pagination: { total: 0, page: queryParams.page, pageSize: queryParams.pageSize, totalPages: 0 } };
    }
  ```
  Người dùng đăng nhập với vai trò chuẩn mới `MEMBER`, `DEPARTMENT_HEAD` hoặc `FACULTY_LEAD` (không có role cũ `LECTURER`) thì `isLecturer` trả về `false`, `orConditions` rỗng, dẫn đến danh sách trả về luôn rỗng `{ items: [] }`.

### 1.4 Thiếu sót đồng bộ giữa AI Discovery và Dossier Packager
- Tệp: `backend/src/modules/ai/autoDiscoveryService.js:52-87` và `backend/src/modules/ai/aiService.js:346-379`
  Truy vấn cả `app.achievements` VÀ `app.award_records` để nạp danh sách hồ sơ nguồn vào `evaluateStructuredCriterion`.
- Tệp: `backend/src/modules/ai/dossierPackagerService.js:154-187`
  Chỉ truy vấn duy nhất `app.achievements` (`achSql`), hoàn toàn bỏ qua `app.award_records`.

### 1.5 Xử lý lỗi luồng nén ZIP HTTP (`dossierPackagerService.js`)
- Tệp: `backend/src/modules/ai/dossierPackagerService.js:267-273`
  ```javascript
  archive.on('error', (err) => {
    console.error('[DossierPackager] Archive streaming error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
    }
  });
  ```
  Nếu `res.headersSent` đã là `true` (do đã pipe dữ liệu nén trước khi lỗi xảy ra trong stream), nhánh `else` không gọi `res.end()` hoặc `res.destroy(err)`, khiến kết nối HTTP có nguy cơ bị treo lơ lửng.

---

## 2. Findings (Chi Tiết Phát Hiện)

### [Critical] Finding 1: Không thể Xóa hoặc Khôi phục thành tích trạng thái ACTIVE trên Database

- **Vị trí**: `backend/src/modules/achievements/achievementRepository.js:474, 480`
- **Mức độ**: **Critical** (Chặn tính năng cốt lõi của R1)
- **Bản chất**:
  Trong Milestone 2, `createAchievement` đã đổi sang gán mặc định `status = 'ACTIVE'`.
  Hàm `achievementPermissions.js` cho phép `remove: true` đối với `['ACTIVE', 'DRAFT']`.
  Hàm `achievementService.deleteAchievement` cho phép xóa hồ sơ ở `['ACTIVE', 'DRAFT']`.
  Nhưng khi service gọi xuống `repo.deleteAchievement(id, user.userId, version)`, câu SQL thực thi là:
  ```sql
  UPDATE app.achievements SET deleted_at = SYSUTCDATETIME() ... WHERE achievement_id = $1 AND version = $3 AND status = 'DRAFT'
  ```
  Do thành tích có `status = 'ACTIVE'`, câu lệnh UPDATE khớp 0 bản ghi (`rowCount === 0`). `deleteAchievement` trả về `false`.
  `achievementService.js:349-351` lập tức ném lỗi:
  ```javascript
  if (!deleted) throw new ConflictError('Không thể xóa bản ghi thành tích');
  ```
  Tương tự, hàm `restoreAchievement` cũng gán cứng `status = 'DRAFT'`.
- **Hậu quả**: Bất kỳ người dùng hoặc admin nào thao tác xóa thành tích `ACTIVE` trong kho lưu trữ đều bị báo lỗi thất bại. Đây là vi phạm trực tiếp Điều kiện vô hiệu hóa trong handoff của Worker: *"Hồ sơ ACTIVE bị chặn chỉnh sửa hoặc xóa bởi chính chủ sở hữu"*.
- **Giải pháp khắc phục**:
  Trong `achievementRepository.js`:
  1. Đổi `AND status = 'DRAFT'` thành `AND status IN ('ACTIVE', 'DRAFT')` tại dòng 474 (`deleteAchievement`).
  2. Đổi `AND status = 'DRAFT'` thành `AND status IN ('ACTIVE', 'DRAFT')` tại dòng 480 (`restoreAchievement`).
  3. Bổ sung bài test tích hợp xóa thành tích `ACTIVE` trong `tests/achievement-vault-active.test.js`.

---

### [Major] Finding 2: Vai trò chuẩn MEMBER bị chặn truy cập Kho thành tích trong `achievementService.js`

- **Vị trí**: `backend/src/modules/achievements/achievementService.js:28-30, 50-68`
- **Mức độ**: **Major**
- **Bản chất**:
  Migration 005 chuẩn hóa 4 vai trò chính: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` và vô hiệu hóa các vai trò cũ (`MANAGER`, `RECORDS_OFFICER`, `UNIT_REPRESENTATIVE`).
  Trong khi `achievementPermissions.js` đã hỗ trợ:
  ```javascript
  const canMutate = roles.some(r => ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'LECTURER', 'UNIT_REPRESENTATIVE'].includes(r));
  ```
  Thì trong `achievementService.js`:
  1. `listActiveTypes` (dòng 29) chỉ cho phép `['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN']`. Người dùng chỉ có vai trò `MEMBER` sẽ bị ném `ForbiddenError`.
  2. `listAchievements` (dòng 54-68) chỉ kiểm tra `isLecturer = roles.includes('LECTURER')`. Người dùng có vai trò `MEMBER`, `DEPARTMENT_HEAD`, hoặc `FACULTY_LEAD` không được tính là `isLecturer`, dẫn đến `orConditions` rỗng và API trả về mảng rỗng `{ items: [] }`.
- **Hậu quả**: Giảng viên / Người dùng thông thường sau khi chuyển đổi sang vai trò `MEMBER` sẽ không thể xem danh mục loại thành tích và không nhìn thấy danh sách thành tích của chính mình trên giao diện kho cá nhân.
- **Giải pháp khắc phục**:
  1. Tại `achievementService.js:29`: Thêm `'MEMBER'`, `'DEPARTMENT_HEAD'`, `'FACULTY_LEAD'` vào mảng roles cho phép đọc danh mục.
  2. Tại `achievementService.js:54-63`: Kiểm tra thêm `const isIndividual = roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r));` để nạp thành tích cá nhân của chính người dùng vào `orConditions`.

---

### [Major] Finding 3: `dossierPackagerService` bỏ sót `app.award_records`, gây lệch pha với `autoDiscoveryService`

- **Vị trí**: `backend/src/modules/ai/dossierPackagerService.js:154-172`
- **Mức độ**: **Major**
- **Bản chất**:
  Trong `autoDiscoveryService.js` (dòng 52-87) và `aiService.js` (dòng 346-379), hệ thống truy vấn cả 2 bảng nguồn: `app.achievements` (thành tích cá nhân) và `app.award_records` (danh hiệu / khen thưởng đã được cấp từ quyết định khen thưởng).
  Tuy nhiên, trong `dossierPackagerService.packageAndStreamDossierZip`, dịch vụ chỉ truy vấn `app.achievements`.
- **Hậu quả**: Nếu một quy chế yêu cầu tiêu chí dựa trên danh hiệu khen thưởng cũ (ví dụ: đã từng đạt Lao động tiên tiến hoặc Chiến sĩ thi đua cơ sở kỳ trước lưu trong `award_records`), Auto-Discovery tính toán đạt 100%, nhưng khi người dùng bấm "Xuất gói minh chứng (.ZIP)", bộ nén ZIP đánh giá lại tiêu chí mà không có dữ liệu `award_records`, dẫn đến tiêu chí bị đánh giá Không Đạt và file minh chứng của tiêu chí đó bị loại khỏi gói ZIP.
- **Giải pháp khắc phục**:
  Bổ sung truy vấn `app.award_records` kèm `award_decision_files` vào `dossierPackagerService.js` tương tự như `autoDiscoveryService.js:52-87` và gộp vào mảng `records`.

---

### [Minor] Finding 4: Stream nén ZIP có thể treo kết nối nếu xảy ra lỗi sau khi headers đã gửi

- **Vị trí**: `backend/src/modules/ai/dossierPackagerService.js:267-273`
- **Mức độ**: **Minor**
- **Bản chất**:
  Trong sự kiện `archive.on('error', ...)`, khi `res.headersSent` là `true`, mã nguồn chỉ ghi log `console.error` mà không gọi `res.destroy(err)` hoặc `res.end()`.
- **Giải pháp khắc phục**:
  Cập nhật handler:
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

---

## 3. Logic Chain (Chuỗi Lập Luận Đánh Giá)

1. **Từ Quan sát 1.1**: Test suite đạt 32/32 tests vì các bài test của Worker tập trung vào logic in-memory (`createPermissionResolver`) và kiểm tra regex văn bản chuỗi SQL của `createAchievement`. Worker không xây dựng bài test cho thao tác xóa trên đối tượng `ACTIVE` trong repository hay service.
2. **Từ Quan sát 1.2 kết hợp Finding 1**:
   - Khi gọi `createAchievement`: bản ghi được lưu với `status = 'ACTIVE'`.
   - Khi chủ sở hữu bấm Xóa: `achievementService.deleteAchievement` chấp nhận `ACTIVE`, nhưng khi chuyển giao sang `repo.deleteAchievement`, mệnh đề SQL `WHERE ... AND status = 'DRAFT'` lập tức loại trừ bản ghi.
   - Thao tác xóa trả về `false`, service ném `ConflictError`. Người dùng không thể xóa thành tích đã tạo.
   - Đây là sự thiếu nhất quán (inconsistency) trực tiếp giữa Repository Layer và Service Layer.
3. **Từ Quan sát 1.3 kết hợp Finding 2**:
   - Milestone 1 đã định hình hệ thống vai trò mới (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
   - `achievementPermissions.js` đã cập nhật để nhận diện các vai trò mới.
   - Tuy nhiên, `achievementService.js` vẫn giữ các điều kiện cứng chỉ chấp nhận `LECTURER` hoặc `MANAGER` cũ. Điều này sẽ khiến người dùng thông thường gặp lỗi 403 Forbidden khi tải danh mục hoặc thấy danh sách thành tích của mình trống trơn trên giao diện frontend.
4. **Từ Quan sát 1.4 kết hợp Finding 3**:
   - AI Auto-Discovery và Dossier Packager là hai mắt xích liên hoàn trong hành trình người dùng tại R2: Quét quy chế $\to$ Thấy tiềm năng đạt $\to$ Bấm tải gói minh chứng ZIP.
   - Việc Auto-Discovery đọc cả `award_records` nhưng Dossier Packager lại bỏ quên `award_records` tạo ra lỗi logic nghiệp vụ nghiêm trọng giữa khâu phát hiện và khâu đóng gói tài liệu.
5. **Kết luận**:
   Mặc dù chất lượng tổng thể của mã nguồn được viết rất chuyên nghiệp, cấu trúc module rõ ràng, và cơ chế fallback của AI Vision được bọc lót xuất sắc, các khiếm khuyết trên tạo ra điểm nghẽn thực tế cho các Milestone tiếp theo (M3, M4, M5). Do đó, cần yêu cầu chỉnh sửa dứt điểm trước khi nghiệm thu Milestone 2.

---

## 4. Caveats (Giả Định & Điểm Chưa Khảo Sát)

- **Không kiểm tra live OCR với Groq/Gemini API thật**: Do môi trường kiểm thử không được cấu hình sẵn API key thực tế. Tuy nhiên, luồng graceful fallback (`fallback: true, data: null, HTTP 200`) đã được xác minh hoạt động chính xác 100%.
- **Chưa can thiệp sửa mã**: Tuân thủ nghiêm ngặt nguyên tắc của Reviewer ("Review-only — do NOT modify implementation code"), không tự ý sửa code của Worker.

---

## 5. Conclusion & Actionable Next Steps

### Kết luận:
**REQUEST_CHANGES** — sub_orch_m2 cần dispatch `worker_m2_1` thực hiện một đợt chỉnh sửa nhanh (Quick Fix Turn) để xử lý dứt điểm 4 nội dung sau:

### Danh mục hành động cụ thể cho Worker:
1. **Sửa `achievementRepository.js`**:
   - Dòng 474 (`deleteAchievement`): đổi `status = 'DRAFT'` thành `status IN ('ACTIVE', 'DRAFT')`.
   - Dòng 480 (`restoreAchievement`): đổi `status = 'DRAFT'` thành `status IN ('ACTIVE', 'DRAFT')`.
2. **Sửa `achievementService.js`**:
   - Dòng 29 (`listActiveTypes`): bổ sung `'MEMBER'`, `'DEPARTMENT_HEAD'`, `'FACULTY_LEAD'` vào danh sách vai trò hợp lệ.
   - Dòng 54-66 (`listAchievements`): mở rộng điều kiện lọc cho các vai trò chuẩn `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` để người dùng xem được thành tích cá nhân của mình.
3. **Sửa `dossierPackagerService.js`**:
   - Dòng 154-187 (`packageAndStreamDossierZip`): bổ sung truy vấn `app.award_records` đồng bộ với `autoDiscoveryService.js`.
   - Dòng 267-273: thêm `res.end()` trong trường hợp lỗi khi `res.headersSent` là true.
4. **Bổ sung Unit Test**:
   - Thêm test case kiểm tra SQL của `deleteAchievement` và `restoreAchievement` trong `tests/achievement-vault-active.test.js` để đảm bảo chấp nhận cả trạng thái `'ACTIVE'`.

---

## 6. Verification Method (Phương Pháp Tái Kiểm Minh)

Sau khi Worker hoàn tất bản sửa đổi, chạy lệnh kiểm thử sau:
```powershell
cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js
```
Kiểm tra lại 3 file nguồn:
1. `backend/src/modules/achievements/achievementRepository.js`: chứa `status IN ('ACTIVE', 'DRAFT')` trong `deleteAchievement` và `restoreAchievement`.
2. `backend/src/modules/achievements/achievementService.js`: chứa vai trò `'MEMBER'` trong `listActiveTypes` và `listAchievements`.
3. `backend/src/modules/ai/dossierPackagerService.js`: nạp đầy đủ cả `app.achievements` và `app.award_records`.
