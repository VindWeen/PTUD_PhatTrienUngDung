# Từ điển dữ liệu V2

Schema vật lý: [001_v2_schema.sql](../../database/sqlserver/migrations/001_v2_schema.sql). Ràng buộc liên dòng: [002_v2_integrity.sql](../../database/sqlserver/migrations/002_v2_integrity.sql). Bảng dưới là bản đồ 38 bảng theo chuỗi migration 001–008; kiểu/cột/default/FK chi tiết lấy trực tiếp từ migration đã áp dụng.

| Nhóm | Bảng | Ý nghĩa |
| --- | --- | --- |
| Cá nhân | users, person_profiles | Tài khoản và hồ sơ chung; không bắt buộc tổ chức. |
| Xác thực | auth_sessions, auth_tokens | Phiên đăng nhập; token xác minh email/đặt lại mật khẩu, chỉ lưu hash. |
| Quyền hệ thống | global_role_grants | SYSTEM_ADMIN hoặc REGULATION_MANAGER, có hiệu lực theo thời gian. |
| Cơ cấu | organizations | Cây cha–con, có loại CLASS; không cho chu trình. |
| Thành viên | membership_invitations, membership_join_requests, memberships | Lời mời, đơn gia nhập và quan hệ có hiệu lực; yêu cầu đồng ý, không chồng kỳ. |
| Quyền tổ chức | org_access_grants | Từng quyền tại tổ chức, có tùy chọn hậu duệ và thời hạn. |
| Liên kết cơ cấu | organization_link_requests, organization_link_history | Yêu cầu gắn/tách/chuyển, người đồng ý và lịch sử bất biến. |
| Kho cá nhân | achievement_types, achievements | Danh mục và thành tích thuộc trực tiếp người dùng; thùng rác qua deleted_at, không có trạng thái duyệt. |
| Minh chứng | evidence_files, evidence_shares | Metadata tệp private và quyền chia sẻ theo người/tổ chức. |
| Quy chế | regulations, regulation_versions | Văn bản và phiên bản DRAFT/PUBLISHED; đã xuất bản thì bất biến. |
| Phân phối quy chế | regulation_shares, regulation_adoptions, regulation_personal_exclusions | Chia sẻ, ghim phiên bản và loại trừ cá nhân. |
| Tệp nguồn | regulation_source_files | Metadata PDF/DOCX theo phiên bản, trạng thái trích xuất và hash. |
| Tiêu chí | criterion_groups, criteria | Nhóm AND/OR, tiêu chí bắt buộc/loại trừ, rule JSON và tham chiếu nguồn. |
| Khám hồ sơ | assessment_batches, assessment_runs | Yêu cầu cá nhân/khám ngược/tổ chức; lần khám theo cá nhân và phiên bản. |
| Kết quả | criterion_results, result_evidence | Kết quả từng tiêu chí và snapshot thành tích/minh chứng đối chiếu. |
| Mục tiêu | kpi_goals, kpi_tasks, kpi_progress, kpi_achievements | Nguồn tiêu chí thiếu, kế hoạch, lịch sử tiến độ và thành tích đóng góp. |
| CV | cv_templates, cvs, cv_achievements | Mẫu, slug ngẫu nhiên hoặc tùy chỉnh, quyền công khai và thành tích được chọn. |
| Tiện ích | notifications, calendar_events | Hộp thư thông báo và lịch riêng, có thể liên kết KPI. |
| Nhật ký | audit_events | Sự kiện chỉ ghi thêm; người thao tác, đối tượng, lý do và JSON chi tiết. |

## Quy ước quan trọng

- PK chủ yếu là BIGINT IDENTITY; bảng nối có khóa ghép, profile dùng user_id làm PK/FK.
- Thời gian DATETIME2 UTC; khoảng hiệu lực thành viên là [valid_from, valid_to), valid_to NULL là chưa kết thúc.
- Quyền tổ chức: MEMBERS_VIEW, ASSESSMENTS_VIEW, ASSESSMENTS_RUN, MEMBERS_NOTIFY, MEMBERS_MANAGE, STRUCTURE_MANAGE, ACCESS_MANAGE, REGULATIONS_CREATE, REGULATIONS_MANAGE, REGULATIONS_PUBLISH, REGULATIONS_SHARE, REGULATIONS_ADOPT, REGULATIONS_UPDATE.
- Kết luận khám: MET, NOT_MET, INSUFFICIENT_DATA, NOT_APPLICABLE. Lần khám chạy RUNNING rồi COMPLETED/FAILED; kết quả đã kết thúc không sửa tại chỗ.
- CV mặc định PRIVATE, email/phone mặc định không công khai; slug tự sinh khi không truyền cột. API xử lý trường nhập trống bằng cách bỏ trường khi INSERT, không ghi NULL vào public_slug.
- JSON được kiểm cú pháp tại DB; cấu trúc và ý nghĩa của rule, loại thành tích, liên hệ công khai phải kiểm thêm tại API.
- FK không kiểm danh tính người gửi request. Service phải kiểm scope và thực hiện đồng ý/liên kết trong transaction.

Danh sách enum mô tả miền giá trị của DB. API có thể chỉ cung cấp một phần thao tác tương ứng, ví dụ handler xác thực hiện phát token đặt lại mật khẩu. Migrations dựng schema. Dữ liệu mẫu, nếu có, do thao tác seed riêng tạo.
