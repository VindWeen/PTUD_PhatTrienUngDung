# W6-P2 — Hướng dẫn sử dụng cuối theo vai trò

Dùng API mode và DB demo riêng. Tất cả dữ liệu seed là dữ liệu mẫu, không dùng làm hồ sơ thật. Mật khẩu seed chung `demo1234` đã kiểm bằng HTTP; không sử dụng cho public/production. Đăng xuất khi đổi vai trò; không chia sẻ token. Menu ẩn không thay thế kiểm tra quyền/trạng thái tại backend.

## Ba thuật ngữ cần phân biệt

| Thuật ngữ | Người thực hiện và kết quả | Không tự phát sinh |
|---|---|---|
| Xác nhận thành tích | Manager đúng phạm vi xác nhận hồ sơ đã nộp: `VERIFIED` | Quyết định/bản ghi khen thưởng |
| Đề nghị khen thưởng | Chủ thể nộp hồ sơ; Manager chuyển; Hội đồng được phân công kết luận `RECOMMENDED` hoặc `NOT_RECOMMENDED` | Quyết định trao thưởng hoặc `RECORDED` |
| Ghi nhận khen thưởng | RecordsOfficer nhập quyết định đã ban hành, file private và ghi `RECORDED` | Thẩm định thành tích hoặc kết luận Hội đồng |

`DRAFT` chỉ là nháp. `VERIFIED`, `RECOMMENDED`, `RECORDED` là ba kết quả khác nhau. File/quyết định dùng trong tổng duyệt là **MÔ PHỎNG**, không có giá trị trao thưởng thực tế.

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
3. Thêm minh chứng PDF/PNG/JPEG/DOCX hợp lệ, tối đa 10 MB mỗi file. Đổi đuôi không biến file giả thành tài liệu hợp lệ. Tải lại file qua nút tải để kiểm file đã lưu; file không có URL công khai.
4. Gửi thẩm định; hồ sơ chuyển theo trạng thái backend cho phép. Khi bị yêu cầu bổ sung, đọc lý do, sửa và gửi lại. Không sửa nội dung đã khóa/đã xác minh bằng cách đổi request thủ công.
5. Theo dõi lịch sử và thông báo. Khi cần thay thế/thu hồi, dùng thao tác được phép và ghi lý do. Không xóa lịch sử để sửa kết quả.
6. Xem KPI và AI để lập kế hoạch. Kiểm năm, đơn vị, nguồn, tiêu chí và dữ liệu thiếu; gợi ý không phải quyết định khen thưởng.

## Đại diện đơn vị

Đăng nhập cuong.lh; chọn ngữ cảnh tập thể thuộc đơn vị đang được phân công. Nhập hồ sơ/minh chứng tập thể rồi gửi như quy trình cá nhân. Kiểm đơn vị và thời hạn phân công trước khi thao tác. Quyền cá nhân không tự mở rộng thành quyền sửa mọi hồ sơ tập thể; hết phân công thì yêu cầu quản trị cập nhật hợp lệ.

## Quản lý đơn vị

Đăng nhập bich.tt; lọc hồ sơ thuộc phạm vi đơn vị và trạng thái cần thẩm định. Đọc nội dung, mở/tải minh chứng, đối chiếu tiêu chí đã xác nhận. Chọn xác minh/yêu cầu bổ sung/từ chối theo quyền hiện tại, ghi nhận lý do. Không tự duyệt hồ sơ của mình; dùng hồ sơ an.nv khi demo. Kiểm lịch sử sau thao tác. Báo cáo và CSV phải giữ cùng bộ lọc năm/đơn vị/trạng thái; dữ liệu có thể thay đổi khi người khác ghi đồng thời.

## Hội đồng

Seed chưa có tài khoản Hội đồng. Tại `/admin`, Admin tạo tài khoản demo riêng (mật khẩu ít nhất 10 ký tự), cấp vai trò `COUNCIL` và Phạm vi quản lý cùng vai trò, đơn vị và thời hạn hiệu lực. Lấy mã người dùng từ danh sách tài khoản; không dùng mã giảng viên thay mã người xét. Không cấp thêm ADMIN để thay quyền Hội đồng.

1. RecordsOfficer mở `/award-applications`, điền Mã kỳ/Tên kỳ/Bắt đầu/Kết thúc và bấm **Mở kỳ**. Ngày phải bao phủ thời điểm nộp.
2. Cá nhân/đại diện mở cùng trang: chọn chủ thể; điền mã giảng viên/đơn vị, kỳ, mã loại khen thưởng đang hoạt động, mục đích và mã thành tích `VERIFIED` cùng chủ thể. Mã `RECORDED` tùy chọn. Bấm **Tạo hồ sơ nháp**, rồi **Nộp và đóng băng input**.
3. Manager nhập **Mã đơn vị xem hồ sơ**, bấm **Tải danh sách**, mở hồ sơ `SUBMITTED`, điền **Ý kiến đơn vị**, bấm **Chuyển Hội đồng**: `COUNCIL_PENDING`.
4. Hội đồng nhập mã đơn vị đúng scope, tải danh sách và mở hồ sơ. Điền **Ý kiến hoặc nội dung bổ sung** (5–1000 ký tự), **Mã người xét**, bấm **Phân công**: `UNDER_REVIEW`. Người xét phải là COUNCIL có scope hiệu lực và không là chủ hồ sơ/đại diện tự xét. Người chưa được giao không được kết luận.
5. Người xét mở lại hồ sơ, đọc **Input đã đóng băng**, phân công, ý kiến và lịch sử; đối chiếu nguồn/tiêu chí đã xác nhận. **Ghi ý kiến** giữ status nhưng tăng version. **Yêu cầu bổ sung** chuyển `NEED_CORRECTION`; chủ thể nhập nội dung, bấm **Gửi bổ sung qua đơn vị**, Manager chuyển lại Hội đồng.
6. Bấm **Đề nghị khen thưởng** hoặc **Không đề nghị** với lý do: `RECOMMENDED`/`NOT_RECOMMENDED`. Kiểm lịch sử và thông báo. Kết luận không tạo quyết định hoặc bản ghi khen thưởng. Bổ sung văn bản không thay snapshot/file; cần thay đầu vào thì tạo đề nghị mới.

Danh mục và màn hình hiện nhập mã tham chiếu; ghi sẵn mã trong phiếu chuẩn bị demo. Nếu tài khoản, kỳ, scope hoặc input chưa đủ, dừng ở trạng thái hiện có. Xem [hợp đồng Hội đồng](api/COUNCIL_W4_P3.md) và [checklist tổng duyệt](testing/w6-p2/REHEARSAL_CHECKLIST.md) để biết mức kiểm chứng thực tế.

## Văn thư

Đăng nhập records.demo, mở /awards và /award-applications. Quản lý quyết định/sổ khen thưởng theo quy trình đã phê duyệt; kiểm số, ngày, đối tượng, file quyết định. Văn thư không mặc nhiên có quyền thẩm định chuyên môn. Tải file quyết định qua API có quyền; kiểm backup kho file quyết định riêng nếu nó không nằm trong STORAGE_DIR của minh chứng.

Tại `/awards`, chọn chủ thể, nhập mã chủ thể/loại thưởng, năm, số/ngày/cơ quan/tên quyết định mô phỏng; bấm **Tạo bản nháp**. Chọn **File quyết định**, bấm **Tải file quyết định**, rồi **Ghi nhận RECORDED**. Dùng Mã quyết định có sẵn khi một quyết định áp dụng nhiều chủ thể. Nhập mã đơn vị và tải danh sách; mở bản ghi, tải file, kiểm lịch sử. Thiếu file không ghi nhận được. Bản đã ghi nhận không sửa tại chỗ: **Thu hồi** có lý do rồi **Chuẩn bị bản thay thế** với quyết định sửa sai; giữ lịch sử/file cũ.

## Ca minh họa quyền sai

Chỉ dùng ID/token của tài khoản demo được cấp để kiểm tra. Giảng viên mở `/admin` bị chuyển `/404`; gửi GET `/api/v1/admin/users` bằng phiên giảng viên phải 403. Admin thử xác nhận thành tích hoặc ghi nhận khen thưởng mà không có vai trò nghiệp vụ phải 403. Manager thử xác nhận hồ sơ của mình phải 403; đại diện hết hạn/ngoài đơn vị không được ghi tập thể. Hội đồng chưa được phân công không được ghi ý kiến/kết luận; ngoài scope không được mở hàng chờ. Hai phiên cùng hồ sơ: thao tác dùng version cũ phải 409 và cần tải lại. Không coi menu ẩn là bằng chứng backend đã chặn; ghi HTTP status và lịch sử không đổi vào checklist.

## Quản trị

Đăng nhập duc.pm, mở /admin: quản lý tài khoản, vai trò, đơn vị, danh mục và phân công có thời hạn. Cấp quyền tối thiểu đúng nhiệm vụ; ADMIN không có quyền thẩm định thay MANAGER/COUNCIL. Không sửa trực tiếp Supabase để bỏ trạng thái/khóa đồng thời. Khi public demo, thay secrets/mật khẩu mẫu và bảo vệ backup. Nguồn quy chế/bộ tiêu chí chỉ được xác nhận bởi người có thẩm quyền nghiệp vụ, không tự coi việc upload là xác nhận.

## Xử lý khi thao tác lỗi

- 401: đăng nhập lại, kiểm backend và cookie; không sửa localStorage để vượt auth.
- 403/404: kiểm tài khoản, phạm vi/phân công; không thử ID người khác để lấy dữ liệu.
- 409: tải lại hồ sơ và version trước khi thao tác, tránh ghi đè công việc người khác.
- File thiếu: báo vận hành kiểm DB metadata và kho private, không chỉ restore DB.
- AI thiếu nguồn/quota/timeout: giữ trạng thái chưa đủ dữ liệu; không tạo trích dẫn hoặc kết luận giả.

Dữ liệu từ KPI mock/CSV thử nghiệm phải gắn nhãn **MÔ PHỎNG — không phải dữ liệu LHU**. AI mock phải ghi **AI MÔ PHỎNG**. Đánh giá AI cần nguồn ACTIVE đã xác nhận và tiêu chí đã xác nhận, không sử dụng nguồn nháp hoặc suy đoán làm căn cứ xét thưởng.
