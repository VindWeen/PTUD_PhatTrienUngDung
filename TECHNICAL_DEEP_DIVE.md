# Phân tích kỹ thuật hệ thống quản lý thành tích

Tài liệu bổ sung cho [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md). Schema được đọc theo thứ tự migration 001–008 trong [SQL Server V2](database/sqlserver/migrations). Phần backend dựa trên [các handler V2](backend/src/modules). Phần frontend mô tả cấu trúc đã tách theo trách nhiệm.

## 1. Schema và dữ liệu động

### 1.1. Từ điển bảng

Các bảng bên dưới thuộc `app`. PK mặc định trong bảng mô tả là `id bigint IDENTITY`; các PK khác được ghi rõ. Mũi tên chỉ FK tới PK của bảng đích trừ khi ghi tuple. Cột người tạo, gửi, phản hồi hoặc cấp quyền trỏ tới `users.id` khi được liệt kê. Thời điểm hệ thống thường dùng `datetime2(3)` UTC, còn ngày đạt/hiệu lực/đánh giá dùng SQL `date`.

#### Tài khoản, tổ chức và quyền

| Bảng | Cột quan trọng và quan hệ | Miền giá trị |
| --- | --- | --- |
| `users` | `email`, `normalized_email` tính từ email và unique, `password_hash`, `email_verified_at`, `created_at`, `updated_at` | `account_status`: ACTIVE, DISABLED, DELETED |
| `person_profiles` | PK/FK `user_id → users`; `full_name`, `birth_date`, `phone`, `headline`, `biography`, `avatar_storage_key`, `attributes_json`, `updated_at` | `person_type`: STUDENT, LECTURER, STAFF, OTHER |
| `auth_sessions` | `user_id → users`; `refresh_token_hash` unique, `created_at`, `expires_at`, `revoked_at`, `client_description` | Hiệu lực theo hạn và thời điểm thu hồi |
| `auth_tokens` | `user_id → users`; `token_hash` unique, `purpose`, `created_at`, `expires_at`, `consumed_at` | `purpose`: VERIFY_EMAIL, RESET_PASSWORD. Luồng khôi phục hiện dùng RESET_PASSWORD |
| `global_role_grants` | `user_id`, `granted_by_user_id → users`; `role_code`, `valid_from`, `valid_to` | SYSTEM_ADMIN, REGULATION_MANAGER. MEMBER được thêm khi dựng response hồ sơ |
| `organizations` | `parent_id → organizations`, `created_by_user_id → users`; `code` unique, `name`, `organization_type`, `status` | Loại UNIVERSITY, FACULTY, DEPARTMENT, CLASS, COMPANY, TEAM, OTHER. Trạng thái ACTIVE, ARCHIVED |
| `membership_invitations` | `organization_id → organizations`; `invitee_user_id`, `invited_by_user_id`, `responded_by_user_id → users`; `title`, thời điểm tạo/hết hạn/phản hồi | PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED |
| `membership_join_requests` | `organization_id → organizations`; `user_id`, `responded_by_user_id → users`; `reason`, `created_at`, `responded_at` | PENDING, ACCEPTED, DECLINED |
| `memberships` | `organization_id → organizations`, `user_id`, `ended_by_user_id → users`; một trong hai FK ghép `(invitation_id,organization_id,user_id)` hoặc `(join_request_id,organization_id,user_id)` tới nguồn đồng ý tương ứng. Có `title`, `valid_from`, `valid_to`, `end_reason` | Hiệu lực theo thời gian |
| `org_access_grants` | `organization_id → organizations`, `user_id`, `granted_by_user_id → users`; `permission_code`, `include_descendants`, `valid_from`, `valid_to` | MEMBERS_VIEW, ASSESSMENTS_VIEW, ASSESSMENTS_RUN, MEMBERS_NOTIFY, MEMBERS_MANAGE, STRUCTURE_MANAGE, ACCESS_MANAGE, REGULATIONS_CREATE, REGULATIONS_MANAGE, REGULATIONS_PUBLISH, REGULATIONS_SHARE, REGULATIONS_ADOPT, REGULATIONS_UPDATE |
| `organization_link_requests` | `child_organization_id`, `previous_parent_id`, `target_parent_id → organizations`; `requested_by_user_id`, `child_consented_by_user_id`, `parent_consented_by_user_id → users`; `reason`, thời điểm tạo/hết hạn/phản hồi | Loại ATTACH, DETACH, MOVE. Trạng thái PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED |
| `organization_link_history` | `child_organization_id`, `previous_parent_id`, `new_parent_id → organizations`; `request_id → organization_link_requests`, `changed_by_user_id → users`; `changed_at`, `reason` | Lịch sử chỉ thêm |

#### Thành tích, minh chứng và quy chế

| Bảng | Cột quan trọng và quan hệ | Miền giá trị |
| --- | --- | --- |
| `achievement_types` | `code` unique, `name`, `attribute_schema_json`, `is_active` | Loại định danh bằng catalog, không có enum cố định |
| `achievements` | `owner_user_id → users`, `achievement_type_id → achievement_types` nullable; `title`, `description`, `achieved_at`, `period_start/end`, `issuer`, `level_code`, `attributes_json`, `updated_at`, `deleted_at` | `visibility`: PRIVATE, PUBLIC. Xóa mềm theo `deleted_at`; kho cá nhân lọc theo owner |
| `evidence_files` | FK `(achievement_id,owner_user_id) → achievements(id,owner_user_id)`; `storage_key`, `original_filename`, `mime_type`, `byte_size`, `sha256`, `created_at`, `deleted_at` | Xóa mềm theo `deleted_at`. Nội dung file nằm ngoài SQL |
| `evidence_shares` | FK `(evidence_file_id,owner_user_id) → evidence_files(id,owner_user_id)`; một trong `recipient_user_id → users` hoặc `recipient_organization_id → organizations`; `include_descendants`, `valid_from/to`, `revoked_at` | Hiệu lực theo khoảng thời gian và thu hồi |
| `regulations` | `code` unique, `name`, `description`; `created_by_user_id`, `owner_user_id → users`, `owner_organization_id → organizations`; `is_public`, `is_internal` | `owner_type`: PERSONAL, ORGANIZATION. PERSONAL có thể public theo migration 007, cờ nội bộ chỉ dùng cho ORGANIZATION |
| `regulation_versions` | `regulation_id → regulations`; `version_label`, `effective_from/to`, `source_title`, `source_url`, `source_storage_key`, `issuing_authority`, `collected_at`, `applicability_json`, `aggregation_json`, `coverage_json`; người tạo, công bố, review → users; `published_at`, `ai_reviewed_at` | `publication_status`: DRAFT, PUBLISHED. `source_kind`: MANUAL, OFFICIAL, DEMO |
| `criterion_groups` | `regulation_version_id → regulation_versions`; `code`, `title`, `is_required`, `sort_order` | `operator`: AND, OR |
| `criteria` | `regulation_version_id → regulation_versions`; FK ghép `(criterion_group_id,regulation_version_id) → criterion_groups(id,regulation_version_id)` nếu có nhóm; `code`, `title`, `description`, `rule_json`, `source_reference`, `is_required`, `is_exclusion`, `sort_order`, `provenance_json` | `coverage_status`: AUTOMATED, MANUAL, UNSUPPORTED |
| `regulation_source_files` | `regulation_version_id → regulation_versions` unique, `owner_user_id → users`; `storage_key` unique, tên/MIME/kích thước/hash, `source_url`, `collected_at`, `issuing_authority`, `is_demo`, `extracted_text`, `extraction_error` | `extraction_status`: PENDING, EXTRACTED, FAILED. `extraction_method`: AUTO, MANUAL. MIME PDF hoặc DOCX |
| `regulation_shares` | FK `(regulation_version_id,regulation_id) → regulation_versions(id,regulation_id)`; một trong `recipient_user_id → users` hoặc `recipient_organization_id → organizations`; `shared_by_user_id`, `responded_by_user_id → users`; thời điểm tạo/phản hồi/thu hồi | PENDING, ACCEPTED, REJECTED, REVOKED |
| `regulation_adoptions` | FK ghép phiên bản và quy chế như trên; đích `user_id → users` hoặc `organization_id → organizations`; `adopted_by_user_id → users`; `share_id` liên kết qua FK ghép với quy chế và đúng người/đơn vị nhận; `adopted_at`, `updated_at` | `source_type`: OWNED, PUBLIC, SHARE. SHARE bắt buộc có `share_id` |
| `regulation_personal_exclusions` | PK ghép `(user_id,regulation_version_id)`; hai cột là FK tới `users` và `regulation_versions` | Ghi nhận loại trừ phiên bản khỏi ngữ cảnh cá nhân |

#### Kết quả, KPI, CV và tiện ích

| Bảng | Cột quan trọng và quan hệ | Miền giá trị |
| --- | --- | --- |
| `assessment_batches` | `initiated_by_user_id → users`, `organization_id → organizations` nullable; `include_descendants`, `request_snapshot_json`, `created_at`, `completed_at` | `batch_type`: PERSONAL, DISCOVERY, ORGANIZATION. `status`: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| `assessment_runs` | `batch_id → assessment_batches` nullable, `subject_user_id`, `initiated_by_user_id → users`, `regulation_version_id → regulation_versions`; `evaluation_date`, `assessed_at`, `completed_at`, `evaluator_version`, `input_snapshot_json`, `conclusion`, `completion_percent`, `explanation` | `status`: RUNNING, COMPLETED, FAILED. `conclusion`: MET, NOT_MET, INSUFFICIENT_DATA, NOT_APPLICABLE hoặc NULL theo trạng thái |
| `criterion_results` | FK `(run_id,subject_user_id,regulation_version_id) → assessment_runs(id,subject_user_id,regulation_version_id)`; FK `(criterion_id,regulation_version_id) → criteria(id,regulation_version_id)`; `actual_value`, `target_value`, `measure_unit`, `missing_details_json`, `criterion_snapshot_json`, `explanation` | `conclusion` có bốn giá trị như run, bắt buộc |
| `result_evidence` | FK `(criterion_result_id,subject_user_id) → criterion_results(id,subject_user_id)`, `(achievement_id,subject_user_id) → achievements(id,owner_user_id)`; FK tùy chọn `(evidence_file_id,achievement_id,subject_user_id) → evidence_files(id,achievement_id,owner_user_id)`; hai cột snapshot JSON | Khi có file FK thì bắt buộc có `evidence_snapshot_json` |
| `kpi_goals` | `owner_user_id → users`, `(source_result_id,owner_user_id) → criterion_results(id,subject_user_id)` tùy chọn; `title`, `description`, `target_value`, `measure_unit`, `start_date`, `due_date`, `deleted_at` | `progress_source`: MANUAL, ACHIEVEMENTS. `status`: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |
| `kpi_tasks` | `goal_id → kpi_goals`; `title`, `description`, `due_date`, `sort_order`, `completed_at` | TODO, IN_PROGRESS, DONE, CANCELLED |
| `kpi_progress` | FK `(goal_id,owner_user_id) → kpi_goals(id,owner_user_id)`; `current_value`, `note`, `recorded_at` | Giá trị không âm |
| `kpi_achievements` | PK `(goal_id,achievement_id)`; hai FK ghép với `owner_user_id` tới `kpi_goals` và `achievements`; `contribution_value`, `linked_at` | Đóng góp dương |
| `cv_templates` | `code` unique, `name`, `renderer_key`, `config_schema_json`, `is_active` | Handler dùng Modern, Academic, Minimalist. DB dùng catalog |
| `cvs` | `owner_user_id → users`, `template_id → cv_templates`; `title`, `public_slug` unique, `introduction`, `content_json`, `public_contact_settings_json`, `template_config_json`, `published_at` | PRIVATE, PUBLIC |
| `cv_achievements` | PK `(cv_id,achievement_id)`; hai FK ghép với `owner_user_id` tới `cvs` và `achievements`; `sort_order` | Thứ tự hiển thị |
| `notifications` | `recipient_user_id`, `sender_user_id → users`, `organization_id → organizations`, `assessment_run_id → assessment_runs`; `notification_type`, `title`, `body`, `payload_json`, `deduplication_key`, `created_at`, `read_at` | Loại là varchar(40), không có CHECK enum. Handler ghi các mã như MEMBERSHIP_INVITATION, ORGANIZATION_MESSAGE, REGULATION_UPDATED, ASSESSMENT_RESULT |
| `calendar_events` | `owner_user_id → users`, FK tùy chọn `(goal_id,owner_user_id) → kpi_goals(id,owner_user_id)`; `title`, `description`, `starts_at`, `ends_at`, `remind_at` | SCHEDULED, COMPLETED, CANCELLED |
| `audit_events` | `actor_user_id → users`, `organization_id → organizations`; `action_code`, `entity_type`, `entity_id`, `reason`, `details_json`, `occurred_at` | Mã nghiệp vụ dạng chuỗi. `entity_id` là định danh mô tả, không có FK đa hình. Chỉ thêm |

### 1.2. Cấu trúc JSON và hợp đồng backend

SQL Server lưu các cột JSON dưới dạng `nvarchar(max)`, thường có `CHECK(ISJSON(...)=1)`. Handler chuyển tên như `rule` hoặc `attributes` ở HTTP sang cột `rule_json` hoặc `attributes_json`, serialize khi ghi, parse khi đọc. `ISJSON` kiểm tra cú pháp JSON. Kiểm tra hình dạng, kiểu từng trường và ý nghĩa nằm ở backend khi có schema.

| Cột | Hình dạng và nơi dùng |
| --- | --- |
| `criteria.rule_json` | Nút logic `{operator, rules}` hoặc rule lá `{type, target, filters?, field?, comparator?, from?, to?, consecutive?, last_years?, measure_unit?}`. `rules` là 1–30 nút con đệ quy. Rule lá có type `count,sum,boolean,distinct_years`, target hữu hạn từ 0 đến 10¹², comparator `gte,lte,eq` mặc định `gte`, tối đa 30 filters mặc định rỗng. `sum` yêu cầu `field`. `consecutive` nếu có phải là `true` và chỉ hợp lệ với `distinct_years`. `last_years` là số nguyên 1–100. `from/to` là ngày ISO và phải có thứ tự. `measure_unit` mặc định “thành tích”, tối đa 80 ký tự |
| Filter trong `rule_json` | `{field,operator,value}`. Trường cho phép gồm `title`, `issuer`, `level_code`, `achievement_type_id`, `achieved_at` và `attributes.<key>` với key ASCII gồm chữ, số, gạch dưới. Chỉ đọc một cấp thuộc tính. Toán tử `eq,ne,in,gte,lte,contains`. `value` nhận string/number/boolean hoặc mảng những kiểu đó tối đa 100 phần tử. Schema dùng một union chung cho value, điều kiện kiểu riêng theo toán tử được xử lý khi chạy |
| `achievements.attributes_json` | Object mở `z.record(z.unknown())`, mặc định `{}`. PATCH có gửi `attributes` sẽ thay object. Không có bắt buộc theo `achievement_types.attribute_schema_json`. UI nhận biết các khóa như `hours`, `teaching_periods`, `contribution_percent`, `recognition_year` dưới dạng số, và còn xử lý `academic_year`, `grade`, `role`, `category`, `decision_number`. Rule có thể tham chiếu các khóa khác phù hợp whitelist |
| `person_profiles.attributes_json` | Object mở cùng kiểu backend, mặc định `{}`. PATCH thay object khi trường xuất hiện. Evaluator dùng `person_type` cột riêng để xét phạm vi. JSON hồ sơ được đưa vào hash đầu vào dù từng khóa trong đó chưa được evaluator đọc |
| `achievement_types.attribute_schema_json` | Metadata JSON cho catalog, mặc định `{}`, trả qua `attributeSchema` của API. Helper giao diện `dynamicAchievementFields` chọn trường theo code/tên. Handler lưu thành tích validate object mở |
| `regulation_versions.applicability_json` | `{person_types?: [...]}` với danh sách ít nhất một loại hồ sơ nếu cung cấp. Object rỗng áp dụng mọi loại |
| `regulation_versions.aggregation_json` | `{operator:'AND' hoặc 'OR', require_ungrouped?: boolean}`. Mặc định AND |
| `regulation_versions.coverage_json` và `criteria.provenance_json` | Coverage theo handler gồm các danh sách chuỗi `automated,manual,unsupported`. Provenance có thể chứa `source_quote,page,note,citations`, mỗi citation là `{label,url}`. Evaluator dựa vào `criteria.coverage_status` để chọn nhánh xử lý |
| `assessment_batches.request_snapshot_json`, `assessment_runs.input_snapshot_json` | Batch lưu request theo luồng. Run lưu `{profile,achievements,context,input_hash,regulation_version}`. Context chứa `adoption_id,context_type,organization_id,member_organization_id`. Phiên bản snapshot chứa nội dung nhóm và tiêu chí |
| `criterion_results.missing_details_json`, `criterion_snapshot_json` | Lá lưu `{remaining,unknown_attributes,comparator}`; nút logic lưu `{children}` với kết quả đánh giá con; coverage thủ công/chưa hỗ trợ lưu `{manual_review_required:true,coverage_status}`. Snapshot tiêu chí giữ bản ghi tiêu chí dùng trong lần chạy |
| `result_evidence.achievement_snapshot_json`, `evidence_snapshot_json` | Handler đánh giá ghi snapshot thành tích đủ trường đã nạp. Cột snapshot file có trong schema để dùng cùng FK file khi có |
| Các JSON tiện ích | CV hiện ghi `content_json={headline}` và `public_contact_settings_json={email,phone}` với giá trị boolean. `template_config_json` và `cv_templates.config_schema_json` mặc định `{}`. `notifications.payload_json` và `audit_events.details_json` phụ thuộc sự kiện, ví dụ thông báo quy chế mới có `regulation_id,regulation_version_id` |

Hai ví dụ dưới đây lấy từ test evaluator hiện có. Ví dụ thứ nhất là nội dung `rule_json`, ví dụ thứ hai là phần thuộc tính của thành tích cùng test. Test lần lượt bỏ trống, đặt `false`, rồi đặt `true` cho cờ văn bản công nhận để kiểm tra ba kết luận. [intelligence.test.js](backend/src/modules/intelligence.test.js)

```json
{
  "type": "count",
  "target": 1,
  "filters": [
    { "field": "attributes.kind", "operator": "eq", "value": "sang-kien" },
    { "field": "attributes.recognition_scope", "operator": "in", "value": ["MINISTRY", "PROVINCE"] },
    { "field": "attributes.has_recognition_doc", "operator": "eq", "value": true }
  ]
}
```

```json
{
  "kind": "sang-kien",
  "recognition_scope": "PROVINCE",
  "has_recognition_doc": true
}
```

### 1.3. Ràng buộc quan trọng theo tầng

| Nghiệp vụ | SQL Server | Backend |
| --- | --- | --- |
| Identity và phiên | Unique email chuẩn hóa và hash token, CHECK hạn/thời điểm tiêu thụ và thu hồi | Validate email và mật khẩu, kiểm tra tài khoản ACTIVE, so khớp hash phiên, khóa và xoay phiên trong transaction |
| Cây và membership | Trigger chống chu trình; shape ATTACH/DETACH/MOVE và điều kiện đồng ý; unique có điều kiện cho lời mời/đơn/yêu cầu liên kết PENDING; trigger khóa và chặn khoảng membership chồng nhau, đòi consent hợp lệ; lịch sử liên kết và audit chỉ thêm | Xác thực actor, quyền theo đơn vị/cấp dưới, trạng thái và thời hạn lời mời, quan hệ tổ chức và điều kiện bảo vệ quản lý; duyệt và ghi membership trong transaction |
| Kho và minh chứng | FK ghép bảo toàn owner; tiêu đề không rỗng; CHECK JSON, visibility, kỳ thành tích, xóa mềm và đích chia sẻ | Zod kiểm ngày/kiểu/độ dài, chỉ nhận loại thành tích active khi lưu, kiểm chủ sở hữu hoặc quyền tải, kiểm upload và lưu metadata/hash. Trường `period_start/end` tồn tại ở DB nhưng form schema CRUD V2 không nhận chúng |
| Quy chế và phân phối | Mã tài liệu unique; nhãn phiên bản, mã nhóm và mã tiêu chí unique trong phạm vi cha; FK ghép nhóm/phiên bản; trigger bảo vệ ownership và phiên bản đã công bố, cùng nhóm/tiêu chí/tệp nguồn. Unique một pin mỗi quy chế/người hoặc đơn vị. Share PENDING unique theo quy chế/người nhận hoặc đơn vị nhận. Pin mới/phần thay đổi cần nguồn hợp lệ, pin cũ có thể tồn tại sau khi thu hồi phân phối | Kiểm quyền quản lý/công bố/chia sẻ/tiếp nhận, quy tắc ngày, URL HTTP(S), rule schema, căn cứ và nhóm. Công bố cần ít nhất một tiêu chí, nhóm bắt buộc phải có tiêu chí, file nguồn nếu tồn tại đòi review. File nguồn PDF/DOCX tối đa 20 MiB, text xác nhận thủ công tối đa 2.000.000 ký tự |
| Kết quả đánh giá | Trigger kiểm tính nhất quán run và phiên bản công bố; run kết thúc và các kết quả tương ứng được bảo vệ. Chỉ ghi/sửa kết quả và liên kết chứng cứ khi run còn RUNNING. Unique mỗi tiêu chí trong run, unique theo bộ kết quả/thành tích/file. CHECK phần trăm 0–100 và trạng thái khớp metadata hoàn thành | Validate request, quyền và ngữ cảnh, hiệu lực theo ngày, schema JSON và giới hạn đệ quy khi chạy. Lưu run, kết quả, chứng cứ và hoàn tất trong cùng transaction |
| KPI và liên kết | Mục tiêu dương, tiến độ không âm, đóng góp dương, ngày đến hạn hợp lệ, DONE đi cùng `completed_at`; FK ghép kết quả nguồn, thành tích và owner | Kiểm sở hữu, mục tiêu/thành tích chưa xóa, phân nhánh tiến độ MANUAL/ACHIEVEMENTS. Tạo từ gap yêu cầu run hoàn tất, chưa stale và kết quả thiếu với `gte` cùng remaining dương hữu hạn |
| CV, lịch, thông báo | Slug unique đúng ký tự; CV công khai buộc có mẫu và thời điểm công bố. FK ghép ngăn gắn thành tích/KPI người khác. Lịch kiểm thứ tự start/end/reminder. Unique chống gửi trùng theo người nhận và dedup key có giá trị | Slug kiểm thêm danh sách từ dành riêng. CV lọc thành tích còn hiệu lực và cờ hiển thị liên hệ. Lịch validate ISO datetime, chuẩn hóa UTC, xác nhận chủ sở hữu KPI. Đánh dấu đọc giới hạn theo người nhận |

Nguồn schema và trigger [001](database/sqlserver/migrations/001_v2_schema.sql), [002](database/sqlserver/migrations/002_v2_integrity.sql), [003](database/sqlserver/migrations/003_regulation_distribution.sql), [004](database/sqlserver/migrations/004_distribution_integrity.sql), [005](database/sqlserver/migrations/005_source_transcription.sql), [006](database/sqlserver/migrations/006_allow_20mb_sources.sql), [007](database/sqlserver/migrations/007_regulation_sharing_and_join_requests.sql), [008](database/sqlserver/migrations/008_personal_regulation_exclusions.sql). Nguồn validate [shared.js](backend/src/modules/shared.js), [identityRoutes.js](backend/src/modules/identityRoutes.js), [vaultRoutes.js](backend/src/modules/vaultRoutes.js), [supportRoutes.js](backend/src/modules/supportRoutes.js), [regulationSourceRoutes.js](backend/src/modules/regulationSourceRoutes.js).

## 2. Bộ máy đối chiếu quy chế

### 2.1. Từ request tới snapshot

1. `POST /ai/evaluations/structured` yêu cầu đăng nhập. Body strict nhận `regulation_version_id`, `evaluation_date?` và `adoption_id?`. Chủ thể là chính actor. Thiếu ngày thì lấy ngày UTC của server. Request cá nhân gọi `runAssessment` với `batch_id = NULL`.
2. Nếu truyền `adoption_id`, handler kiểm tra cặp pin và version trong ngữ cảnh actor có thể dùng. Nếu không truyền, `runAssessment` tìm context cùng version, ưu tiên OWNER, tự chọn nếu chỉ có một lựa chọn hoặc yêu cầu chỉ rõ khi có nhiều lựa chọn mà không có OWNER. Context có thể cung cấp đơn vị gốc và đơn vị thành viên. Hàm dùng chung cho khám hộ thành viên còn kiểm `ASSESSMENTS_RUN` và membership hiệu lực.
3. Kiểm `canUseVersion`, sau đó đọc version, nhóm, tiêu chí. Version phải PUBLISHED, ngày đánh giá trong `[effective_from, effective_to]` bao gồm hai đầu. `effective_to = NULL` là không đặt giới hạn trên. Đây là cửa sổ hiệu lực **của quy chế**.
4. `inputSnapshot` đọc hồ sơ gồm `user_id,person_type,attributes_json` và đọc mọi `achievements` có `owner_user_id = subject`, `deleted_at IS NULL`, theo `ORDER BY id`. Tập SQL gồm cả thành tích chưa phân loại, thành tích khác loại, và thành tích sau ngày đánh giá. SQL ở bước này không lọc `visibility`, loại đang active, tệp minh chứng hay ngày đạt. Mỗi record còn được parse `attributes_json` thành `attributes`. Context tổ chức quyết định quyền dùng quy chế và chủ thể, thành tích vẫn là kho của chủ thể.
5. Mỗi rule lá lọc theo `achieved_at`, với cận trên là ngày nhỏ hơn giữa `to` và ngày đánh giá (hoặc ngày đánh giá nếu thiếu `to`). Cận dưới là `from` nếu có, kết hợp `last_years` bằng ngày muộn hơn giữa `from` và ngày đánh giá lùi số năm trong UTC. Cả hai cận inclusive. Loại thành tích chỉ lọc khi rule đặt filter trên `achievement_type_id`. Giá trị `period_start/end` có trong snapshot nhưng không tham gia cửa sổ rule.
6. Handler lưu snapshot và hash, tạo run RUNNING với `evaluator_version = personal-vault-rules/2`, ghi từng kết quả/quan hệ chứng cứ, cập nhật COMPLETED và trả chi tiết HTTP 201. Nếu xảy ra lỗi trong transaction, các ghi của lần chạy được rollback. Bộ máy xét rule xử lý đồng bộ trong request và không gọi LLM.

Nguồn mã [intelligenceRoutes.js](backend/src/modules/intelligenceRoutes.js#L100), [regulationAccess.js](backend/src/modules/regulationAccess.js), [intelligenceEvaluator.js](backend/src/modules/intelligenceEvaluator.js).

### 2.2. Điều kiện, số tích lũy và điểm hoàn thành

**Bộ lọc mỗi lá.** Mọi filter phải đúng trên cùng một thành tích. `eq/ne` so sánh nghiêm ngặt, `in` yêu cầu value là mảng rồi dùng `includes`, `contains` tìm chuỗi con không phân biệt hoa thường, `gte/lte` yêu cầu hai vế là number. Chuỗi số không được ép kiểu. Một trường null/undefined đánh dấu khả năng thiếu dữ liệu nếu record vẫn qua các filter còn lại. Nếu một filter khác loại record chắc chắn, record đó không gắn cờ unknown. Các rule khác nhau có thể tính cùng một thành tích.

| Rule lá | Giá trị `actual_value` |
| --- | --- |
| `count` | Số record khớp |
| `boolean` | Có ít nhất một record khớp thì 1, còn lại 0. Kết quả vẫn so với `target` bằng comparator |
| `sum` | Tổng các số hữu hạn của `field` trên record khớp. Trường thiếu, sai kiểu hoặc không hữu hạn được bỏ khỏi tổng và bật cờ unknown |
| `distinct_years` | Số năm lịch khác nhau của `achieved_at`. Với `consecutive:true`, dùng chuỗi năm liên tiếp dài nhất trong các năm khớp, không bắt buộc kết thúc vào năm đánh giá |

So sánh `actual` với target bằng `gte` (≥), `lte` (≤), `eq` (=). `remaining = max(0,target-actual)` chỉ với `gte`, còn các comparator khác có `remaining:null`. Khi có unknown, sum luôn chuyển sang INSUFFICIENT_DATA, kể cả tổng đã đạt target. Với các loại còn lại, unknown luôn làm `eq/lte` chưa đủ dữ liệu; với `gte`, unknown chỉ làm bất định khi phần đã biết chưa đạt ngưỡng. Khi không có record và không có unknown, giá trị 0 được so sánh bình thường. Rule logic không tạo actual/target tổng, và giới hạn runtime là depth 12 với gốc có depth 0.

**Tổng hợp logic.** `combine` loại NOT_APPLICABLE. Nếu rỗng, trả INSUFFICIENT_DATA. AND ưu tiên NOT_MET, rồi INSUFFICIENT_DATA, rồi MET. OR ưu tiên MET, rồi INSUFFICIENT_DATA, rồi NOT_MET. Áp dụng theo ba tầng:

1. Trong rule lồng, đánh giá mọi nhánh bằng cùng tập thành tích rồi combine kết luận con theo AND/OR của nút. Không dừng sớm khi một nhánh đã đủ kết luận.
2. Ở phiên bản, chỉ tiêu chí `is_required` và không phải exclusion tham gia tổng hợp dương. Nhóm tham gia khi `is_required` và có ít nhất một tiêu chí bắt buộc được chọn, dùng operator của nhóm. Aggregation của version kết hợp các kết luận nhóm và tiêu chí bắt buộc ngoài nhóm. Nếu `require_ungrouped:true`, gộp các nhóm theo operator của version trước, rồi dùng AND để buộc kết quả nhóm đó và từng tiêu chí ngoài nhóm. Các nhóm tùy chọn không đi vào tổng hợp.
3. Exclusion là tiêu chí riêng. Khi rule cấm khớp, đảo MET thành NOT_MET; khi không khớp, đảo NOT_MET thành MET; INSUFFICIENT_DATA giữ nguyên. Bất kỳ exclusion NOT_MET nào cũng ép kết luận toàn version thành NOT_MET khi thuộc phạm vi. Exclusion chưa đủ dữ liệu chỉ hạ kết luận đang MET xuống INSUFFICIENT_DATA. Cờ bắt buộc và nhóm không vô hiệu hóa exclusion.

**Điểm hiển thị.** `completion_percent` là số tiêu chí MET chia toàn bộ tiêu chí, làm tròn hai chữ số. Mẫu số gồm cả tiêu chí tùy chọn, loại trừ, không áp dụng và cần xem thêm. Danh sách rỗng cho 0%. Do logic nhóm và exclusion, phần trăm cao vẫn có thể đi cùng NOT_MET, còn kết luận MET vẫn có thể dưới 100%.

### 2.3. Minh chứng, kết luận và stale

**Ánh xạ chứng cứ.** Rule lá trả ID của mọi record qua điều kiện ngày/filter. Với sum, một record có thể nằm trong `matches` dù trường cộng của nó thiếu. Với chuỗi năm liên tiếp, `matches` vẫn gồm tất cả record khớp, kể cả record ngoài chuỗi dài nhất. Nút AND/OR hợp nhất và khử trùng ID từ mọi nhánh. Kết luận cuối có thể NOT_MET hoặc bị ghi đè bởi applicability mà vẫn còn matches. Handler tạo một dòng `result_evidence` cho mỗi thành tích khớp của mỗi tiêu chí, với `achievement_snapshot_json`. Luồng này để `evidence_file_id` và snapshot file trống. Chi tiết của chính chủ hoặc ZIP tìm file **hiện còn hoạt động** bằng cách nối qua `achievement_id`, nên tệp hiển thị có thể thay đổi sau đánh giá. Có dòng evidence xác nhận record khớp rule, không xác nhận file đã được duyệt.

| Kết luận lưu ở DB | Khi xuất hiện |
| --- | --- |
| MET | Lá đạt comparator, hoặc kết quả tổ hợp đạt. Exclusion đạt khi điều kiện cấm được xác định là không xảy ra |
| NOT_MET | Có đủ dữ liệu và chưa đạt comparator, hoặc kết luận toàn phiên bản bị chặn bởi exclusion |
| INSUFFICIENT_DATA | Dữ liệu thiếu có thể thay đổi kết quả, hồ sơ thiếu `person_type` trong khi version giới hạn theo loại, coverage MANUAL/UNSUPPORTED, hoặc tập kết luận tổng hợp rỗng sau khi bỏ NOT_APPLICABLE |
| NOT_APPLICABLE | `person_type` đã biết nhưng nằm ngoài `applicability.person_types`. Applicability ghi đè kết luận tiêu chí và version. Với rule tự động, giá trị/snapshot khớp đã tính vẫn có thể được giữ |

MANUAL và UNSUPPORTED là `coverage_status`, đều lưu kết luận INSUFFICIENT_DATA với `manual_review_required:true`, `coverage_status` đi kèm, giá trị/null và danh sách matches rỗng. `status` của run (RUNNING, COMPLETED, FAILED) là vòng đời thực thi, tách khỏi kết luận nghiệp vụ. Handler POST hiện hoàn tất trong transaction khi thành công, lỗi thực thi không tự sinh một bản ghi FAILED qua đường này.

**Phát hiện thay đổi.** Khi ghi run, backend tính SHA-256 trên JSON serialize của đúng object `{profile,achievements}` từ `inputSnapshot`, lưu tại `input_snapshot_json.input_hash`. `runDetail` nạp lại cùng truy vấn, cùng thứ tự thành tích theo id, băm và trả `stale = hash_cũ !== hash_mới`. Đây là cờ tính khi đọc, không có cột stale. Thêm/xóa mềm/khôi phục thành tích, cập nhật bất kỳ trường snapshot hoặc `updated_at`, đổi `person_type` hoặc JSON hồ sơ đều có thể làm stale. Vì hash bao phủ cả kho hoạt động, một record ngoài cửa sổ ngày hoặc ngoài loại của rule cũng có thể kích hoạt cờ. Các dữ liệu ngoài snapshot như tên hồ sơ, việc xóa tệp qua API, tên trong catalog, context/adoption và phiên bản mới không trực tiếp đổi hash. Upload minh chứng qua handler hiện hành cập nhật cả `achievements.updated_at` nên có thể làm stale gián tiếp. Xóa tệp chỉ cập nhật `evidence_files.deleted_at`. Quyền đọc và khả năng dùng phiên bản được kiểm tra riêng. Endpoint `latest` và `history` lấy chỉ mục tóm tắt SQL, không chạy `runDetail`; cờ hiện trên response chi tiết và các luồng gọi helper đó. Tạo KPI từ gap kiểm cờ trước khi ghi.

Nguồn mã [intelligenceEvaluator.js](backend/src/modules/intelligenceEvaluator.js), [intelligenceRoutes.js](backend/src/modules/intelligenceRoutes.js#L100), [supportRoutes.js](backend/src/modules/supportRoutes.js).

## 3. Bản đồ và phương án tách frontend

### 3.1. Module trang và component đi kèm

| File | Trách nhiệm |
| --- | --- |
| [Profile.jsx](frontend/src/pages/Profile.jsx) | Hồ sơ, tab CV và `PasswordForm` |
| [Cv.jsx](frontend/src/pages/Cv.jsx) | Form, lưu/xuất CV và `CvLivePreview` |
| [PublicCv.jsx](frontend/src/pages/PublicCv.jsx) | Render CV công khai theo slug |
| [Achievements.jsx](frontend/src/pages/Achievements.jsx) | Kho thành tích, thùng rác, minh chứng, trích xuất AI và `AchievementDrop` |
| [Discovery.jsx](frontend/src/pages/Discovery.jsx) | Đối chiếu cá nhân, lịch sử, `OrganizationAssessment`, `AssessmentPicker` và `AssessmentBadge` |
| [Goals.jsx](frontend/src/pages/Goals.jsx) | KPI cá nhân và `GoalCompletion` |
| [Organizations.jsx](frontend/src/pages/Organizations.jsx) | Cây tổ chức, yêu cầu, thành viên và dialog phân quyền qua `OrgHierarchyTree`, `OrganizationTools`, `OrganizationMembers`, `OrganizationPermissionDialog` |
| [Reports.jsx](frontend/src/pages/Reports.jsx) | Thống kê thành tích theo năm và loại |
| [Admin.jsx](frontend/src/pages/Admin.jsx) | Tài khoản, quyền toàn hệ thống và `AchievementCatalog` |
| [RegulationLibrary.jsx](frontend/src/pages/RegulationLibrary.jsx) | Kho quy chế, tải và quản lý phiên bản |

### 3.2. Điểm dùng chung và quyền sở hữu state

| Thành phần | Hợp đồng và phạm vi |
| --- | --- |
| `api(url,method,data,options)` và `saveBlob` | Wrapper V2 đặt `fresh:true`, giữ cấu hình multipart cho `FormData`, truyền tùy chọn cuối để caller có thể override. `request.js` bóc response envelope và thực thi chính sách read cache. `apiClient.js` quản lý bearer token, refresh và lỗi. `saveBlob` quản lý vòng đời object URL khi tải |
| `useLoad(url)` | Mỗi instance giữ `data/error/loading` và `reload`, ref generation vô hiệu hóa phản hồi cũ khi URL đổi/unmount. Dùng ở hồ sơ, CV cá nhân/công khai, catalog, đánh giá, KPI, tổ chức và admin. URL null đóng luồng tải |
| `useCollection(url)` | Hợp đồng state giống `useLoad`, tự gom trang `pageSize=100`; dừng khi trang ngắn hoặc đủ total. Dùng cho thành tích, thùng rác, chọn thành tích cho CV/KPI và báo cáo. Hook có state riêng mỗi lần gọi |
| UI dùng chung | `Page` và bảng lối tắt, `Field`, `Load`, thông báo lỗi/rỗng, `Item`, `DateText`, `StatusBadge`, hằng class style; `VaultDialog`, `VaultTabs`, `NumberedPagination` đã nằm trong `components/common`. `missingText` và `AssessmentBadge` nghiêng về nghiệp vụ đối chiếu |
| Helpers đã tách | `achievementFields.js` xử lý field động và ánh xạ gợi ý. `assessmentSelection.js` lọc context/hiệu lực. `regulationRule.js` và `RegulationRuleDescription.jsx` trình bày rule. `RegulationLibrary.jsx` sở hữu state thư viện và hợp đồng tải riêng |
| State xuyên màn hình | `AuthContext` là nguồn dùng chung cho phiên, user và role. URL mang lựa chọn như `?tab=cv`, `?goal=…`, query điều hướng từ kết quả sang kho, và slug CV. Dữ liệu bền dùng API/DB. Các trang sở hữu state cục bộ và dùng chung phiên đăng nhập |
| State nghiệp vụ giữ cục bộ | Profile giữ tab và form, Cv giữ form và bản đã lưu; Achievements giữ draft/file/extraction/preview; Discovery giữ context và run, OrganizationAssessment giữ lựa chọn/batch/thông báo; Goals giữ list/detail và truyền reload vào GoalCompletion; Organizations giữ đơn vị/tab/member, truyền props và callback xuống dialog; Admin giữ thao tác chờ xác nhận |

Nguồn mã [request.js](frontend/src/services/request.js), [readCachePolicy.js](frontend/src/services/readCachePolicy.js), [AuthContext.jsx](frontend/src/context/AuthContext.jsx), [assessmentSelection.js](frontend/src/pages/assessmentSelection.js), [achievementFields.js](frontend/src/pages/achievementFields.js).

### 3.3. Ranh giới dùng chung sau khi tách

- [vaultApi.js](frontend/src/services/vaultApi.js) đóng gói HTTP, chuẩn hóa danh sách và tải blob. [useLoad.js](frontend/src/hooks/useLoad.js) và [useCollection.js](frontend/src/hooks/useCollection.js) giữ hợp đồng tải, phân trang và generation.
- [VaultPage.jsx](frontend/src/components/common/VaultPage.jsx) giữ layout trang và lối tắt. [VaultPrimitives.jsx](frontend/src/components/common/VaultPrimitives.jsx) chứa field, trạng thái tải/lỗi/rỗng, ngày và nhãn trạng thái. [vaultStyles.js](frontend/src/components/common/vaultStyles.js) chứa các class dùng chung.
- [AppRoutes.jsx](frontend/src/routes/AppRoutes.jsx) import trực tiếp từ từng trang. URL, query params, guard, vị trí provider và quyền sở hữu state được giữ nguyên. Preview CV nằm cạnh editor. Renderer công khai nằm ở trang riêng.
