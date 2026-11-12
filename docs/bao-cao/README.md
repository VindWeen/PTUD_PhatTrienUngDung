# Báo cáo học phần ba chương

## Bản nộp đã bỏ hướng dẫn nội bộ

- [Bản Word để nộp](BaoCaoHocPhan_LHU_BanNop_20261112.docx): đã bỏ kịch bản tập demo, hai nguồn tham khảo nội bộ và chỉnh cách diễn đạt ghi chú; giữ bản trước để đối chiếu.

## Bản cập nhật theo project ngày 12/11/2026

- [Bản Word mới](BaoCaoHocPhan_LHU_HienTrang_20261112.docx): **64 trang toàn bộ, 55 trang nội dung ba chương**, 9 hình minh họa; giữ nguyên các bản trước để đối chiếu.
- Cập nhật metadata SQL Server demo: 54 bảng nghiệp vụ, 4 migration; bổ sung vòng đời thùng rác thành tích và mô tả đăng ký/khôi phục mật khẩu theo code.
- Bổ sung bộ demo 40 tài khoản, 18 đơn vị, 238 thành tích, 134 KPI, 69 đề nghị, 44 bản ghi thưởng và 8 CV. Dữ liệu nghiệp vụ, tiêu chí và cơ cấu bổ sung ghi rõ tính giả lập.
- Thể hiện riêng phép đối chiếu quy tắc và ba giải thích AI thật đã kiểm tra trên browser; thêm ảnh kết quả và CV. Không nhận tính năng AI tự viết CV hoặc độ chính xác LLM chưa đo.
- Tách biên bản chuyển đổi ngày 11/11 khỏi 40 điều kiện kiểm tra ngày 12/11 và hai lượt restore thành công cả DB lẫn tệp của bộ demo.
- Giữ đúng ba chương, bìa và thông tin đã chốt; mục lục cập nhật bằng Word. Nguồn dựng và kiểm tra bố cục ở `tmp/report-20261112`.

## Bản cập nhật theo mã nguồn hiện tại ngày 11/11/2026

- [Bản Word cập nhật](BaoCaoHocPhan_LHU_CodeHienTai_20261111.docx): 55 trang toàn bộ, 47 trang nội dung ba chương.
- Đã đối chiếu lại luồng quản lý, phân công Hội đồng, kết quả theo quyết định, KPI nhập tay, đối chiếu quy tắc và gợi ý kế hoạch AI. Phân biệt chức năng hiện có với hướng phát triển.
- Bổ sung thiết kế giao diện theo vai trò và công cụ nhập KPI; giữ thông tin bìa đã xác nhận, cấu trúc ba chương, đặc tả và mô hình dữ liệu SQL Server.
- Mục lục được cập nhật bằng Microsoft Word. Bằng chứng kiểm thử SQL Server ghi theo biên bản có ngày kiểm chứng, không nhận là toàn bộ bộ tích hợp được chạy lại trong lần biên soạn này.
- Nguồn cập nhật và dữ liệu kiểm tra bố cục ở `tmp/report-current/`. Bản cũ bên dưới được giữ nguyên để đối chiếu.

## Bản trước khi cập nhật giao diện và nghiệp vụ

Bản Word kiểm tra cuối có 50 trang vật lý, trong đó 42 trang nội dung ba chương; không có trang trắng hoặc chữ tràn lề.

- [Bản Word hoàn chỉnh](BaoCaoHocPhan_LHU_3Chuong_SQLServer.docx), cập nhật ngày 11/11/2026 theo ứng dụng đã chuyển sang SQL Server local.
- Đã điền đề tài, GVHD Hồ Ngọc Hoàng Long, lớp 23CT112 và hai thành viên theo xác nhận.
- Chỉ có Chương 1–3; nội dung gồm đặc tả 10 ca sử dụng, 6 hình, từ điển dữ liệu và kết quả kiểm chứng SQL Server thực tế. Không thêm chương 4–5.
- A4, Times New Roman 13, giãn dòng 1,5; mục lục cập nhật bằng Microsoft Word. PDF và ảnh rà soát chỉ là tài liệu QA trong tmp/report-rewrite.
- Dữ liệu chuyển đổi đã đối chiếu 53 bảng/609 bản ghi. Bộ tích hợp SQL Server đạt 16 kiểm tra, 1 kiểm tra tùy chọn bỏ qua; HTTP đạt 85/85 kiểm tra. Xem [biên bản và giới hạn](../testing/SQLSERVER_MIGRATION_REPORT.md).
- Hạn chế được công bố trong báo cáo: còn thiếu 1 tệp minh chứng demo cũ; 2 kiểm thử holdout AI cũ thiếu ánh xạ nguồn nên chưa đạt. Không công nhận gói backup gồm DB và toàn bộ tệp là đầy đủ.
- Các tệp mẫu của thầy được giữ nguyên. Slide làm sau, khoảng 7 dòng chữ lớn mỗi slide.
- Nguồn dựng trong tmp/report-rewrite. Bản Word có chỉnh dàn trang cuối; không chạy lại builder để ghi đè nếu chưa đồng bộ nguồn.

