# Database — SQL Server V2

Ngày 15/11/2026: đã reset database dự án và áp dụng 2 migration V2 vào PTUD_LHU. Hiện có **33 bảng nghiệp vụ**, 71 foreign key, 80 check constraint và 11 trigger. Baseline ban đầu không có dữ liệu nghiệp vụ; bảng kỹ thuật app._schema_migrations lưu lịch sử áp dụng. Trạng thái hiện tại cần kiểm tra trực tiếp trước khi dùng tùy chọn `--expect-empty`.

Schema mới nằm tại [sqlserver/v2/migrations/](sqlserver/v2/migrations/). Runner database/scripts/migrate.js chỉ đọc chuỗi V2; không chạy migration cũ. Xem [hướng dẫn V2](sqlserver/v2/README.md) và [thiết kế nghiệp vụ](../docs/requirements/PERSONAL_VAULT_V2.md).

## Lệnh từ thư mục backend

- npm run migrate:status: kiểm lịch sử và checksum.
- npm run migrate: áp dụng migration V2 còn thiếu; database chưa có lịch sử V2 phải rỗng.
- npm run test:db:runner: kiểm cơ chế migration độc lập.
- npm run test:db:v2: kiểm ràng buộc trên SQL Server bằng dữ liệu tạm rồi rollback.
- node ../database/sqlserver/v2/verify.mjs --expect-empty: đối chiếu bảng, constraint, trigger và kiểm dữ liệu rỗng.

Chưa tạo seed/import. Lệnh seed hiện tại bị chặn để không nạp lại mô hình cũ. Không chạy thủ công sqlserver/seed.sql.

## File lịch sử

sqlserver/migrations/, sqlserver/seed.sql, migrations/, seed/ và ../supabase/ thuộc phiên bản trước, không phải schema runtime V2. Chúng còn được giữ do một số công cụ/test cũ tham chiếu. Không áp dụng cùng chuỗi V2.

Backend runtime và frontend đã chuyển sang V2; migrate thành công riêng lẻ không đồng nghĩa mọi trường hợp nghiệp vụ đã được nghiệm thu. Backup và minh chứng trên đĩa vẫn giữ. Báo cáo kiểm schema local: output/database-v2/schema-verification.json.

