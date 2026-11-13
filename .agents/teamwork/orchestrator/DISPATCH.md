## 2026-11-12T12:20:20Z

Tái cấu trúc toàn diện hệ thống sang Nền tảng Lưu trữ Thành tích Cá nhân & Trợ lý AI Hỗ trợ Thi đua - KPI (Smart Achievement Vault & Career Assistant) theo kế hoạch triển khai và các quyết định kỹ thuật của người dùng.

Integrity mode: development

Tài liệu tham khảo:
- `C:\Users\fw622\.gemini\antigravity\brain\f2ea0eeb-5109-4a80-b550-ac96bd3759fc\refactor_plan_achievement_vault_ai_assistant.md`

## Requirements

### R1. Kho Lưu trữ Thành tích Cá nhân & AI Vision Auto-fill
- Thành tích cá nhân do người dùng tạo có trạng thái hiệu lực ngay lập tức (`ACTIVE`), không qua khâu phê duyệt hành chính hay thẩm định hội đồng.
- AI Vision Auto-fill hỗ trợ trích xuất thông tin bằng khen/chứng chỉ (tên thành tích, ngày cấp, đơn vị cấp, số quyết định) từ file ảnh/PDF bằng API miễn phí (Free Tier như Groq `llama-3.2-11b-vision-preview` hoặc Google AI Studio).
- Nếu không có API key, gọi AI lỗi hoặc không tự trích xuất được: hiển thị thông báo nhẹ nhàng giải thích và để người dùng tự nhập tay các trường thông tin như bình thường, không gây gián đoạn luồng sử dụng.

### R2. Trợ lý AI Khám Quy chế, Khám Ngược & Xuất Gói Minh Chứng
- Khám theo quy chế: Đối chiếu thành tích cá nhân với điều kiện danh hiệu/khen thưởng, chỉ rõ tiêu chí đã đạt và tiêu chí còn thiếu.
- Khám ngược (Auto-Discovery): Tự động quét toàn bộ quy chế đang mở và xếp hạng các danh hiệu có tiềm năng đạt cao nhất theo tỷ lệ %.
- Xuất gói minh chứng (.ZIP): Khi đạt quy chế, cung cấp nút tải gói hồ sơ nén file `.ZIP` gồm các minh chứng thỏa mãn tiêu chí được đánh số thứ tự chuẩn (sử dụng thư viện `archiver`).

### R3. Lộ trình KPI & Tích hợp Lịch Nhắc nhở
- Cầu nối Gap Analysis sang KPI: Chuyển các tiêu chí chưa đạt từ AI Check trực tiếp thành các mục tiêu trong lộ trình KPI cá nhân với tiến độ theo dõi.
- Nhắc nhở hạn nộp: Khi AI kiểm tra thấy sắp đạt hoặc khi chuyển thành mục tiêu KPI, hiển thị popup thân thiện hỏi: "Bạn có muốn thêm vào lịch nhắc nhở không?", nếu người dùng đồng ý thì ghi nhận sự kiện hạn nộp vào Lịch cá nhân (Calendar).

### R4. Hồ sơ Năng lực & CV Cá nhân hóa
- Hỗ trợ đường dẫn CV công khai với định dạng Custom Slug cá nhân hóa kèm fallback UUID/ID (ví dụ: `/cv/:slug`), có công tắc Bật/Tắt chế độ công khai (Public/Private), hiển thị thông báo riêng tư khi tắt.
- Hỗ trợ các mẫu giao diện Web dựng sẵn (Academic, Modern, Minimalist) và mẫu tùy biến Custom Template qua file Word (`.docx`) sử dụng placeholder (`docxtemplater` + `pizzip`). Cho phép chỉnh sửa danh sách thành tích đưa vào CV và đồng bộ tức thì.

### R5. Tinh gọn Cây Tổ chức & 4 Vai trò Chuẩn
- Cây tổ chức 3 cấp tinh gọn: Trường -> Khoa -> Bộ môn -> Thành viên / Người dùng tự do.
- 4 vai trò chuẩn: `MEMBER` (mặc định), `DEPARTMENT_HEAD` (Trưởng Bộ môn), `FACULTY_LEAD` (Ban Chủ nhiệm Khoa), `ADMIN` (Quản trị viên).
- Dọn dẹp/loại bỏ các quy trình phê duyệt rườm rà (hội đồng, văn thư, xét duyệt đa tầng). Dashboard cấp Bộ môn và Khoa hỗ trợ quét AI danh sách nhân sự đủ chuẩn và xuất báo cáo thống kê theo năm.

### R6. Triển khai Toàn diện & Linh hoạt Dữ liệu / Script
- Triển khai đầy đủ trên Database (SQL Server migrations/schema mới nếu cần), Backend (Express modules: achievements, ai, kpi, cv, calendar, organizations) và Frontend (React / Tailwind UI pages và routing).
- Nhóm có toàn quyền tạo migration, script seed dữ liệu mới hoặc thiết lập database/schema mới thay thế database cũ nếu database hiện có không phù hợp hoặc không đủ dữ liệu sau khi refactor.

## Verification Resources
- Script kiểm tra database & seed data: Sử dụng script kiểm tra có sẵn (`node database/sqlserver/verify-live.mjs`) hoặc tạo mới migration/script seed và database test riêng phù hợp với cấu trúc mới.
- Automated test suites: Xây dựng và thực thi các bộ automated unit/integration tests cho backend services (achievement auto-fill & manual fallback, criteria evaluator, auto-discovery, dossier packager zip, cv slug/public routing & docx export) và xác minh hoạt động live.

## Acceptance Criteria

### Kho Thành tích & AI Auto-fill
- [ ] Bản ghi thành tích tạo mới nhận trạng thái `ACTIVE` và hiển thị nhãn "Sẵn sàng sử dụng" trên giao diện.
- [ ] Upload ảnh/PDF bằng khen gọi API Vision trích xuất đúng thông tin vào form; nếu không trích xuất được hoặc không có API key, hệ thống hiển thị thông báo thân thiện và cho phép người dùng tự nhập tay thông tin mà không gặp lỗi hệ thống.

### AI Đánh giá, Khám Ngược & Xuất ZIP
- [ ] Khám quy chế trả về đúng danh sách tiêu chí đạt kèm minh chứng và tiêu chí còn thiếu.
- [ ] Khám ngược xếp hạng đúng các quy chế khả thi theo phần trăm hoàn thành.
- [ ] Nút "Xuất gói minh chứng (.ZIP)" tạo và tải xuống file zip chứa đúng các file minh chứng của các tiêu chí đạt.

### KPI & Calendar
- [ ] Nhấn chuyển tiêu chí thiếu thành KPI tạo thành công bản ghi KPI trong năm với mục tiêu cụ thể.
- [ ] Popup nhắc nhở xuất hiện và khi xác nhận, sự kiện hạn nộp được ghi vào Calendar và hiển thị trong danh sách sự kiện cá nhân.

### CV Cá nhân hóa & Slug
- [ ] Truy cập `/cv/:slug` (hoặc UUID) ở chế độ ẩn danh: hiển thị CV đẹp mắt khi `is_public = 1`, hiển thị thông báo hồ sơ riêng tư khi `is_public = 0`.
- [ ] Xuất file `.docx` từ template Word thay thế đúng các placeholder thành tích và thông tin cá nhân.

### Tổ chức & Phân quyền
- [ ] Hệ thống hoạt động chính xác với 4 role: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
- [ ] Trưởng bộ môn và Ban chủ nhiệm quét được nhân sự đạt chuẩn trong đơn vị và xem báo cáo đơn vị.

### Kiểm thử Tự động & Vận hành
- [ ] Migration và dữ liệu kiểm thử (dùng script có sẵn hoặc script seed/database mới được tạo) chạy thành công và kiểm chứng đầy đủ luồng nghiệp vụ.
- [ ] Toàn bộ automated tests cho evaluator, auto-discovery, zip packaging và cv template pass hoàn toàn.


## 2026-11-12T14:46:22Z

Người dùng yêu cầu: "dừng teamwork tí đi". Hãy tạm dừng ngay mọi tiến trình thi công, giữ nguyên vẹn hiện trạng mã nguồn và cơ sở dữ liệu hiện tại, không spawn thêm subagent/worker mới và chuyển sang trạng thái chờ (PAUSED).
