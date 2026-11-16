# Goal: Mở rộng quy chế và bộ seed nghiệp vụ V2

- Ngày ghi nhận: 15/11/2026.
- Trạng thái: Đã triển khai và kiểm chứng ngày 16/11/2026. Bằng chứng, phạm vi kiểm thử và giới hạn: [báo cáo nghiệm thu](../testing/V2_REGULATIONS_AND_SEED_ACCEPTANCE.md).
- Nguồn: Các trao đổi và lựa chọn của người dùng trong chat.
- Nền tảng nghiệp vụ: [PERSONAL_VAULT_V2.md](PERSONAL_VAULT_V2.md).

## 1. Mục tiêu tổng thể

Xây dựng cơ chế tạo, lưu nguồn, công bố, phân phối và sử dụng quy chế cho cá nhân và tổ chức; đồng thời tạo bộ seed liên kết đầy đủ để demo và kiểm thử các luồng nghiệp vụ trên SQL Server.

Người dùng có thể tự lưu thành tích, khám hồ sơ theo phiên bản quy chế được phép sử dụng, nhận diện phần còn thiếu, tạo KPI, bổ sung hồ sơ và khám lại. Kết quả khám thể hiện mức đáp ứng theo dữ liệu đã khai, không phải quyết định công nhận danh hiệu.

Tài liệu này là mục tiêu triển khai. Các quy mô dữ liệu, cách chia tab và chi tiết kỹ thuật được ghi là đề xuất không phải bằng chứng chức năng đã tồn tại.

## 2. Hiện trạng làm điểm xuất phát

- Có quy chế, phiên bản, nhóm tiêu chí và tiêu chí có quy tắc đối chiếu.
- Có quyền quản trị quy chế toàn hệ thống, bản nháp và công bố phiên bản.
- Phiên bản đã công bố không được sửa nội dung trực tiếp.
- Có khám theo quy tắc, lưu lịch sử và nhận biết dữ liệu đầu vào đã thay đổi.
- Minh chứng thành tích lưu file trên ổ đĩa; SQL Server lưu thông tin và liên kết.
- Chưa có đầy đủ cơ chế sở hữu, chia sẻ và tiếp nhận quy chế theo phạm vi bên dưới.
- Chưa có luồng tải file nguồn quy chế theo phiên bản và AI đề xuất tiêu chí từ văn bản.
- Script seed V2 hiện chưa được xây dựng.

Hiện trạng phải được kiểm tra lại khi bắt đầu triển khai; không dùng danh sách này thay cho kiểm thử mã nguồn thực tế.

## 3. Phạm vi sở hữu và phân phối quy chế

Tách ba khái niệm: chủ sở hữu, quyền xem và nơi tiếp nhận/áp dụng. Bốn cách phân phối có thể kết hợp, không nhất thiết là bốn giá trị loại trừ nhau.

| Cách sử dụng | Chủ thể tạo | Ai thấy và sử dụng | Điều kiện tiếp nhận |
|---|---|---|---|
| Cá nhân riêng tư | Cá nhân | Chỉ chính người tạo | Không cần tiếp nhận từ bên khác |
| Nội bộ tổ chức | Người có quyền của tổ chức | Tổ chức, đơn vị con và thành viên bên dưới | Được phân phối theo cây tổ chức |
| Chia sẻ đích danh | Tổ chức sở hữu | Tổ chức nhận và phạm vi bên dưới sau khi chấp nhận | Người có quyền bên nhận chấp nhận hoặc từ chối |
| Công khai | Tổ chức sở hữu bật công khai | Người dùng hệ thống có thể tìm và xem | Cá nhân thêm vào kho; người có quyền áp dụng cho đơn vị |

### 3.1. Quy chế cá nhân

- Cá nhân được tự tạo quy chế để tự khám và định hướng mục tiêu.
- Không yêu cầu quyền quản trị quy chế toàn hệ thống để tạo quy chế riêng tư.
- Người khác không thấy hoặc truy cập qua API bằng cách biết ID hay URL file.

### 3.2. Quy chế nội bộ tổ chức

- Người có quyền tạo và công bố quy chế cho tổ chức của mình.
- Quy chế tự xuất hiện cho các đơn vị con và thành viên trong phạm vi.
- Khoa A không mặc nhiên xem hoặc quản lý quy chế nội bộ riêng của Khoa B.
- Quyền thấy quy chế và điều kiện áp dụng là hai việc riêng: vẫn phải xét đối tượng và ngày hiệu lực.
- Thành viên thừa hưởng quy chế không tự có quyền sửa, chia sẻ hay công bố.

### 3.3. Chia sẻ đích danh

- Có trạng thái chờ xác nhận, đã chấp nhận và đã từ chối.
- Khi còn chờ hoặc đã từ chối, quy chế chưa phân phối xuống thành viên bên nhận.
- Khi chấp nhận, phiên bản được tiếp nhận vào tổ chức nhận và phân phối xuống cây tổ chức đó.
- Bên phát hành giữ quyền sở hữu; bên nhận không sửa bản gốc.

### 3.4. Công khai

- Người dùng có thể tìm và xem quy chế công khai trong kho cộng đồng.
- Cá nhân chọn “Thêm vào kho của tôi” để tự sử dụng.
- Người có quyền chọn “Áp dụng cho đơn vị tôi” để phân phối xuống đơn vị con và thành viên.
- Cá nhân tự thêm không làm quy chế trở thành quy chế chung của tổ chức đang tham gia.
- Không cần xin phép chủ sở hữu cho mỗi lần tiếp nhận quy chế công khai.

## 4. Phiên bản và thời hạn áp dụng

Đây là nguyên tắc đã được người dùng đồng ý:

- Mỗi lần tiếp nhận gắn với một phiên bản đã công bố cụ thể.
- Phiên bản đã công bố giữ nguyên nội dung, bộ tiêu chí và file nguồn.
- Muốn thay đổi phải tạo và công bố phiên bản mới.
- Phiên bản mới tạo thông báo cho bên đã tiếp nhận; không tự động thay phiên bản đang dùng.
- Cá nhân quyết định cập nhật kho của mình; người có quyền tổ chức quyết định cập nhật phiên bản tổ chức áp dụng.
- Thành viên bên dưới dùng theo phiên bản tổ chức đã chọn.
- Kết quả khám cũ giữ nguyên phiên bản và dấu vết dữ liệu đầu vào tại thời điểm khám.
- Tiếp nhận không kéo dài ngày hiệu lực. Không khám với ngày đánh giá ngoài thời hạn phiên bản.
- Nếu phiên bản đang dùng hết hạn mà chưa cập nhật, hiển thị cảnh báo và vẫn giữ lịch sử để tra cứu.

## 5. Nội dung quy chế và luồng nhập

### 5.1. Ba lớp nội dung

| Thành phần | Mục đích |
|---|---|
| File PDF/Word nguồn | Đọc, tải về và kiểm tra căn cứ của phiên bản |
| Văn bản trích xuất | Tìm kiếm và hỗ trợ AI phân tích |
| Tiêu chí có cấu trúc | Đối chiếu hồ sơ, giải thích kết quả và xác định phần còn thiếu |

### 5.2. Luồng từ file

1. Tạo thông tin quy chế và phiên bản nháp.
2. Tải file PDF/Word nguồn.
3. Trích xuất văn bản; hiển thị lỗi hoặc yêu cầu kiểm tra khi không đọc được.
4. AI đề xuất tiêu chí, điều kiện áp dụng và căn cứ từ văn bản.
5. Người tạo kiểm tra, bổ sung và sửa đề xuất.
6. Kiểm tra tính hợp lệ của bộ tiêu chí và công bố phiên bản.

Không tự công bố kết quả AI. Tiêu chí phải có căn cứ truy ngược về nguồn; không tự biến phần thiếu hoặc nội dung chưa rõ thành điều kiện chính thức.

### 5.3. Luồng thủ công

- Cho phép tạo không có file nguồn, nhất là quy chế cá nhân.
- Người tạo nhập tiêu chí và cách tính trực tiếp.
- Phân biệt quy chế tự đặt với quy chế dựa trên văn bản chính thức.
- Ghi rõ điều khoản đã hỗ trợ đánh giá, điều khoản cần đánh giá thủ công và phần chưa hỗ trợ; không ngụ ý đã tự động hóa toàn bộ văn bản.

## 6. Lưu trữ và quyền truy cập file

Hướng lưu trữ đã được người dùng đồng ý:

```text
storage/private/
├── evidences/      # Minh chứng thành tích
└── regulations/    # Nguồn PDF/Word của từng phiên bản quy chế
```

- File thật nằm trên ổ đĩa của máy chạy backend, không lưu nội dung nhị phân trực tiếp trong SQL Server theo thiết kế này.
- SQL Server lưu tên gốc, mã lưu trữ, loại file, dung lượng, mã kiểm tra toàn vẹn, chủ sở hữu và liên kết dữ liệu.
- Văn bản trích xuất và tiêu chí có cấu trúc lưu trong database.
- Mỗi file nguồn phải liên kết đúng phiên bản quy chế.
- Backend kiểm tra quyền trước khi xem hoặc tải file; không mở thư mục private thành đường dẫn static công khai.
- Kiểm tra nội dung/định dạng file, kích thước và tên lưu trữ an toàn.
- Cấu hình được thư mục lưu trữ cho môi trường triển khai.
- Sao lưu và khôi phục phải bao gồm cả database và kho tệp, giữ nguyên liên kết giữa hai phần.

Thư mục trên là bố cục đích. Mã V2 hiện có mặc định lưu minh chứng trong `backend/storage/private/evidences` nếu không đặt `STORAGE_DIR`; cần thống nhất cách phân giải đường dẫn khi triển khai phần quy chế.

## 7. Trải nghiệm sử dụng dự kiến

Kho quy chế đề xuất gồm:

- **Áp dụng cho bạn:** quy chế cá nhân đã thêm và quy chế thừa hưởng từ tổ chức.
- **Do bạn quản lý:** quy chế cá nhân tự tạo và quy chế tổ chức được cấp quyền quản lý.
- **Khám phá công khai:** tìm và tiếp nhận quy chế cộng đồng.
- **Chờ tiếp nhận:** dành cho người có quyền của tổ chức để xử lý chia sẻ đích danh.

Thẻ/chi tiết quy chế thể hiện rõ chủ sở hữu, nguồn tiếp nhận, phạm vi, phiên bản, đối tượng và thời hạn hiệu lực. Phân biệt hành động thêm cá nhân, áp dụng cho tổ chức và cập nhật phiên bản.

## 8. Bộ seed theo kịch bản nghiệp vụ

### 8.1. Mục tiêu

Tạo môi trường dữ liệu liên kết để vừa demo vừa kiểm tra tính đúng. Không chỉ thêm nhiều bản ghi để làm đầy giao diện.

### 8.2. Quy mô khởi điểm đề xuất

Các con số sau là đề xuất, có thể điều chỉnh theo ma trận kịch bản:

- Một Trường, ba Khoa, mỗi Khoa hai Lớp.
- Một Trường khác để kiểm tra tách biệt tổ chức.
- Một đơn vị Đoàn/Hội độc lập để chia sẻ đích danh.
- Một nhóm độc lập ngoài cây Trường.
- Khoảng 20–25 tài khoản.
- Phần lớn tài khoản có 3–8 thành tích; giữ một số hồ sơ rỗng có chủ đích.

### 8.3. Tài khoản và quan hệ tổ chức

- Quản trị hệ thống và quản lý quy chế toàn hệ thống.
- Quản lý Trường, quản lý từng Khoa.
- Người chỉ được xem, người được chạy khám và các quyền tổ chức tách biệt.
- Sinh viên, giảng viên, nhân viên trong các đơn vị khác nhau.
- Người không thuộc tổ chức nào.
- Người thuộc nhiều tổ chức.
- Người đã rời tổ chức hoặc có quyền hết hạn.
- Người đang chờ lời mời tham gia.

Mỗi tài khoản có mô tả mục đích demo, phạm vi truy cập và tình huống nổi bật.

### 8.4. Quy chế và nguồn thực tế

- Tìm văn bản thực tế của Nhà nước, trường và tổ chức từ nguồn chính thức.
- Kiểm tra hiệu lực, văn bản sửa đổi/thay thế, đối tượng và thời điểm áp dụng trước khi cấu hình.
- Lưu file nguồn, URL xuất xứ, ngày thu thập, thông tin phiên bản và căn cứ từng tiêu chí.
- Có quy chế cấp Trường, riêng Khoa, cá nhân, chia sẻ đích danh và công khai.
- Không gán một văn bản Nhà nước cho Trường/Khoa như thể đơn vị đó là bên ban hành; phân biệt cơ quan ban hành nguồn và chủ thể quản lý bản cấu hình trong ứng dụng.
- Nếu không có nguồn thực tế phù hợp cho Khoa/cá nhân, tạo quy chế mẫu và ghi rõ giả lập.
- Không tự nhận mọi điều khoản của văn bản đều đã được cấu hình đối chiếu.

### 8.5. Thành tích và minh chứng

- Đa dạng học tập, ngoại ngữ, nghiên cứu, hoạt động cộng đồng, giải thưởng và chứng nhận chuyên môn.
- Có nhiều năm, loại thành tích, đơn vị cấp, giá trị và thuộc tính phục vụ tiêu chí.
- Có minh chứng PDF/ảnh mô phỏng, thành tích chưa có minh chứng, thiếu thuộc tính và thành tích trong thùng rác.
- Người dùng, quan hệ thành viên và minh chứng mô phỏng phải được nhận diện là dữ liệu demo.
- Minh chứng tự tạo ghi rõ “DỮ LIỆU DEMO”; không giả làm chứng chỉ thật của người thật.

### 8.6. Ma trận kịch bản tối thiểu

| Nhóm | Kịch bản phải có | Kết quả mong đợi |
|---|---|---|
| Riêng tư | Tài khoản khác biết ID quy chế/file cá nhân | Không được truy cập |
| Nội bộ | Trường ban hành cho cây con | Khoa/Lớp/thành viên đúng phạm vi thấy |
| Tách biệt | Khoa A và Khoa B | Không lộ quy chế riêng của nhau |
| Chia sẻ | Chờ, chấp nhận, từ chối | Chỉ phân phối xuống sau chấp nhận |
| Công khai | Cá nhân thêm và tổ chức tiếp nhận | Đúng phạm vi, không chuyển sở hữu |
| Phiên bản | Bản cũ đang dùng, bản mới đã công bố | Thông báo, không tự cập nhật |
| Hiệu lực | Nháp, tương lai, hiện hành, hết hạn | Chỉ khám phiên bản công bố hợp lệ tại ngày xét |
| Hồ sơ đầy đủ | Đủ mọi điều kiện bắt buộc | Đạt |
| Thiếu định lượng | Thiếu đúng một tiêu chí phù hợp tạo KPI | Chưa đạt; tạo được KPI từ phần thiếu |
| Thiếu dữ liệu | Thiếu thuộc tính cần thiết | Chưa đủ dữ liệu |
| Thời gian | Thành tích ngoài khoảng xét | Không tính vào tiêu chí đó |
| Đối tượng | Giảng viên khám quy chế chỉ cho sinh viên | Không áp dụng |
| Loại trừ | Nhiều tiêu chí đạt nhưng có điều kiện loại trừ | Không đạt |
| Lịch sử | Hồ sơ đổi sau lần khám | Kết quả cũ giữ nguyên, cảnh báo cần khám lại |
| Quyền tổ chức | Đọc/chạy khám ngoài phạm vi hoặc quyền hết hạn | Bị từ chối |
| Hồ sơ rỗng | Tài khoản chưa có thành tích | Trạng thái trống có hướng dẫn |

### 8.7. Dữ liệu xuyên suốt hành trình

- Lịch sử khám đạt/chưa đạt/chưa đủ dữ liệu/không áp dụng.
- KPI tự tạo và KPI từ phần thiếu; việc con, tiến độ và mục tiêu quá hạn.
- CV riêng tư/công khai với tập thành tích được chọn.
- Lịch cá nhân, hạn hoàn thành và thông báo.
- Các file nguồn và minh chứng thực sự tồn tại, mở được và có liên kết đúng.

Kịch bản demo chính: xem quy chế → khám → nhận phần thiếu → tạo KPI → bổ sung thành tích → khám lại → chọn thành tích đưa vào CV.

### 8.8. Tính tái lập và tài liệu seed

- Có mốc thời gian demo thống nhất và hướng dẫn để kết quả hiệu lực/quá hạn không thay đổi ngoài dự kiến.
- Chạy seed lặp lại theo cơ chế rõ ràng, không nhân đôi dữ liệu hoặc tự xóa dữ liệu ngoài bộ demo.
- Chỉ ghi vào môi trường/database được chỉ định rõ; không tự chạy seed như một bước khởi động ứng dụng.
- Có danh sách tài khoản và hướng dẫn đăng nhập môi trường demo.
- Có danh mục nguồn, file, URL, ngày thu thập và phần điều khoản đã cấu hình.
- Có bảng kết quả mong đợi theo tài khoản và quy chế.
- Có cách kiểm tra dữ liệu, file và cách dọn riêng bộ demo.

## 9. Các giai đoạn triển khai

### Giai đoạn 1 — Chốt mô hình và ma trận kịch bản

- [x] Rà soát schema/API V2 thực tế.
- [x] Thiết kế chủ sở hữu, phạm vi xem, tiếp nhận, chia sẻ và quyền tổ chức.
- [x] Thiết kế liên kết phiên bản và file nguồn.
- [x] Chốt danh mục tổ chức, tài khoản và kết quả seed mong đợi.
- [x] Xác định danh sách văn bản chính thức cần nghiên cứu.

### Giai đoạn 2 — Backend, SQL Server và kho tệp

- [x] Migration bổ sung và ràng buộc toàn vẹn.
- [x] Quy chế riêng tư và quyền quản lý theo tổ chức.
- [x] Kế thừa phạm vi theo cây tổ chức.
- [x] Chia sẻ/chấp nhận/từ chối và tiếp nhận công khai.
- [x] Ghim phiên bản, thông báo bản mới và cập nhật có chủ đích.
- [x] Tải/xem nguồn quy chế với kiểm tra quyền.
- [x] Bảo toàn lịch sử, đồng bộ sao lưu database và kho file.

### Giai đoạn 3 — Nhập quy chế và giao diện

- [x] Tạo thủ công và tải file nguồn.
- [x] Trích xuất văn bản, AI đề xuất và bước người tạo kiểm tra.
- [x] Giao diện kho cá nhân/tổ chức/công khai và chờ tiếp nhận.
- [x] Hiển thị nguồn, phiên bản, hiệu lực và thông báo cập nhật.
- [x] Khám hồ sơ theo đúng quyền, phiên bản, đối tượng và thời điểm.

### Giai đoạn 4 — Seed và xác minh

- [x] Thu thập nguồn thật và ghi nhận hiệu lực/căn cứ.
- [x] Tạo dữ liệu demo và file minh chứng có nhận diện rõ.
- [x] Seed liên kết tổ chức, người dùng, quy chế, thành tích, khám, KPI, CV và lịch.
- [x] Kiểm tra từng trường hợp trong ma trận, gồm truy cập trái phép.
- [x] Chạy kiểm thử tích hợp SQL Server và kiểm tra file thực tế.
- [x] Kiểm tra giao diện với dữ liệu rỗng và đầy đủ trên desktop/mobile.
- [x] Bàn giao tài khoản, nguồn, kịch bản, kết quả kiểm tra và hướng dẫn seed.

## 10. Tiêu chí hoàn thành goal

- [x] Bốn cách phân phối hoạt động qua cả UI và API, không chỉ ẩn/hiện giao diện.
- [x] Người dùng thấy và dùng đúng quy chế theo quyền và quan hệ tổ chức.
- [x] Không tự chuyển phiên bản sau khi bên phát hành cập nhật.
- [x] Lịch sử khám truy ngược được phiên bản, căn cứ và dữ liệu tại thời điểm chạy.
- [x] File riêng tư không bị lộ; file nguồn đúng phiên bản và mở được.
- [x] Quy chế thật có nguồn kiểm chứng; quy chế và minh chứng giả lập được ghi nhãn rõ.
- [x] Bộ seed có đủ tình huống, kết quả mong đợi và quy trình chạy tái lập.
- [x] Có bằng chứng kiểm thử trên SQL Server; không nhận kiểm thử giả lập là kiểm thử database thật.
- [x] Không tái đưa quy trình xét duyệt thành tích cũ vào phạm vi V2.

## 11. Các quyết định khi thiết kế chi tiết

Các câu hỏi gốc dưới đây đã được người dùng chốt theo các chính sách đề xuất trong chat triển khai. Quyết định cụ thể và giới hạn tự động hóa được ghi tại [V2_REGULATION_DECISIONS.md](../testing/V2_REGULATION_DECISIONS.md):

- Khi thu hồi chia sẻ hoặc tắt công khai, bên đã tiếp nhận được tiếp tục dùng đến đâu và còn được xem file nguồn hay không?
- Tổ chức con có được ngừng áp dụng quy chế do cấp trên phân phối không?
- Khi một người nhận cùng quy chế từ nhiều tổ chức với phiên bản khác nhau, hiển thị và chọn bối cảnh khám thế nào?
- Phiên bản nội bộ mới phân phối xuống chính cây tổ chức phát hành theo chính sách nào?
- Có cần phân biệt công khai tìm thấy trong cộng đồng và chỉ xem được khi có liên kết không?
- Cho phép một hay nhiều file nguồn trên một phiên bản; giới hạn dung lượng và xử lý PDF scan/OCR ra sao?
- Những quyền cụ thể nào được tạo, công bố, chia sẻ, tiếp nhận và cập nhật quy chế trong tổ chức?
- Tiêu chí nào có thể tự động hóa, tiêu chí nào cần bổ sung kiểu dữ liệu hoặc người đánh giá?

Các quyết định đã được áp dụng vào migration, API, UI và kiểm thử. Đối chiếu kết quả tại [báo cáo nghiệm thu](../testing/V2_REGULATIONS_AND_SEED_ACCEPTANCE.md).
