# W2-Q4 — Test vượt quyền và review khen thưởng

Tạ Trần Vinh Quang · 06/10/2026 · branch `w2q4` · baseline `origin/w3-p2` (`41b5577`). Chưa commit/push/merge.

**Đã hoàn thành toàn bộ khối việc W2-Q4:** Vá triệt để các lỗ hổng phân quyền và bypass bảo mật; kiểm tra đại diện hết hạn; thực thi cấm tự duyệt đa diện (Anti-Self-Approval); kiểm tra tồn tại tệp vật lý trước snapshot; rà soát và chấp thuận module Quyết định khen thưởng (W2-P2); khẳng định hồ sơ `VERIFIED` không tự sinh `AwardRecord`; kiểm thử tự động 100% đạt; lưu video demo và tài liệu hóa.

---

## 1. File thay đổi & tạo mới

### Backend & Mã nguồn Nghiệp vụ:
- `backend/src/modules/evidences/evidenceService.js`:
  - Loại bỏ hoàn toàn bypass của `RECORDS_OFFICER` khi tải tệp minh chứng private qua URL `/evidence-files/:id/download`.
  - Đọc vai trò và phạm vi đang hiệu lực từ CSDL (`getActiveRoles`, `isUnitInUserScope`), chặn token cũ mang quyền/scope đã hết hạn.
  - Sửa lỗi tham số audit log (`userId`, `oldValues`, `newValues`) và đưa vào trong database transaction trước `COMMIT`.
  - Bảo đảm tương thích ngược với kiểm thử cũ gọi synthetic object thiếu `achievementId`.
- `backend/src/modules/achievements/achievementService.js`:
  - Loại bỏ bypass của `ADMIN` khi thẩm định (`verifyAchievement`, `requestCorrection`, `rejectAchievement`); chỉ `MANAGER` có phạm vi đơn vị hợp lệ mới được thực hiện.
  - Chống tự duyệt triệt để cho cả 3 đối tượng: Giảng viên chủ hồ sơ (`lecturer_id`), người tạo hộ (`created_by`), và người nộp thay (`submitted_by`).
  - Khi nộp hồ sơ (`submitAchievement`): Đưa thao tác đọc minh chứng vào sau khóa hàng `findAchievementForUpdate`; kiểm tra sự tồn tại tệp vật lý trên Private Storage (`storage.fileExists`) trước khi đóng băng snapshot; hỗ trợ cả `submitNote` và `note`.
  - Hỗ trợ dependency injection (`roles`, `scope`, `adapter`, `notify`).
- `backend/package.json`: Bổ sung npm script `test:w2-q4` và `test:w2-q4:integration`.

### Kiểm thử Tự động:
- `backend/tests/w2-q4.test.js`: Bộ kiểm thử đơn vị độc lập 6/6 test cases (đại diện hết hạn, anti-self-approval, manager ngoài scope, bảo vệ URL tệp private, kiểm tra tệp vật lý trước snapshot, tách biệt tuyệt đối giữa VERIFIED và AwardRecord).
- `backend/tests/w2-q4.integration.js`: Bộ kiểm thử tích hợp thực tế với Supabase PostgreSQL cloud và Express REST API (68/68 assertions PASS; schema cô lập `w2q4_test_*`, outer rollback và dọn dẹp tệp vật lý 100%).

### Tài liệu & Báo cáo:
- `docs/testing/week-2/W2_Q4_RESULT.json`: Báo cáo kết quả kiểm thử tự động JSON, ghi nhận `acceptance: "ACCEPT"`.
- `docs/testing/week-2/PR_REVIEW_W2_P2_PHUOC.md`: Đánh giá phản biện PR W2-P2 của Võ Nhạc Phước, xác nhận kiến trúc XOR, tệp quyết định bắt buộc và chấp thuận nghiệm thu (APPROVED).
- `docs/testing/week-2/SECURITY_ISSUES_LOG.md`: Bảng quản lý và theo dõi 7 vấn đề an ninh/phân quyền phát hiện trong tuần 2 (100% đã giải quyết và có test xác nhận).
- `docs/testing/week-2/WEEK_2_TEST_REPORT.md`: Báo cáo kiểm thử tổng thể Tuần 2 kèm sơ đồ Mermaid workflow chi tiết và liên kết video demo WebP.
- `docs/weekly/WEEK_02_W2_Q4.md`: Nhật ký bàn giao này.

---

## 2. Kiểm tra thực tế

| Lệnh thực thi | Kết quả thực tế |
|---|---|
| `npm --prefix backend run test:w2-q4` | **6/6 PASS** |
| `npm --prefix backend run test:w2-q4:integration` | **68/68 assertions PASS** trên Express + PostgreSQL Supabase thật |
| `npm --prefix backend run test:w2-p4` | **5/5 PASS** (Tương thích ngược kiểm thử W2-P4) |
| `npm --prefix backend run test:w2-p2` | **4/4 PASS** (Module khen thưởng W2-P2) |
| `npm --prefix backend run test:w2-q3` | **4/4 PASS** (Module submit/verify W2-Q3) |
| `npm --prefix backend run test:w2-q2` | **4/4 PASS** (Private storage W2-Q2) |
| `npm --prefix backend test` | **31/31 PASS** (Auth/Scope base suites) |
| `node scripts/validate_contracts.mjs` | **68/68 PASS** (Kiểm tra hợp đồng OpenAPI) |
| `git diff --check` | **PASS** (Không có lỗi khoảng trắng hoặc conflict markers) |

---

## 3. Video Demo UI

Đã chạy frontend Vite trên port 5174 và ghi hình tự động quá trình thẩm định, xem tệp minh chứng và audit log của hồ sơ `#1001` (Trưởng khoa CNTT `bich.tt`).
- Tệp video: [w2_q4_demo_1791291073202.webp](file:///C:/Users/fw622/.gemini/antigravity-ide/brain/7abf70eb-f4ad-4c8a-9fd9-7b81bf74e153/w2_q4_demo_1791291073202.webp).

---

## 4. Hướng dẫn Tự kiểm tra & Giới hạn

### Các bước tự kiểm tra:
1. Chạy kiểm thử đơn vị W2-Q4:
   ```bash
   npm --prefix backend run test:w2-q4
   ```
2. Chạy kiểm thử tích hợp kết nối Supabase thật:
   ```bash
   npm --prefix backend run test:w2-q4:integration
   ```
3. Chạy toàn bộ các bộ kiểm thử liên quan để đối soát tính ổn định:
   ```bash
   npm --prefix backend run test:w2-p4
   npm --prefix backend run test:w2-p2
   npm --prefix backend run test:w2-q3
   node scripts/validate_contracts.mjs
   ```

### Giới hạn & Phần chờ phê duyệt:
- Không đưa credentials, connection string hay private files thật vào Git repository.
- Chưa thực hiện `git commit`, `git push`, hoặc `git merge` (đang tuân thủ nguyên tắc chờ người dùng yêu cầu).
- **Đề xuất commit message**:
  ```text
  feat(test-sec): [W2-Q4] test permission bypass, anti-self-approval, and review award records
  ```
