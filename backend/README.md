# Backend V2

Express REST mặc định tại `/api/v1`, kết nối SQL Server. `src/app.js` gắn identity, vault, intelligence và support từ `src/v2/`, cùng health routes. Các module nghiệp vụ cũ còn trên đĩa nhưng không được gắn vào runtime.

## Thiết lập

Cấu hình `.env` từ `.env.example`, chạy `npm ci`, `npm run migrate:status` và `npm run migrate`, rồi `npm start`. Schema và runner được mô tả ở [SQL Server V2](../database/sqlserver/v2/README.md). Không có seed/import tự động; `npm run seed` chặn dữ liệu legacy. Seed mới: `npm run seed:v2 -- --database=PTUD_LHU --apply`; luôn chỉ định database, xem [hướng dẫn seed V2](../docs/testing/V2_DEMO_SEED.md).

Tài khoản đầu tiên có thể đăng ký qua ứng dụng. Để thiết lập quản trị viên đầu tiên, người vận hành đặt biến môi trường `PTUD_ADMIN_EMAIL`, `PTUD_ADMIN_NAME`, `PTUD_ADMIN_PASSWORD` rồi, từ thư mục `backend/`, chạy `node ../scripts/provision-admin.mjs --apply`. Script chỉ chạy khi gọi rõ ràng, không đổi mật khẩu tài khoản đã tồn tại và không tạo dữ liệu mẫu. Không lưu mật khẩu trong mã nguồn.

Khôi phục mật khẩu qua email cần `APP_PUBLIC_URL`, `RESET_EMAIL_API_KEY` và `RESET_EMAIL_FROM`; nếu chưa cấu hình, API trả lỗi dịch vụ chưa sẵn sàng. OCR phụ thuộc cấu hình dịch vụ AI và có thông báo khi không trích xuất được.

## Kiểm tra

- `npm test`: kiểm thử độc lập cho runner, đánh giá và quyền.
- `npm run test:sqlserver`: schema và tích hợp V2 trên SQL Server, sử dụng dữ liệu tạm rollback.
- `npm run test:db:v2` hoặc `npm run test:api`: chạy riêng kiểm tra schema hoặc API.

Lần kiểm tra chuyển V2 ghi nhận 15 kiểm tra độc lập, 13 kiểm tra ràng buộc schema và các bộ identity/intelligence/API tích hợp. Xem [chỉ mục API](../docs/api/V2.md). Kết quả kiểm thử không thay thế rà soát quy chế thực tế hoặc nghiệm thu toàn bộ tình huống.

Đã bỏ module duyệt thành tích/khen thưởng và 15 test/script chuyên biệt của quy trình cũ, cùng endpoint kiểm thử duyệt trong auth legacy. File legacy trộn chức năng còn cần cho V2 được giữ để đối chiếu; không sử dụng chúng làm hợp đồng runtime V2. Danh sách xóa hẹp và checksum nằm ở `../output/approval-only-cleanup.json`.

Quy chế V2 có sở hữu và phân phối theo cây tổ chức, pin phiên bản, nguồn riêng tư và bước kiểm tra trước công bố. Chạy thêm `npm run test:backup` để kiểm tra archive hai kho tệp. PDF/DOCX trích xuất cục bộ; AI đề xuất cần provider cấu hình hợp lệ và luôn qua người kiểm tra. Phương thức nhập bản chép thủ công dành cho PDF scan không có lớp văn bản.
