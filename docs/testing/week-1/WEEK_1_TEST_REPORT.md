# BÁO CÁO KIỂM THỬ TOÀN DIỆN TUẦN 1 (WEEK 1 TEST REPORT)

**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU  
**Kỹ sư kiểm thử & Phụ trách:** Tạ Trần Vinh Quang (W1-Q4)  
**Thời điểm thực hiện:** 2026-10-01  
**Môi trường thực thi:** Node.js v24.14.1, PostgreSQL 15 (Supabase Live Instance tại Tokyo Pooler)  
**Trạng thái nghiệm thu:** **ĐẠT 100% TIÊU CHÍ (PASSED)**

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ

| Nhóm kiểm thử | Phạm vi | Số lượng test | Kết quả | Tỷ lệ đạt |
| :--- | :--- | :---: | :---: | :---: |
| **Kiểm tra Hợp đồng tĩnh** | OpenAPI 3.0.3, DDL, Fixtures, Rules (`validate_contracts.mjs`) | 68/68 | **PASS** | 100% |
| **Backend Auth & Scopes (W1-Q3)** | Xác thực, Token Rotation, CTE Scopes, Anti-Self Approval (`runner.js`) | 31/31 | **PASS** | 100% |
| **Hồ sơ & Tổ chức (W1-P3)** | Bất biến bối cảnh, Chống chu trình, Khóa ngoại Restrict (`w1-p3.test.js`) | 4/4 | **PASS** | 100% |
| **Audit Service & Masking (W1-Q4)** | Khử mật khẩu, Token, Bearer, Lưu vết audit (`audit.test.js`) | 5/5 | **PASS** | 100% |
| **Frontend Lint** | Kiểm tra mã nguồn React/JSX với ESLint (`npm run lint`) | Toàn bộ src/ | **PASS** | 100% (0 lỗi) |
| **Frontend Production Build** | Đóng gói sản phẩm với Vite (`npm run build`) | Toàn bộ dist/ | **PASS** | 100% |
| **Live Integration Demo** | End-to-end: Login -> Profile -> Organizations -> Supabase DB (`demo_w1_q4.mjs`) | 7 kịch bản | **PASS** | 100% |
| **TỔNG CỘNG KIỂM TRA** | | **108/108** | **PASS** | **100%** |

---

## 2. CHI TIẾT CÁC BỘ KIỂM THỬ TỰ ĐỘNG

### 2.1. Kiểm thử tĩnh hợp đồng kỹ thuật (`scripts/validate_contracts.mjs`)
- **Lệnh thực thi:** `node scripts/validate_contracts.mjs`
- **Kết quả:** `68/68 KIỂM TRA ĐẠT`
- **Các tiêu chuẩn xác minh:**
  - OpenAPI 3.0.3 đầy đủ 31 endpoints chuẩn REST API.
  - Các fixtures (`auth`, `profile`, `achievements`, `evidences`, `awards`, `errors`) khớp 100% với schema DDL.
  - Ràng buộc XOR trên chủ thể thành tích (hoặc Giảng viên hoặc Đơn vị, không thể cả hai hoặc không ai).
  - Bối cảnh đơn vị `ContextUnitId` bất biến và trường `version` kiểm soát tương tranh.
  - Các mã lỗi nghiệp vụ: `403 SELF_APPROVAL_PROHIBITED`, `409 CONCURRENCY_CONFLICT`, `409 ORGANIZATION_CYCLE`, `409 ORGANIZATION_HAS_DATA`.

### 2.2. Kiểm thử xác thực & phân quyền RBAC (`backend/tests/runner.js`)
- **Lệnh thực thi:** `npm --prefix backend test`
- **Kết quả:** `31/31 KIỂM TRA ĐẠT`
- **Các kịch bản tiêu biểu:**
  - Cấu hình biến môi trường và Zod schema validation.
  - Mã hóa mật khẩu an toàn với Bcryptjs (Cost factor = 10).
  - Cấp phát Access Token JWT và xoay vòng Refresh Token an toàn.
  - Phát hiện Replay Attack: Thu hồi toàn bộ token người dùng khi phát hiện Refresh Token cũ bị tái sử dụng trái phép.
  - Đổi mật khẩu thành công và thu hồi tất cả phiên làm việc trước đó.
  - Đệ quy CTE phạm vi đơn vị (`WITH RECURSIVE ScopeHierarchy`): TS. Bích quản lý Khoa CNTT được duyệt Bộ môn con KTPM (`include_descendants = TRUE`).
  - Phân quyền cốt lõi: Quản trị viên (`duc.pm`) không mặc nhiên có quyền duyệt hồ sơ (`ADMIN != MANAGER`).
  - Quy tắc liêm chính: Thẩm định viên tự duyệt hồ sơ của chính mình bị chặn `403 SELF_APPROVAL_PROHIBITED`.

### 2.3. Kiểm thử Hồ sơ & Cơ cấu tổ chức (`backend/tests/w1-p3.test.js`)
- **Lệnh thực thi:** `npm --prefix backend run test:w1-p3`
- **Kết quả:** `4/4 KIỂM TRA ĐẠT`
- **Các quy tắc xác minh:**
  - Chặn sửa hồ sơ cá nhân của người khác kể cả khi gọi thẳng vào service (`PROFILE_OWNER_REQUIRED`).
  - Chặn chọn đơn vị con làm đơn vị cha (`ORGANIZATION_CYCLE`).
  - Chặn xóa đơn vị đang chứa dữ liệu lịch sử hoặc phân công (`ORGANIZATION_HAS_DATA`).
  - Điều chuyển công tác không bao giờ cập nhật lại `app.achievements.context_unit_id` của các thành tích cũ.

### 2.4. Kiểm thử Audit Service & Data Masking (`backend/tests/audit.test.js`)
- **Lệnh thực thi:** `npm --prefix backend run test:audit`
- **Kết quả:** `5/5 KIỂM TRA ĐẠT`
- **Các ca kiểm thử:**
  - `maskSecrets` lọc bỏ 100% mật khẩu, password_hash, token, secret ở cấp 1 thành `***REDACTED***`.
  - Khử đệ quy trong object lồng nhau nhiều cấp và mảng.
  - Nhận diện chuỗi Bearer token (`Bearer ***REDACTED***`) và JWT độc lập (`***REDACTED_JWT***`).
  - Khử an toàn tham chiếu vòng (Circular reference) bằng `WeakSet` chống tràn bộ nhớ.
  - `recordAuditLog` lưu thành công vào Supabase PostgreSQL thật và `getAuditLogs` tra cứu chính xác.

---

## 3. BẢN GHI DEMO TÍCH HỢP THỰC TẾ (LIVE DEMO TRANSCRIPT)

Bản ghi trích xuất từ lệnh chạy: `node scripts/demo_w1_q4.mjs` kết nối trực tiếp Supabase PostgreSQL:

```text
================================================================
DEMO TÍCH HỢP TOÀN TRÌNH: LOGIN – ĐỌC HỒ SƠ – TỔ CHỨC – SUPABASE DB [W1-Q4]
Người thực hiện: Tạ Trần Vinh Quang (Phụ trách W1-Q4)
Thời điểm chạy:   2026-10-01T08:01:49.158Z
================================================================

⚡ Express App đang chạy tạm thời tại: http://127.0.0.1:54958

--- BƯỚC 1: KIỂM TRA SỨC KHỎE HỆ THỐNG & KẾT NỐI SUPABASE DB ---
GET /api/v1/health => HTTP 200: {"success":true,"data":{"status":"UP","uptimeSeconds":0,"timestamp":"2026-10-01T08:01:49.178Z","environment":"development","version":"1.0.0"}}
✅ Kết nối Supabase PostgreSQL thành công qua pg Pool [TLS: true]: aws-0-ap-northeast-2.pooler.supabase.com:5432
GET /api/v1/health/readiness => HTTP 200: {"success":true,"data":{"status":"UP","timestamp":"2026-10-01T08:01:50.143Z","database":{"status":"UP","isConnected":true,"latencyMs":956,"serverTime":"2026-10-01T08:01:50.046Z"},"system":{"memoryUsageMb":72,"uptimeSeconds":1}}}

--- BƯỚC 2: ĐĂNG NHẬP GIẢNG VIÊN (an.nv) VÀO HỆ THỐNG THẬT ---
POST /api/v1/auth/login => HTTP 200
- Token nhận được: eyJhbGciOiJIUzI1NiIs... (Đã cấp phát)
- Roles: [ 'LECTURER' ]
- Giảng viên: PGS.TS. Nguyễn Văn An

--- BƯỚC 3: ĐỌC HỒ SƠ NĂNG LỰC CÁ NHÂN (GET /api/v1/me/profile) ---
GET /api/v1/me/profile => HTTP 200
- Họ và tên: Nguyễn Văn An
- Học hàm / Học vị: Phó Giáo sư Tiến sĩ
- Mã giảng viên: GV00234
- Lịch sử công tác (2 giai đoạn):
  [1] 2020 – Hiện tại: Phó Giáo sư, Tiến sĩ - Bộ môn Kỹ thuật Phần mềm, Khoa Công nghệ Thông tin (Chính: Có)
  [2] 2015 – 2020: Phó Giáo sư, Tiến sĩ - Khoa Công nghệ Thông tin (Chính: Có)
- Thống kê hồ sơ (Stats): {"totalAchievements":0,"verifiedAchievements":0,"pendingAchievements":0,"recordedAwards":0}

--- BƯỚC 4: ĐĂNG NHẬP LÃNH ĐẠO KHOA (bich.tt) & ĐỌC HỒ SƠ TẬP THỂ ---
POST /api/v1/auth/login (bich.tt) => HTTP 200
GET /api/v1/units/1/profile => HTTP 200
- Tên đơn vị: Khoa Công nghệ Thông tin (FIT)
- Số lượng giảng viên trực thuộc: 1
- Thống kê tập thể: {"totalAchievements":0,"verifiedAchievements":0,"pendingAchievements":0,"recordedAwards":0}

--- BƯỚC 5: ĐĂNG NHẬP ADMIN (duc.pm) & TRUY VẤN CƠ CẤU TỔ CHỨC ---
POST /api/v1/auth/login (duc.pm) => HTTP 200
GET /api/v1/organizations => HTTP 200
- Tổng số đơn vị hiện có trong cơ sở dữ liệu: 4
  * [FIT_CS] Bộ môn Khoa học Máy tính (Loại: DEPARTMENT, Trực thuộc ID: 1)
  * [FIT_SE] Bộ môn Kỹ thuật Phần mềm (Loại: DEPARTMENT, Trực thuộc ID: 1)
  * [FIT] Khoa Công nghệ Thông tin (Loại: FACULTY, Trực thuộc ID: Gốc)
  * [PHARM] Khoa Dược (Loại: FACULTY, Trực thuộc ID: Gốc)

--- BƯỚC 6: XÁC MINH NHẬT KÝ KIỂM TOÁN (app.audit_logs) VÀ CHE BÍ MẬT ---
Tìm thấy 3 bản ghi audit log gần nhất trong Supabase PostgreSQL:
  [Audit #24] AUTH_LOGIN on users (User: 3) lúc 2026-10-01T08:01:52.978Z
    Payload NewValues: {"roles":["ADMIN"],"username":"duc.pm"}
  [Audit #23] AUTH_LOGIN on users (User: 2) lúc 2026-10-01T08:01:52.272Z
    Payload NewValues: {"roles":["MANAGER","LECTURER"],"username":"bich.tt"}
  [Audit #22] AUTH_LOGIN on users (User: 1) lúc 2026-10-01T08:01:51.408Z
    Payload NewValues: {"roles":["LECTURER"],"username":"an.nv"}

--- BƯỚC 7: KIỂM TRA QUY TẮC BẢO MẬT & BẢO VỆ DỮ LIỆU ---
PATCH /api/v1/lecturers/2 (an.nv sửa hồ sơ bich.tt) => HTTP 403: PROFILE_OWNER_REQUIRED
PATCH /api/v1/organizations/1 (Chọn con FIT_SE làm cha của FIT) => HTTP 409: ORGANIZATION_CYCLE
DELETE /api/v1/organizations/1 (Xóa Khoa đang có giảng viên & bộ môn) => HTTP 409: ORGANIZATION_HAS_DATA

================================================================
KẾT LUẬN DEMO: TOÀN BỘ CÁC BƯỚC TÍCH HỢP THỰC TẾ ĐỀU THÀNH CÔNG 100%!
================================================================
🔌 Đã đóng kết nối Supabase PostgreSQL Connection Pool.
```

---

## 4. CÁC LỖI VÀ TỒN TẠI ĐÃ ĐƯỢC PHÁT HIỆN VÀ KHẮC PHỤC TRONG W1-Q4

1. **Lỗi Migration 009 & 010 chưa chạy trên live DB:**
   - Ban đầu khi gọi `GET /api/v1/organizations`, DB báo lỗi `column u.description does not exist`.
   - **Xử lý:** Chạy `node database/scripts/migrate.js up` áp dụng thành công 2 file migration còn thiếu và nạp `seed.js`.
2. **Lỗ hổng thiếu nhật ký kiểm toán:**
   - Toàn bộ thao tác cơ cấu tổ chức và cập nhật hồ sơ chưa hề được lưu vết.
   - **Xử lý:** Xây dựng `auditService.js` với bộ khử dữ liệu nhạy cảm `maskSecrets` và gắn vào `organizationService`, `profileService`, `authService`.
3. **Thiếu nút bấm tài khoản thử nghiệm trên UI:**
   - `AuthPage.jsx` thiếu nút cho `duc.pm` (Admin) và `cuong.lh` (ĐBCL).
   - **Xử lý:** Đã bổ sung 2 nút mà không làm vỡ tỉ lệ 16:9 khung đăng nhập.
4. **Thiếu CI tự động kiểm soát chất lượng:**
   - Dự án chưa có cấu hình GitHub Actions để chạy khi push hoặc tạo PR.
   - **Xử lý:** Đã tạo `.github/workflows/ci.yml` chuẩn hóa lint, build và tests tự động.

---

## 5. HƯỚNG DẪN TỰ KIỂM TRA (VERIFICATION COMMANDS)

Để tự tái hiện và kiểm tra các kết quả trên, người kiểm thử có thể thực thi các lệnh sau:

```powershell
# 1. Kiểm tra hợp đồng tĩnh (68 checks)
node scripts/validate_contracts.mjs

# 2. Kiểm thử toàn diện Backend Auth & RBAC (31 tests)
npm --prefix backend test

# 3. Kiểm thử Hồ sơ & Tổ chức W1-P3 (4 tests)
npm --prefix backend run test:w1-p3

# 4. Kiểm thử Audit Service & Data Masking W1-Q4 (5 tests)
npm --prefix backend run test:audit

# 5. Chạy Live Demo tích hợp thật với Supabase PostgreSQL
npm --prefix backend run demo:w1-q4

# 6. Kiểm tra Lint và Build Frontend
npm --prefix frontend run lint
npm --prefix frontend run build
```
