# W6-P1 — Sửa giao diện/báo cáo/KPI cuối

Võ Nhạc Phước · 09/10/2026 (Asia/Saigon). Baseline `afd2377`.

## Phạm vi và phụ thuộc

Không tìm thấy AGENTS.md trong repository hoặc các thư mục cha đã kiểm. Đã đọc blueprint, W5-P4, W5-Q4, W6-Q1/Q2, mã báo cáo/KPI và hợp đồng W3-P1/P2, W4-P2. Kế hoạch áp dụng ADR-001: Supabase PostgreSQL qua pg thay DB SQL Server cũ; giữ Express auth và private storage. Tái dùng API, RBAC, CSV, connector và harness rollback đã hoàn thành.

W5-P4 `b0a1548`, W5-Q4 `d3986f0` có trong lịch sử Git; W6-Q1 `1638173` đã sửa các P1 restore được nêu ở W5-Q4. Không tự ghi nhận restore thật đã PASS: W6-Q2 vẫn ghi phần đó chưa nghiệm thu. `git ls-remote origin 'refs/pull/*/head'` exit 1 (`SEC_E_NO_CREDENTIALS`), nên chưa xác minh PR remote.

## Final fixes

- KPI 0% không còn vẽ thành 5%. Giữ phần trăm thực trên nhãn khi vượt mục tiêu; giới hạn chiều rộng thanh trong 0–100%, bổ sung progressbar cho trình đọc màn hình.
- Preview CSV dùng đúng READY_GOAL/READY_RESULT/IMPORTED (xanh), DUPLICATE (trung tính), INVALID (đỏ); không đổi quyết định import của backend.
- Tải mẫu CSV đi qua cơ chế lỗi/busy của trang, hiển thị lỗi thay vì promise bị bỏ mặc; trì hoãn revoke URL để trình duyệt nhận download.
- Bảng báo cáo có chiều rộng tối thiểu 760px trong khung cuộn ngang sẵn có, tránh ép tiêu đề thành các cột rất hẹp trên điện thoại.
- Sửa lỗi tiếp tục kê khai từ KPI: giảng viên mở hồ sơ DRAFT nhưng màn hình gọi `/admin/achievement-types` và nhận 403. Thêm GET `/achievements/catalogs` qua controller/service/repository, chỉ đọc danh mục đang hoạt động sau kiểm tra vai trò hiện hành từ DB. Frontend dùng endpoint mới; không mở quyền ghi/quản trị.
- Giữ Express auth, quyền ghi, trạng thái, quy tắc AI và schema chung. Nguồn KPI ngoài tiếp tục ghi MÔ PHỎNG; tạo kê khai vẫn chỉ tạo DRAFT. Hợp đồng endpoint bổ sung ở `docs/api/W6_P1_FINAL_FIXES.md`.

## Kiểm chứng

| Lệnh | Kết quả thực tế |
|---|---|
| `npm --prefix backend run test:w6-p1` | 21/21 PASS; gồm hồi quy báo cáo/KPI/connector và danh mục fail closed khi DB lỗi/quyền bị thu hồi |
| `node backend/tests/w3-p1.integration.js` | Lượt ban đầu 126 assertions PASS; lượt cuối kèm W6_UI=1 đạt 133 assertions PASS (thêm danh mục/quyền/loại ngừng hoạt động), exit 0 |
| `node backend/tests/w3-p2.integration.js` | 96 assertions PASS; CSV, trùng/xung đột, quyền, DRAFT, rollback audit lỗi; 500 được chủ động chèn là ca kiểm thử |
| `node backend/tests/w4-p2.integration.js` | 67 assertions PASS khi chạy lại tuần tự; nguồn HTTP là mock có nhãn, Express/pg/Supabase thật |
| `npm --prefix frontend run build` | PASS; cảnh báo bundle trên 500 kB còn tồn tại |
| `npm --prefix frontend run lint` | PASS |
| `$env:W6_UI='1'; $env:W6_PLAYWRIGHT_PATH='<module Playwright local>'; node backend/tests/w3-p1.integration.js` | PASS, exit 0; đăng nhập/refresh thật, CSV báo cáo, progress 0%, template/preview, nguồn mô phỏng có nhãn, DRAFT → Thành tích → danh mục 200; không pageerror/dialog alert mẫu; 390/768/1440px không tràn ngang |

Log cục bộ: `output/w6-p1/{unit,reports-integration,kpi-integration,connector-integration,ui-e2e,build,lint}.log`. Bộ ảnh: `output/w6-p1/ui/{reports,kpi}-{390,768,1440}.png`, kết quả máy đọc `result.json`. Output giữ Git ignore.

Browser dùng Edge headless, gọi Vite proxy → Express → Supabase schema riêng; đăng nhập/refresh thật. Dữ liệu tổng hợp có nhãn SYNTHETIC/MÔ PHỎNG, không là dữ liệu vận hành LHU. Chỉ phản hồi lỗi template 503 được chèn ở browser; tất cả luồng thành công gọi API/DB thật. Harness dùng savepoint và tuần tự hóa transaction để không commit schema kiểm thử khi auth/KPI mở transaction riêng; outer rollback và truy vấn kiểm tra schema đã biến mất đều hoàn tất ở lượt cuối. Đây chưa chứng minh transaction song song.

Các lượt E2E đầu thất bại do quyền truy cập runtime, đường dẫn plugin React, CORS/Tailwind của harness, cạnh tranh savepoint và độ trễ DB. Đã sửa harness; không nới CORS/auth của sản phẩm. Connector integration riêng từng timeout SQLSTATE 57014 khi chạy đồng thời migrations với runner khác; chạy lại tuần tự PASS 67 assertions, log lỗi đầu giữ tại `connector-first-fail.log`.

## File đổi và tự kiểm

- `frontend/src/pages/Kpi.jsx`, `frontend/src/pages/Reports.jsx`: final fixes.
- `frontend/src/services/achievementsApi.js`, bốn file `backend/src/modules/achievements/achievement{Routes,Controller,Service,Repository}.js`: sửa danh mục cho luồng nguồn KPI.
- `backend/tests/w3-p1.integration.js`, `backend/tests/w6-p1.test.js`, `backend/package.json`, `scripts/w6-p1-ui.mjs`: E2E cô lập, hồi quy quyền danh mục và ảnh cuối, tái sử dụng dữ liệu báo cáo hiện có.
- `docs/api/KPI_W3_P2.md`, `docs/api/W6_P1_FINAL_FIXES.md`, `docs/api/W6_P1.openapi.json`, báo cáo này và kết quả `docs/testing/w6-p1/`: bàn giao.

Chạy integration DB tuần tự. Muốn chụp lại ảnh, đặt `W6_UI=1`, `W6_UI_ONLY=1`, `W6_PLAYWRIGHT_PATH` trỏ module Playwright đã có rồi chạy `node backend/tests/w3-p1.integration.js`; cần Edge, dependencies frontend/backend và cấu hình Supabase local có quyền tạo schema. Không đưa .env/token vào Git. Bỏ W6_UI_ONLY để chạy lại cả 133 assertions.

Tự kiểm UI với `VITE_DATA_SOURCE=api`: mở `/reports`, lọc và xuất CSV; đối chiếu các nhóm VERIFIED/RECORDED với summary. Ở `/kpi`, ghi actual=0 cho mục tiêu đã chấp nhận, kiểm tra 0%; preview CSV hợp lệ/trùng/lỗi; tải template; mở nguồn ngoài và thấy MÔ PHỎNG. Tạo DRAFT từ kết quả và theo link sang `/achievements`, không coi đó là xác nhận hay trao thưởng. Kiểm tra ở 390/768/1440px, bảng cuộn trong khung.

Chưa nghiệm thu dữ liệu vận hành LHU hoặc ảnh sau restore thật; phụ thuộc bản restore được W6-Q2 kiểm chứng, không giải quyết bằng fixture. AI provider live và restore/file không thuộc sửa UI W6-P1. Các alert demo còn ở ProfilePortfolio là module khác, không được coi đã sửa toàn hệ thống.

Chưa commit/push/merge. Commit đề xuất: `fix(W6-P1): finalize report and KPI UI with authorized catalog reads`.
