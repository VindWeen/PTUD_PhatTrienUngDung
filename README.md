# Kho thành tích cá nhân

Dự án lưu thành tích và minh chứng cá nhân, đối chiếu hồ sơ với quy chế, theo dõi mục tiêu và tạo CV công khai. Tổ chức nhiều cấp hỗ trợ thành viên theo quyền được giao. Xem [use case và ERD V2](docs/requirements/PERSONAL_VAULT_V2.md).

Backend gắn router nghiệp vụ từ `backend/src/modules/`. Frontend đăng ký các trang trong [AppRoutes.jsx](frontend/src/routes/AppRoutes.jsx). Migration hiện hành nằm trong [database/sqlserver/migrations](database/sqlserver/migrations). Cá nhân không cần thuộc tổ chức để sử dụng kho. Kết quả khám đối chiếu dữ liệu đã khai, không phải quyết định công nhận danh hiệu.

## Chạy local

1. Trong `backend/`, chạy `npm ci` và cấu hình `.env` từ `.env.example`, trỏ tới SQL Server.
2. Chạy `npm run migrate:status` rồi `npm run migrate` để áp dụng migration V2 còn thiếu.
3. Chạy `npm start` trong `backend/`; chạy `npm ci` và `npm run dev` trong `frontend/`.
4. Kiểm tra `http://localhost:5000/api/v1/health/readiness`, sau đó mở `http://localhost:5173`.

Không tự động seed hay import dữ liệu. Người dùng có thể đăng ký tài khoản; để thiết lập quản trị viên đầu tiên, xem [hướng dẫn backend](backend/README.md). Quy chế và danh mục cần được tạo hoặc nhập bằng dữ liệu thực tế.

### Dựng dữ liệu demo thi đua trên máy mới

Tạo database SQL Server trống tên `PTUD_LHU` và cấu hình `backend/.env` với thông tin kết nối của máy mới. Tài khoản chạy migration cần quyền tạo schema và bảng trong database đó. Từ thư mục gốc dự án, chạy:

```powershell
npm --prefix backend ci
npm --prefix backend run migrate
node --env-file=backend/.env scripts/seed-lecturer-demo.mjs --apply --database=PTUD_LHU
```

- Seed in danh sách tài khoản và mật khẩu demo dùng chung, được sinh mới mỗi lần dựng. Đăng nhập `gv-du@tdkt.demo.example.test` để xem kho thành tích, KPI và lịch sử đối chiếu cá nhân. Tài khoản `truong@tdkt.demo.example.test` xem lượt đối chiếu hàng loạt cấp trường.
- Ảnh chụp bộ demo ngày 19/11/2026 ghi nhận 20 tài khoản, 4 tổ chức, 44 thành tích với 9 tệp minh chứng, 4 KPI và 22 lượt đối chiếu. Mỗi khoa có thêm 4 thành viên với 2–3 thành tích. Ba KPI của `gv-du` lần lượt ở mức 100%, 50% và 0%.
- Lịch sử demo được tính bằng engine hiện hành cho ngày 18 và 19/11/2026 và bao gồm lượt quét cấp trường cho hai khoa trực thuộc. Khoa Ngoại ngữ có thành viên riêng và yêu cầu liên kết đang chờ.
- Seed đầy đủ dừng nếu bộ demo đã tồn tại. Cờ `--awards-only` dành cho cập nhật cấu hình quy chế và thuộc tính công nhận trên bộ demo cũ.

## Kiểm tra và giới hạn

- Trong `backend/`, `npm test` kiểm tra độc lập; `npm run test:sqlserver` chạy kiểm tra schema, danh tính, đánh giá và API V2 trên SQL Server với dữ liệu kiểm thử rollback.
- Trong `frontend/`, chạy `npm run lint`, `npm test` và `npm run build`.
- Tại commit `91e9968`, frontend lint và build đạt, 18/18 test frontend đạt, 27/27 test backend độc lập và 51/51 test tích hợp SQL Server đạt. `migrate:status` xác nhận cả 8 migration đã áp dụng.
- OCR cần cấu hình dịch vụ; khôi phục mật khẩu qua email cần cấu hình gửi thư. Quy chế cần được xây dựng và xác minh trước khi kết quả khám có ý nghĩa.

Backend, frontend và migration trong nhánh này dùng kiến trúc V2. Lịch sử triển khai trước V2 có thể tra cứu trong Git.

Xem [database](database/README.md), [chỉ mục API](docs/api/API_REFERENCE.md) và [mục lục tài liệu](docs/README.md).
