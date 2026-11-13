# Forensic Integrity Audit Report & Handoff: Milestone 2 Backend Core Modules

**Auditor**: Teamwork Forensic Auditor (`auditor_m2_1`)  
**Target Milestone**: Milestone 2 — Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP)  
**Recipient**: Sub-Orchestrator Milestone 2 (`83c8f951-06e2-4a54-989d-22102953315c`)  
**Audit Timestamp**: 2026-11-12T14:26:00Z  
**Integrity Mode**: `development` (per `ORIGINAL_REQUEST.md`)

---

## Forensic Audit Summary

**Work Product**: Milestone 2 Backend Core Modules & Automated Test Suites  
**Profile**: General Project (Forensic Integrity)  
**Verdict**: **CLEAN** (No cheating, no facade implementations, no fabricated outputs, no self-certifying tautological tests)  
**Adversarial Finding**: **1 High-Priority Implementation Defect** identified in `achievementRepository.js:474,480` (SQL `status = 'DRAFT'` prevents deleting/restoring `ACTIVE` records).

### Phase Results
- [Phase 1.1] AI Integration & Fallback Authenticity (`achievementAiIngestService.js`): **PASS**
- [Phase 1.2] Direct ACTIVE Status & Permissions (`achievementRepository.js`, `achievementPermissions.js`): **PASS** (with Defect Advisory on Delete SQL)
- [Phase 1.3] Criteria Evaluator Calculation Integrity (`criteriaEvaluator.js`): **PASS**
- [Phase 1.4] Auto-Discovery Service Ranking Integrity (`autoDiscoveryService.js`): **PASS**
- [Phase 1.5] Dossier Packager ZIP Streaming Authenticity (`dossierPackagerService.js`): **PASS**
- [Phase 1.6] Test Suite Non-Tautological Verification (`backend/tests/`): **PASS**
- [Phase 2] Independent Runtime Execution: **PASS** (16/16 M2 tests pass, 32/32 total regression tests pass)

---

## 1. Observation (Quan Sát Trực Tiếp & Dữ Liệu Thực Tế)

### 1.1 Dịch vụ AI Vision Auto-fill & Fallback (`achievementAiIngestService.js`)
- **Tệp**: `backend/src/modules/achievements/achievementAiIngestService.js`
- **Mã thực hiện**:
  * Tích hợp trực tiếp Groq Vision Chat Completion (`llama-3.2-11b-vision-preview`) qua `https://api.groq.com/openai/v1/chat/completions` với base64 data URL.
  * Tích hợp trực tiếp Google Gemini (`gemini-1.5-flash`) qua `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent` với `inline_data`.
  * Cơ chế Fallback an toàn: Dòng 12-29 và 150-164 trả về `success: true, fallback: true, data: null` kèm thông điệp hướng dẫn người dùng tự nhập tay khi buffer rỗng, không có `GROQ_API_KEY`/`GEMINI_API_KEY`, hoặc API lỗi/timeout.
  * Hàm `parseExtractedJson` (dòng 167-192) kiểm tra và làm sạch markdown backticks, ép kiểu năm hợp lệ (1990 - 2100), chuẩn hóa danh mục chuẩn (`TEACHING`, `SCIENTIFIC_RESEARCH`, `COMMUNITY_SERVICE`, `OTHER`). Không phát hiện code dummy hay bypass giả mạo.

### 1.2 Kho thành tích trực tiếp ACTIVE & Phân quyền (`achievementRepository.js` & `achievementPermissions.js`)
- **Tệp**: `backend/src/modules/achievements/achievementRepository.js:398`
  * Câu lệnh SQL `INSERT INTO app.achievements`:
    `$10, $11, 'ACTIVE', $12, 1,`
    Trạng thái hồ sơ mới tạo được gán trực tiếp là `'ACTIVE'`.
- **Tệp**: `backend/src/modules/achievements/achievementPermissions.js:19-21, 45-46`
  * Cho phép chỉnh sửa khi `['ACTIVE', 'DRAFT', 'NEED_CORRECTION'].includes(achievement.status)`.
  * Cho phép xóa khi `['ACTIVE', 'DRAFT'].includes(achievement.status)`.
- **Phát hiện khiếm khuyết (Defect Advisory)**:
  * Tại `backend/src/modules/achievements/achievementRepository.js:474`:
    ```sql
    UPDATE app.achievements SET deleted_at = SYSUTCDATETIME(), deleted_by = $2, updated_at = SYSUTCDATETIME(), version = version + 1
    OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $3 AND status = 'DRAFT' AND deleted_at IS NULL
    ```
  * Tại `backend/src/modules/achievements/achievementRepository.js:480`:
    ```sql
    OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $2 AND status = 'DRAFT'
    ```
  * **Hậu quả**: Khi xóa hồ sơ có trạng thái `'ACTIVE'`, service layer (`achievementService.js:325`) và permissions cho phép, nhưng câu lệnh SQL trong repository có điều kiện `AND status = 'DRAFT'`, dẫn đến câu lệnh UPDATE tác động 0 bản ghi (`rowCount === 0`), ném ngoại lệ `ConflictError('Không thể xóa bản ghi thành tích')`. Cần cập nhật thành `AND status IN ('ACTIVE', 'DRAFT')`.

### 1.3 Đánh giá tiêu chí (`criteriaEvaluator.js`)
- **Tệp**: `backend/src/modules/ai/criteriaEvaluator.js`
- Dòng 162: Chấp nhận hồ sơ thành tích `['ACTIVE', 'VERIFIED', 'RECORDED']`.
- Dòng 315: Tính toán `missingCount = isSatisfied === true ? 0 : (targetMin != null ? Math.max(0, targetMin - (actualRecorded || 0)) : 1)`.
- Dòng 331-339: Trả về `matchedRecords` đầy đủ cấu trúc (`id`, `achievementId`, `title`, `year`, `status`, `file`, `evidenceFiles`).
- Logic tính số năm phân biệt (`distinctYears`) và chuỗi năm liên tiếp (`consecutiveYears`) là thuật toán thuần túy, không có hardcoded kết quả.

### 1.4 Khám ngược tự động (`autoDiscoveryService.js`)
- **Tệp**: `backend/src/modules/ai/autoDiscoveryService.js`
- Truy vấn quy chế mở có `is_confirmed = 1`, truy vấn thành tích của chủ thể có trạng thái `IN ('ACTIVE', 'VERIFIED', 'RECORDED', 'REVOKED', 'CANCELLED')`.
- Tính tỷ lệ phần trăm: `percentage = totalCount > 0 ? Math.round((satisfiedCount / totalCount) * 100) : 0`.
- Xếp hạng đa cấp: giảm dần theo `percentage`, sau đó giảm dần theo `satisfiedCount`, rồi tăng dần theo tên quy chế (`localeCompare`).

### 1.5 Đóng gói hồ sơ minh chứng ZIP (`dossierPackagerService.js`)
- **Tệp**: `backend/src/modules/ai/dossierPackagerService.js`
- Sử dụng `archiver` chính thức với helper `createZipArchive` tương thích class `ZipArchive` (archiver v8) và hàm default (archiver v7).
- Hàm `sanitizeFileName` khử dấu tiếng Việt và thay thế ký tự đặc biệt / dấu gạch chéo đường dẫn bằng `_` (chống Path Traversal).
- Hàm `formatStandardizedFileName` sinh tên đúng chuẩn `01_[TenMinhChung]_[Nam].pdf`.
- Thiết lập HTTP response headers `Content-Type: application/zip` và `Content-Disposition: attachment; filename="..."`, thực hiện pipe luồng nén trực tiếp vào `res`.

### 1.6 Kiểm tra độc lập Runtime
- Thực thi độc lập 4 test suites mới:
  ```powershell
  cd backend; node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js
  ```
  **Kết quả**: `16/16 tests pass` (0 fail, 0 skipped, thời gian chạy: 2.30s).
- Thực thi toàn bộ test suites hiện hữu (Kiểm tra hồi quy):
  ```powershell
  cd backend; node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js
  ```
  **Kết quả**: `32/32 tests pass` (100% pass, 0 hồi quy, thời gian chạy: 3.43s).

---

## 2. Logic Chain (Chuỗi Lập Luận Đánh Giá)

1. **Về tính toàn vẹn của mã nguồn (Integrity Forensics)**:
   - Các dịch vụ mới (`achievementAiIngestService.js`, `autoDiscoveryService.js`, `dossierPackagerService.js`) không chứa các mẫu bị cấm như:
     * Hardcoded test results (không có câu lệnh `if (test) return ...`).
     * Facade implementations (mọi hàm đều có logic xử lý tính toán, I/O hoặc truy vấn DB thực tế).
     * Fabricated outputs (không có file log/kết quả dựng sẵn trước khi chạy test).
     * Self-certifying tests (các bài test trong `backend/tests/` kiểm tra logic thông qua input/output độc lập, giải nén ZIP bằng `PizZip` để kiểm tra magic bytes `PK\x03\x04` và tên tệp tin thực tế, không dùng `assert.ok(true)`).
   - Do đó, theo chuẩn **Development Mode** quy định tại `ORIGINAL_REQUEST.md`, sản phẩm đạt chuẩn **CLEAN**.

2. **Về phát hiện khiếm khuyết (Adversarial Review)**:
   - Yêu cầu R1 đặt ra: "Thành tích cá nhân do người dùng tạo có trạng thái hiệu lực ngay lập tức (ACTIVE)... cho phép chỉnh sửa và quản lý minh chứng".
   - `achievementService.js:325` cho phép xóa hồ sơ ở `['ACTIVE', 'DRAFT']`.
   - `achievementPermissions.js:45` cho phép quyền `remove` khi `['ACTIVE', 'DRAFT'].includes(achievement.status)`.
   - Tuy nhiên, `achievementRepository.js:474` lại cố định điều kiện `status = 'DRAFT'`. Do test `achievement-vault-active.test.js` chỉ mock và test qua permission resolver mà chưa test tới repository function `deleteAchievement`, bug này đã không bị test suite phát hiện.
   - Khiếm khuyết này thuộc loại **Implementation Defect (Lỗi logic thực thi câu lệnh SQL)**, không phải hành vi gian lận (cheating/facade), nhưng cần được xử lý ngay để tính năng xóa thành tích `ACTIVE` trong kho cá nhân hoạt động thông suốt.

---

## 3. Caveats (Các Điểm Giới Hạn & Giả Định)

1. **Khả dụng của Live AI Keys**:
   - Dịch vụ `achievementAiIngestService` được kiểm thử với kịch bản không có key để xác minh cơ chế fallback an toàn (đáp ứng đúng tiêu chuẩn R1: không gây gián đoạn luồng sử dụng).
   - Khi có key thực (`GROQ_API_KEY` hoặc `GEMINI_API_KEY`), đường truyền mạng đến các API endpoint quốc tế phụ thuộc vào hạ tầng mạng thực tế.
2. **Xóa mềm và khôi phục**:
   - Tương tự như `deleteAchievement`, hàm `restoreAchievement` tại dòng 480 cũng đang có `status = 'DRAFT'`. Cần sửa đồng bộ cả hai hàm.

---

## 4. Conclusion & Verdict (Kết Luận & Phán Quyết)

- **Phán quyết Kiểm định Toàn vẹn (Integrity Verdict)**: **`CLEAN`**
- **Đánh giá Chức năng**: Đạt toàn bộ các mục tiêu trọng tâm của Milestone 2 theo `SCOPE.md` và `PROJECT.md`.
- **Khuyến nghị Hành động (Remediation Recommendation)**:
  Sửa câu lệnh SQL trong `backend/src/modules/achievements/achievementRepository.js`:
  * Dòng 474: thay `status = 'DRAFT'` thành `status IN ('ACTIVE', 'DRAFT')`.
  * Dòng 480: thay `status = 'DRAFT'` thành `status IN ('ACTIVE', 'DRAFT')`.

---

## 5. Verification Method (Phương Pháp Tái Hiện & Kiểm Minh)

Để độc lập tái kiểm chứng kết quả thẩm định:

```powershell
# 1. Kiểm tra 4 test suites của Milestone 2
cd backend
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js

# 2. Kiểm tra toàn bộ 32 unit & integration tests
node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js

# 3. Kiểm tra tĩnh lỗi SQL status mismatch
Select-String -Path "src/modules/achievements/achievementRepository.js" -Pattern "status = 'DRAFT'"
```
