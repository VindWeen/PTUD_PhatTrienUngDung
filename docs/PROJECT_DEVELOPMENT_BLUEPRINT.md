# PROJECT DEVELOPMENT BLUEPRINT

## Hệ thống Quản lý Hồ sơ Thành tích Số và Hỗ trợ Xét duyệt Khen thưởng thông minh dựa trên Trí tuệ Nhân tạo (AI)

> Cập nhật: 12/09/2026. Blueprint cho nhóm 2 người triển khai 13 tuần môn PTUD và tiếp tục thành KLTN. Quy tắc nghiệp vụ dưới đây là phương án đề xuất, cần đối chiếu với giảng viên hướng dẫn/đơn vị sử dụng ở tuần 1. Tài liệu không xác nhận điều kiện khen thưởng theo pháp luật.

# 1. MỤC TIÊU VÀ PHẠM VI

Tập trung hồ sơ thành tích của giảng viên và tập thể Khoa/Bộ môn, minh chứng và lịch sử theo năm. Tách rõ xác nhận thành tích, ghi nhận kết quả khen thưởng và đề nghị xét khen thưởng.

## 1.1. PTUD — bắt buộc trong 13 tuần

- Đăng nhập, đăng xuất, đổi mật khẩu; phân quyền theo vai trò và phạm vi đơn vị.
- Hồ sơ cá nhân và tập thể; cơ cấu tổ chức và người đại diện đơn vị.
- Danh mục thành tích, danh hiệu/hình thức khen thưởng và năm học.
- Tạo thành tích, nộp minh chứng, yêu cầu bổ sung, gửi lại, xác nhận/từ chối.
- Ghi nhận khen thưởng có quyết định cho cá nhân và tập thể.
- Lịch sử xử lý, phiên bản hồ sơ/minh chứng và audit log.
- Dashboard, tìm kiếm/lọc, báo cáo theo năm và export CSV.
- Thông báo trong ứng dụng khi hồ sơ đổi trạng thái, không yêu cầu realtime.
- Kiểm thử, triển khai demo, tài liệu cài đặt và backup/restore.

## 1.2. Làm thêm khi còn thời gian

Export Excel/PDF, biểu đồ nâng cao, email, preview DOCX, workflow đề nghị khen thưởng nhiều cấp và giao diện Hội đồng. PTUD dùng tập quyền cố định và phân công phạm vi; chưa cần công cụ cấu hình quyền tổng quát.

## 1.3. KLTN

Award Validator Agent, KPI Recommender Agent, RAG, quản lý phiên bản quy định/bộ tiêu chí và tích hợp hệ thống KPI ngoài. Mở rộng workflow đề nghị khen thưởng nếu chưa thực hiện trong PTUD.

Không triển khai AI thật, vector store hoặc workflow engine tổng quát trong 13 tuần đầu. Hội đồng không là điều kiện nghiệm thu PTUD trong phương án này. AI hỗ trợ quyết định, không tự ban hành quyết định trao thưởng.

# 2. THUẬT NGỮ NGHIỆP VỤ

| Khái niệm | Ý nghĩa |
|---|---|
| Chủ thể | Giảng viên hoặc tập thể đơn vị |
| Achievement | Kết quả hoạt động được kê khai, có minh chứng và trạng thái xác nhận |
| AchievementType | Loại kết quả, ví dụ bài báo hoặc đề tài |
| Evidence | Tài liệu chứng minh kê khai, có phiên bản file |
| AwardType | Danh mục danh hiệu/hình thức khen thưởng |
| AwardRecord | Kết quả khen thưởng đã có quyết định, được ghi nhận trong hệ thống |
| AwardApplication | Hồ sơ đề nghị xét mục tiêu khen thưởng, dành cho mở rộng/KLTN |

**Xác nhận thành tích không đồng nghĩa đã được trao danh hiệu.** Dashboard phải hiển thị riêng thành tích đã xác nhận và khen thưởng đã ghi nhận.

Ví dụ số năm liên tục, số bài báo, ngưỡng KPI chỉ minh họa. Không dùng làm quy tắc xét thưởng chính thức khi chưa đối chiếu nguồn áp dụng.

# 3. CÔNG NGHỆ VÀ KIẾN TRÚC

- Frontend: ReactJS, Vite, Tailwind CSS, React Router, Axios.
- Backend: Node.js, Express.js, REST API; controller–service–repository–validator.
- Database: Microsoft SQL Server.
- Auth: JWT access token, refresh token có thể thu hồi, mật khẩu được hash.
- File: kho riêng trên server, tải qua API kiểm tra quyền; tách lớp lưu trữ để đổi sang object storage khi cần.
- Ngôn ngữ PTUD: JavaScript thống nhất, schema validation và tài liệu API cho hợp đồng dữ liệu.
- KLTN: chọn LLM API/model local, LangChain/LlamaIndex và ChromaDB/FAISS sau thử nghiệm nhu cầu, chi phí và điều kiện dữ liệu.

```text
React Web App
     |
Express REST API
     +-- Auth / Roles / Organization scopes
     +-- Lecturer and collective profiles
     +-- Achievements / Evidence / Verification
     +-- Awards / Reports / Notifications / Audit
     +-- SQL Server
     +-- Private file storage
     +-- AI Service (KLTN): Retrieval + Criteria evaluation + LLM
     +-- KPI connector (KLTN): gọi External KPI API
```

Backend quyết định quyền/business rules. Frontend chỉ điều chỉnh giao diện. Không nhúng AI vào controller nghiệp vụ lõi.

# 4. VAI TRÒ VÀ PHẠM VI

Một người có thể có nhiều vai trò. Quyền quản lý gắn với đơn vị được phân công, không tự suy ra từ nơi công tác.

| Vai trò | Quyền chính |
|---|---|
| Lecturer | Xem hồ sơ mình, tạo/sửa/gửi thành tích cá nhân và xem lịch sử |
| UnitRepresentative | Nộp và quản lý thành tích tập thể của đơn vị được giao |
| Manager | Xem/xác nhận thành tích và báo cáo trong phạm vi được cấp |
| RecordsOfficer | Ghi nhận/điều chỉnh khen thưởng có quyết định trong phạm vi được cấp |
| Admin | Quản lý tài khoản, đơn vị, danh mục, quyền/phạm vi, audit; không mặc nhiên có quyền xác nhận |
| Council — mở rộng | Xét hồ sơ đề nghị khen thưởng theo workflow riêng |

- Người tạo/nộp không được tự xác nhận hồ sơ; Manager không được xác nhận thành tích cá nhân mình.
- Đại diện tập thể và xác nhận tập thể là hai quyền riêng.
- Chưa có người xác nhận hợp lệ thì giữ hồ sơ chờ để Admin bổ sung phân công; không tự duyệt.
- Tải file, tìm kiếm, thống kê và export dùng cùng phạm vi với hồ sơ gốc.
- Phạm vi Khoa gồm Bộ môn con khi cấp `IncludeDescendants = true`.

# 5. WORKFLOW XÁC NHẬN THÀNH TÍCH

PTUD dùng một cấp xác nhận theo phân công. Manager có thể phụ trách Bộ môn hoặc Khoa; không mặc định phải qua cả hai.

| Trạng thái | Hành động | Người được phép | Trạng thái sau |
|---|---|---|---|
| DRAFT | Sửa nội dung/minh chứng | Chủ hồ sơ/đại diện | DRAFT |
| DRAFT | Gửi, đủ dữ liệu và ít nhất 1 minh chứng | Chủ hồ sơ/đại diện | SUBMITTED |
| SUBMITTED | Yêu cầu bổ sung, có lý do | Manager hợp lệ | NEED_CORRECTION |
| NEED_CORRECTION | Sửa nội dung/minh chứng | Chủ hồ sơ/đại diện | NEED_CORRECTION |
| NEED_CORRECTION | Gửi lại | Chủ hồ sơ/đại diện | SUBMITTED |
| SUBMITTED | Xác nhận | Manager hợp lệ | VERIFIED |
| SUBMITTED | Từ chối, có lý do | Manager hợp lệ | REJECTED |
| DRAFT / SUBMITTED / NEED_CORRECTION | Hủy, có lý do nếu đã gửi | Chủ hồ sơ/đại diện | CANCELLED |
| VERIFIED | Thu hồi, bắt buộc lý do | Manager hợp lệ | REVOKED |

Manager hợp lệ có quyền hiện tại trong phạm vi và không vi phạm quy tắc tự duyệt.

- Chỉ bản nháp chưa gửi được xóa. Hồ sơ đã gửi giữ lịch sử bằng trạng thái.
- REJECTED/CANCELLED/REVOKED không gửi lại trực tiếp; tạo bản mới liên kết bản cũ nếu cần.
- VERIFIED khóa nội dung/minh chứng. Sửa sai bằng thu hồi và tạo bản thay thế, không ghi đè.
- Mỗi lần gửi lưu snapshot nội dung và đúng phiên bản file được gửi.
- Chuyển trạng thái, lịch sử, audit và thông báo trong cùng transaction database.
- Dùng `rowversion` và điều kiện trạng thái để chặn hai người xử lý đồng thời; thao tác xung đột trả 409.

# 6. BUSINESS RULES DỮ LIỆU

## 6.1. Chủ thể và lịch sử tổ chức

- Mỗi thành tích/khen thưởng thuộc đúng một giảng viên hoặc một đơn vị.
- Hoạt động nhiều người: PTUD tạo hồ sơ riêng từng chủ thể, ghi vai trò đóng góp; không tự gán cho mọi người.
- Thành tích tập thể thuộc đơn vị được ghi nhận, không tự cộng từ cá nhân.
- Lưu lịch sử công tác và đơn vị tại thời điểm phát sinh trên hồ sơ. Chuyển đơn vị không đổi báo cáo lịch sử.
- Trong PTUD, Manager truy cập theo đơn vị lưu trên hồ sơ; đơn vị mới không tự đọc được hồ sơ cũ. Giảng viên vẫn xem toàn bộ hồ sơ mình. Chốt lại chính sách này với đơn vị sử dụng ở tuần 1.
- Tài khoản/đơn vị có dữ liệu được ngừng hoạt động thay vì xóa mất tham chiếu.

## 6.2. Thời gian

- Lưu ngày bắt đầu/kết thúc khi có và `RecognitionYear` là năm ghi nhận theo năm dương lịch.
- `AcademicYearId` là thông tin bổ sung, không thay thế năm dương lịch.
- Khen thưởng lưu riêng ngày quyết định, năm ghi nhận và khoảng thời gian được xét nếu tài liệu có ghi.
- Kỳ xét thưởng của AwardApplication là khái niệm riêng ở KLTN.
- Chuỗi năm phải lọc đúng loại kết quả, trạng thái hợp lệ và năm phân biệt; nhiều bản cùng năm không thành nhiều năm.
- Không tự đặt hạn hết giá trị chung. Khả năng sử dụng lại thành tích phụ thuộc tiêu chí áp dụng.

## 6.3. Minh chứng

- Achievement có nhiều Evidence; Evidence thuộc một Achievement trong PTUD.
- Evidence có nhiều phiên bản file bất biến. Thay file tạo phiên bản mới.
- Chưa chia sẻ một Evidence cho nhiều hồ sơ; cùng tài liệu thì đính kèm riêng.
- File đã thuộc một lần gửi không bị xóa qua chỉnh sửa thông thường.
- Lưu tên gốc, mã lưu trữ, MIME, kích thước, hash, người và thời điểm upload.

## 6.4. Khen thưởng có quyết định

- Bắt buộc chủ thể, loại khen thưởng, số/ngày quyết định, cơ quan ban hành, năm ghi nhận và file quyết định.
- DRAFT khi đang nhập; RECORDED khi ghi nhận đầy đủ; REVOKED khi thu hồi bản ghi.
- RECORDED nghĩa là đã ghi nhận quyết định, không phải hệ thống tự trao thưởng.
- Không sửa trực tiếp RECORDED; thu hồi có lý do, tạo bản thay thế có liên kết.
- Liên kết với Achievement tùy chọn để nhập lịch sử cũ chưa có thành tích chi tiết.
- Chặn trùng chủ thể + loại khen thưởng + quyết định; một quyết định có thể có nhiều người nhận.

# 7. DATABASE DOMAIN DESIGN

## 7.1. Bảng PTUD

| Nhóm | Bảng |
|---|---|
| Identity | Users, Roles, UserRoles, RefreshTokens |
| Organization | OrganizationUnits, UserUnitScopes, UnitRepresentatives |
| Lecturer | Lecturers, LecturerAssignments |
| Time | AcademicYears |
| Achievement | AchievementTypes, Achievements, AchievementSubmissions |
| Evidence | Evidences, EvidenceFiles, SubmissionEvidenceFiles |
| Verification | AchievementStatusHistories |
| Award | AwardTypes, AwardDecisions, AwardDecisionFiles, AwardRecords, AwardRecordAchievements, AwardRecordHistories |
| System | Notifications, AuditLogs |

## 7.2. Trường và ràng buộc trọng yếu

- OrganizationUnits: Type (Khoa/Bộ môn), ParentId; không có chu trình cha–con.
- UserUnitScopes: UserId, RoleId, UnitId, IncludeDescendants, ValidFrom, ValidTo.
- UnitRepresentatives: UserId, UnitId, thời hạn phân công.
- LecturerAssignments: LecturerId, UnitId, ValidFrom/ValidTo; không chồng lấn đối với nơi công tác chính.
- Achievements: LecturerId nullable, OrganizationUnitId nullable, ContextUnitId, AchievementTypeId, Title, Description, StartDate/EndDate, RecognitionYear, AcademicYearId nullable, Status, CreatedBy, SubmittedBy, ReplacesAchievementId nullable, CreatedAt/UpdatedAt, RowVersion.
- CHECK chủ thể: chỉ một trong LecturerId/OrganizationUnitId có giá trị. ContextUnitId dùng phân quyền/báo cáo lịch sử; với tập thể bằng OrganizationUnitId.
- AchievementSubmissions: AchievementId, RevisionNo, snapshot nội dung, SubmittedBy, SubmittedAt; UNIQUE(AchievementId, RevisionNo).
- SubmissionEvidenceFiles nối lần gửi với đúng EvidenceFile bất biến.
- AchievementStatusHistories: AchievementId, SubmissionId khi có, FromStatus, ToStatus, ActorId, Reason, CreatedAt; chỉ thêm mới qua nghiệp vụ.
- AwardTypes: Code duy nhất, Name, Category (danh hiệu/hình thức), cấp, đối tượng áp dụng, IsActive.
- AwardDecisions: số/ngày, cơ quan ban hành; AwardDecisionFiles lưu file bất biến. Quyết định đã dùng trong RECORDED không sửa đè.
- AwardRecords: chủ thể XOR như Achievements, ContextUnitId, AwardTypeId, DecisionId, RecognitionYear, PeriodStart/PeriodEnd nullable, Status, RecordedBy/RecordedAt, ReplacesAwardRecordId nullable, RowVersion.
- Filtered unique index theo từng loại chủ thể + AwardTypeId + DecisionId cho RECORDED, giữ được bản cũ đã thu hồi.
- FK đầy đủ; không cascade delete lịch sử đã gửi. CHECK năm/khoảng ngày/trạng thái; service kiểm tra chuyển trạng thái.
- Index chủ thể, ContextUnitId, RecognitionYear, Status và FK thường truy vấn. Danh sách phân trang.

```text
OrganizationUnit --> OrganizationUnit (parent)
User --> UserRole --> Role
User --> UserUnitScope --> OrganizationUnit
User --> UnitRepresentative --> OrganizationUnit
Lecturer --> LecturerAssignment --> OrganizationUnit
Lecturer OR OrganizationUnit --> Achievement
Achievement --> Evidence --> EvidenceFile (versions)
Achievement --> AchievementSubmission --> SubmissionEvidenceFile --> EvidenceFile
Achievement --> AchievementStatusHistory
Lecturer OR OrganizationUnit --> AwardRecord --> AwardType
AwardRecord --> AwardDecision --> AwardDecisionFile
AwardRecord --> AwardRecordAchievement --> Achievement
AwardRecord --> AwardRecordHistory
```

Hoàn thiện ERD, cardinality, kiểu dữ liệu, nullability và data dictionary trước khi viết SQL sâu. Đây là thiết kế định hướng, chưa phải schema SQL hoàn chỉnh.

## 7.3. Dành cho KLTN

AwardApplications, AwardApplicationAchievements, AwardApplicationReviews, AwardCycles, RegulationDocuments, RegulationVersions, AwardCriteriaVersions, EvaluationRuns, CriterionResults, ExternalKpiRecords, IntegrationRuns. Chưa tạo toàn bộ trong PTUD.

# 8. CẤU TRÚC PROJECT

```text
achievement-management/
  frontend/src/
    components/       # Thành phần dùng chung
    layouts/
    pages/            # Màn hình và ghép feature
    features/         # auth, profiles, achievements, awards, approvals, reports
    services/         # API client
    routes/
    hooks/
    utils/
  backend/
    src/
      config/
      middlewares/
      modules/        # auth, users, organizations, lecturers, achievements,
                      # evidences, approvals, awards, reports, notifications, audit
      app.js
      server.js
    tests/
    .env.example
  database/
    migrations/       # Nguồn thay đổi schema chính, có thứ tự
    seed/
    README.md
  docs/
    requirements/
    architecture/
    database/
    api/
    testing/
    deployment/
    ai/
  scripts/
  deployment/
  README.md
  .gitignore
```

Module backend có controller/service/repository/routes/validator khi cần. Không tạo file rỗng chỉ để đủ cấu trúc, không duy trì schema và migrations thành hai nguồn độc lập. Kho file nằm ngoài public/Git. Bổ sung ai-service khi bắt đầu KLTN.

# 9. MÀN HÌNH

| Khu vực | Màn hình |
|---|---|
| Auth | Đăng nhập, đổi mật khẩu |
| Cá nhân | Dashboard, hồ sơ, thành tích, tạo/sửa/chi tiết, lịch sử khen thưởng |
| Tập thể | Đơn vị được phép xem, hồ sơ, thành tích, tạo/sửa/chi tiết, lịch sử khen thưởng |
| Xác nhận | Hàng chờ, chi tiết/minh chứng, bổ sung/xác nhận/từ chối, lịch sử |
| Cán bộ hồ sơ | Quyết định, người/đơn vị nhận, ghi nhận/thu hồi/điều chỉnh |
| Admin | Tài khoản, đơn vị, quyền/phạm vi, đại diện, danh mục, năm học, audit |
| Báo cáo | Lọc năm/đơn vị/chủ thể/loại/trạng thái, thống kê, CSV |
| Thông báo | Danh sách, đánh dấu đã đọc |

Route: `/login`, `/me/profile`, `/me/dashboard`, `/achievements`, `/achievements/:id`, `/units/:id/profile`, `/units/:id/achievements`, `/approvals`, `/awards`, `/reports`, `/notifications`, `/admin/...`.

Dùng lại màn hình thành tích cho cá nhân/tập thể. Dashboard tách VERIFIED, hồ sơ đang xử lý và khen thưởng RECORDED. Bộ lọc ghi rõ năm ghi nhận hay năm học.

# 10. API DESIGN

Base URL `/api/v1`; chốt OpenAPI và response mẫu trước khi triển khai module.

```http
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/change-password
GET    /api/v1/auth/me
GET    /api/v1/lecturers/:id
PATCH  /api/v1/lecturers/:id
GET    /api/v1/units/:id/profile
GET    /api/v1/units/:id/achievements
GET    /api/v1/achievements
POST   /api/v1/achievements
GET    /api/v1/achievements/:id
PATCH  /api/v1/achievements/:id
DELETE /api/v1/achievements/:id
POST   /api/v1/achievements/:id/submit
POST   /api/v1/achievements/:id/cancel
GET    /api/v1/achievements/:id/history
POST   /api/v1/achievements/:id/evidences
POST   /api/v1/evidences/:id/versions
DELETE /api/v1/evidences/:id
GET    /api/v1/evidence-files/:id/download
GET    /api/v1/approvals/pending
POST   /api/v1/achievements/:id/verify
POST   /api/v1/achievements/:id/request-correction
POST   /api/v1/achievements/:id/reject
POST   /api/v1/achievements/:id/revoke
GET    /api/v1/award-records
POST   /api/v1/award-records
PATCH  /api/v1/award-records/:id
POST   /api/v1/award-records/:id/record
POST   /api/v1/award-records/:id/revoke
GET    /api/v1/award-records/:id/history
GET    /api/v1/reports/achievements
GET    /api/v1/reports/awards
GET    /api/v1/reports/export
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
```

- Submit dùng cả gửi lần đầu và gửi lại NEED_CORRECTION, luôn tạo revision mới.
- PATCH chỉ nhận trường được phép; không cho client tự đổi Status/người xác nhận/phạm vi.
- Gửi RowVersion khi thay đổi; xung đột trả 409.
- Có page/pageSize giới hạn, sort whitelist và filter validate.
- Lỗi thống nhất code/message/fieldErrors: 400 dữ liệu sai, 401 chưa xác thực, 403 thiếu quyền, 409 xung đột.
- CRUD quản trị, upload quyết định và API còn lại bổ sung OpenAPI tuần 2–3; đây chưa là đặc tả đầy đủ.

# 11. BẢO MẬT VÀ TOÀN VẸN

- Hash mật khẩu và refresh token; có hạn dùng, thu hồi khi logout. Không log bí mật xác thực.
- Refresh token trong cookie HttpOnly/Secure trên HTTPS; cấu hình SameSite/CSRF phù hợp cách triển khai. Access token giữ trong bộ nhớ ứng dụng.
- Backend kiểm tra quyền hiện tại, không chỉ tin role cũ trong JWT; thu hồi phân công phải có hiệu lực.
- Truy vấn tham số hóa, không ghép input vào SQL/đường dẫn file.
- Cho PDF/JPG/PNG/DOCX tối đa 10 MB/file; kiểm tra phần mở rộng, MIME và nội dung phù hợp; tên lưu do server sinh. DOCX chỉ cần tải về.
- Không public kho upload; tải sau kiểm tra quyền hồ sơ.
- Bảo vệ CSV trước nội dung có thể bị diễn giải thành công thức bảng tính.
- Audit ghi actor, hành động, đối tượng, thời điểm, thay đổi quan trọng; không ghi toàn bộ file/bí mật.
- Upload dùng file tạm và dọn file mồ côi khi DB thất bại; transaction SQL không rollback filesystem.
- Sao lưu cả DB và kho file; giữ audit khi vô hiệu hóa tài khoản. Không commit .env, upload, backup hoặc dữ liệu cá nhân thật vào Git.

# 12. ROADMAP 13 TUẦN

| Tuần | Công việc | Kết quả nghiệm thu |
|---|---|---|
| 1 | Chốt thuật ngữ, phạm vi, tập thể, quyền, workflow | SRS rút gọn, business rules, use case, ma trận quyền |
| 2 | ERD ban đầu, API, skeleton React/Express/SQL, triển khai thử | FE gọi API đọc SQL được; xác nhận môi trường triển khai |
| 3 | Migrations/seed, auth, quyền/phạm vi, audit nền tảng | Login, chặn sai phạm vi, dựng DB bằng script |
| 4 | Hồ sơ cá nhân/tập thể, đại diện, CRUD thành tích/file tối thiểu | Hai loại chủ thể tạo thành tích có file được |
| 5 | Luồng gửi–xác nhận xuyên suốt, khóa dữ liệu, lịch sử | Demo tạo → file → gửi → xác nhận → lịch sử |
| 6 | Bổ sung/gửi lại/từ chối/hủy/thu hồi, revision, đồng thời | Workflow đầy đủ; kiểm thử quyền/xung đột |
| 7 | Danh mục, quyết định, kết quả khen thưởng | Ghi nhận khen thưởng riêng với thành tích |
| 8 | Hoàn thiện quản trị, phân công, thông báo | Vai trò PTUD có UI/API cần thiết |
| 9 | Dashboard cá nhân/tập thể, tìm kiếm, báo cáo, CSV | Số liệu đúng trạng thái/năm/phạm vi |
| 10 | Tích hợp, dữ liệu demo, hướng dẫn sơ bộ | Đóng tính năng bắt buộc; demo cá nhân/tập thể |
| 11 | Dự phòng, hồi quy, kiểm thử quyền/file/lịch sử | Sửa lỗi lõi; không thêm tính năng khi còn lỗi |
| 12 | Triển khai hoàn chỉnh, backup/restore DB/file, UI polish | Cài đặt và khôi phục được dữ liệu mẫu |
| 13 | Báo cáo, kịch bản/video demo, tổng duyệt | Demo ổn định, bàn giao tài liệu và định hướng KLTN |

Testing, audit, kiểm tra quyền và tài liệu API đi cùng từng module. Tuần 11 kiểm tra tổng thể. Chỉ làm mở rộng sau khi tiêu chí bắt buộc đạt.

# 13. PHÂN CÔNG VÀ GIT

- Thành viên 1 phụ trách chính DB/backend, auth, workflow và triển khai.
- Thành viên 2 phụ trách chính frontend, hồ sơ, quản trị/báo cáo; cùng viết kịch bản kiểm thử và kiểm tra hợp đồng API.
- Cả hai chốt nghiệp vụ, review thay đổi quan trọng, demo tích hợp mỗi tuần. Cân bằng khối lượng, không để một người gánh toàn bộ DB/backend/tài liệu/triển khai.
- Dùng mock theo OpenAPI khi API chưa xong, kiểm tra với backend thật trong cùng tuần.
- main ổn định, feature branch ngắn, PR do người còn lại review; develop tùy nhu cầu.
- Có .env.example, dữ liệu demo giả lập, README chạy từ máy mới.

# 14. KIỂM THỬ VÀ CHẤT LƯỢNG

## 14.1. Ca bắt buộc

1. Chặn đọc/sửa/tải file cá nhân khác và ngoài phạm vi, kể cả URL trực tiếp/export.
2. Đại diện chỉ nộp cho đơn vị được giao, hết hạn thì mất quyền thao tác.
3. Chặn tự xác nhận hồ sơ mình tạo/nộp hoặc thành tích cá nhân mình.
4. Gửi lại giữ phiên bản nội dung/file cũ; lịch sử chỉ đúng bản được xác nhận.
5. VERIFIED không sửa/xóa trực tiếp; thu hồi/thay thế giữ liên kết lịch sử.
6. Xác nhận/từ chối đồng thời chỉ ghi nhận một kết quả hợp lệ.
7. VERIFIED không tự tăng số khen thưởng RECORDED.
8. Chuyển đơn vị không đổi báo cáo lịch sử.
9. Chặn trùng chủ thể–loại–quyết định; cho nhiều người trong một quyết định.
10. Chặn file sai loại/quá giới hạn và tải file bằng ID không có quyền.
11. Dashboard/report/export khớp dữ liệu mẫu; REVOKED không tính vào số liệu hợp lệ.
12. Restore DB/kho file khôi phục được minh chứng hồ sơ mẫu.

## 14.2. Mục tiêu demo

- Dữ liệu thử: ít nhất 100 giảng viên, 10 đơn vị, 5.000 thành tích nhiều năm, gồm tập thể và các trạng thái.
- Mục tiêu đề xuất: p95 dưới 2 giây cho danh sách phân trang/dashboard với 10 người dùng đồng thời, không gồm upload/export/AI. Ghi cấu hình máy và cách đo; chốt lại tuần 2 theo môi trường.
- Không còn lỗi chặn demo hoặc lỗi vượt quyền đã biết khi bàn giao.
- Màn hình chính có loading/error/empty state, dùng được trên laptop và màn hình nhỏ.

# 15. DEFINITION OF DONE VÀ DEMO

Module hoàn thành khi có migration/seed liên quan, API được mô tả, validation, kiểm tra quyền/trạng thái, UI, kiểm thử nghiệp vụ, audit cho thay đổi quan trọng và tài liệu phù hợp.

```text
Giảng viên -> Tạo thành tích + file -> Gửi
Manager -> Yêu cầu bổ sung
Giảng viên -> Bổ sung, gửi lại
Manager -> Xác nhận -> Dashboard thành tích cập nhật

Đại diện Bộ môn -> Nộp thành tích tập thể
Manager được phân công -> Xác nhận -> Hồ sơ tập thể có lịch sử

RecordsOfficer -> Nhập quyết định -> Ghi nhận khen thưởng cá nhân/tập thể
Dashboard khen thưởng -> Báo cáo theo năm -> CSV
```

Demo thêm truy cập sai phạm vi bị chặn và xem lại file trước lần bổ sung. Không cần AI thật để nghiệm thu PTUD.

# 16. TÀI LIỆU BÀN GIAO

- docs/requirements: SRS, business rules, use cases, ma trận quyền, quyết định phạm vi.
- docs/database: ERD, data dictionary, hướng dẫn migrations/seed.
- docs/api: OpenAPI, xác thực/upload.
- docs/architecture: hệ thống/workflow, bảo mật/lưu trữ.
- docs/testing: test plan, kết quả và lỗi còn lại nếu có.
- docs/deployment: cài đặt, cấu hình, backup/restore, vận hành demo.
- docs/ai: nguồn dữ liệu, kiến trúc, kế hoạch đánh giá KLTN.
- README: chạy từ máy mới, tài khoản demo, phạm vi đã làm/chưa làm.

# 17. KLTN — AWARD VALIDATOR

## 17.1. Đầu vào và xử lý

Đầu vào: chủ thể, thành tích VERIFIED, khen thưởng RECORDED, mục tiêu, kỳ/thời điểm xét và phiên bản quy định áp dụng. Chỉ ra dữ liệu thiếu, không tự điền bằng suy đoán.

```text
Quy định từ nguồn được quản trị xác nhận
  -> Trích xuất/kiểm tra, lưu phiên bản và hiệu lực
  -> Chunk giữ văn bản/điều/khoản/trang -> Embedding -> Retrieval

Hồ sơ có cấu trúc + tiêu chí đã kiểm tra
  -> Logic xác định kiểm tra số lượng, thời hạn, chuỗi năm
  -> RAG tìm căn cứ, hỗ trợ giải thích
  -> Tổng hợp từng tiêu chí -> Người xét duyệt kiểm tra
```

Phiên bản quy định có nguồn, cơ quan ban hành, ngày ban hành, khoảng hiệu lực, quan hệ thay thế khi có. Tiêu chí AI trích xuất phải được người có trách nhiệm kiểm tra trước khi dùng kết luận tự động.

## 17.2. Đầu ra

- **Đủ điều kiện theo bộ tiêu chí đã kiểm tra / chưa đủ điều kiện / chưa đủ dữ liệu để đánh giá.**
- Từng tiêu chí: đạt/chưa đạt/chưa xác định, dữ liệu hồ sơ đã dùng.
- Căn cứ: văn bản, phiên bản, điều/khoản/trang hoặc đoạn nguồn.
- Dữ liệu cần bổ sung, điều kiện chưa kiểm tra được tự động.
- Lưu thời điểm, phiên bản model/prompt/tiêu chí, nguồn truy xuất, phiên bản dữ liệu đầu vào để giải thích lại kết quả.

Không rõ văn bản áp dụng/dữ liệu mâu thuẫn thì chuyển người phụ trách. Thiếu dữ liệu không mặc định là không đạt. AI không tự tạo AwardRecord.

## 17.3. Đánh giá chất lượng

Bộ hồ sơ mẫu được giảng viên hướng dẫn/người phụ trách nghiệp vụ đối chiếu: đạt, không đạt, thiếu dữ liệu, đứt chuỗi năm, đổi quy định, thu hồi thành tích. Tách tập điều chỉnh khỏi tập kiểm thử cuối.

Đo độ đúng từng tiêu chí, tỷ lệ kết luận đủ điều kiện sai, độ đúng trích dẫn, nhận diện thiếu dữ liệu, thời gian/chi phí mỗi lần đánh giá. Chốt ngưỡng nghiệm thu sau thử nghiệm đầu; không hứa độ chính xác khi chưa đánh giá.

# 18. KLTN — KPI RECOMMENDER

Đầu vào: mục tiêu khen thưởng, thời gian, tiêu chí đã xác minh, thành tích hiện có, ràng buộc công việc được cung cấp.

Mỗi gợi ý có tiêu chí liên quan, KPI đo được, căn cứ, thời hạn, ưu tiên, giả định. Phân biệt điều kiện bắt buộc với gợi ý cải thiện.

- Không khẳng định làm KPI sẽ chắc chắn được trao thưởng.
- Không tự đưa ngưỡng bài báo/đề tài khi bộ tiêu chí không có căn cứ.
- Điều kiện nhiều năm phải phản ánh đúng thời gian, không hứa hoàn thành trong một năm nếu không thể.
- Giảng viên chấp nhận đề xuất trước khi dùng làm kế hoạch; không tự ghi sang hệ thống KPI ngoài.

# 19. KLTN — TÍCH HỢP KPI

Đây là module tích hợp dữ liệu, không phải agent AI.

```text
Achievement System connector
  -> Gọi API đọc kết quả cuối kỳ của KPI System
  -> Kiểm tra định danh/kỳ/trạng thái
  -> Lưu nguồn và lịch sử đồng bộ
  -> Ánh xạ thành kê khai/minh chứng theo quy tắc
  -> Xác nhận theo workflow hoặc quy tắc tin cậy đã được phê chuẩn
```

Endpoint nguồn giả định: `GET /api/kpi-results?employeeId=...&year=...`. Thống nhất API cụ thể với nhóm KPI; hệ thống thành tích là bên gọi khi dùng pull.

- Ánh xạ mã nhân sự ngoài sang LecturerId, không ghép theo tên.
- Lưu SourceSystem, ExternalRecordId, kỳ, phiên bản nguồn, thời điểm lấy, trạng thái hoàn tất.
- Chống trùng theo nguồn + bản ghi + phiên bản; chạy lại không sinh trùng.
- Nguồn thay đổi tạo phiên bản mới, không ghi đè VERIFIED.
- Có xác thực service, timeout, retry giới hạn, log lỗi, đồng bộ lại.
- KPI không tự thành khen thưởng. Quy tắc chuyển thành thành tích phải xác nhận riêng.

# 20. CHECKLIST KẾT THÚC PTUD

- [ ] Hồ sơ cá nhân/tập thể đầy đủ.
- [ ] Đại diện, Manager, RecordsOfficer đúng phạm vi.
- [ ] Nộp, bổ sung, gửi lại, xác nhận và các nhánh xử lý hoạt động.
- [ ] Chặn tự duyệt, sai phạm vi/trạng thái và cập nhật xung đột.
- [ ] Giữ phiên bản nội dung/file từng lần gửi.
- [ ] Khen thưởng có quyết định được ghi riêng.
- [ ] Dashboard/report/CSV đúng năm/trạng thái/phạm vi.
- [ ] Lịch sử/audit/thông báo hoạt động.
- [ ] Demo cả cá nhân/tập thể.
- [ ] Cài đặt mới, backup/restore đã kiểm tra.
- [ ] Tài liệu/kết quả kiểm thử bàn giao.
- [ ] AI/KPI ghi rõ là định hướng, chưa phải chức năng đã triển khai.

# 21. THỨ TỰ BẮT ĐẦU

1. Xác nhận quy tắc đề xuất mục 4–6 với giảng viên hướng dẫn.
2. Hoàn thiện ERD, data dictionary, ma trận quyền.
3. Chốt API, migrations, dữ liệu mẫu.
4. Dựng skeleton, auth/phạm vi/audit.
5. Luồng cá nhân/tập thể từ tạo thành tích đến xác nhận.
6. Phiên bản minh chứng và các nhánh workflow còn lại.
7. Khen thưởng, quản trị, dashboard, báo cáo.
8. Kiểm thử, triển khai, tài liệu, demo.
9. KLTN: RAG, đánh giá tiêu chí, gợi ý KPI, tích hợp ngoài.
