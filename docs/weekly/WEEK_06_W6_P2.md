# W6-P2 — Tổng duyệt theo vai trò và kiểm tra tài liệu

Võ Nhạc Phước · 09/10/2026 (Asia/Saigon) · baseline `16ee566`.

## Triển khai

Plan dùng Supabase PostgreSQL qua pg theo ADR-001 thay SQL Server, giữ Express auth và private storage. Đọc blueprint, hợp đồng/mã vai trò, W6-P1/W5-P3 và bàn giao W6-Q1/Q2. Không tìm thấy AGENTS.md trong repo/thư mục cha. Các commit phụ thuộc có trong HEAD; chat không có artifact PR, truy vấn refs remote thất bại SEC_E_NO_CREDENTIALS, chưa xác minh PR trực tuyến.

Hoàn thiện USER_GUIDE theo màn hình/nút hiện tại; bổ sung luồng đề nghị cá nhân/tập thể → Manager → Hội đồng → kết luận, RecordsOfficer nhập quyết định/file/ghi nhận; tách rõ VERIFIED/RECOMMENDED/RECORDED. DEMO_SCRIPT dành 20–25 phút để đi đủ vai trò, có bản rút gọn dùng hồ sơ đã chuẩn bị. Checklist giữ ô ký nghiệm thu người xem riêng, không tự đánh dấu từ test tự động.

Thêm hook `W6_P2_UI=1` tùy chọn vào runner W5-P3; tạo Hội đồng qua Admin API chỉ trong schema test riêng, đăng nhập sáu tài khoản bằng browser, mở trang/quản trị/hàng chờ đúng scope và minh họa Lecturer UI /404 + API 403. Dùng Vite proxy → Express → Supabase thật, Edge headless. Tài khoản Hội đồng kiểm thử không được lưu trên app dùng chung; vận hành chuẩn bị tài khoản buổi diễn theo checklist. Không đổi API/payload, auth, schema sản phẩm hoặc quyền/trạng thái backend. Không thêm endpoint; tài liệu API W2-P2/W3-P3/W4-P3/W6-P1 hiện có vẫn là hợp đồng.

## Review Quang

W6-Q1/Q2 regression PASS chỉ chứng minh các kiểm tra script/cấu trúc tương ứng. Nguồn migration thực thi/backup là 25 file supabase/migrations, không phải legacy 001–009. W2-Q3 Supabase đã chứa verified_by nhưng restore rewrite không thay literal `table_schema = 'app'` trong DO block. Có thể kiểm nhầm schema nguồn và bỏ ADD COLUMN ở schema đích; cần đối chiếu restore thật, không coi migration 009 legacy đã giải quyết.

DEMO_VERSION_CONFIG ghi Vite 5/Node >=18 trái package Vite 6 và README Node 20.19+/22.12+; giữ artefact Quang, ghi khác biệt để người vận hành dùng lockfile/migration status thực tế. Ngày 28/10 trong config không chứng minh nghiệp vụ chọn quy định đã được test. README và guide dùng kiến trúc/tài khoản/hợp đồng cuối. Không dùng kết luận 100% cũ trong runbook để thay bằng chứng W6-Q2 còn NOT_RUN.

## Lệnh và kết quả thực tế

| Lệnh | Kết quả |
|---|---|
| `node backend/tests/w4-p3.integration.js` | PASS 47 HTTP checks + DB invariants, cá nhân/tập thể/Hội đồng, outer rollback |
| `node backend/tests/w2-q4.integration.js` (chạy lại tuần tự) | PASS 68 assertions: thành tích, tập thể, quyền, private file, RecordsOfficer, lịch sử/rollback |
| `node --test backend/tests/w6-q2.test.js backend/tests/w6-q1.test.js` | PASS 73/73, 10 suites |
| `npm --prefix frontend run build` | PASS; còn cảnh báo chunk >500 kB |
| `npm --prefix frontend run lint` | PASS |
| `node --check scripts/w6-p2-ui.mjs` | PASS |
| `W6_P2_UI=1; node backend/tests/w5-p3.integration.js` (lượt cuối chờ danh sách tải xong) | PASS exit 0; 25 migrations + seed, 5 login API và 6 login browser, scoped queues 200, Lecturer admin API 403/UI 404; INSTALL_PASS_RESTORE_NOT_RUN cho lượt không cấp backup |
| `W6_P2_UI=1; W5_P3_BACKUP_DIR=backups/w5p3_http; node backend/tests/w5-p3.integration.js` | 25 migrations + seed/5 login + six-role browser smoke PASS; restore FAIL 42703, exit 1; schema test dọn trong finally |

**Blocker restore xác nhận mới:** gói backup cục bộ hiện có vẫn lỗi `column "verified_by" of relation "achievements" does not exist` tại Data DML. DDL chứa migration W2-Q3 bổ sung cột có điều kiện `table_schema='app'`; restore chỉ rewrite tham chiếu `app.`/SCHEMA nên literal vẫn kiểm app nguồn, có thể bỏ ADD COLUMN tại schema đích. Cần Quang đối soát/rewrite DDL đúng ngữ nghĩa schema hoặc cấp gói dump DDL tương thích; không chỉ thêm migration legacy 009. Không thay/loại cột dữ liệu để lấy PASS. Log `output/w6-p2/rehearsal-restore.log`; report `output/w5-p3/42abea7712da/result.json`. HTTP restored hash/quyền và browser sau restore **NOT_RUN**, bị chặn trực tiếp bởi lỗi này. Kết quả không phủ định containment/fail-hard đã sửa, nhưng chưa thể đóng gate restore.

Browser cuối: `output/w6-p2/ui-loaded-final.log`, `output/w6-p2/ui/result.json` status PASS/errors rỗng và 6 ảnh tài khoản; install report `output/w5-p3/e082523ee297/result.json` với startedAt `2026-10-09T12:56:02.729Z`. Không coi INSTALL_PASS_RESTORE_NOT_RUN của lượt cuối là restore PASS; lỗi restore ở lượt cấp backup phía trên vẫn còn.

Lượt W2-Q4 đầu lỗi 57014 khi chạy chồng với W4-P3; chạy lại tuần tự PASS. 500 notification failure trong runner là lỗi được chủ động chèn để kiểm rollback. Các lượt UI đầu lỗi EPERM runtime, TypeError trong harness (fetch.ok là property) và timeout do chờ option dropdown hiển thị thay vì attached; đã sửa harness, không nới auth/CORS sản phẩm. Log/ảnh giữ dưới `output/w6-p2/` (Git ignore). Runner W2-Q4 ghi lại report cũ; đã khôi phục file đó, không đưa thay đổi task khác vào bàn giao.

## Tự kiểm và gate còn mở

Làm README, mở [USER_GUIDE](../USER_GUIDE.md), thực hiện từng hàng [checklist](../testing/w6-p2/REHEARSAL_CHECKLIST.md) và ghi người kiểm/mã hồ sơ/status/lịch sử. Chạy integration DB **tuần tự**. Để chạy lại browser trên schema riêng:

```powershell
$env:W6_P2_UI='1'
$env:W6_PLAYWRIGHT_PATH='<đường dẫn module Playwright đã cài>'
node backend/tests/w5-p3.integration.js
Remove-Item Env:W6_P2_UI,Env:W6_PLAYWRIGHT_PATH
```

Cần dependencies backend/frontend, cấu hình Supabase server-only có quyền schema test, Edge và Playwright. Browser smoke chỉ kiểm login/navigation/hàng chờ, không thay người xem tự làm trọn workflow. API integration dùng token do server sinh trong test; riêng browser/W5-P3 đăng nhập mật khẩu thật. Dữ liệu tổng hợp không chứng minh dữ liệu LHU vận hành.

Restore: đặt `W5_P3_BACKUP_DIR` đến gói đã chọn rồi chạy W5-P3 runner; chỉ PASS khi restore và HTTP hash/size/401/ngoài scope PASS, không bỏ qua file/outsider thiếu. Chưa có nghiệm thu máy thứ hai, browser toàn bộ workflow sau restore, file quyết định sau restore, provider AI live/quota hoặc p95 dashboard <2s. Không tự cấp quyền vào DB dùng chung, tự xác nhận nguồn hoặc trao thưởng.

## File bàn giao

- README.md, docs/USER_GUIDE.md, docs/DEMO_SCRIPT.md: hướng dẫn cuối và link tổng duyệt.
- docs/testing/w6-p2/REHEARSAL_CHECKLIST.md: chuẩn bị máy/tài khoản/mã, ca đúng/sai quyền và review restore.
- scripts/w6-p2-ui.mjs, backend/tests/w5-p3.integration.js: hook browser sáu vai trò trên schema riêng.
- docs/weekly/WEEK_06_W6_P2.md: kết quả, giới hạn, tự kiểm.

Chưa commit/push/merge. Đề xuất: `docs(W6-P2): finalize role rehearsal checklist and user guide with integrated browser smoke`.
