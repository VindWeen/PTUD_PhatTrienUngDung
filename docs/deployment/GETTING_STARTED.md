# Cài đặt và chạy SQL Server

Cập nhật 11/11/2026. React/Vite giao tiếp Express REST; Express dùng driver mssql và T-SQL trên SQL Server. Không cần tài khoản Supabase để chạy phiên bản hiện tại.

## Máy đã được chuyển trong workspace

- SQL Server 2022 default instance: localhost, cổng1433; DB dự án: PTUD_LHU.
- Login riêng và mật khẩu đã lưu trong backend/.env, không commit và không in ra log.
- Kho tệp đang khớp dữ liệu: backend/storage/private/evidences. Giữ nguyên khi chạy lại; dùng đường dẫn tuyệt đối trong .env để tránh đổi theo thư mục khởi động.
- Không seed hoặc reset lại DB này: dữ liệu53bảng đã được chuyển, đối chiếu tại mốc609bản ghi.

## Cài ở máy khác

1. Cài SQL Server, bật TCP cho instance cần sử dụng; tạo database và login riêng trong SSMS. Cấp quyền tạo schema/migration trong DB dự án khi cài lần đầu.
2. Trong backend: npm ci. Chép .env.example thành .env nếu chưa có; điền DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD. SQL Login dùng mật khẩu riêng, không dùng mật khẩu tài khoản Windows. Instance có named port cần điền đúng cổngTCP.
3. Điền hai JWT secret khác nhau và cấu hình kho tệp private. TLS local theo mẫu; máy chủ bên ngoài dùng cấu hình chứng chỉ tương ứng.
4. npm run migrate; npm run migrate:status. Runner chỉ đọc database/sqlserver/migrations, kiểm checksum và khóa migration bằng transaction-owned application lock.
5. DB mới rỗng có thể nạp dữ liệu cơ bản: node ../database/scripts/seed.js --apply. Seed từ chối DB đã có dữ liệu, không TRUNCATE.
6. npm start. Terminal khác: cd frontend; npm ci; npm run dev. Mở http://localhost:5173.

## Kiểm tra

http://localhost:5000/api/v1/health/readiness phải trả status UP và databaseEngine SQL Server. Tải được frontend không chứng minh DB hoạt động. VITE_DATA_SOURCE mặc định api; fixture chỉ là dữ liệu mô phỏng.

Từ backend: npm test và npm run test:sqlserver. Nhóm SQL Server dùng giao dịch rollback và chạy nối tiếp. Kiểm thử không tự gọi AI trực tuyến; cấu hình provider/AI pool giữ riêng trong .env như trước.

## Chuyển nguồn một lần

scripts/migrate-postgres-to-sqlserver.mjs export tạo bản sao đọc nhất quán; import --apply chỉ nhận target rỗng, giữ ID, JSON và lịch sử rồi bật/kiểm lại toàn bộ FK/CHECK/trigger. pg chỉ là dependency phát triển cho công cụ này. Không sao chép dữ liệu bí mật trong backups/tmp vào Git.

## Giới hạn đã biết

13/14tệp private có hash khớp; tệp demo ach_8_ev_1793176346648_v1_a0658cbd.pdf đang thiếu từ nguồn. Không tạo tệp thay để giả lập bản gốc. Native BAK/restore riêng đã kiểm; gói backup đầy đủ cả tệp phải chờ khôi phục đúng tệp thiếu. Xem docs/testing/SQLSERVER_MIGRATION_REPORT.md và RUNBOOK_DEMO_BACKUP_RESTORE.md.
