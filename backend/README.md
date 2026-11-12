# Backend SQL Server

Express REST `/api/v1` dùng `mssql` để kết nối SQL Server. JWT, refresh cookie, quyền theo vai trò/phạm vi và file private do backend quản lý.

Từ thư mục này: `npm ci`, cấu hình `.env` theo `.env.example`, `npm run migrate`, `npm run migrate:status`, `npm start`. Không thay `.env` đang có bằng bản mẫu. Chỉ seed DB rỗng bằng `node ../database/scripts/seed.js --apply`.

Schema chuẩn ở `../database/sqlserver/migrations`, các truy vấn dùng T-SQL. Adapter giữ giao diện `rows/rowCount` và bind `$n` thành tham số `@pn`; không có bộ dịch cú pháp PostgreSQL khi chạy.

`npm test` chạy kiểm thử độc lập; `npm run test:sqlserver` dùng DB thật, fixture rollback và chạy nối tiếp. Xem [kết quả](../docs/testing/SQLSERVER_MIGRATION_REPORT.md) và [cài đặt](../docs/deployment/GETTING_STARTED.md).
