# HƯỚNG DẪN TRIỂN KHAI VẬN HÀNH HỆ THỐNG (DEPLOYMENT GUIDE)
## Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
**Giai đoạn W5-Q3: Triển khai Demo, Backup và Restore DB/Kho File Private**  
**Tác giả:** Tạ Trần Vinh Quang (Phụ trách Backend / Database / Deployment)  
**Thời điểm:** 08/10/2026 (Asia/Saigon) — **Mã nhiệm vụ:** `[W5-Q3]`

---

## 1. TỔNG QUAN KIẾN TRÚC TRIỂN KHAI

Hệ thống được thiết kế theo kiến trúc 3 tầng chuẩn mực (Three-Tier Architecture), tối ưu hóa cho môi trường trường đại học, đảm bảo bảo mật dữ liệu và độc lập về chi phí:

```text
  +-----------------------------------------------------------------------+
  |                             NGƯỜI DÙNG                                |
  |           (Giảng viên / Quản lý Đơn vị / Hội đồng / QTV)              |
  +-----------------------------------+-----------------------------------+
                                      | HTTPS (TLS)
                                      v
  +-----------------------------------------------------------------------+
  |                           FRONTEND CLIENT                             |
  |             React 18 + Vite + Tailwind CSS + Axios Client             |
  |        (Triển khai: Vercel / Netlify / Nginx / Host tĩnh LHU)         |
  +-----------------------------------+-----------------------------------+
                                      | REST API /api/v1 (CORS + Cookies)
                                      v
  +-----------------------------------------------------------------------+
  |                           BACKEND SERVER                              |
  |                Node.js + Express REST API (Cổng 5000)                 |
  |  - Auth: JWT in-memory + Refresh Token HttpOnly Cookie                |
  |  - RBAC: Phân quyền theo vai trò & Cây tổ chức (CTE IncludeDescendants)|
  |  - Storage: Kho file Private nội bộ (Storage Adapter chống Traversal) |
  |  - AI Evaluator & RAG: Thẩm định logic + trích dẫn quy chế            |
  |  - An toàn: Helmet, Rate-limit, Correlation ID, Strict CORS           |
  +-------------------+-------------------------------+-------------------+
                      |                               |
                      | TLS (pg Pooler 5432/6543)     | Local File I/O
                      v                               v
  +---------------------------------------+   +---------------------------+
  |          DATABASE SUPABASE            |   |   KHO FILE PRIVATE (FS)   |
  |      PostgreSQL 17+ (Schema 'app')    |   | storage/private/evidences |
  | - 51 Bảng nghiệp vụ + Audit Logs      |   | - File minh chứng PDF/PNG |
  | - Thu hồi PostgREST direct access     |   | - File quyết định trao tặng|
  | - TLS SSL mode require                |   | - Truy xuất qua Express BE|
  +---------------------------------------+   +---------------------------+
```

---

## 2. QUY CHUẨN CẤU HÌNH BIẾN MÔI TRƯỜNG (.ENV)

### 2.1 Cấu hình Môi trường Backend (`backend/.env`)

| Tên biến | Kiểu giá trị | Mặc định | Mô tả chi tiết |
|---|---|---|---|
| `NODE_ENV` | `string` | `development` | Môi trường thực thi: `development`, `production`, hoặc `test`. |
| `PORT` | `number` | `5000` | Cổng lắng nghe của máy chủ Express. |
| `API_PREFIX` | `string` | `/api/v1` | Tiền tố đường dẫn tất cả API nghiệp vụ. |
| `CORS_ORIGIN` | `string` | `http://localhost:5173` | Danh sách URL Frontend được phép gọi CORS. Hỗ trợ nhiều domain phân tách bởi dấu phẩy (ví dụ: `http://localhost:5173,https://ptud-demo.lhu.edu.vn`). |
| `COOKIE_SECURE` | `boolean` | `false` | Bật cờ `Secure` cho Cookie (`true` khi chạy HTTPS production/demo, `false` khi chạy HTTP local). |
| `COOKIE_SAME_SITE` | `enum` | `lax` | Giá trị SameSite cho Cookie: `lax` (mặc định), `strict`, hoặc `none` (bắt buộc khi FE và BE khác domain trên HTTPS). |
| `COOKIE_DOMAIN` | `string` | *(Trống)* | Tùy chọn chỉ định domain cấp phát Cookie (ví dụ: `.lhu.edu.vn`). |
| `SUPABASE_DB_URL` | `string` | *(Bắt buộc)* | Chuỗi kết nối PostgreSQL tới Supabase Cloud qua TLS kèm `sslmode=require`. |
| `DB_POOL_MIN` | `number` | `2` | Số lượng kết nối tối thiểu trong pg Connection Pool. |
| `DB_POOL_MAX` | `number` | `10` | Số lượng kết nối tối đa trong pg Connection Pool (tương thích giới hạn Free Tier). |
| `DB_CONNECTION_TIMEOUT` | `number` | `15000` | Thời gian chờ kết nối tối đa (ms) trước khi báo lỗi. |
| `JWT_ACCESS_SECRET` | `string` | *(Secret)* | Khóa ký số bí mật cho Access Token JWT (tối thiểu 32 ký tự). |
| `JWT_ACCESS_EXPIRES_IN` | `string` | `2h` | Thời hạn hiệu lực của Access Token. |
| `JWT_REFRESH_SECRET` | `string` | *(Secret)* | Khóa ký số bí mật cho Refresh Token JWT (tối thiểu 32 ký tự). |
| `JWT_REFRESH_EXPIRES_IN` | `string` | `7d` | Thời hạn hiệu lực của Refresh Token. |
| `STORAGE_DIR` | `string` | `storage/private/evidences` | Thư mục vật lý lưu trữ kho file private trên server Express. |
| `UPLOAD_DIR` | `string` | `../storage/evidences` | Thư mục tiếp nhận upload tạm thời. |
| `MAX_FILE_SIZE_BYTES` | `number` | `10485760` | Giới hạn dung lượng tệp tin tải lên (mặc định 10 MB). |

### 2.2 Cấu hình Môi trường Frontend (`frontend/.env`)

```ini
# URL tiền tố của API Backend
VITE_API_URL=/api/v1

# Chế độ dữ liệu: 'api' kết nối Express Backend thật; 'fixture' dùng dữ liệu tĩnh
VITE_DATA_SOURCE=api
```

---

## 3. CẤU HÌNH KẾT NỐI SUPABASE QUA TLS VÀ POOLER

### 3.1 Hai tùy chọn cổng kết nối của Supabase

1. **Cổng 5432 (Direct Connection):**
   - Định dạng: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require`
   - Phù hợp với mạng hỗ trợ IPv6 hoặc các tiến trình batch, chạy script migration/dump.
2. **Cổng 6543 (Session/Transaction Pooler Supavisor):**
   - Định dạng: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`
   - Phù hợp với mọi mạng IPv4 (đặc biệt là mạng cáp quang, Wi-Fi trường học và các nền tảng serverless).
   - Tối ưu hóa số lượng kết nối đồng thời mà không làm quá tải RAM của PostgreSQL Free Tier.

### 3.2 Tự động kích hoạt TLS trong `database.js`

Trong `backend/src/config/database.js`, mã nguồn tự động phát hiện miền Supabase Cloud (`supabase.co`, `supabase.com`, `pooler.supabase.com`) và áp dụng cấu hình TLS tương thích:

```javascript
const isSupabaseCloud = connectionString && (
  connectionString.includes('supabase.co') || 
  connectionString.includes('supabase.com') ||
  connectionString.includes('pooler.supabase.com')
);
const useSsl = config.DB_SSL || isSupabaseCloud;

return {
  ...baseConfig,
  connectionString: cleanConnectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
};
```

---

## 4. BẢO MẬT PHÂN QUYỀN VÀ CÔ LẬP DATA API (ADR-001)

Theo Quyết định Kiến trúc **ADR-001**:
1. **Thu hồi toàn bộ quyền từ Data API:**
   ```sql
   REVOKE ALL ON SCHEMA app FROM anon, authenticated;
   ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated;
   ```
2. **Loại bỏ nguy cơ Bypass nghiệp vụ:** Người dùng bên ngoài sở hữu `anon_key` hoặc `authenticated_key` gửi request trực tiếp đến Supabase PostgREST endpoint (ví dụ: `https://[ref].supabase.co/rest/v1/app.users`) sẽ bị từ chối 100% với mã lỗi HTTP 403 / SQLSTATE `42501`.
3. **Cổng giao tiếp duy nhất:** Mọi yêu cầu truy vấn hay cập nhật dữ liệu bắt buộc phải đi qua Express Backend REST API `/api/v1` có xác thực JWT, kiểm tra phạm vi đơn vị (CTE Scopes) và ghi log kiểm toán (Audit Trail).

---

## 5. CÁC PHƯƠNG ÁN TRIỂN KHAI DEMO

### Phương án A: Triển khai Đám mây (Cloud Demo — Khuyên dùng)
- **Database:** Supabase Cloud Free Tier (AWS Seoul/Tokyo/Singapore, PostgreSQL 17+).
- **Backend:** Triển khai trên Render, Fly.io, Railway hoặc VPS chạy Node.js 20+.
  - Biến môi trường: Nạp các giá trị theo bảng mục 2.1.
  - Cấu hình Cookie: `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` (nếu FE trên domain khác).
- **Frontend:** Triển khai trên Vercel hoặc Cloudflare Pages (tự động build từ thư mục `frontend/`).
  - Thiết lập proxy hoặc trỏ `VITE_API_URL=https://[backend-domain]/api/v1`.

### Phương án B: Triển khai Cục bộ (Local Demonstration)
1. **Khởi chạy Backend:**
   ```powershell
   cd backend
   npm run dev
   ```
2. **Khởi chạy Frontend:**
   ```powershell
   cd frontend
   npm run dev
   ```
3. **Kiểm tra Sức khỏe API:**
   - Liveness probe: `http://localhost:5000/api/v1/health`
   - Readiness probe: `http://localhost:5000/api/v1/health/readiness`
   - Giao diện người dùng: `http://localhost:5173`

---

## 6. DANH MỤC LỆNH VẬN HÀNH CHÍNH (OPERATIONS CLI)

| Lệnh thực thi (tại `backend/`) | Mục đích | Tệp thực thi |
|---|---|---|
| `npm run pre-demo-check` | Kiểm tra sức khỏe, đánh thức DB free, đo latency | `scripts/pre-demo-check.mjs` |
| `npm run backup` | Sao lưu toàn diện CSDL (schema, data, roles) & kho file | `scripts/backup.mjs` |
| `npm run restore` | Khôi phục sang isolated schema & đối soát mã băm | `scripts/restore.mjs` |
| `npm run test:w5-q3` | Chạy 7 ca kiểm thử tích hợp tự động W5-Q3 | `backend/tests/w5-q3.test.js` |
| `npm run migrate` | Áp dụng các bản cập nhật CSDL mới nhất | `database/scripts/migrate.js` |
| `npm test` | Kiểm tra hồi quy toàn diện hệ thống | `backend/tests/runner.js` |
