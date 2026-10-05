# Bàn giao W2-P3 — Võ Nhạc Phước

Ngày: 05/10/2026. Trạng thái: API/UI và tích hợp transaction AWARD hoàn thành; nghiệm thu workflow ACHIEVEMENT và xác nhận payload với Quang còn chờ.

## Kế hoạch và quyết định

1. Rà hướng dẫn: không tìm thấy `AGENTS.md` ở workspace (kể cả hidden) hoặc các thư mục cha đã kiểm tra. Dùng yêu cầu task và blueprint `docs/PROJECT_DEVELOPMENT_BLUEPRINT.md`.
2. Dùng quyết định Supabase PostgreSQL qua `pg` thay DB SQL Server của plan cũ. Migration chỉ ở `supabase/migrations`; không thay auth Express/file private.
3. Dùng lại W1-Q4 audit/client transaction, W1-P1 request/auth/route và W2-P2 status/history/version. Git working tree ban đầu sạch. Không commit/push/merge.
4. Bổ sung schema, service event, list/read API, chuông, trang notifications; kiểm tra quyền hiện tại và payload tối thiểu. Fixture notifications chưa chốt nên không tự tạo dữ liệu UI giả.
5. Kiểm tra DB thật trong schema tạm có outer ROLLBACK; bàn giao hợp đồng cụ thể cho Quang. Không áp migration 015 vào `app` dùng chung.

## File thay đổi

| Nhóm | File |
|---|---|
| DB | `supabase/migrations/20261005000015_w2_p3_notifications.sql` |
| Service/API | `backend/src/modules/notifications/notificationService.js`, `notificationRoutes.js`, `backend/src/app.js` |
| Producer thật | `backend/src/modules/awards/awardService.js` |
| Test/lệnh | `backend/tests/w2-p3.test.js`, `backend/tests/w2-p3.integration.js`, `backend/package.json` |
| UI | `frontend/src/components/common/NotificationBell.jsx`, `Sidebar.jsx`, `frontend/src/pages/Notifications.jsx`, `frontend/src/routes/AppRoutes.jsx` |
| API client/hook | `frontend/src/services/notificationsApi.js`, `frontend/src/hooks/useNotifications.js` |
| Hợp đồng | `docs/api/W2_P3.openapi.json`, `docs/api/openapi.json`, `docs/api/openapi.yaml`, `docs/api/NOTIFICATIONS_W2_P3.md` |
| Bàn giao | `docs/weekly/WEEK_02_W2_P3.md` |

## Lệnh và kết quả thực tế

- `node --test backend/tests/w2-p3.test.js`: 2/2 pass. Payload strict, transaction bắt buộc; notification failure rollback cả status/history, không COMMIT.
- `npm --prefix backend run test:w2-p3:integration` (NODE_ENV=test): **20 HTTP assertions pass** lần cuối, cùng các assertions DB (lần đầu 19 trước khi bổ sung kiểm tra includeDescendants). Producer AWARD thật; rollback sau INSERT khi audit lỗi; DB INSERT lỗi rollback status; idempotency event/read; cá nhân/tập thể; không đọc/mark của người khác; revoke đại diện/Manager scope; includeDescendants; anon/authenticated không có quyền SELECT; phân trang/unread/400/401. ACHIEVEMENT dùng persisted synthetic state, chưa phải producer workflow thật.
- `node backend/tests/w2-p2.integration.js`: 27 kiểm tra HTTP/PostgreSQL pass; regression module khen thưởng sau tích hợp notification.
- `node --test backend/tests/w2-p3.test.js backend/tests/w2-p2.test.js backend/tests/w2-q1.test.js backend/tests/w2-q2.test.js backend/tests/audit.test.js`: 21/21 pass, 0 skipped. Các suite cũ audit/evidence có sử dụng DB cấu hình hiện tại; chỉ integration W2-P3/W2-P2 đảm bảo schema riêng rollback toàn bộ.
- `npm --prefix backend test`: 31/31 pass auth/scope hiện có, dùng DB cấu hình hiện tại.
- `npm --prefix frontend run lint`: pass, 0 lỗi.
- `npm --prefix frontend run build`: pass, Vite 6.4.3, 1673 modules.
- `node scripts/validate_contracts.mjs`: 68/68 pass. Đây là static validator cũ, không chứng minh producer achievement workflow tồn tại.
- `git diff --check`: pass (chỉ cảnh báo chuyển LF/CRLF).

UI chưa kiểm thử tương tác bằng browser. Kịch bản tự kiểm tra, API đầy đủ, payload/audience và phần Quang cần tích hợp: xem `docs/api/NOTIFICATIONS_W2_P3.md`.

Không có PR notifications/hợp đồng mới trong mã Git đã kiểm tra. GitHub API remote lookup lỗi TLS nên chưa xác minh danh sách PR mới. Không tuyên bố Quang đã xác nhận hợp đồng; chưa có kênh trao đổi/xác nhận mới trong phiên này.

Commit đề xuất: `feat(notifications): [W2-P3] add private inbox and transactional status events`.
