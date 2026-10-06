# W3-P3 — Kết quả kiểm tra và bàn giao

Ngày thực hiện: **06/10/2026 (Asia/Saigon)**. Người phụ trách: Võ Nhạc Phước.

## Kết quả thực tế

| Lệnh đã chạy | Kết quả |
|---|---|
| `node --test backend/tests/w3-p3.test.js backend/tests/w2-p2.test.js` | **10/10 PASS**, exit 0 (bản cuối: 6 W3-P3 + 4 W2-P2) |
| `node --test backend/tests/w3-p3.test.js backend/tests/w2-p2.test.js backend/tests/w3-q1.test.js` | **14/14 PASS** tại thời điểm W3-P3 có 4 test; W3-Q1 6/6. Có log AUDIT_LOG_ERROR FK user của test Replace W3-Q1 hiện hữu; suite vẫn exit 0. Không sửa test/module của người khác để che cảnh báo này. |
| `npm --prefix backend run test:w3-p3:integration` | **68 real HTTP/PostgreSQL assertions PASS**, exit 0; chạy lại sau khi thêm kiểm tra file private tồn tại; schema tạm rollback, file synthetic được dọn |
| `npm --prefix frontend run build` | **PASS**, exit 0; 1681 modules; Vite cảnh báo chunk JS ~509.46 kB (>500 kB), không lỗi build |
| Từ `frontend`: `.\node_modules\.bin\eslint.cmd src/pages/AwardApplications.jsx src/pages/Awards.jsx src/services/applicationsApi.js src/routes/AppRoutes.jsx src/components/common/Sidebar.jsx` | **PASS**, exit 0 |
| `node scripts/update-w3-p3-contract.mjs` | **PASS**, sinh OpenAPI 3.0.3: 5 paths / 7 operations |
| `node --check backend/src/modules/awards/applicationService.js` và `node --check backend/tests/w3-p3.integration.js` | **PASS** |
| `git diff --check` | **PASS**, chỉ có thông báo LF→CRLF theo cấu hình Git |

Lần gọi ESLint đầu từ root không tìm thấy eslint.config.js; đã chạy lại từ thư mục frontend với cấu hình hiện hữu và PASS. Prettier chỉ format các file mới; không thay đổi định dạng hàng loạt mã của người khác.

## Điều đã xác minh tích hợp thật

- Migration 019 chạy được cùng toàn bộ migrations hiện có trên Supabase PostgreSQL/pg; chỉ schema tạm, không tác động schema app dùng chung.
- Auth Express và roles DB thật: Lecturer không tạo AwardRecord/Cycle, không nộp cho người khác, không tự chuyển Hội đồng. API chặn client inject status/decision.
- Có mục tiêu, kỳ, purpose; thiếu VERIFIED input trả 400. Nguồn DRAFT/REVOKED không được nộp; version cũ trả 409.
- Thực hiện create achievement → upload private evidence → submit revision 1 → verify bằng W3-Q1/W2-Q3 thật; AwardRecord RECORDED bằng W2-P2 thật. Snapshot có revision, phiên bản/file hash, trạng thái/version nguồn.
- Nộp đề nghị không tăng số AwardRecord. Manager đúng scope xem và chuyển hồ sơ tới COUNCIL_PENDING với ý kiến; ngoài scope bị 403.
- Thu hồi achievement và award sau khi nộp: snapshot trước/sau deepEqual. UPDATE snapshot bị trigger chặn.
- Bản thay thế cùng chủ thể liên kết tới record REVOKED, ghi nhận thành công; khác chủ thể bị 400. History cũ giữ 3 mốc; file cũ giữ metadata và tải nguyên bytes được sau thu hồi/thay thế. Scope hết hạn chặn đọc/download.
- Unit bổ sung: thiếu file vật lý báo rõ, snapshot không lộ storage_key, UnitRepresentative cần scope hiệu lực, Manager không tự chuyển, lỗi audit rollback.

OCC test kiểm tra version cũ và trạng thái trùng; chưa thử nhiều connection cạnh tranh thật. Integration dùng một pg client và savepoint dưới outer transaction để rollback sạch. UI đã build/lint, chưa thao tác kiểm tra trình duyệt bằng tài khoản người dùng.

## File thay đổi

**Backend**:

- `backend/package.json`: thêm hai lệnh test W3-P3.
- `backend/src/app.js`: mount application routes.
- `backend/src/modules/awards/awardService.js`: transaction audit nhận thêm application/cycle id, giữ auth/file/workflow hiện hữu.
- `backend/src/modules/awards/applicationService.js`: cycles, ownership/scope, draft, frozen input, submit/forward/history.
- `backend/src/modules/awards/applicationRoutes.js`: 7 API operations.
- `backend/tests/w3-p3.test.js`: 6 unit tests.
- `backend/tests/w3-p3.integration.js`: real Express/Supabase, dùng lại harness kiểm thử W2-P2 và bổ sung W3-P3.

**Frontend**:

- `frontend/src/pages/AwardApplications.jsx`: tạo/nộp đề nghị, kỳ, đơn vị chuyển Hội đồng, history/snapshot.
- `frontend/src/services/applicationsApi.js`: API thật.
- `frontend/src/pages/Awards.jsx`: chuẩn bị replacement từ REVOKED.
- `frontend/src/routes/AppRoutes.jsx`, `frontend/src/components/common/Sidebar.jsx`: route và menu theo role.

**Migration/tài liệu**:

- `supabase/migrations/20261006000019_w3_p3_award_applications.sql`.
- `scripts/update-w3-p3-contract.mjs`, `docs/api/W3_P3.openapi.json`.
- `docs/api/AWARD_APPLICATIONS_W3_P3.md`: hợp đồng/quyền/giới hạn và 6 bước tự kiểm tra.
- `docs/weekly/WEEK_03_W3_P3.md`: plan Supabase thay DB cũ và bàn giao.
- `docs/testing/week-3/W3_P3_TEST_REPORT.md`: báo cáo này.

## Phần còn lại

Không bị chặn bởi mã W2-P2/W3-Q1; cả hai đã tích hợp và được gọi trong test thật. PR trực tuyến chưa xác minh vì không có gh. Migration chưa áp vào schema app dùng chung/môi trường triển khai; không seed dữ liệu thật. Cần người phụ trách chọn môi trường triển khai, chạy migrate theo quy trình backup, rồi tự kiểm tra UI theo tài liệu API.

Hội đồng xét duyệt/ban hành kết quả, chỉnh sửa/gửi lại application, notification application, combobox và phân trang UI là phần mở rộng chưa làm. Hội đồng hiện chỉ có mốc COUNCIL_PENDING; không có AI xét thưởng và không có tự tạo AwardRecord.

Đề xuất commit: `feat(W3-P3): add award applications, frozen inputs and replacement UI`. **Chưa commit/push/merge**.
