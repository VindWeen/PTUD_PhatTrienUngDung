# Lịch cá nhân

Mở bằng icon lịch cạnh tài khoản trên mọi trang hoặc chọn ngày / “Mở lịch đầy đủ” ở trang chủ. Không thêm mục vào sidebar.

- Popup có lịch tháng, chọn tháng/năm, Hôm nay, bộ lọc, danh sách trong ngày và các lịch sắp tới.
- Thêm, sửa, xóa lịch thi/cuộc thi/công việc/cá nhân; có thời gian, cả ngày hoặc nhiều ngày, địa điểm/link, ghi chú, trạng thái hoàn thành. Công việc quá hạn được đánh dấu.
- Nút ×, Esc, bấm nền ngoài đóng popup. Nội dung chưa lưu cần xác nhận bỏ. Trong lúc ghi API, popup không thể đóng.
- Lưu PostgreSQL theo tài khoản đang xác thực; API không chấp nhận userId từ client. Mọi thao tác đọc/ghi ràng buộc user_id; cập nhật/xóa kiểm tra version chống ghi đè giữa các phiên.
- Ngày giờ dùng giờ Việt Nam (UTC+7). Lịch cả ngày tính cả ngày bắt đầu và kết thúc.
- Hai sự kiện chung là minh họa lặp theo tháng đang xem, chỉ đọc, không phải lịch hội đồng thực tế. Chưa có nhắc lịch hoặc đồng bộ lịch ngoài. Chế độ fixture chỉ xem sự kiện minh họa, không lưu lịch cá nhân.

## Khởi chạy và kiểm tra

Trong `backend`, chạy `npm run migrate` trước khi chạy ứng dụng. Migration mới: `20261015000026_personal_calendar.sql`.

- `npm run test:calendar`: kiểm tra ngày không hợp lệ, lịch nhiều ngày, năm nhuận, chuyển tháng/năm.
- `npm run test:calendar:integration`: HTTP + PostgreSQL thật, cần hai tài khoản ACTIVE và migration đã áp dụng. Dữ liệu thử nằm trong transaction được rollback; không seed lại DB.
- Trong `frontend`: `npm run build`.

## API

Tất cả endpoint yêu cầu Bearer token và trả envelope `{ success, data }`.

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/v1/me/calendar` | Danh sách lịch riêng của tài khoản |
| POST | `/api/v1/me/calendar` | Tạo lịch (201) |
| PUT | `/api/v1/me/calendar/:id` | Thay nội dung lịch, yêu cầu version hiện tại |
| DELETE | `/api/v1/me/calendar/:id` | Xóa lịch, body `{ version }` |

POST/PUT dùng `title` (1–160), `description` (tối đa 4000), `location` (tối đa 500), `category` (`exam`, `competition`, `task`, `personal`), `startsAt`, `endsAt` (`YYYY-MM-DDTHH:mm`, năm 1900–2199), `allDay`, `completed`. PUT thêm `version`. Lịch cả ngày dùng `00:00`. Lịch ngoài tài khoản trả 404; phiên bản cũ trả 409; dữ liệu sai trả 400.
