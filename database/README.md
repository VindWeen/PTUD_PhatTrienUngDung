# Database SQL Server

**Cập nhật 11/11/2026:** backend hiện dùng SQL Server qua `mssql`. Schema chuẩn là `database/sqlserver/migrations/` (2 migration, 53 bảng nghiệp vụ). Máy local đã có DB `PTUD_LHU`. Từ `backend`: `npm run migrate`, `npm run migrate:status`; seed chỉ nhận DB rỗng và cờ `--apply`. Xem [chi tiết SQL Server](sqlserver/README.md) và [kết quả chuyển đổi](../docs/testing/SQLSERVER_MIGRATION_REPORT.md).

Nội dung PostgreSQL bên dưới là lịch sử trước chuyển đổi, không còn là hướng dẫn chạy hiện tại.

Database hiện dùng **Supabase PostgreSQL**, đã có schema và dữ liệu seed; không dùng MSSQL.

- Schema chuẩn: [`supabase/migrations/`](../supabase/migrations).
- Seed chuẩn: [`supabase/seed.sql`](../supabase/seed.sql).
- `scripts/`: runner migrate/seed/scenario. Runner ưu tiên `supabase/migrations/`; `database/migrations/` là fallback legacy khi thư mục chuẩn không tồn tại, không chạy thêm vào DB hiện tại.

Từ `backend/`: `npm run migrate`, `npm run migrate:status`. Seed có thao tác xóa dữ liệu, chỉ dùng DB demo phù hợp. Xem [cài đặt](../docs/deployment/GETTING_STARTED.md), [scenario sáu vai trò](../docs/testing/scenario/README.md), [backup/restore](../docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md) trước khi thao tác DB có dữ liệu.
