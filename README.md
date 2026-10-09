# Quản lý Hồ sơ Thành tích Số & Khen thưởng LHU

React/Vite/Tailwind → Express REST `/api/v1` → Supabase PostgreSQL qua `pg` theo ADR-001. Auth do Express quản lý; file private trên ổ đĩa server, DB chỉ giữ metadata. Bản đầu là UI demo; bản hiện tại đã tích hợp API. Kế hoạch SQL Server cũ được thay bằng Supabase.

## Cài trên máy mới

Yêu cầu Git, Node.js 20.19+ hoặc 22.12+, npm và Supabase project **demo riêng, không có dữ liệu cần giữ**. Lệnh PowerShell, bắt đầu tại thư mục muốn clone:

```powershell
git clone https://github.com/VindWeen/PTUD_PhatTrienUngDung.git
cd PTUD_PhatTrienUngDung
Copy-Item backend/.env.example backend/.env
cd backend
npm ci
cd ../frontend
npm ci
cd ..
```

Điền `backend/.env` theo [hướng dẫn cài sạch](docs/deployment/GETTING_STARTED.md): URL DB, JWT secrets riêng và storage tuyệt đối. Backend ưu tiên `backend/.env`, chỉ fallback root `.env` khi file đó không tồn tại. Biến môi trường tiến trình ưu tiên hơn file. Không đưa secrets vào frontend/Git.

```powershell
cd backend
npm run migrate
npm run migrate:status
# CHỈ chạy trên DB demo mới: seed.sql có TRUNCATE, xóa dữ liệu cũ.
npm run seed
npm start
```

Giữ terminal backend mở. Terminal thứ hai tại root:

```powershell
Set-Content frontend/.env.local "VITE_DATA_SOURCE=api`nVITE_API_URL=/api/v1"
cd frontend
npm run dev -- --strictPort
```

Mở [đăng nhập](http://localhost:5173/login). Tài khoản seed: `an.nv` (giảng viên), `bich.tt` (quản lý + giảng viên), `duc.pm` (admin), `cuong.lh` (đại diện + giảng viên), `records.demo` (văn thư). Mật khẩu mẫu chung **`demo1234`**, chỉ cho demo riêng. Seed chưa có tài khoản Hội đồng. Không đăng nhập bằng email tùy ý như bản UI đầu.

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
Invoke-RestMethod http://localhost:5000/api/v1/health/readiness
```

Readiness phải có DB `UP`; tải được trang đăng nhập chưa chứng minh DB hoạt động. `VITE_DATA_SOURCE=fixture` chỉ dùng phát triển, không nghiệm thu tích hợp. Vite proxy chỉ chạy ở dev; hosting build tĩnh cần reverse proxy `/api/v1` hoặc `VITE_API_URL` tuyệt đối trước build.

## Sử dụng và bàn giao

- [Hướng dẫn theo vai trò](docs/USER_GUIDE.md), [demo đủ vai trò 20–25 phút](docs/DEMO_SCRIPT.md) (có bản rút gọn).
- [Checklist tổng duyệt W6-P2](docs/testing/w6-p2/REHEARSAL_CHECKLIST.md): sáu vai trò, thuật ngữ, quyền sai và gate restore thật.
- [Video và minh chứng hai người W6-P3](docs/testing/w6-p3/README.md): timeline task/SHA, bảng đóng góp, PR/test evidence và phiếu review release 28/10.
- [Cài đặt, TLS, free API và xử lý lỗi](docs/deployment/GETTING_STARTED.md).
- [Triển khai](docs/deployment/DEPLOYMENT_GUIDE.md), [backup/restore W5-Q3](docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md).
- [Kết quả và tự kiểm tra W5-P3](docs/weekly/WEEK_05_W5_P3.md).
- [Blueprint/ADR-001](docs/PROJECT_DEVELOPMENT_BLUEPRINT.md), [hợp đồng API](docs/api/openapi.json).

AI chỉ tham khảo với nguồn/tiêu chí đã xác nhận, không tự quyết định trao thưởng. KPI mock/CSV thử nghiệm phải gắn nhãn mô phỏng. Provider free cần key server-only và quota; không bảo đảm luôn sẵn sàng. W5-P1 còn p95 dashboard vượt 2 giây.

## Kiểm tra

```powershell
cd frontend
npm run build
npm run lint
cd ../backend
npm run test:w5-p1
# DB demo có quyền tạo/xóa schema; không chạy production.
node tests/w5-p3.integration.js
```

Lệnh cuối migrate/seed schema ngẫu nhiên, đăng nhập thật rồi dọn schema. Kiểm restore HTTP cần `W5_P3_BACKUP_DIR` theo hướng dẫn W5-P3; chưa cấp thì ghi `NOT_RUN`. `npm test` có fallback mock nên PASS không thay thế bằng chứng Supabase thật.
