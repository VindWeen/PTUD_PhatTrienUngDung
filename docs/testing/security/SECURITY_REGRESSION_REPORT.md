# BÁO CÁO HỒI QUY BẢO MẬT, FILE, TRANSACTION VÀ DỮ LIỆU (W5-Q1)

**Dự án:** PTUD_PhatTrienUngDung  
**Người thực hiện:** Tạ Trần Vinh Quang (Phụ trách W5-Q1)  
**Nhánh Git:** `w5-q1` (phát triển tiếp từ `w4-q4`)  
**Thời điểm thực hiện:** 07/10/2026 (Asia/Saigon)  
**Môi trường thử nghiệm:**
- **Runtime:** Node.js v22.18.0 / Express REST API `/api/v1`
- **Cơ sở dữ liệu:** Supabase PostgreSQL Pooler (`aws-0-ap-northeast-2.pooler.supabase.com:5432`, TLS/SSL: true)
- **Kiến trúc:** Express JWT RBAC, Private Evidence Storage, pg Transaction Client, Optimistic Concurrency Control

---

## 1. TỔNG QUAN VÀ MỤC TIÊU KIỂM THỬ W5-Q1

Thực hiện rà soát và xây dựng bộ kiểm thử hồi quy bảo mật (Security Regression Suite) cho toàn bộ hệ thống sau khi hoàn thành các giai đoạn W1 đến W4, tập trung vào 4 nhóm nội dung trọng yếu:

1. **Kiểm thử Role / Scope toàn diện:** Rà soát qua API, tìm kiếm (Search), xuất báo cáo (Export CSV), quản lý tệp tin (Evidence Files) và mô-đun AI.
2. **Chứng minh cô lập Supabase Data API:** Thử nghiệm vai trò `anon` và `authenticated` trực tiếp trên Supabase PostgREST Data API để chứng minh không làm lộ schema và bảng nghiệp vụ.
3. **Thu hồi Token, Đồng thời (Concurrency) và Transaction Rollback:** Kiểm thử token thu hồi, xoay vòng refresh token, khóa tài khoản tức thì, kiểm soát cập nhật đồng thời qua phiên bản (Optimistic Concurrency Control - trả về 409 Conflict) và tính toàn vẹn khi rollback cùng pg client.
4. **Sửa lỗi phân quyền và tệp tin trên bộ tính năng đã đóng:** Sửa dứt điểm các lỗi tiềm ẩn trong quản lý file, kiểm tra role động từ DB thay vì token JWT tĩnh.

---

## 2. BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ THỰC TẾ

### 2.1 Bộ kiểm thử tích hợp trên môi trường thật (`backend/tests/w5-q1.integration.js`)
Lệnh chạy: `npm run test:w5-q1:integration` (hoặc `node --test tests/w5-q1.integration.js`)

| STT | Tên ca kiểm thử (Test Case) | Mục tiêu kiểm tra | Kết quả thực tế | Thời gian chạy |
|:---:|---|---|:---:|:---:|
| **1** | `[W5-Q1 Supabase Isolation]` | Quyền `anon` và `authenticated` trên Supabase Data API bị thu hồi hoàn toàn khỏi schema `app`. SQLSTATE `42501` khi truy vấn `achievements`, `users`, `audit_logs`. | **PASS** | 1918 ms |
| **2** | `[W5-Q1 Token Revocation]` | Đăng nhập cấp JWT, xoay vòng refresh token, phát hiện tái sử dụng token cũ (401), khóa tài khoản trong DB vô hiệu hóa token ngay lập tức (401), và cấm Giảng viên gọi API Manager (403). | **PASS** | 2447 ms |
| **3** | `[W5-Q1 Concurrency 409]` | Phiên A cập nhật thành công (version 1 → 2). Phiên B (stale tab) gửi version cũ = 1 bị từ chối `409 Conflict`. Phiên B tải lại version = 2 và cập nhật thành công lên version = 3. | **PASS** | 3650 ms |
| **4** | `[W5-Q1 Transaction Rollback]` | Helper `withTransaction` cùng pg client tự động ROLLBACK toàn diện khi có lỗi nghiệp vụ phát sinh giữa chừng; bản ghi không bị lưu sót trong DB (count = 0). | **PASS** | 381 ms |
| **5** | `[W5-Q1 API & Search Scope]` | Tìm kiếm qua API không làm lộ hồ sơ của giảng viên khác. Trưởng khoa chỉ tìm kiếm được trong đơn vị phụ trách. Thẩm định viên tự duyệt hồ sơ cá nhân bị chặn `403 SELF_APPROVAL_PROHIBITED`. | **PASS** | 2313 ms |
| **6** | `[W5-Q1 File Scope & Immutability]` | Chủ hồ sơ tải tệp private thành công (200). Người ngoài đơn vị bị từ chối tải tệp (403). Khi hồ sơ chuyển sang `VERIFIED`, thao tác xóa minh chứng bị khóa bất biến trả về `409 ACHIEVEMENT_IMMUTABLE`. | **PASS** | 2230 ms |
| **7** | `[W5-Q1 Export Scope & Injection]` | Giảng viên bị chặn xuất báo cáo CSV (403). Quản lý xuất CSV thành công (200) với chuẩn BOM UTF-8 (`0xEF, 0xBB, 0xBF`) và tiền tố chống CSV Formula Injection (`'=`, `'+`, `'-`, `'@`). | **PASS** | 1844 ms |
| **8** | `[W5-Q1 AI & KPI Scope]` | Người dùng ngoài scope bị chặn gọi đánh giá AI có cấu trúc (403) và không được xem danh sách đánh giá AI của giảng viên khác (403 OUT_OF_SCOPE). | **PASS** | 2378 ms |

> **Tổng kết Integration Test:** **8/8 PASS (100%)** — Thời gian hoàn thành: 18.18s trên live Supabase Pooler.

---

### 2.2 Bộ kiểm thử đơn vị hồi quy bảo mật (`backend/tests/w5-q1.test.js`)
Lệnh chạy: `npm run test:w5-q1`

| STT | Tên ca kiểm thử | Phạm vi kiểm tra | Kết quả thực tế | Thời gian |
|:---:|---|---|:---:|:---:|
| **1** | `requireRoles kiểm tra vai trò DB` | Đọc vai trò trực tiếp từ DB qua `authRepository.getActiveRoles`, từ chối khi vai trò bị thu hồi dù JWT vẫn còn hạn | **PASS** | 873 ms |
| **2** | `Anti-Self-Approval` | Middleware chặn thẩm định viên tự duyệt hồ sơ do chính mình tạo, nộp hoặc là chủ thể | **PASS** | 0.5 ms |
| **3** | `EvidenceService File & Scope` | Chặn truy cập minh chứng ngoài phạm vi và bảo vệ tính bất biến `ACHIEVEMENT_IMMUTABLE` khi trạng thái không phải `DRAFT`/`NEED_CORRECTION` | **PASS** | 1.3 ms |
| **4** | `CSV Export & Formula Injection` | Phân quyền xuất CSV chặt chẽ, khử ký tự nguy hiểm (`=`, `+`, `-`, `@`) để chống tấn công thực thi lệnh trong Excel | **PASS** | 0.5 ms |
| **5** | `AI Evaluator Scope Isolation` | Chặn truy cập AI Evaluator ngoài phạm vi, kiểm tra quyền chủ thể trước khi thực thi | **PASS** | 0.8 ms |
| **6** | `Optimistic Concurrency Control` | Phát hiện xung đột phiên bản (version mismatch) ném lỗi `ConcurrencyConflictError` (mã HTTP 409) | **PASS** | 99 ms |

> **Tổng kết Unit Test:** **6/6 PASS (100%)** — Thời gian hoàn thành: 1.25s.

---

### 2.3 Kiểm thử hồi quy các tuần trước
- `npm test` (Auth & DB Core): **31/31 PASS (100%)**
- `node --test tests/w4-p4.test.js tests/w4-q2.test.js tests/w4-p1.test.js tests/w4-q1.test.js`: **21/21 PASS (100%)**

---

## 3. CHI TIẾT KỸ THUẬT VÀ CÁC SỬA LỖI (BUG FIXES)

### 3.1 Cô lập Supabase PostgREST Data API (Chứng minh an toàn ADR-001)
- **Vấn đề tiềm ẩn:** Supabase cung cấp Data API mặc định qua PostgREST với 2 vai trò PostgreSQL là `anon` và `authenticated`. Nếu schema `app` cấp quyền cho 2 role này, người dùng bên ngoài có thể gửi request trực tiếp đến Supabase URL và đọc lén bảng nghiệp vụ mà không qua Express backend.
- **Minh chứng thực tế:**
  - Thực thi lệnh: `SET ROLE anon; SELECT count(*) FROM app.achievements;`
  - Kết quả: PostgreSQL trả về mã lỗi `42501` (`permission denied for schema app`).
  - Thực thi lệnh: `SET ROLE authenticated; SELECT count(*) FROM app.users;`
  - Kết quả: PostgreSQL trả về mã lỗi `42501` (`permission denied for schema app`).
  - Khi quay về `RESET ROLE` (kết nối Backend qua connection pool bằng user `postgres` / `service_role`), truy vấn thực thi bình thường.
- **Kết luận:** Supabase Data API hoàn toàn không truy cập được dữ liệu nghiệp vụ; 100% dữ liệu bắt buộc đi qua Express REST API `/api/v1`.

### 3.2 Sửa lỗi phân quyền và quản lý minh chứng trong `evidenceService.js`
Trong quá trình hồi quy mã nguồn quản lý minh chứng (`EvidenceService`), các lỗi tiềm ẩn sau đã được sửa chữa triệt để:
1. **Dependency Injection:** Chuyển đổi từ việc import cứng các singleton module sang sử dụng `this.achievementRepo` và `this.evidenceRepo` được inject qua constructor. Điều này cho phép Unit Tests inject mock repositories mượt mà và nhất quán.
2. **Kiểm tra danh tính chặt chẽ:** Bổ sung kiểm tra xác thực người dùng (`UnauthorizedError` khi thiếu `user` hoặc `user.userId`) và kiểm tra tồn tại hồ sơ (`NotFoundError`) để tránh lỗi unhandled null dereference.
3. **Hỗ trợ hồ sơ tập thể:** Bổ sung fallback `contextUnitId = achievement.contextUnitId || unitId` trong phương thức `_assertCanViewAchievement` để hỗ trợ cả hồ sơ thành tích tập thể đơn vị.
4. **Đọc quyền động từ DB:** Trong phương thức `_getUserRoles`, ưu tiên gọi `authRepository.getActiveRoles(user.userId)` từ DB thay vì tin tưởng mù quáng vào mảng `user.roles` trong JWT Access Token đã cấp phát trước đó.

### 3.3 Kiểm soát cập nhật đồng thời (Optimistic Concurrency Control - 409)
- Hệ thống áp dụng cơ chế khóa lạc quan (Optimistic Locking) thông qua cột `version` kiểu số nguyên trong bảng `app.achievements`.
- Khi client gửi cập nhật `PUT /achievements/:id`, backend so sánh `payload.version` với `existing.version`:
  - Nếu `payload.version !== existing.version`: Backend từ chối ngay lập tức với HTTP `409 Conflict`, mã lỗi `CONCURRENCY_CONFLICT`, thông báo: *"Dữ liệu hồ sơ đã được thay đổi bởi phiên làm việc khác. Vui lòng tải lại trang để xem thông tin mới nhất."*
  - Nếu trùng khớp: Tăng `version = existing.version + 1`, thực thi cập nhật và lưu vết lịch sử.

### 3.4 Bảo đảm tính toàn vẹn Transaction Rollback với `pg` client
- Hàm `withTransaction` quản lý vòng đời kết nối PostgreSQL từ Pool:
  1. Lấy kết nối từ pool: `client = await pool.connect()`
  2. Bắt đầu giao dịch: `await client.query('BEGIN')`
  3. Chạy khối nghiệp vụ truyền qua callback `fn({ client, query })`
  4. Nếu có lỗi: Gọi `await client.query('ROLLBACK')` và ném lại lỗi ra ngoài.
  5. Luôn luôn giải phóng kết nối về pool trong khối `finally { client.release(); }`.
- Đã kiểm chứng: Dữ liệu bị rollback 100%, không phát sinh bản ghi mồ côi (orphaned records).

### 3.5 Phòng chống CSV Formula Injection
- Khi xuất báo cáo CSV qua `toCsv`, tất cả các ô dữ liệu đều đi qua hàm vệ sinh `csvCell`:
  - Nếu dữ liệu bắt đầu bằng các ký tự công thức nguy hiểm trong bảng tính (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`), hệ thống tự động thêm dấu nháy đơn (`'`) vào đầu chuỗi:
    `text = `'${text};`
  - Chuỗi được bao trong dấu ngoặc kép `"` và các dấu ngoặc kép bên trong được escape thành `""`.
  - Tệp CSV được gửi kèm ký tự Byte Order Mark (BOM) UTF-8 (`\uFEFF`) để Excel và LibreOffice hiển thị chính xác tiếng Việt có dấu.

---

## 4. HƯỚNG DẪN TỰ KIỂM TRA (VERIFICATION STEPS)

Người dùng hoặc người đánh giá có thể tự kiểm tra nghiệm thu theo các bước:

```powershell
# 1. Di chuyển vào thư mục backend
cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# 2. Chạy bộ kiểm thử đơn vị hồi quy bảo mật W5-Q1
npm run test:w5-q1

# 3. Chạy bộ kiểm thử tích hợp thực tế W5-Q1 trên Live Supabase DB
npm run test:w5-q1:integration

# 4. Chạy kiểm thử hồi quy toàn bộ hệ thống
npm test
node --test tests/w4-p4.test.js tests/w4-q2.test.js tests/w4-p1.test.js tests/w4-q1.test.js
```

Tất cả các lệnh trên đều phải trả về mã thoát `0` với tỷ lệ đạt 100%.
