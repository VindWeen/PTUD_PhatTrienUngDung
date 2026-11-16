# Triển khai SQL Server

Hướng dẫn hiện hành: [cài đặt](GETTING_STARTED.md), [schema](../../database/sqlserver/README.md), [backup và phục hồi](RUNBOOK_DEMO_BACKUP_RESTORE.md).

Backend cần Node, cấu hình DB_HOST/PORT/NAME/USER/PASSWORD và SQL Server truy cập được từ máy chạy backend. Không đặt DB credentials vào frontend. Chạy migration trước khi khởi động bản mới; không seed DB đã có dữ liệu. Kho tệp private cần ổ đĩa bền vững, đường dẫn tuyệt đối và sao lưu cùng DB.

Frontend build tĩnh cần reverse proxy /api/v1 hoặc VITE_API_URL được cấu hình trước build; CORS_ORIGIN phải khớp tên miền frontend. Cấu hình HTTPS/cookie theo môi trường. AI pool và email reset giữ cơ chế riêng như phiên bản trước.

Máy hiện tại dùng SQL Server2022 local; đây chưa phải bằng chứng đã triển khai SQL Server lên dịch vụ hosting bên ngoài. Các hướng dẫn PostgreSQL cũ đã được dọn. Hướng thiết kế mới nằm ở [V2](../requirements/PERSONAL_VAULT_V2.md), chưa được triển khai đầy đủ trong schema hiện tại.
