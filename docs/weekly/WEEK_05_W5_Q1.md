# BÁO CÁO BÀN GIAO CÔNG VIỆC TUẦN 5 — PHẦN VIỆC W5-Q1
## HỒI QUY QUYỀN, FILE, TRANSACTION VÀ DỮ LIỆU

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W5-Q1: Hồi quy quyền, file, transaction và dữ liệu  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm:** 07/10/2026 (Asia/Saigon)  
**Nhánh thực hiện:** `w5-q1` (tách từ `w4-q4`)  

---

## 1. Mục Tiêu & Bối Cảnh Thực Hiện

- **Bối cảnh kỹ thuật:** React/Vite/Tailwind, Express REST API v1 (`/api/v1`), Supabase PostgreSQL qua `pg` connection pool; hệ thống xác thực Express JWT, RBAC phân quyền và private storage giữ nguyên. Quyết định DB Supabase PostgreSQL (ADR-001) được áp dụng nhất quán.
- **Phụ thuộc:** Kế thừa từ W4-Q4 và W4-P4. Kiểm tra hợp đồng và PR đã chốt; nghiệm thu trên môi trường live Supabase DB thực tế.
- **Phạm vi thực hiện:**
  1. Test role/scope toàn diện qua API, file private, search, export CSV và mô-đun AI.
  2. Thử `anon` và `authenticated` trên Supabase Data API để chứng minh không làm lộ schema và bảng nghiệp vụ.
  3. Test token thu hồi, xoay vòng refresh token, cập nhật version đồng thời (Optimistic Concurrency Control trả về HTTP 409 Conflict) và rollback toàn vẹn cùng pg client.
  4. Sửa lỗi quyền/file trên bộ tính năng đã đóng ngày 21/10.

---

## 2. Các Kết Quả Đạt Được

### 2.1 Chứng minh cô lập Supabase PostgREST Data API
- Chạy kiểm thử quyền với `SET ROLE anon; SELECT count(*) FROM app.achievements;` và `SET ROLE authenticated; SELECT count(*) FROM app.users;`.
- Cả hai truy vấn đều bị PostgreSQL từ chối với mã lỗi SQLSTATE `42501` (`permission denied for schema app`).
- Chứng minh PostgREST Data API của Supabase không làm lộ bất kỳ bảng nghiệp vụ nào ra bên ngoài; mọi tương tác bắt buộc phải thông qua Express backend.

### 2.2 Sửa lỗi quyền và file trong `evidenceService.js`
- Chuyển `achievementRepo` và `evidenceRepo` sang dạng inject qua constructor, loại bỏ phụ thuộc cứng vào singleton module để phục vụ unit test và tính linh hoạt.
- Chuẩn hóa kiểm tra xác thực người dùng (`UnauthorizedError`) và tồn tại hồ sơ (`NotFoundError`), tránh unhandled null pointer exceptions.
- Bổ sung fallback `contextUnitId = achievement.contextUnitId || unitId` hỗ trợ hồ sơ thành tích tập thể.
- Đọc quyền người dùng từ DB (`authRepository.getActiveRoles`) thay vì tin cậy token JWT tĩnh, đảm bảo thu hồi quyền có hiệu lực ngay lập tức.

### 2.3 Kiểm soát cập nhật đồng thời (Optimistic Concurrency Control - 409)
- Hồ sơ thành tích có cơ chế khóa lạc quan dựa trên trường `version`.
- Khi 2 phiên làm việc cập nhật cùng lúc, phiên gửi sau với version cũ bị từ chối với mã HTTP `409 Conflict`, mã lỗi `CONCURRENCY_CONFLICT`.
- Phiên sau phải làm mới dữ liệu (lấy version mới) trước khi có thể cập nhật tiếp.

### 2.4 Đảm bảo tính toàn vẹn Transaction Rollback cùng pg client
- Kiểm thử cơ chế `withTransaction` với pg client: khi ném lỗi nghiệp vụ có chủ đích giữa chừng giao dịch, CSDL tự động ROLLBACK toàn bộ thao tác thêm mới.
- Dữ liệu hoàn toàn không xuất hiện trong database (`count = 0`), bảo đảm tính nguyên tử (Atomicity).

### 2.5 Phân quyền và bảo mật File, Export CSV và AI Scope
- **File Private:** Chỉ chủ hồ sơ hoặc cán bộ trong scope mới có thể tải tệp qua URL private. Người ngoài scope bị chặn HTTP 403. Hồ sơ chuyển sang `VERIFIED` sẽ bị khóa bất biến, cấm xóa/sửa minh chứng (HTTP 409 `ACHIEVEMENT_IMMUTABLE`).
- **Export CSV:** Giảng viên bị chặn xuất CSV (HTTP 403); Quản lý xuất CSV an toàn có gắn mã BOM UTF-8 (`0xEF, 0xBB, 0xBF`) và thoát chuỗi chống CSV Formula Injection (`'=`, `'+`, `'-`, `'@`).
- **AI Scope:** Người dùng ngoài scope bị chặn gọi đánh giá AI có cấu trúc hoặc xem kết quả AI của giảng viên khác (HTTP 403 `OUT_OF_SCOPE`).

---

## 3. Lệnh và Kết Quả Kiểm Thử Thực Tế

| Bộ kiểm thử / Lệnh | Mô tả | Kết quả thực tế | Thời gian chạy |
|---|---|---|---|
| `npm run test:w5-q1:integration` | 8 ca kiểm thử tích hợp live Supabase DB | **8/8 PASS (100%)** | 18.18s |
| `npm run test:w5-q1` | 6 ca unit test hồi quy bảo mật W5-Q1 | **6/6 PASS (100%)** | 1.25s |
| `npm test` | 31 ca kiểm thử Auth, Scopes & DB Core | **31/31 PASS (100%)** | 10.5s |
| `node --test tests/w4-p4.test.js tests/w4-q2.test.js tests/w4-p1.test.js tests/w4-q1.test.js` | 21 ca unit test hồi quy các tuần trước | **21/21 PASS (100%)** | 260ms |

---

## 4. Danh Sách Tệp Đã Thay Đổi và Tạo Mới

### Mã nguồn Backend:
- `backend/src/modules/evidences/evidenceService.js`: Sửa lỗi DI cho repo, chuẩn hóa kiểm tra xác thực, hỗ trợ scope tập thể, đọc vai trò trực tiếp từ DB.
- `backend/package.json`: Thêm 2 script `"test:w5-q1"` và `"test:w5-q1:integration"`.
- `backend/tests/w5-q1.test.js`: **[TẠO MỚI]** Bộ kiểm thử đơn vị hồi quy bảo mật 6 ca.
- `backend/tests/w5-q1.integration.js`: **[TẠO MỚI]** Bộ kiểm thử tích hợp 8 ca trên live Supabase DB.

### Tài liệu Nghiệm thu & Bàn giao:
- `docs/testing/security/SECURITY_REGRESSION_REPORT.md`: **[TẠO MỚI]** Báo cáo chi tiết hồi quy bảo mật, file, transaction và dữ liệu W5-Q1.
- `docs/weekly/WEEK_05_W5_Q1.md`: **[TẠO MỚI]** Báo cáo bàn giao tuần 5 phần việc W5-Q1.

---

## 5. Hướng Dẫn Tự Kiểm Tra (Self-Check Steps)

Người dùng có thể tự kiểm tra nghiệm thu theo các bước sau:

1. **Kiểm tra Unit Tests:**
   ```powershell
   cd backend
   npm run test:w5-q1
   ```
   *Kỳ vọng:* 6/6 test cases đạt `✔ PASS`.

2. **Kiểm tra Live Integration Tests trên Supabase:**
   ```powershell
   npm run test:w5-q1:integration
   ```
   *Kỳ vọng:* 8/8 test cases đạt `✔ PASS`.

3. **Kiểm tra Hồi quy toàn bộ hệ thống:**
   ```powershell
   npm test
   ```
   *Kỳ vọng:* 31/31 test cases đạt `✔ PASS`.

---

## 6. Trạng Thái Hiện Tại & Đề Xuất Commit

- **Trạng thái:** Toàn bộ phạm vi W5-Q1 đã hoàn thành xuất sắc, 100% test cases pass. Chưa thực hiện git commit / push / merge theo đúng yêu cầu.
- **Phần việc tiếp theo (chưa xong):** W5-Q2 (Đánh giá Validator và nguồn truy xuất trên tập giữ lại). Sẽ được triển khai ngay sau khi người dùng duyệt W5-Q1.
- **Đề xuất Commit Message:**
  ```text
  fix(W5-Q1): hoi quy bao mat quyen, file private, optimistic concurrency va pg transaction rollback
  ```
