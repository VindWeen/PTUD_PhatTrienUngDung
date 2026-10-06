# W3-Q1 — Bổ sung, gửi lại, từ chối, hủy và thu hồi

Tạ Trần Vinh Quang · 06/10/2026 · branch `w3q1` · baseline `w2q4` (`440ea33`).

**Đã hoàn thành toàn bộ khối việc W3-Q1:** Hoàn thiện toàn bộ các luồng chuyển trạng thái theo đúng State Machine blueprint; kiểm tra lý do bắt buộc và điều kiện trạng thái; tạo bản thay thế có liên kết cho hồ sơ kết thúc; duy trì tính bất biến của tệp/snapshot đã nộp và nâng cấp giao diện người dùng xem lịch sử và tệp đóng băng.

---

## 1. File thay đổi & tạo mới

### Backend & CSDL:
- `backend/src/modules/achievements/achievementSchemas.js`:
  - Bổ sung `replacesAchievementId` vào `createAchievementSchema`.
  - Bổ sung `replaceAchievementSchema` phục vụ luồng tạo bản thay thế cho hồ sơ kết thúc.
- `backend/src/modules/achievements/achievementRepository.js`:
  - Cập nhật `createAchievement` hỗ trợ chèn và trả về `replaces_achievement_id`.
- `backend/src/modules/achievements/achievementService.js`:
  - Thực thi kiểm tra lý do bắt buộc trước transaction: `requestCorrection` (>= 5 ký tự), `rejectAchievement` (>= 5 ký tự), `cancelAchievement` (bắt buộc nếu đã từng nộp duyệt, >= 5 ký tự), `revokeAchievement` (bắt buộc >= 5 ký tự).
  - Triển khai phương thức `replaceAchievement`: Cho phép tạo bản thay thế kế thừa dữ liệu cho các hồ sơ ở trạng thái kết thúc (`REJECTED`, `CANCELLED`, `REVOKED`), chặn các hồ sơ đang trong quy trình dang dở.
  - Hỗ trợ nộp lại (`submitAchievement` khi trạng thái là `NEED_CORRECTION`), tự động tăng số hiệu `revision_no` và đóng băng các tệp minh chứng phiên bản mới.
- `backend/src/modules/achievements/achievementController.js` & `achievementRoutes.js`:
  - Expose endpoint `POST /achievements/:id/replace` để tạo bản thay thế có liên kết.
  - Expose endpoint alias `POST /achievements/:id/resubmit` phục vụ luồng gửi lại hồ sơ.
- `backend/package.json`: Thêm script `test:w3-q1` và `test:w3-q1:integration`.

### Frontend:
- `frontend/src/services/achievementsApi.js`: Thêm phương thức gọi API `resubmit` và `replace`.
- `frontend/src/pages/Achievements.jsx`:
  - Thêm nút và xử lý "Tạo bản thay thế" trên từng dòng bảng đối với hồ sơ kết thúc (`REJECTED`, `CANCELLED`, `REVOKED`) khi người dùng là chủ hồ sơ.
  - Thêm biểu ngữ (Banner) thông báo và nút tạo bản thay thế trong Modal chi tiết.
  - Hiển thị liên kết truy nguyên nguồn gốc: "Bản kê khai này thay thế cho hồ sơ kết thúc #..."
  - Sửa lỗi hiển thị tên người nộp trong tab Submissions (loại bỏ lỗi hiển thị `User #[object Object]`).
  - Hỗ trợ tải về tệp minh chứng đóng băng của từng lần nộp (snapshot) trong tab Lần nộp & Snapshot.

### Kiểm thử & Tài liệu:
- `backend/tests/w3-q1.test.js`: 6 bài kiểm thử đơn vị độc lập đạt 100%.
- `backend/tests/w3-q1.integration.js`: 30 assertions kiểm thử tích hợp thực tế với Supabase PostgreSQL cloud theo 8 giai đoạn.
- `docs/api/WORKFLOW_W3_Q1.md`: Tài liệu đặc tả hợp đồng kỹ thuật và ma trận chuyển trạng thái.
- `docs/weekly/WEEK_03_W3_Q1.md`: Nhật ký bàn giao này.

---

## 2. Kiểm tra thực tế

| Lệnh thực thi | Kết quả | Ghi chú |
|---|---|---|
| `npm --prefix backend run test:w3-q1` | **6/6 PASS** | Kiểm thử đơn vị các nhánh trạng thái, lý do bắt buộc và replaces |
| `npm --prefix backend run test:w3-q1:integration` | **30/30 assertions PASS** | Chạy trên Supabase PostgreSQL thật, schema cô lập và dọn dẹp file 100% |
| `npm --prefix backend run test:w2-q4` | **6/6 PASS** | Kiểm tra hồi quy W2-Q4 |
| `node scripts/validate_contracts.mjs` | **68/68 PASS** | Kiểm tra hợp đồng tĩnh OpenAPI |
| `npm --prefix frontend run lint` | **PASS (Exit 0)** | ESLint không có cảnh báo/lỗi |

---

## 3. Tự kiểm tra

1. Chạy unit tests: `npm --prefix backend run test:w3-q1`
2. Chạy integration tests: `npm --prefix backend run test:w3-q1:integration`
3. Mở UI chế độ API thật: Tạo hồ sơ -> Nộp -> Quản lý yêu cầu bổ sung -> Cập nhật tệp v2 -> Gửi lại -> Quản lý xác nhận -> Thu hồi -> Tạo bản thay thế có liên kết.
