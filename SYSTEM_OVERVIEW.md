# Tổng quan hệ thống quản lý thành tích cá nhân

## Phạm vi và cách đọc

Tài liệu phản ánh mã nguồn trong workspace tại thời điểm rà soát. Việc kiểm tra dựa trên đăng ký route, component, lời gọi HTTP, handler, truy vấn SQL và migration. Các tích hợp bên ngoài và dữ liệu trên môi trường triển khai chưa được kiểm thử trong lần rà soát này.

- **Frontend** dùng React Router. Nguồn đăng ký URL là [AppRoutes.jsx](frontend/src/routes/AppRoutes.jsx). Các trang nghiệp vụ nằm trong `frontend/src/pages/` và dùng chung [vaultApi.js](frontend/src/services/vaultApi.js) cùng các hook tải dữ liệu.
- **Backend** dùng Express. [app.js](backend/src/app.js) mount sáu router nghiệp vụ trong `backend/src/modules` và router health. Tiền tố mặc định là `/api/v1`, có thể cấu hình qua `API_PREFIX` và `VITE_API_URL`. Các endpoint bên dưới viết tương đối với tiền tố đó, trừ khi được ghi rõ.
- **Dữ liệu** dùng SQL Server qua [database.js](backend/src/config/database.js). Các tên bảng trong tài liệu thuộc schema `app`. DDL hiện hành nằm trong [migrations SQL Server V2](database/sqlserver/migrations). Tệp minh chứng và tệp nguồn quy chế có metadata trong DB và nội dung tệp trong kho filesystem.
- **Trạng thái** “nối API” nghĩa là có đường đi từ UI tới handler đang mount. Bộ lọc phía trình duyệt, bản xem trước cục bộ hoặc dữ liệu trình bày cố định được ghi riêng. Test fixtures, seed demo, ảnh thiết kế, router cũ và OpenAPI lịch sử nằm ngoài luồng chạy của trang hiện tại.

## Bảng điều hướng và phân quyền

| URL | Trang và component | Chức năng trên trang | Điều kiện truy cập |
| --- | --- | --- | --- |
| `/login` | [AuthPage](frontend/src/pages/AuthPage.jsx) | Đăng nhập, chuyển sang đăng ký hoặc quên mật khẩu | Public. Phiên hợp lệ chuyển về dashboard |
| `/reset-password` | [ResetPassword](frontend/src/pages/ResetPassword.jsx) | Nhập và xác nhận mật khẩu mới | Public. API yêu cầu token khôi phục hợp lệ |
| `/cv/:slug` | [PublicCv.jsx](frontend/src/pages/PublicCv.jsx) | Xem CV được công bố | Public. Slug phải thuộc CV công khai |
| `/` | `Navigate` trong AppRoutes | Chuyển sang `/me/dashboard` | Đăng nhập |
| `/me/dashboard` | [Dashboard](frontend/src/pages/Dashboard.jsx) | Tổng quan, KPI gần đây, lối tắt nghiệp vụ, lịch cá nhân | Đăng nhập |
| `/me/profile` | [Profile.jsx](frontend/src/pages/Profile.jsx), [Cv.jsx](frontend/src/pages/Cv.jsx) | Xem/sửa hồ sơ, đổi mật khẩu, thiết kế và xuất CV ở tab `?tab=cv` | Đăng nhập, dữ liệu cá nhân |
| `/me/cv` | `Navigate` trong AppRoutes | Chuyển sang `/me/profile?tab=cv` | Đăng nhập |
| `/achievements` | [Achievements.jsx](frontend/src/pages/Achievements.jsx) | Danh sách, tìm/lọc, tạo/sửa, thùng rác, khôi phục, đính kèm và trích xuất AI | Đăng nhập, thành tích của chính mình |
| `/kpi` | [Goals.jsx](frontend/src/pages/Goals.jsx) | Mục tiêu, tiến độ, checklist, liên kết thành tích, xóa mục tiêu | Đăng nhập, KPI của chính mình |
| `/me/ai-forecast` | [Discovery.jsx](frontend/src/pages/Discovery.jsx) | Đối chiếu quy chế cá nhân, xem lịch sử, tạo KPI từ tiêu chí thiếu, xuất ZIP, đối chiếu theo tổ chức khi có quyền | Đăng nhập. Khám tổ chức cần quyền theo phạm vi |
| `/regulations` | [RegulationLibrary](frontend/src/pages/RegulationLibrary.jsx) | Duyệt kho, áp dụng, chia sẻ, quản lý tài liệu và phiên bản | Đăng nhập. Phạm vi đọc và thao tác tùy chủ sở hữu, chia sẻ và quyền tổ chức |
| `/regulations/:regulationId` | [RegulationLibrary](frontend/src/pages/RegulationLibrary.jsx) | Mở trực tiếp tài liệu, đọc phiên bản, tiêu chí và tệp nguồn | Như kho quy chế |
| `/organizations` | [Organizations.jsx](frontend/src/pages/Organizations.jsx) | Cây tổ chức, thành viên, lời mời, đơn gia nhập, liên kết cấp trên/cấp dưới, cấp quyền | Đăng nhập. Các thao tác quản lý kiểm tra quyền trên tổ chức |
| `/reports` | [Reports.jsx](frontend/src/pages/Reports.jsx) | Tổng hợp số lượng và tỷ trọng thành tích theo năm và loại | Đăng nhập, dữ liệu cá nhân |
| `/admin` | [Admin.jsx](frontend/src/pages/Admin.jsx) | Tài khoản, quyền toàn hệ thống, danh mục loại thành tích | Route frontend yêu cầu đăng nhập. Menu và API quản trị yêu cầu `SYSTEM_ADMIN` |
| `/me/calendar`, `/calendar`, `/notifications` | `Navigate` trong AppRoutes | Chuyển về dashboard. Lịch nằm trong dashboard, thông báo nằm ở thanh ứng dụng | Đăng nhập |
| `*` | [NotFound](frontend/src/pages/NotFound.jsx) | Màn 404 cho URL không khớp route | Public |

`RequireAuth` chờ khôi phục phiên rồi hiển thị layout hoặc chuyển sang `/login`. Backend kiểm tra phiên và trạng thái tài khoản trong [access.js](backend/src/modules/access.js). Quyền tổ chức lấy từ `org_access_grants` đang hiệu lực và có thể bao gồm đơn vị cấp dưới. `SYSTEM_ADMIN` được đi qua kiểm tra quyền tổ chức trong các helper tương ứng. Quy chế “công khai” vẫn nằm sau đăng nhập của kho quy chế. CV công khai có route và API public riêng.

## Luồng hoạt động theo trang và module

### 1. Đăng nhập, đăng ký và khôi phục mật khẩu

**User Flow.** Người dùng nhập email/mật khẩu, có thể chọn ghi nhớ, chuyển sang form đăng ký hoặc yêu cầu email khôi phục. Link khôi phục mở trang đặt lại mật khẩu với token và form xác nhận mật khẩu. Phiên hợp lệ được phục hồi khi mở lại ứng dụng.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Đăng ký | `POST /auth/register` với `{fullName,email,password,personType}` | Hash mật khẩu, tạo `users`, `person_profiles`, ghi `audit_events` và tạo `auth_sessions` trong transaction. Handler trả access token và cookie phiên |
| Đăng nhập | `POST /auth/login` với `{username,password,rememberMe}`, username là email | Đối chiếu email chuẩn hóa và tài khoản ACTIVE, xác minh hash, tạo `auth_sessions`. Phiên 7 ngày hoặc 30 ngày tùy lựa chọn |
| Khôi phục phiên, đọc hồ sơ, đăng xuất | `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout` | Refresh token đi qua cookie HttpOnly, DB giữ hash. Refresh xoay phiên, logout thu hồi phiên và xóa cookie. Hồ sơ đọc `users`, `person_profiles`, `global_role_grants`, `memberships`, `organizations`, `org_access_grants` |
| Quên mật khẩu | `POST /auth/forgot-password` với `{email}` | Với tài khoản ACTIVE, tạo hash token hết hạn sau 30 phút trong `auth_tokens` và gọi Resend gửi link có token trong URL fragment. Phản hồi dùng thông điệp chung |
| Đặt lại mật khẩu | `POST /auth/reset-password` với `{token,password}` | Kiểm tra token chưa dùng và còn hạn, cập nhật `users`, tiêu thụ token, thu hồi `auth_sessions` và ghi `audit_events` |

**Tình trạng.** Nối API. Gửi email phụ thuộc cấu hình URL ứng dụng, key và địa chỉ gửi. Thiếu cấu hình trả 503. Lỗi gửi từ provider được ghi log và UI vẫn nhận thông điệp chung, nên phản hồi thành công chưa xác nhận thư đã đến. Nguồn mã [authApi.js](frontend/src/services/authApi.js), [AuthContext.jsx](frontend/src/context/AuthContext.jsx), [identityRoutes.js](backend/src/modules/identityRoutes.js).

### 2. Dashboard, lịch và thanh ứng dụng

**User Flow.** Dashboard hiện lời chào, số lượng hoạt động cá nhân, lối tắt sang kho thành tích, quy chế, CV, KPI và danh sách KPI gần đây. Người dùng chọn ngày/sự kiện trên lịch để xem hoặc mở form thêm/sửa/xóa. Chuông thông báo cho phép xem thêm, đọc từng mục hoặc đánh dấu tất cả đã đọc. Ô tìm kiếm gợi ý trang và dữ liệu nghiệp vụ.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Xem tổng quan | `GET /reports`, `GET /kpi/goals?pageSize=4` | Tổng hợp `achievements`, `kpi_goals`, `cvs`, `notifications`, `assessment_runs` theo người dùng. Dashboard dùng số thành tích, KPI và lượt đánh giá. API KPI trả danh sách của chủ sở hữu |
| Xem và sửa lịch | `GET/POST /me/calendar/events`, `PATCH/DELETE /me/calendar/events/:id` | Form gửi `{title,description,startsAt,endsAt,remindAt,status}`. Handler kiểm tra thứ tự thời gian, chuẩn hóa UTC và đọc/ghi/xóa `calendar_events` theo chủ sở hữu. API hỗ trợ thêm `goalId` và kiểm tra trong `kpi_goals` |
| Thông báo | `GET /notifications?page=1&pageSize=10` và trang tiếp theo, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | Trả item, tổng và số chưa đọc. Cập nhật `read_at` trong `notifications` theo người nhận |
| Tìm kiếm chung | `GET /achievements?search=…`, `GET /kpi/goals`, `GET /regulations/documents`, `GET /organizations` | Dùng các API nghiệp vụ và phạm vi tương ứng. Thành tích tìm trên server. KPI/quy chế lọc cục bộ trên tối đa trang đầu 100 kết quả. Link trang được tra từ danh mục điều hướng tĩnh |

**Tình trạng.** Các số đếm, sự kiện và thông báo lấy từ API. Hình minh họa, lối tắt và tên trang tìm kiếm là nội dung tĩnh. Lịch lưu `remindAt` thực tế. Router hiện hành chỉ lưu/đọc mốc thời gian, chưa có luồng phát nhắc lịch được nối từ lịch dashboard. Nguồn mã [DashboardCalendar.jsx](frontend/src/components/calendar/DashboardCalendar.jsx), [GlobalSearch.jsx](frontend/src/components/common/GlobalSearch.jsx), [NotificationDropdown.jsx](frontend/src/components/common/NotificationDropdown.jsx), [supportRoutes.js](backend/src/modules/supportRoutes.js).

### 3. Hồ sơ cá nhân và CV

**User Flow.** Trang hồ sơ mở phần thông tin cá nhân, cho xem tổ chức/quyền và chỉnh sửa thông tin. Người dùng có thể đổi mật khẩu. Trong tab CV, chọn mẫu Modern, Academic hoặc Minimalist, chỉnh tiêu đề/giới thiệu, chọn thành tích, xem trước, lưu, đặt chế độ công khai và chọn hiển thị email/điện thoại. CV công khai có link để sao chép. DOCX được tải từ cấu hình đã lưu.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Đọc/lưu hồ sơ | `GET/PATCH /me/profile`. Form dùng các trường hồ sơ như `fullName,personType,birthDate,phone,headline,biography` | Đọc thông tin tài khoản, vai trò và membership như `/auth/me`. Chỉ cập nhật các trường cho phép trong `person_profiles` của người gọi. Schema cũng nhận `attributes` |
| Đổi mật khẩu | `POST /auth/change-password` với `{oldPassword,newPassword}` | Xác minh mật khẩu cũ, ghi hash vào `users`, thu hồi session/token cũ và cấp lại phiên |
| Thiết kế/lưu CV | `GET /me/cv`, `GET /achievements` qua các trang, `PUT /me/cv` với `{slug,templateId,isPublic,headline,bio,selectedAchievementIds,showEmail,showPhone}` | Kiểm tra slug và quyền sở hữu thành tích, lưu `cvs`, tìm hoặc thêm mẫu trong `cv_templates`, thay danh sách có thứ tự trong `cv_achievements`, ghi audit |
| Xem link công khai | `GET /public/cv/:slug` | Chỉ lấy CV có trạng thái PUBLIC. Kết hợp hồ sơ và thành tích được chọn còn hoạt động. Chỉ trả email/điện thoại khi cài đặt cho phép |
| Xuất Word | `GET /me/cv/export-docx` | Đọc `cvs`, `person_profiles`, `cv_achievements`, `achievements`, dựng DOCX từ tên, headline, giới thiệu và danh sách thành tích |

**Tình trạng.** Lưu và xuất nối API. Mẫu chọn và preview được render ngay trên frontend. API xuất Word có bộ dựng văn bản riêng, gồm các đoạn nội dung nói trên. `GET /cv/templates` có handler trả danh sách mẫu cố định, còn tab CV khai báo lựa chọn mẫu trong component. Nguồn mã [vaultRoutes.js](backend/src/modules/vaultRoutes.js), [supportRoutes.js](backend/src/modules/supportRoutes.js).

### 4. Kho thành tích và minh chứng

**User Flow.** Người dùng xem kho hoạt động hoặc thùng rác, tìm/lọc, mở chi tiết, thêm/sửa thành tích và khôi phục mục đã đưa vào thùng rác. Form cho nhập trường theo loại thành tích, chọn tệp và yêu cầu AI gợi ý dữ liệu. Người dùng xem/chọn đề xuất trước khi lưu. Minh chứng có hành động mở, tải, xóa và thử tải lại khi upload lỗi.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Tải kho, thùng rác và loại | `GET /achievements` và `GET /achievements?trash=true` qua các trang, `GET /achievements/catalogs` | Lọc theo chủ sở hữu và `deleted_at`, nối `achievement_types`, đọc metadata minh chứng. Catalog trả cả schema thuộc tính theo loại |
| Tạo/sửa | `POST /achievements`, `PATCH /achievements/:id` với dữ liệu form như `{title,description,achievedAt,achievementTypeId,issuer,attributes}` | Validate, kiểm tra loại, lưu `achievements` và audit. Schema hỗ trợ `levelCode`. Khi tạo kèm tệp, frontend lưu record trước rồi mới upload |
| Đưa vào thùng rác/khôi phục | `DELETE /achievements/:id`, `POST /achievements/:id/restore` | Cập nhật trạng thái xóa mềm/khôi phục trong `achievements`, kiểm tra chủ sở hữu và ghi audit |
| Tệp | `GET/POST /achievements/:id/evidences` với multipart `file` khi tạo, `DELETE /evidences/:id`, `GET /evidence-files/:id/download` | Kiểm tra thành tích và tệp theo phạm vi đọc, lưu bytes trong filesystem, ghi `evidence_files` với tên, MIME, kích thước, hash và storage key. Tải file trả nội dung nhị phân |
| Trích xuất AI | `POST /achievements/ai-extract` với multipart `file` | Handler kiểm tra tệp, gọi luồng trích xuất theo định dạng trong `vision.js` và trả gợi ý. Thành tích chỉ được ghi qua thao tác lưu riêng |

**Tình trạng.** Danh sách và CRUD nối API. Lọc danh sách kho và thao tác chọn gợi ý xử lý ở frontend. Preview tệp dùng blob từ API hoặc tệp người dùng vừa chọn. Trích xuất AI phụ thuộc provider/cấu hình và có đường lỗi. Upload thất bại sau khi lưu có thể để lại thành tích đã lưu và cho thử upload lại. Backend có API cấp/thu hồi chia sẻ minh chứng `POST /evidence-files/:id/shares` và `DELETE /evidence-shares/:id` trên `evidence_shares`. UI kho hiện nối luồng quản lý và tải tệp. Nguồn mã [vaultRoutes.js](backend/src/modules/vaultRoutes.js), [vision.js](backend/src/modules/vision.js).

### 5. Đối chiếu quy chế cá nhân và tổ chức

**User Flow.** Người dùng xem quy chế đã áp dụng, chọn ngữ cảnh và ngày đánh giá, xem kết quả phân theo tiêu chí, mở lịch sử hoặc tải minh chứng. Tiêu chí thiếu đủ điều kiện có thể tạo KPI. Với quyền tổ chức, người dùng chọn đơn vị, phạm vi cấp dưới, thành viên, quy chế và ngày, chạy đối chiếu rồi xem hoặc gửi kết quả cho thành viên.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Chuẩn bị và xem lịch sử | `GET /regulations/library`, `GET /regulations/versions/:id`, `GET /ai/evaluations/structured/latest`, `GET /ai/evaluations/structured/history`, `GET /ai/evaluations/structured/:id` | Dùng các phiên bản đã áp dụng và quyền hiện tại. Đọc lịch sử, snapshot, chi tiết tiêu chí và minh chứng từ `assessment_runs`, `criterion_results`, `result_evidence` và bảng quy chế |
| Chạy đối chiếu cá nhân | `POST /ai/evaluations/structured` với `{regulation_version_id,evaluation_date,adoption_id}` trong ngữ cảnh đã chọn | Kiểm tra quyền dùng phiên bản đã công bố và hiệu lực theo ngày. Đọc hồ sơ, nhóm/tiêu chí và thành tích thuộc phạm vi. Bộ máy rule đánh giá điều kiện, ghi run, kết quả từng tiêu chí và liên kết chứng cứ. Chi tiết kiểm tra dữ liệu đã đổi để đánh dấu kết quả cũ |
| Tải minh chứng | `POST /ai/export-dossier-zip` với `{runId}`, hoặc `GET /evidence-files/:id/download` | ZIP chỉ lấy run hoàn tất của người dùng và tệp còn hoạt động thuộc phạm vi, từ `assessment_runs`, `criterion_results`, `result_evidence`, `achievements`, `evidence_files` và filesystem. ZIP gồm JSON kết quả và tệp |
| Tạo KPI từ phần thiếu | `POST /kpi/from-ai-gap` với `{source_result_id}` | Kiểm tra kết quả thuộc người dùng, run hoàn tất còn hiện hành và tiêu chí thiếu một lượng tích lũy dương. Tạo `kpi_goals` với mục tiêu bằng lượng còn thiếu và liên kết về kết quả nguồn |
| Khám tổ chức | `GET /organizations/:id/members?includeDescendants=…`, `GET /organizations/units/:id/assessment-options`, `POST /organizations/units/:id/ai-scan` với `{regulation_version_id,evaluation_date,include_descendants,user_ids}` | Kiểm tra quyền `ASSESSMENTS_RUN` và `ASSESSMENTS_VIEW`, phiên bản đủ điều kiện và thành viên đang hiệu lực/ACTIVE trong phạm vi. Ghi batch vào `assessment_batches` và chạy đánh giá cho thành viên được chọn |
| Gửi tóm tắt kết quả | `POST /organizations/units/:id/assessment-notifications` với `{runIds,note,deadline?,resendKey?}` | Kiểm tra quyền và phạm vi run/người nhận, ghi thông báo trong `notifications`. UI gửi theo từng người nhận và theo dõi lỗi từng lượt |

**Tình trạng.** Luồng đối chiếu chính nối API và dùng bộ đánh giá quy tắc có kết quả lưu SQL. Phần đối chiếu không cần LLM. Tiêu chí thủ công hoặc chưa hỗ trợ có trạng thái riêng trong bộ đánh giá. `POST /ai/auto-discovery` và `POST /ai/evaluations/structured/:id/notify` có handler, còn UI trên gọi các endpoint đối chiếu có cấu trúc và thông báo tóm tắt như bảng. Nguồn mã [intelligenceRoutes.js](backend/src/modules/intelligenceRoutes.js), [intelligenceEvaluator.js](backend/src/modules/intelligenceEvaluator.js).

### 6. Mục tiêu / KPI

**User Flow.** Người dùng xem danh sách theo trang, tạo mục tiêu, mở chi tiết, cập nhật trạng thái, nhập tiến độ thủ công, thêm/đánh dấu việc cần làm, liên kết thành tích hoặc xóa mục tiêu. Có thể mở trực tiếp mục tiêu qua `/kpi?goal=…` từ luồng đánh giá.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Danh sách và chi tiết | `GET /kpi/goals?page=…`, `GET /kpi/goals/:id` | Đọc mục tiêu cá nhân chưa xóa và dữ liệu liên quan trong `kpi_goals`, `kpi_tasks`, `kpi_progress`, `kpi_achievements`, `achievements` |
| Tạo, đổi trạng thái, xóa | `POST /kpi/goals` với `{title,target_value,measure_unit,due_date}`, `PATCH /kpi/goals/:id` với `{status}`, `DELETE /kpi/goals/:id` | Kiểm tra mục tiêu và ngày, ghi hoặc xóa mềm `kpi_goals`. API PATCH nhận thêm các trường hợp lệ của mục tiêu |
| Tiến độ | `POST /kpi/goals/:id/progress` với `{current_value}` | Chỉ ghi tiến độ trực tiếp cho nguồn MANUAL, thêm bản ghi `kpi_progress`. Với nguồn ACHIEVEMENTS, backend tính từ thành tích liên kết còn hoạt động |
| Checklist | `POST /kpi/goals/:id/tasks` với `{title}`, `PATCH /kpi/goals/:id/tasks/:taskId` với `{status}` | Kiểm tra sở hữu mục tiêu, ghi `kpi_tasks` và thời điểm hoàn thành khi DONE |
| Liên kết thành tích | `GET /achievements` để chọn, `POST /kpi/goals/:id/achievements` với `{achievement_id,contribution_value}` | Xác minh thành tích hoạt động cùng chủ sở hữu, ghi `kpi_achievements` |

**Tình trạng.** Nối API. API V2 có thêm xóa checklist và gỡ liên kết thành tích. Màn hiện tại nối thêm mục checklist, đổi trạng thái và thêm liên kết. Import CSV và đồng bộ KPI ngoài thuộc lịch sử triển khai. Nguồn mã [intelligenceRoutes.js](backend/src/modules/intelligenceRoutes.js).

### 7. Kho quy chế

**User Flow.** Người dùng duyệt kho theo ngữ cảnh, mở tài liệu và chọn phiên bản để xem hiệu lực, phạm vi áp dụng, quy tắc, nhóm/tiêu chí, căn cứ và tệp nguồn nếu có. Có thể tiếp nhận cho cá nhân hoặc tổ chức có quyền, bỏ áp dụng cá nhân, so sánh phiên bản hiện tại với bản mới trước khi cập nhật, chia sẻ và xử lý chia sẻ đến. Người có quyền quản lý có thể tạo tài liệu và bản nháp, chỉnh cấu hình, công bố, điều chỉnh phân phối và xóa bản nháp/tài liệu khi điều kiện cho phép.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Tải kho và chi tiết | `GET /regulations/documents` qua các trang hoặc `GET /regulations/documents/:id`, `GET /regulations/library`, `GET /regulations/shares`, `GET /regulations/versions/:id`. Dữ liệu phụ từ tổ chức, hồ sơ và catalog | Tính phạm vi đọc và ngữ cảnh cá nhân/tổ chức từ `regulations`, `regulation_versions`, `criterion_groups`, `criteria`, `regulation_shares`, `regulation_adoptions`, `regulation_personal_exclusions` và dữ liệu quyền/membership |
| Tạo tài liệu/bản nháp | `POST /regulations/documents` với `{code,name,first_version,…}`, `POST /regulations/documents/:id/versions` với nhãn, kỳ hiệu lực, metadata nguồn, phạm vi và quy tắc tổng hợp | Xác định chủ sở hữu cá nhân hoặc `owner_organization_id`, kiểm tra quyền và kỳ hiệu lực. Ghi `regulations` và `regulation_versions` |
| Chỉnh nhóm/tiêu chí | `POST /regulations/versions/:id/{groups,criteria}`, `PATCH /regulations/{groups,criteria}/:id` | Nhóm gửi mã, tên và toán tử. Tiêu chí gửi thêm `rule`, căn cứ, nhóm, cờ bắt buộc/loại trừ và dữ liệu mô tả khi có. Kiểm tra bản nháp, ghi `criterion_groups` hoặc `criteria` |
| Công bố/xóa | `POST /regulations/versions/:id/publish`, `DELETE /regulations/versions/:id`, `DELETE /regulations/documents/:id` | Kiểm tra quyền, trạng thái và ràng buộc dữ liệu. Công bố yêu cầu bộ tiêu chí hợp lệ và review trước nếu có tệp nguồn. Cập nhật `regulation_versions`, hoặc xử lý các hàng tài liệu/nháp liên quan khi xóa được |
| Phân phối và áp dụng | `PATCH /regulations/documents/:id/distribution` với `{is_public}` hoặc `{is_internal}`. `POST /regulations/versions/:id/adopt` với `{}` hoặc `{organization_id}`. `DELETE /regulations/versions/:id/adopt` để bỏ áp dụng cá nhân | Cập nhật phạm vi trong `regulations`, ghi phiên bản áp dụng trong `regulation_adoptions`. Bỏ áp dụng cá nhân cập nhật trạng thái tiếp nhận và ghi loại trừ khi cần. So sánh bản cũ/mới dùng hai phản hồi chi tiết ở frontend |
| Chia sẻ | `POST /regulations/versions/:id/shares` với đích chia sẻ người dùng hoặc tổ chức, `POST /regulations/shares/:id/respond` với `{accept}`, `POST /regulations/shares/:id/revoke` | Kiểm tra quyền chia sẻ hoặc quyền nhận, lưu/chuyển trạng thái `regulation_shares` và cập nhật ngữ cảnh truy cập |
| Xem/tải tệp nguồn | `GET /regulations/versions/:id/source`, `GET …/source/download`, `GET …/source/preview` | Đọc `regulation_source_files` và filesystem theo phạm vi đọc phiên bản. PDF được mở từ blob, DOCX xem dưới dạng text |

**Tình trạng.** Nguồn dữ liệu thư viện và thao tác trên nối API. Quyền viết theo sở hữu cá nhân hoặc quyền tổ chức tương ứng, gồm `REGULATIONS_CREATE`, `REGULATIONS_MANAGE`, `REGULATIONS_PUBLISH`, `REGULATIONS_SHARE`, `REGULATIONS_ADOPT` và `REGULATIONS_UPDATE` theo hành động. Bộ mã nguồn có API upload/trích xuất/sửa văn bản/đề xuất AI/review tệp nguồn. Màn thư viện hiện nối đọc metadata, preview và tải tệp, còn các API ghi tệp nguồn chưa có lời gọi từ màn này. Đề xuất nguồn ở backend dùng AI Pool, Groq hoặc OpenRouter theo cấu hình. Nhãn “Tiêu chí mẫu” có thể đến từ dữ liệu demo đã lưu. Nguồn mã [intelligenceRoutes.js](backend/src/modules/intelligenceRoutes.js), [regulationDistributionRoutes.js](backend/src/modules/regulationDistributionRoutes.js), [regulationSourceRoutes.js](backend/src/modules/regulationSourceRoutes.js), [regulationAccess.js](backend/src/modules/regulationAccess.js).

### 8. Tổ chức

**User Flow.** Người dùng duyệt cây tổ chức, chọn đơn vị, xem lời mời/đơn của mình và xin gia nhập. Người có quyền có thể xem thành viên, mời qua email tài khoản, xử lý đơn, kết thúc tư cách thành viên, đổi tên đơn vị, quản lý quan hệ cấp trên/cấp dưới hoặc cấp quyền cho thành viên. UI có form tạo tổ chức cho admin.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Cây tổ chức và trạng thái của tôi | `GET /organizations`, `GET /me/profile`, `GET /me/invitations`, `GET /me/join-requests` | Đọc `organizations`, `memberships`, `membership_invitations`, `membership_join_requests`, hồ sơ và grants |
| Thành viên | `GET /organizations/:id/members?includeDescendants=auto`, `DELETE /organizations/:id/members/:membershipId` | Đọc theo `MEMBERS_VIEW` và phạm vi cấp dưới. Khi kết thúc membership của người khác, backend yêu cầu `MEMBERS_MANAGE` và kiểm tra bảo vệ người quản lý. Đóng `memberships`, thu hồi grant liên quan trong `org_access_grants` và ghi `audit_events` |
| Mời và phản hồi | `POST /organizations/:id/invitations` với `{email}`, `POST /invitations/:id/respond` với `{accept}` | Tra tài khoản, ghi `membership_invitations`, ghi thông báo. Người nhận hợp lệ phản hồi, khi đồng ý tạo `memberships` theo kiểm tra của handler |
| Xin gia nhập và duyệt | `POST /organizations/:id/join-requests` với `{reason?}`, `GET /organizations/:id/join-requests`, `POST /organizations/:id/join-requests/:requestId/respond` với `{accept}` | Ghi và xử lý `membership_join_requests`, thêm membership khi duyệt, cập nhật thông báo. Danh sách duyệt và phản hồi yêu cầu quyền quản lý thành viên |
| Tạo và đổi tên | `POST /organizations` với `{name,code,organizationType,parentId,managerEmail?}`, `PATCH /organizations/:id` với `{name}` | Kiểm tra quyền và cấu trúc, ghi `organizations`. Luồng tạo cấp quyền ban đầu trong `org_access_grants` cho tài khoản quản lý đã xác định, ghi audit và ghi `organization_link_history` nếu tạo tổ chức con |
| Liên kết đơn vị | `GET /organizations/:id/link-requests`, `POST /organizations/:id/link-requests` với `{targetParentId}`, `POST /organization-link-requests/:id/respond` với `{accept}` | Kiểm tra quyền cấu trúc và quan hệ hợp lệ. Ghi `organization_link_requests`, cập nhật quan hệ trong `organizations` và ghi `organization_link_history` khi áp dụng |
| Quản lý quyền | `GET /organizations/:id/access`, `PUT /organizations/:id/access/users/:userId` với `{grantIds,permissions:[{permissionCode,includeDescendants}]}` | Kiểm tra `ACCESS_MANAGE`, membership và phạm vi được cấp. Đối chiếu snapshot grant, thêm/kết thúc quyền trong `org_access_grants` và ghi `audit_events` |

**Tình trạng.** Các luồng trên nối API và dùng SQL. Cây và bộ lọc trình bày xử lý từ dữ liệu trả về. Mời người dùng là lời mời trong hệ thống đến tài khoản được tra theo email. Backend còn khai báo endpoint chi tiết/xóa tổ chức, danh sách/thu hồi lời mời đơn vị, lịch sử liên kết, cấp/thu hồi grant đơn và gửi thông báo trực tiếp cho tổ chức. Danh mục API bên dưới ghi chúng theo handler. Nguồn mã [identityRoutes.js](backend/src/modules/identityRoutes.js), [access.js](backend/src/modules/access.js).

### 9. Thống kê & Báo cáo

**User Flow.** Người dùng xem tổng số thành tích, bảng theo năm, phân bố theo loại và tỷ trọng, hoặc quay về kho. Nếu kho trống có trạng thái hướng dẫn về kho.

**Data Flow.** `Reports` gọi `GET /achievements` qua các trang và lấy thành tích hoạt động của chính người dùng từ `achievements` và `achievement_types`. Frontend nhóm theo năm của `achievedAt` và `typeName`, rồi tính số lượng và phần trăm. Handler `GET /reports` thuộc luồng tổng quan dashboard.

**Tình trạng.** Dữ liệu thật qua API, công thức và thanh tỷ trọng chạy ở frontend. Trang chưa có nút xuất báo cáo. Nguồn mã [Reports](frontend/src/pages/Reports.jsx), [vaultRoutes.js](backend/src/modules/vaultRoutes.js), [supportRoutes.js](backend/src/modules/supportRoutes.js).

### 10. Quản trị hệ thống

**User Flow.** Quản trị viên xem danh sách tài khoản, lọc theo trạng thái/tên/email, xác nhận bật hoặc vô hiệu hóa tài khoản. Tab phân quyền hiển thị grant đang hiệu lực và cho cấp/thu hồi `SYSTEM_ADMIN`. Tab danh mục hiển thị loại thành tích và có form thêm mã/tên.

| Thao tác | Frontend → API | Xử lý backend → DB |
| --- | --- | --- |
| Danh sách và trạng thái tài khoản | `GET /admin/users`, `PATCH /admin/users/:id` với `{accountStatus:'ACTIVE'|'DISABLED'}` | Đọc `users` và `person_profiles`, kiểm tra điều kiện bảo vệ quản trị, cập nhật trạng thái, thu hồi phiên khi vô hiệu hóa và ghi audit |
| Vai trò toàn hệ thống | `GET /admin/global-roles`, `POST /admin/global-roles` với `{userId,roleCode:'SYSTEM_ADMIN'}`, `DELETE /admin/global-roles/:id` | Đọc grant hiệu lực, tạo hoặc kết thúc quyền trong `global_role_grants`, ghi audit và kiểm tra ràng buộc quản trị |
| Danh mục loại thành tích | `GET /achievements/catalogs`, `POST /achievements/catalogs` với `{code,name}` | Đọc loại đang hoạt động. Thêm loại vào `achievement_types` yêu cầu `SYSTEM_ADMIN` |

**Tình trạng.** Nối API. Ô lọc tài khoản xử lý cục bộ. Menu ẩn với người thiếu role, còn URL trực tiếp vẫn qua guard đăng nhập và các API quản trị trả lỗi phân quyền. Danh mục này có UI thêm loại, hiện chưa có action sửa/xóa loại. Nguồn mã [identityRoutes.js](backend/src/modules/identityRoutes.js), [vaultRoutes.js](backend/src/modules/vaultRoutes.js).

## Danh mục endpoint đang được đăng ký

Các phương thức liệt kê trên cùng dòng dùng chung đường dẫn hoặc nhóm đường dẫn được ghi rõ. Handler có thể yêu cầu quyền, trạng thái hoặc phạm vi dữ liệu ngoài xác thực phiên.

| Router | Method và đường dẫn |
| --- | --- |
| [app.js](backend/src/app.js), [health](backend/src/health/healthRoutes.js) | `GET /` ở gốc server. Theo tiền tố API có `GET /health`, `GET /health/readiness` |
| [Identity](backend/src/modules/identityRoutes.js) · tài khoản | `POST /auth/{register,login,refresh,logout,forgot-password,reset-password,change-password}`; `GET /auth/me`; `GET/PATCH /me/profile` |
| Identity · tổ chức | `GET/POST /organizations`; `GET/PATCH/DELETE /organizations/:id`; `GET /organizations/:id/members`; `DELETE /organizations/:id/members/:membershipId` |
| Identity · gia nhập và lời mời | `GET /me/invitations`, `GET /me/join-requests`; `GET/POST /organizations/:id/{join-requests,invitations}`; `POST /organizations/:id/join-requests/:requestId/respond`; `POST /invitations/:id/respond`; `DELETE /invitations/:id` |
| Identity · quyền, cấu trúc, thông báo | `GET/POST /organizations/:id/access`; `PUT /organizations/:id/access/users/:userId`; `DELETE /organizations/:id/access/:grantId`; `GET/POST /organizations/:id/link-requests`; `GET /organizations/:id/link-history`; `POST /organization-link-requests/:id/respond`; `POST /organizations/:id/notifications` |
| Identity · admin | `GET /admin/users`; `PATCH /admin/users/:id`; `GET/POST /admin/global-roles`; `DELETE /admin/global-roles/:id` |
| [Vault](backend/src/modules/vaultRoutes.js) · kho | `GET/POST /achievements`; `GET/PATCH/DELETE /achievements/:id`; `GET/POST /achievements/catalogs`; `POST /achievements/ai-extract`; `POST /achievements/:id/restore` |
| Vault · minh chứng và CV | `GET/POST /achievements/:id/evidences`; `DELETE /evidences/:id`; `GET /evidence-files/:id/download`; `POST /evidence-files/:id/shares`; `DELETE /evidence-shares/:id`; `GET /cv/templates`; `GET/PUT /me/cv`; `GET /public/cv/:slug` |
| [Intelligence](backend/src/modules/intelligenceRoutes.js) · quy chế | `GET/POST /regulations/documents`; `GET/PATCH/DELETE /regulations/documents/:id`; `POST /regulations/documents/:id/versions`; `GET/PATCH/DELETE /regulations/versions/:id`; `POST /regulations/versions/:id/{publish,groups,criteria}`; `PATCH/DELETE /regulations/{groups,criteria}/:id` |
| [Distribution](backend/src/modules/regulationDistributionRoutes.js) | `GET /regulations/library`; `PATCH /regulations/documents/:id/distribution`; `POST/DELETE /regulations/versions/:id/adopt`; `POST /regulations/versions/:id/shares`; `GET /regulations/shares`; `POST /regulations/shares/:id/{respond,revoke}` |
| [Source](backend/src/modules/regulationSourceRoutes.js) | `GET/POST /regulations/versions/:id/source`; `GET …/source/{download,preview}`; `POST …/source/{extract,ai-propose,review}`; `PATCH …/source/text` |
| Intelligence · đánh giá | `GET/POST /ai/evaluations/structured`; `GET /ai/evaluations/structured/{latest,history,:id}`; `POST /ai/evaluations/structured/:id/notify`; `POST /ai/auto-discovery`; `GET /organizations/units/:id/assessment-options`; `POST /organizations/units/:id/{ai-scan,assessment-notifications}` |
| Intelligence · KPI | `GET/POST /kpi/goals`; `GET/PATCH/DELETE /kpi/goals/:id`; `POST /kpi/from-ai-gap`; `POST /kpi/goals/:id/{progress,tasks,achievements}`; `PATCH/DELETE /kpi/goals/:id/tasks/:taskId`; `DELETE /kpi/goals/:id/achievements/:achievementId` |
| [Support](backend/src/modules/supportRoutes.js) · lịch | `GET/POST /me/calendar/events` và alias `/me/calendar`; `PATCH/DELETE /me/calendar/events/:id`; alias `DELETE /me/calendar/:id` |
| Support · tổng quan, thông báo, xuất tệp | `GET /reports` cùng alias `/reports/dashboard`, `/dashboard`; `GET /selections`; `GET /notifications`; `PATCH /notifications/:id/read`; `POST /notifications/read-all`; `POST /ai/export-dossier-zip`; `GET /me/cv/export-docx` |

## Thành phần hỗ trợ

- Script seed demo và fixture trình duyệt phục vụ kiểm thử hoặc trình diễn. Dữ liệu demo trong SQL đi qua API và kiểm quyền như dữ liệu nhập từ ứng dụng.
- [Cloudflare AI Pool](cloudflare/ai-pool/README.md) có worker và dashboard vận hành riêng.
- Các module, migration và hợp đồng legacy có thể tra cứu trong lịch sử Git. Hợp đồng đang chạy được ghi tại [API Reference](docs/api/API_REFERENCE.md).
