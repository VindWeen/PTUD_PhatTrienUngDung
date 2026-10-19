# Test plan kiểm thử qua giao diện — PTUD LHU

> **Cập nhật phân công 2 người:** dùng [plan song song](UI_TEST_PLAN_PARALLEL.md), [bộ người 1 — 72 ca](UI_TEST_PLAN_TESTER_1.md) và [bộ người 2 — 73 ca](UI_TEST_PLAN_TESTER_2.md) để chạy. File này giữ làm danh mục 145 ID gốc. Quy tắc môi trường riêng, prefix dữ liệu, thứ tự và điều kiện tự chuẩn bị trong ba file mới thay cho cách chạy tuần tự/prefix UI-1910 ở bản gốc dưới đây.

Ngày lập: **19/10/2026**. Bản nháp để duyệt trước khi chuyển sang Excel.

Tổng **145 ca UI**: **74 P0**, **68 P1**, **3 P2**; trong đó 15 bước là luồng xuyên suốt. Dữ liệu SCN đã được reset ngày 19/10/2026; xem biên bản ở cuối tài liệu.

**Bảng ca bên dưới là bản kế hoạch, chưa cập nhật kết quả chạy tổng thể.** Theo yêu cầu kiểm tra AI sau khi lập kế hoạch, đã có một lượt kiểm tra AI riêng: xem [biên bản tích hợp AI 19/10/2026](AI_INTEGRATION_CHECK_2026-10-19.md). Việc chuẩn bị/reset dữ liệu không được tính là kiểm thử giao diện đạt. Các kết quả kiểm thử cũ trong README không phải kết quả của đợt này.

## 1. Mục tiêu và phạm vi

Kiểm tra người dùng có đi hết các luồng hiện có hay không: đăng nhập → kê khai và xác nhận thành tích → đề nghị khen thưởng → Hội đồng → quyết định và ghi nhận → hồ sơ năng lực/báo cáo/thông báo. Đồng thời kiểm tra lịch cá nhân, KPI, quy định, AI, tổ chức và quản trị.

Tất cả thao tác test bằng **giao diện trình duyệt**: bấm nút, nhập form, chọn danh sách, tải lên/tải về tệp, đăng nhập bằng từng tài khoản, tải lại trang, mở hai tab, thay đổi kích thước màn hình. **Không dùng Postman, curl, gọi API trực tiếp hoặc sửa database để làm ca test đạt.** Có thể dùng công cụ trình duyệt để chuyển Offline khi kiểm lỗi mạng; vẫn thao tác bằng UI của ứng dụng.

Kết quả mong đợi là tiêu chí nghiệm thu, không khẳng định tính năng hiện đã chạy đúng. Nếu UI thiếu nút để thực hiện một chức năng được mô tả, ghi rõ thiếu bước/nút và tạo lỗi hoặc yêu cầu cải tiến; không chuyển sang API để thay thế.

AI/nguồn KPI thật chỉ chạy khi môi trường đã sẵn sàng và người phụ trách đồng ý dùng provider. Seed có dữ liệu mô phỏng; mô phỏng không chứng minh kết quả AI hay chính sách pháp lý thực tế.

## 2. Chuẩn bị đợt test

- Dùng môi trường ứng dụng đang nối database demo, không phải chế độ fixture. Ghi địa chỉ UI, trình duyệt, độ phân giải và commit thực tế vào biên bản chạy.
- Sau reset: đăng xuất, tải lại trang rồi đăng nhập lại. Phiên và dữ liệu đang mở trước reset có thể đã hết hiệu lực.
- Dùng tên/mục đích có tiền tố `UI-1910-` cho dữ liệu tạo thêm; ví dụ `UI-1910-MAIN`, `UI-1910-KPI-01`. Không nhầm với hồ sơ `SCN` được seed sẵn.
- File sẵn có: `docs/testing/scenario/fixtures/evidence-demo.pdf`, `decision-demo.pdf`, `kpi-valid.csv`, `kpi-invalid.csv`. Các tệp PDF có nhãn mô phỏng.
- Chuẩn bị qua máy tính: tệp rỗng, tệp `.txt`, tệp lớn hơn 10 MB và tệp giả chỉ đổi đuôi thành `.pdf`; chỉ dùng cho ca kiểm từ chối file. Tệp Excel/CSV nhập KPI nên lấy từ nút tải mẫu trong UI hiện tại.
- Desktop: Edge/Chrome, khoảng 1440×900; mobile: 390×844 và 360×800; chạy thêm giao diện tối và phóng to 200%.
- Mỗi lần đổi vai trò phải đăng xuất/đăng nhập rõ ràng. Hai người dùng đồng thời nên dùng hai hồ sơ trình duyệt/cửa sổ ẩn danh độc lập.
- Không sửa/khóa tài khoản nền trong vòng đầu. Test quản trị trên tài khoản, đơn vị, loại thành tích mới có tiền tố `UI-1910-`.
- Ưu tiên giữ `SCN-A01` cho luồng E2E chính. Các ca sửa trạng thái khác dùng mã được chỉ định hoặc hồ sơ mới. Không mặc định một hồ sơ vẫn còn trạng thái seed sau khi đã chạy ca khác.
- Luồng E2E chính chạy liền mạch. Muốn chạy lại các nhánh đã tiêu thụ dữ liệu thì tạo hồ sơ riêng qua UI hoặc lập một đợt reset mới; không tự sửa trạng thái để quay lui.

### Tài khoản sử dụng

Mật khẩu chung của các tài khoản seed: **`demo1234`**.

| Tài khoản | Vai trò/phạm vi | Điểm cần kiểm |
| --- | --- | --- |
| an.nv | Giảng viên Bộ môn Kỹ thuật Phần mềm (KTPM) | Luồng cá nhân, hồ sơ, KPI, lịch cá nhân |
| bich.tt | Quản lý Khoa CNTT và bộ môn con; đồng thời là giảng viên | Thẩm định, chuyển Hội đồng; không tự duyệt |
| duc.pm | Admin | Tài khoản, danh mục, phạm vi; không thay quản lý duyệt chuyên môn |
| cuong.lh | Giảng viên Bộ môn KHMT; đại diện Bộ môn KTPM | Tách cá nhân/tập thể; nơi công tác không đồng nghĩa đơn vị đại diện |
| records.demo | Chuyên viên thi đua khen thưởng, phạm vi CNTT | Kỳ đề nghị, quyết định, sổ khen thưởng |
| council.demo | Hội đồng CNTT | Phân công và xử lý hồ sơ được giao |
| council.other | Hội đồng CNTT, ban đầu chưa được giao P04 | Có quyền đọc không đồng nghĩa có quyền kết luận |
| linh.pharm | Giảng viên Khoa Dược | Cách ly ngoài phạm vi CNTT |
| rep.expired | Role đại diện, phân công KHMT đã hết hạn | Role không thay thế phân công còn hiệu lực |
| locked.demo | Tài khoản bị khóa | Không được đăng nhập |

### Dữ liệu chuẩn sau seed

| Nhóm | Mã và trạng thái chuẩn | Cách tìm trên UI |
| --- | --- | --- |
| Thành tích cá nhân | A01 nháp thiếu minh chứng; A02 chờ duyệt; A03 cần bổ sung; A04 đã xác nhận; A05 từ chối; A06 đã hủy; A07 thu hồi; A08 nháp thay A07 | Tìm `SCN-A01` … `SCN-A08` ở Thành tích |
| Thành tích kiểm quyền | A09 của Bích đang chờ duyệt; A10 của Linh/Khoa Dược đang chờ duyệt | `SCN-A09`, `SCN-A10` |
| Thành tích tập thể | T01 nháp; T02 đã xác nhận | `SCN-T01`, `SCN-T02`, chủ thể Bộ môn KTPM |
| Đề nghị cá nhân | P01 nháp; P02 đã nộp; P03 chờ Hội đồng; P04 đang xét, giao council.demo; P05 cần bổ sung; P06 đề nghị; P07 không đề nghị | Mục đích chứa `SCN-P01` … `SCN-P07` |
| Đề nghị tập thể | PT01 chờ Hội đồng | Mục đích chứa `SCN-PT01` |
| Khen thưởng | R01 nháp thiếu file; R02 đã ghi nhận; R03 đã thu hồi; RT01 tập thể đã ghi nhận | Quyết định chứa `SCN-R01`, `SCN-R02`, `SCN-R03`, `SCN-RT01` |
| KPI | K01 chưa chấp nhận; K02 đã chấp nhận; K03 có kết quả; KT01 tập thể có kết quả | `SCN-K01`, `SCN-K02`, `SCN-K03`, `SCN-KT01` |
| Quy định/AI | SCN-REGULATION, SCN-CRIT-01 dùng mô phỏng; SCN-CRIT-DRAFT chưa xác nhận; hai phiên đánh giá mô phỏng cá nhân/tập thể | Kho quy định và Lịch sử Phiên AI |
| Kỳ đề nghị | SCN-OPEN-2026 đang mở; SCN-CLOSED-2026 đã đóng | Chọn kỳ bằng tên ở form |
| Lịch cá nhân | Khởi đầu không có ghi chú cá nhân; vẫn có sự kiện chung minh họa trên lịch | Icon lịch trên header hoặc Lịch cá nhân tại trang chủ |

Không cần nhập ID kỹ thuật để chạy ca test. Nếu màn hình chỉ hiện mã hoặc ID mà không có tên để lựa chọn, ghi nhận vấn đề UX.

## 3. Quy tắc ghi kết quả và ưu tiên

| Giá trị | Ý nghĩa |
| --- | --- |
| P0 | Phải kiểm trước: luồng chính, sai quyền, mất dữ liệu, trạng thái/ghi nhận sai |
| P1 | Chức năng thường dùng, thao tác quản lý, lọc dữ liệu, lưu/tải file |
| P2 | Trình bày, khả dụng và tình huống ít gặp |
| Chưa chạy | Chưa thao tác và đối chiếu kết quả |
| Đạt | Đã thao tác đủ bước và có bằng chứng đúng kết quả mong đợi |
| Lỗi | UI thao tác được nhưng kết quả sai; gắn mã lỗi |
| Bị chặn | Chưa thể chạy do môi trường/provider/dữ liệu phụ thuộc; ghi nguyên nhân |
| Không áp dụng | Ngoài phạm vi bản hiện tại, có lý do được duyệt; không tính là Đạt |

Mỗi ca có ID ổn định để sau này chuyển một dòng thành một dòng Excel. Cột cuối ghi kết quả thực tế, mã bug, link ảnh/video và người/ngày chạy. Khi tách một ca nhiều nhánh, dùng hậu tố như `ACH-03a`, `ACH-03b`.

## 4. Luồng chính xuyên suốt — chạy trước

Chạy theo thứ tự. Dữ liệu liên kết dùng mục đích `UI-1910-MAIN`; số quyết định riêng `UI-1910-MAIN-2026`. Luồng không được bỏ qua bước bằng thao tác kỹ thuật.

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FLOW-01 | P0 | an.nv | Seed mới; A01 nháp | Đăng nhập → Thành tích → tìm SCN-A01 → mở → gửi khi chưa thêm file | Báo thiếu minh chứng; vẫn nháp; không mất dữ liệu | Chưa chạy | — |
| FLOW-02 | P0 | an.nv | FLOW-01 | Sửa mô tả vai trò; thêm evidence-demo.pdf; tải lại file; gửi duyệt | File tải mở được; thành tích chuyển Chờ duyệt; có lịch sử/lần nộp | Chưa chạy | — |
| FLOW-03 | P0 | bich.tt | FLOW-02 | Mở hàng chờ thẩm định; tìm A01; yêu cầu bổ sung với lý do cụ thể | Chuyển Cần bổ sung; lý do và người xử lý được lưu | Chưa chạy | — |
| FLOW-04 | P0 | an.nv | FLOW-03 | Mở thông báo/lý do; sửa nội dung; tải phiên bản minh chứng mới; gửi lại | Lần nộp mới; phiên bản cũ còn tra cứu được; trở lại Chờ duyệt | Chưa chạy | — |
| FLOW-05 | P0 | bich.tt | FLOW-04 | Mở A01, kiểm thông tin và file; xác nhận | Thành tích Đã xác nhận; đúng người/thời điểm; khóa sửa trực tiếp | Chưa chạy | — |
| FLOW-06 | P0 | an.nv | FLOW-05; kỳ mở | Hồ sơ đề nghị → tạo cá nhân cho An; chọn loại thưởng, kỳ mở, A01; nhập UI-1910-MAIN; lưu nháp rồi nộp | Nháp và lần nộp thành công; giữ đúng chủ thể, nguồn, loại thưởng; có lịch sử | Chưa chạy | — |
| FLOW-07 | P0 | bich.tt | FLOW-06 | Mở đề nghị UI-1910-MAIN; xem nguồn/file; nhập ý kiến và Chuyển Hội đồng | Chờ Hội đồng; ý kiến đơn vị xuất hiện trong lịch sử | Chưa chạy | — |
| FLOW-08 | P0 | council.demo | FLOW-07 | Vào Hồ sơ đề nghị; mở hồ sơ; chọn council.demo trong danh sách người xét; Phân công có lý do | Đang xét duyệt; lưu người được giao; có thể ghi ý kiến | Chưa chạy | — |
| FLOW-09 | P0 | council.demo | FLOW-08 | Ghi ý kiến; chọn Đề nghị khen thưởng; nhập lý do | Trạng thái Đề nghị khen thưởng; chưa tự sinh quyết định/sổ thưởng | Chưa chạy | — |
| FLOW-10 | P0 | records.demo | FLOW-09 | Trang Khen thưởng; tạo quyết định UI-1910-MAIN-2026; tạo nháp sổ cho An đúng loại, liên kết A01 | Nháp sổ riêng; đúng chủ thể, nguồn và quyết định; không nhân đôi hồ sơ | Chưa chạy | — |
| FLOW-11 | P0 | records.demo | FLOW-10 | Thử Ghi nhận trước khi upload file quyết định | Bị chặn có giải thích; nháp còn nguyên | Chưa chạy | — |
| FLOW-12 | P0 | records.demo | FLOW-11 | Upload decision-demo.pdf vào quyết định; Ghi nhận; đóng/mở lại chi tiết | Đã ghi nhận; file tải được; lưu ngày/người ghi nhận và lịch sử | Chưa chạy | — |
| FLOW-13 | P0 | an.nv | FLOW-12 | Mở Hồ sơ năng lực; xem Nghiên cứu và Khen thưởng; mở popup thành tích | A01 ở đúng nhóm; khen thưởng mới có quyết định tương ứng; không gộp hai đối tượng | Chưa chạy | — |
| FLOW-14 | P0 | bich.tt | FLOW-12 | Báo cáo → chọn năm, Bộ môn KTPM và nguồn; áp dụng; xuất CSV bằng nút trên UI | Số liệu và CSV cùng bộ lọc; hồ sơ hợp lệ có trong kết quả; dữ liệu ngoài quyền không lẫn vào | Chưa chạy | — |
| FLOW-15 | P0 | an.nv, bich.tt | Các bước FLOW đã tạo thông báo | Kiểm chuông, số chưa đọc và thông báo liên quan; đánh dấu đã đọc rồi tải lại trang | Đúng người nhận và hồ sơ; số chưa đọc giảm đúng, trạng thái đã đọc được giữ | Chưa chạy | — |

## 5. Đăng nhập và phiên làm việc

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | P0 | 9 tài khoản ACTIVE | Trang đăng nhập | Lần lượt đăng nhập và đăng xuất từng tài khoản, dùng các nút tài khoản demo | Đúng tên/vai trò; Hội đồng vào Hồ sơ đề nghị; không thấy dữ liệu phiên người trước | Chưa chạy | — |
| AUTH-02 | P0 | an.nv; locked.demo | Đã đăng xuất | Thử mật khẩu sai, tài khoản không tồn tại, tài khoản bị khóa | Không vào hệ thống; thông báo rõ; form còn dùng được | Chưa chạy | — |
| AUTH-03 | P1 | Bất kỳ | Trang đăng nhập | Bỏ trống từng trường; bật/tắt hiện mật khẩu; chọn nhanh từng tài khoản demo | Chặn trường bắt buộc; mật khẩu ẩn/hiện đúng; nút demo điền đúng username/pass | Chưa chạy | — |
| AUTH-04 | P0 | an.nv | Có phiên đăng nhập | Tải lại trang; mở tab mới cùng trình duyệt; chuyển trang | Khôi phục đúng tài khoản; không nháy dữ liệu tài khoản khác hoặc kẹt loading | Chưa chạy | — |
| AUTH-05 | P0 | an.nv | Đã đăng nhập | Đăng xuất; bấm Back; mở lại URL Hồ sơ năng lực từ thanh địa chỉ | Không đọc được trang/file riêng bằng phiên đã đăng xuất | Chưa chạy | — |
| AUTH-06 | P1 | an.nv | Chạy hai lượt | Đăng nhập có/không Ghi nhớ phiên; đóng mở trình duyệt và kiểm lại | Hành vi giữ phiên đúng lựa chọn và cấu hình hiện tại; không tự chuyển tài khoản | Chưa chạy | — |
| AUTH-07 | P1 | Tài khoản UI mới | Admin tạo tài khoản riêng | Đổi mật khẩu: sai mật khẩu cũ, xác nhận không khớp, mật khẩu hợp lệ; đăng nhập lại | Ca sai có lỗi rõ; ca đúng đổi được; phiên cũ bị thu hồi; mật khẩu mới hoạt động | Chưa chạy | — |
| AUTH-08 | P2 | Không đăng nhập | Giao diện có Đăng ký/Quên mật khẩu | Mở các chức năng mà UI cho phép; nhập dữ liệu | Nếu là mô phỏng phải ghi rõ; không báo đã tạo tài khoản/gửi email thật khi chưa có chức năng | Chưa chạy | — |

## 6. Trang chủ và điều hướng

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HOME-01 | P1 | an.nv | Trang chủ | Bấm ba lối tắt Thành tích, Hồ sơ đề nghị, Mục tiêu / KPI; Back sau từng lần | Đến đúng trang; tên, mô tả và icon phù hợp; không còn cùng dẫn Hồ sơ năng lực | Chưa chạy | — |
| HOME-02 | P1 | duc.pm; records.demo | Trang chủ của từng role | Kiểm và bấm từng lối tắt; kiểm cả link logo | Lối tắt không đưa người dùng vào 404 do thiếu quyền; ẩn/khóa hoặc giải thích hợp lý khi không được phép | Chưa chạy | — |
| HOME-03 | P1 | an.nv | Có A01/A04 | Nhập tên/mã thành tích vào ô tìm kiếm trang chủ; Enter | Có kết quả hoặc chuyển sang danh sách có bộ lọc; nếu ô chỉ trang trí thì ghi thiếu chức năng | Chưa chạy | — |
| HOME-04 | P1 | an.nv; bich.tt | Biết các hồ sơ seed | Đối chiếu widget thống kê với Hồ sơ năng lực/Báo cáo cùng chủ thể | Dữ liệu thật khớp; widget mẫu có nhãn mô phỏng, không thể hiện số cố định như số liệu thật | Chưa chạy | — |
| HOME-05 | P1 | Từng role | Desktop | Hover và dùng bàn phím mở sidebar; chọn từng mục được phép | Tên đọc rõ; trang đang mở nổi bật; không có mục sai quyền hoặc bị che khuất | Chưa chạy | — |
| HOME-06 | P1 | council.demo | Đăng nhập Hội đồng | Kiểm trang mặc định, menu và icon lịch ở header | Mặc định Hồ sơ đề nghị; không bị ép vào trang chủ không có quyền; lịch vẫn mở được | Chưa chạy | — |

## 7. Lịch cá nhân

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAL-01 | P1 | an.nv | Lịch trống sau reset | Mở lịch từ icon header rồi từ khung trang chủ; đóng mỗi lần | Cùng chức năng popup; mở được ở các trang; không thêm tab sidebar không cần thiết | Chưa chạy | — |
| CAL-02 | P1 | an.nv | Popup mở | Chuyển tháng trước/sau, tháng 12↔1, tháng 2 năm nhuận; chọn tháng/năm; Hôm nay | Đúng số ngày và thứ; Hôm nay chọn ngày hiện tại theo giờ Việt Nam | Chưa chạy | — |
| CAL-03 | P0 | an.nv | Chọn ngày bất kỳ | Thêm UI-1910-CAL-01, đủ tiêu đề/giờ/địa điểm/ghi chú; lưu; F5; mở lại | Ghi chú còn nguyên; đúng ngày giờ, loại và tài khoản | Chưa chạy | — |
| CAL-04 | P1 | an.nv | Tạo dữ liệu riêng | Tạo từng loại Lịch thi, Cuộc thi, Công việc, Cá nhân; lọc từng loại | Màu/nhãn nhất quán; bộ lọc không làm mất bản ghi | Chưa chạy | — |
| CAL-05 | P1 | an.nv | Lịch có giờ | Sửa tiêu đề/ghi chú/giờ; lưu và mở lại | Nội dung cập nhật đúng một lịch; không sinh bản trùng | Chưa chạy | — |
| CAL-06 | P1 | an.nv | Chưa có lịch nhiều ngày | Tạo cả ngày; tạo qua hai ngày/cuối tháng; bấm từng ngày | Hiện trên đủ ngày trong khoảng; không lệch một ngày hoặc sai múi giờ | Chưa chạy | — |
| CAL-07 | P1 | an.nv | Có lịch cá nhân | Bỏ trống tên; nhập kết thúc trước bắt đầu; thử lưu | Chặn lưu, chỉ rõ lỗi; bản nháp và dữ liệu đã lưu không mất | Chưa chạy | — |
| CAL-08 | P1 | an.nv | Công việc quá hạn và chưa hoàn thành | Mở ngày; Hoàn thành; Mở lại; kiểm danh sách sắp tới và F5 | Nhãn quá hạn/hoàn thành đúng; trạng thái được lưu; lịch hoàn thành không bị coi còn việc phải làm | Chưa chạy | — |
| CAL-09 | P1 | an.nv | Có lịch riêng | Thử xóa rồi hủy xác nhận; xóa và đồng ý; F5 | Hủy thì giữ; đồng ý thì xóa đúng bản ghi; không ảnh hưởng sự kiện khác | Chưa chạy | — |
| CAL-10 | P0 | an.nv → bich.tt | An có CAL-01 | Đăng xuất An, đăng nhập Bích, mở cùng ngày; quay lại An | Bích không thấy/sửa lịch của An; An vẫn thấy đúng lịch riêng; sự kiện chung vẫn được thấy | Chưa chạy | — |
| CAL-11 | P1 | an.nv | Popup có form đang nhập | Đóng bằng ×, Esc, bấm nền: kiểm cả hủy và đồng ý bỏ; thử khi form chưa sửa | Có xác nhận khi bẩn; hủy giữ nội dung; đồng ý đóng; form sạch đóng trực tiếp | Chưa chạy | — |
| CAL-12 | P0 | an.nv | Hai tab cùng mở một lịch; có sự kiện chung | Tab 1 sửa/lưu, tab 2 lưu/xóa bản cũ; sau đó mở sự kiện hội đồng/hạn nộp mẫu | Báo xung đột thay vì ghi đè; tải lại được; sự kiện chung có nhãn Minh họa và chỉ xem | Chưa chạy | — |

## 8. Hồ sơ năng lực và popup thành tích

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PORT-01 | P1 | an.nv | Hồ sơ năng lực | Sửa số điện thoại/chức danh/học vị; lưu; F5 | Lưu đúng trường được phép; không tự đổi đơn vị/quyền; không mất dữ liệu khác | Chưa chạy | — |
| PORT-02 | P1 | an.nv | Có bài báo, sáng chế, giáo trình tạo qua UI | Chuyển Nghiên cứu khoa học, Giảng dạy, Khen thưởng, Minh chứng | Bài báo/sáng chế vào Nghiên cứu; giáo trình vào Giảng dạy; Khen thưởng lấy quyết định/sổ riêng | Chưa chạy | — |
| PORT-03 | P1 | an.nv | Danh sách dài | Bấm thẻ ở đầu/giữa/cuối danh sách | Popup mở ngay; rõ nội dung, trạng thái, loại, năm, minh chứng; không cần tìm phần chi tiết dưới danh sách | Chưa chạy | — |
| PORT-04 | P1 | an.nv | Popup mở | Đóng ×/Esc/nền ngoài; mở thành tích khác; dùng Tab/Shift+Tab | Đúng nội dung hồ sơ mới; focus không ra nền khi mở; đóng trở lại thẻ/vị trí cũ | Chưa chạy | — |
| PORT-05 | P1 | an.nv | Nháp UI riêng có minh chứng | Trong popup thêm file; lưu; tải file; đóng mở lại | Danh sách/số minh chứng cập nhật; tệp đúng; thành tích đã xác nhận không có nút thêm trái quyền | Chưa chạy | — |
| PORT-06 | P1 | an.nv | Popup có form upload | Nhập tên/chọn file rồi đóng; hủy bỏ/đồng ý bỏ; thử lưu file lỗi | Không mất nội dung khi chọn giữ; lỗi ngay trong popup; không báo lưu thành công giả | Chưa chạy | — |
| PORT-07 | P1 | an.nv | Có ít nhất 13 thành tích cùng nhóm của An | Tạo thêm nháp bằng UI đến đủ dữ liệu; bấm số trang 1/2, trước/sau; đổi bộ lọc | Trang hiện tại sáng; kết quả đúng trang; dấu … hợp lý khi đủ nhiều trang; đổi lọc về trang 1 | Chưa chạy | — |
| PORT-08 | P1 | an.nv | Có dữ liệu danh sách | Mở lọc, tìm tiêu đề/năm/loại/trạng thái; xóa lọc; thử từ khóa không có | Kết quả theo bộ lọc; trạng thái rỗng rõ; không còn thành tích ngoài nhóm | Chưa chạy | — |
| PORT-09 | P1 | an.nv | Popup bất kỳ | Bấm Xem hồ sơ đầy đủ; ở hồ sơ bấm thêm thành tích | Đúng hồ sơ tại trang Thành tích; nút thêm mở được form; không làm mất bản upload chưa lưu mà không hỏi | Chưa chạy | — |

## 9. Kê khai và thẩm định thành tích

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ACH-01 | P0 | an.nv | Trang Thành tích | Tạo nháp cá nhân UI-1910-ACH-01; chọn từng loại thành tích để kiểm nhãn | Lưu được; chỉ tên tiếng Việt trong lựa chọn; chủ thể mặc định đúng người | Chưa chạy | — |
| ACH-02 | P1 | an.nv | Nháp UI riêng | Sửa tiêu đề, mô tả, vai trò, ngày, năm; lưu; đóng mở/F5 | Giá trị giữ đúng; không tạo thêm nháp ngoài ý muốn | Chưa chạy | — |
| ACH-03 | P1 | an.nv | Form mới | Thiếu tiêu đề/loại/năm; khoảng ngày ngược; gửi form | Chặn dữ liệu sai; thông báo gần trường; nội dung hợp lệ đã nhập còn nguyên | Chưa chạy | — |
| ACH-04 | P0 | an.nv | Nháp UI riêng | Thêm PDF hợp lệ; xem danh sách; tải file về mở | Có đúng tệp đã chọn, tên và dung lượng hợp lý; bản ghi gắn đúng thành tích | Chưa chạy | — |
| ACH-05 | P1 | an.nv | Nháp UI riêng | Lần lượt upload .txt, tệp rỗng, quá 10 MB, giả đuôi .pdf | Bị từ chối có lý do; không tạo minh chứng lỗi hoặc thẻ rác | Chưa chạy | — |
| ACH-06 | P0 | an.nv | SCN-A03 còn Cần bổ sung | Xem lý do; bổ sung nội dung; thêm phiên bản file; gửi lại; xem lịch sử lần nộp | Đúng trạng thái; tệp/lần nộp cũ còn truy xuất; không sửa ngược bản chụp cũ | Chưa chạy | — |
| ACH-07 | P0 | bich.tt | SCN-A02 còn Chờ duyệt | Mở hàng chờ; chọn Từ chối; thử thiếu lý do rồi nhập lý do | Không chấp nhận lý do trống; từ chối thành công có lịch sử và lý do | Chưa chạy | — |
| ACH-08 | P0 | bich.tt | SCN-A09 của chính Bích | Mở chi tiết; thử xác nhận/yêu cầu xử lý như người thẩm định | Không tự duyệt; không đổi trạng thái; UI giải thích rõ | Chưa chạy | — |
| ACH-09 | P0 | bich.tt; linh.pharm | A10 thuộc Khoa Dược | Bích tìm A10, mở link UI được Linh chia sẻ; Linh mở cùng hồ sơ | Bích không đọc/duyệt ngoài phạm vi; Linh xem được hồ sơ của mình | Chưa chạy | — |
| ACH-10 | P0 | duc.pm | A02 hoặc nháp đã gửi riêng | Vào Thành tích; thử tìm thao tác xác nhận chuyên môn | Admin không có quyền xác nhận chỉ vì là admin; trạng thái không đổi | Chưa chạy | — |
| ACH-11 | P0 | cuong.lh | SCN-T01 nháp KTPM | Chọn chủ thể Tập thể, Bộ môn KTPM; thêm file và gửi; Bích xác nhận | Thành tích thuộc tập thể KTPM, không biến thành cá nhân Cường hoặc đơn vị KHMT | Chưa chạy | — |
| ACH-12 | P0 | cuong.lh; rep.expired | Kiểm quyền đại diện | Thử tạo tập thể KHMT/toàn Khoa bằng Cường; rep.expired thử đơn vị hết hạn | Không được chọn/thao tác ngoài phân công; không tạo bản ghi trái quyền | Chưa chạy | — |
| ACH-13 | P0 | an.nv | SCN-A04 đã xác nhận | Thử sửa, xóa, thêm/thay minh chứng qua các nút UI còn thấy | Bị khóa đúng trạng thái; không âm thầm sửa dữ liệu đã xác nhận | Chưa chạy | — |
| ACH-14 | P1 | an.nv | SCN-A05/A06/A07 | Xem lý do, lịch sử; tạo bản thay thế từ hồ sơ đủ điều kiện; xem liên kết A08–A07 | Trạng thái và quan hệ thay thế rõ; không biến bản cũ thành hồ sơ hợp lệ | Chưa chạy | — |
| ACH-15 | P0 | an.nv | Nháp UI riêng, hai tab | Cùng mở form; tab 1 lưu thay đổi; tab 2 lưu bản cũ | Có thông báo xung đột, không ghi đè; làm mới và thao tác lại được | Chưa chạy | — |
| ACH-16 | P1 | an.nv | Nháp UI riêng không dùng luồng chính | Xóa nháp: kiểm hủy/đồng ý; tạo nháp khác gửi rồi rút/hủy có lý do; tìm lại | Xóa/rút theo đúng trạng thái; hủy xác nhận không mất dữ liệu; lịch sử rút lưu đúng | Chưa chạy | — |

## 10. Hồ sơ đề nghị và Hội đồng

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| APP-01 | P0 | an.nv | Có A04; kỳ mở | Tạo đề nghị; kiểm các ô chọn tên giảng viên, kỳ, loại thưởng, nguồn; lưu nháp | Chọn bằng tên; nguồn đúng người và đã xác nhận; không yêu cầu nhớ ID | Chưa chạy | — |
| APP-02 | P0 | an.nv | Có nháp/chờ duyệt và A04 | Mở chọn nguồn; tìm thành tích chưa xác nhận hoặc của Cường/Linh | Không được dùng nguồn chưa hợp lệ/sai chủ thể | Chưa chạy | — |
| APP-03 | P0 | cuong.lh | Tạo đề nghị mới | Đổi cá nhân sang tập thể rồi đổi chủ thể; kiểm danh sách thưởng/nguồn đã tick | Bỏ lựa chọn nguồn cũ; chỉ còn loại thưởng/nguồn phù hợp chủ thể mới | Chưa chạy | — |
| APP-04 | P0 | an.nv | Kỳ SCN-CLOSED-2026 | Thử chọn kỳ đóng để tạo/nộp; thử form thiếu mục đích/nguồn bắt buộc | Không nộp vào kỳ đóng hoặc dữ liệu thiếu; lỗi có hướng khắc phục | Chưa chạy | — |
| APP-05 | P1 | an.nv | SCN-P01 còn nháp | Mở lại nháp; nộp; kiểm nguồn và lịch sử | Đã nộp; nguồn lúc nộp rõ; bấm lặp không tạo hai hồ sơ/lần nộp bất thường | Chưa chạy | — |
| APP-06 | P0 | bich.tt | SCN-P02 đã nộp | Kiểm phạm vi mặc định; lọc KTPM; mở, nhập ý kiến; Chuyển Hội đồng | Hồ sơ không mất do bộ lọc mặc định sai; chuyển đúng bước, có lịch sử | Chưa chạy | — |
| APP-07 | P0 | council.demo | SCN-P03 chờ Hội đồng | Chọn người xét bằng tên; thử thiếu người/lý do; Phân công | Kiểm trường bắt buộc; phân công hợp lệ chuyển Đang xét duyệt | Chưa chạy | — |
| APP-08 | P0 | council.other | SCN-P04 chưa giao cho người này | Mở P04; tìm/thử ghi ý kiến và kết luận | Có thể đọc đúng phạm vi nhưng không được kết luận khi chưa phân công | Chưa chạy | — |
| APP-09 | P0 | council.demo | SCN-P04 giao council.demo | Ghi ý kiến rồi chọn Không đề nghị, nhập lý do | Lưu ý kiến/lý do; trạng thái Không đề nghị; không tự ghi sổ thưởng | Chưa chạy | — |
| APP-10 | P0 | an.nv → bich.tt → council.demo | SCN-P05 cần bổ sung | An xem lý do và Gửi bổ sung qua đơn vị; Bích chuyển lại; Hội đồng xử lý | Đi đúng tuyến; giữ nguồn chụp ban đầu; phân công hiện hành được kiểm tra | Chưa chạy | — |
| APP-11 | P1 | council.demo; an.nv | SCN-P06/P07 | Xem trạng thái kết luận, người xử lý, ý kiến và lịch sử; đóng/mở popup | Đúng Đề nghị/Không đề nghị; không cho thao tác vượt bước; không mất bộ lọc | Chưa chạy | — |
| APP-12 | P0 | cuong.lh → council.demo → records.demo | SCN-PT01 hoặc đề nghị mới từ T02 | Xét đề nghị tập thể; sau kết luận tạo sổ tập thể và ghi nhận bằng quyết định mới | Từ đầu đến cuối giữ đúng Bộ môn KTPM; không gắn thưởng cho cá nhân Cường | Chưa chạy | — |

## 11. Quyết định và Khen thưởng

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AWD-01 | P0 | records.demo | Trang Khen thưởng | Tạo quyết định mã UI riêng; tạo nháp cho An; chọn nguồn và loại thưởng | Lưu đúng quyết định/chủ thể/nguồn; chọn bằng tên; không tự Ghi nhận | Chưa chạy | — |
| AWD-02 | P0 | records.demo | SCN-R01 thiếu file | Thử Ghi nhận; thêm decision-demo.pdf; thử lại | Chặn khi thiếu file; sau upload mới Ghi nhận được | Chưa chạy | — |
| AWD-03 | P1 | records.demo | Nháp/quyết định UI riêng | Upload tệp lỗi theo bộ file chuẩn bị; sau đó tải file hợp lệ đã lưu | Tệp lỗi bị chặn; tệp hợp lệ tải đúng nội dung/tên | Chưa chạy | — |
| AWD-04 | P0 | records.demo | SCN-R02 đã ghi nhận | Mở chi tiết; xem lịch sử/file; thử thay file/sửa nội dung đã khóa | Không sửa ngược quyết định đã dùng; tải được bản đang có | Chưa chạy | — |
| AWD-05 | P0 | records.demo | Sổ đã ghi nhận dùng riêng cho ca thu hồi | Thử Thu hồi thiếu lý do rồi nhập lý do; xem lịch sử | Lý do bắt buộc; Đã thu hồi, giữ quyết định/lịch sử; không xóa dấu vết | Chưa chạy | — |
| AWD-06 | P0 | records.demo | SCN-R03 đã thu hồi | Chuẩn bị bản thay thế; nhập quyết định mới; tạo nháp thay thế, upload và Ghi nhận | Bản mới liên kết bản cũ; không đổi trạng thái bản cũ; không đếm cả hai là hợp lệ | Chưa chạy | — |
| AWD-07 | P0 | records.demo | Có sổ UI đã tạo | Tạo lại cùng chủ thể–loại thưởng–quyết định | Báo trùng rõ ràng; không nhân đôi sổ | Chưa chạy | — |
| AWD-08 | P0 | an.nv; duc.pm | Không có role chuyên viên | Tìm menu Khen thưởng và mở URL trang qua thanh địa chỉ | Không quản lý sổ bằng vai trò không được phép; không lộ dữ liệu ngoài quyền | Chưa chạy | — |
| AWD-09 | P1 | records.demo | SCN-RT01 tập thể và R02 cá nhân | Chuyển lọc cá nhân/tập thể, đơn vị/năm/trạng thái; mở từng chi tiết | Không lẫn chủ thể; bảng/thẻ hiển thị đúng file, quyết định, loại thưởng | Chưa chạy | — |

## 12. Mục tiêu / KPI và nhập tệp

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| KPI-01 | P1 | an.nv | Trang KPI | Thiết lập mục tiêu mới UI-1910-KPI; nhập chỉ tiêu/kỳ/kế hoạch; lưu và F5 | Mục tiêu riêng tồn tại, đúng chủ thể, số lượng và thời gian | Chưa chạy | — |
| KPI-02 | P1 | an.nv | Form KPI | Thiếu mã/tên; số không hợp lệ; kỳ ngược; mã trùng | Không lưu dữ liệu sai; giữ nội dung để sửa; lỗi dễ hiểu | Chưa chạy | — |
| KPI-03 | P1 | an.nv | SCN-K01 chưa chấp nhận | Sửa mục tiêu; Chấp nhận; tải lại | Trạng thái và giới hạn sửa đúng; không tự tạo thành tích | Chưa chạy | — |
| KPI-04 | P0 | an.nv | SCN-K02 đã chấp nhận | Ghi kết quả thực tế; đối chiếu tiến độ/chỉ tiêu; sửa kết quả nếu UI cho phép | Số liệu đúng đơn vị và nguồn; không biến kế hoạch thành thành tích đã xác nhận | Chưa chạy | — |
| KPI-05 | P0 | an.nv | SCN-K03 có kết quả | Chọn loại thành tích; tạo nháp từ kết quả; mở nháp ở Thành tích; bấm lại | Chỉ tạo nháp đúng chủ thể, không tự duyệt; không nhân đôi ngoài ý muốn | Chưa chạy | — |
| KPI-06 | P0 | cuong.lh; rep.expired | SCN-KT01 | Cường chuyển Cá nhân/Đơn vị tôi đại diện, xem kết quả tập thể; người hết hạn thử thao tác | Tách cá nhân/KTPM; đại diện hết hạn không được quản lý mục tiêu tập thể | Chưa chạy | — |
| KPI-07 | P1 | an.nv | Có file mẫu từ UI | Tải mẫu CSV; chọn file hợp lệ; Kiểm tra trước khi nhập; nhập; tải lại danh sách | Xem được preview; chỉ ghi khi xác nhận; mục tiêu nhập đủ và không nhân đôi khi bấm lặp | Chưa chạy | — |
| KPI-08 | P1 | an.nv | kpi-invalid.csv; file thiếu cột | Kiểm tra dữ liệu sai; thử nhập lại; dùng file Excel hợp lệ theo mẫu nếu có | Chỉ rõ dòng/cột sai; không âm thầm nhập dữ liệu lỗi; Excel đọc đúng kiểu ngày/số | Chưa chạy | — |
| KPI-09 | P1 | an.nv; cuong.lh | Có phiên AI mô phỏng đúng chủ thể | Mở gợi ý KPI, chọn phiên; thử chấp nhận/từ chối gợi ý khi đủ điều kiện | Gắn nhãn nguồn; chỉ tạo mục tiêu sau người dùng chấp nhận; không lấy phiên của người khác; thiếu provider ghi Bị chặn | Chưa chạy | — |
| KPI-10 | P1 | duc.pm → an.nv | Nguồn KPI đã cấu hình riêng | Admin ánh xạ mã nhân viên, đồng bộ qua nút UI, đồng bộ lại; An xem và tạo nháp từ nguồn hợp lệ | Có lịch sử nguồn; không trùng khi đồng bộ lại; chưa ánh xạ/chưa FINAL không thành thành tích; thiếu cấu hình ghi Bị chặn | Chưa chạy | — |

## 13. Kho quy định và tiêu chí

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REG-01 | P1 | an.nv | Nguồn nền và SCN-REGULATION | Chuyển tab văn bản, phiên bản, trích đoạn, tiêu chí; lọc/tìm | Hiện đúng dữ liệu; phân biệt nguồn chính thức/chưa duyệt/mô phỏng | Chưa chạy | — |
| REG-02 | P1 | duc.pm | Tạo văn bản mô phỏng UI riêng | Thêm văn bản mới, cơ quan, mã và loại; lưu; thử mã trùng | Lưu được bản mới; mã trùng báo lỗi; không đổi nguồn nền | Chưa chạy | — |
| REG-03 | P1 | duc.pm | Văn bản UI riêng | Thêm v1, trích đoạn; thêm v2 và thời gian hiệu lực; xem lại v1 | Lịch sử phiên bản không mất; không ghi đè nội dung cũ; mốc hiệu lực hợp lệ | Chưa chạy | — |
| REG-04 | P1 | duc.pm | Có phiên bản/trích đoạn UI riêng | Tạo tiêu chí, chọn nguồn/đoạn liên quan; thiếu trường rồi bổ sung | Tiêu chí liên kết đúng văn bản, phiên bản; kiểm trường bắt buộc | Chưa chạy | — |
| REG-05 | P0 | duc.pm | Chỉ văn bản mô phỏng UI riêng | Kiểm luồng xác nhận/thu hồi xác nhận có căn cứ; thử trạng thái không hợp lệ | Có kiểm soát và lịch sử; không tự gắn nhãn Chính sách LHU chính thức cho nguồn giả | Chưa chạy | — |
| REG-06 | P0 | an.nv | Người dùng chỉ đọc | Tìm nút sửa/xác nhận văn bản/tiêu chí; thử mở các form có thể nhìn thấy | Không có thao tác quản trị trái quyền; nguồn không thay đổi | Chưa chạy | — |
| REG-07 | P1 | an.nv | SCN-CRIT-01 và SCN-CRIT-DRAFT | So sánh nhãn nguồn, trạng thái xác nhận và danh sách tiêu chí được chọn bên AI | Tiêu chí chưa xác nhận không được chọn để thẩm định như hợp lệ; tiêu chí demo không biến thành chính sách thật | Chưa chạy | — |

## 14. Phân tích & Thẩm định AI

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-01 | P1 | an.nv; cuong.lh | Hai phiên seed | Lịch sử Phiên AI → mở từng phiên đúng chủ thể; xem nguồn/kết luận | Đọc được kết quả mô phỏng; An và tập thể Cường không bị lẫn dữ liệu | Chưa chạy | — |
| AI-02 | P0 | an.nv | Tab thẩm định | Thử chạy chưa chọn tiêu chí; chọn SCN-CRIT-01 và chủ thể cá nhân; chạy qua UI | Chặn đầu vào thiếu; khi chạy được phải ghi đúng nguồn mô phỏng/provider; không khẳng định đạt thưởng thật | Chưa chạy | — |
| AI-03 | P0 | cuong.lh; rep.expired | Thẩm định tập thể | Chọn Bộ môn KTPM; thử đơn vị ngoài phân công và đại diện hết hạn | Chỉ dữ liệu/phạm vi được phép; không dùng role để vượt phân công | Chưa chạy | — |
| AI-04 | P1 | an.nv | Có phiên đánh giá; có thể thay dữ liệu nguồn qua UI | Mở phiên; Kiểm tra dữ liệu cũ; sửa nguồn bằng UI khi được phép; kiểm lại | Hiển thị tính cũ/mới trung thực; không âm thầm cập nhật kết quả lịch sử | Chưa chạy | — |
| AI-05 | P1 | an.nv | Provider và nguồn hợp lệ nếu có | Bấm giải thích tiêu chí/trích dẫn; mở nguồn/đoạn được trích | Trích dẫn mở đúng nguồn; không dùng văn bản chưa xác nhận làm căn cứ chính thức; thiếu cấu hình ghi Bị chặn | Chưa chạy | — |
| AI-06 | P1 | Người được phép | Provider không hoạt động hoặc trình duyệt Offline | Bấm chạy, quan sát lỗi, sau đó khôi phục và thử lại | Lỗi rõ; thoát loading; không lưu/báo kết quả giả; dữ liệu nhập còn dùng được | Chưa chạy | — |
| AI-07 | P2 | an.nv | Tab 12 Hồ sơ Thử nghiệm | Chọn các hồ sơ minh họa và xem kết quả | Có nhãn dữ liệu thử nghiệm; không nhập nhầm thành hồ sơ thật của tài khoản | Chưa chạy | — |

## 15. Báo cáo và xuất CSV

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REP-01 | P0 | bich.tt | Seed hoặc luồng chính đã ghi nhận | Lọc nguồn Thành tích/Khen thưởng, cá nhân/tập thể, đơn vị, loại, năm | Thống kê và danh sách cùng bộ lọc; không tính hồ sơ hủy/thu hồi là hợp lệ | Chưa chạy | — |
| REP-02 | P0 | an.nv; bich.tt; linh.pharm | Ba phạm vi khác nhau | Mở Báo cáo từng tài khoản và chọn các đơn vị có thể thấy | Không lộ dữ liệu ngoài phạm vi; tên đơn vị/chủ thể rõ ràng | Chưa chạy | — |
| REP-03 | P1 | bich.tt; records.demo; cuong.lh; duc.pm | Vai trò có quyền xuất | Chọn bộ lọc có kết quả; Xuất Báo Cáo CSV; mở file bằng ứng dụng bảng tính | File đọc được tiếng Việt, tiêu đề và số liệu; không xuất khác bộ lọc hoặc lẫn dữ liệu ngoài quyền | Chưa chạy | — |
| REP-04 | P0 | an.nv | Giảng viên thuần role | Mở Báo cáo, tìm nút xuất | Có thể xem đúng quyền nhưng không xuất nếu role hiện không được phép; UI không mời thao tác rồi lỗi bất ngờ | Chưa chạy | — |
| REP-05 | P1 | bich.tt | Có bộ lọc không có dữ liệu | Lọc năm/loại không có; áp dụng rồi xóa lọc | Hiện rỗng/0 đúng, không giữ số liệu cũ gây nhầm | Chưa chạy | — |
| REP-06 | P0 | bich.tt | Một sổ/thành tích riêng vừa được thu hồi | Làm mới báo cáo sau thao tác; đối chiếu danh sách và CSV | Số hợp lệ cập nhật; bản thu hồi không tiếp tục được tính | Chưa chạy | — |

## 16. Tổ chức và phân công

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ORG-01 | P1 | bich.tt; cuong.lh; an.nv | Trang Tổ chức | Xem cơ cấu; chọn Khoa/Bộ môn theo quyền; xem danh sách đại diện/giảng viên | Cơ cấu cha–con đúng; đọc hồ sơ theo quyền; giảng viên không được mặc định xem mọi dữ liệu đơn vị | Chưa chạy | — |
| ORG-02 | P0 | bich.tt | Khoa Dược ngoài phạm vi | Thử chọn Khoa Dược và mở thông tin nếu UI cho chọn | Không hiển thị hồ sơ ngoài quyền; thông báo/khóa thao tác rõ | Chưa chạy | — |
| ORG-03 | P1 | duc.pm | Đơn vị UI mới | Tạo đơn vị con, sửa tên/mô tả; F5; thử mã trùng | Đúng cha–con, mã không trùng; dữ liệu lưu được | Chưa chạy | — |
| ORG-04 | P0 | duc.pm | Đơn vị/tài khoản UI riêng | Phân công đại diện có hạn; đăng nhập tài khoản được giao; tạo tập thể đúng đơn vị | Chỉ có quyền trong thời gian/phạm vi được giao; lựa chọn UI cập nhật sau đăng nhập/làm mới | Chưa chạy | — |
| ORG-05 | P0 | duc.pm | Giảng viên UI riêng, không dùng An/Cường | Chuyển giảng viên giữa hai đơn vị; xem quá trình công tác trước/sau | Lưu lịch sử, không làm sai hồ sơ cũ; quyền và đơn vị hiện tại cập nhật đúng | Chưa chạy | — |
| ORG-06 | P1 | duc.pm | Đơn vị UI trống và đơn vị đã dùng | Thử xóa, hủy xác nhận; xóa đơn vị trống; thử xóa đơn vị có ràng buộc | Hủy thì giữ; không làm mất dữ liệu tham chiếu của đơn vị đã sử dụng | Chưa chạy | — |
| ORG-07 | P0 | an.nv | Người không quản trị | Tìm nút tạo/sửa/xóa/chuyển giảng viên/phân công | Không có thao tác quản trị tổ chức trái quyền | Chưa chạy | — |

## 17. Quản trị tài khoản và danh mục — chạy cuối

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADM-01 | P0 | duc.pm | Trang Quản trị | Tạo tài khoản UI riêng; thử trùng username/email, mật khẩu ngắn; nhập hợp lệ rồi đăng nhập | Ca sai báo lỗi; ca đúng có tài khoản dùng được, không tự có role/phạm vi ngoài ý định | Chưa chạy | — |
| ADM-02 | P0 | duc.pm | Tài khoản UI riêng | Gán vai trò, phạm vi đơn vị và thời hạn; đăng nhập tài khoản đó | Quyền thực tế đúng cả role và phạm vi; không chỉ đổi nhãn menu | Chưa chạy | — |
| ADM-03 | P0 | duc.pm | Tài khoản UI riêng đang đăng nhập cửa sổ khác | Khóa tài khoản; cửa sổ kia tiếp tục thao tác; mở lại và đăng nhập | Tài khoản khóa không tiếp tục đọc/ghi riêng; mở khóa cho đăng nhập hợp lệ | Chưa chạy | — |
| ADM-04 | P0 | duc.pm | Vai trò/phạm vi UI riêng | Thu hồi role hoặc phạm vi; đăng nhập lại, thử trang/thao tác cũ | Không còn quyền cũ; dữ liệu đã tạo không bị mất sai cách | Chưa chạy | — |
| ADM-05 | P1 | duc.pm | Danh mục UI riêng | Thêm/sửa loại thành tích và loại thưởng; chọn đối tượng cá nhân/tập thể; thử mã trùng/ẩn | Tên và đối tượng đúng khi kê khai; mã trùng bị chặn; danh mục ẩn không còn được chọn cho hồ sơ mới | Chưa chạy | — |
| ADM-06 | P1 | duc.pm | Năm học UI riêng | Tạo/sửa ngày đầu/cuối, năm hiện tại; thử khoảng ngày sai và xóa danh mục đã dùng | Không có khoảng ngày sai/hai năm hiện tại trái quy tắc; không phá hồ sơ tham chiếu | Chưa chạy | — |
| ADM-07 | P0 | an.nv; council.demo | Không có ADMIN | Gõ URL trang Quản trị trên thanh địa chỉ; dùng Back/Forward | Không xem/sửa được dữ liệu quản trị; không chỉ ẩn menu nhưng vẫn mở trang được | Chưa chạy | — |

## 18. Thông báo và bảo vệ dữ liệu qua UI

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NOTI-01 | P1 | an.nv; bich.tt | Có thay đổi trạng thái do luồng chính | Mở chuông sau gửi/yêu cầu bổ sung/xác nhận; đọc từng dòng | Thông báo đúng người và hồ sơ; không trùng bất thường | Chưa chạy | — |
| NOTI-02 | P1 | an.nv | Có thông báo chưa đọc | Chỉ chưa đọc; đánh dấu đã đọc; phân trang; F5 | Số chưa đọc/bộ lọc/trạng thái đúng; trang trước/sau hoạt động | Chưa chạy | — |
| NOTI-03 | P0 | an.nv → linh.pharm | An có thông báo và file riêng | Đăng xuất, đăng nhập Linh; mở chuông; mở URL file đã sao chép từ lượt tải của An | Không thấy thông báo/file riêng của An; thông báo từ chối rõ | Chưa chạy | — |
| NOTI-04 | P0 | Không đăng nhập | Đã sao chép URL file tải từ UI | Mở URL file trong cửa sổ ẩn danh chưa đăng nhập | Không tải được file private; không lộ nội dung dù biết đường dẫn | Chưa chạy | — |
| NOTI-05 | P1 | an.nv | Popup thông báo mở | Bấm ngoài/Esc; chuyển trang; mở lại; đăng xuất | Không kẹt lớp phủ, số đếm hoặc dữ liệu của phiên trước | Chưa chạy | — |

## 19. Trải nghiệm, lỗi mạng và tính nhất quán

| ID | Ưu tiên | Tài khoản | Điều kiện | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX-01 | P1 | an.nv; duc.pm; records.demo | Mobile 390 và 360 px | Mở các trang, menu di động, form/popup, lịch, bảng, phân trang | Không tràn ngang mất nút; thao tác chính bấm được; menu không che nội dung cuối | Chưa chạy | — |
| UX-02 | P2 | an.nv | Giao diện tối/sáng | Đổi theme trên các trang; mở dropdown và popup | Chữ/nền đủ rõ; trạng thái hiện tại, lỗi và nút disabled phân biệt được | Chưa chạy | — |
| UX-03 | P1 | an.nv | Dùng bàn phím | Tab/Shift+Tab, Enter/Space, Esc ở lịch, popup thành tích và chọn tên | Có focus rõ; focus bị giữ trong popup; đóng trả đúng chỗ; không bắt buộc dùng chuột | Chưa chạy | — |
| UX-04 | P1 | an.nv | Dữ liệu có tên/ghi chú dài | Nhập tiếng Việt dấu, xuống dòng, tên tệp dài; zoom 200% | Không mất chữ/ký tự; nội dung xuống dòng; không che nút đóng/lưu | Chưa chạy | — |
| UX-05 | P0 | an.nv | Form nháp cá nhân/lịch đang sửa | Chuyển trình duyệt Offline rồi bấm lưu; Online và thử lại | Báo lỗi thật, không báo thành công; giữ nội dung để thử lại; không nhân đôi khi thành công | Chưa chạy | — |
| UX-06 | P1 | an.nv | Màn hình danh sách chưa tải xong | Chuyển nhanh tab/bộ lọc/chủ thể; mở/đóng chi tiết liên tục | Loading kết thúc; kết quả cuối đúng lựa chọn mới nhất, không hiện nhầm hồ sơ trước | Chưa chạy | — |
| UX-07 | P0 | Người có thao tác ghi | Nháp UI riêng | Bấm nhanh hai lần Lưu/Gửi/Ghi nhận trong lúc đang xử lý | Nút khóa hoặc thao tác chỉ ghi một lần; không trùng, không nhảy sai trạng thái | Chưa chạy | — |
| UX-08 | P1 | an.nv | Bộ lọc và chi tiết đang mở | Back/Forward/F5, mở link trang không tồn tại từ thanh địa chỉ | Điều hướng đúng; có trang 404 rõ; không màn hình trắng hoặc vòng lặp chuyển trang | Chưa chạy | — |
| UX-09 | P1 | an.nv → bich.tt → council.demo | Kiểm lại hồ sơ sau mỗi bước | Đối chiếu tiêu đề, chủ thể, loại, file, trạng thái giữa danh sách, popup, hồ sơ, báo cáo | Các màn hình không mâu thuẫn; Làm mới hiển thị dữ liệu mới, không dữ liệu cache của người trước | Chưa chạy | — |

## 20. Các điểm nên soi kỹ trong vòng đầu

Đây là **rủi ro cần xác minh**, chưa phải bug đã tái hiện trong đợt này:

1. Ba lối tắt trang chủ có thể không phù hợp mọi role (ví dụ admin không có quyền Hồ sơ đề nghị, chuyên viên không có quyền KPI cá nhân).
2. Ô tìm kiếm trang chủ và các tỷ lệ/gợi ý trên dashboard: kiểm chức năng thật và nhãn mô phỏng; không mặc định đã tích hợp vì nhìn giống ô có thể dùng.
3. Nhóm Nghiên cứu/Giảng dạy hiện liên quan mã loại: loại mới do Admin tạo có được nhóm đúng không; chưa có cấu hình nhóm rõ thì ghi yêu cầu cải tiến thay vì tự gán theo tên.
4. Seed chỉ có ít loại thành tích và số hồ sơ riêng của An chưa đủ hai trang; phải tạo thêm qua UI cho PORT-02/PORT-07, không đánh dấu không có bug chỉ vì chưa xuất hiện phân trang.
5. Form tạo thành tích/đề nghị và popup hồ sơ: kiểm thao tác chuyển trang/đóng khi đang có nội dung chưa lưu.
6. Phân biệt nơi công tác của Cường (KHMT) với quyền đại diện (KTPM); tránh lựa chọn mặc định sai chủ thể.
7. Hội đồng có phạm vi nhưng chưa được giao P04: quyền đọc và quyền kết luận phải khác nhau.
8. Gửi bổ sung đề nghị hiện là chuyển trạng thái kèm ý kiến, không phải màn hình cho tự do sửa toàn bộ nguồn đã nộp. Ghi nhận nếu hướng dẫn UI làm người dùng hiểu sai.
9. Nhãn dữ liệu mô phỏng/quy chế chưa xác nhận không được mất khi chuyển từ Kho quy định sang AI/KPI/Báo cáo.
10. Xuất CSV của giảng viên thuần role hiện không được cho phép; không dùng quyền của Bích để kết luận An đã xuất được.

## 21. Thứ tự chạy và điều kiện kết thúc

1. Vòng 1: AUTH-01/02/04/05 → HOME-01/02/06 → FLOW-01…15 → các ca P0 về sai quyền. Nếu luồng chính bị chặn, dừng phần phụ thuộc, ghi bug và chạy các nhóm độc lập.
2. Vòng 2: các nhánh thành tích/đề nghị/khen thưởng còn lại; popup/phân trang hồ sơ; lịch và KPI.
3. Vòng 3: quy định, AI, báo cáo, tổ chức. Nhánh provider/nguồn ngoài thiếu cấu hình ghi Bị chặn, không đánh dấu Đạt bằng dữ liệu mock.
4. Vòng 4: quản trị tài khoản/phạm vi/danh mục trên dữ liệu UI riêng; mobile/dark mode/keyboard/lỗi mạng.
5. Khi sửa bug: chạy lại ca lỗi + ca liên quan cùng flow + một lượt luồng chính nếu sửa trạng thái, phân quyền hoặc dữ liệu liên kết.

Đợt test hoàn tất khi toàn bộ P0 đã chạy và đạt, không còn lỗi nghiêm trọng về sai quyền/mất dữ liệu/sai ghi nhận; P1/P2 chưa xong và các ca bị chặn có danh sách rõ để chốt tiếp. Không gộp ca chưa chạy/bị chặn vào tỷ lệ Đạt.

## 22. Mẫu ghi lỗi

```text
Mã bug: BUG-UI-001
Ca test liên quan:
Tiêu đề:
Mức độ: Nghiêm trọng / Cao / Trung bình / Thấp
Môi trường: URL UI, commit, trình duyệt, kích thước màn hình
Tài khoản/vai trò:
Dữ liệu: mã SCN hoặc UI-1910, trạng thái trước thao tác
Các bước tái hiện:
1.
2.
3.
Mong đợi:
Thực tế:
Ảnh/video/file tải về:
Tần suất: luôn xảy ra / thỉnh thoảng
Người phát hiện, ngày:
Trạng thái xử lý: Mới / Đang sửa / Chờ test lại / Đã đóng
Kết quả test lại:
```

## 23. Cấu trúc Excel sau khi duyệt

Chưa xuất Excel trong bước này. Dự kiến các sheet: **Tổng quan**, **Tài khoản & dữ liệu**, **Test cases UI**, **Kết quả chạy**, **Bug log**. Giữ nguyên ID ca; thêm cột người test, ngày chạy, kết quả thực tế và link bằng chứng. Dashboard tổng hợp chỉ dùng kết quả đã ghi, không tự gắn PASS.

Tham chiếu kịch bản gốc: [README SCN](scenario/README.md). Biên bản reset đợt này: [Reset 19/10/2026](scenario/RESET_2026-10-19.md).
