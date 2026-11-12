# Kịch bản video demo toàn bộ chức năng hệ thống LHU

> Bản dài để tra cứu chức năng. Buổi trình bày dưới 10 phút và bộ dữ liệu mở rộng ngày 12/11/2026 dùng [DEMO_9_PHUT.md](DEMO_9_PHUT.md) và [RICH_DEMO_DATA.md](RICH_DEMO_DATA.md). Chạy/reset theo [hướng dẫn hiện hành](DEMO_RECORDING_SETUP.md); các giới hạn AI và bản gốc SCN trong kịch bản dài này là thông tin của đợt chuẩn bị trước.

Ngày đối chiếu: 11/11/2026. Căn cứ: giao diện và mã nguồn hiện tại sau chuyển SQL Server, tài liệu USER_GUIDE và các tuyến API. Đây là kịch bản chuẩn bị quay; chưa thực hiện thao tác, chưa tạo dữ liệu hoặc quay video theo kịch bản này.

## 1. Cách tổ chức video

Tên video: **Demo Hệ thống Quản lý Hồ sơ Thành tích Số và Hỗ trợ Xét duyệt Khen thưởng thông minh dựa trên AI**.

Làm một bộ demo đầy đủ khoảng **70–100 phút**, chia chương để người xem chọn phần cần xem. Khoảng thời gian này là dự kiến, không phải giới hạn bắt buộc; còn phụ thuộc thời gian nhập liệu, tải tệp và phản hồi dịch vụ. Có thể cắt từ bản đầy đủ thành bản trình bày 12–15 phút sau đó. Không cố nhét tất cả chức năng vào bản ngắn.

Mạch nội dung xuyên suốt:

**KPI → kê khai thành tích → minh chứng → nộp → bổ sung → xác nhận → đề nghị → đơn vị chuyển → Hội đồng xét → quyết định → ghi sổ → báo cáo và CV.**

Luôn phân biệt ba kết quả: thành tích **đã xác nhận**, hồ sơ **được đề nghị**, khen thưởng **đã ghi nhận**. Ba kết quả này không tự động thay thế nhau.

## 2. Chuẩn bị trước khi quay

Môi trường local và bộ dữ liệu đã chuẩn bị: [hướng dẫn chạy/reset demo](DEMO_RECORDING_SETUP.md). Bản quay dùng DB `PTUD_LHU_Demo`, giao diện `http://127.0.0.1:5175`, tách khỏi bản thường. Giới hạn AI/email thực tế được ghi trong hướng dẫn đó.

- Dùng DB demo riêng có schema và dữ liệu phù hợp, không dùng các thao tác xóa/thu hồi/thay đổi quyền trên dữ liệu đang làm việc. Không chạy seed/reset vào DB hiện tại. Việc tạo DB demo và dữ liệu là bước thực hiện sau khi chốt kịch bản.
- Backend SQL Server và frontend chạy ổn định; không quay màn hình `.env`, mật khẩu SQL Server, token, khóa AI, hộp quản lý mật khẩu hay dữ liệu cá nhân thật.
- Chọn một lần quay làm mốc, ví dụ tiền tố `VID-01`; các mã kỳ, KPI, số quyết định, tài khoản và tiêu đề phải duy nhất. Quay lại lần khác đổi tiền tố.
- Chuẩn bị PDF minh chứng v1/v2, ảnh minh chứng, DOCX thử hợp lệ, PDF quyết định ban đầu/sửa sai; tất cả ghi rõ **MÔ PHỎNG – PHỤC VỤ DEMO**, dưới 10 MB/tệp. Có một tệp sai định dạng và một tệp vượt 10 MB để quay nhánh kiểm tra.
- Tệp có tên tiếng Việt, ví dụ `Minh chứng nghiên cứu – bản 1.pdf`, để trình bày tên tệp, thay phiên bản và tải xuống. Không dùng hồ sơ đang tham chiếu tệp cũ bị thiếu làm nguồn luồng chính.
- Kiểm tra ngày hiệu lực: kỳ đang mở bao trùm ngày demo; vai trò, phạm vi, đại diện, nguồn quy định và các mốc ngày đều hợp lệ. Các kiểm tra năm liên tiếp phải có dữ liệu của đúng các năm cần thiết.
- Kiểm tra riêng email đặt lại mật khẩu, AI giải thích, gợi ý KPI và nguồn KPI ngoài. Chỉ quay kết quả thật nếu các tích hợp đã cấu hình và chạy thành công; nếu chưa, quay trạng thái giới hạn/lỗi có kiểm soát và nói rõ.
- Dùng các phiên trình duyệt tách biệt theo vai trò; gắn nhãn phiên. Chỉ một người/tiến trình điều khiển mỗi phiên. Chờ dữ liệu tải xong trước khi thao tác hoặc chụp cảnh.
- Độ phân giải đề xuất 1920×1080, zoom 100%; ẩn tab và bookmark cá nhân, tắt thông báo hệ điều hành. Mỗi thao tác quan trọng dừng 2–3 giây để người xem đọc kết quả.
- Thống nhất trạng thái ban đầu và chụp mốc dữ liệu demo. Các cảnh tạo/sửa/xóa chỉ là kế hoạch trong tài liệu này, chưa được thực hiện.

### Tài khoản và vai trò

| Vai trò | Tài khoản mẫu đang có | Mục đích quay |
|---|---|---|
| Giảng viên | `an.nv` | Hồ sơ, KPI, thành tích, đề nghị cá nhân, CV, AI |
| Quản lý đơn vị, kèm giảng viên | `bich.tt` | Thẩm định thành tích, chuyển đề nghị, báo cáo |
| Đại diện tập thể, kèm giảng viên | `cuong.lh` | KPI/thành tích/đề nghị tập thể |
| Hội đồng | `council.demo` | Phân công, nhận xét, bổ sung, kết luận |
| Chuyên viên thi đua | `records.demo` | Mở kỳ, quyết định và ghi sổ |
| Quản trị viên | `duc.pm` | Tài khoản, quyền, phạm vi, tổ chức, danh mục |
| Hội đồng chưa phân công | `council.other` | Minh họa không được xét chỉ vì cùng phạm vi |
| Giảng viên ngoài phạm vi | `linh.pharm` | Minh họa giới hạn đơn vị |
| Đại diện hết hạn / tài khoản khóa | `rep.expired` / `locked.demo` | Minh họa hiệu lực quyền và đăng nhập bị chặn |

Đây là tên tài khoản của bộ dữ liệu mẫu, không phải cam kết mật khẩu/quyền vẫn giữ nguyên tại ngày quay. Kiểm tra trước buổi quay; không ghi thao tác nhập mật khẩu vào video.

### Hồ sơ cần chuẩn bị và thứ tự phụ thuộc

| Mã gợi nhớ | Dữ liệu | Dùng cho |
|---|---|---|
| `K-MAIN` | KPI cá nhân, chỉ tiêu 2 hồ sơ | Tạo kết quả 1 hồ sơ, tiến độ 50%, chuyển thành nháp |
| `A-MAIN` | Thành tích từ KPI, minh chứng v1/v2 | Luồng bổ sung rồi xác nhận; giữ làm nguồn chính |
| `A-REJECT` | Thành tích độc lập đã nộp | Từ chối và tạo bản thay thế |
| `A-CANCEL` | Nháp/đã nộp độc lập | Hủy/rút hồ sơ |
| `A-REVOKE` | Thành tích độc lập đã xác nhận | Thu hồi, ảnh hưởng đến đánh giá/CV |
| `A-TEAM` | Thành tích của đơn vị đại diện | Luồng tập thể |
| `P-MAIN` | Đề nghị cá nhân dùng A-MAIN | Vòng bổ sung Hội đồng rồi đề nghị khen thưởng |
| `P-NO` | Đề nghị khác đủ điều kiện nộp | Kết luận không đề nghị |
| `P-TEAM` | Đề nghị của đúng đơn vị | Luồng tập thể |
| `R-MAIN` | Thưởng liên kết P-MAIN | Tạo nháp, file quyết định, ghi nhận |
| `R-REVOKE` | Thưởng độc lập hoặc bản tạo cho cảnh sửa sai | Thu hồi/thay thế, không phá cảnh báo cáo chính |
| `REG-AI` | Văn bản mô phỏng, phiên bản, trích đoạn, tiêu chí có ánh xạ nguồn | AI, trích dẫn, kiểm tra thay đổi nguồn |

Không dùng cùng một hồ sơ vừa thu hồi vừa làm nguồn hợp lệ cho cảnh sau. Các cảnh kết thúc bằng xóa, khóa, thu hồi hoặc ngừng chia sẻ nên quay sau các cảnh cần dữ liệu đó.

## 3. Kịch bản chi tiết theo chương

Mỗi chương gồm thao tác, hình ảnh cần giữ lại và lời dẫn gợi ý. Các mã gợi nhớ trên là nhãn kịch bản; giao diện vẫn chọn hồ sơ bằng tên, không nhập ID kỹ thuật.

### Cảnh 01 — Giới thiệu hệ thống và ranh giới nghiệp vụ — 1–2 phút

**Vai trò:** Giảng viên. **Trang:** Trang chủ.

1. Hiện tên ứng dụng, tài khoản và vai trò, menu bên trái.
2. Lướt tổng quan thành tích/khen thưởng; mở một hồ sơ mẫu đã hoàn tất để người xem biết đích đến.
3. Giới thiệu ngắn sáu vai trò, không đọc hết menu.

**Lời dẫn:** “Hệ thống theo dõi hồ sơ từ kê khai đến xét duyệt và ghi nhận theo quyết định. AI hỗ trợ đối chiếu căn cứ; các quyết định nghiệp vụ vẫn do người có thẩm quyền thực hiện.”

**Điểm cần thấy:** đang dùng dữ liệu mô phỏng; không nói demo chứng minh thành tích thật hoặc AI tự trao thưởng.

### Cảnh 02 — Đăng nhập, đăng ký và quản lý phiên — 2–3 phút

1. Đăng xuất; thử đăng nhập sai mật khẩu một lần để thấy thông báo, rồi đăng nhập đúng.
2. Mở form Đăng ký, tạo tài khoản demo mới với email/mã duy nhất. Nói rõ tài khoản mới còn cần thông tin và phân công để kê khai.
3. Trở lại tài khoản đã chuẩn bị để tiếp tục luồng; tài khoản mới dùng ở cảnh Admin.
4. Quên mật khẩu: nhập email thử nghiệm, gửi yêu cầu; **chỉ khi email đã cấu hình**, mở email demo, vào link, đặt lại và đăng nhập. Không quay token/link bí mật rõ nét. Chưa cấu hình thì dừng ở form và ghi chú chưa demo gửi email thành công.
5. Phần đổi mật khẩu quay ở cảnh hồ sơ hoặc cuối buổi, vì đổi mật khẩu sẽ làm phiên cũ hết hiệu lực.

**Kết quả:** có thông báo lỗi/thành công rõ; không giới thiệu đăng ký là tự có quyền quản lý.

### Cảnh 03 — Hồ sơ năng lực cá nhân — 2–3 phút

**Vai trò:** Giảng viên. **Trang:** Hồ sơ năng lực.

1. Xem thông tin cá nhân, đơn vị công tác và lịch sử công tác.
2. Sửa các trường cho phép, ví dụ điện thoại/chức danh/học vị bằng dữ liệu demo; lưu và tải lại kiểm tra.
3. Xem danh sách thành tích, khen thưởng, minh chứng được phép truy cập; mở chi tiết/tải một tệp có sẵn.
   Lần lượt chọn các tab Nghiên cứu khoa học, Giảng dạy, Khen thưởng, Minh chứng để thể hiện các nhóm hồ sơ.
4. Chỉ ra công tác chính thức do Admin phân công, không tự sửa qua mô tả CV.

**Lời dẫn:** “Hồ sơ năng lực tập hợp thông tin và kết quả đã được quản lý theo trạng thái, giúp tra cứu lại nguồn và lịch sử.”

### Cảnh 04 — KPI cá nhân: kế hoạch → kết quả → thành tích nháp — 4–5 phút

1. Mục tiêu / KPI → Cá nhân tôi → Thiết lập KPI mới.
2. Tạo K-MAIN: mã duy nhất, tên “Hoàn thành hai hồ sơ nghiên cứu MÔ PHỎNG”, đơn vị đo “hồ sơ”, chỉ tiêu 2, kỳ hợp lệ, kế hoạch và căn cứ.
3. Lưu nháp → sửa một trường → lưu → Chấp nhận. Giải thích đây là người dùng chấp nhận kế hoạch, không phải Quản lý xác nhận thành tích.
4. Ghi kết quả thực tế 1, nhập nguồn/ghi chú minh chứng. Giữ cảnh tiến độ **50%**, số không có phần 0 thập phân thừa.
5. Sửa kết quả một lần để trình bày khả năng cập nhật; giữ số cuối là 1.
6. Kê khai nháp → chọn loại thành tích phù hợp → tạo A-MAIN. Mở Thành tích kiểm tra liên kết.
7. Dùng một KPI phụ để quay xóa nháp/xóa kết quả; không xóa K-MAIN trước khi quay liên kết.

**Lời dẫn:** “Kết quả KPI mới là dữ liệu kê khai. Hệ thống chỉ tạo thành tích nháp; người dùng vẫn phải thêm minh chứng và nộp thẩm định.”

### Cảnh 05 — Nhập KPI từ Excel/CSV — 2–3 phút

1. Mở Nhập mục tiêu từ Excel / CSV → tải mẫu.
2. Chọn tệp XLSX/CSV/TSV đã chuẩn bị hoặc dán nội dung; dùng 2 dòng hợp lệ và 1 dòng thiếu/sai giá trị.
3. Kiểm tra bản xem trước: chỉ ra dòng lỗi và lý do; sửa tệp/nội dung rồi kiểm tra lại.
4. Nhập các dòng hợp lệ; mở mục tiêu mới và kiểm tra các trường.

**Kết quả:** nhập là tạo kế hoạch, không tự tạo thành tích đã xác nhận. Không bấm nhập lại cùng bộ mã trong các lần quay nếu chưa đổi tiền tố.

### Cảnh 06 — Kê khai và quản lý minh chứng số — 4–5 phút

**Vai trò:** Giảng viên. **Trang:** Thành tích.

1. Tìm/lọc A-MAIN theo tiêu đề, chủ thể, trạng thái, năm. Rê các icon để hiện tên chức năng.
2. Mở nháp, sửa nội dung/đóng góp/thời gian/năm học khi cần; trình bày thêm một hồ sơ kê khai trực tiếp không đi qua KPI.
3. Thêm minh chứng PDF v1 có tên tiếng Việt. Kiểm tra tên hiển thị đúng, dung lượng và số phiên bản; tải về mở đối chiếu.
4. Thay file bằng v2; chỉ ra tăng phiên bản, không ghi đè bản cũ. Dùng minh chứng phụ để demo xóa khi còn được sửa.
5. Thử tệp sai định dạng hoặc quá 10 MB trên hồ sơ phụ; hiện lỗi kiểm tra rồi bỏ thao tác.
6. Nộp A-MAIN → trạng thái Chờ duyệt. Mở “Lần nộp & Snapshot” và “Lịch sử thẩm định”.
7. Chỉ ra tệp/nội dung khi đã nộp không còn cho sửa tùy ý; lưu bản chụp của lần nộp.

**Kết quả:** nộp có nguồn/tệp hợp lệ, trạng thái và lịch sử đi cùng nhau. Không demo tải tệp vốn đang thiếu như một lỗi upload mới.

### Cảnh 07 — Quản lý yêu cầu bổ sung, giảng viên sửa và nộp lại — 3–4 phút

1. `bich.tt` → Thành tích → Hàng chờ thẩm định → tìm A-MAIN.
2. Mở thông tin, tải minh chứng, xem lịch sử/lần nộp. Yêu cầu bổ sung: “Bổ sung trang thể hiện tác giả và thời gian thực hiện.”
3. `an.nv` → chuông thông báo → mở A-MAIN; xem lý do Cần bổ sung.
4. Sửa nội dung cần thiết, thay/bổ sung file v2 nếu chưa thay ở cảnh trước; nộp lại.
5. Mở hai lần nộp để so sánh nguồn/tệp theo từng thời điểm; không diễn giải v2 là thay đổi âm thầm tệp của lần nộp cũ.
6. `bich.tt` xem lại → Xác nhận. `an.nv` thấy trạng thái Đã xác nhận và thông báo.

**Lời dẫn:** “Mỗi vòng bổ sung giữ lại căn cứ trước đó. Xác nhận tạo nguồn đủ điều kiện để lập đề nghị, chưa phải quyết định thưởng.”

### Cảnh 08 — Nhánh từ chối, rút, xóa nháp, thu hồi và thay thế — 3–4 phút

Quay trên các hồ sơ phụ, hiển thị tên rõ để không nhầm A-MAIN.

| Nhánh | Thao tác | Kết quả cần quay |
|---|---|---|
| Xóa nháp | Giảng viên tạo nháp phụ rồi xóa | Nháp không còn trong danh sách |
| Rút/hủy | Giảng viên rút A-CANCEL theo trạng thái cho phép | Đã hủy, giữ lý do/lịch sử khi áp dụng |
| Từ chối | Quản lý từ chối A-REJECT, ghi lý do | Từ chối; không dùng làm nguồn hợp lệ |
| Thay thế | Chủ hồ sơ tạo bản thay thế từ bản kết thúc | Nháp mới có liên kết về hồ sơ gốc |
| Thu hồi | Quản lý thu hồi A-REVOKE đã xác nhận, ghi lý do | Đã thu hồi; lịch sử còn, không còn tính như nguồn xác nhận hiện hành |

Không gọi bản thay thế là sửa trực tiếp bản đã xác nhận. Việc thu hồi dùng hồ sơ phụ để không phá luồng xét thưởng chính.

### Cảnh 09 — Mở kỳ nhận hồ sơ đề nghị — 1–2 phút

**Vai trò:** `records.demo`. **Trang:** Hồ sơ đề nghị.

1. Mở kỳ đề nghị → mã/tên kỳ có tiền tố video → ngày bắt đầu/kết thúc bao trùm ngày demo → tạo.
2. Giữ cảnh kỳ xuất hiện trong lựa chọn của người đề nghị.
3. Dùng kỳ đã hết hạn chuẩn bị sẵn để cho thấy không thể nộp theo điều kiện kỳ. Không hứa có nút sửa/đóng kỳ vì UI hiện chưa có chức năng riêng đó.

### Cảnh 10 — Tạo, sửa nháp và nộp đề nghị cá nhân — 3–4 phút

1. `an.nv` → Hồ sơ đề nghị → Tạo hồ sơ đề nghị.
2. Chọn cá nhân, kỳ vừa mở, loại thưởng phù hợp; nhập mục đích có MÔ PHỎNG.
3. Chọn A-MAIN đã xác nhận; tùy dữ liệu, chọn thêm một thưởng đã ghi nhận của đúng chủ thể làm căn cứ bổ sung.
4. Tạo P-MAIN nháp. **Bấm toàn bộ card để xem chi tiết**, không tìm nút xem riêng.
5. Sửa mục đích/danh sách nguồn nếu cần trước khi nộp; kiểm tra lại.
6. Nộp → Đã nộp. Mở bản chụp đầu vào và lịch sử.

**Điểm cần nói:** phải có thành tích xác nhận của đúng chủ thể; thưởng cũ chỉ bổ sung, không thay điều kiện thành tích bắt buộc. File nguồn phải tồn tại. Thành tích nháp/từ chối/thu hồi không phải nguồn thay thế hợp lệ.

### Cảnh 11 — Đơn vị chuyển hồ sơ và Hội đồng phân công — 3–4 phút

1. `bich.tt` → Hồ sơ đề nghị → lọc đơn vị trong phạm vi → bấm P-MAIN.
2. Kiểm tra nguồn/bản chụp, nhập ý kiến đơn vị → Chuyển Hội đồng. Trạng thái Chờ Hội đồng.
3. `council.demo` → mở P-MAIN → xem nguồn, ý kiến đơn vị, lịch sử.
4. Chọn thành viên hợp lệ bằng tên, nhập lý do → Phân công. Trạng thái Đang xét duyệt.
5. Người được phân công ghi nhận xét có căn cứ. Chỉ rõ phạm vi xem và phân công xét là hai điều kiện khác nhau.

**Điểm cần nói:** chưa có phiên họp, bỏ phiếu hoặc tự tính đa số trên UI; không mô tả nút kết luận là một cuộc biểu quyết tự động.

### Cảnh 12 — Hội đồng yêu cầu bổ sung và kết luận — 4–5 phút

1. Người xét P-MAIN chọn Yêu cầu bổ sung, nhập nội dung cụ thể.
2. `an.nv` nhận thông báo → mở card → đọc yêu cầu → sửa mục đích/nguồn được phép và nhập giải trình → Gửi bổ sung qua đơn vị.
3. Nếu cần nguồn mới, phải kê khai và xác nhận nguồn trước; không sửa trực tiếp nguồn đã xác nhận để bỏ qua thẩm định.
4. `bich.tt` xem giải trình → chuyển Hội đồng lại. Hội đồng đọc bản chụp mới và lịch sử cũ.
5. Người xét đã được phân công → Đề nghị khen thưởng, nhập căn cứ. Trạng thái Đề nghị khen thưởng.
6. Dùng P-NO đã chuẩn bị → người xét kết luận Không đề nghị, ghi lý do; người nộp xem lại lý do. Không dùng P-MAIN cho nhánh này.

**Kết quả:** hai nhánh kết thúc rõ; đề nghị được chấp nhận chưa tự tạo quyết định/ghi thưởng.

### Cảnh 13 — Quyết định và ghi nhận khen thưởng — 3–4 phút

1. `records.demo` → Khen thưởng → “Hồ sơ đã được đề nghị – chờ chuẩn bị khen thưởng” → chọn P-MAIN → Chuẩn bị khen thưởng.
2. Chỉ ra chủ thể, loại và nguồn lấy từ hồ sơ đã xét; chọn/nhập quyết định mô phỏng, ngày/cơ quan ban hành/tiêu đề và năm ghi nhận.
3. Tạo R-MAIN nháp. Thử ghi nhận khi thiếu file quyết định để thấy bị chặn.
4. Tải PDF quyết định → xem/tải lại → Ghi nhận khen thưởng.
5. Giữ cảnh Đã ghi nhận, thông tin quyết định, người/thời điểm ghi nhận và liên kết về hồ sơ/lần nộp.
6. Mở lại danh sách đề nghị để chỉ ra bản ghi đã có liên kết; không tạo thưởng trùng từ cùng hồ sơ đang có bản hoạt động.

**Lời dẫn:** “Chuyên viên ghi sổ theo quyết định đã ban hành bên ngoài; hệ thống không tự ban hành quyết định thay nhà trường.”

### Cảnh 14 — Nhập thưởng ngoài luồng, thu hồi và thay thế — 3–4 phút

1. Mở “Nhập khen thưởng theo quyết định ngoài luồng đề nghị”. Giải thích dùng cho quyết định chưa có hồ sơ đề nghị trong hệ thống.
2. Tạo nháp R-REVOKE cho chủ thể/loại/năm phù hợp; chọn hoặc nhập quyết định; liên kết thành tích nếu có.
3. Tải file → ghi nhận → thu hồi kèm lý do → mở lịch sử.
4. Chuẩn bị bản thay thế, dùng quyết định sửa sai mới → nháp → file → ghi nhận; giữ liên kết bản cũ.
5. Chỉ ra bản đã ghi nhận không sửa trực tiếp; một quyết định dùng cho nhiều người không đồng nghĩa được tùy ý thay file sau ghi nhận.

### Cảnh 15 — Luồng tập thể và quyền đại diện — 4–5 phút

1. `cuong.lh` → Tổ chức xem đơn vị công tác và đơn vị được đại diện. Bộ mẫu hiện có thể khác nhau giữa hai đơn vị; xác nhận lại trước khi quay.
2. KPI → Đơn vị tôi đại diện → tạo/chấp nhận mục tiêu tập thể, nhập kết quả → tạo thành tích nháp; hoặc kê khai A-TEAM trực tiếp nếu đã trình bày đủ nhánh KPI.
3. Thành tích → Tập thể → chọn đúng đơn vị, loại áp dụng tập thể → minh chứng → nộp.
4. Quản lý đúng phạm vi xác nhận A-TEAM.
5. Đại diện tạo P-TEAM với loại thưởng tập thể, chọn nguồn của đúng đơn vị → nộp; Quản lý chuyển, Hội đồng xét, Chuyên viên ghi nhận như luồng cá nhân.
6. Có thể dựng nhanh các bước lặp, nhưng giữ cảnh chủ thể là Tập thể tại từng điểm chuyển vai trò và tại sổ khen thưởng.

**Điểm cần nói:** đại diện đúng một đơn vị không tự đại diện các đơn vị con. Vai trò giảng viên đi kèm cho phép làm hồ sơ cá nhân riêng, không trộn nguồn giữa cá nhân và tập thể.

### Cảnh 16 — Kho quy định, phiên bản, trích đoạn và tiêu chí — 4–5 phút

**Vai trò:** Admin/Hội đồng cho cấu hình và xác nhận; vai trò khác xem/thêm theo quyền hiện có.

1. Kho quy định → Văn bản & Phiên bản → thêm văn bản REG-AI mô phỏng, thông tin cơ quan/ngày/link nguồn khi form yêu cầu.
2. Thêm phiên bản, khoảng hiệu lực, nguồn chính thức hoặc link PDF; mở liên kết nguồn để chỉ cách kiểm tra căn cứ.
3. Thêm trích đoạn nội dung ngắn, có điều/mục/trang hoặc vị trí tương ứng trong văn bản demo.
4. Tạo tiêu chí có chủ thể, ngưỡng/đơn vị/khoảng thời gian và liên kết nguồn theo form. Cấu hình **nguồn hồ sơ và loại thành tích/khen thưởng được dùng**; chọn yêu cầu năm liên tiếp khi phù hợp.
5. Người có quyền xác nhận phiên bản/tiêu chí theo trạng thái cho phép. Quay việc phân biệt bản chưa xác nhận và nguồn đã được xác nhận.
6. Mở Tra cứu trích đoạn, nhập từ khóa → xem nội dung liên quan và căn cứ.
7. Cảnh nâng cao cuối buổi: sửa ánh xạ nguồn của tiêu chí phụ → kiểm tra revision/xác nhận cần rà soát lại. Không sửa tiêu chí chính trước cảnh AI.
8. Trên phiên bản/tiêu chí phụ, minh họa từ chối xác nhận và xem lịch sử theo các thao tác hiện có; không từ chối nguồn REG-AI trước khi quay xong AI.

**Điểm cần nói:** văn bản/tiêu chí mô phỏng không có giá trị quy định thực tế; chưa ánh xạ nguồn thì hệ thống không được tự suy đoán chỉ từ tên hồ sơ.

### Cảnh 17 — Thẩm định AI, căn cứ và lịch sử — 4–5 phút

1. Vai trò có chủ thể hợp lệ → Phân tích & Thẩm định AI → Thẩm định Trực tiếp.
2. Chọn Cá nhân/Tập thể đúng quyền, chủ thể, ngày hiệu lực, tiêu chí REG-AI đã chuẩn bị.
3. Nếu cần, mở tùy chọn nguồn giải thích để chọn dịch vụ đang cấu hình; không hiển thị token/khóa.
4. Thực hiện thẩm định → đợi kết quả thật. Giữ các phần kết luận, tiêu chí đạt/chưa đạt/cần người rà soát, hồ sơ nguồn và lý do.
5. Mở căn cứ/trích dẫn và đối chiếu với quy định; phân biệt đối chiếu có cấu trúc với phần giải thích sinh bởi dịch vụ AI.
6. Lịch sử Phiên AI → lọc danh sách, mở lần vừa chạy bằng Xem lại hồ sơ, xem thời điểm/chủ thể/nguồn. Tab Hồ sơ mẫu: chọn các mẫu tiêu biểu trong bộ 12 tình huống có nhãn mô phỏng, không dùng kết quả mẫu để chứng minh độ chính xác thực tế.
7. Trên hồ sơ/tiêu chí phụ, thay đổi nguồn hợp lệ theo quy trình rồi kiểm tra cảnh báo phiên cũ không còn mới; chạy lại để so sánh. Không giả định tự chạy lại khi có thay đổi.
8. Chuẩn bị hai bộ dữ liệu: một đủ căn cứ, một thiếu/ngưỡng chưa đạt hoặc chưa ánh xạ, để quay sự khác nhau. Không chỉnh ngưỡng chỉ để ép kết quả đẹp.

**Lời dẫn:** “AI cung cấp kết quả tham khảo kèm nguồn để người xử lý rà soát. Thiếu căn cứ hoặc nguồn chưa được xác nhận phải được thể hiện rõ; hệ thống không tự trao thưởng.”

**Nếu dịch vụ ngoài lỗi:** giữ thông báo thật và nói rõ chưa có phản hồi; không ghép kết quả cũ như thể vừa chạy thành công. Không công bố tỷ lệ chính xác từ video demo.

### Cảnh 18 — Gợi ý KPI bằng AI và nguồn KPI ngoài — 3–4 phút

**Gợi ý KPI:**

1. KPI → Gợi ý mục tiêu từ AI → chọn một phiên thẩm định phù hợp của chủ thể.
2. Tạo gợi ý/xem gợi ý đã lưu; đọc mục tiêu, căn cứ và thông tin liên quan.
3. Chấp nhận một gợi ý để tạo KPI; từ chối gợi ý khác nếu có. Kiểm tra mục tiêu sinh ra, không tự biến thành thành tích xác nhận.

**Nguồn ngoài:**

1. Admin → KPI → Nguồn KPI bổ sung và lịch sử đồng bộ.
2. Ánh xạ mã nhân viên ngoài với giảng viên; Đồng bộ nguồn mô phỏng khi đã cấu hình.
3. Xem lần chạy, trạng thái, số lần gọi và kết quả từng dòng; demo thử lại và xử lý trùng nếu bộ dữ liệu chuẩn bị hỗ trợ.
4. Giảng viên xem bản ghi READY của mình → chọn loại thành tích → Xác nhận tạo nháp riêng → mở nháp để thêm minh chứng/nộp.

**Giới hạn:** nguồn KPI bổ sung hiện là nguồn mô phỏng; không giới thiệu là đã nối hệ thống nhân sự/KPI thật của trường. Chưa có nguồn khả dụng thì chỉ demo cấu hình/nhật ký đã chuẩn bị và ghi rõ phạm vi; không giả báo một lần đồng bộ vừa chạy.

### Cảnh 19 — Báo cáo, thống kê, lọc và CSV — 2–3 phút

1. Giảng viên → Báo cáo / CSV → xem số hợp lệ và tổng số; so sánh nháp/từ chối/thu hồi với đã xác nhận/đã ghi nhận.
2. Chọn nguồn hồ sơ, chủ thể, trạng thái, năm, năm học, đơn vị, loại; tìm từ khóa → Áp dụng bộ lọc → Đặt lại.
3. Chỉ ra cột trạng thái và dòng “Được tính/Chưa tính vào thống kê”; tổng số danh sách không đồng nghĩa số hợp lệ.
4. Chuyển Quản lý/Đại diện/Chuyên viên hoặc Admin → lọc dữ liệu trong quyền → xuất CSV → mở tệp kiểm tra tiếng Việt, tiêu đề và số dòng.
5. Chỉ ra giảng viên đơn lẻ chỉ xem, không có quyền xuất CSV; dữ liệu xuất vẫn theo phạm vi.

### Cảnh 20 — CV công khai và quản lý chia sẻ — 3–4 phút

1. Giảng viên → Hồ sơ năng lực → Tạo CV cá nhân.
2. Chọn mẫu, nhập giới thiệu/kinh nghiệm khác; chọn phân công và thành tích xác nhận muốn hiện. Email/điện thoại chỉ bật khi muốn chia sẻ.
   Đi qua các phần Thông tin cơ bản, Hồ sơ LHU, Học vấn, Kinh nghiệm, Thông tin bổ sung, Chia sẻ CV; thêm/sửa/xóa và sắp xếp một mục học vấn/kinh nghiệm demo.
3. Lưu nháp → Xem trước → mở chức năng In hoặc lưu PDF của trình duyệt; không mô tả là dịch vụ tự tạo PDF phía server.
4. Công khai CV → mở link trong phiên không đăng nhập → kiểm tra nội dung.
5. Sửa nháp: chỉ ra bản công khai vẫn theo lần công khai trước; Cập nhật CV công khai rồi tải lại link.
6. Đổi link chia sẻ → link cũ không dùng được; link mới truy cập được. Cuối cùng Ngừng chia sẻ → kiểm tra link ngừng hoạt động.
7. Nếu quay ảnh hưởng thu hồi, dùng một thành tích phụ đưa lên CV trước, sau đó thu hồi đúng quy trình và kiểm tra không còn được hiển thị như thành tích hợp lệ.

**Điểm cần nói:** ai có link đều có thể xem/chia sẻ tiếp; đây không phải trang riêng tư được bảo vệ bằng mật khẩu.

### Cảnh 21 — Thông báo, lịch cá nhân và tiện ích giao diện — 2–3 phút

1. Chuông thông báo → mở thông báo chuyển trạng thái của luồng chính → tới đúng hồ sơ → đánh dấu đã đọc theo thao tác hiện có; kiểm tra số chưa đọc.
2. Mở lịch từ biểu tượng đầu trang; chuyển tháng/chọn ngày/về ngày hiện tại, thử bộ lọc loại lịch và xem danh sách sắp tới.
3. Thêm việc “Hoàn thiện hồ sơ demo”, sửa ngày/nội dung, đánh dấu Hoàn thành → Mở lại → xóa việc phụ.
4. Xem lịch chung/hạn đợt đang mở; phân biệt sự kiện hệ thống với lịch cá nhân được sửa.
5. Chuyển sáng/tối, mở trang ở màn hình điện thoại, dùng thanh điều hướng dưới và mục Thêm; kiểm tra card/nút/chi tiết có thể đọc và thao tác.

Không nói thông báo được đẩy tức thời bằng WebSocket: hiện giao diện có cơ chế kiểm tra định kỳ. Không chờ đúng một khoảng thời gian cố định để khẳng định hệ thống lỗi.

### Cảnh 22 — Quản trị tài khoản, tổ chức và danh mục — 4–6 phút

**Vai trò:** `duc.pm`. Chỉ dùng tài khoản/đơn vị/danh mục phụ dành cho cảnh này.

1. Quản trị → Tài khoản: tạo mới hoặc dùng tài khoản đăng ký ở cảnh 02; sửa tên/email/trạng thái; khóa rồi mở lại tài khoản phụ.
2. Vai trò tài khoản: cấp Giảng viên, mã giảng viên/đơn vị khi form cho phép; kiểm tra hồ sơ liên kết. Cấp một vai trò khác có thời hạn; trình bày thu hồi trên quyền phụ.
3. Phạm vi quản lý: chọn đúng vai trò, đơn vị, hiệu lực; bật/tắt bao gồm đơn vị con theo kịch bản. Không thu hồi quyền của các tài khoản đang dùng cho luồng chính trước khi quay xong.
4. Đại diện có hạn: giao tài khoản đại diện đúng đơn vị, có ngày hết hạn; kiểm tra lựa chọn đơn vị ở tài khoản đó.
5. Tổ chức: tạo đơn vị con phụ, sửa thông tin/chọn đơn vị cha, xem hồ sơ đơn vị, đại diện, số liệu và phân cấp. Ngừng/xóa chỉ đơn vị phụ đủ điều kiện, không phá cây đang dùng.
6. Chuyển công tác một giảng viên demo phụ, xem lịch sử. Hồ sơ cũ giữ đơn vị ghi nhận lịch sử, không đổi ngầm theo công tác mới.
7. Quản trị các tab Năm học, Loại thành tích, Loại thưởng: thêm/sửa/ngừng dùng danh mục phụ, kiểm tra phạm vi áp dụng Cá nhân/Tập thể khi có. Không ngừng loại đang dùng bởi luồng chính.
8. Quay lại tài khoản mới: menu/quyền thay đổi theo phân công; Admin không tự được xét thành tích/kết luận Hội đồng/ghi thưởng chỉ nhờ vai trò Admin.

### Cảnh 23 — Kiểm soát quyền, dữ liệu không hợp lệ và xung đột — 3–4 phút

| Tình huống | Cách quay trên dữ liệu phụ | Kết quả mong đợi |
|---|---|---|
| Tài khoản khóa | Đăng nhập `locked.demo` | Bị từ chối, không vào được dữ liệu |
| Ngoài phạm vi | Quản lý tìm/mở hồ sơ Khoa Dược | Không xuất hiện hoặc bị chặn truy cập |
| Hội đồng chưa phân công | `council.other` xem hồ sơ trong phạm vi nhưng chưa được giao | Không được ghi nhận xét/kết luận trái phân công |
| Đại diện hết hạn | `rep.expired` làm hồ sơ tập thể | Không có đơn vị hợp lệ hoặc thao tác bị chặn |
| Chống tự duyệt | Tài khoản nhiều vai trò mở hồ sơ của mình | Không tự xác nhận/chuyển/xét trái quy tắc |
| Thiếu minh chứng/quyết định | Nộp thành tích thiếu file; ghi thưởng thiếu file quyết định | Bị chặn, trạng thái không chuyển sai |
| Nguồn sai chủ thể/trạng thái | Tìm nguồn đề nghị không hợp lệ | Không được chọn hoặc bị từ chối khi gửi |
| Xung đột phiên bản | Mở cùng nháp ở hai tab, lưu ở tab A rồi lưu bản cũ ở B | Báo cần tải lại; không ghi đè âm thầm |
| Giá trị sai | Ngày kết thúc trước bắt đầu, thiếu trường bắt buộc, tệp sai loại | Thông báo rõ trường/lý do |

Không cần quay tấn công hoặc mở DevTools để tạo request trái phép. Nếu UI không cho hình thành tình huống thì ghi rõ “không có lựa chọn/thao tác này” thay vì giả tạo một lỗi server trên màn hình.

### Cảnh 24 — Kết thúc và phần kỹ thuật bổ sung — 1–2 phút

1. Trở lại báo cáo, chỉ vào A-MAIN/P-MAIN/R-MAIN hoàn tất, lịch sử và quyết định liên quan.
2. Tóm tắt bằng luồng đã thấy: người kê khai → đơn vị → Hội đồng → chuyên viên; tập thể theo phân công; AI hỗ trợ nguồn.
3. Nếu video dành cho đánh giá kỹ thuật, thêm phụ lục ngắn: readiness báo SQL Server, SSMS xem DB/schema ở chế độ chỉ đọc, kết quả kiểm thử/migration và backup–restore DB riêng. Không quay chuỗi kết nối/mật khẩu.
4. Không nói gói backup DB + toàn bộ tệp đã đầy đủ khi tệp cũ còn thiếu; không tuyên bố kiểm thử AI đạt 100% hoặc có độ chính xác 95% từ dữ liệu demo.

## 4. Ma trận bao phủ để duyệt trước khi quay

| Nhóm chức năng | Cảnh | Điều kiện/kết quả phải có |
|---|---|---|
| Đăng nhập/đăng xuất, sai mật khẩu, đăng ký | 02 | Thông báo, tài khoản mới và phiên đăng nhập |
| Quên/đặt lại mật khẩu | 02 | Cần email cấu hình; không giả gửi thành công |
| Đổi mật khẩu | 03 hoặc cuối buổi | Thực hiện trên tài khoản phụ; phiên cũ bị thu hồi, đăng nhập lại |
| Hồ sơ cá nhân/lịch sử công tác | 03, 22 | Sửa trường cho phép, phân công giữ lịch sử |
| KPI thủ công/nháp/sửa/xóa/chấp nhận | 04 | Trạng thái và dữ liệu lưu đúng |
| Kết quả KPI/sửa/xóa/chuyển nháp | 04 | Tiến độ, liên kết thành tích, không tự xác nhận |
| Nhập Excel/CSV/TSV/dán, mẫu và xem trước | 05 | Dòng hợp lệ/lỗi và kết quả nhập |
| Thành tích cá nhân/tập thể/tìm lọc | 06, 15 | Đúng chủ thể, loại và phạm vi |
| Minh chứng/thay phiên bản/tải/xóa | 06 | Unicode, phiên bản, file đúng, khóa theo trạng thái |
| Nộp/bổ sung/nộp lại/xác nhận | 07 | Lịch sử, snapshot từng lần, thông báo |
| Từ chối/rút/xóa/thu hồi/thay thế | 08 | Hồ sơ phụ, lý do và liên kết cũ/mới |
| Kỳ nhận đề nghị | 09 | Mở kỳ, ngày hợp lệ; không hứa sửa/đóng UI |
| Đề nghị nháp/sửa/nguồn/nộp | 10 | Bấm card mở, nguồn đúng chủ thể, snapshot |
| Chuyển đơn vị/Hội đồng/phân công/ý kiến | 11 | Phạm vi và người xét hợp lệ |
| Bổ sung đề nghị/đề nghị/không đề nghị | 12 | Qua đơn vị, giữ vòng cũ, hai nhánh kết luận |
| Quyết định/thưởng liên kết/chặn trùng | 13 | Nháp → file → ghi nhận; giữ bản chụp nguồn |
| Ngoài luồng/thu hồi/thay thế thưởng | 14 | Quyết định và lịch sử sửa sai |
| Quy trình tập thể | 15 | Nguồn và đại diện đúng đơn vị |
| Văn bản/phiên bản/trích đoạn/tiêu chí | 16 | Hiệu lực, xác nhận, nguồn và ánh xạ loại |
| Thẩm định AI/căn cứ/lịch sử/mẫu/stale | 17 | Kết quả thật có giới hạn, có nguồn đối chiếu |
| Gợi ý KPI chấp nhận/từ chối | 18 | Từ phiên phù hợp; KPI cần người rà soát |
| Ánh xạ/đồng bộ/thử lại/nháp nguồn ngoài | 18 | Cần nguồn khả dụng; phân biệt log cũ và lần chạy mới |
| Dashboard/báo cáo/lọc/phân trang/CSV | 01, 19 | Hợp lệ khác tổng số; đúng quyền xuất |
| CV/preview/in PDF/công khai/cập nhật/đổi link/ngừng | 20 | Bản nháp khác công khai, link cũ mất hiệu lực |
| Thông báo đã đọc/điều hướng | 07, 12, 21 | Tới đúng hồ sơ và số chưa đọc |
| Lịch cá nhân CRUD/hoàn thành/mở lại/lịch chung | 21 | Không sửa sự kiện hệ thống như lịch riêng |
| Sáng/tối/điện thoại | 21 | Điều hướng, card và modal sử dụng được |
| Admin quyền/phạm vi/đại diện/danh mục/tổ chức | 22 | Hiệu lực, đơn vị con, tài khoản phụ |
| Kiểm soát quyền/trạng thái/xung đột/validation | 23 | Chặn đúng, không ghi đè/mất lịch sử |
| SQL Server/backup/kiểm thử kỹ thuật | 24 | Phụ lục kỹ thuật, không phải chức năng UI mới |

## 5. Những phần không giới thiệu thành tính năng đã có

- AI tự duyệt/trao thưởng, độ chính xác đã được chứng nhận hoặc suy ra từ video.
- Ban hành quyết định pháp lý, phiên họp/biểu quyết đa số của Hội đồng.
- Upload file độc lập vào vòng bổ sung đề nghị: hiện căn cứ tệp đi qua thành tích/quyết định nguồn.
- Sửa/đóng kỳ bằng nút riêng khi UI chỉ đang có mở kỳ.
- Email, hệ thống KPI bên ngoài hoặc nhà cung cấp AI đã kết nối thật chỉ vì có form cấu hình.
- Backup toàn bộ DB và tệp đã đủ khi còn tệp tham chiếu cũ bị thiếu.
- Admin được phép thực hiện mọi thao tác nghiệp vụ chỉ bằng vai trò Admin.

Các API kỹ thuật như index trích đoạn, retrieve/explain RAG, health, migration và backup có thể trình bày trong phụ lục nếu cần. Không dựng thêm thao tác trên UI khi source chưa cung cấp giao diện tương ứng.

## 6. Cách quay và điểm cắt

- Trước mỗi cảnh hiển thị 2 giây: tên vai trò, mục tiêu và hồ sơ đang dùng. Khi đổi vai trò nói ngắn gọn “Chuyển sang Quản lý đơn vị”.
- Khi nhập form: nhập các trường đặc trưng ở tốc độ thường; có thể tăng tốc phần nhập dài. Không tăng tốc cảnh kết quả trạng thái, lỗi, lịch sử, bản chụp hoặc quyền bị chặn.
- Mỗi cảnh giữ đủ trước → thao tác → sau. Không chỉ lướt menu hoặc dùng hồ sơ đã hoàn tất để thay thế toàn bộ thao tác.
- Có thể chia thành ba phần: **A. Luồng nghiệp vụ chính (01–15); B. AI và tiện ích (16–21); C. Quản trị và kiểm soát (22–24)**. Tổng thời gian có thể tăng nếu quay cả những nhánh tùy điều kiện.
- Bản 12–15 phút lấy 01, rút 04/06, giữ 07/10–13, tóm tắt 15, chọn điểm nổi bật 17/19/20, kết bằng 24; đưa các nhánh và quản trị vào video đầy đủ.
- Trước khi quay thật duyệt lại ma trận, xác nhận các tích hợp ngoài, dữ liệu nguồn và tài khoản còn hiệu lực. Sau quay đánh dấu cảnh đã quay/đã kiểm chứng, không đánh dấu đạt trước.

## 7. Nguồn đối chiếu trong dự án

- `docs/USER_GUIDE.md`: nghiệp vụ và vai trò; một số ghi chú migration PostgreSQL là lịch sử, hiện chạy SQL Server.
- `frontend/src/routes/AppRoutes.jsx`, các trang và component hiện hành: quyền mở trang, hành động có trên UI.
- `backend/src/modules/*`: điều kiện nghiệp vụ, trạng thái và quyền thực thi.
- `docs/testing/SQLSERVER_MIGRATION_REPORT.md`: môi trường đã chuyển đổi và giới hạn kiểm chứng; không dùng thay kịch bản chức năng.

Tài liệu này cần được cập nhật nếu source/quyền/dữ liệu mẫu thay đổi trước ngày quay.
