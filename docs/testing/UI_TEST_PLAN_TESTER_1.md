# Bộ test UI riêng — Người test 1

File mẫu, dữ liệu copy và thứ tự seed: [bộ chuẩn bị hai người](kits/README.md). Khi nhận ZIP, mở README rồi 04_RUN_ORDER.md.

Ngày chia: **19/10/2026**. Môi trường bắt buộc: **ENV-T1**. Chỉ chạy **72 ca** trong file này; không cần đọc bộ ca của người kia để hoàn thành việc của mình.

**Tình trạng:** mới chia kế hoạch; chưa tạo môi trường thứ hai, chưa reset database và chưa chạy các ca trong lượt chia này.

| Thông tin lượt chạy | Điền trước khi bắt đầu |
| --- | --- |
| Người test | … |
| URL UI của ENV-T1 | … |
| Commit / ngày seed | … |
| Lượt chạy | R01; nếu reset dùng R02, R03… |
| Prefix dữ liệu tự tạo | UI-T1-R01- |
| Prefix bug / bằng chứng | BUG-T1-…; thư mục T1/R01/ |
| Số ca | 72; 38 P0, 33 P1, 1 P2 |

Bạn phụ trách **luồng đề nghị–Hội đồng–ghi nhận đầu/cuối**, các nhánh đề nghị/khen thưởng, trang chủ, lịch, hồ sơ năng lực, thông báo và một phần phiên đăng nhập. Tự đổi tất cả vai trò trong ENV-T1.

**Thứ tự đề xuất:**

1. AUTH/HOME để kiểm phiên và điều hướng.
2. FLOW-01…15 liền mạch trên A01, từ đầu đến cuối do một mình bạn thao tác; không giao bước cho người 2.
3. APP rồi AWD trên các hồ sơ SCN đã dành sẵn; không dùng sổ MAIN để thu hồi.
4. CAL rồi PORT; tự tạo thêm nháp để đủ hai trang và đủ ba loại khi cần.
5. NOTI; các thông báo sinh ra từ flow của chính ENV-T1.

Nếu FLOW bị lỗi giữa chừng, bạn vẫn có thể chuyển sang các nhánh P01…P07, R01…R03, CAL hoặc PORT trên chính ENV-T1; không chờ người 2.

## Điều kiện để bắt đầu, không chờ người còn lại

Hai môi trường phải được chuẩn bị **trước giờ hai người bắt đầu test**. Đây là bước setup của người phụ trách môi trường, không phải việc giao cho một tester làm rồi người kia đợi.

- Một UI riêng phải nối đúng backend/database riêng; hai UI cùng trỏ một database **không** được coi là đã tách.
- Tách toàn bộ dữ liệu app, tài khoản/phiên, danh mục/quy chế, file private và trạng thái nguồn KPI thử nghiệm. Không chỉ đổi tên hồ sơ hay thêm prefix.
- Dùng cùng commit, cùng cấu hình chức năng và cùng bản seed SCN, ngày seed gần nhau. Tài khoản có thể trùng tên giữa hai môi trường nhưng phải là hai bản dữ liệu độc lập.
- Tài khoản, kỳ mở/đóng, các SCN ở đúng trạng thái, file mẫu tải được và vai trò/phạm vi đủ sẵn sàng. Lịch cá nhân bắt đầu trống.
- Mỗi người giữ các hồ sơ trình duyệt riêng cho các vai trò. Một người tự đóng vai An, Bích, Hội đồng, Văn thư khi cần; không giao bước kế tiếp cho tester kia.
- Người phụ trách cung cấp đủ thông tin trước khi chạy: URL UI, mã môi trường, commit, ngày seed và nơi nhận bằng chứng. Nếu chưa đủ thì môi trường chưa sẵn sàng; không giả định hệ thống đã có sẵn hai bản.
- AI/nguồn ngoài thiếu căn cứ/cấu hình thì ghi Bị chặn rồi chuyển ca độc lập khác. Không đợi tester kia xác nhận văn bản, tạo phiên AI hoặc đồng bộ nguồn.
- Provider AI dùng chung quota có thể ảnh hưởng nhau. Nên có quota/test credential độc lập; nếu không có thì các ca phụ thuộc provider không thuộc cam kết độc lập hoàn toàn và phải ghi rõ Bị chặn khi giới hạn nguồn chung xảy ra.

## Quy tắc dữ liệu trong môi trường của mình

- Không truy cập hoặc thay đổi môi trường của người kia. Không dùng chung URL đăng nhập, cookie/localStorage, thư mục tải file hoặc thư mục lưu file private.
- Không reset môi trường trong lúc còn ca đang mở. Nếu cần reset bản của mình, kết thúc phiên, ghi rõ lượt chạy mới và chỉ reset đúng môi trường của mình.
- Seed chỉ là điểm bắt đầu. Mỗi ca cần trạng thái riêng thì tự tạo hồ sơ mới bằng UI hoặc dùng đúng mã SCN được dành riêng, không đảo trạng thái bằng database.
- Các ca cần nhiều role do chính mình đổi role. Ca xung đột phiên bản dùng hai tab/cửa sổ của mình, không cần người còn lại cùng thao tác.
- Không sửa/khóa tài khoản seed hoặc sửa danh mục nền khi chưa xong các ca cần baseline. Dùng tài khoản/danh mục có prefix riêng; ngoại lệ chuyển Linh/năm hiện tại nếu có được đẩy xuống cuối.
- Các ca kiểm một nhóm chức năng và các bước chuẩn bị có thể cùng dùng thao tác thêm/sửa, nhưng **mỗi ID ca chỉ có một người chịu trách nhiệm nghiệm thu**. Không copy ca của người kia vào kết quả của mình.
- Test thuần UI: form, nút, tải tệp, mở URL trên thanh địa chỉ, F5, hai tab, chế độ Offline trình duyệt. Không dùng Postman/gọi API/SQL để vượt bước bị lỗi.

## Tài khoản sẵn có trên bản seed của mình

Mật khẩu demo: **demo1234**; locked.demo cố ý bị khóa. Mỗi tài khoản dưới đây tồn tại độc lập trên từng môi trường.

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

## Dữ liệu seed để tự chọn, không cần người kia cấp

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

File dùng để upload: evidence-demo.pdf, decision-demo.pdf, kpi-valid.csv, kpi-invalid.csv trong ../../docs/testing/scenario/fixtures. Tải mẫu KPI hiện tại bằng nút trên UI nếu kiểm nhập Excel/CSV. Tạo thêm tệp rỗng/.txt/>10MB/giả đuôi PDF trên máy cho các ca âm tính.

## Cách ghi kết quả

- Chưa chạy / Đạt / Lỗi / Bị chặn / Không áp dụng; không gộp Chưa chạy hoặc Bị chặn vào Đạt.
- Mỗi lỗi ghi ID ca, môi trường, tài khoản, trạng thái dữ liệu trước thao tác, bước tái hiện, mong đợi/thực tế, ảnh/video và thời gian.
- Lỗi nghiêm trọng trong một flow chỉ chặn phần phụ thuộc của **chính mình**. Chuyển sang nhóm độc lập; không chờ người kia test hoặc sửa xong.
- Các ca bắt buộc thao tác tuần tự trong một workflow vẫn giữ thứ tự nghiệp vụ. Không có cam kết các bước của cùng một workflow chạy đồng thời.
- Kiểm AI trước đây chỉ là tham chiếu; không mang kết quả Đạt ở môi trường cũ sang lượt chạy này. Xem AI_INTEGRATION_CHECK_2026-10-19.md, đặc biệt lỗi lịch sử N/A và chủ thể #.

## Các ca được giao — đầy đủ bước và kết quả mong đợi

### Đăng nhập và phiên (4 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-03 | P1 | Bất kỳ | Trang đăng nhập | Bỏ trống từng trường; bật/tắt hiện mật khẩu; chọn nhanh từng tài khoản demo | Chặn trường bắt buộc; mật khẩu ẩn/hiện đúng; nút demo điền đúng username/pass | Chưa chạy | — |
| AUTH-04 | P0 | an.nv | Có phiên đăng nhập | Tải lại trang; mở tab mới cùng trình duyệt; chuyển trang | Khôi phục đúng tài khoản; không nháy dữ liệu tài khoản khác hoặc kẹt loading | Chưa chạy | — |
| AUTH-06 | P1 | an.nv | Chạy hai lượt | Đăng nhập có/không Ghi nhớ phiên; đóng mở trình duyệt và kiểm lại | Hành vi giữ phiên đúng lựa chọn và cấu hình hiện tại; không tự chuyển tài khoản | Chưa chạy | — |
| AUTH-08 | P2 | Không đăng nhập | Giao diện có Đăng ký/Quên mật khẩu | Mở các chức năng mà UI cho phép; nhập dữ liệu | Nếu là mô phỏng phải ghi rõ; không báo đã tạo tài khoản/gửi email thật khi chưa có chức năng | Chưa chạy | — |

### Trang chủ và điều hướng (6 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HOME-01 | P1 | an.nv | Trang chủ | Bấm ba lối tắt Thành tích, Hồ sơ đề nghị, Mục tiêu / KPI; Back sau từng lần | Đến đúng trang; tên, mô tả và icon phù hợp; không còn cùng dẫn Hồ sơ năng lực | Chưa chạy | — |
| HOME-02 | P1 | duc.pm; records.demo | Trang chủ của từng role | Kiểm và bấm từng lối tắt; kiểm cả link logo | Lối tắt không đưa người dùng vào 404 do thiếu quyền; ẩn/khóa hoặc giải thích hợp lý khi không được phép | Chưa chạy | — |
| HOME-03 | P1 | an.nv | Có A01/A04 | Nhập tên/mã thành tích vào ô tìm kiếm trang chủ; Enter | Có kết quả hoặc chuyển sang danh sách có bộ lọc; nếu ô chỉ trang trí thì ghi thiếu chức năng | Chưa chạy | — |
| HOME-04 | P1 | an.nv; bich.tt | Biết các hồ sơ seed | Đối chiếu widget thống kê với Hồ sơ năng lực/Báo cáo cùng chủ thể | Dữ liệu thật khớp; widget mẫu có nhãn mô phỏng, không thể hiện số cố định như số liệu thật | Chưa chạy | — |
| HOME-05 | P1 | Từng role | Desktop | Hover và dùng bàn phím mở sidebar; chọn từng mục được phép | Tên đọc rõ; trang đang mở nổi bật; không có mục sai quyền hoặc bị che khuất | Chưa chạy | — |
| HOME-06 | P1 | council.demo | Đăng nhập Hội đồng | Kiểm trang mặc định, menu và icon lịch ở header | Mặc định Hồ sơ đề nghị; không bị ép vào trang chủ không có quyền; lịch vẫn mở được | Chưa chạy | — |

### Luồng đầu–cuối: một người tự đổi vai trò (15 ca)

FLOW-n chỉ phụ thuộc các bước FLOW trước đó trong **cùng ENV-T1 và cùng người test 1**. Dùng A01 và quyết định UI-T1-R01-MAIN-2026, không bàn giao sang người 2.

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FLOW-01 | P0 | an.nv | Seed mới; A01 nháp | Đăng nhập → Thành tích → tìm SCN-A01 → mở → gửi khi chưa thêm file | Báo thiếu minh chứng; vẫn nháp; không mất dữ liệu | Chưa chạy | — |
| FLOW-02 | P0 | an.nv | FLOW-01 | Sửa mô tả vai trò; thêm evidence-demo.pdf; tải lại file; gửi duyệt | File tải mở được; thành tích chuyển Chờ duyệt; có lịch sử/lần nộp | Chưa chạy | — |
| FLOW-03 | P0 | bich.tt | FLOW-02 | Mở hàng chờ thẩm định; tìm A01; yêu cầu bổ sung với lý do cụ thể | Chuyển Cần bổ sung; lý do và người xử lý được lưu | Chưa chạy | — |
| FLOW-04 | P0 | an.nv | FLOW-03 | Mở thông báo/lý do; sửa nội dung; tải phiên bản minh chứng mới; gửi lại | Lần nộp mới; phiên bản cũ còn tra cứu được; trở lại Chờ duyệt | Chưa chạy | — |
| FLOW-05 | P0 | bich.tt | FLOW-04 | Mở A01, kiểm thông tin và file; xác nhận | Thành tích Đã xác nhận; đúng người/thời điểm; khóa sửa trực tiếp | Chưa chạy | — |
| FLOW-06 | P0 | an.nv | FLOW-05; kỳ mở | Hồ sơ đề nghị → tạo cá nhân cho An; chọn loại thưởng, kỳ mở, A01; nhập UI-T1-R01-MAIN; lưu nháp rồi nộp | Nháp và lần nộp thành công; giữ đúng chủ thể, nguồn, loại thưởng; có lịch sử | Chưa chạy | — |
| FLOW-07 | P0 | bich.tt | FLOW-06 | Mở đề nghị UI-T1-R01-MAIN; xem nguồn/file; nhập ý kiến và Chuyển Hội đồng | Chờ Hội đồng; ý kiến đơn vị xuất hiện trong lịch sử | Chưa chạy | — |
| FLOW-08 | P0 | council.demo | FLOW-07 | Vào Hồ sơ đề nghị; mở hồ sơ; chọn council.demo trong danh sách người xét; Phân công có lý do | Đang xét duyệt; lưu người được giao; có thể ghi ý kiến | Chưa chạy | — |
| FLOW-09 | P0 | council.demo | FLOW-08 | Ghi ý kiến; chọn Đề nghị khen thưởng; nhập lý do | Trạng thái Đề nghị khen thưởng; chưa tự sinh quyết định/sổ thưởng | Chưa chạy | — |
| FLOW-10 | P0 | records.demo | FLOW-09 | Trong ENV-T1, tự đăng nhập records.demo → Khen thưởng → nhập quyết định UI-T1-R01-MAIN-2026, ngày hiện tại và cơ quan mô phỏng → tạo nháp sổ cho An đúng loại, liên kết A01 | Nháp sổ riêng; đúng chủ thể, nguồn và quyết định; không nhân đôi hồ sơ | Chưa chạy | — |
| FLOW-11 | P0 | records.demo | FLOW-10 | Thử Ghi nhận trước khi upload file quyết định | Bị chặn có giải thích; nháp còn nguyên | Chưa chạy | — |
| FLOW-12 | P0 | records.demo | FLOW-11 | Upload decision-demo.pdf vào quyết định; Ghi nhận; đóng/mở lại chi tiết | Đã ghi nhận; file tải được; lưu ngày/người ghi nhận và lịch sử | Chưa chạy | — |
| FLOW-13 | P0 | an.nv | FLOW-12 | Mở Hồ sơ năng lực; xem Nghiên cứu và Khen thưởng; mở popup thành tích | A01 ở đúng nhóm; khen thưởng mới có quyết định tương ứng; không gộp hai đối tượng | Chưa chạy | — |
| FLOW-14 | P0 | bich.tt | FLOW-12 | Báo cáo → chọn năm, Bộ môn KTPM và nguồn; áp dụng; xuất CSV bằng nút trên UI | Số liệu và CSV cùng bộ lọc; hồ sơ hợp lệ có trong kết quả; dữ liệu ngoài quyền không lẫn vào | Chưa chạy | — |
| FLOW-15 | P0 | an.nv, bich.tt | Các bước FLOW đã tạo thông báo | Kiểm chuông, số chưa đọc và thông báo liên quan; đánh dấu đã đọc rồi tải lại trang | Đúng người nhận và hồ sơ; số chưa đọc giảm đúng, trạng thái đã đọc được giữ | Chưa chạy | — |

### Đề nghị và Hội đồng (12 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
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

### Quyết định và Khen thưởng (9 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AWD-01 | P0 | records.demo | Trang Khen thưởng | Tạo quyết định mã UI riêng; tạo nháp cho An; chọn nguồn và loại thưởng | Lưu đúng quyết định/chủ thể/nguồn; chọn bằng tên; không tự Ghi nhận | Chưa chạy | — |
| AWD-02 | P0 | records.demo | SCN-R01 thiếu file | Thử Ghi nhận; thêm decision-demo.pdf; thử lại | Chặn khi thiếu file; sau upload mới Ghi nhận được | Chưa chạy | — |
| AWD-03 | P1 | records.demo | Nháp/quyết định UI riêng | Upload tệp lỗi theo bộ file chuẩn bị; sau đó tải file hợp lệ đã lưu | Tệp lỗi bị chặn; tệp hợp lệ tải đúng nội dung/tên | Chưa chạy | — |
| AWD-04 | P0 | records.demo | SCN-R02 đã ghi nhận | Mở chi tiết; xem lịch sử/file; thử thay file/sửa nội dung đã khóa | Không sửa ngược quyết định đã dùng; tải được bản đang có | Chưa chạy | — |
| AWD-05 | P0 | records.demo | Dùng SCN-R02 trong ENV-T1 hoặc sổ riêng do người 1 ghi nhận; dành riêng cho ca thu hồi, không dùng bản MAIN | Thử Thu hồi thiếu lý do rồi nhập lý do; xem lịch sử | Lý do bắt buộc; Đã thu hồi, giữ quyết định/lịch sử; không xóa dấu vết | Chưa chạy | — |
| AWD-06 | P0 | records.demo | SCN-R03 đã thu hồi | Chuẩn bị bản thay thế; nhập quyết định mới; tạo nháp thay thế, upload và Ghi nhận | Bản mới liên kết bản cũ; không đổi trạng thái bản cũ; không đếm cả hai là hợp lệ | Chưa chạy | — |
| AWD-07 | P0 | records.demo | Có sổ UI đã tạo | Tạo lại cùng chủ thể–loại thưởng–quyết định | Báo trùng rõ ràng; không nhân đôi sổ | Chưa chạy | — |
| AWD-08 | P0 | an.nv; duc.pm | Không có role chuyên viên | Tìm menu Khen thưởng và mở URL trang qua thanh địa chỉ | Không quản lý sổ bằng vai trò không được phép; không lộ dữ liệu ngoài quyền | Chưa chạy | — |
| AWD-09 | P1 | records.demo | SCN-RT01 tập thể và R02 cá nhân | Chuyển lọc cá nhân/tập thể, đơn vị/năm/trạng thái; mở từng chi tiết | Không lẫn chủ thể; bảng/thẻ hiển thị đúng file, quyết định, loại thưởng | Chưa chạy | — |

### Lịch cá nhân (12 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAL-01 | P1 | an.nv | Lịch trống sau reset | Mở lịch từ icon header rồi từ khung trang chủ; đóng mỗi lần | Cùng chức năng popup; mở được ở các trang; không thêm tab sidebar không cần thiết | Chưa chạy | — |
| CAL-02 | P1 | an.nv | Popup mở | Chuyển tháng trước/sau, tháng 12↔1, tháng 2 năm nhuận; chọn tháng/năm; Hôm nay | Đúng số ngày và thứ; Hôm nay chọn ngày hiện tại theo giờ Việt Nam | Chưa chạy | — |
| CAL-03 | P0 | an.nv | Chọn ngày bất kỳ | Thêm UI-T1-R01-CAL-01, đủ tiêu đề/giờ/địa điểm/ghi chú; lưu; F5; mở lại | Ghi chú còn nguyên; đúng ngày giờ, loại và tài khoản | Chưa chạy | — |
| CAL-04 | P1 | an.nv | Tạo dữ liệu riêng | Tạo từng loại Lịch thi, Cuộc thi, Công việc, Cá nhân; lọc từng loại | Màu/nhãn nhất quán; bộ lọc không làm mất bản ghi | Chưa chạy | — |
| CAL-05 | P1 | an.nv | Lịch có giờ | Sửa tiêu đề/ghi chú/giờ; lưu và mở lại | Nội dung cập nhật đúng một lịch; không sinh bản trùng | Chưa chạy | — |
| CAL-06 | P1 | an.nv | Chưa có lịch nhiều ngày | Tạo cả ngày; tạo qua hai ngày/cuối tháng; bấm từng ngày | Hiện trên đủ ngày trong khoảng; không lệch một ngày hoặc sai múi giờ | Chưa chạy | — |
| CAL-07 | P1 | an.nv | Có lịch cá nhân | Bỏ trống tên; nhập kết thúc trước bắt đầu; thử lưu | Chặn lưu, chỉ rõ lỗi; bản nháp và dữ liệu đã lưu không mất | Chưa chạy | — |
| CAL-08 | P1 | an.nv | Công việc quá hạn và chưa hoàn thành | Mở ngày; Hoàn thành; Mở lại; kiểm danh sách sắp tới và F5 | Nhãn quá hạn/hoàn thành đúng; trạng thái được lưu; lịch hoàn thành không bị coi còn việc phải làm | Chưa chạy | — |
| CAL-09 | P1 | an.nv | Có lịch riêng | Thử xóa rồi hủy xác nhận; xóa và đồng ý; F5 | Hủy thì giữ; đồng ý thì xóa đúng bản ghi; không ảnh hưởng sự kiện khác | Chưa chạy | — |
| CAL-10 | P0 | an.nv → bich.tt | An có CAL-01 | Đăng xuất An, đăng nhập Bích, mở cùng ngày; quay lại An | Bích không thấy/sửa lịch của An; An vẫn thấy đúng lịch riêng; sự kiện chung vẫn được thấy | Chưa chạy | — |
| CAL-11 | P1 | an.nv | Popup có form đang nhập | Đóng bằng ×, Esc, bấm nền: kiểm cả hủy và đồng ý bỏ; thử khi form chưa sửa | Có xác nhận khi bẩn; hủy giữ nội dung; đồng ý đóng; form sạch đóng trực tiếp | Chưa chạy | — |
| CAL-12 | P0 | an.nv | Hai tab cùng mở một lịch; có sự kiện chung | Tab 1 sửa/lưu, tab 2 lưu/xóa bản cũ; sau đó mở sự kiện hội đồng/hạn nộp mẫu | Báo xung đột thay vì ghi đè; tải lại được; sự kiện chung có nhãn Minh họa và chỉ xem | Chưa chạy | — |

### Hồ sơ năng lực và popup (9 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PORT-01 | P1 | an.nv | Hồ sơ năng lực | Sửa số điện thoại/chức danh/học vị; lưu; F5 | Lưu đúng trường được phép; không tự đổi đơn vị/quyền; không mất dữ liệu khác | Chưa chạy | — |
| PORT-02 | P1 | an.nv | Người 1 tự tạo ba nháp bằng UI trên ENV-T1: bài báo, sáng chế và giáo trình; không chờ ca ACH của người 2 | Chuyển Nghiên cứu khoa học, Giảng dạy, Khen thưởng, Minh chứng | Bài báo/sáng chế vào Nghiên cứu; giáo trình vào Giảng dạy; Khen thưởng lấy quyết định/sổ riêng | Chưa chạy | — |
| PORT-03 | P1 | an.nv | Danh sách dài | Bấm thẻ ở đầu/giữa/cuối danh sách | Popup mở ngay; rõ nội dung, trạng thái, loại, năm, minh chứng; không cần tìm phần chi tiết dưới danh sách | Chưa chạy | — |
| PORT-04 | P1 | an.nv | Popup mở | Đóng ×/Esc/nền ngoài; mở thành tích khác; dùng Tab/Shift+Tab | Đúng nội dung hồ sơ mới; focus không ra nền khi mở; đóng trở lại thẻ/vị trí cũ | Chưa chạy | — |
| PORT-05 | P1 | an.nv | Người 1 tự tạo nháp UI-T1-R01-PORT-UPLOAD qua nút Thêm thành tích; chưa gửi duyệt | Trong popup thêm file; lưu; tải file; đóng mở lại | Danh sách/số minh chứng cập nhật; tệp đúng; thành tích đã xác nhận không có nút thêm trái quyền | Chưa chạy | — |
| PORT-06 | P1 | an.nv | Dùng nháp PORT-UPLOAD của chính người 1, mở form Thêm minh chứng trong popup | Nhập tên/chọn file rồi đóng; hủy bỏ/đồng ý bỏ; thử lưu file lỗi | Không mất nội dung khi chọn giữ; lỗi ngay trong popup; không báo lưu thành công giả | Chưa chạy | — |
| PORT-07 | P1 | an.nv | Người 1 tự tạo thêm qua UI đến khi An có ít nhất 13 thành tích cùng nhóm trong ENV-T1; không đợi người 2 tạo | Tạo thêm nháp bằng UI đến đủ dữ liệu; bấm số trang 1/2, trước/sau; đổi bộ lọc | Trang hiện tại sáng; kết quả đúng trang; dấu … hợp lý khi đủ nhiều trang; đổi lọc về trang 1 | Chưa chạy | — |
| PORT-08 | P1 | an.nv | Có dữ liệu danh sách | Mở lọc, tìm tiêu đề/năm/loại/trạng thái; xóa lọc; thử từ khóa không có | Kết quả theo bộ lọc; trạng thái rỗng rõ; không còn thành tích ngoài nhóm | Chưa chạy | — |
| PORT-09 | P1 | an.nv | Popup bất kỳ | Bấm Xem hồ sơ đầy đủ; ở hồ sơ bấm thêm thành tích | Đúng hồ sơ tại trang Thành tích; nút thêm mở được form; không làm mất bản upload chưa lưu mà không hỏi | Chưa chạy | — |

### Thông báo và file private (5 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NOTI-01 | P1 | an.nv; bich.tt | Có thay đổi trạng thái do luồng chính | Mở chuông sau gửi/yêu cầu bổ sung/xác nhận; đọc từng dòng | Thông báo đúng người và hồ sơ; không trùng bất thường | Chưa chạy | — |
| NOTI-02 | P1 | an.nv | Có thông báo chưa đọc | Chỉ chưa đọc; đánh dấu đã đọc; phân trang; F5 | Số chưa đọc/bộ lọc/trạng thái đúng; trang trước/sau hoạt động | Chưa chạy | — |
| NOTI-03 | P0 | an.nv → linh.pharm | An có thông báo và file riêng | Đăng xuất, đăng nhập Linh; mở chuông; mở URL file đã sao chép từ lượt tải của An | Không thấy thông báo/file riêng của An; thông báo từ chối rõ | Chưa chạy | — |
| NOTI-04 | P0 | Không đăng nhập | Đã sao chép URL file tải từ UI | Mở URL file trong cửa sổ ẩn danh chưa đăng nhập | Không tải được file private; không lộ nội dung dù biết đường dẫn | Chưa chạy | — |
| NOTI-05 | P1 | an.nv | Popup thông báo mở | Bấm ngoài/Esc; chuyển trang; mở lại; đăng xuất | Không kẹt lớp phủ, số đếm hoặc dữ liệu của phiên trước | Chưa chạy | — |

## Hoàn thành phần của mình

- Đã xử lý đủ 72 ca được giao, trạng thái rõ ràng và có bằng chứng cho ca lỗi/P0.
- Không còn lỗi nghiêm trọng chưa phân loại về sai quyền, mất dữ liệu hoặc ghi nhận sai; ca Bị chặn nêu lý do và điều kiện cần có.
- Gửi file kết quả/bug của ENV-T1; chưa cần chờ người kia để kết thúc phần việc của mình.
- Chỉ ghép báo cáo toàn đợt khi nhận đủ hai bộ; đó là tổng hợp kết quả, không phải điều kiện để một người bắt đầu/chạy ca.

[Phân công tổng thể](UI_TEST_PLAN_PARALLEL.md) · [Danh mục 145 ca gốc](UI_TEST_PLAN.md). Chưa xuất Excel trong bước này.
