# HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG (GETTING STARTED)
## Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
**Giai đoạn W1-Q2: Dựng Express, SQL Server và Migration Runner**  
**Tác giả:** Tạ Trần Vinh Quang (Phụ trách Backend / Database / API)  
**Ngày cập nhật:** 25/09/2026 — **Mã nhiệm vụ:** `[W1-Q2]`

---

## 1. YÊU CẦU HỆ THỐNG & MÔI TRƯỜNG

Trước khi cài đặt, đảm bảo máy tính đã cài đặt các công cụ sau:
1. **Node.js:** Phiên bản 20.19+ hoặc 22.12+ (hỗ trợ ES Modules native).
2. **NPM:** Phiên bản 10+ hoặc 11+.
3. **Microsoft SQL Server:** Phiên bản 2019, 2022 hoặc SQL Server Express (đang chạy service trên cổng 1433).
4. **Git:** Đã cấu hình tài khoản làm việc.

---

## 2. QUY TRÌNH CÀI ĐẶT TRÊN MÁY MỚI (TỪNG BƯỚC)

### Bước 1: Sao chép tệp cấu hình biến môi trường
Tại thư mục gốc dự án hoặc thư mục `backend/`:
```bash
# Sao chép tệp mẫu sang .env
cp .env.example backend/.env
```

Mở tệp `backend/.env` và điều chỉnh thông tin kết nối SQL Server của máy bạn nếu cần:
```ini
PORT=5000
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=PTUD_AchievementDB
DB_USER=sa
DB_PASSWORD=MậtKhẩuCủaBạn123!
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

> **LƯU Ý BẢO MẬT:** Tệp `.env` đã được cấu hình trong `.gitignore`. **Tuyệt đối không commit tệp `.env` chứa mật khẩu thật lên Git.**

---

### Bước 2: Cài đặt thư viện phụ thuộc (Dependencies)
Mở terminal và cài đặt cho cả Backend và Frontend:
```bash
# 1. Cài đặt Backend
cd backend
npm install

# 2. Cài đặt Frontend (nếu chưa cài)
cd ../frontend
npm install
cd ..
```

---

### Bước 3: Khởi tạo Cơ sở dữ liệu bằng Migration Runner
Hệ thống sử dụng kịch bản migration runner tự động, theo dõi lịch sử qua bảng `_SchemaMigrations` và đảm bảo giao dịch nguyên tử (Atomic Transaction):

```bash
# Chạy toàn bộ migrations từ 001 đến 008
cd backend
npm run migrate
```

Hoặc kiểm tra trạng thái các bản migration:
```bash
npm run migrate:status
```

**Thứ tự các bản migrations được thực thi:**
1. `001_create_schema_migrations.sql`: Tạo bảng theo dõi `_SchemaMigrations`.
2. `002_create_identity_tables.sql`: Bảng `Users`, `Roles`, `UserRoles`, `RefreshTokens`.
3. `003_create_organization_tables.sql`: Bảng `OrganizationUnits`, `UserUnitScopes`, `UnitRepresentatives`.
4. `004_create_lecturers_and_catalogs.sql`: Bảng `Lecturers`, `LecturerAssignments`, `AcademicYears`, `AchievementTypes`, `AwardTypes`.
5. `005_create_achievement_tables.sql`: Bảng `Achievements` (ràng buộc CHECK XOR, ContextUnitId, RowVersion), `AchievementSubmissions`.
6. `006_create_evidence_and_verification_tables.sql`: Bảng `Evidences`, `EvidenceFiles` (bất biến), `SubmissionEvidenceFiles`, `AchievementStatusHistories`.
7. `007_create_award_tables.sql`: Bảng `AwardDecisions`, `AwardDecisionFiles`, `AwardRecords` (Filtered Unique Indexes), `AwardRecordAchievements`, `AwardRecordHistories`.
8. `008_create_system_tables.sql`: Bảng `Notifications`, `AuditLogs`.

---

### Bước 4: Nạp dữ liệu mẫu (Seed Data)
Chạy script nạp tài khoản, phân công vai trò, hồ sơ giảng viên và danh mục chuẩn hóa theo hợp đồng W1-Q1:
```bash
cd backend
npm run seed
```

**Danh sách tài khoản demo được khởi tạo (Mật khẩu mặc định: `demo1234`):**
| Tài khoản (`username`) | Email đăng nhập | Họ và tên | Vai trò năng lực | Phạm vi phân công |
|---|---|---|---|---|
| `an.nv` | `an.nv@lhu.edu.vn` | PGS.TS. Nguyễn Văn An | `LECTURER` | Giảng viên Bộ môn Kỹ thuật Phần mềm |
| `bich.tt` | `bich.tt@lhu.edu.vn` | TS. Trần Thị Bích | `MANAGER`, `LECTURER` | Cán bộ quản lý Khoa CNTT (kế thừa các Bộ môn con) |
| `cuong.lh` | `cuong.lh@lhu.edu.vn` | ThS. Lê Hoàng Cường | `UNIT_REPRESENTATIVE`, `LECTURER` | Đại diện đơn vị Bộ môn Kỹ thuật Phần mềm |
| `duc.pm` | `duc.pm@lhu.edu.vn` | ThS. Phạm Minh Đức | `ADMIN`, `RECORDS_OFFICER` | Quản trị viên hệ thống & Cán bộ hồ sơ khen thưởng |

---

### Bước 5: Khởi động Backend Server
```bash
cd backend
npm run dev
# Hoặc khởi chạy production:
# npm start
```

Máy chủ sẽ lắng nghe tại: **`http://localhost:5000`**

---

### Bước 6: Kiểm tra Sức khỏe Hệ thống (Health & Readiness Checks)
Mở trình duyệt hoặc dùng `curl` / Postman kiểm tra:

1. **Liveness Probe (Kiểm tra tiến trình Node.js sống):**
   ```http
   GET http://localhost:5000/api/v1/health
   ```
   *Kết quả mẫu (200 OK):*
   ```json
   {
     "success": true,
     "data": {
       "status": "UP",
       "uptimeSeconds": 45,
       "environment": "development",
       "version": "1.0.0"
     }
   }
   ```

2. **Readiness Probe (Kiểm tra kết nối thực tế tới SQL Server):**
   ```http
   GET http://localhost:5000/api/v1/health/readiness
   ```
   *Kết quả mẫu khi kết nối DB thành công (200 OK):*
   ```json
   {
     "success": true,
     "data": {
       "status": "UP",
       "database": {
         "status": "UP",
         "isConnected": true,
         "latencyMs": 2,
         "serverTime": "2026-09-25T14:40:00.000Z"
       },
       "system": {
         "memoryUsageMb": 38,
         "uptimeSeconds": 45
       }
     }
   }
   ```

---

### Bước 7: Khởi chạy Giao diện Frontend
Mở một cửa sổ terminal mới:
```bash
cd frontend
npm run dev
```
Truy cập giao diện tại: **`http://localhost:5173`**

---

## 3. TÀI KHOẢN TRẢI NGHIỆM & KIỂM THỬ (SEED ACCOUNTS)

Cơ sở dữ liệu đã nạp sẵn 4 tài khoản chuẩn hóa theo sơ đồ tổ chức LHU (Mật khẩu mặc định: `demo1234`):

| Username | Email | Họ và tên | Chức danh / Vai trò | Phạm vi quản lý (Scope) |
| :--- | :--- | :--- | :--- | :--- |
| `an.nv` | `an.nv@lhu.edu.vn` | PGS.TS. Nguyễn Văn An | Giảng viên (`LECTURER`) | Thuộc Bộ môn KTPM (Không có scope quản lý) |
| `bich.tt` | `bich.tt@lhu.edu.vn` | TS. Trần Thị Bích | Quản lý Khoa (`MANAGER`, `LECTURER`) | **Khoa CNTT** kèm toàn bộ Bộ môn con (CTE `IncludeDescendants = 1`) |
| `cuong.lh` | `cuong.lh@lhu.edu.vn` | ThS. Lê Hoàng Cường | Đại diện đơn vị (`UNIT_REP`, `LECTURER`) | **Bộ môn KTPM** (Chỉ đơn vị trực tiếp) |
| `duc.pm` | `duc.pm@lhu.edu.vn` | KS. Phạm Minh Đức | Quản trị viên (`ADMIN`) | Quản trị kỹ thuật (**ADMIN != MANAGER**, không tự động có quyền thẩm định hồ sơ) |

---

## 4. XÁC THỰC BẢO MẬT & PHÂN QUYỀN (W1-Q3)

1. **Chiến lược Token:**
   - **Access Token:** Ký JWT ngắn hạn (2 giờ), client lưu trữ trong **bộ nhớ (In-memory)**, gửi qua Header `Authorization: Bearer <token>`.
   - **Refresh Token:** Chuỗi ngẫu nhiên an toàn 64-byte hex, lưu trữ trong **Cookie HttpOnly (`SameSite=Lax; Secure`)**, cơ sở dữ liệu chỉ lưu mã băm **SHA-256** (`TokenHash`).
   - **Xoay vòng Token (Rotation):** Mỗi lần gọi `/api/v1/auth/refresh`, token cũ lập tức bị thu hồi (`RevokedAt`) và thay thế bằng token mới. Nếu phát hiện token cũ bị gửi lại (Replay attack), hệ thống lập tức thu hồi toàn bộ token của tài khoản đó.
2. **Kiểm tra Quyền & Phạm vi động (RBAC & CTE Scope):**
   - Đọc quyền trực tiếp từ bảng `UserRoles` và `UserUnitScopes` đang có hiệu lực (`ValidFrom <= NOW AND (ValidTo IS NULL OR ValidTo >= NOW)`), đảm bảo việc thu hồi hoặc phân công lại có hiệu lực tức thì.
   - Khi cán bộ quản lý cấp Khoa có `IncludeDescendants = 1`, truy vấn đệ quy CTE tự động cho phép thẩm định hồ sơ của các Bộ môn trực thuộc.
   - **Quy tắc ADMIN != MANAGER:** Admin không thể duyệt hoặc thẩm định hồ sơ nếu không được phân công phạm vi quản lý rõ ràng.
   - **Quy tắc liêm chính:** Chặn triệt để cán bộ tự duyệt hồ sơ do chính mình là chủ thể (`SELF_APPROVAL_PROHIBITED`).

---

## 5. CHẠY BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TESTS)

Để chạy kiểm thử toàn diện toàn bộ 31 test cases bao gồm Config, Error Classes, DB Param Binding, Migrations, Probes, Auth Login/Refresh/Logout/ChangePassword, Role Checks, Scope CTE, Admin restriction, và Anti-self approval:
```bash
# 1. Chạy toàn bộ kiểm thử Backend & Auth
cd backend
npm test

# 2. Chạy kiểm tra hợp đồng API và Fixtures (W1-Q1)
node ../scripts/validate_contracts.mjs

# 3. Kiểm tra mã nguồn Frontend
cd ../frontend
npm run lint
npm run build
```

