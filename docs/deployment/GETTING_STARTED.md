# HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG (GETTING STARTED)
## Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
**Giai đoạn W1-Q2 & W1-Q3: Dựng Express, Supabase PostgreSQL, Migrations và Auth System**  
**Tác giả:** Tạ Trần Vinh Quang (Phụ trách Backend / Database / API)  
**Ngày cập nhật:** 01/10/2026 — **Mã nhiệm vụ:** `[W1-Q2]`, `[W1-Q3]`

---

## 1. YÊU CẦU HỆ THỐNG & MÔI TRƯỜNG

Trước khi cài đặt, đảm bảo máy tính đã cài đặt các công cụ sau:
1. **Node.js:** Phiên bản 20.19+ hoặc 22.12+ (hỗ trợ ES Modules native).
2. **NPM:** Phiên bản 10+ hoặc 11+.
3. **Cơ sở dữ liệu Supabase (PostgreSQL 15+):**
   - **Tùy chọn A (Cloud - Khuyên dùng):** Một project Supabase miễn phí trên [Supabase.com](https://supabase.com).
   - **Tùy chọn B (Local CLI / Docker):** Chạy Supabase cục bộ thông qua `npx supabase start` hoặc container PostgreSQL 15+.
4. **Git:** Đã cấu hình tài khoản làm việc.

---

## 2. QUY TRÌNH CÀI ĐẶT TRÊN MÁY MỚI (TỪNG BƯỚC)

### Bước 1: Cấu hình biến môi trường
Tại thư mục gốc dự án hoặc thư mục `backend/`:
```bash
# Sao chép tệp mẫu sang .env
cp .env.example backend/.env
```

Mở tệp `backend/.env` và điền thông tin kết nối Supabase của bạn:

#### Cách 1: Dùng chuỗi kết nối SUPABASE_DB_URL (Khuyên dùng)
```ini
PORT=5000
# Chọn cổng 6543 (Session/Transaction Pooler) nếu mạng sử dụng IPv4
SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

#### Cách 2: Dùng thông số kết nối thành phần
```ini
PORT=5000
DB_HOST=db.[PROJECT-REF].supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=YourPassword123!
DB_SSL=true
```

> **LƯU Ý BẢO MẬT TỐI THƯỢNG:**  
> - Tệp `.env` đã được liệt kê trong `.gitignore`.  
> - **TUYỆT ĐỐI KHÔNG commit tệp `.env` hay Database URL chứa mật khẩu thật lên Git.**  
> - DB URL và mật khẩu cơ sở dữ liệu chỉ được lưu trữ bí mật tại backend.

---

### Bước 2: Cài đặt thư viện phụ thuộc (Dependencies)
```bash
# 1. Cài đặt Backend (Express, pg, bcryptjs, jsonwebtoken, zod, ...)
cd backend
npm install

# 2. Cài đặt Frontend (React, Vite, Tailwind CSS, ...)
cd ../frontend
npm install
cd ..
```

---

### Bước 3: Khởi tạo Cơ sở dữ liệu và Chạy Migration

Toàn bộ cấu trúc cơ sở dữ liệu được định nghĩa duy nhất tại `supabase/migrations/` và seed dữ liệu tại `supabase/seed.sql`.

#### Nếu sử dụng script tích hợp của dự án:
Tại thư mục `backend/`:
```bash
# 1. Thực thi các file migration từ supabase/migrations/
npm run migrate

# 2. Kiểm tra trạng thái các bản migration đã áp dụng
npm run migrate:status

# 3. Nạp dữ liệu mẫu ban đầu (Seed data)
npm run seed
```

#### Nếu sử dụng Supabase CLI:
```bash
# Đẩy schema lên database liên kết
npx supabase db push

# Hoặc reset và nạp seed data sạch sẽ
npx supabase db reset
```

---

### Bước 4: Kiểm tra Sức khỏe Hệ thống (Health Check)

Khởi động backend server:
```bash
cd backend
npm run dev
```

Kiểm tra trạng thái sẵn sàng thông qua API Health Probe:
- **Liveness:** `http://localhost:5000/api/v1/health`
- **Readiness (Kiểm tra kết nối PostgreSQL qua pg Pool):** `http://localhost:5000/api/v1/health/readiness`

Kết quả trả về mẫu khi kết nối Supabase thành công:
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "timestamp": "2026-10-01T10:00:00.000Z",
    "database": {
      "status": "UP",
      "isConnected": true,
      "latencyMs": 45,
      "serverTime": "2026-10-01T10:00:00.123Z"
    }
  }
}
```

---

## 3. CƠ CHẾ BẢO MẬT & CÔ LẬP DATA API (SECURITY ISOLATION)

Hệ thống thiết lập phân quyền nghiêm ngặt nhằm bảo vệ dữ liệu:
1. **Schema Nghiệp vụ `app`:** Tất cả các bảng nghiệp vụ (`users`, `lecturers`, `achievements`, `award_records`, ...) đều nằm trong schema `app`.
2. **Thu hồi quyền từ Data API:** Vai trò `anon` và `authenticated` của Supabase PostgREST Data API bị thu hồi toàn bộ quyền (`REVOKE ALL ON SCHEMA app FROM anon, authenticated;`).
3. **Ngăn chặn Bypass Nghiệp vụ:** Bất kỳ ai có Supabase Anon Key gửi request tới PostgREST endpoint (ví dụ: `https://[ref].supabase.co/rest/v1/app.users`) đều bị từ chối 404/403. Mọi thao tác bắt buộc phải thông qua Express Backend REST API `/api/v1` có kiểm tra ma trận quyền và audit log.

---

## 4. TÁCH BIỆT MÔI TRƯỜNG DEMO VÀ LOCAL/TEST

- **Môi trường Demo:** Kết nối tới Supabase Cloud Project với dữ liệu seed mẫu từ `supabase/seed.sql`.
- **Môi trường Test tự động:** `npm test` trong thư mục `backend/` có cơ chế fallback thông minh: nếu chưa cấu hình `SUPABASE_DB_URL` thật, test runner sẽ tự động mô phỏng trong bộ nhớ để xác thực toàn diện 100% logic xác thực, phân quyền CTE và quy tắc cấm tự duyệt mà không làm gián đoạn CI/CD.
