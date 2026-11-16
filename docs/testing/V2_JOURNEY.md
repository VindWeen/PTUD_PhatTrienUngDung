# Kiểm thử hành trình kho thành tích V2

Bài kiểm tra hiện hành dùng nguồn UEH 2025 tải nguyên gốc, upload/trích xuất/xác nhận nguồn qua HTTP và SQL Server thật. Mốc kiểm tra giao diện cũ ngày 15/11 được giữ ở cuối tài liệu như bằng chứng lịch sử. Kiểm chứng bằng HTTP thật qua Express và Microsoft SQL Server cục bộ. Không mock API, không seed dữ liệu lâu dài. Bài test: [v2-journey.integration.js](../../backend/tests/v2-journey.integration.js).

## Nguồn và phạm vi đối chiếu

Nguồn chính thức: [Quyết định 25/QĐ-ĐHKT-HSV ngày 14/03/2025, Hội Sinh viên UEH](https://youth.ueh.edu.vn/wp-content/uploads/2025/09/DE-AN-SV5T-UEH-NAM-2025-1.pdf), nhánh I.5.2, Phụ lục IV/V và mục IV về kỳ hồ sơ. URL 2022 trước đây không còn tải được khi kiểm tra nguồn; không dùng cache web thay cho file gốc.

Chỉ mô hình hóa nhánh hoàn thành ít nhất hai khóa kỹ năng thực hành xã hội. Các khóa cần đáp ứng điều kiện về đơn vị đào tạo, nội dung kỹ năng mềm, tương tác trực tiếp và kiểm tra mức độ tham gia. Kỳ thành tích áp dụng là 01/11/2024–01/11/2025. Đây là ví dụ lịch sử, không xác nhận quy định hiện hành tại LHU. Kết quả MET chỉ dành cho nhánh đã nhập, không kết luận đạt toàn bộ danh hiệu Sinh viên 5 tốt.

Các thuộc tính chuẩn hóa của fixture là dữ liệu tự khai để đối chiếu quy tắc. Hệ thống chưa xác thực tính thật của chứng nhận, chất lượng đơn vị đào tạo hay sự tham gia thực tế. Không nhập lại quy trình phê duyệt của tài liệu nguồn.

## Các bước và kết quả

| Bước | Kiểm chứng |
|---|---|
| Tạo tài khoản và công bố nhánh quy chế | Hai tài khoản độc lập; tài khoản nhập quy chế được cấp REGULATION_MANAGER trong transaction kiểm thử. File PDF gốc được upload, kiểm SHA256, trích xuất và xác nhận trước công bố; người ngoài không tải được. Nguồn và trạng thái PUBLISHED được lưu đúng. |
| Đăng thành tích và tải minh chứng | Một khóa đủ thuộc tính, file PDF fixture được upload/download qua HTTP. Người khác bị từ chối tải file (403). Khóa chuyên môn và khóa ngoài kỳ không được tính. |
| Khám lần đầu | NOT_MET, thực tế 1/2 khóa, còn thiếu 1, kết quả chưa stale. |
| Tạo KPI từ tiêu chí thiếu | Đúng chủ sở hữu, đúng source_result_id và mục tiêu bổ sung 1 khóa. Người khác không đọc KPI hoặc dùng kết quả để tạo KPI (404). Có việc cần làm và tiến độ ban đầu 0. |
| Bổ sung thành tích | Đăng khóa đủ điều kiện thứ hai và file minh chứng; liên kết khóa vào KPI, hoàn thành công việc, cập nhật tiến độ 1/1 và trạng thái hoàn thành. |
| Khám lại | Kết quả cũ vẫn NOT_MET và 1/2, được đánh dấu stale; không cho tạo KPI mới từ kết quả cũ (400). Lượt mới MET, thực tế 2/2, còn thiếu 0 và chỉ khớp hai khóa đủ điều kiện. |
| Tạo CV | Chỉ công khai hai thành tích đã chọn; không lộ email, điện thoại hoặc storage_key. Tắt công khai thì URL trả 404. |

KPI sinh từ khoảng thiếu dùng tiến độ MANUAL; liên kết thành tích là bằng chứng hỗ trợ, không tự đổi tiến độ. Test gọi API ghi nhận tiến độ hoàn thành riêng. Việc cập nhật KPI không sửa hồ sơ hay tự biến kết quả đánh giá cũ thành đạt; cần khám lại.

## Chạy lại

Tại thư mục gốc dự án, với SQL Server và cấu hình kết nối backend đã sẵn sàng:

```powershell
node --test --test-concurrency=1 backend/tests/v2-journey.integration.js
```

Kết quả bản kiểm tra cũ trước mở rộng: **7 test pass, 0 fail** (một test cha và sáu bước con). Kết quả phiên bản mới được ghi trong báo cáo nghiệm thu quy chế/seed. Lần chạy trong sandbox bị chặn kết nối SQL Server; chạy với quyền truy cập SQL Server cục bộ đã thành công.

Test tự mở HTTP server cổng ngẫu nhiên và chia sẻ một SQL transaction bên ngoài cho toàn bộ route. Kết thúc đóng server, release connection để rollback transaction và xóa các file minh chứng và file nguồn upload theo storage_key đã tạo. Không cần khởi động backend riêng; không chạy đồng thời với fixture khác giữ transaction trên cùng DB vì có thể chặn khóa.

Tất cả tên người, khóa học và chứng nhận trong fixture đều giả lập phục vụ kiểm thử. Minh chứng demo có cấu trúc PDF hợp lệ; file nguồn UEH là bản chính thức nguyên gốc có SHA256, được trích xuất thật qua API. Không nhận minh chứng giả lập là chứng nhận thật. Bài test này xác minh hợp đồng API và dữ liệu; nghiệm thu giao diện trên trình duyệt là bước riêng.

## Bằng chứng giao diện lịch sử ngày 15/11/2026 (fixture UEH 2022)

Đã chạy trình duyệt với frontend thật và API dùng một transaction rollback riêng. Thao tác trên giao diện đã kiểm tra: đối chiếu ngày 15/11/2022 cho kết quả 1/2, tạo KPI từ phần thiếu, thêm khóa học thứ hai cùng thuộc tính điều kiện, khám lại 2/2 đạt; cập nhật tiến độ KPI 1/1, hoàn thành công việc, đổi trạng thái và liên kết thành tích; lưu CV và kiểm tra trang công khai chỉ hiện thành tích đã chọn.

Đã mở các trang dashboard, hồ sơ, thành tích, khám hồ sơ, KPI, quy chế, tổ chức, CV, lịch, báo cáo, thông báo và quản trị trên desktop 1440px và điện thoại 375px. Các trang nhiều trường cũng được kiểm tràn ngang ở 768px và 1024px; menu mobile, chế độ tối, chi tiết KPI và tổ chức được kiểm riêng. Ảnh kiểm tra cục bộ nằm trong `output/v2-ui-*.png`. Kiểm tra thị giác không thay thế nghiệm thu toàn bộ chức năng quản trị hoặc mọi tổ hợp phân quyền.

Kết quả chốt: 31 kiểm thử SQL Server V2 và 15 kiểm thử backend độc lập đều qua; frontend lint, production build và 7 kiểm thử cache qua. Bài kiểm tra lịch HTTP bổ sung xác nhận thời gian `08:00+07:00` được lưu/đọc đúng dưới dạng `01:00Z`, bao gồm cập nhật và giờ nhắc.

Fixture giao diện đã rollback, không giữ tài khoản `browser-v2@example.test`, tổ chức `LHU-UI-TEST` hoặc quy chế `UEH-2022-UI-TEST`. Dữ liệu người dùng có sẵn không bị xóa; không suy ra DB phải rỗng sau phiên kiểm tra.
