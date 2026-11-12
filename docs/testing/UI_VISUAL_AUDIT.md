# Rà soát giao diện — 04/11/2026

Danh sách phát hiện ban đầu được giữ bên dưới để đối chiếu. **Đã triển khai cải thiện UI01–UI16 ngày 04/11/2026** theo yêu cầu tiếp theo. Trong quá trình kiểm tra không tạo/duyệt/ghi nhận hồ sơ hay lưu biểu mẫu nghiệp vụ.

## Kết quả sau sửa

| Mục | Thay đổi đã thực hiện | Ảnh sau sửa |
| --- | --- | --- |
| UI01 | Ẩn minh họa ở banner màn nhỏ, chữ có vùng riêng. | [Trang chủ mobile](../../output/playwright/ui-fixed-mobile-dashboard.png) |
| UI02 | Tối đa bốn mục chính và menu Thêm chứa toàn bộ chức năng theo quyền; modal hỗ trợ bàn phím, đăng xuất; có khoảng đáy và safe area. | [Menu](../../output/playwright/ui-fixed-mobile-more.png) |
| UI03 | Thành tích mobile dùng thẻ; bộ lọc xếp dọc, tên/trạng thái/thao tác đọc được. Kiểm chiều rộng tài liệu 390/390px. | [Thành tích mobile](../../output/playwright/ui-fixed-mobile-achievements.png) |
| UI04 | Danh hiệu thu hồi có thẻ xám, nhãn đỏ “Đã thu hồi · chỉ lưu lịch sử”. Áp dụng cả tab khen thưởng trong hồ sơ. | [Hồ sơ](../../output/playwright/ui-fixed-profile.png) |
| UI05 | Phân biệt chưa đến hạn/đang hiệu lực/hết hạn/đã thu hồi theo thời gian và dấu thu hồi. | [Đại diện](../../output/playwright/ui-fixed-admin-delegates.png) |
| UI06 | Hiện tên tài khoản và đơn vị, mã là thông tin phụ; giữ lookup cả bản ghi ngừng hoạt động. | [Phạm vi](../../output/playwright/ui-fixed-admin-scopes.png) |
| UI07 | Trạng thái có màu riêng; mỗi hồ sơ có hướng dẫn bước tiếp theo theo vai trò. | [Danh sách phía sau dialog](../../output/playwright/ui-fixed-council-conclusion.png) |
| UI08 | Tách phân công, trao đổi/bổ sung và kết luận; ô nội dung độc lập; kết luận tích cực/tiêu cực có nhãn và màu riêng. | [Hội đồng](../../output/playwright/ui-fixed-council-conclusion.png) |
| UI09 | Nút Xem chi tiết có chữ; thao tác phụ gom menu có tên; cột tên rộng hơn. | [Desktop](../../output/playwright/ui-fixed-desktop-achievements.png), [menu mobile](../../output/playwright/ui-fixed-mobile-achievement-actions.png) |
| UI10 | Danh sách mục tiêu đứng trước; nhập tệp, gợi ý AI và nguồn đồng bộ thu gọn. | [KPI mobile](../../output/playwright/ui-fixed-mobile-kpi.png) |
| UI11 | Việt hóa trạng thái/nguồn; rút hướng dẫn; thông tin dịch vụ AI/hash nằm trong phần kỹ thuật mở rộng, vẫn giữ chức năng chọn. | [AI](../../output/playwright/ui-fixed-ai.png), [quy định](../../output/playwright/ui-fixed-regulations.png) |
| UI12 | Sắp khoa và bộ môn theo cha–con, thụt lề và ghi tên đơn vị cha; Việt hóa loại; chỉ rõ có thể xem hồ sơ hay chưa có quyền. | [Tổ chức](../../output/playwright/ui-fixed-organizations.png) |
| UI13 | Tên, mô tả, năm của nguồn được lấy từ snapshot bản nộp; liên kết ghi rõ mở thành tích hiện tại. Backend chỉ bổ sung trường trả về, không đổi schema. | [Chuẩn bị khen thưởng](../../output/playwright/ui-fixed-award-form.png) |
| UI14 | Tài khoản demo mở rộng khi cần; bỏ vùng cuộn cắt dòng, thu gọn logo mobile. | [Desktop mở demo](../../output/playwright/ui-fixed-desktop-login-demo.png), [mobile](../../output/playwright/ui-fixed-mobile-login.png) |
| UI15 | Tăng chữ bảng báo cáo, giảm mã ở lớp chính; badge trạng thái hồ sơ; cấp thưởng tiếng Việt; lịch có tháng tiếng Việt. | [Báo cáo](../../output/playwright/ui-fixed-reports.png), [lịch](../../output/playwright/ui-fixed-mobile-calendar.png) |
| UI16 | Thanh lưu bám phía trên, chỉ báo thay đổi chưa lưu, truy cập xem trước/chia sẻ; các phần có khoảng neo tránh thanh lưu. | [CV đang chỉnh](../../output/playwright/ui-fixed-cv-dirty.png) |

### Kiểm tra sau sửa

- `npm run lint` và `npm run build` frontend: PASS. Build còn cảnh báo kích thước chunk ExcelJS có sẵn; không có lỗi build.
- `node --check backend/src/modules/awards/awardService.js`: PASS.
- Sáu trường hợp ngày hiệu lực gồm trước hạn, hết hạn, thu hồi và ranh giới thời gian: PASS.
- Query nguồn hồ sơ đã đề nghị: chạy trong transaction `READ ONLY` rồi `ROLLBACK`, trả tên/mô tả nguồn và ID khớp snapshot.
- Browser desktop 1440×1000 và mobile 390×844: kiểm trực quan các nhóm đã sửa, mở menu, công cụ KPI, form chuẩn bị; nhập ba ô nội dung Hội đồng để xác nhận độc lập; chỉnh CV để xác nhận nhãn chưa lưu và thanh lưu. Không bấm lưu/xét duyệt/công khai hay gửi biểu mẫu nghiệp vụ.
- Đây là kiểm tra UI theo phạm vi thay đổi; chưa chạy mọi luồng ghi dữ liệu đầu cuối hoặc toàn bộ thiết bị/trình duyệt. Ảnh full-page có thể đặt thanh điều hướng cố định tại ranh giới viewport ban đầu; đã chừa khoảng đáy để nội dung cuối trang cuộn lên được.

## Phạm vi và cách kiểm

- Mở ứng dụng thật bằng Edge qua Playwright, frontend local nối backend và DB đang cấu hình; xem ảnh giao diện và đối chiếu source ở các điểm dễ hiểu nhầm.
- Desktop 1440×1000: đăng nhập; trang chủ; hồ sơ năng lực; thành tích và form khai báo; KPI; hồ sơ đề nghị và chi tiết; kho quy định; AI; báo cáo; tổ chức; trình soạn CV; quản trị tài khoản/vai trò/phạm vi/đại diện; sổ khen thưởng và form chuẩn bị; danh sách và chi tiết Hội đồng.
- Mobile 390×844: đăng nhập, trang chủ, hồ sơ, thành tích và form, KPI và form, báo cáo, lịch cá nhân. Tài khoản đại diện dùng để xem mobile chủ yếu là giảng viên; desktop có giảng viên, admin, chuyên viên, Hội đồng.
- Chế độ tối: kiểm mẫu màn quản trị; chưa rà mọi màn ở chế độ tối.
- Chưa kiểm riêng toàn bộ màn quản lý đơn vị/đại diện, đăng ký/quên mật khẩu/reset mật khẩu, CV công khai, mọi tab con quy định/AI, thông báo và mọi trạng thái lỗi/rỗng. Không coi đây là chứng nhận toàn bộ UI đã được kiểm thử.
- Ảnh đặt tại `output/playwright/ui-audit-*.png` trong workspace. Thư mục này là bằng chứng local, có thể không được Git theo dõi. Mã `SCN` và nội dung “MÔ PHỎNG” thuộc dữ liệu demo, không tự xem là lỗi thiết kế.

## Danh sách cần xử lý

Mức **cao**: che nội dung/thao tác hoặc dễ hiểu sai trạng thái. **Vừa**: khó tìm, khó hiểu, thao tác chậm. **Thấp**: trau chuốt và tính nhất quán.

| ID | Mức | Vị trí | Hiện trạng và ảnh hưởng | Hướng sửa đề xuất | Ảnh |
| --- | --- | --- | --- | --- | --- |
| UI01 | Cao | Trang chủ mobile | Hình minh họa phủ lên phần tiêu đề và mô tả banner, chữ chỉ còn một phần. | Tách hình và chữ theo chiều dọc hoặc ẩn hình trên màn nhỏ. | [Ảnh](../../output/playwright/ui-audit-mobile-dashboard.png) |
| UI02 | Cao | Điều hướng mobile | Khoảng 10 mục cùng chen trong một thanh dưới; chữ rất nhỏ, xuống nhiều dòng, vùng bấm sát nhau. Thanh cố định còn phủ lên nội dung tại vị trí đang xem. | Giữ một số mục chính, gom phần còn lại vào “Thêm”; chừa khoảng đáy phù hợp. | [Ảnh](../../output/playwright/ui-audit-mobile-achievements.png) |
| UI03 | Cao | Thành tích mobile | Bộ lọc tràn ngang, lựa chọn bị cắt; bảng vẫn giữ bố cục desktop, chỉ thấy phần đầu và cột đơn vị, trạng thái/thao tác nằm ngoài vùng nhìn. | Dùng card cho mobile hoặc bảng có chỉ dẫn cuộn rõ; xếp lại bộ lọc. | [Ảnh](../../output/playwright/ui-audit-mobile-achievements.png) |
| UI04 | Cao | Hồ sơ năng lực → Danh hiệu | Khen thưởng đã thu hồi vẫn xuất hiện như danh hiệu vàng bình thường, không có nhãn thu hồi; người xem dễ nghĩ còn hiệu lực. Đã đối chiếu query trả cả RECORDED/REVOKED và UI không render trạng thái. | Tách lịch sử thu hồi hoặc hiển thị nhãn/trạng thái rõ, không trình bày như danh hiệu còn hiệu lực. | [Ảnh](../../output/playwright/ui-audit-profile.png) |
| UI05 | Cao | Quản trị → Đại diện có hạn | Bản ghi kết thúc ngày 18/10/2026 vẫn gắn nhãn “Hoạt động” tại lần kiểm 04/11/2026. Nhãn hiện dựa vào trạng thái thu hồi, không phản ánh thời hạn. Đây là lỗi trình bày hiệu lực; chưa kết luận quyền backend bị sai. | Phân biệt “Chưa đến hạn / Đang hiệu lực / Hết hạn / Đã thu hồi”. | [Ảnh](../../output/playwright/ui-audit-admin-delegates.png) |
| UI06 | Vừa | Quản trị → Phạm vi, đại diện | Danh sách ghi “Tài khoản #2”, “Đơn vị #1” thay vì tên dù đây là thông tin chính để kiểm phân quyền. Admin phải tra ID ở nơi khác, dễ nhầm người/đơn vị khi thu hồi. | Hiển thị tên tài khoản, tên đơn vị; ID làm thông tin phụ. | [Ảnh](../../output/playwright/ui-audit-admin-scopes.png) |
| UI07 | Vừa | Hồ sơ đề nghị | Bản nháp, đã nộp, chờ Hội đồng, đang xét và “Không đề nghị” dùng màu rất gần nhau. Chưa có thông tin ngắn “đang chờ ai / cần làm gì tiếp”. | Chuẩn hóa nhóm trạng thái và thêm bước tiếp theo theo vai trò. | [Ảnh](../../output/playwright/ui-audit-applications.png) |
| UI08 | Vừa | Chi tiết Hội đồng | Phân công, ghi ý kiến, yêu cầu bổ sung, đề nghị và không đề nghị nằm chung một hàng với kiểu nút gần nhau; cùng dùng ô ý kiến. Văn bản còn lộ tên `RecordsOfficer`. | Tách nhóm phân công/trao đổi/kết luận, làm rõ căn cứ dùng cho hành động nào; Việt hóa tên vai trò. | [Ảnh](../../output/playwright/ui-audit-council-detail.png) |
| UI09 | Vừa | Thành tích desktop | Nhiều nút chỉ có icon trên mỗi hàng; phải hover mới biết chức năng. Cột trạng thái và loại chủ thể xuống dòng trong khi tên thành tích bị rút gọn. | Để thao tác chính có chữ, gom thao tác phụ; cân lại độ rộng cột. | [Ảnh](../../output/playwright/ui-audit-achievements.png) |
| UI10 | Vừa | KPI | Khối nhập Excel/CSV, gợi ý AI và nguồn KPI đứng trước danh sách mục tiêu, khiến việc xem/sửa mục tiêu phải cuộn nhiều; mobile càng rõ. | Đưa mục tiêu hiện có lên trước, thu gọn các công cụ nhập và thông tin nguồn. | [Desktop](../../output/playwright/ui-audit-kpi.png), [mobile](../../output/playwright/ui-audit-mobile-kpi.png) |
| UI11 | Vừa | KPI, kho quy định, AI | Nhiều nhãn kỹ thuật trong luồng dùng thường: `Import runs`, `employeeId`, `VERIFIED`, `MANUAL`, `Chunks`, hash dài, “Provider”, “Groq→OpenRouter”, “12 Hồ sơ Thử nghiệm (W3-Q4)”. Khối giải thích/cảnh báo dài làm phần thao tác lùi xuống. | Dùng ngôn ngữ nghiệp vụ, ẩn thông tin kỹ thuật trong phần chi tiết; rút gọn hướng dẫn theo vai trò. | [KPI](../../output/playwright/ui-audit-kpi.png), [quy định](../../output/playwright/ui-audit-regulations.png), [AI](../../output/playwright/ui-audit-ai.png) |
| UI12 | Vừa | Tổ chức | Khoa và bộ môn hiển thị như danh sách phẳng, nhãn `FACULTY`/`DEPARTMENT`; quan hệ cha–con và khả năng mở hồ sơ chưa rõ. | Thể hiện phân cấp, Việt hóa loại đơn vị, thêm chỉ dấu xem chi tiết. | [Ảnh](../../output/playwright/ui-audit-organizations.png) |
| UI13 | Vừa | Chuẩn bị khen thưởng | Đã điền sẵn và khóa đúng chủ thể/loại thưởng; tuy nhiên nguồn chỉ hiện “Thành tích #4”, tiêu đề form “hồ sơ #6”, chưa giúp chuyên viên kiểm nhanh nội dung nguồn. | Hiển thị tên thành tích và tóm tắt nguồn cạnh mã; giữ liên kết xem chi tiết. | [Ảnh](../../output/playwright/ui-audit-award-form.png) |
| UI14 | Thấp | Đăng nhập | Danh sách tài khoản demo nằm trong vùng cuộn thấp, dòng cuối bị cắt; logo/đồ họa chiếm nhiều chỗ trên mobile. | Gom tài khoản demo vào phần mở rộng, ưu tiên form đăng nhập trên màn nhỏ. | [Desktop](../../output/playwright/ui-audit-login.png), [mobile](../../output/playwright/ui-audit-mobile-login.png) |
| UI15 | Thấp | Báo cáo, hồ sơ, lịch | Bảng báo cáo dày, chữ phụ nhỏ và nhiều mã; hồ sơ còn nhãn `UNIVERSITY`; lịch hiện “November 2026” giữa giao diện tiếng Việt. Các trạng thái thành tích trong hồ sơ chưa phân biệt mạnh bằng bảng quản lý. | Chuẩn hóa cách dịch, trạng thái, cỡ chữ phụ và giảm mã kỹ thuật ở lớp thông tin chính. | [Báo cáo](../../output/playwright/ui-audit-reports.png), [hồ sơ](../../output/playwright/ui-audit-profile.png), [lịch](../../output/playwright/ui-audit-mobile-calendar.png) |
| UI16 | Thấp | Trình soạn CV | Form dài nhiều màn hình; nút lưu/xuất bản ở cuối nên cần cuộn xa khi chỉnh ở trên. Các nhóm và mục lục đã có style rõ. | Cân nhắc thanh lưu bám theo vùng nhìn và chỉ báo thay đổi chưa lưu. | [Ảnh](../../output/playwright/ui-audit-cv-editor.png) |

## Nhận xét để chọn phạm vi sửa

Không thấy một nhóm trang chính hoàn toàn bỏ style. Form thành tích, sổ khen thưởng và các nhóm CV đã có bố cục tương đối rõ. Phần còn cảm giác thô chủ yếu là bảng mobile, nhãn kỹ thuật và cách ưu tiên nội dung.

Đề xuất đợt đầu xử lý UI01–UI06: ba vấn đề mobile và ba vấn đề đọc đúng danh hiệu/quyền. Đợt sau làm UI07–UI13 để giảm nhầm thao tác và giúp người mới hiểu luồng; UI14–UI16 là phần trau chuốt.

Các nhận xét về khả năng đọc là đánh giá trực quan, chưa đo độ tương phản theo WCAG. Không kết luận lỗi tải vĩnh viễn từ skeleton xuất hiện lúc chuyển tab; một số ảnh chi tiết được chụp trong khi lựa chọn phụ còn tải.
