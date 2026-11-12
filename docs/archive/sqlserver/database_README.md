# Database

Database hiện dùng **Supabase PostgreSQL**, đã có schema và dữ liệu seed; không dùng MSSQL.

- Schema chuẩn: [`supabase/migrations/`](../supabase/migrations).
- Seed chuẩn: [`supabase/seed.sql`](../supabase/seed.sql).
- `scripts/`: runner migrate/seed/scenario. Runner ưu tiên `supabase/migrations/`; `database/migrations/` là fallback legacy khi thư mục chuẩn không tồn tại, không chạy thêm vào DB hiện tại.

Từ `backend/`: `npm run migrate`, `npm run migrate:status`. Seed có thao tác xóa dữ liệu, chỉ dùng DB demo phù hợp. Xem [cài đặt](../docs/deployment/GETTING_STARTED.md), [scenario sáu vai trò](../docs/testing/scenario/README.md), [backup/restore](../docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md) trước khi thao tác DB có dữ liệu.
