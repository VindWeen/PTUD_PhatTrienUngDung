# Database — SQL Server V2

Ngày 15/11/2026: đã reset database dự án và áp dụng 2 migration V2 vào PTUD_LHU. Hiện có **33 bảng nghiệp vụ**, 71 foreign key, 80 check constraint và 11 trigger. Baseline ban đầu không có dữ liệu nghiệp vụ; bảng kỹ thuật app._schema_migrations lưu lịch sử áp dụng. Trạng thái hiện tại cần kiểm tra trực tiếp trước khi dùng tùy chọn `--expect-empty`.

Schema mới nằm tại [sqlserver/migrations/](sqlserver/migrations/). Runner database/scripts/migrate.js chỉ đọc chuỗi V2; không chạy migration cũ. Xem [hướng dẫn V2](sqlserver/README.md) và [thiết kế nghiệp vụ](../docs/requirements/PERSONAL_VAULT_V2.md).

## Lệnh từ thư mục backend

- npm run migrate:status: kiểm lịch sử và checksum.
- npm run migrate: áp dụng migration V2 còn thiếu; database chưa có lịch sử V2 phải rỗng.
- npm run test:db:runner: kiểm cơ chế migration độc lập.
- npm run test:db: kiểm ràng buộc trên SQL Server bằng dữ liệu tạm rồi rollback.
- node ../database/sqlserver/verify.mjs --expect-empty: đối chiếu bảng, constraint, trigger và kiểm dữ liệu rỗng.

Schema V2 khởi tạo trống.

## File lịch sử

Các chuỗi migration đời trước có thể tra cứu trong lịch sử Git. Runner chỉ áp dụng chuỗi SQL Server V2.

Backend runtime và frontend đã chuyển sang V2; migrate thành công riêng lẻ không đồng nghĩa mọi trường hợp nghiệp vụ đã được nghiệm thu. Backup và minh chứng trên đĩa vẫn giữ. Báo cáo kiểm schema local: output/database-v2/schema-verification.json.

