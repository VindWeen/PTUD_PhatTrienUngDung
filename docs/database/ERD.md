# ERD theo hướng mới

[Thiết kế V2, mục 5](../requirements/PERSONAL_VAULT_V2.md#5-erd-tổng-quát) chứa ERD logic và use case. Schema vật lý đã tạo trên SQL Server tại [migration V2](../../database/sqlserver/migrations/001_v2_schema.sql); [migration integrity](../../database/sqlserver/migrations/002_v2_integrity.sql) bổ sung trigger.

Có 33 bảng nghiệp vụ; không có bảng giảng viên riêng, hồ sơ đề nghị, Hội đồng hoặc duyệt thành tích. Lời mời, phân quyền tổ chức, liên kết cơ cấu và lịch sử là các quan hệ riêng.

Các quan hệ sở hữu CV/KPI/minh chứng và quan hệ phiên bản của kết quả khám được kiểm bằng composite foreign key. Chu trình tổ chức, chồng thời gian thành viên và bất biến lịch sử được kiểm bằng trigger. Phân quyền theo người thao tác/phạm vi hậu duệ phải được thực thi thêm tại API.

Xem [từ điển dữ liệu](DATA_DICTIONARY.md) và [cách kiểm chứng](../../database/sqlserver/README.md).
