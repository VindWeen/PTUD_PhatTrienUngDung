# SQL Server

**Schema runtime từ 15/11/2026: [V2](v2/README.md)**, tại v2/migrations/. Database PTUD_LHU đã áp dụng baseline V2 và ràng buộc V2: 33 bảng nghiệp vụ, không seed/import.

Runner database/scripts/migrate.js mặc định chỉ đọc v2/migrations/, dùng transaction/application lock, giữ lịch sử checksum và từ chối tạo baseline trên database có bảng chưa được quản lý bởi chuỗi V2.

Các file migrations/001..005, seed.sql, schema-manifest.json, build-baseline.mjs, build-seed.mjs và verify-live.mjs tại thư mục này là tài sản kỹ thuật của mô hình trước. Không dùng chúng để khởi tạo hoặc kiểm chứng V2. Các test schema.test.mjs vẫn kiểm baseline lịch sử; test V2 nằm tại v2/schema.integration.test.mjs.

Hướng dẫn hiện hành: [V2](v2/README.md), [thiết kế](../../docs/requirements/PERSONAL_VAULT_V2.md), [database](../README.md). Backend/frontend vẫn cần chuyển API và giao diện sang mô hình mới.
