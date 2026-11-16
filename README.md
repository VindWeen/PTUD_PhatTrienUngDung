# Kho thành tích cá nhân

Dự án lưu thành tích và minh chứng cá nhân, đối chiếu hồ sơ với quy chế, theo dõi mục tiêu và tạo CV công khai. Tổ chức nhiều cấp hỗ trợ thành viên theo quyền được giao. Xem [use case và ERD V2](docs/requirements/PERSONAL_VAULT_V2.md).

Runtime backend gắn các route V2 trong `backend/src/v2/`; frontend sử dụng các API V2. Cá nhân không cần thuộc tổ chức để sử dụng kho. Kết quả khám đối chiếu dữ liệu đã khai, không phải quyết định công nhận danh hiệu.

## Chạy local

1. Trong `backend/`, chạy `npm ci` và cấu hình `.env` từ `.env.example`, trỏ tới SQL Server.
2. Chạy `npm run migrate:status` rồi `npm run migrate` để áp dụng migration V2 còn thiếu.
3. Chạy `npm start` trong `backend/`; chạy `npm ci` và `npm run dev` trong `frontend/`.
4. Kiểm tra `http://localhost:5000/api/v1/health/readiness`, sau đó mở `http://localhost:5173`.

Không tự động seed hay import dữ liệu. Người dùng có thể đăng ký tài khoản; để thiết lập quản trị viên đầu tiên, xem [hướng dẫn backend](backend/README.md). Quy chế và danh mục cần được tạo hoặc nhập bằng dữ liệu thực tế.

## Kiểm tra và giới hạn

- Trong `backend/`, `npm test` kiểm tra độc lập; `npm run test:sqlserver` chạy kiểm tra schema, danh tính, đánh giá và API V2 trên SQL Server với dữ liệu kiểm thử rollback.
- Trong `frontend/`, chạy `npm run lint`, `npm test` và `npm run build`.
- Lần kiểm tra chuyển V2 ghi nhận 15 kiểm tra backend độc lập, 13 ràng buộc schema và 7 kiểm tra frontend; các bộ tích hợp identity/intelligence/API cũng chạy với dữ liệu tạm rollback. Đây không phải xác nhận mọi trường hợp nghiệp vụ đã hoàn tất.
- OCR cần cấu hình dịch vụ; khôi phục mật khẩu qua email cần cấu hình gửi thư. Quy chế cần được xây dựng và xác minh trước khi kết quả khám có ý nghĩa.

Đã gỡ module duyệt thành tích/khen thưởng cùng 15 test và script chuyên biệt cho quy trình nộp, thẩm định, hội đồng và quyết định khen thưởng. Các endpoint kiểm thử duyệt trong auth legacy cũng đã bỏ. Phần legacy có chức năng còn liên quan như KPI, CV, lịch, minh chứng và các file trộn nhiều chức năng được giữ để đối chiếu V2; chúng không được gắn vào runtime. Không chạy seed hoặc migration cũ lên DB V2.

Xem [database](database/README.md), [chỉ mục API](docs/api/V2.md) và [mục lục tài liệu](docs/README.md).
