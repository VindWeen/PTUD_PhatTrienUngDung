# API runtime V2

Tiền tố mặc định `/api/v1`. Đây là chỉ mục các nhóm API hiện được gắn trong `backend/src/app.js`, không phải đặc tả đầy đủ về body hay quyền: xem schema validation và kiểm quyền trong `backend/src/modules/` khi tích hợp. JSON thành công thường có dạng `{ success: true, data: ... }`; tải tệp trả nội dung nhị phân. Các endpoint riêng tư yêu cầu bearer token; refresh dùng cookie.

| Nhóm | Các đường dẫn chính |
| --- | --- |
| Tài khoản | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/auth/me`, `/me/profile` |
| Tổ chức | `/organizations`, `/organizations/:id/members`, `/organizations/:id/invitations`, `/me/invitations`, `/invitations/:id/respond`, `/organizations/:id/access`, `/organizations/:id/link-requests`, `/organization-link-requests/:id/respond`, `/organizations/:id/notifications` |
| Quản trị | `/admin/users`, `/admin/global-roles` |
| Thành tích và minh chứng | `/achievements`, `/achievements/catalogs`, `/achievements/:id/restore`, `/achievements/:id/evidences`, `/evidences/:id`, `/evidence-files/:id/download`, `/evidence-files/:id/shares`, `/achievements/ai-extract` |
| Quy chế | `/regulations/documents`, `/regulations/documents/:id/versions`, `/regulations/versions/:id`, `/regulations/versions/:id/groups`, `/regulations/versions/:id/criteria`, `/regulations/versions/:id/publish` |
| Khám và KPI | `/ai/evaluations/structured`, `/ai/auto-discovery`, `/organizations/units/:id/ai-scan`, `/kpi/goals`, `/kpi/from-ai-gap`, `/kpi/goals/:id/progress`, `/kpi/goals/:id/tasks`, `/kpi/goals/:id/achievements` |
| CV và tiện ích | `/cv/templates`, `/me/cv`, `/public/cv/:slug`, `/me/cv/export-docx`, `/ai/export-dossier-zip`, `/me/calendar/events`, `/notifications`, `/reports` |

Thành tích thuộc người tạo; việc xem kết quả khám tổ chức không mặc nhiên cho phép đọc minh chứng riêng. KPI từ tiêu chí thiếu dựa trên kết quả đã lưu, còn hiệu lực và thỏa điều kiện backend. CV công khai chỉ hiển thị dữ liệu chủ sở hữu đã chọn. Quy chế và tiêu chí cần được nhập, kiểm chứng và công bố trước khi sử dụng để khám.

API xét duyệt và khen thưởng đời trước có thể tra cứu trong lịch sử Git.

## Liên kết và gia nhập tổ chức

- Tạo đơn vị con bằng `POST /organizations` với `parentId`. Với hai đơn vị đã tồn tại, bên cha hoặc bên con gửi `POST /organizations/:childId/link-requests` với `targetParentId`. Bên có quyền xem yêu cầu qua `GET /organizations/:id/link-requests` và phản hồi qua `POST /organization-link-requests/:id/respond`.
- Người dùng xin gia nhập qua `POST /organizations/:id/join-requests` với `reason` tùy chọn và xem trạng thái qua `GET /me/join-requests`. Người quản lý thành viên xem yêu cầu qua `GET /organizations/:id/join-requests` và duyệt hoặc từ chối qua `POST /organizations/:id/join-requests/:requestId/respond` với `{accept:boolean}`. Việc duyệt tạo quan hệ thành viên.

## Quy chế sở hữu và tiếp nhận

- Tạo document: POST `/regulations/documents` với `code,name,description?`; mặc định riêng tư cá nhân. Thêm `owner_organization_id` cho tổ chức; `is_public,is_internal` cần quyền chia sẻ độc lập. Không đổi chủ sở hữu qua PATCH.
- Kho đã ghim: GET `/regulations/library` trả `adoption_id,context_type,organization_id,member_organization_id,regulation_version_id`, thời hạn và thông tin bản mới. Document/version xem được chưa đồng nghĩa được chạy khám.
- Tiếp nhận/cập nhật: POST `/regulations/versions/:id/adopt` body `{}` cho cá nhân hoặc `{organization_id}` cho đơn vị. Phiên bản phải đã công bố, đúng nguồn phân phối; tổ chức cần quyền ADOPT hoặc UPDATE nếu đã có pin.
- Chia sẻ đích danh qua `POST /regulations/versions/:id/shares` với `{recipient_organization_id}` hoặc `{recipient_email}`. Chủ sở hữu cá nhân có thể gửi cho tổ chức mình thuộc hoặc cấp cha của tổ chức đó. Bên nhận xem lời chia sẻ qua `GET /regulations/shares` và tiếp nhận hoặc từ chối qua `POST /regulations/shares/:id/respond` với `{accept:boolean}`. Tiếp nhận ghim phiên bản cho bên nhận. Thu hồi qua `POST /regulations/shares/:id/revoke` giữ lượt ghim đã chấp nhận.
- Cập nhật phạm vi qua `PATCH /regulations/documents/:id/distribution`. Cá nhân có thể bật công khai. Với quy chế tổ chức, bật nội bộ để thành viên đơn vị sở hữu và đơn vị trực thuộc xem phiên bản đã công bố. Đơn vị sở hữu ghim phiên bản để dùng chung. Quyền quản lý được kế thừa từ đơn vị cha không cho phép đọc quy chế riêng của đơn vị con.
- Phiên bản hỗ trợ `source_kind` (MANUAL/OFFICIAL/DEMO), `issuing_authority,collected_at,coverage` (các mảng automated/manual/unsupported). Tiêu chí hỗ trợ `coverage_status` và `provenance:{source_quote,page,note}`. Loại MANUAL/UNSUPPORTED không tự kết luận đạt.
- Khám cá nhân POST `/ai/evaluations/structured` hỗ trợ `adoption_id`. Nếu chỉ có một bối cảnh thì backend suy ra; nhiều bối cảnh phải chọn rõ. Kết quả lưu bối cảnh và ảnh chụp đầu vào, không thay pin tự động. Tự khám tất cả giữ từng bối cảnh; khám tổ chức bắt buộc phiên bản đã được tổ chức/cấp trên chọn.

## Lịch sử đánh giá và thông báo

- `GET /ai/evaluations/structured/latest` trả lần đánh giá mới nhất theo phiên bản và bối cảnh. `GET /ai/evaluations/structured/history` trả lịch sử phân trang. `GET /ai/evaluations/structured/:id` trả chi tiết.
- `POST /organizations/units/:id/assessment-notifications` gửi kết quả cho thành viên trong phạm vi quyền. `PATCH /notifications/:id/read` và `POST /notifications/read-all` đánh dấu đã đọc.
- `DELETE /regulations/versions/:id/adopt` bỏ áp dụng cho cá nhân.
- API lịch cá nhân dùng `GET/POST /me/calendar/events` và `PATCH/DELETE /me/calendar/events/:id`. Xem [payload và cách kiểm tra](../PERSONAL_CALENDAR.md).

## File nguồn quy chế

Tiền tố `/regulations/versions/:id/source`: POST multipart với một trường `file` PDF/DOCX tối đa 20 MiB; các trường tùy chọn `sourceUrl,collectedAt,issuingAuthority,isDemo` (chuỗi true/false). GET metadata/văn bản; GET `/preview` lấy bản xem trước; GET `/download` kiểm quyền và SHA256; POST `/extract` trích xuất; PATCH `/text` với `{text,confirmed:true}` nhập bản chép đã kiểm tra; POST `/ai-propose` chỉ trả đề xuất có căn cứ, không ghi tiêu chí; POST `/review` với `{confirmed:true}` xác nhận nguồn/bộ tiêu chí. Chỉnh sửa nội dung sau đó làm mất xác nhận. Công bố nguồn-backed cần xác nhận; bản công bố không sửa nguồn/nội dung. Không trả storage key hay URL static.
