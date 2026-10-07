# W4-P3 — Báo cáo kiểm tra và bàn giao

Ngày: 07/10/2026, Võ Nhạc Phước. Không commit/push/merge. Không sửa auth hoặc private storage. Không tìm thấy AGENTS.md ở workspace hoặc các thư mục cha đã kiểm tra.

## Kết quả thực tế

| Lệnh | Kết quả |
|---|---|
| Backend: `node --test tests/w4-p3.test.js tests/w3-p3.test.js tests/w2-p3.test.js tests/w2-p1.test.js` | PASS 16/16 |
| Backend: `npm run test:w4-p3` | PASS 3/3 |
| Backend: `npm run test:w3-p3` | PASS 6/6 |
| Backend: `npm run test:w2-p3` | PASS 2/2 |
| Backend: `npm run test:w2-p1` | PASS 5/5, hồi quy quản trị sau khi cho phép cấp scope COUNCIL |
| Frontend: `npm run build` | PASS; Vite cảnh báo bundle JS khoảng 574 kB, không phải lỗi build |
| Frontend: `node node_modules/eslint/bin/eslint.js src/pages/AwardApplications.jsx src/pages/Notifications.jsx src/routes/AppRoutes.jsx src/components/common/Sidebar.jsx --rule 'no-undef:error' --global window --global Event` | PASS |
| Root: `git diff --check` | PASS; Git có cảnh báo chuẩn hóa LF/CRLF |
| Backend: `npm run test:w4-p3:integration` | PASS 47 HTTP checks + PostgreSQL invariants, exit 0; schema tạm rollback thành công |

Unit tests kiểm tra role/scope/phân công/tự xét cá nhân và tập thể, strict body, sai version/status, rollback khi notification/audit lỗi và không ghi bảng quyết định/khen thưởng.

Lượt tích hợp cuối kết thúc lúc 20:08 ngày 07/10/2026 (Asia/Saigon), terminal: `PASS W4-P3: 47 real HTTP checks plus PostgreSQL invariants. Isolated schema rolled back.` Đã kiểm tra Admin cấp role/scope COUNCIL qua sáu POST thật; cá nhân kết luận RECOMMENDED sau vòng bổ sung, tập thể kết luận NOT_RECOMMENDED; Hội đồng bị 403 khi gọi tạo quyết định/AwardRecord; số AwardRecord giữ nguyên. Hai HTTP 500 có chủ đích từ trigger test notification/audit đã được xác nhận rollback version, comments và histories. Scope hết hiệu lực trả 403 và inbox không còn APPLICATION.

Integration dùng Express HTTP + JWT thật + driver pg + PostgreSQL đã cấu hình. Tạo schema tạm ngẫu nhiên, áp dụng toàn bộ migrations và seed trong transaction riêng, chuyển tên schema qua adapter, mỗi mutation dùng savepoint; cuối cùng rollback toàn schema và xóa file synthetic do test tạo. Không migrate hoặc seed schema app dùng chung. Kiểm tra cả luồng cá nhân và tập thể, bổ sung qua đơn vị, kết luận, inbox, mất scope, không tự trao thưởng và DB trigger gây lỗi để xác nhận atomic rollback.

Các lượt phát triển đã phát hiện timeout do chạy hai bộ migrations song song, thiếu fixture tập thể VERIFIED, mục tiêu chỉ áp dụng cá nhân, thiếu subjectType UNIT khi tạo fixture thành tích tập thể và lỗi dấu phân cách SQL trong đoạn test giả lập lỗi. Đã sửa fixture/test, chuyển sang chạy tuần tự; không coi các lượt lỗi này là nghiệm thu PASS. Lượt cuối cấp vai trò và scope COUNCIL qua API Admin thật thay vì chèn trực tiếp DB.

## File thay đổi

- `backend/package.json`: thêm lệnh test W4-P3.
- `backend/src/modules/admin/adminRepository.js`: cho Admin cấp scope COUNCIL bằng luồng quản trị hiện có; giữ các ràng buộc cấp quyền hiệu lực.
- `backend/src/modules/awards/applicationService.js`: workflow Council, phân công, ý kiến, bổ sung, quyền, history/notification trong transaction hiện có.
- `backend/src/modules/awards/applicationRoutes.js`: sáu endpoint mutation.
- `backend/src/modules/notifications/notificationService.js`: quyền đọc entity APPLICATION.
- `backend/tests/w4-p3.test.js`, `backend/tests/w4-p3.integration.js`: tests mới.
- `frontend/src/pages/AwardApplications.jsx`: hàng chờ đơn vị/Hội đồng, phân công, ý kiến, bổ sung, kết luận; cờ quyền từ backend.
- `frontend/src/pages/Notifications.jsx`: nhãn đề nghị/kết luận.
- `frontend/src/components/common/Sidebar.jsx`, `frontend/src/routes/AppRoutes.jsx`: truy cập Hội đồng và landing page phù hợp.
- `supabase/migrations/20261007000024_w4_p3_council.sql`: schema reviews/comments, trạng thái đề nghị và loại notification.
- `docs/api/COUNCIL_W4_P3.md`, `docs/api/W4_P3.openapi.json`: hợp đồng API và bước tự kiểm tra.
- `docs/weekly/WEEK_04_W4_P3.md`, tài liệu này: quyết định Supabase, kế hoạch và bàn giao.

## Phần còn lại và giới hạn

Không có phụ thuộc backend bị thiếu trong luồng đã dùng. Git local xác nhận W3-P3/W2-P3 và merge PR #2 W1-Q3 nằm trong HEAD; chưa kiểm tra trạng thái PR GitHub trực tuyến. Chưa áp dụng migration lên schema app dùng chung hoặc triển khai môi trường chạy chính. Chưa chạy browser UI/E2E thủ công và chưa kiểm tra cạnh tranh trên hai connection PostgreSQL độc lập; đã kiểm tra OCC bằng version cũ.

Bổ sung hiện là văn bản append-only; snapshot nguồn W3-P3 giữ nguyên. Đổi thành tích/file đầu vào cần đề nghị mới. Không tự nối sang AwardRecord; RecordsOfficer vẫn cần quyết định và file quyết định để ghi nhận theo W2-P2. Tự kiểm tra theo phần tương ứng của `docs/api/COUNCIL_W4_P3.md`.

Commit đề xuất: `feat(W4-P3): add scoped council assignments and recommendation workflow`.
