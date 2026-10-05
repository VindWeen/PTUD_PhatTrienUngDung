# W2-P3 — Thông báo và hợp đồng event

Phụ trách: Võ Nhạc Phước. Kiến trúc: Supabase PostgreSQL schema `app` qua `pg`; giữ auth Express và file private. Migration nguồn duy nhất: `supabase/migrations/20261005000015_w2_p3_notifications.sql`. Không dùng DB SQL Server của kế hoạch cũ.

## API đã triển khai

Yêu cầu JWT Express, envelope `{success:true,data:...}`; lỗi theo middleware chung.

- `GET /api/v1/notifications?page=1&pageSize=20&unreadOnly=false`: `data = {items, total, unreadCount, page, pageSize}`. `total` theo bộ lọc; `unreadCount` theo toàn inbox còn quyền hiện tại. Page >= 1, pageSize 1–100. Query ngoài hợp đồng bị 400. Sắp xếp createdAt DESC rồi notificationId DESC; phân trang offset, nên trang có thể dịch khi event mới đến.
- `PATCH /api/v1/notifications/:id/read`: idempotent, không đổi readAt đã có. Trả một item. ID người khác hoặc mất quyền hiện tại trả cùng 404. Không nhận userId từ client; lấy từ JWT.
- Item: `{notificationId, entityType, entityId, version, fromStatus, toStatus, createdAt, readAt}`; BIGINT IDs có thể là chuỗi, thời gian ISO, readAt nullable. Không có tên hồ sơ, lý do, thông tin cá nhân hay đường dẫn file. UI dựng câu thông báo từ mã trạng thái.

## Event service dùng chung

```js
import { notifyStatusChanged } from '../notifications/notificationService.js';
// Sau kiểm tra quyền, khóa bản ghi, kiểm tra trạng thái/version,
// UPDATE tăng version và INSERT lịch sử/snapshot, trong transaction hiện tại:
await notifyStatusChanged(client, {
  entityType: 'AWARD', // hoặc ACHIEVEMENT
  entityId: updated.record_id,
  version: updated.version,
  fromStatus: previous.status,
  toStatus: updated.status,
});
// Tiếp tục ghi audit cùng client, rồi module gọi COMMIT.
```

Service không BEGIN/COMMIT và không fallback sang pool. Module gọi phải truyền client đang trong transaction và await; lỗi phải truyền ra để rollback. Không gọi sau COMMIT. Payload strict, không nhận recipient/title/reason. Kiểm tra trạng thái/version DB đã cập nhật; AWARD còn kiểm tra lịch sử. Unique(user_id, entity_type, entity_id, entity_version) chặn event trùng. Nếu không có người nhận hợp lệ, trả mảng rỗng, không tự gán Admin.

| Event | Người nhận |
|---|---|
| AWARD DRAFT → RECORDED; RECORDED → REVOKED | Chủ giảng viên hoặc đại diện tập thể hiệu lực |
| ACHIEVEMENT DRAFT/NEED_CORRECTION → SUBMITTED | Manager hiệu lực có scope tại ContextUnitId hoặc cha includeDescendants; loại người tạo/nộp/chủ giảng viên |
| ACHIEVEMENT SUBMITTED → NEED_CORRECTION/VERIFIED/REJECTED/CANCELLED; DRAFT/NEED_CORRECTION → CANCELLED; VERIFIED → REVOKED | Chủ giảng viên hoặc đại diện tập thể hiệu lực |

Recipients lấy từ DB, chỉ tài khoản ACTIVE. Đại diện cần role và assignment hiệu lực, không suy ra quyền từ nơi công tác. Đọc/list/read kiểm tra lại quyền của audience; mất phân công sẽ ẩn thông báo và không được đánh dấu. Không gửi cho creator cũ nếu đã mất quyền tập thể. Manager dùng ContextUnitId lịch sử và chống tự duyệt. Thông báo không mở rộng quyền truy cập các API hồ sơ/file; những API này tiếp tục kiểm tra quyền riêng.

## Phụ thuộc và việc chốt với Quang

- W1-Q4 audit nhận transaction đã có trong commit `3d5c5de`, merge `278b641`; dùng lại audit bắt buộc của AwardService.
- W1-P1 auth/API client/route có trong working tree và docs `FRONTEND_INTEGRATION_W1_P1.md`, merge `278b641`; UI dùng lại request/JWT/refresh.
- Đã rà biên bản W1-Q1, blueprint, tests/review tuần 1 và Git history. Không có hợp đồng notifications trước đó trong repository. Truy vấn danh sách PR remote qua GitHub API thất bại TLS; không xác nhận tình trạng PR mới ngoài lịch sử Git hiện có.
- **Chưa có xác nhận mới của Quang cho payload/audience này.** Bảng và payload trên là đề xuất cụ thể để Quang review, không phải biên bản đã ký/chốt.
- **Workflow thành tích chưa có** endpoint submit/verify/reject/correction/revoke, bảng lịch sử/snapshot hoặc producer trong mã hiện tại (W2-Q1 chỉ CRUD). Service đã hỗ trợ và kiểm thử bằng trạng thái synthetic trong DB, nhưng chưa nghiệm thu chuyển trạng thái thành tích end-to-end. Quang cần chốt payload/recipients, triển khai workflow theo blueprint và gọi service trong cùng transaction sau lịch sử/snapshot. Không coi synthetic này là workflow thật.
- AWARD đã tích hợp producer thật ở `AwardService.transition`, gồm status + history + notifications + audit cùng client. Đây là ghi nhận quyết định đã có, không tự trao thưởng. Không thay đổi AI/KPI.

## Tự kiểm tra

1. Review migration rồi chạy `npm --prefix backend run migrate` trong DB demo phù hợp (chưa áp dụng vào schema `app` dùng chung trong lần làm này).
2. Backend `npm --prefix backend run dev`, frontend `VITE_DATA_SOURCE=api` theo `.env.example`, `npm --prefix frontend run dev`; dùng tài khoản demo đã cấu hình riêng.
3. RecordsOfficer ghi nhận bản nháp có file quyết định; đăng nhập chủ giảng viên/đại diện hợp lệ. Chuông cập nhật khi mở, focus/làm mới hoặc sau tối đa 60 giây. `/notifications` hiển thị status mới, bộ lọc/trang/đánh dấu hoạt động.
4. Đăng nhập người khác, gọi PATCH ID vừa thấy: 404, GET không có item. Thu hồi đại diện/scope: thông báo liên quan biến mất.
5. `npm --prefix backend run test:w2-p3` và `npm --prefix backend run test:w2-p3:integration`: integration dùng dữ liệu synthetic trong schema ngẫu nhiên, transaction ngoài rollback toàn bộ; không seed hay migrate vào `app`, không lưu file thật.

UI không giả lập fixture chưa được chốt; chế độ fixture hiển thị thông báo cần dữ liệu API thật. UI build/lint đã kiểm tra; chưa kiểm tra tương tác trực quan bằng trình duyệt.
