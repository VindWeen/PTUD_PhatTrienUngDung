# Báo Cáo Khảo Sát & Thiết Kế Kiến Trúc Lớp Frontend (Frontend Survey & Architectural Plan)

**Dự án**: Nền tảng Lưu trữ Thành tích Cá nhân & Trợ lý AI Hỗ trợ Thi đua - KPI (Smart Achievement Vault & Career Assistant)  
**Tác giả**: Teamwork Explorer (Frontend Survey Specialist)  
**Thời gian hoàn thành**: 2026-11-12T12:45:00Z  
**Trạng thái**: Hoàn tất khảo sát kiến trúc (Ready for Implementation)

---

## 1. Observation (Các quan sát trực tiếp từ mã nguồn)

### 1.1. Hạ tầng Build, Dependencies & Kiểm thử
- **Vite & Dependencies** (`frontend/package.json`):
  - Dependencies: `react` (v18.3.1), `react-dom` (v18.3.1), `react-router-dom` (v6.28.0), `axios` (v1.7.9), `lucide-react` (v0.468.0), `clsx`, `tailwind-merge`, `exceljs` (v4.4.0).
  - DevDependencies: `@vitejs/plugin-react` (v4.3.4), `tailwindcss` (v3.4.17), `vite` (v6.0.7), `eslint` (v9.20.1).
  - Scripts: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`, `"lint": "eslint src"`, `"format": "prettier --write ..."`.
  - Không có script `"test"` trong `package.json`, nhưng có file test đơn vị chạy với Node.js test runner bản địa: `frontend/src/services/kpiEligibility.test.js`.
- **Kết quả Build & Test trực tiếp**:
  - Lệnh build: `npm run build --prefix frontend` chạy thành công: `✓ 1722 modules transformed`, sinh thư mục `dist/` trong 32.34s, không có lỗi biên dịch.
  - Lệnh test: `node --test frontend/src/services/kpiEligibility.test.js` vượt qua 2/2 tests trong 159.7ms.

### 1.2. Định tuyến & Điều hướng (`AppRoutes.jsx`, `Sidebar.jsx`, `MainLayout.jsx`)
- **Vai trò người dùng cũ**:
  - `frontend/src/routes/AppRoutes.jsx:24`: `const APP_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'];`
  - `AppRoutes.jsx:41`: `const landing = (user?.roles || []).some(r => r === 'COUNCIL') ? '/award-applications' : '/me/dashboard';`
- **Các route xét duyệt hội đồng hành chính cũ cần dọn dẹp**:
  - `AppRoutes.jsx:61`: `<Route path="awards" element={<RequireRole roles={['RECORDS_OFFICER']}><Awards /></RequireRole>} />`
  - `AppRoutes.jsx:62`: `<Route path="award-applications" element={<RequireRole roles={['LECTURER','UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'COUNCIL']}><AwardApplications /></RequireRole>} />`
- **Thanh điều hướng Sidebar (`frontend/src/components/common/Sidebar.jsx:11-23`)**:
  - Hiện chứa các mục xét duyệt: `/award-applications` (Đề nghị khen thưởng), `/awards` (Khen thưởng).
  - Chưa có liên kết trực tiếp tới `/me/cv` trên thanh điều hướng chính.
  - Nhóm nút điều hướng di động (`primaryItems` dòng 45) vẫn gắn cứng các trang xét duyệt cũ: `['/me/dashboard', '/achievements', '/award-applications', '/kpi', '/awards']`.
- **Định tuyến Public CV hiện tại (`AppRoutes.jsx:46`)**:
  - `<Route path="/cv/:id" element={<PublicCv />} />` chưa hỗ trợ Custom Slug linh hoạt (`/cv/:slug`), chưa xử lý triệt để trạng thái Private không tìm thấy.

### 1.3. Kho Thành tích Cá nhân & AI Vision Ingestion (`Achievements.jsx`)
- **Trạng thái thành tích cũ (`frontend/src/pages/Achievements.jsx:42-50`)**:
  - Các trạng thái quy định: `DRAFT` (Bản nháp), `SUBMITTED` (Chờ duyệt), `NEED_CORRECTION` (Cần bổ sung), `VERIFIED` (Đã xác nhận), `REJECTED` (Từ chối), `CANCELLED` (Đã hủy), `REVOKED` (Đã thu hồi).
  - Chưa có nhãn `ACTIVE` ("Sẵn sàng sử dụng").
  - Giao diện có các nút thao tác xét duyệt hành chính: `SUBMIT`, `VERIFY`, `REQUEST_CORRECTION`, `REJECT`, `CANCEL`, `REVOKE`, `REPLACE` (dòng 557-566).
- **Hộp thoại Thêm thành tích (`Achievements.jsx:206-250`, `470-510`)**:
  - Hiện tại chỉ có form nhập tay các trường: `title`, `description`, `achievementTypeId`, `recognitionYear`, `startDate`, `endDate`, kèm phần tải file minh chứng phụ ở dưới.
  - Chưa có khu vực kéo thả tài liệu bằng khen/chứng chỉ để gọi API Vision AI OCR tự động trích xuất JSON.
  - Chưa có luồng fallback tự nhiên khi không có Groq / Gemini API key hoặc khi OCR thất bại.

### 1.4. Trợ lý AI Khám Quy chế & Khám Ngược (`AIForecast.jsx`)
- **Cấu trúc hiện tại (`frontend/src/pages/AIForecast.jsx:31-100`)**:
  - Phụ thuộc vào RAG giải thích văn bản quy chế chi tiết theo chunk và phiên chạy thẩm định tiêu chí đơn lẻ (`aiEvaluationApi.evaluateStructured`, `aiEvaluationApi.listCriteria`).
  - Thiếu chế độ **Khám Ngược (Auto-Discovery)** quét toàn bộ quy chế đang mở để xếp hạng % khả thi.
  - Thiếu nút **Tải Gói Minh Chứng (.ZIP)** nén file minh chứng thỏa mãn tiêu chí đạt.
  - Thiếu nút **Chuyển thành Mục tiêu KPI** đưa các tiêu chí còn thiếu sang lộ trình phấn đấu.
  - Thiếu **Hộp thoại / Popup gợi ý lưu hạn nộp vào Lịch cá nhân** (Calendar integration).

### 1.5. Lộ trình Phấn đấu KPI (`Kpi.jsx`)
- **Cấu trúc hiện tại (`frontend/src/pages/Kpi.jsx:57-100`)**:
  - Hỗ trợ tạo mục tiêu thủ công, import CSV và đề xuất từ hệ thống cũ.
  - Thiếu thẻ KPI chuyên biệt hiển thị mục tiêu sinh ra từ Gap Analysis của AI Check.
  - Thiếu cơ chế hiển thị tiến độ % tự động cập nhật khi thêm mới thành tích vào kho.

### 1.6. Quản lý CV Cá nhân & Public Link (`CvEditor.jsx` & `PublicCv.jsx`)
- **Trình chỉnh sửa CV (`frontend/src/pages/CvEditor.jsx:104-135`)**:
  - Có các tab chỉnh sửa: Intro, Profile LHU, Education, Experience, Details, Sharing.
  - Chia sẻ CV (`CvEditor.jsx:130-135`) dùng nút `publish`/`unpublish` với `publicId` ngẫu nhiên; chưa có trường nhập và lưu Custom Slug (`slug`).
  - Lựa chọn mẫu CV (`CvEditor.jsx:106`) chỉ gồm 2 mẫu: `classic` (Tối giản) và `modern` (Hiện đại). Thiếu mẫu `academic` (Học thuật).
  - Chưa có giao diện upload Custom Template Word (`.docx`) và nút tải xuống file `.docx` đã render.
  - Chọn thành tích đưa vào CV (`CvEditor.jsx:113`) chỉ lọc theo "Thành tích đã xác nhận" (`data.achievements`), chưa hỗ trợ trạng thái `ACTIVE` của kho mới.
- **Trang xem CV công khai (`frontend/src/pages/PublicCv.jsx:1-19`)**:
  - Gọi `${API_BASE_URL}/cv/${encodeURIComponent(id)}`.
  - Khi không tìm thấy hoặc `is_public = 0`, báo lỗi chung `CV không tồn tại hoặc đã ngừng chia sẻ.`. Cần chuyển thành trang hiển thị thông báo riêng tư thân thiện.
  - Component hiển thị `CvDocument.jsx` mới chỉ phân biệt `modern` và mặc định, chưa hiển thị mẫu `academic` riêng biệt.

### 1.7. Lịch & Nhắc nhở Hạn nộp (`PersonalCalendar.jsx`)
- **Hiện trạng (`frontend/src/components/calendar/PersonalCalendar.jsx`)**:
  - Đã có `CalendarProvider` bao bọc toàn bộ ứng dụng trong `MainLayout.jsx`.
  - Cung cấp hook `useCalendar()` với các hàm `save(draft)`, `remove(event)`, `reload()`, `openCalendar(day)`.
  - Có sẵn component nút lịch `CalendarButton` trên thanh tiêu đề và widget thẻ lịch `PersonalCalendarCard` trên Dashboard.
  - Chưa được liên kết trực tiếp với hạn nộp của các quy chế trong module AI Forecast.

### 1.8. Báo cáo & Quản lý Đơn vị (`Reports.jsx`, `AdminManagement.jsx`, `Organizations.jsx`)
- **Phân quyền và vai trò**:
  - `Reports.jsx:82`: check `roles.some(r => ['ADMIN', 'MANAGER', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE'].includes(r))`.
  - `AdminManagement.jsx:22`: định nghĩa danh sách role cũ (`ADMIN`, `LECTURER`, `UNIT_REPRESENTATIVE`, `MANAGER`, `COUNCIL`, `RECORDS_OFFICER`).
  - Chưa có tính năng "Quét AI toàn đơn vị" để Trưởng Bộ môn (`DEPARTMENT_HEAD`) hoặc Ban Chủ nhiệm Khoa (`FACULTY_LEAD`) quét phát hiện nhân sự đạt chuẩn quy chế.

---

## 2. Logic Chain (Chuỗi lập luận kỹ thuật & Thiết kế kiến trúc)

Dựa trên các quan sát trực tiếp ở Mục 1, chuỗi suy luận kỹ thuật dẫn đến các quyết định tái cấu trúc như sau:

```
[Kho lưu trữ thành tích tự do & tức thì]
  └──> Thành tích không cần qua hàng đợi duyệt của Hội đồng/Văn thư.
  └──> Cần dọn dẹp các route `/award-applications`, `/awards` và các role `COUNCIL`, `RECORDS_OFFICER`.
  └──> Trạng thái thành tích tạo mới: `ACTIVE` ("Sẵn sàng sử dụng").
  └──> Upload ảnh/PDF bằng khen: kích hoạt AI Vision trích xuất tự động -> điền vào form -> cho phép sửa -> Lưu.
  └──> Fallback: AI Vision lỗi/thiếu key -> thông báo nhẹ nhàng -> người dùng tự nhập tay -> Lưu không gián đoạn.

[Trợ lý AI Hỗ trợ Thi đua: Khám quy chế & Khám ngược]
  └──> Tab 1 (Khám theo quy chế): Chọn danh hiệu -> Chạy đối chiếu -> Bảng checklist Đạt / Thiếu.
       ├── Đạt toàn bộ: Kích hoạt nút "Tải Gói Minh Chứng (.ZIP)" -> Tải file nén chuẩn hóa tên.
       ├── Còn thiếu tiêu chí: Hiển thị nút "🎯 Chuyển thành Mục tiêu KPI" -> Gọi API tạo KPI từ gap.
       └── Nếu có hạn nộp quy chế -> Popup hỏi: "Thêm vào Lịch nhắc nhở?" -> Đồng ý -> Ghi vào Calendar.
  └──> Tab 2 (Khám ngược Auto-Discovery):
       └── Quét song song tất cả quy chế mở -> Xếp hạng % hoàn thành -> Giảng viên biết ngay mình đủ chuẩn danh hiệu nào.

[Lộ trình KPI & Calendar]
  └──> Cầu nối Gap Analysis -> KPI: Tiêu chí thiếu chuyển thành thẻ KPI có Target, Thời hạn, Tiến độ.
  └──> Calendar: Tận dụng sẵn `CalendarProvider` / `calendarApi` để nhận các deadline quy chế.

[Hồ sơ Năng lực & CV Cá nhân hóa]
  └──> Public / Private Switch: Cập nhật `is_public` (0 hoặc 1).
  └──> Custom Slug: Nhập slug tùy chọn -> URL `/cv/:slug` (fallback sang UUID).
  └──> Giao diện CV: Hỗ trợ 3 mẫu web chuẩn (Academic, Modern, Minimalist).
  └──> Custom Docx: Cho phép tải lên template Word có placeholder -> Xuất file `.docx` nạp dữ liệu thật.
  └──> Public route: Khi người ngoài truy cập `/cv/:slug`, nếu `is_public = 0` thì hiển thị thông báo hồ sơ riêng tư lịch sự.

[Cây tổ chức 3 cấp & 4 vai trò chuẩn]
  └──> 4 vai trò: `MEMBER` (mặc định), `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`.
  └──> Dashboard cấp Bộ môn/Khoa: Bổ sung công cụ "Quét AI toàn đơn vị" để lọc ra danh sách nhân sự đủ chuẩn theo từng quy chế.
```

---

## 3. Bản Đồ Chi Tiết Thành Phần Frontend Cần Chỉnh Sửa & Thiết Kế Mới

### 3.1. Phân quyền và Định tuyến (`frontend/src/routes/AppRoutes.jsx`)
- **4 Vai trò chuẩn**:
  ```javascript
  export const APP_ROLES = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
  ```
  *(Hỗ trợ ánh xạ tương thích ngược từ các role cũ: `LECTURER` $\to$ `MEMBER`, `MANAGER` $\to$ `DEPARTMENT_HEAD` / `FACULTY_LEAD`)*.
- **Dọn dẹp Route**:
  - ❌ Loại bỏ: `/award-applications`, `/awards`.
  - 🔄 Landing page mặc định: luôn trỏ về `/me/dashboard`.
  - ✅ Bảng định tuyến sạch:
    - `/me/dashboard`: Trang chủ tổng quan cá nhân & widget KPI / Lịch.
    - `/achievements`: Kho Thành tích Cá nhân & AI Vision Ingestion.
    - `/me/ai-forecast`: Trợ lý AI Khám quy chế & Khám ngược (có alias `/ai-forecast`).
    - `/kpi`: Lộ trình Phấn đấu KPI (cầu nối từ AI Gap Analysis).
    - `/me/cv`: Quản lý & Tùy biến CV Cá nhân (Slug, Web Template, Docx Template).
    - `/me/profile`: Hồ sơ năng lực giảng viên.
    - `/cv/:slug`: Đường dẫn Public CV độc lập (không cần đăng nhập).
    - `/reports`: Báo cáo & Thống kê đơn vị.
    - `/organizations`: Cây đơn vị Trường $\to$ Khoa $\to$ Bộ môn.
    - `/admin`: Quản trị tài khoản & Danh mục quy chế / thành tích.

### 3.2. Thanh điều hướng (`frontend/src/components/common/Sidebar.jsx`)
- Cập nhật mảng `navItems`:
  1. `Trang chủ` (`/me/dashboard` - icon `Home`)
  2. `Kho thành tích` (`/achievements` - icon `Award`)
  3. `Trợ lý AI Thi đua` (`/me/ai-forecast` - icon `Cpu` hoặc `Sparkles`)
  4. `Lộ trình KPI` (`/kpi` - icon `Target`)
  5. `Hồ sơ & CV` (`/me/cv` - icon `FileText`)
  6. `Báo cáo & Đơn vị` (`/reports` - icon `BarChart3`, dành cho `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`)
  7. `Cây tổ chức` (`/organizations` - icon `Building2`)
  8. `Quản trị` (`/admin` - icon `ShieldCheck`, dành cho `ADMIN`)
- Cập nhật `primaryItems` của bottom bar di động:
  `['/me/dashboard', '/achievements', '/me/ai-forecast', '/kpi', '/me/cv']`.

### 3.3. Kho Thành tích & AI Vision Ingestion (`frontend/src/pages/Achievements.jsx`)
- **Trạng thái**:
  - Nhãn hiển thị chính: `ACTIVE` $\to$ **"Sẵn sàng sử dụng"** (màu xanh ngọc / emerald dịu mắt).
  - Loại bỏ các nút duyệt hành chính (`SUBMIT`, `VERIFY`, `REQUEST_CORRECTION`, `REJECT`, `CANCEL`, `REVOKE`, `REPLACE`).
  - Giữ các hành động cá nhân cần thiết: `Xem chi tiết`, `Chỉnh sửa`, `Xóa vào thùng rác`, `Khôi phục`.
- **Upload Modal & AI Vision Auto-fill**:
  - Giao diện kéo thả: Cho phép kéo thả file ảnh (`.png`, `.jpg`, `.jpeg`, `.webp`) hoặc `.pdf`.
  - Khi người dùng thả file:
    - Bật trạng thái `isExtracting = true`.
    - Hiệu ứng: Icon xoay nhẹ với thông điệp: *"Trợ lý AI đang đọc thông tin minh chứng..."*.
    - Gọi API: `achievementsApi.extractAiInfo(formData)` trỏ tới endpoint `POST /api/v1/achievements/ai-extract`.
    - Khi có kết quả: Tự động điền các trường trong form:
      - Tên thành tích (`title`)
      - Ngày cấp / Năm công nhận (`issueDate`, `recognitionYear`)
      - Đơn vị cấp / ban hành (`issuer`)
      - Số hiệu / Số quyết định (`decisionNumber`)
      - Loại thành tích (`achievementTypeId`)
    - Hiển thị badge: *"Đã trích xuất tự động bởi AI Vision - Vui lòng kiểm tra lại trước khi lưu"*.
    - Tự động đính kèm file vừa upload vào danh sách `pendingEvidences` của thành tích.
  - **Cơ chế Fallback mượt mà (Graceful Degradation)**:
    - Nếu API trả lỗi (500, 429, không có API Key, mạng ngắt kết nối):
      - Hiển thị thông báo nhẹ (Toast hoặc Banner vàng dịu): *"Không thể tự động đọc bằng chứng bằng AI (hoặc hệ thống chưa cấu hình API key). Bạn vui lòng nhập thông tin bằng tay bên dưới."*
      - Form nhập tay vẫn giữ nguyên trạng thái mở, focus vào ô `Tên thành tích`. File đã chọn vẫn được giữ lại làm minh chứng đính kèm khi bấm "Lưu vào kho".
      - Không throw unhandled exception hoặc crash trang.

### 3.4. Trợ lý AI Khám Quy chế & Khám Ngược (`frontend/src/pages/AIForecast.jsx`)
- **Giao diện 2 Tab hiện đại**:
  - **Tab 1: Khám theo Quy chế (Regulation Check)**:
    - Chọn danh hiệu muốn xét (Dropdown danh sách danh hiệu từ `GET /api/v1/regulations`).
    - Nút "Kiểm tra điều kiện" $\to$ Gọi `POST /api/v1/ai/evaluations/structured`.
    - Kết quả trực quan:
      - Thẻ tóm tắt: Đủ điều kiện / Chưa đủ điều kiện, tỷ lệ hoàn thành (%).
      - Danh sách tiêu chí Đạt: Hiển thị dấu tích xanh ✅, tên tiêu chí, các file minh chứng từ kho thành tích đã khớp.
      - Danh sách tiêu chí Còn thiếu: Hiển thị dấu cảnh báo vàng ⚠️, ghi rõ tiêu chí thiếu, định lượng thiếu (ví dụ: cần 01 bài báo Q1, hiện có: 0).
    - **Hành động khi Đạt**: Nút **"Tải Gói Minh Chứng (.ZIP)"** kích hoạt nổi bật $\to$ Gọi `POST /api/v1/ai/export-dossier-zip` nhận binary blob và kích hoạt trình duyệt download file `GoiMinhChung_[TenQuyChe]_[Nam].zip`.
    - **Hành động khi Thiếu**: Nút **"🎯 Chuyển thành Mục tiêu KPI"** hiển thị nổi bật $\to$ Gọi `POST /api/v1/kpi/from-ai-gap` truyền danh sách tiêu chí thiếu $\to$ Thông báo thành công và có nút dẫn nhanh sang trang KPI.
    - **Popup Lịch Nhắc Nhở**:
      - Nếu quy chế có `submission_deadline`: Hiển thị Modal/Popup thân thiện:
        *"Đợt xét duyệt [Tên danh hiệu] kết thúc vào ngày [DD/MM/YYYY]. Bạn có muốn thêm vào Lịch nhắc nhở không?"*
      - Nút `[Để sau]` và nút `[Thêm vào Lịch]`.
      - Khi bấm "Thêm vào Lịch", gọi `calendarApi.create({ title: 'Hạn nộp hồ sơ ' + regulationName, date: deadline, category: 'DEADLINE' })` và cập nhật thông báo thành công.
  - **Tab 2: Khám ngược (Auto-Discovery)**:
    - Nút lớn: **"🔍 Quét tìm Danh hiệu Khả thi"** (hoặc tự động tải khi mở tab).
    - Gọi API `POST /api/v1/ai/auto-discovery`.
    - Hiển thị danh sách card quy chế xếp hạng theo tỷ lệ hoàn thành từ cao xuống thấp (100% Đạt $\to$ 80% $\to$ 50%...).
    - Mỗi card hiển thị: Tên danh hiệu, tiến độ (ProgressBar), số tiêu chí đạt/tổng số, hạn nộp.
    - Nút bấm trực tiếp trên từng card: "Xem chi tiết", "Tải file ZIP" (nếu 100%), hoặc "Chuyển thành KPI" (nếu thiếu).

### 3.5. Lộ trình Phấn đấu KPI (`frontend/src/pages/Kpi.jsx`)
- Hiển thị danh sách các mục tiêu KPI:
  - Phân biệt rõ mục tiêu được chuyển từ Trợ lý AI Khám quy chế (có huy hiệu: *"Từ Trợ lý AI: [Tên quy chế]"*).
  - Thanh tiến độ động: Hiển thị % hoàn thành dựa trên số lượng mục tiêu vs số lượng thành tích thực tế có trong kho.
  - Thao tác nhanh: Khi người dùng bấm vào mục tiêu, có gợi ý *"Tải minh chứng vào kho thành tích để hoàn thành mục tiêu này"*.

### 3.6. Quản lý CV Cá nhân & Public Link (`CvEditor.jsx` & `PublicCv.jsx`)
- **Trình chỉnh sửa CV (`frontend/src/pages/CvEditor.jsx`)**:
  - **Công tắc Public / Private**: Toggle switch trực quan với nhãn trạng thái *"Công khai"* / *"Riêng tư"*.
  - **Custom Slug**: Ô nhập slug cá nhân (ví dụ: `nguyen-van-an`). Hiển thị preview đường dẫn đầy đủ: `https://.../cv/nguyen-van-an`. Kiểm tra tính hợp lệ (chỉ chấp nhận ký tự a-z, 0-9 và dấu gạch ngang `-`).
  - **Nút "Sao chép link CV"**: Copy đường dẫn công khai vào clipboard.
  - **Lựa chọn Mẫu Web (3 Templates)**:
    1. `academic` — Học thuật: Phong cách truyền thống, font có chân (Serif), cấu trúc mục chuẩn hội đồng học hàm.
    2. `modern` — Hiện đại: Tiêu đề khối màu, bố cục 2 cột năng động, avatar và màu nhấn hiện đại.
    3. `minimalist` — Tối giản: Bố cục gọn gàng, tinh tế, tập trung vào nội dung và ấn tượng thị giác sạch sẽ.
  - **Tùy biến Custom Word Template (`.docx`)**:
    - Khu vực upload file `.docx` mẫu cá nhân (`POST /api/v1/me/cv/custom-template`).
    - Bảng hướng dẫn danh sách placeholder được hỗ trợ:
      `{{HoTen}}`, `{{Email}}`, `{{SoDienThoai}}`, `{{ChucDanh}}`, `{{GioiThieu}}`, `{{#ThanhTich}} {{TenThanhTich}} - {{Nam}} {{/ThanhTich}}`, `{{#HocVan}} ... {{/HocVan}}`.
    - Nút **"Tải CV bản Word (.docx)"**: Gọi `GET /api/v1/me/cv/export-docx` và tải về file `.docx` đã render dữ liệu thật của giảng viên.
  - **Chọn thành tích đưa vào CV**: Hiển thị danh sách tất cả thành tích `ACTIVE` trong kho thành tích cá nhân để tích chọn đưa vào CV.
- **Trang xem CV công khai (`frontend/src/pages/PublicCv.jsx` & `CvDocument.jsx`)**:
  - Route: `/cv/:slug` (với param `:slug` nhận cả custom slug hoặc public UUID).
  - Không yêu cầu đăng nhập (Public).
  - Khi `is_public = 0`: Hiển thị card thông báo lịch sự:
    *"Hồ sơ năng lực này hiện đang ở chế độ riêng tư hoặc người sở hữu chưa công khai. Vui lòng liên hệ với chủ nhân hồ sơ nếu bạn cần xem thông tin."*
  - Khi `is_public = 1`: Render toàn bộ nội dung CV theo đúng template đã chọn (`academic`, `modern`, `minimalist`) với giao diện sạch, không dính thanh menu hệ thống.

### 3.7. Báo cáo & Bảng điều khiển Đơn vị (`Reports.jsx`)
- Dành cho `DEPARTMENT_HEAD` (Trưởng Bộ môn) và `FACULTY_LEAD` (Ban Chủ nhiệm Khoa):
  - Bổ sung tab / công cụ: **"Quét AI Tìm Ứng Viên Đủ Chuẩn"**:
    - Trưởng đơn vị chọn 1 danh hiệu quy chế đang mở xét.
    - Bấm nút **"Bắt đầu Quét toàn đơn vị"** $\to$ Hệ thống gọi API AI đối chiếu kho thành tích của tất cả thành viên trong bộ môn / khoa với tiêu chuẩn quy chế.
    - Hiển thị danh sách bảng:
      - Họ tên thành viên
      - Tỷ lệ đạt (%)
      - Trạng thái: Đạt chuẩn / Cần bổ sung thêm / Chưa đủ chuẩn
      - Chi tiết tiêu chí đạt và thiếu
    - Nút hành động: "Xuất danh sách (Excel)" hoặc "Gửi nhắc nhở".
  - Chức năng xuất báo cáo thống kê theo năm: Sử dụng thư viện `exceljs` đã có sẵn trong dự án để xuất bảng tổng hợp thành tích khoa/bộ môn chuẩn mẫu.

---

## 4. Đặc Tả Hợp Đồng API Frontend Cần Sử Dụng (API Contracts)

| Phương thức | Đường dẫn API | Tham số / Payload | Mục đích sử dụng trên Frontend |
|---|---|---|---|
| `POST` | `/api/v1/achievements/ai-extract` | `FormData: { file }` | AI Vision trích xuất thông tin bằng khen/chứng chỉ tự động |
| `GET` | `/api/v1/achievements` | `?page=&pageSize=&search=&year=` | Lấy danh sách thành tích cá nhân trong kho (`ACTIVE`) |
| `POST` | `/api/v1/achievements` | `{ title, recognitionYear, achievementTypeId, ... }` | Tạo mới thành tích (mặc định trạng thái `ACTIVE`) |
| `POST` | `/api/v1/ai/evaluations/structured` | `{ regulationId, asOfDate }` | Chạy đối chiếu thành tích cá nhân với quy chế (Tab 1) |
| `POST` | `/api/v1/ai/auto-discovery` | `{}` | Chạy Khám ngược toàn bộ quy chế đang mở (Tab 2) |
| `POST` | `/api/v1/ai/export-dossier-zip` | `{ regulationId }` | Tải về file `.ZIP` nén hồ sơ minh chứng đã đạt |
| `POST` | `/api/v1/kpi/from-ai-gap` | `{ regulationId, missingCriteria: [...] }` | Chuyển tiêu chí thiếu của AI Check thành mục tiêu KPI |
| `GET` | `/api/v1/kpi/goals` | `?subjectType=LECTURER` | Lấy danh sách lộ trình KPI cá nhân |
| `GET` | `/api/v1/me/cv` | Không có | Lấy thông tin cấu hình CV cá nhân, slug, template, danh sách thành tích |
| `PUT` | `/api/v1/me/cv` | `{ slug, isPublic, template, selectedAchievementIds, ... }` | Cập nhật cấu hình CV cá nhân |
| `POST` | `/api/v1/me/cv/custom-template` | `FormData: { file }` | Tải lên file Word mẫu (.docx) |
| `GET` | `/api/v1/me/cv/export-docx` | Không có | Tải về CV đã render theo file Word (.docx) |
| `GET` | `/api/v1/public/cv/:slug` | Params: `slug` | Lấy dữ liệu công khai render CV cho khách vãng lai (khi `is_public = 1`) |
| `GET` | `/api/v1/me/calendar` | Không có | Lấy danh sách sự kiện & hạn nộp cá nhân |
| `POST` | `/api/v1/me/calendar` | `{ title, date, category }` | Ghi nhận hạn nộp quy chế vào lịch cá nhân |
| `POST` | `/api/v1/ai/unit-scan` | `{ unitId, regulationId }` | Quét AI nhân sự toàn bộ môn / khoa đạt chuẩn quy chế |

---

## 5. Caveats (Các giả định & Lưu ý khi triển khai)

1. **Free Tier / Missing API Key cho Vision AI**:
   - Khi Backend không có `GROQ_API_KEY` hoặc `GEMINI_API_KEY`, endpoint `/achievements/ai-extract` sẽ trả lỗi HTTP 400/503 hoặc JSON `{ success: false, fallback: true }`. Frontend **bắt buộc** xử lý lỗi này mềm mại và hiển thị thông báo thân thiện, không bao giờ chặn người dùng nhập tay các trường thông tin.
2. **Dữ liệu thành tích cũ**:
   - Các bản ghi thành tích cũ trong database có trạng thái `VERIFIED` hoặc `DRAFT`. Sau khi migration SQL hoàn tất chuyển sang `ACTIVE`, frontend sẽ lọc và hiển thị toàn bộ bản ghi `ACTIVE` mà không phụ thuộc vào bộ lọc duyệt của cán bộ.
3. **Public CV Caching**:
   - Khi người dùng đổi slug hoặc tắt công tắc Public, client fetch công khai cần sử dụng `cache: 'no-store'` để cập nhật trạng thái ngay lập tức trên trình duyệt ẩn danh.
4. **Không có xung đột thư viện**:
   - Dự án đã có sẵn `exceljs`, `lucide-react`, `tailwindcss`, `axios`. Không cần cài đặt thêm thư viện nặng cho giao diện; việc render file `.docx` và nén file `.ZIP` được thực hiện trực tiếp ở Backend và Frontend chỉ nhận stream download.

---

## 6. Conclusion (Kết luận)

Lớp Frontend hiện tại đã có nền tảng cấu trúc tốt (React 18 + Vite + Tailwind CSS), build sạch không lỗi biên dịch, và các component cốt lõi (`Achievements`, `AIForecast`, `Kpi`, `CvEditor`, `PersonalCalendar`, `Reports`) đã định hình rõ ràng. Kế hoạch điều chỉnh lớp Frontend bao gồm:
1. **Dọn dẹp hệ thống định tuyến & vai trò**: Gỡ bỏ 2 trang xét duyệt rườm rà (`AwardApplications.jsx`, `Awards.jsx`) và đồng bộ 4 vai trò chuẩn (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).
2. **Nâng cấp Kho Thành tích**: Nhãn "Sẵn sàng sử dụng" (`ACTIVE`), hộp thoại kéo thả tích hợp AI Vision auto-fill và cơ chế fallback thủ công mượt mà.
3. **Hiện đại hóa Trợ lý AI**: 2 Tab (Khám theo quy chế + Khám ngược Auto-Discovery), tải gói minh chứng `.ZIP`, chuyển tiêu chí thiếu thành KPI và popup nhắc nhở hạn nộp qua Lịch.
4. **Cá nhân hóa CV**: Custom Slug, công tắc Public/Private, 3 mẫu Web (Academic, Modern, Minimalist) và tích hợp Custom Word template.
5. **Dashboard quản lý cấp đơn vị**: Công cụ "Quét AI toàn đơn vị" cho Trưởng Bộ môn và Ban Chủ nhiệm Khoa.

---

## 7. Verification Method (Phương pháp Kiểm chứng Độc lập)

1. **Kiểm tra Build Frontend**:
   ```powershell
   npm run build --prefix frontend
   ```
   *Kỳ vọng*: Biên dịch thành công 100%, không phát sinh lỗi cú pháp hay thiếu import.

2. **Kiểm tra Unit Test Đơn vị**:
   ```powershell
   node --test frontend/src/services/kpiEligibility.test.js
   ```
   *Kỳ vọng*: Toàn bộ unit tests vượt qua (2/2 pass).

3. **Kiểm tra Giao diện Trực quan (Manual Verification Checklist)**:
   - **Kho Thành tích**: Kéo thả ảnh bằng khen vào modal thêm mới $\to$ kiểm tra form tự động điền các trường; tắt mạng hoặc truyền key sai $\to$ form hiển thị thông báo nhẹ và cho phép nhập tay bình thường.
   - **Trợ lý AI**: Bấm "Kiểm tra điều kiện" $\to$ kiểm tra checklist Đạt/Thiếu; thử bấm "Tải Gói Minh Chứng (.ZIP)" kiểm tra file nén; thử bấm "🎯 Chuyển thành Mục tiêu KPI" kiểm tra mục tiêu mới tại trang KPI; bấm đồng ý popup lịch kiểm tra sự kiện hiển thị trên Calendar.
   - **Khám Ngược**: Bấm sang Tab "Khám Ngược" $\to$ danh sách danh hiệu được xếp hạng giảm dần theo tỷ lệ %.
   - **CV Cá nhân**: Bật công tắc Public, nhập slug cá nhân (ví dụ: `/cv/tran-van-nam`) $\to$ mở tab ẩn danh truy cập link kiểm tra CV hiển thị đẹp mắt theo template đã chọn; tắt công tắc Public $\to$ tải lại tab ẩn danh kiểm tra hiển thị thông báo hồ sơ riêng tư; thử xuất file `.docx`.
   - **Báo cáo Đơn vị**: Đăng nhập tài khoản Trưởng Bộ môn $\to$ chạy quét AI toàn đơn vị và xem danh sách nhân sự đạt chuẩn.
