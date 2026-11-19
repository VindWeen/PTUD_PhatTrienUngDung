# Kiểm thử giao diện quy chế V2

Ngày 16/11/2026, kiểm thử bằng Edge headless, Vite `localhost:5188`, backend riêng `localhost:5018`, SQL Server `PTUD_LHU`. Đây là kiểm thử tương tác với dữ liệu demo thực, không dùng API giả lập. Dữ liệu kiểm thử được ghi vào database và giữ lại để đối chiếu.

## Các luồng đã thực hiện

- `school-manager`: tạo quy chế cá nhân `UI-CHECK-20261116`, bản `UI v1` (version #154), tải DOCX demo, trích xuất, thêm tiêu chí `UI01`, xác nhận kiểm tra nguồn, công bố. Giao diện hiển thị `Đã công bố`, `UI v1 · Đã công bố`, nguồn `EXTRACTED` và tiêu chí. Nguồn thử là một DOCX demo đã có trong kho private; kết quả không chứng minh AI đề xuất.
- `school-manager`: mở `faculty_a` v1 với nội bộ bật và công khai tắt. Mục tiếp nhận chỉ liệt kê tổ chức sở hữu `[DEMO] faculty-a`; chọn tổ chức và gửi thành công (POST 201, thông báo `Đã áp dụng phiên bản cho đơn vị.`). Thao tác ghi lại pin cùng phiên bản đang chọn.
- Tạo `UI-SYNTHETIC-SHARE-20261116` của `[DEMO] school`, bản `demo v1` (#180), `source_kind=DEMO`, không có file nguồn; tiêu chí và nguồn đều tự đặt cho kiểm thử. Gửi tới `[DEMO] union`; `union-manager` thấy `Đang chờ`, nhấn `Chấp nhận`, sau đó thấy `Đã chấp nhận` và thông báo thành công.
- `school-manager` thêm phiên bản công khai `public` v2 (#98) vào kho cá nhân (POST 201); `union-manager` áp dụng cùng phiên bản cho `[DEMO] union` và thấy thông báo thành công. Trong tab `Tôi quản lý`, union không thấy quy chế cá nhân `UI-CHECK-20261116` của school-manager. Kiểm tra này chỉ xác nhận giao diện danh sách, không thay thế kiểm thử API từ chối truy cập theo ID.

Ảnh quan sát: [desktop nội bộ](../../output/playwright/regulation-own-desktop.png) và [mobile 390×844 chế độ tối](../../output/playwright/regulation-private-mobile-dark.png). Ảnh chụp toàn trang; đã quan sát bố cục, nhãn, nội dung nguồn, tiêu chí và các điều khiển. Ở trạng thái cộng đồng sau khi bố cục ổn định, chiều rộng viewport và `scrollWidth` đều 390 px. Không suy ra toàn bộ khả năng tiếp cận từ ảnh.

## Kiểm tra mã và giới hạn

Các ảnh và lỗi sandbox ở đây thuộc lần kiểm UI ngày 16/11. Tại `91e9968`, frontend lint, build và 18/18 test đạt sau tái cấu trúc. Mốc này chưa có lần nghiệm thu trình duyệt mới.

- `npm run build` trong `frontend` đạt; `npm test` đạt 11/11; `npm run lint` đạt sau sửa dependency hook. Các lệnh này cần chạy ngoài sandbox trên máy này vì Vite gặp `EPERM` khi gọi `realpath` trong sandbox.
- Sau tối ưu đọc của backend, log `GET /regulations/documents?pageSize=100` có lần 655 ms và các lần khác khoảng 1,6–7,8 giây dưới tải khác nhau; trước đó có lần 5,5–12,9 giây và một lần 44,9 giây. Đây là quan sát thô, không phải benchmark kiểm soát.
- Giao diện khóa điều khiển trong lúc action và tải lại đang chạy. Đã trì hoãn yêu cầu thêm công khai v2 vào kho cá nhân ba giây bằng Playwright: nút bị vô hiệu và có `Đang xử lý…`, sau đó thấy thông báo thành công. Các endpoint vẫn là nơi thực thi quyền chính xác. Với người quản lý không phải thành viên, danh sách cá nhân không đủ để biết tổ chức đã có pin hay chưa, nên danh sách tổ chức hiển thị nếu có quyền tiếp nhận hoặc cập nhật, còn backend kiểm tra quyền tương ứng khi gửi.
- Chưa kiểm thử bằng trình duyệt các nhánh từ chối/thu hồi, PDF scan, đề xuất AI hoặc toàn bộ tổ hợp quyền. Lỗi 404 nguồn của bản nháp chưa có file xuất hiện trong console và được giao diện xử lý như trạng thái chưa có nguồn.
