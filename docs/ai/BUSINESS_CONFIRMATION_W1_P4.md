# Ghi chú xác nhận nghiệp vụ W1-P4

## Phần đang bị chặn

Chưa có bản gốc **quy chế thi đua, khen thưởng áp dụng cho cán bộ/giảng viên/nhân viên LHU**, quyết định ban hành, phụ lục tiêu chí và lịch sử sửa đổi. Các nguồn công khai của LHU chỉ cho thấy trường có quy định KHCN và có công khai bình chọn trên hệ thống nội bộ Me; chúng không đủ để lập rule xét thưởng.

Không sử dụng quy chế sinh viên LHU cho giảng viên. Điều 1 của tài liệu đó xác định rõ đối tượng là sinh viên.

## Câu hỏi gửi GVHD/đầu mối LHU

1. Xin cung cấp bản gốc và số quyết định của quy chế thi đua, khen thưởng hiện hành cho cán bộ, giảng viên, nhân viên; toàn bộ phụ lục tiêu chí, biểu mẫu, văn bản sửa đổi và ngày bắt đầu áp dụng.
2. Quy chế nào áp dụng riêng cho giảng viên cơ hữu, thỉnh giảng, cán bộ quản lý và tập thể Khoa/Bộ môn? Một người kiêm nhiều vai trò được xét theo tập nào?
3. Năm xét thưởng là năm dương lịch hay năm học; thời điểm khóa số liệu, thời hạn bổ sung minh chứng và nguyên tắc xử lý thành tích phát sinh quanh 01/10/2026 là gì?
4. Cơ quan/cấp nào tiếp nhận, thẩm định, xác nhận, từ chối, thu hồi và quyết định từng danh hiệu? Vai trò đại diện đơn vị có được tự nộp hồ sơ tập thể không?
5. Danh mục tiêu chí bắt buộc/tùy chọn, đơn vị tính, ngưỡng, giới hạn cộng dồn và quy tắc chống tính trùng cho giảng dạy, NCKH và phục vụ cộng đồng là gì?
6. Minh chứng hợp lệ cho từng tiêu chí là gì; nguồn dữ liệu nào được coi là nguồn gốc và ai có quyền xác nhận?
7. Quy định hoạt động KHCN và hỗ trợ/khen thưởng công bố trên website LHU hiện còn hiệu lực không? Nếu có, xin số quyết định, phiên bản và quan hệ với quy chế thi đua chung.
8. Hồ sơ đã nộp trước khi văn bản mới có hiệu lực được giữ rule cũ hay chuyển rule mới; trường hợp nào áp dụng quy định có lợi hơn?
9. Phạm vi đọc hồ sơ cá nhân/tập thể của `UNIT_REPRESENTATIVE`, `MANAGER`, `RECORDS_OFFICER`, `ADMIN` cụ thể đến đâu; có cho xem đơn vị con và hồ sơ lịch sử sau chuyển đơn vị không?
10. Dữ liệu nào được phép đưa vào mô hình/gợi ý AI; thời gian lưu, ẩn danh, quyền phản hồi và người chịu trách nhiệm duyệt kết quả gợi ý là ai?

## 4 mục tiêu demo

Tất cả mục dưới đây là **MÔ PHỎNG – KHÔNG PHẢI TIÊU CHÍ XÉT THƯỞNG** và không được dùng để tự chấm điểm hoặc trao thưởng:

| DemoId | Mục tiêu mô phỏng | Mục đích UI |
|---|---|---|
| `SIM-KPI-01` | Chuẩn bị 02 bản ghi giáo trình có minh chứng trước hạn demo | Trình diễn tiến độ, bằng chứng và ngày đích |
| `SIM-KPI-02` | Ghi nhận hoạt động hướng dẫn 03 học viên/nghiên cứu sinh | Trình diễn dữ liệu hồ sơ và chống tính trùng |
| `SIM-KPI-03` | Hoàn thiện 01 hồ sơ thành tích nghiên cứu để gửi thẩm định | Trình diễn trạng thái và luồng bổ sung minh chứng |
| `SIM-KPI-04` | Rà soát 100% trường bắt buộc của hồ sơ hội đồng demo | Trình diễn kiểm tra độ đầy đủ, không dự đoán khả năng được thưởng |

## Điều kiện gỡ chặn tích hợp thật

- GVHD/đầu mối LHU xác nhận bằng văn bản các câu 1–10 hoặc đánh dấu câu không áp dụng.
- Mỗi tiêu chí được nối với một dòng `SourceId` trong `06_Nguon.csv` và phiên bản tài liệu cụ thể.
- Test có cả cá nhân, tập thể, chuyển đơn vị, hồ sơ trước/sau mốc chuyển tiếp và trường hợp người dùng ngoài scope.
