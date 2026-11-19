# SQL Server V2 — kho thành tích cá nhân

Schema đích theo [thiết kế V2](../../docs/requirements/PERSONAL_VAULT_V2.md). Đây là chuỗi migration mới cho database sạch, không phải script chuyển dữ liệu từ phiên bản xét duyệt.

Đã áp dụng trên PTUD_LHU ngày 15/11/2026: 33 bảng nghiệp vụ, 71 FK, 80 CHECK và 11 trigger. Cả 7 test runner và 13 test ràng buộc SQL Server đều qua. Chạy lại migrate trả appliedCount=0; Lúc tạo baseline, verify --expect-empty xác nhận các bảng nghiệp vụ rỗng; trạng thái hiện tại cần kiểm tra trực tiếp. Bảng kỹ thuật _schema_migrations giữ 2 bản ghi lịch sử.

## Áp dụng

Từ thư mục backend:

```powershell
npm run migrate
npm run migrate:status
npm run test:db:runner
npm run test:db
node ../database/sqlserver/verify.mjs --expect-empty
```

Runner chỉ đọc `database/sqlserver/migrations/`, kiểm checksum và dùng transaction cùng application lock. Database chưa có lịch sử V2 mà đã có bảng sẽ bị từ chối.

Baseline khởi tạo schema trống. Dữ liệu nghiệp vụ được nhập qua ứng dụng.

## Quy ước

- Schema `app`, khóa BIGINT, văn bản Unicode, thời gian UTC và ràng buộc JSON hợp lệ.
- Cá nhân sở hữu thành tích trực tiếp; không bắt buộc có tổ chức và không có trạng thái duyệt thành tích.
- Thành viên, quyền tại tổ chức và quyền toàn hệ thống là các quan hệ riêng. Cây tổ chức có nhiều tầng, gồm cả lớp.
- Lời mời/liên kết tổ chức có trạng thái phản hồi. Tách thành viên hoặc tổ chức giữ nguyên dữ liệu cá nhân.
- Kết quả khám lưu phiên bản quy chế và dữ liệu đầu vào; KPI liên kết đúng kết quả nguồn. CV chọn thành tích cùng chủ sở hữu và kiểm soát thông tin công khai.
- Không dùng cascading delete để xóa lịch sử. Kết thúc quan hệ bằng thời hạn/thu hồi; thành tích có thùng rác.

## Giới hạn của schema

Foreign key và trigger bảo vệ quan hệ dữ liệu; chúng không thay thế kiểm quyền API. Các thao tác gửi/đồng ý lời mời, kiểm người có quyền tại cha/con, áp dụng thay đổi cơ cấu và cấp quyền ban đầu cần service thực hiện trong transaction, kiểm lại quyền khi phản hồi.

Backend runtime và frontend đã chuyển sang V2. Các bộ kiểm thử tích hợp identity, intelligence và API dùng dữ liệu tạm rollback. Không xem kết nối DB hoặc migrate thành công là nghiệm thu toàn bộ ứng dụng.

Không sửa file migration sau khi đã áp dụng. Thay đổi tiếp theo thêm file có số thứ tự mới. Quy chế và danh mục cần tạo hoặc import riêng; mẫu hiển thị CV có sẵn trong ứng dụng, tài khoản quản trị đầu tiên thiết lập bằng công cụ được gọi thủ công.


## Mở rộng quy chế ngày 15/11/2026

Migration 003–005 bổ sung sở hữu cá nhân/tổ chức, chia sẻ, ghim phiên bản, nguồn PDF/DOCX và phương thức trích xuất AUTO/MANUAL. Các checksum đã áp dụng giữ nguyên. Dùng `verify.mjs` để đọc số bảng/ràng buộc hiện tại; số liệu 33 bảng/2 migration ở phần baseline là mốc lịch sử. Xem [quyết định chính sách](../../docs/testing/V2_REGULATION_DECISIONS.md) và [danh mục nguồn](sources/source-register.json).
