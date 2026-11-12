# Backend

Backend Express REST `/api/v1` đã triển khai, kết nối Supabase PostgreSQL qua `pg`; Express quản lý JWT/refresh cookie và phân quyền theo vai trò/phạm vi.

Xem [README gốc](../README.md) để cài/chạy và [bản đồ tài liệu](../docs/README.md) để tra hướng dẫn.

- `src/app.js`: đăng ký API/middleware; `src/server.js`: khởi động.
- `src/modules/`: nghiệp vụ; `src/middlewares/`: xác thực/quyền/xử lý lỗi.
- `src/config/`: cấu hình; bắt đầu bằng `.env.example`.
- `tests/`: test theo chức năng/task; lệnh trong `package.json`.

Chạy từ `backend/`: `npm ci`, cấu hình `.env`, `npm run migrate`, `npm start`. Seed chỉ dùng DB demo phù hợp vì có xóa dữ liệu. Đọc điều kiện DB/provider trong runner trước khi chạy test tích hợp.

## Cập nhật ngày 04/11/2026

- Repo hiện có 31 migration; dùng `npm run migrate:status` kiểm DB đang cấu hình. Không seed lại DB dùng chung chỉ để cập nhật code. Migration không tự đồng bộ các chỉnh sửa schema thủ công ngoài script.
- Hàng đợi hồ sơ Hội đồng đã đề nghị trả thêm `achievement_sources`: tên, mô tả và năm thành tích từ snapshot bản nộp đã xét. UI chuyên viên dùng dữ liệu này để đối chiếu trước khi chuẩn bị thưởng; không thay đổi nguồn hoặc loại thưởng đã chốt.
- Đợt cải thiện 16 điểm UI không thêm migration. Khởi động lại backend để nhận thay đổi payload; xem [báo cáo kiểm tra](../docs/testing/UI_VISUAL_AUDIT.md) về phạm vi xác minh.
