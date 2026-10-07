# W4-P2 — Kết quả kiểm tra thực tế 07/10/2026

| Lệnh | Kết quả |
|---|---|
| `npm --prefix backend run test:w4-p2` | PASS 3/3 tests; contract strict, service auth qua HTTP thật, timeout/retry/503/401/invalid contract |
| `npm --prefix backend run test:w4-p2:integration` | PASS 43 assertions; mock HTTP + Express HTTP + pg/Supabase thật |
| `npm --prefix backend run test:w3-p2` | PASS 2/2 tests hồi quy validators/CSV |
| `node scripts/validate_contracts.mjs` | PASS 68/68 kiểm tra tĩnh hợp đồng hiện có; không thay cho integration W4-P2 |
| `npm --prefix frontend run build` | PASS; cảnh báo chunk JS >500 kB |
| `git diff --check` | PASS; chỉ có cảnh báo Git LF/CRLF |

Integration áp toàn bộ migrations và seed trong schema ngẫu nhiên `w4p2_test_*`, outer transaction/savepoints; finally rollback và kiểm tra schema không còn. Không áp migration lên schema app dùng chung. Test không ghi token/key thật vào repository. Token mock trong test là dữ liệu tổng hợp.

Các trường hợp đã chạy: chưa đăng nhập 401, lecturer không có quyền mapping/pull 403 dù JWT khai ADMIN; mapping trùng 409; unknown employee quarantine; retry không tăng số source records; chính chủ chỉ thấy nguồn mình, không thấy logs toàn hệ thống; người khác tạo nháp 403; stale version và tạo nháp lặp 409; revision 2 tạo DRAFT mới, so sánh toàn bộ hàng VERIFIED trước/sau không đổi; cùng version khác nội dung ghi VERSION_CONFLICT và giữ payload cũ; thêm mapping giải quarantine qua retry; nguồn DRAFT không tạo được nháp; award_records vẫn bằng 0; thu hồi ADMIN chặn pull; thiếu cấu hình service tạo FAILED và persist mã lỗi an toàn.

Chưa chạy UI bằng trình duyệt; build không chứng minh tương tác/hình thức hiển thị. Chưa kiểm thử tải song song; harness một kết nối tuần tự. Chưa tích hợp hệ thống ngoài thật. Tra PR qua GitHub REST đã thử nhưng kết nối SSL thất bại; review APPROVED và mã phụ thuộc được xác nhận trong checkout, không khẳng định trạng thái PR remote.

## Danh sách file thay đổi

- `backend/package.json`: scripts mock và test.
- `backend/src/mock/kpiServer.js`: server mô phỏng loopback/service auth.
- `backend/src/modules/kpi/externalContract.js`: hợp đồng nguồn/fixture có nhãn.
- `backend/src/modules/kpi/externalConnector.js`: HTTP auth/timeout/retry/response bound.
- `backend/src/modules/kpi/externalService.js`: scope/mapping/runs/revisions/quarantine/drafts/audit.
- `backend/src/modules/kpi/kpiRoutes.js`: endpoints Express mới.
- `backend/tests/w4-p2.test.js`: contract/HTTP tests.
- `backend/tests/w4-p2.integration.js`: integration thật, schema rollback.
- `supabase/migrations/20261007000023_w4_p2_external_kpi.sql`: staging và log tables/RLS/revoke.
- `frontend/src/components/ExternalKpi.jsx`: UI runs/retry/mapping/nháp.
- `frontend/src/components/common/Sidebar.jsx`: cho ADMIN mở trang KPI quản lý connector.
- `frontend/src/pages/Kpi.jsx`: gắn UI nguồn mô phỏng.
- `frontend/src/services/kpiApi.js`: client API mới.
- `docs/api/EXTERNAL_KPI_W4_P2.md`: API, DB plan, phụ thuộc và hướng dẫn tự kiểm tra.
- `docs/api/W4_P2.openapi.json`: hợp đồng máy đọc bổ sung.
- `docs/weekly/WEEK_04_W4_P2.md`: bàn giao/kế hoạch.
- `docs/testing/W4_P2_TEST_REPORT.md`: báo cáo này.

Chưa commit/push/merge. Đề xuất: `feat(W4-P2): add simulated KPI HTTP connector, revision staging and sync logs`.
