# W3-P2 — Võ Nhạc Phước — KPI nội bộ

## Plan và quyết định DB

Áp dụng ADR-001: Supabase PostgreSQL, schema `app`, driver `pg`, transaction và version BIGINT; thay phần SQL Server của kế hoạch cũ. Giữ auth Express và private storage. Không gọi KPI ngoài hoặc AI. Không sửa findings của người khác ngoài phạm vi task.

Đọc blueprint, hợp đồng W1-P3, review W1-P3, báo cáo/review W2-P4 và mã workflow W2-Q1/Q2/Q3. Không tìm thấy AGENTS.md trong workspace. Baseline `d834b6a`; W1-P3 có migration 09/10 và service, W2-P4 có commit `2e27770`. W2-P4 CHANGES_REQUIRED, tiêu chí LHU chưa xác nhận: chặn xét tiêu chí/VERIFIED/khen thưởng từ KPI; không chặn nhập mục tiêu và kết quả nội bộ. Không dùng ngưỡng mô phỏng làm căn cứ. PR công khai sẽ kiểm tra riêng; mã checkout là nguồn tích hợp hiện tại.

1. Migration KpiGoals/KpiResults và hợp đồng API riêng.
2. Quyền chính chủ giảng viên/đại diện còn hiệu lực; chấp nhận mục tiêu rõ ràng, version và trạng thái kiểm tra backend.
3. CSV preview/validate/dedup; commit kiểm tra lại trong transaction, không tin preview client.
4. UI API thật, nguồn MANUAL/CSV, tạo DRAFT bằng hành động riêng có loại thành tích do người dùng chọn.
5. Unit test và Express/pg/Supabase tích hợp trong schema cô lập, rollback; lint/build và tài liệu bàn giao.

## Thực hiện và file đổi

- `supabase/migrations/20261006000017_w3_p2_kpi.sql`: Goals/Results, FK, unique mã/chủ thể/kỳ, nguồn MANUAL/CSV, RLS và thu hồi Data API.
- `backend/src/modules/kpi/{kpiSchemas,kpiRepository,kpiService,kpiRoutes}.js`: CRUD, accept, quyền hiện hành trong DB, transaction/version/audit, CSV và tạo kê khai DRAFT có liên kết.
- `backend/src/app.js`, `backend/package.json`: mount API, script test riêng W3-P2.
- `frontend/src/pages/Kpi.jsx`, `frontend/src/services/kpiApi.js`, `frontend/src/routes/AppRoutes.jsx`, `frontend/src/components/common/Sidebar.jsx`: trang `/kpi`, form mục tiêu/kết quả, danh mục đơn vị/loại thành tích, CSV preview và hành động xác nhận import/tạo nháp. Chỉ gọi API thật; fixture chưa chốt bị chặn có thông báo.
- `backend/tests/w3-p2.test.js`, `backend/tests/w3-p2.integration.js`: validation/CSV, quyền, trạng thái, version, trùng kỳ, tập thể/cá nhân, nguồn, rollback, tạo DRAFT và kiểm không có award mới.
- `docs/api/KPI_W3_P2.md`, `docs/api/W3_P2.openapi.json`, `docs/api/templates/W3_P2_kpi.csv`, `scripts/update-w3-p2-contract.mjs`, nhật ký này: hợp đồng, template tải trực tiếp và bàn giao. Không sửa hợp đồng/API của người khác.

GitHub API công khai kiểm tra ngày 06/10/2026: chỉ PR #1/#2/#3, đều closed/merged, không có PR riêng W1-P3/W2-P4. PR #2 là chuyển DB Supabase; PR #3 W1-Q4. W1-P3/W2-P4 được đối chiếu hợp đồng/review và mã thực tế trong checkout, không tuyên bố đã có PR riêng được duyệt.

## Kiểm tra thực tế

| Lệnh | Kết quả |
|---|---|
| `npm --prefix backend run test:w3-p2` | 2/2 test PASS (payload strict, ngày thật 1990–2100, số hữu hạn, CSV quoted/multiline/header/giới hạn) |
| `npm --prefix backend run test:w3-p2:integration` | **86 assertions PASS**, Exit 0; `NODE_ENV=test`, `TZ=Asia/Ho_Chi_Minh`, Express/pg/Supabase thật, nguồn mô phỏng, kỳ kết thúc 01/01 đúng năm, date/BIGINT giữ chính xác; kiểm schema đã xóa sau rollback |
| `node --test backend/tests/w1-p3.test.js backend/tests/w2-p4.test.js backend/tests/w3-p1.test.js` | 12/12 PASS; W2-P4 REPRO scope bypass vẫn tồn tại trong dependency, không phải đã sửa |
| `npm --prefix frontend run lint` | Exit 0 |
| `npm --prefix frontend run build` | Exit 0, Vite build đạt |
| `node scripts/validate_contracts.mjs` | 68/68 PASS, hợp đồng cũ giữ nguyên |
| `node scripts/update-w3-p2-contract.mjs` | 9 paths / 13 operations, hợp đồng W3-P2 riêng |
| `git diff --check` | Exit 0, chỉ cảnh báo Git LF/CRLF |

Lệnh đầu `npm --prefix backend exec -- node --test ...` thất bại do npm cố tải package node và cache ngoài workspace EPERM; đã sửa dùng Node hiện có / npm run, không cài package mới. GitHub qua web/PowerShell không đọc được; Node fetch GitHub public API thành công, không dùng token.

Integration tạo schema tên ngẫu nhiên, rewrite migrations/seed vào schema đó, outer rollback và xác nhận schema không còn. Không seed/migrate `app` chung, không ghi dữ liệu thật/file/key/token vào Git. Test audit inject HTTP 500 là lỗi chủ động để chứng minh rollback, không phải lỗi triển khai. Harness dùng một pg client/savepoint, chạy tuần tự, chưa kiểm transaction song song.

## Tự kiểm tra và giới hạn

Hướng dẫn từng bước trong `docs/api/KPI_W3_P2.md`: áp migration 17 khi triển khai vào DB đích, chạy backend + Vite chế độ api, đăng nhập LECTURER/đại diện, mở `/kpi`; tạo/sửa nháp → chấp nhận → ghi kết quả → preview/commit CSV → chủ động tạo DRAFT → mở Thành tích để bổ sung file private/nộp duyệt. Thử owner khác, đại diện hết hạn, version cũ, trùng kỳ và CSV lỗi/trùng.

Chưa áp migration vào DB chung, chưa chạy smoke test bằng trình duyệt/ảnh UI; frontend đã lint/build và API đã tích hợp thật. Minh chứng KPI lưu mô tả/tham chiếu do người dùng nhập; upload file dùng lại private evidence workflow trên kê khai DRAFT, không coi ghi chú là file đã xác thực. CSV cá nhân; tập thể nhập CRUD thủ công. Không có integration KPI ngoài hoặc AI. Không có tiêu chí LHU đã xác nhận: chặn xét thưởng/AI; W2-P4 còn findings workflow/file, KPI không tự VERIFIED/khen thưởng và không tuyên bố nghiệm thu toàn bộ workflow phụ thuộc.

Đề xuất commit: `feat(W3-P2): add internal KPI goals/results, CSV import and explicit draft declarations`. Chưa commit/push/merge.
