# W1-P1 — Tích hợp frontend

Frontend chỉ truy cập dữ liệu qua Express REST `/api/v1`; không gọi Supabase trực tiếp. Express kết nối Supabase PostgreSQL bằng `pg`, đồng thời tiếp tục quản lý auth và file private.

## Chọn nguồn dữ liệu

- `VITE_DATA_SOURCE=api` (mặc định): gọi API thật. Lỗi API được hiển thị; tuyệt đối không tự chuyển sang dữ liệu demo.
- `VITE_DATA_SOURCE=fixture`: dùng payload đã chốt trong `docs/api/fixtures/` để phát triển khi endpoint chưa hoàn tất. Giao diện luôn gắn nhãn `FIXTURE`.
- `VITE_API_URL=/api/v1`: dùng proxy Vite tới backend cổng 5000 trong môi trường phát triển.

Khởi động fixture: `npm run dev -- --mode fixture`; cấu hình không chứa bí mật nằm trong `frontend/.env.fixture`. Không lưu key hoặc thông tin Supabase vào frontend.

## Ranh giới auth

Access token chỉ giữ trong bộ nhớ. Refresh token do Express cấp bằng HttpOnly cookie. Khi refresh thất bại, frontend xóa phiên và trở về đăng nhập; không khôi phục user demo.

Các route chuẩn hiện tại: `/login`, `/me/dashboard`, `/me/profile`, `/me/ai-forecast`. Route không tồn tại hiển thị trang 404. Menu và route cùng kiểm tra role từ phản hồi auth; backend vẫn là nơi quyết định quyền và trạng thái cuối cùng.

Dashboard đọc thống kê từ endpoint OpenAPI `GET /me/profile`; không tự đặt thêm endpoint ngoài hợp đồng. Khi backend chưa triển khai endpoint này, chế độ API hiển thị lỗi rõ và chế độ fixture vẫn hoạt động theo đúng payload đã chốt.
