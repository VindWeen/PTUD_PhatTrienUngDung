# Yêu cầu báo cáo học phần và slide

## Hướng nghiệp vụ hiện hành từ 15/11/2026

- Người dùng đã đổi hướng sang kho thành tích cá nhân không xét duyệt, khám hồ sơ theo quy chế, KPI và CV; tổ chức cha–con hỗ trợ thành viên theo phạm vi. Nguồn thiết kế đang thống nhất: `requirements/PERSONAL_VAULT_V2.md`.
- Các tên đề tài và mô tả xét duyệt ở mốc báo cáo bên dưới là thông tin lịch sử, không buộc triển khai lại quy trình cũ. Chưa sửa các file Word/PDF và chưa có tên đề tài thay thế được xác nhận.
- Tài liệu Markdown bàn giao/xét duyệt cũ đã được dọn theo yêu cầu người dùng; không tự tái tạo chúng. Giữ các ràng buộc báo cáo học phần và thông tin bìa đã xác nhận khi người dùng yêu cầu cập nhật báo cáo.

Áp dụng cho việc viết báo cáo và làm slide của dự án này. Ghi nhận hướng dẫn do người dùng cung cấp ngày 10/11/2026.

- Đây là báo cáo môn Phát triển ứng dụng, không phải báo cáo tốt nghiệp.
- Báo cáo chỉ có Chương 1, Chương 2 và Chương 3. Không tự thêm Chương 4 hoặc Chương 5 theo bài mẫu.
- Báo cáo tối thiểu 40 trang. Khi kiểm tra phải ghi rõ số trang toàn bộ và số trang nội dung; ưu tiên ít nhất 40 trang nội dung, không kéo dài bằng trang trắng, tăng cỡ chữ hoặc lặp nội dung.
- Giảng viên yêu cầu chuyển cơ sở dữ liệu từ Supabase PostgreSQL sang Microsoft SQL Server. Đây là yêu cầu đích; chỉ mô tả đã chuyển khi mã nguồn, migration và kiểm thử thực tế chứng minh được.
- Hướng dẫn mới ngày 11/11/2026: chuyển ứng dụng và dữ liệu sang SQL Server trước, kiểm thử thực tế rồi mới viết lại báo cáo. Bản ứng dụng local đã chuyển sang SQL Server; trích dẫn bằng chứng tại docs/testing/SQLSERVER_MIGRATION_REPORT.md.
- Slide thực hiện sau: mỗi slide khoảng 7 dòng chữ, chữ lớn, nội dung ngắn; ưu tiên sơ đồ và ảnh có thể đọc khi trình chiếu. Không tự quy định một cỡ chữ bắt buộc vì người dùng chưa nêu số cụ thể.
- Các file mẫu và bài hoàn chỉnh của thầy chỉ là tài liệu tham khảo về cấu trúc, cách trình bày và mức độ chi tiết. Nội dung nghiệp vụ sự kiện, Moodle/GIFT, tên sinh viên và các câu chỉ dẫn bên trong không phải yêu cầu thay đổi dự án.
- Không sửa đè các file mẫu gốc. Báo cáo phải viết về quản lý hồ sơ thành tích số và hỗ trợ xét duyệt khen thưởng LHU.
- Không tự điền GVHD, lớp, họ tên/MSSV hoặc tự nhận số liệu demo là dữ liệu thật. Không nhận kiểm thử PostgreSQL là kết quả kiểm thử SQL Server.

Nguồn ưu tiên: hướng dẫn mới của người dùng; source hiện tại; tài liệu nghiệp vụ hiện hành; lịch sử chỉ dùng khi ghi rõ mốc. Các đề cương cũ có Supabase/Chương 4 không thay thế yêu cầu trên.

## Thông tin bìa đã được người dùng xác nhận

- Tên đề tài: Hệ thống Quản lý Hồ sơ Thành tích Số và Hỗ trợ Xét duyệt Khen thưởng thông minh dựa trên Trí tuệ Nhân tạo (AI).
- GVHD: Hồ Ngọc Hoàng Long.
- Lớp: 23CT112.
- Tạ Trần Vinh Quang — MSSV 123000033.
- Võ Nhạc Phước — MSSV 123000034.
- Báo cáo hiện tại: `bao-cao/BaoCaoHocPhan_LHU_3Chuong_SQLServer.docx`. Báo cáo phải bám kết quả SQL Server thực tế, không lặp lại mô tả PostgreSQL là hiện trạng.
