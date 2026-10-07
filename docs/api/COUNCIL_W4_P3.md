# W4-P3 — Hội đồng xét đề nghị

Phụ trách: Võ Nhạc Phước. DB chốt là Supabase PostgreSQL schema `app` qua `pg`, thay phương án SQL Server cũ. Giữ Express JWT, scope hiệu lực và file private. Migration cộng thêm: `20261007000024_w4_p3_council.sql`; không sửa migration đã áp dụng.

## Hợp đồng và phụ thuộc

Tái sử dụng W3-P3 (`AWARD_APPLICATIONS_W3_P3.md`), W1-Q3 (Express auth/RBAC/scope), W2-P3 (`NOTIFICATIONS_W2_P3.md`). Git local xác nhận W3-P3, W2-P3 và merge PR #2 của W1-Q3 nằm trong HEAD. Tip nhánh W1-Q3 có commit bổ sung không phải ancestor HEAD; không nhập lại hoặc ghi đè auth. Không coi trạng thái remote-tracking local là trạng thái PR trực tuyến hiện tại.

Không tự suy ra tiêu chí, căn cứ pháp lý, KPI hoặc kết quả AI. Không thêm AI vào thao tác Hội đồng. Snapshot đầu vào được giữ bất biến; dữ liệu KPI mô phỏng của các module khác phải giữ nhãn nguồn hiện có.

## Luồng cố định

`DRAFT → submit → SUBMITTED → forward (Manager) → COUNCIL_PENDING → assign → UNDER_REVIEW`.

Tại Hội đồng: ghi ý kiến không đổi status; `request-correction → NEED_CORRECTION`; chính chủ/đại diện gửi nội dung bổ sung bằng `resubmit → SUBMITTED`, đơn vị kiểm tra và `forward` lại Hội đồng. Phân công trước đó được giữ, nhưng quyền/scope hiệu lực luôn được kiểm tra lại.

Người xét đã phân công có thể `recommend → RECOMMENDED` hoặc `not-recommend → NOT_RECOMMENDED`. Hai kết luận là kết quả **đề nghị**, không phải quyết định trao thưởng. Không tạo AwardDecision/AwardRecord, không dùng trạng thái APPROVED cũ cho luồng mới. RecordsOfficer tiếp tục dùng API W2-P2 với quyết định và file quyết định private; kết luận Hội đồng không thay thế các điều kiện này.

## API `/api/v1`

Tất cả yêu cầu Express authentication; envelope/error dùng middleware hiện có.

| POST `/award-applications/:id/...` | Body | Quyền/trạng thái |
|---|---|---|
| `assign` | `{version,reason,reviewerId}` | Council đúng scope; hồ sơ COUNCIL_PENDING/UNDER_REVIEW; người được giao cũng phải là Council đúng scope và không tự xét |
| `comment` | `{version,reason}` | Council đã phân công, COUNCIL_PENDING/UNDER_REVIEW |
| `request-correction` | như trên | Council đã phân công, COUNCIL_PENDING/UNDER_REVIEW |
| `resubmit` | như trên | Chủ/đại diện hiệu lực, NEED_CORRECTION |
| `recommend` / `not-recommend` | như trên | Council đã phân công, COUNCIL_PENDING/UNDER_REVIEW |

`version`: số nguyên dương an toàn; `reason`: trim, 5–1000 ký tự. Body strict; không nhận status, decisionId, recipient hoặc nguồn AI. Sai body 400, sai quyền/scope/phân công/tự xét 403, sai version/status hoặc trùng phân công 409. ID không tồn tại 404. Khóa hàng `FOR UPDATE` và UPDATE có điều kiện status/version; cả ý kiến và phân công đều tăng version để phát hiện cập nhật đồng thời.

GET detail thêm `reviews`, `comments`, `canCouncil`, `canReview`; cờ UI chỉ hỗ trợ hiển thị, POST kiểm tra lại quyền. GET list `?contextUnitId=<id>&page=1&pageSize=20` là hàng chờ theo đơn vị cụ thể, kiểm tra scope gồm quyền kế thừa hiện có, lọc từng hồ sơ; Council không đọc nháp hoặc hồ sơ chưa chuyển đơn vị trừ khi có quyền khác. Phân trang hiện hữu có thể có trang ít dòng do lọc quyền.

API quản trị W2-P1 `/admin/user-roles` và `/admin/scopes` được tái sử dụng để cấp vai trò COUNCIL và scope. W4-P3 mở rộng danh sách vai trò được cấp scope thêm COUNCIL; vẫn chỉ Admin được cấp, cần tài khoản/đơn vị/role hoạt động và vai trò bao phủ thời hạn scope. UI Admin hiện có lấy danh sách vai trò từ DB nên không cần màn hình cấp quyền mới.

## Transaction, thông báo và dữ liệu

Một pg client ghi phân công/ý kiến, status/version, history, notification và audit trước COMMIT. Lỗi bất kỳ bước nào ROLLBACK. `application_reviews` lưu phân công; `application_review_comments` lưu nội dung append-only qua API. Không có API sửa/xóa lịch sử hay ý kiến. RLS và REVOKE chặn Data API.

Notifications thêm entityType `APPLICATION`, không chứa nội dung ý kiến hoặc file. Người nhận: creator còn quyền đọc và các reviewer đã phân công còn quyền đọc; không tự thêm Admin. Không có reviewer thì hồ sơ chờ phân công qua hàng chờ, không tự xét. Inbox kiểm tra lại quyền chủ thể/Manager/Council theo scope hiệu lực. Unique notification theo user/entity/version giữ idempotency. Bộ phát APPLICATION dùng riêng trong ApplicationService, không mở rộng eventSchema AWARD/ACHIEVEMENT của W2-P3.

## Tự kiểm tra

1. Áp dụng migration bằng `npm run migrate` trong backend trên môi trường được phép. Không chạy seed lên dữ liệu thật. Dùng Admin hiện có cấp role COUNCIL và scope hiệu lực cho tài khoản test; không cấp scope theo nơi công tác.
2. Mở `/award-applications`, tạo cá nhân hoặc tập thể với thành tích VERIFIED có revision/file private, nộp; Manager đúng scope nhập ý kiến rồi chuyển Hội đồng.
3. Hội đồng nhập mã đơn vị, tải danh sách, mở hồ sơ, giao người xét hợp lệ. Người chưa được giao không ghi ý kiến/kết luận. Người tạo/chủ cá nhân/đại diện tập thể không được tự xét.
4. Yêu cầu bổ sung, chủ thể nhập nội dung và gửi lại; Manager chuyển lại; Council ghi kết luận. Mở hai phiên cùng hồ sơ, thao tác phiên cũ phải nhận 409; tải lại hồ sơ để có version mới.
5. Xem lịch sử/ý kiến/thông báo. Thu hồi scope để kiểm tra API/inbox chặn quyền. Kiểm tra không tăng số quyết định hoặc AwardRecord sau kết luận.

Bổ sung trong phạm vi này là nội dung văn bản có lịch sử. Không thay snapshot hoặc thay file đầu vào của W3-P3; nếu cần đổi thành tích/file phải tạo đề nghị mới. Chưa có liên kết tự động từ kết luận sang bản ghi khen thưởng; RecordsOfficer ghi nhận riêng bằng quyết định thật. Chưa kiểm thử tương tác trình duyệt thủ công.
