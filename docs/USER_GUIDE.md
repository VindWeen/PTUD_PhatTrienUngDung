# W5-P3 — Hướng dẫn sử dụng theo vai trò

Dùng API mode và DB demo riêng. Tất cả dữ liệu seed là dữ liệu mẫu, không dùng làm hồ sơ thật. Mật khẩu seed chung `demo1234` đã kiểm bằng HTTP; không sử dụng cho public/production. Đăng xuất khi đổi vai trò; không chia sẻ token. Menu ẩn không thay thế kiểm tra quyền/trạng thái tại backend.

| Tài khoản seed | Vai trò | Bắt đầu |
|---|---|---|
| an.nv | LECTURER | /me/profile, /achievements |
| bich.tt | MANAGER + LECTURER | /achievements, /reports |
| cuong.lh | UNIT_REPRESENTATIVE + LECTURER | /organizations, /achievements |
| records.demo | RECORDS_OFFICER | /awards, /award-applications |
| duc.pm | ADMIN | /admin |
| Chưa có trong seed | COUNCIL | /award-applications, sau khi tạo/phân công hợp lệ |

Tên/email seed có dạng trường học nhưng là dữ liệu mẫu trong SQL, không chứng minh tài khoản nhân sự thật. Tài khoản W5-P1 w5-* trong schema tải không đăng nhập được và không thay seed demo.

## Giảng viên

1. Đăng nhập tại /login; mở Hồ sơ cá nhân để kiểm tra thông tin và thành tích.
2. Mở Thành tích, tạo hồ sơ cá nhân, điền loại, tiêu đề, năm và thông tin bắt buộc; lưu nháp. Kiểm lại nội dung trước khi gửi.
3. Thêm minh chứng PDF/PNG/JPEG hợp lệ, tối đa 10 MB mỗi file. Đổi đuôi không biến file giả thành tài liệu hợp lệ. Tải lại file qua nút tải để kiểm file đã lưu; file không có URL công khai.
4. Gửi thẩm định; hồ sơ chuyển theo trạng thái backend cho phép. Khi bị yêu cầu bổ sung, đọc lý do, sửa và gửi lại. Không sửa nội dung đã khóa/đã xác minh bằng cách đổi request thủ công.
5. Theo dõi lịch sử và thông báo. Khi cần thay thế/thu hồi, dùng thao tác được phép và ghi lý do. Không xóa lịch sử để sửa kết quả.
6. Xem KPI và AI để lập kế hoạch. Kiểm năm, đơn vị, nguồn, tiêu chí và dữ liệu thiếu; gợi ý không phải quyết định khen thưởng.

## Đại diện đơn vị

Đăng nhập cuong.lh; chọn ngữ cảnh tập thể thuộc đơn vị đang được phân công. Nhập hồ sơ/minh chứng tập thể rồi gửi như quy trình cá nhân. Kiểm đơn vị và thời hạn phân công trước khi thao tác. Quyền cá nhân không tự mở rộng thành quyền sửa mọi hồ sơ tập thể; hết phân công thì yêu cầu quản trị cập nhật hợp lệ.

## Quản lý đơn vị

Đăng nhập bich.tt; lọc hồ sơ thuộc phạm vi đơn vị và trạng thái cần thẩm định. Đọc nội dung, mở/tải minh chứng, đối chiếu tiêu chí đã xác nhận. Chọn xác minh/yêu cầu bổ sung/từ chối theo quyền hiện tại, ghi nhận lý do. Không tự duyệt hồ sơ của mình; dùng hồ sơ an.nv khi demo. Kiểm lịch sử sau thao tác. Báo cáo và CSV phải giữ cùng bộ lọc năm/đơn vị/trạng thái; dữ liệu có thể thay đổi khi người khác ghi đồng thời.

## Hội đồng

Seed chưa có tài khoản Hội đồng: quản trị tạo tài khoản demo riêng và phụ trách nghiệp vụ phân công thành viên/hồ sơ hợp lệ trước buổi demo. Đăng nhập tài khoản đó, mở /award-applications, chỉ xét hồ sơ được phân công và đúng trạng thái. Đọc nguồn, tiêu chí, minh chứng và phần còn thiếu trước ghi kết quả. Không dùng admin làm Hội đồng, không để AI tự phê duyệt/trao thưởng. Phần browser Hội đồng chưa được nghiệm thu trong W5-P3; xem hợp đồng COUNCIL_W4_P3.md.

## Văn thư

Đăng nhập records.demo, mở /awards và /award-applications. Quản lý quyết định/sổ khen thưởng theo quy trình đã phê duyệt; kiểm số, ngày, đối tượng, file quyết định. Văn thư không mặc nhiên có quyền thẩm định chuyên môn. Tải file quyết định qua API có quyền; kiểm backup kho file quyết định riêng nếu nó không nằm trong STORAGE_DIR của minh chứng.

## Quản trị

Đăng nhập duc.pm, mở /admin: quản lý tài khoản, vai trò, đơn vị, danh mục và phân công có thời hạn. Cấp quyền tối thiểu đúng nhiệm vụ; ADMIN không có quyền thẩm định thay MANAGER/COUNCIL. Không sửa trực tiếp Supabase để bỏ trạng thái/khóa đồng thời. Khi public demo, thay secrets/mật khẩu mẫu và bảo vệ backup. Nguồn quy chế/bộ tiêu chí chỉ được xác nhận bởi người có thẩm quyền nghiệp vụ, không tự coi việc upload là xác nhận.

## Xử lý khi thao tác lỗi

- 401: đăng nhập lại, kiểm backend và cookie; không sửa localStorage để vượt auth.
- 403/404: kiểm tài khoản, phạm vi/phân công; không thử ID người khác để lấy dữ liệu.
- 409: tải lại hồ sơ và version trước khi thao tác, tránh ghi đè công việc người khác.
- File thiếu: báo vận hành kiểm DB metadata và kho private, không chỉ restore DB.
- AI thiếu nguồn/quota/timeout: giữ trạng thái chưa đủ dữ liệu; không tạo trích dẫn hoặc kết luận giả.

Dữ liệu từ KPI mock/CSV thử nghiệm phải gắn nhãn **MÔ PHỎNG — không phải dữ liệu LHU**. AI mock phải ghi **AI MÔ PHỎNG**. Đánh giá AI cần nguồn ACTIVE đã xác nhận và tiêu chí đã xác nhận, không sử dụng nguồn nháp hoặc suy đoán làm căn cứ xét thưởng.
