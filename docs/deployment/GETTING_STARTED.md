# W5-P3 — Cài thử máy sạch

Võ Nhạc Phước, 08/10/2026 (Asia/Saigon). Theo ADR-001 trong blueprint: Supabase PostgreSQL qua pg, Express auth và file private. Thực hiện README trước, dùng phần này để điền cấu hình và kiểm tra kết quả. Không tìm thấy AGENTS.md trong workspace/các thư mục cha đã kiểm tra.

## 1. Chuẩn bị và cấu hình

Cần Git, Node 20.19+ hoặc 22.12+, npm, Supabase project demo mới, TCP tới DB và hai terminal. Không cần SQL Server, Supabase Auth, Storage bucket hay service-role key. Lấy chuỗi DB tại Dashboard → Connect. Seed có TRUNCATE CASCADE: **không seed DB làm việc**. Migrations có thay đổi/xóa cấu trúc; backup trước nâng cấp project đã có dữ liệu.

Từ root: `Copy-Item backend/.env.example backend/.env`. Không có file mẫu ở root. Chỉ chọn một DB URL; xóa `DATABASE_URL` cũ vì mã ưu tiên nó hơn `SUPABASE_DB_URL`. Biến môi trường tiến trình ưu tiên hơn file; backend/.env tồn tại thì root/.env bị bỏ qua.

```ini
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
SUPABASE_DB_URL=postgresql://postgres.PROJECT_REF:PERCENT_ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
DB_SSL=true
DB_POOL_MIN=0
DB_POOL_MAX=5
DB_CONNECTION_TIMEOUT=15000
JWT_ACCESS_SECRET=REPLACE_WITH_RANDOM_ACCESS_SECRET_AT_LEAST_32_CHARS
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_RANDOM_REFRESH_SECRET_32_CHARS
STORAGE_DIR=C:/ptud-data/private/evidences
UPLOAD_DIR=C:/ptud-data/upload-temp
AI_PROVIDER=mock
```

Thay mọi placeholder. Tạo thư mục: `New-Item -ItemType Directory -Force C:/ptud-data/private/evidences,C:/ptud-data/upload-temp`. Chọn ổ có quyền ghi và lưu bền vững. Sinh hai secrets riêng bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` hai lần, lưu cục bộ. Không dùng JWT mẫu khi public demo. Không in env/URL có mật khẩu/token vào báo cáo.

Theo [Supabase Connect](https://supabase.com/docs/guides/database/connecting-to-postgres): direct `db.<ref>.supabase.co:5432` thường cần IPv6; shared **session pooler 5432**, **transaction pooler 6543**, hỗ trợ IPv4. Ưu tiên session/direct cho migrate, restore và Express chạy dài. Sao chép đúng host/username từ Dashboard; không chỉ đổi cổng của chuỗi direct. Encode riêng mật khẩu nếu có ký tự đặc biệt.

Mã hiện tự bật TLS cho URL Supabase, bỏ `sslmode` trước khi truyền vào pg và dùng `ssl: {rejectUnauthorized:false}`: **có mã hóa nhưng chưa xác minh chứng thư server**. W5-P3 giữ hợp đồng Q3, chưa thay chính sách TLS. Nếu cấu hình host rời, bật `DB_SSL=true`. Không tắt TLS để chữa lỗi mạng.

Nếu storage dùng đường dẫn tương đối `../storage/private/evidences`, luôn chạy từ backend; adapter tính theo working directory. Khuyến nghị đường dẫn tuyệt đối. Seed có metadata file không đồng nghĩa đã có byte file trên máy mới; upload minh chứng thử trước khi kiểm backup/restore.

## 2. Cài và kiểm tra

Theo README: `npm ci` từng thư mục, `npm run migrate`, `npm run migrate:status`, `npm run seed` tại backend demo mới. Nguồn chuẩn `supabase/migrations/*.sql` (25 file khi bàn giao) và `supabase/seed.sql`. Không chạy thêm database/migrations legacy; W5-P1 seed 5.000 dòng chỉ dành schema test của runner. Không dùng db reset trên DB dùng chung.

Migrate/seed phải exit 0, status không còn PENDING. Backend `npm start` từ backend; Vite `npm run dev -- --strictPort` từ frontend, `.env.local` API mode theo README. Giữ cổng 5000/5173 rảnh để tránh CORS sai khi Vite tự đổi cổng. Health kiểm tra tiến trình; readiness phải có DB UP. Đăng nhập lần lượt năm tài khoản trong user guide, mở dữ liệu thật rồi đăng xuất.

Build tĩnh không mang proxy dev Vite. Cấu hình reverse proxy `/api/v1` hoặc VITE_API_URL tuyệt đối trước build; SPA fallback về index.html. Với HTTPS cross-site: backend COOKIE_SECURE=true, COOKIE_SAME_SITE=none, CORS_ORIGIN đúng URL FE; browser có thể chặn third-party cookie, nên ưu tiên cùng site. Kho private không được mount public.

## 3. AI free và KPI

Cài thử dùng `AI_PROVIDER=mock`, ghi rõ **AI MÔ PHỎNG**, không nghiệm thu provider thật. Muốn thử thật: chọn groq/openrouter, key tương ứng chỉ ở backend, model được tài khoản provider xác nhận còn miễn phí. Kiểm [Groq rate limits](https://console.groq.com/docs/rate-limits), [OpenRouter free models](https://openrouter.ai/docs/guides/routing/model-variants/free); model mẫu cũ không chứng minh còn hoạt động/free. Không tự bật thanh toán/fallback trả phí. Khi quota/429/timeout: báo chưa có kết quả, không bịa nội dung thay thế.

Chỉ dùng nguồn ACTIVE đã xác nhận, tiêu chí đã được phụ trách chuyên môn xác nhận; kiểm phiên bản và hiệu lực. Bản nháp không làm căn cứ xét. AI không quyết định trao thưởng. Mock server/CSV thử nghiệm phải ghi **KPI MÔ PHỎNG — không phải số liệu LHU**; dữ liệu chưa xác minh không dùng xét thật. Fixture không phải tích hợp thật.

Trước demo kiểm Dashboard free project, resume nếu pause, readiness và `npm run pre-demo-check`. Báo cáo pre-demo chỉ là snapshot DB, không chứng minh provider key/quota hoặc tự resume project bị pause. Không cam kết backend free có persistent disk; mất file sau restart thì DB metadata còn cũng không tải được.

## 4. Backup/restore và tải file thật

DB Supabase tách kho file server. Backup cả hai tại cùng mốc; tạm dừng ghi trong lúc backup vì exporter Q3 chưa bảo đảm snapshot xuyên nhiều query. Chỉ rõ `--storage-dir` tuyệt đối khớp STORAGE_DIR; backup ngoài Git, quyền truy cập hạn chế.

Theo runbook Q3 để backup/restore. Chọn schema/thư mục mới, không dùng mặc định app_restore_test khi người khác đang dùng: script DROP schema đích trước khi nạp. Không dùng force overwrite. Profile RESTORE_DB_SCHEMA **không tự đổi** query app.* của Express; đổi env đó rồi mở UI có thể vẫn đọc DB gốc. Runner W5-P3 đổi schema qua adapter test để HTTP thật đọc DB restored, không dùng adapter này cho production.

Tại root, có cấu hình DB server-only và backup Q3 hợp lệ:

```powershell
$env:W5_P3_BACKUP_DIR=(Resolve-Path backups/GOI_BACKUP_DA_CHON).Path
node backend/tests/w5-p3.integration.js
Remove-Item Env:W5_P3_BACKUP_DIR
```

Runner migrate/seed schema trống, login 5 tài khoản thật, restore Q3 vào schema ngẫu nhiên, tải một minh chứng cá nhân qua Express, so byte/SHA-256, anonymous 401 và giảng viên ngoài quyền 403/404. Cần backup có metadata/file khớp và tài khoản ngoài quyền; thiếu thì FAIL. Token kiểm download do server ký trong runner; login seed kiểm riêng. Không đo browser Hội đồng/provider. Output giữ tại output/w5-p3/<id>/result.json, không commit backup/secrets. Dọn schema do chính runner tạo; giữ file để đối soát. Nếu tiến trình bị kill, chỉ dọn schema chính xác của lượt đó.

## 5. Lỗi và cách xử lý

| Hiện tượng | Cách xử lý |
|---|---|
| Copy env mẫu không thấy | Từ root dùng backend/.env.example; đã sửa hướng dẫn cũ |
| Root env đúng nhưng kết nối lỗi | Backend env tồn tại thì root bị bỏ qua; kiểm biến tiến trình, không trộn hai DB |
| Login MatKhau123! trả 401 | Seed dùng demo1234; đã xác minh hash/HTTP, sửa runbook |
| Direct DB ENETUNREACH | Chọn Session pooler IPv4 5432 từ Dashboard; kiểm firewall/DNS |
| Tenant/user not found | Dùng postgres.<ref> và đúng host pooler |
| CORS/refresh lỗi | Đúng localhost:5173; kiểm cookie HTTPS/cross-site; restart khi đổi env |
| 409 khi lưu/duyệt | Tải lại version và trạng thái, không bỏ kiểm backend |
| DB có file nhưng tải lỗi | Kiểm storage_key, kho private, quyền, backup byte file |
| AI 429/timeout/thiếu nguồn | Báo chưa đánh giá, không tạo căn cứ giả |

Các giới hạn còn lại và bằng chứng thực tế: WEEK_05_W5_P3.md.
