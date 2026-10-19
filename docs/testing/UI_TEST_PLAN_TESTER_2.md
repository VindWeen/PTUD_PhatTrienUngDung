# Bộ test UI riêng — Người test 2

Ngày chia: **19/10/2026**. Môi trường bắt buộc: **ENV-T2**. Chỉ chạy **73 ca** trong file này; không cần đọc bộ ca của người kia để hoàn thành việc của mình.

**Tình trạng:** mới chia kế hoạch; chưa tạo môi trường thứ hai, chưa reset database và chưa chạy các ca trong lượt chia này.

| Thông tin lượt chạy | Điền trước khi bắt đầu |
| --- | --- |
| Người test | … |
| URL UI của ENV-T2 | … |
| Commit / ngày seed | … |
| Lượt chạy | R01; nếu reset dùng R02, R03… |
| Prefix dữ liệu tự tạo | UI-T2-R01- |
| Prefix bug / bằng chứng | BUG-T2-…; thư mục T2/R01/ |
| Số ca | 73; 36 P0, 35 P1, 2 P2 |

Bạn phụ trách **các nhánh thành tích và sai quyền**, KPI/nguồn ngoài, quy định/AI, báo cáo, tổ chức, quản trị và hồi quy giao diện/lỗi mạng. Bạn tự dùng mọi role cần thiết trong ENV-T2.

**Thứ tự đề xuất:**

1. AUTH; dùng tài khoản đổi mật khẩu `ui.t2.password` được nạp bổ sung trước buổi test, không chờ người 1 hoặc chờ đến phần ADM. Xem [bộ file và hướng dẫn seed](kits/README.md).
2. REP-01…05 trên baseline ENV-T2; AI/REG đọc trên baseline trước khi sửa dữ liệu.
3. ACH, KPI; các ca ghi REG và AI chạy với dữ liệu của mình, thiếu căn cứ/provider thì ghi Bị chặn.
4. REP-06: tự dựng sổ REPORT-REVOKE bằng records.demo, ghi nhận, tự thu hồi rồi đối chiếu báo cáo; không đợi sổ thưởng của người 1.
5. UX; tự dựng hồ sơ DOUBLE và CONSISTENCY cho các ca cần nhiều trạng thái/role.
6. ORG/ADM cuối cùng; ORG-05 chuyển Linh và ADM-06 đổi năm hiện tại chỉ sau các ca baseline, không đổi tài khoản chính của các flow trước.

Bạn không cần chờ FLOW-05/12 của người 1: seed ENV-T2 đã có A04/T02 đã xác nhận, P04 được phân công và R02/RT01 đã ghi nhận. Khi cần dữ liệu mới, tự tạo qua UI ở ENV-T2.

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
| AUTH-01 | P0 | 9 tài khoản ACTIVE | Trang đăng nhập | Lần lượt đăng nhập và đăng xuất từng tài khoản, dùng các nút tài khoản demo | Đúng tên/vai trò; Hội đồng vào Hồ sơ đề nghị; không thấy dữ liệu phiên người trước | Chưa chạy | — |
| AUTH-02 | P0 | an.nv; locked.demo | Đã đăng xuất | Thử mật khẩu sai, tài khoản không tồn tại, tài khoản bị khóa | Không vào hệ thống; thông báo rõ; form còn dùng được | Chưa chạy | — |
| AUTH-05 | P0 | an.nv | Đã đăng nhập | Đăng xuất; bấm Back; mở lại URL Hồ sơ năng lực từ thanh địa chỉ | Không đọc được trang/file riêng bằng phiên đã đăng xuất | Chưa chạy | — |
| AUTH-07 | P1 | ui.t2.password | Trước buổi test, ENV-T2 đã nạp SCN rồi chạy script bổ sung prepareUiTestAccounts.js --tester=2 --apply; tài khoản có role, hồ sơ giảng viên và phân công KTPM, mật khẩu demo1234; không đổi mật khẩu An/Bích | Đổi mật khẩu: sai mật khẩu cũ, xác nhận không khớp, mật khẩu hợp lệ UiT2@Change2026; đăng nhập lại | Ca sai có lỗi rõ; ca đúng đổi được; phiên cũ bị thu hồi; mật khẩu mới hoạt động | Chưa chạy | — |

### Báo cáo và CSV (6 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REP-01 | P0 | bich.tt | Chạy trên baseline ENV-T2 trước các ca sửa trạng thái; chỉ đối chiếu dữ liệu của ENV-T2, không dùng kết quả FLOW của người 1 | Lọc nguồn Thành tích/Khen thưởng, cá nhân/tập thể, đơn vị, loại, năm | Thống kê và danh sách cùng bộ lọc; không tính hồ sơ hủy/thu hồi là hợp lệ | Chưa chạy | — |
| REP-02 | P0 | an.nv; bich.tt; linh.pharm | Ba phạm vi khác nhau | Mở Báo cáo từng tài khoản và chọn các đơn vị có thể thấy | Không lộ dữ liệu ngoài phạm vi; tên đơn vị/chủ thể rõ ràng | Chưa chạy | — |
| REP-03 | P1 | bich.tt; records.demo; cuong.lh; duc.pm | Dữ liệu seed ENV-T2 đã có hồ sơ hợp lệ; không cần người 1 tạo/ghi nhận thêm | Chọn bộ lọc có kết quả; Xuất Báo Cáo CSV; mở file bằng ứng dụng bảng tính | File đọc được tiếng Việt, tiêu đề và số liệu; không xuất khác bộ lọc hoặc lẫn dữ liệu ngoài quyền | Chưa chạy | — |
| REP-04 | P0 | an.nv | Giảng viên thuần role | Mở Báo cáo, tìm nút xuất | Có thể xem đúng quyền nhưng không xuất nếu role hiện không được phép; UI không mời thao tác rồi lỗi bất ngờ | Chưa chạy | — |
| REP-05 | P1 | bich.tt | Có bộ lọc không có dữ liệu | Lọc năm/loại không có; áp dụng rồi xóa lọc | Hiện rỗng/0 đúng, không giữ số liệu cũ gây nhầm | Chưa chạy | — |
| REP-06 | P0 | bich.tt | Người 2 tự dùng records.demo trong ENV-T2 tạo quyết định/sổ UI-T2-R01-REPORT-REVOKE, upload decision-demo.pdf và ghi nhận; ghi số liệu trước rồi tự thu hồi với lý do | Tự chuyển sang bich.tt trong ENV-T2 → mở Báo cáo đúng bộ lọc → làm mới sau thu hồi → đối chiếu danh sách và CSV với số liệu trước thao tác của chính mình | Số hợp lệ cập nhật; bản thu hồi không tiếp tục được tính | Chưa chạy | — |

### Thẩm định AI (7 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-01 | P1 | an.nv; cuong.lh | Hai phiên seed | Lịch sử Phiên AI → mở từng phiên đúng chủ thể; xem nguồn/kết luận | Đọc được kết quả mô phỏng; An và tập thể Cường không bị lẫn dữ liệu | Chưa chạy | — |
| AI-02 | P0 | an.nv | Tab thẩm định | Thử chạy chưa chọn tiêu chí; chọn SCN-CRIT-01 và chủ thể cá nhân; chạy qua UI | Chặn đầu vào thiếu; khi chạy được phải ghi đúng nguồn mô phỏng/provider; không khẳng định đạt thưởng thật | Chưa chạy | — |
| AI-03 | P0 | cuong.lh; rep.expired | Thẩm định tập thể | Chọn Bộ môn KTPM; thử đơn vị ngoài phân công và đại diện hết hạn | Chỉ dữ liệu/phạm vi được phép; không dùng role để vượt phân công | Chưa chạy | — |
| AI-04 | P1 | an.nv | Trong ENV-T2, người 2 tự tạo một phiên AI mới, ghi mã phiên, sau đó tự thay đổi một hồ sơ nháp nguồn được phép qua UI; không dùng phiên do người 1 tạo | Mở phiên; Kiểm tra dữ liệu cũ; sửa nguồn bằng UI khi được phép; kiểm lại | Hiển thị tính cũ/mới trung thực; không âm thầm cập nhật kết quả lịch sử | Chưa chạy | — |
| AI-05 | P1 | an.nv | ENV-T2 có nguồn hợp lệ và phạm vi gửi provider đã được xác nhận trước giờ chạy; seed mô phỏng hiện chưa đáp ứng. Thiếu điều kiện ghi Bị chặn và chuyển ca khác | Bấm giải thích tiêu chí/trích dẫn; mở nguồn/đoạn được trích | Trích dẫn mở đúng nguồn; không dùng văn bản chưa xác nhận làm căn cứ chính thức; thiếu cấu hình ghi Bị chặn | Chưa chạy | — |
| AI-06 | P1 | Người được phép | Provider không hoạt động hoặc trình duyệt Offline | Bấm chạy, quan sát lỗi, sau đó khôi phục và thử lại | Lỗi rõ; thoát loading; không lưu/báo kết quả giả; dữ liệu nhập còn dùng được | Chưa chạy | — |
| AI-07 | P2 | an.nv | Tab 12 Hồ sơ Thử nghiệm | Chọn các hồ sơ minh họa và xem kết quả | Có nhãn dữ liệu thử nghiệm; không nhập nhầm thành hồ sơ thật của tài khoản | Chưa chạy | — |

### Kho quy định (7 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REG-01 | P1 | an.nv | Nguồn nền và SCN-REGULATION | Chuyển tab văn bản, phiên bản, trích đoạn, tiêu chí; lọc/tìm | Hiện đúng dữ liệu; phân biệt nguồn chính thức/chưa duyệt/mô phỏng | Chưa chạy | — |
| REG-02 | P1 | duc.pm | Tạo văn bản mô phỏng UI riêng | Thêm văn bản mới, cơ quan, mã và loại; lưu; thử mã trùng | Lưu được bản mới; mã trùng báo lỗi; không đổi nguồn nền | Chưa chạy | — |
| REG-03 | P1 | duc.pm | Văn bản UI riêng | Thêm v1, trích đoạn; thêm v2 và thời gian hiệu lực; xem lại v1 | Lịch sử phiên bản không mất; không ghi đè nội dung cũ; mốc hiệu lực hợp lệ | Chưa chạy | — |
| REG-04 | P1 | duc.pm | Có phiên bản/trích đoạn UI riêng | Tạo tiêu chí, chọn nguồn/đoạn liên quan; thiếu trường rồi bổ sung | Tiêu chí liên kết đúng văn bản, phiên bản; kiểm trường bắt buộc | Chưa chạy | — |
| REG-05 | P0 | duc.pm | Chỉ văn bản mô phỏng UI riêng | Kiểm luồng xác nhận/thu hồi xác nhận có căn cứ; thử trạng thái không hợp lệ | Có kiểm soát và lịch sử; không tự gắn nhãn Chính sách LHU chính thức cho nguồn giả | Chưa chạy | — |
| REG-06 | P0 | an.nv | Người dùng chỉ đọc | Tìm nút sửa/xác nhận văn bản/tiêu chí; thử mở các form có thể nhìn thấy | Không có thao tác quản trị trái quyền; nguồn không thay đổi | Chưa chạy | — |
| REG-07 | P1 | an.nv | SCN-CRIT-01 và SCN-CRIT-DRAFT | So sánh nhãn nguồn, trạng thái xác nhận và danh sách tiêu chí được chọn bên AI | Tiêu chí chưa xác nhận không được chọn để thẩm định như hợp lệ; tiêu chí demo không biến thành chính sách thật | Chưa chạy | — |

### Các nhánh kê khai/thẩm định thành tích (16 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ACH-01 | P0 | an.nv | Trang Thành tích | Tạo nháp cá nhân UI-T2-R01-ACH-01; chọn từng loại thành tích để kiểm nhãn | Lưu được; chỉ tên tiếng Việt trong lựa chọn; chủ thể mặc định đúng người | Chưa chạy | — |
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

### KPI và nhập tệp (10 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| KPI-01 | P1 | an.nv | Trang KPI | Thiết lập mục tiêu mới UI-T2-R01-KPI; nhập chỉ tiêu/kỳ/kế hoạch; lưu và F5 | Mục tiêu riêng tồn tại, đúng chủ thể, số lượng và thời gian | Chưa chạy | — |
| KPI-02 | P1 | an.nv | Form KPI | Thiếu mã/tên; số không hợp lệ; kỳ ngược; mã trùng | Không lưu dữ liệu sai; giữ nội dung để sửa; lỗi dễ hiểu | Chưa chạy | — |
| KPI-03 | P1 | an.nv | SCN-K01 chưa chấp nhận | Sửa mục tiêu; Chấp nhận; tải lại | Trạng thái và giới hạn sửa đúng; không tự tạo thành tích | Chưa chạy | — |
| KPI-04 | P0 | an.nv | SCN-K02 đã chấp nhận | Ghi kết quả thực tế; đối chiếu tiến độ/chỉ tiêu; sửa kết quả nếu UI cho phép | Số liệu đúng đơn vị và nguồn; không biến kế hoạch thành thành tích đã xác nhận | Chưa chạy | — |
| KPI-05 | P0 | an.nv | SCN-K03 có kết quả | Chọn loại thành tích; tạo nháp từ kết quả; mở nháp ở Thành tích; bấm lại | Chỉ tạo nháp đúng chủ thể, không tự duyệt; không nhân đôi ngoài ý muốn | Chưa chạy | — |
| KPI-06 | P0 | cuong.lh; rep.expired | SCN-KT01 | Cường chuyển Cá nhân/Đơn vị tôi đại diện, xem kết quả tập thể; người hết hạn thử thao tác | Tách cá nhân/KTPM; đại diện hết hạn không được quản lý mục tiêu tập thể | Chưa chạy | — |
| KPI-07 | P1 | an.nv | Có file mẫu từ UI | Tải mẫu CSV; chọn file hợp lệ; Kiểm tra trước khi nhập; nhập; tải lại danh sách | Xem được preview; chỉ ghi khi xác nhận; mục tiêu nhập đủ và không nhân đôi khi bấm lặp | Chưa chạy | — |
| KPI-08 | P1 | an.nv | kpi-invalid.csv; file thiếu cột | Kiểm tra dữ liệu sai; thử nhập lại; dùng file Excel hợp lệ theo mẫu nếu có | Chỉ rõ dòng/cột sai; không âm thầm nhập dữ liệu lỗi; Excel đọc đúng kiểu ngày/số | Chưa chạy | — |
| KPI-09 | P1 | an.nv; cuong.lh | Dùng phiên AI seed của ENV-T2 hoặc phiên do người 2 tự tạo trên ENV-T2; không lấy runId từ người 1. Thiếu căn cứ chính thức/provider thì ghi Bị chặn | Mở gợi ý KPI, chọn phiên; thử chấp nhận/từ chối gợi ý khi đủ điều kiện | Gắn nhãn nguồn; chỉ tạo mục tiêu sau người dùng chấp nhận; không lấy phiên của người khác; thiếu provider ghi Bị chặn | Chưa chạy | — |
| KPI-10 | P1 | duc.pm → an.nv | Nguồn KPI thử nghiệm cho ENV-T2 đã cấu hình trước giờ chạy. Người 2 tự dùng duc.pm ánh xạ/đồng bộ và an.nv kiểm lại, không chờ người 1 | Admin ánh xạ mã nhân viên, đồng bộ qua nút UI, đồng bộ lại; An xem và tạo nháp từ nguồn hợp lệ | Có lịch sử nguồn; không trùng khi đồng bộ lại; chưa ánh xạ/chưa FINAL không thành thành tích; thiếu cấu hình ghi Bị chặn | Chưa chạy | — |

### Mobile, khả dụng, lỗi mạng, tính nhất quán (9 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX-01 | P1 | an.nv; duc.pm; records.demo | Người 2 tự mở các màn hình và tạo dữ liệu UI-T2-R01-UX cần thiết trong ENV-T2; không chờ các ca CAL/PORT của người 1 | Mở các trang, menu di động, form/popup, lịch, bảng, phân trang | Không tràn ngang mất nút; thao tác chính bấm được; menu không che nội dung cuối | Chưa chạy | — |
| UX-02 | P2 | an.nv | Chỉ thay theme trong hồ sơ trình duyệt của người 2, không dùng chung profile với người 1 | Đổi theme trên các trang; mở dropdown và popup | Chữ/nền đủ rõ; trạng thái hiện tại, lỗi và nút disabled phân biệt được | Chưa chạy | — |
| UX-03 | P1 | an.nv | Người 2 dùng thành tích seed và tự tạo lịch trong ENV-T2 để kiểm bàn phím; không nghiệm thu lại các ca CAL/PORT của người 1 | Tab/Shift+Tab, Enter/Space, Esc ở lịch, popup thành tích và chọn tên | Có focus rõ; focus bị giữ trong popup; đóng trả đúng chỗ; không bắt buộc dùng chuột | Chưa chạy | — |
| UX-04 | P1 | an.nv | Người 2 tự tạo bản ghi UI-T2-R01-UX-LONG và tệp có tên dài trong ENV-T2 | Nhập tiếng Việt dấu, xuống dòng, tên tệp dài; zoom 200% | Không mất chữ/ký tự; nội dung xuống dòng; không che nút đóng/lưu | Chưa chạy | — |
| UX-05 | P0 | an.nv | Người 2 tự tạo nháp thành tích/lịch UI-T2-R01-OFFLINE; chỉ chuyển Offline trong trình duyệt của mình, không dừng server dùng chung | Chuyển trình duyệt Offline rồi bấm lưu; Online và thử lại | Báo lỗi thật, không báo thành công; giữ nội dung để thử lại; không nhân đôi khi thành công | Chưa chạy | — |
| UX-06 | P1 | an.nv | Có danh sách seed ENV-T2; chỉ đổi nhanh bộ lọc/chủ thể của mình, không đợi người 1 tạo hồ sơ | Chuyển nhanh tab/bộ lọc/chủ thể; mở/đóng chi tiết liên tục | Loading kết thúc; kết quả cuối đúng lựa chọn mới nhất, không hiện nhầm hồ sơ trước | Chưa chạy | — |
| UX-07 | P0 | an.nv; bich.tt; records.demo (người 2 tự đổi vai trò) | Trong ENV-T2, người 2 tự tạo bộ UI-T2-R01-DOUBLE: một nháp thành tích có file và một sổ nháp có file quyết định; tự chuẩn bị trạng thái qua UI | Trên bộ DOUBLE, lần lượt bấm nhanh hai lần Lưu, Gửi và Ghi nhận trong lúc UI còn đang xử lý; tự đổi vai trò khi cần và kiểm số bản ghi/lịch sử. Đây là ca chống ghi trùng, không phải luồng MAIN của người 1 | Nút khóa hoặc thao tác chỉ ghi một lần; không trùng, không nhảy sai trạng thái | Chưa chạy | — |
| UX-08 | P1 | an.nv | Bộ lọc và chi tiết đang mở | Back/Forward/F5, mở link trang không tồn tại từ thanh địa chỉ | Điều hướng đúng; có trang 404 rõ; không màn hình trắng hoặc vòng lặp chuyển trang | Chưa chạy | — |
| UX-09 | P1 | an.nv → bich.tt → council.demo (cùng người 2) | Người 2 tự tạo thành tích UI-T2-R01-CONSISTENCY có minh chứng, tự dùng Bích xác nhận, An tạo/nộp đề nghị và Bích chuyển Hội đồng, tất cả trong ENV-T2 | Người 2 tự đổi vai trò qua các hồ sơ trình duyệt riêng để kiểm cùng bản CONSISTENCY trên danh sách, popup, hồ sơ năng lực, báo cáo và màn hình Hội đồng; mục tiêu là tính nhất quán/cache, không chờ FLOW của người 1 | Các màn hình không mâu thuẫn; Làm mới hiển thị dữ liệu mới, không dữ liệu cache của người trước | Chưa chạy | — |

### Tổ chức và phân công (7 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ORG-01 | P1 | bich.tt; cuong.lh; an.nv | Trang Tổ chức | Xem cơ cấu; chọn Khoa/Bộ môn theo quyền; xem danh sách đại diện/giảng viên | Cơ cấu cha–con đúng; đọc hồ sơ theo quyền; giảng viên không được mặc định xem mọi dữ liệu đơn vị | Chưa chạy | — |
| ORG-02 | P0 | bich.tt | Khoa Dược ngoài phạm vi | Thử chọn Khoa Dược và mở thông tin nếu UI cho chọn | Không hiển thị hồ sơ ngoài quyền; thông báo/khóa thao tác rõ | Chưa chạy | — |
| ORG-03 | P1 | duc.pm | Đơn vị UI mới | Tạo đơn vị con, sửa tên/mô tả; F5; thử mã trùng | Đúng cha–con, mã không trùng; dữ liệu lưu được | Chưa chạy | — |
| ORG-04 | P0 | duc.pm | Người 2 tự tạo trước đơn vị/tài khoản UI-T2-R01-REP bằng duc.pm trên ENV-T2; nếu UI không hỗ trợ đủ thiết lập thì ghi lỗi/thiếu chức năng, không chờ người 1 | Phân công đại diện có hạn; đăng nhập tài khoản được giao; tạo tập thể đúng đơn vị | Chỉ có quyền trong thời gian/phạm vi được giao; lựa chọn UI cập nhật sau đăng nhập/làm mới | Chưa chạy | — |
| ORG-05 | P0 | duc.pm; linh.pharm (chỉ ENV-T2) | Chạy sau toàn bộ ca sai quyền và báo cáo cần baseline của ENV-T2. Dùng giảng viên Linh/Khoa Dược sẵn có trong bản seed ENV-T2; không thay An, Bích hoặc Cường | Người 2 tự đăng nhập duc.pm → Tổ chức → chuyển Linh vào đơn vị UI-T2-R01-ORG mới → đăng nhập Linh và xem lại quá trình công tác/đơn vị; lưu bằng chứng trước/sau | Lưu lịch sử, không làm sai hồ sơ cũ; quyền và đơn vị hiện tại cập nhật đúng | Chưa chạy | — |
| ORG-06 | P1 | duc.pm | Đơn vị UI trống và đơn vị đã dùng | Thử xóa, hủy xác nhận; xóa đơn vị trống; thử xóa đơn vị có ràng buộc | Hủy thì giữ; không làm mất dữ liệu tham chiếu của đơn vị đã sử dụng | Chưa chạy | — |
| ORG-07 | P0 | an.nv | Người không quản trị | Tìm nút tạo/sửa/xóa/chuyển giảng viên/phân công | Không có thao tác quản trị tổ chức trái quyền | Chưa chạy | — |

### Quản trị (7 ca)

| ID | Ưu tiên | Tài khoản | Điều kiện tự chuẩn bị | Thao tác UI | Kết quả mong đợi | Trạng thái | Thực tế / Bug / Bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADM-01 | P0 | duc.pm | Trang Quản trị | Tạo tài khoản UI riêng; thử trùng username/email, mật khẩu ngắn; nhập hợp lệ rồi đăng nhập | Ca sai báo lỗi; ca đúng có tài khoản dùng được, không tự có role/phạm vi ngoài ý định | Chưa chạy | — |
| ADM-02 | P0 | duc.pm | Tài khoản UI riêng | Gán vai trò, phạm vi đơn vị và thời hạn; đăng nhập tài khoản đó | Quyền thực tế đúng cả role và phạm vi; không chỉ đổi nhãn menu | Chưa chạy | — |
| ADM-03 | P0 | duc.pm | Tài khoản UI riêng đang đăng nhập cửa sổ khác | Khóa tài khoản; cửa sổ kia tiếp tục thao tác; mở lại và đăng nhập | Tài khoản khóa không tiếp tục đọc/ghi riêng; mở khóa cho đăng nhập hợp lệ | Chưa chạy | — |
| ADM-04 | P0 | duc.pm | Vai trò/phạm vi UI riêng | Thu hồi role hoặc phạm vi; đăng nhập lại, thử trang/thao tác cũ | Không còn quyền cũ; dữ liệu đã tạo không bị mất sai cách | Chưa chạy | — |
| ADM-05 | P1 | duc.pm | Danh mục UI riêng | Thêm/sửa loại thành tích và loại thưởng; chọn đối tượng cá nhân/tập thể; thử mã trùng/ẩn | Tên và đối tượng đúng khi kê khai; mã trùng bị chặn; danh mục ẩn không còn được chọn cho hồ sơ mới | Chưa chạy | — |
| ADM-06 | P1 | duc.pm | Chạy cuối trong ENV-T2, sau các ca cần năm học hiện tại và danh mục nền. Chỉ tạo/sửa mục UI-T2-R01; nếu đổi năm hiện tại phải khôi phục lại năm baseline của ENV-T2 | Tạo/sửa ngày đầu/cuối, năm hiện tại; thử khoảng ngày sai và xóa danh mục đã dùng | Không có khoảng ngày sai/hai năm hiện tại trái quy tắc; không phá hồ sơ tham chiếu | Chưa chạy | — |
| ADM-07 | P0 | an.nv; council.demo | Không có ADMIN | Gõ URL trang Quản trị trên thanh địa chỉ; dùng Back/Forward | Không xem/sửa được dữ liệu quản trị; không chỉ ẩn menu nhưng vẫn mở trang được | Chưa chạy | — |

## Hoàn thành phần của mình

- Đã xử lý đủ 73 ca được giao, trạng thái rõ ràng và có bằng chứng cho ca lỗi/P0.
- Không còn lỗi nghiêm trọng chưa phân loại về sai quyền, mất dữ liệu hoặc ghi nhận sai; ca Bị chặn nêu lý do và điều kiện cần có.
- Gửi file kết quả/bug của ENV-T2; chưa cần chờ người kia để kết thúc phần việc của mình.
- Chỉ ghép báo cáo toàn đợt khi nhận đủ hai bộ; đó là tổng hợp kết quả, không phải điều kiện để một người bắt đầu/chạy ca.

[Phân công tổng thể](UI_TEST_PLAN_PARALLEL.md) · [Danh mục 145 ca gốc](UI_TEST_PLAN.md). Chưa xuất Excel trong bước này.
