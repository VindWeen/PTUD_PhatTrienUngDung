# Phân công kiểm thử UI song song cho 2 người

Ngày lập lại: **19/10/2026**. Giữ nguyên **145 ID ca** của danh mục gốc; mỗi ID có đúng **một người phụ trách**.

**File và dữ liệu đã chuẩn bị:** [hai bộ ZIP, mẫu copy và hướng dẫn nạp seed](kits/README.md). Nền SCN giống nhau; ENV-T2 nạp thêm riêng tài khoản `ui.t2.password` trước buổi test để kiểm đổi mật khẩu mà không ảnh hưởng An/Bích.

| Người phụ trách | File giao việc đầy đủ | Số ca | P0 | P1 | P2 | Môi trường |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Người test 1 | [Bộ test người 1](UI_TEST_PLAN_TESTER_1.md) | 72 | 38 | 33 | 1 | ENV-T1 |
| Người test 2 | [Bộ test người 2](UI_TEST_PLAN_TESTER_2.md) | 73 | 36 | 35 | 2 | ENV-T2 |
| Tổng | Không trùng/không bỏ sót ID | 145 | 74 | 68 | 3 | Hai bản dữ liệu độc lập |

**Trạng thái hiện tại:** mới chỉnh tài liệu; chưa tạo môi trường thứ hai, chưa reset lại dữ liệu và chưa chạy test theo phân công này. Database SCN hiện có chưa tự động trở thành hai môi trường.

## 1. Cách chia để không phải chờ nhau

- Chia theo **nhóm ca và mục tiêu kiểm thử**, không chia một người chỉ làm giảng viên, người kia chỉ làm quản lý. Cách chia theo vai trò sẽ buộc bàn giao từng bước.
- Người 1 tự chạy luồng đầu–cuối bằng cách lần lượt đăng nhập An → Bích → Hội đồng → Văn thư → người xem kết quả trong **ENV-T1**.
- Người 2 có seed riêng trên **ENV-T2**, đủ các trạng thái giữa/cuối để kiểm nhánh lỗi, sai quyền, KPI, báo cáo và quản trị ngay. Nếu cần thêm dữ liệu, người 2 tự tạo qua UI bằng các role sẵn có.
- Bất kỳ ca có điều kiện từng ghi “sau FLOW của người 1” được đổi sang seed riêng hoặc bước tự chuẩn bị của đúng người nhận ca. Không có ca nào phải nhận ID/file/trạng thái do người còn lại tạo.
- Các bước liên tiếp của **cùng một workflow** vẫn phải làm theo thứ tự nghiệp vụ. Chỉ bỏ phụ thuộc giữa hai người, không bỏ quy tắc gửi → xác nhận → đề nghị → ghi nhận.

## 2. Điều kiện bắt buộc: tách môi trường dữ liệu trước khi bắt đầu

**Hai tài khoản khác nhau hoặc hai tiền tố tên trên cùng database không đủ để đảm bảo không ảnh hưởng nhau.** Sửa phân quyền, năm học hiện tại, danh mục, quy chế, thu hồi nguồn và số liệu báo cáo có thể ảnh hưởng toàn hệ thống.

Phương án được dùng trong hai bộ test:

| Tài nguyên | ENV-T1 | ENV-T2 | Lý do |
| --- | --- | --- | --- |
| Frontend | URL test của người 1 | URL test của người 2 | Có thể xác định rõ đang test bản nào |
| Backend | Instance/cấu hình riêng | Instance/cấu hình riêng | Mỗi UI phải trỏ đúng dữ liệu của mình |
| Database | Database demo riêng, schema app | Database demo khác, schema app | Không thay cùng hồ sơ/quyền/danh mục; không dùng hai frontend chung một DB |
| Seed | Một bản SCN đầy đủ | Một bản SCN đầy đủ | Cùng mã SCN vẫn không trùng bản ghi vì khác DB |
| File private | Thư mục/bucket/prefix lưu trữ riêng, không bị reset chéo | Thư mục/bucket/prefix lưu trữ riêng, không bị reset chéo | Reset hoặc upload ở một bên không xóa file bên kia |
| Phiên trình duyệt | Profile riêng cho người/role | Profile riêng cho người/role | Không đăng xuất hoặc đổi cookie của nhau |
| Nguồn KPI thử nghiệm | Cấu hình/dữ liệu thử riêng | Cấu hình/dữ liệu thử riêng | Không phụ thuộc lượt đồng bộ/ánh xạ của người kia |
| AI live | Quota/test credential độc lập nếu nghiệm thu live song song | Quota/test credential độc lập nếu nghiệm thu live song song | Tránh một bên dùng hết quota làm bên kia thất bại |
| File mẫu upload | Có thể cùng nội dung PDF/CSV chỉ đọc | Có thể cùng nội dung PDF/CSV chỉ đọc | File đầu vào mẫu không phải trạng thái nghiệp vụ chung |

Ứng dụng hiện truy vấn schema `app`; không giả định chỉ tạo thêm schema T1/T2 trong cùng DB là tự hoạt động. Phải tách DB/cấu hình chạy đúng cách trước giờ test. Nếu chạy hai instance trên một máy, người phụ trách cần cấu hình cổng, URL UI/API, CORS/cookie và storage phù hợp; không đổi các cấu hình này giữa chừng khi người khác đang test.

Một người phụ trách môi trường chuẩn bị cả hai bộ **trước buổi test** rồi bàn giao URL/commit/ngày seed cho hai tester cùng lúc. Setup chưa xong không được tính là một tester đang chờ người kia “test xong”.

Nếu hiện chỉ có một database và chưa thể dựng bản thứ hai, **chưa thể cam kết đầy đủ 145 ca chạy độc lập** theo yêu cầu. Chỉ thêm prefix hoặc yêu cầu hai người báo nhau trước mỗi lần sửa dữ liệu sẽ đưa việc chờ đợi trở lại; không dùng phương án đó để kết luận plan đã độc lập.

Nếu AI live vẫn dùng quota chung, chỉ các ca không phụ thuộc provider được bảo đảm độc lập. Ca quota/cấu hình bị chặn phải ghi lý do và chuyển nhóm khác; không được dùng mock để đánh dấu phần live Đạt.

## 3. Phân công chính xác từng nhóm ID

Khoảng ID trong bảng là bao gồm cả đầu/cuối. Hai file cá nhân có đầy đủ bước, kết quả và điều kiện tự chuẩn bị; không cần người test tra file của nhau.

| Nhóm | Người 1 — ENV-T1 | Người 2 — ENV-T2 |
| --- | --- | --- |
| FLOW — luồng đầu–cuối | FLOW-01…15 (15) | Không giao |
| AUTH — đăng nhập/phiên | AUTH-03, AUTH-04, AUTH-06, AUTH-08 (4) | AUTH-01, AUTH-02, AUTH-05, AUTH-07 (4) |
| HOME — trang chủ/menu | HOME-01…06 (6) | Không giao |
| CAL — lịch cá nhân | CAL-01…12 (12) | Không giao |
| PORT — hồ sơ năng lực | PORT-01…09 (9) | Không giao |
| ACH — nhánh thành tích | Không giao | ACH-01…16 (16) |
| APP — đề nghị/Hội đồng | APP-01…12 (12) | Không giao |
| AWD — quyết định/sổ thưởng | AWD-01…09 (9) | Không giao |
| KPI — mục tiêu/nhập/nguồn | Không giao | KPI-01…10 (10) |
| REG — quy định | Không giao | REG-01…07 (7) |
| AI — thẩm định/giải thích | Không giao | AI-01…07 (7) |
| REP — báo cáo/CSV | Không giao | REP-01…06 (6) |
| ORG — tổ chức | Không giao | ORG-01…07 (7) |
| ADM — quản trị | Không giao | ADM-01…07 (7) |
| NOTI — thông báo/private | NOTI-01…05 (5) | Không giao |
| UX — khả dụng/lỗi mạng | Không giao | UX-01…09 (9) |
| Tổng | 72 ca | 73 ca |

FLOW có các thao tác kê khai/báo cáo để nghiệm thu tính liên kết đầu–cuối; ACH/REP kiểm các nhánh chi tiết. Đây là những ID/mục tiêu khác nhau, không phải cùng ca giao hai người. Thao tác chuẩn bị cần lặp một số chức năng là bình thường; không tính thao tác chuẩn bị thành ca test trùng.

## 4. Lịch chạy song song

Hai cột dưới đây **không phải hàng rào đồng bộ**. Người 1 xong chặng 1 được đi tiếp ngay, không chờ người 2 xong cùng chặng.

| Chặng trong phần việc cá nhân | Người 1 | Người 2 |
| --- | --- | --- |
| Bắt đầu | Kiểm phiên, trang chủ, điều hướng | Kiểm đăng nhập/sai quyền; đọc báo cáo và AI/REG baseline |
| Nhóm chính | Tự chạy FLOW-01…15, tự đổi mọi role | Các nhánh ACH, KPI và AI/REG trên seed ENV-T2 |
| Nhóm độc lập tiếp | APP/AWD trên P01…P07, R01…R03 có sẵn | Tự tạo/thu hồi sổ REPORT-REVOKE cho REP-06; chạy UX |
| Cuối lượt | CAL, PORT, NOTI; tự bổ sung dữ liệu cần thiết | ORG/ADM; đổi phân công/năm hiện tại cuối cùng trong ENV-T2 |
| Kết thúc phần mình | Gửi kết quả T1 và bug T1 | Gửi kết quả T2 và bug T2 |

Nếu một flow lỗi, ghi bug, đánh dấu các bước phụ thuộc cùng flow Bị chặn và chuyển nhóm độc lập trong file của mình. Không yêu cầu tester còn lại tạo hộ dữ liệu để tiếp tục.

## 5. Dữ liệu, tài khoản và file riêng

| Nội dung | Người 1 | Người 2 |
| --- | --- | --- |
| Prefix dữ liệu tự tạo lượt 1 | UI-T1-R01- | UI-T2-R01- |
| Luồng riêng | MAIN | DOUBLE, CONSISTENCY, REPORT-REVOKE khi cần tự chuẩn bị |
| Số quyết định ví dụ | UI-T1-R01-MAIN-2026 | UI-T2-R01-REPORT-REVOKE-2026 |
| Bug | BUG-T1-001… | BUG-T2-001… |
| Bằng chứng | T1/R01/ID-ca/ | T2/R01/ID-ca/ |
| Role | Tự dùng đủ role trong ENV-T1 | Tự dùng đủ role trong ENV-T2 |
| Reset lượt sau | Chỉ ENV-T1, prefix R02 | Chỉ ENV-T2, prefix R02 |

Các tài khoản an.nv, bich.tt… giữ tên dễ nhớ trên cả hai bản seed, nhưng không phải cùng một tài khoản DB. Đổi mật khẩu/khóa user ở ENV-T2 không được ảnh hưởng đăng nhập ENV-T1.

Khi tự chạy nhiều role đồng thời, dùng profile trình duyệt độc lập hoặc hai trình duyệt khác nhau; hai cửa sổ ẩn danh của cùng một phiên trình duyệt có thể dùng chung cookie. Các ca hai tab cùng tài khoản kiểm version thì cố ý dùng cùng phiên của **chính tester đó**.

## 6. Những phụ thuộc đã được bỏ

| Phụ thuộc cũ dễ gây chờ | Điều chỉnh |
| --- | --- |
| Chia An cho người 1, Bích/Hội đồng cho người 2 | Người 1 tự đổi đủ role để chạy MAIN trong ENV-T1 |
| Người 2 chờ hồ sơ người 1 xác nhận | ENV-T2 có A04/T02 đã xác nhận từ seed; dữ liệu mới tự tạo/duyệt bằng UI |
| Người 2 chờ người 1 ghi nhận/thu hồi để test báo cáo | REP-06 có sổ REPORT-REVOKE riêng do người 2 tự dựng và thu hồi |
| Người 1 chờ người 2 tạo hồ sơ để kiểm phân trang/nhóm | PORT-02/07 yêu cầu người 1 tự tạo đủ ba loại và ít nhất 13 thành tích cùng nhóm |
| Người 2 chờ người 1 tạo phiên AI | Dùng phiên seed ENV-T2 hoặc tự chạy một phiên riêng |
| Test cần tài khoản/phân công mới nhưng phải chờ phần ADM | Người nhận ca có bước tự chuẩn bị bằng duc.pm trước khi chạy ca |
| Người 2 sửa quyền/danh mục làm người 1 mất quyền | Hai database và backend độc lập |
| Hai người đối chiếu cùng tổng báo cáo trong khi người kia đang thay số liệu | Mỗi bên đối chiếu tổng/CSV trên dataset của chính môi trường mình |
| Lỗi môi trường/provider làm ngừng cả nhóm | Chỉ chặn ca liên quan của mình; tiếp tục nhóm khác, không bàn giao hoặc đợi tester kia |

## 7. Kết quả, bug và test lại

- Mỗi tester chỉ cập nhật ca được giao; không đưa cùng ID sang hai file kết quả. Không giữ khóa, hàng đợi hoặc lịch “đợi người kia xong” để bảo vệ dữ liệu.
- Nếu hai ca khác ID phát hiện cùng nguyên nhân, giữ cả bằng chứng nhưng gắn chung một bug chính; không tạo hai yêu cầu sửa trùng nhau.
- Kết quả nào được chạy trên môi trường cũ không được tự sao chép thành Đạt ở ENV-T1/ENV-T2 mới.
- Tester phát hiện bug là người test lại chính trên môi trường mình. Nếu thay đổi ảnh hưởng cả hai bộ, mỗi người chạy các ca hồi quy thuộc phần mình trên cùng commit mới; không phát sinh bàn giao giữa ca.
- Một tester có thể hoàn tất/gửi phần việc trước. Báo cáo tổng cuối cùng cần gom đủ hai file, nhưng không cản người còn lại chạy hoặc hoàn tất.
- Tiêu chí chốt toàn đợt: mọi P0 đã xử lý, không còn lỗi nghiêm trọng về quyền/mất dữ liệu/sai ghi nhận; ca chưa chạy/bị chặn/P1/P2 còn lại được liệt kê trung thực.

## 8. Kiểm tra tính đầy đủ của bản chia

- Tổng danh mục gốc: 145 ID.
- Hai tập giao việc: 72 + 73 = 145.
- Giao hai tập ID: rỗng, không có ca giao trùng.
- Hợp hai tập: bằng đủ danh mục gốc, không thiếu ca.
- P0: 38 + 36 = 74; P1: 33 + 35 = 68; P2: 1 + 2 = 3.
- Cả hai file có tài khoản, dữ liệu đầu vào, bước tự chuẩn bị, bước thao tác và kết quả mong đợi. Không có điều kiện nhận kết quả từ người kia.

Chưa xuất Excel. Khi chuyển Excel có thể tách sheet **Phân công**, **Tester 1**, **Tester 2**, **Bug log**, **Tổng hợp**; thêm cột môi trường/lượt chạy/người thực hiện và giữ nguyên ID để tổng hợp không đếm trùng.

Tham chiếu: [Danh mục 145 ca gốc](UI_TEST_PLAN.md), [Bộ người 1](UI_TEST_PLAN_TESTER_1.md), [Bộ người 2](UI_TEST_PLAN_TESTER_2.md), [Kiểm tra AI hiện tại](AI_INTEGRATION_CHECK_2026-10-19.md).
