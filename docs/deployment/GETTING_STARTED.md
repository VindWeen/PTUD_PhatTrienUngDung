# Cài đặt và chạy SQL Server

> Xem [hướng dẫn SQL Server V2](../../database/sqlserver/README.md) cho schema và migration hiện hành.

Cập nhật 11/11/2026. React/Vite giao tiếp Express REST; Express dùng driver mssql và T-SQL trên SQL Server. Không cần tài khoản Supabase để chạy phiên bản hiện tại.

## Cài ở máy khác

1. Cài SQL Server, bật TCP cho instance cần sử dụng; tạo database và login riêng trong SSMS. Cấp quyền tạo schema/migration trong DB dự án khi cài lần đầu.
2. Trong backend: npm ci. Chép .env.example thành .env nếu chưa có; điền DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD. SQL Login dùng mật khẩu riêng, không dùng mật khẩu tài khoản Windows. Instance có named port cần điền đúng cổngTCP.
3. Điền JWT_ACCESS_SECRET và cấu hình kho tệp private. TLS local theo mẫu; máy chủ bên ngoài dùng cấu hình chứng chỉ tương ứng.
4. npm run migrate; npm run migrate:status. Runner chỉ đọc database/sqlserver/migrations, kiểm checksum và khóa migration bằng transaction-owned application lock.
5. Tạo tài khoản quản trị đầu tiên theo hướng dẫn backend rồi nhập dữ liệu qua ứng dụng.
6. npm start. Terminal khác: cd frontend; npm ci; npm run dev. Mở http://localhost:5173.

## Kiểm tra

http://localhost:5000/api/v1/health/readiness phải trả status UP và databaseEngine SQL Server. Tải được frontend không chứng minh DB hoạt động.

Từ backend: npm test và npm run test:sqlserver. Nhóm SQL Server dùng giao dịch rollback và chạy nối tiếp. Kiểm thử không tự gọi AI trực tuyến; cấu hình provider/AI pool giữ riêng trong .env như trước.

Đối với backup và restore, xem [runbook](RUNBOOK_DEMO_BACKUP_RESTORE.md).
