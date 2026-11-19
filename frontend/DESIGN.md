# Giao diện kho thành tích

Giao diện làm việc ưu tiên thao tác và dữ liệu thật: nền xám xanh nhạt, chữ slate đậm, điều hướng navy và màu teal cho liên kết, nút chính và trạng thái tương tác. Kiểu chữ dùng Inter hiện có; không thêm hình minh họa trang trí mới.

Dashboard giữ cấu trúc đã có: banner màu ấm với ảnh sinh viên, tổng quan xanh nhạt, lối tắt, lịch và cột mục tiêu. Số liệu, lịch và KPI lấy từ API V2; hiển thị trạng thái rỗng hoặc lỗi khi không có dữ liệu.

Thông báo nằm trong dropdown của nút chuông trên topbar, có số chưa đọc, đọc từng mục/đọc tất cả và tải thêm. Không có trang thông báo hoặc mục menu riêng. Lịch được quản lý ngay tại trang chủ: hover/focus xem nhanh, chấm màu theo trạng thái và popup ngày cho phép thêm/sửa/xóa sự kiện. Sự kiện nhiều ngày được đánh dấu theo khoảng thời gian bắt đầu bao gồm, kết thúc loại trừ, theo múi giờ của người dùng. Đường dẫn lịch/thông báo cũ chuyển về trang chủ.

Các trang nghiệp vụ dùng tiêu đề, mô tả ngắn, liên kết tác vụ liên quan; biểu mẫu và danh sách được nhóm trong các vùng riêng. Kích thước vùng bấm tối thiểu 44px, nhãn trường luôn hiện, có focus nhìn thấy, hỗ trợ mobile và chế độ giảm chuyển động. Giao diện tối dùng bề mặt và đường phân cách riêng.

Điều hướng chính thống nhất: Trang chủ, Hồ sơ & CV, Kho thành tích, Khám hồ sơ, Mục tiêu / KPI, Kho quy chế, Tổ chức. Tìm kiếm toàn hệ thống đặt trên topbar; Thống kê & Báo cáo có route `/reports` và được tìm qua tìm kiếm toàn hệ thống.

Trang chủ dùng bốn lối tắt và hàng dưới chia lịch/mục tiêu khoảng 65/35 trên desktop. Các trang nghiệp vụ ưu tiên danh sách toàn chiều rộng; thêm/sửa thành tích, tạo mục tiêu, chi tiết mục tiêu và tạo tổ chức dùng dialog gốc của trình duyệt. Hồ sơ chia tab thông tin, CV và bảo mật. Danh sách thành tích có bảng, bộ lọc và tab thùng rác; quy chế dùng thẻ phiên bản và bộ lọc; báo cáo tổng hợp toàn bộ thành tích theo năm/loại. Màu hành động chính là #0F766E. Xem [chín module trang](../TECHNICAL_DEEP_DIVE.md#31-module-trang-và-component-đi-kèm) và [UI dùng chung](src/components/common).

Giới hạn hợp đồng API hiện tại: tham gia tổ chức qua lời mời email hoặc gửi đơn gia nhập để người có quyền xử lý. Quy chế lọc theo nguồn ban hành hiện có, chưa có trường cấp ban hành riêng.
