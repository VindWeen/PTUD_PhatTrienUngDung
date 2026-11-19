# Lịch cá nhân

Mở lịch từ Dashboard. Chọn ngày để xem sự kiện, thêm lịch mới hoặc sửa/xóa lịch hiện có. Các URL giao diện `/me/calendar` và `/calendar` chuyển về Dashboard.

Giao diện hiển thị theo múi giờ của người dùng. Backend nhận datetime ISO 8601 có offset và lưu UTC. Sự kiện nhiều ngày được hiển thị theo khoảng có đầu mút bắt đầu và loại thời điểm kết thúc. `remindAt` là mốc nhắc được lưu cùng sự kiện. Runtime hiện chưa có tiến trình phát thông báo nhắc lịch.

## API

Các đường dẫn dưới đây dùng tiền tố mặc định `/api/v1`, yêu cầu bearer token và trả envelope `{ success, data }`.

| Method | Endpoint | Hành vi |
| --- | --- | --- |
| GET | `/me/calendar/events` | Liệt kê sự kiện của tài khoản hiện tại |
| POST | `/me/calendar/events` | Tạo sự kiện, trả HTTP 201 |
| PATCH | `/me/calendar/events/:id` | Cập nhật các trường được gửi |
| DELETE | `/me/calendar/events/:id` | Xóa sự kiện |

Khi tạo, gửi `title` (1–300 ký tự), `startsAt` và `endsAt`. `endsAt` phải sau `startsAt`. Có thể gửi `description` (tối đa 20.000 ký tự), `remindAt` (không muộn hơn thời điểm bắt đầu), `status` (`SCHEDULED`, `COMPLETED`, `CANCELLED`) và `goalId` (KPI chưa xóa của chính tài khoản). Dashboard không gửi `goalId`. Backend lấy chủ sở hữu từ phiên đăng nhập. Truy cập sự kiện ngoài phạm vi trả 404. Dữ liệu sai trả 400.

## Kiểm tra

Áp dụng migration SQL Server bằng `npm --prefix backend run migrate`. Chạy `npm --prefix frontend test` để kiểm hàm xử lý ngày, và `npm --prefix backend run test:api` để kiểm CRUD lịch qua HTTP và SQL Server với fixture rollback.

Nguồn [DashboardCalendar.jsx](../frontend/src/components/calendar/DashboardCalendar.jsx) và [supportRoutes.js](../backend/src/modules/supportRoutes.js).
