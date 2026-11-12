# W5-P1 — Võ Nhạc Phước — 08/10/2026

Triển khai trên React/Vite/Tailwind, Express `/api/v1`, Supabase PostgreSQL qua `pg` theo ADR-001 trong blueprint. Express auth và kho file private giữ nguyên. Không tìm thấy AGENTS.md trong workspace và các thư mục cha đã kiểm tra.

Phụ thuộc đã có trong lịch sử: W4-P4 `82dfd48`, W4-Q4 `fa7aa5c`; tái sử dụng hợp đồng report/CSV W3-P1, workflow/security W2-Q4 và hồi quy W4. Không bị chặn bởi thiếu mã W4-P4/Q4. Không chạy test W4-Q4 sửa role trên tài khoản seed chung; dùng E2E schema cô lập để giữ dữ liệu người khác.

## Triển khai

- `supabase/w5-p1-seed.sql`: chính xác 100 giảng viên, 10 đơn vị, 5.000 thành tích, 7 năm 2020–2026, 4.000 cá nhân/1.000 tập thể, nhiều trạng thái; toàn bộ giả lập, email `example.invalid`, mật khẩu không đăng nhập được. Không KPI/AI/trao thưởng. Chỉ dùng trong schema kiểm thử do runner tạo; không chạy SQL này trực tiếp trên `app`.
- `backend/tests/w5-p1.integration.js`: migrate + seed schema ngẫu nhiên, commit để 10 kết nối DB độc lập thấy cùng dữ liệu, Express thật qua loopback; kiểm tra quyền từ DB dù JWT khai ADMIN, các vai trò, empty/validation, dashboard/report/CSV, ID qua mọi trang, CSV tiếng Việt/quote/newline/formula. Dọn schema cuối lượt. `W5_P1_MODE=load` chỉ đo tải; `reconcile` chỉ đối soát; mặc định chạy cả hai.
- `backend/tests/w5-p1-query-plan.js`: EXPLAIN ANALYZE BUFFERS JSON trước/sau index thử nghiệm, rollback index thử nghiệm. Chỉ nhận tên schema W5-P1 hợp lệ.
- `achievementRepository.js`: khóa phụ ID để phân trang ổn định khi timestamp bằng nhau; count và lấy trang chạy song song, giữ bộ lọc quyền/trạng thái. Hai query vẫn không phải cùng snapshot khi có ghi đồng thời (giới hạn sẵn có, chưa giải quyết trong task).
- Migration 025 thêm index `(updated_at DESC, achievement_id DESC)` cho thứ tự mặc định. Áp dụng vào schema test; chưa áp dụng migration lên `app` dùng chung.
- `scripts/w5-p1-ui.cjs`: loading/error/retry/empty và responsive 390/768/1440 px; phản hồi mô phỏng rõ ràng, không tính là E2E DB thật.

## Kết quả thực tế

Máy Windows 10.0.22621, Intel i5-11400H 2.70 GHz, 12 CPU logic, RAM 16 GiB, Node v20.20.1. DB Supabase từ xa qua TLS/pooler, pool max 10. Express trên máy đo. JWT test do server ký, không đo màn đăng nhập. Mỗi endpoint warmup 10 request rồi 10 người dùng khác nhau × 20 request tuần tự/người (200 mẫu); thời gian `performance.now()` từ HTTP request đến đọc body; p95 nearest rank `ceil(0.95*N)-1`. Không tính seed, warmup, AI, upload, export. Không suy ra throughput production từ phép đo closed-loop này.

| HTTP endpoint | p95 trước song song query | p95 sau, lượt độc lập cuối | Mục tiêu <2s |
|---|---:|---:|---|
| `/achievements?pageSize=20` | 2522.832 ms | 1650.780 ms | Đạt trong lượt đo này |
| `/dashboard/summary` | 3077.284 ms | 2078.418 ms | Chưa đạt |

Lượt đầu 21:54:05–21:55:50; lượt giữa 21:57:55–21:59:30 có tác vụ đối soát chạy nền trên schema khác cùng DB (p95 2167.016/2873.549 ms, lưu `overlapping-load-result.json`). Lượt cuối bắt đầu 22:09:47, không chạy đối soát/browser test song song, p95 1650.780/2078.418 ms như bảng, lưu `load-result.json`. Thời gian Asia/Saigon; timestamp UTC/mẫu thô trong JSON. Dashboard vẫn chưa đạt, không chạy lặp chỉ để lấy một lượt PASS. Mức giảm HTTP là quan sát giữa các lượt trên DB từ xa, không chứng minh hoàn toàn do tối ưu. HTTP latency lớn hơn nhiều thời gian DB sắp xếp; cần đo thêm RTT/pool wait/query từng bước trước khi thay đổi pool/cache. Không cache quyền từ JWT.

EXPLAIN phần thứ tự danh sách trên 5.000 dòng: Sort 3.268 ms → Index Only Scan 0.092 ms, không phải toàn bộ query hay HTTP p95. Bằng chứng đầy đủ trong `docs/testing/w5-p1/query-plan.json`.

| Lệnh đã chạy | Kết quả |
|---|---|
| `node backend/tests/w3-p1.integration.js` | PASS 126 assertions, HTTP + Supabase, rollback |
| `node backend/tests/w2-q4.integration.js` | Lần đầu timeout migration (57014); chạy lại PASS 68 assertions |
| `npm run test:w5-p1` (backend) | Các test tương ứng chạy trực tiếp: 24/24 PASS |
| `node --test backend/tests/w2-q1.test.js backend/tests/w2-q4.test.js` | 12/12 PASS |
| `npm run build` (frontend) | PASS, cảnh báo bundle JS 575.28 kB |
| `npm run lint` (frontend) | PASS |
| `node --preserve-symlinks scripts/w5-p1-ui.cjs` | PASS loading/error/retry/empty, không tràn ngang tại 390/768/1440 px |
| W5-P1 load mode | Đủ dữ liệu, 200 mẫu/endpoint/lượt; lượt cuối danh sách đạt, dashboard chưa đạt, tổng TARGET_NOT_MET |

Lần chạy W5-P1 full ban đầu: kiểm tra dataset/vai trò/dashboard/empty đã đi qua, export 5.000 dòng vượt timeout HTTP 30s, một lượt mất kết nối pg. Không tính những lượt này PASS CSV. Chạy lại mode reconcile với timeout export 120s: PASS các vai trò, dashboard/report, toàn bộ ID qua các trang so với CSV, tổng hợp lệ và số năm distinct; các bộ lọc toàn bộ/cá nhân-tập thể/năm 2024/VERIFIED. Bằng chứng `docs/testing/w5-p1/reconcile-result.json`. Export không thuộc p95 acceptance; lượt này mất khoảng 8 phút, chưa có SLO export và cần theo dõi độ ổn định kết nối khi xuất lớn.

## Tự kiểm tra

Từ root, dùng cấu hình DB server-only đang có trong `.env` hoặc `backend/.env` (không đưa vào Git):

```powershell
cd backend
npm run test:w5-p1
npm run test:w5-p1:workflow
$env:NODE_ENV='test'
$env:W5_P1_MODE='reconcile'
npm run test:w5-p1:integration
$env:W5_P1_MODE='load'
npm run test:w5-p1:integration
```

Chạy hai mode tuần tự. `load-result.json` và `reconcile-result.json` nằm trong `output/w5-p1/` (Git ignore), gồm máy, timestamp, mẫu ms và lỗi. TARGET_NOT_MET trả exit code khác 0. Giữ kết quả riêng trước khi chạy lại. Cần quyền tạo/xóa schema và migrations; không chạy trên DB production. Nếu tiến trình bị kill giữa chừng, kiểm tra schema `w5p1_test_<12 hex>` chính xác của lượt đó trước khi dọn; không xóa schema người khác.

UI: chạy Vite API mode ở `127.0.0.1:5173`, đặt `W5_PLAYWRIGHT_PATH` đến package Playwright có sẵn, chạy `node --preserve-symlinks scripts/w5-p1-ui.cjs`. Ảnh và kết quả trong `output/w5-p1/ui/`. Kiểm thử UI này stub API, đã PASS thêm 20 dòng trên cả ba kích thước. Browser mode của runner (`W5_P1_MODE=browser`, chạy Node với `--preserve-symlinks`) đăng nhập UI thật và mở report qua menu, chuyển tiếp HTTP đến Express/schema riêng, không giả lập response. Mật khẩu ngẫu nhiên chỉ tồn tại trong lượt chạy, không lưu Git. Cần Vite tại localhost:5173 và Edge/Playwright. Browser mode không đo tải.

API giữ nguyên URL/payload/quyền và response; thay đổi thứ tự khi giá trị sort bằng nhau dùng ID cùng chiều. Không thêm endpoint seed công khai. Tài liệu này là plan W5-P1 dùng Supabase, không phục hồi DB cũ.

Browser E2E đã PASS 5 tài khoản tương ứng ADMIN, MANAGER, UNIT_REPRESENTATIVE, RECORDS_OFFICER, LECTURER: đăng nhập thật, report thật, đối chiếu tổng 5000/650/150/650/50 với API thật; mobile đại diện 390 px không tràn ngang. Bằng chứng `docs/testing/w5-p1/browser-result.json`; ảnh trong output/w5-p1/browser. Hai lần sửa runner trước đó gặp ENOENT đường dẫn ảnh và timeout khi hard navigation; kết quả bàn giao là lượt chạy qua menu với PASS. Không coi đây là nghiệm thu refresh/hard-reload session hoặc browser workflow Hội đồng; workflow quyền/trạng thái kiểm bằng E2E HTTP W2-Q4 và kế thừa W4-Q4.

Chưa nghiệm thu toàn bộ: p95 dashboard chưa đạt; độ ổn định/thời gian export lớn cần theo dõi thêm, chưa kiểm thử browser toàn bộ workflow Hội đồng hoặc đối soát riêng các thẻ Pending/RESEARCH được suy diễn trong portfolioApi của dashboard UI. Đối soát dashboard trong báo cáo này là endpoint `/dashboard/summary`; browser đối soát trang Reports. Không commit/push/merge. Commit đề xuất: `feat(W5-P1): add synthetic scale seed, role reconciliation and measured performance regression`.
