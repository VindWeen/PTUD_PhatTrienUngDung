# W2-P2 — Nhập quyết định và ghi nhận khen thưởng

Phụ trách: Võ Nhạc Phước. PostgreSQL Supabase qua pg; Express auth và private storage giữ nguyên.

## Phụ thuộc và hợp đồng

- W1-P2: profiles, lecturer_assignments, award_types (migration 009).
- W1-Q3: auth và scope CTE, đã tích hợp qua PR #2 (commit 4261959).
- W2-Q2: đã tích hợp tại d8448d8; tái sử dụng LocalStorageAdapter và validateUploadedFile, không đổi module evidences.
- Không có AGENTS.md trong workspace. Blueprint/ADR-001 là cơ sở kiến trúc. Không xác minh được PR đang mở qua CLI GitHub vì máy không có gh; lịch sử Git xác nhận mã phụ thuộc đã tích hợp.
- Fixture awards cũ chỉ là demo đọc, chưa có hợp đồng ghi/file đầy đủ. Hợp đồng thực thi dưới đây bổ sung nghiệp vụ ghi; UI awards luôn gọi API thật kể cả khi màn hình khác dùng fixture. Dữ liệu phản hồi module này dùng tên cột snake_case, BIGINT pg trả string; client không dùng kiểu integer của fixture cũ cho ID phản hồi.

## API `/api/v1`

Tất cả endpoint cần Bearer token. Quyền được kiểm tra lại từ role DB hiệu lực; ADMIN không bypass RecordsOfficer. Scope theo ContextUnitId và IncludeDescendants/thời hạn W1-Q3.

| Method/path | Payload / hành vi |
|---|---|
| POST /award-decisions | `{decisionNumber, decisionDate:YYYY-MM-DD, issuer, title}`; 201 |
| POST /award-records | `{lecturerId OR organizationUnitId, awardTypeId, decisionId, recognitionYear, achievementIds?:[], replacesAwardRecordId?}`; 201 DRAFT |
| GET /award-records | Bắt buộc `contextUnitId`; `page=1`, `pageSize=20` tối đa 100; trả `{items,page,pageSize}` |
| GET /award-records/:id | Chi tiết gồm decision, files, histories, achievementIds |
| POST /award-decisions/:id/files | multipart `file`; 201; private adapter W2-Q2, tối đa 10MB, PDF/JPEG/PNG/DOCX và magic bytes |
| GET /award-decision-files/:id/download | Stream attachment; kiểm tra scope qua ít nhất một record liên quan |
| POST /award-records/:id/record | `{version}`; DRAFT → RECORDED khi file private tồn tại |
| POST /award-records/:id/revoke | `{version,reason}`; RECORDED → REVOKED, bắt buộc lý do |

JSON envelope `{success:true,data:...}`; lỗi dùng middleware chung: 400 validation, 403 role/scope, 404 tài nguyên, 409 trạng thái/version/trùng. Không cho sửa trực tiếp RECORDED. Sửa sai bằng thu hồi và tạo nháp thay thế cùng chủ thể. Quyết định dùng chung cho nhiều người bằng decisionId. Nhập quyết định trước, tạo nháp có scope, rồi upload file; upload yêu cầu scope của mọi record liên quan và tất cả còn DRAFT. Sau khi từng sử dụng quyết định, file bị khóa kể cả record đã thu hồi. File mới trước ghi nhận là version bất biến, không ghi đè file cũ.

Liên kết achievement tùy chọn, phải cùng chủ thể và scope. Cá nhân lấy đơn vị công tác chính hiện hành từ DB, không nhận ContextUnitId từ client. Tập thể dùng chính đơn vị chủ thể. Loại khen thưởng phải đang hoạt động và phù hợp chủ thể. Năm 1990–2100.

Ghi trạng thái, history và audit trong cùng transaction. Khóa row/version và quyết định chống race upload/record; partial unique PostgreSQL cho `(lecturer_id,award_type_id,decision_id)` và `(unit_id,award_type_id,decision_id)` khi RECORDED. Thu hồi giải phóng unique, nhiều chủ thể cùng quyết định hợp lệ.

## Migration và dữ liệu cũ

Nguồn migration chính là `supabase/migrations/20261005000014_w2_p2_award_decisions.sql`; không chỉnh checksum migration đã chạy. Thêm quyết định/files/links/history, chuyển tiếp award_records hiện có, giữ các cột và dữ liệu theo đợt cũ. Không tự suy diễn cơ quan/năm/file cho dữ liệu lịch sử thiếu căn cứ. API mới chỉ nhận record có decision_id; portfolio đọc được cả bản cũ và bản mới. Không chạy seed trên dữ liệu thật. Không dùng AI hay KPI để tự trao thưởng.

## Tự kiểm tra

1. Chạy `npm --prefix backend run migrate` sau khi kiểm tra cấu hình DB và backup theo quy trình dự án; không chạy seed trên DB thật.
2. Chạy backend/frontend, đăng nhập RecordsOfficer có scope hiệu lực, mở `/awards`.
3. Nhập cá nhân hoặc tập thể với mã chủ thể và loại đã có. Tạo nháp, thử ghi nhận thiếu file qua API (400), upload PDF hợp lệ và ghi nhận (RECORDED).
4. Dùng cùng decisionId cho người khác, không upload lại: ghi nhận thành công. Cùng chủ thể/loại/decisionId: ghi nhận 409.
5. Thử token ADMIN, scope hết hạn/ngoài đơn vị, version cũ; phải bị chặn. Download private kiểm tra cùng scope.
6. Thu hồi có lý do, xem history, tạo bản thay thế; portfolio cá nhân thấy dữ liệu mới.

UI hiện dùng nhập mã tham chiếu từ danh mục/hồ sơ; chưa có combobox tìm kiếm. Không có chỉnh sửa nháp tại chỗ; có thể tạo nháp mới. Chưa triển khai quyền đọc awards cho Lecturer/Manager/đại diện ở endpoint awards riêng; portfolio cá nhân tiếp tục có lịch sử. Phạm vi yêu cầu ghi nhận RecordsOfficer đã có.
