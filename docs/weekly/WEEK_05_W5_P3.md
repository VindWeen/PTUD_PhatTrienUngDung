# W5-P3 — Bàn giao cài thử và hướng dẫn

Võ Nhạc Phước — 08/10/2026, Asia/Saigon. Kế hoạch triển khai theo ADR-001: Supabase PostgreSQL qua pg/TLS thay SQL Server, auth Express và kho private giữ nguyên. Không tìm thấy AGENTS.md ở repo hoặc các thư mục cha đã kiểm tra. Đã đọc blueprint trong docs và tái sử dụng migrations/seed, hợp đồng auth/files, runner W5-P1, backup/restore W5-Q3.

## Phụ thuộc và phạm vi

W5-Q3 có commit fca04cc, W5-P1 có e777e70; các hợp đồng và source đã có trong checkout. Danh sách artifacts của chat trống; không có PR URL được xác minh, không tuyên bố PR đã merge chỉ từ commit local. W5-P1 đã ghi p95 dashboard 2078.418 ms, chưa đạt <2s; W5-P3 không thay kết quả đó.

README cũ còn mô tả UI demo đã được thay bằng quy trình API thật. Tài liệu mới gồm user guide theo 6 vai trò, demo 12–15 phút, cấu hình pg/TLS/free API, seed phá hủy, cookie/proxy, storage bền vững và lỗi đã gặp. Không sửa auth, quyền/trạng thái, query nghiệp vụ hoặc schema DB dùng chung. Không đổi endpoint/payload API; dùng /auth/login và /evidence-files/:id/download theo hợp đồng hiện có. Chỉ thêm runner nghiệm thu HTTP/Supabase riêng.

## Môi trường và phương pháp cài thử

Windows hiện có, Node v20.20.1, npm 10.8.2. Tạo source sạch bằng `git archive HEAD -o output/w5-p3/source.zip` rồi Expand-Archive vào output/w5-p3/clean; không mang node_modules hoặc env vào archive. `npm ci --cache <repo>/.npm-cache --prefer-offline --no-audit --no-fund` độc lập cho backend/frontend, cache npm tái sử dụng. Đây là **cài sạch source/dependencies trên cùng Windows**, không phải VM/OS mới và chưa có người thứ hai tự cài độc lập. Không khẳng định kiểm được tải npm qua mạng hoàn toàn mới.

Script W5-P3 được chép vào bản clean để chạy bằng dependencies vừa cài. Đặt W5_P3_ENV_FILE đến backend/.env hiện có để cấp secrets server-only cục bộ; không chép secrets vào Git. MigrateUp và seedDatabase thật chạy trên schema w5p3_test_<12 hex> trống bằng wrapper đổi schema; không migrate/seed app dùng chung. Sau kiểm thử, schema test được dọn. Đã dùng Supabase thật PostgreSQL 17.11 qua TLS, không fallback fixture.

## Lệnh và kết quả thực tế

| Lệnh/thao tác | Kết quả |
|---|---|
| npm ci tại clean/backend | PASS, 138 packages, exit 0 |
| npm ci tại clean/frontend | PASS, 343 packages, exit 0; cảnh báo eslint deprecated |
| npm run build tại clean/frontend | PASS, JS 575.28 kB, có cảnh báo chunk >500 kB |
| npm run lint tại clean/frontend | PASS, exit 0 |
| npm run test:w5-p1 tại clean/backend | PASS 24/24, exit 0 |
| node clean/backend/tests/w5-p3.integration.js | Migrate 25 file + seed thật PASS; 5 seed account login HTTP 200 |
| node scripts/backup.mjs --out-dir=backups/w5p3_http --storage-dir=backend/storage/private/evidences | PASS backup, 51 bảng/817 dòng, 1 file/29 B; native exporter |
| W5-P3 runner với W5_P3_BACKUP_DIR=backups/w5p3_http | FAIL exit 1 khi restore Data DML, PostgreSQL 42703 |
| Chạy riêng runRestore diagnostic, schema w5p3_restore_diagnostic | Tái hiện 42703: column "verified_by" of relation "achievements" does not exist; đã dọn schema diagnostic |

Backup đọc app hiện tại, không seed/migrate app. Backup chứa dữ liệu DB nên được giữ cục bộ trong thư mục Git ignore, không đưa bản dump/metadata người dùng vào báo cáo Git. Không có backup sẵn trong checkout trước lượt chạy. File backup minh chứng đã chỉ đúng kho backend/storage/private/evidences có file nguồn; không tuyên bố đã backup đầy đủ kho quyết định ở storage/private/evidences/awards.

## Lỗi cài đặt đã phát hiện và sửa

1. Hướng dẫn cũ chép `.env.example` từ root nhưng file nằm backend/.env.example: sửa lệnh và vị trí chạy.
2. Lượt thử đầu cấp root env nên không kết nối DB. Cấp backend env mới chạy được; ghi rõ ưu tiên backend env và biến tiến trình. Không sửa/xóa env người khác. Lượt đó có cảnh báo cleanup do kết nối cũng không dùng được; chưa tạo được schema.
3. Runbook ghi MatKhau123! nhưng seed hash không khớp: HTTP login 401. Đối chiếu runner cũ/hash xác nhận demo1234; sửa runbook, README và test. Sau sửa 5 login 200.
4. Tài liệu gọi 6543 là session/transaction: sửa 6543 transaction và 5432 session; nguồn chính thức trong getting started. Ghi đúng TLS rejectUnauthorized=false chưa xác minh CA.

## Phần bị chặn/chưa nghiệm thu

**Chặn từ W5-Q3:** backup native exporter tạo DDL từ migrations, trong khi DB nguồn có cột achievements.verified_by ngoài DDL đó. Backup success nhưng restore Data DML lỗi 42703. Không bỏ cột khỏi dump, không thêm/xóa cột DB chung chỉ để lấy PASS. Cần chủ phần Q3 đối soát schema drift hoặc cung cấp dump DDL đúng schema thực tế (ví dụ pg_dump phù hợp), rồi chạy lại restore. Có thể còn drift khác sau lỗi đầu tiên; chưa suy đoán hết. Do restore chưa hoàn thành, **chưa chạy được kiểm tải HTTP file sau restore/owner/hash/anonymous/ngoài quyền**; phần này được runner chuẩn bị, chưa được tính PASS. Các ca Q3 cũ đọc storage adapter không thay thế bằng chứng HTTP restored.

Chưa kiểm provider AI thật/quota (không gọi API AI trong smoke), browser toàn bộ workflow/Hội đồng, file quyết định sau restore, hosting public/persistent disk hoặc người thứ hai tự cài trên OS mới. Seed không có COUNCIL; phải tạo/phân công tài khoản demo riêng hợp lệ. Không tự cấp quyền hay tự xác nhận nguồn/tiêu chí. W5-P1 còn dashboard p95 chưa đạt; không bịt bằng cache quyền/fixture. Export lớn và các giới hạn Q3 snapshot/TLS được ghi trong getting started.

## File đổi

- README.md: quy trình clone/cài/API/Supabase, tài khoản đúng và liên kết bàn giao.
- backend/.env.example: sửa mô tả cổng pooler.
- backend/tests/w5-p3.integration.js: migrate/seed/login schema riêng; tùy chọn restore Q3 và kiểm HTTP tải file.
- docs/deployment/GETTING_STARTED.md: cài sạch, pg/TLS/free API, lỗi và restore nghiệm thu.
- docs/deployment/DEPLOYMENT_GUIDE.md: sửa cổng và thêm giới hạn Q3 đã kiểm.
- docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md: sửa mật khẩu, ghi blocker restore hiện tại.
- docs/USER_GUIDE.md, docs/DEMO_SCRIPT.md: hướng dẫn vai trò và demo.
- docs/weekly/WEEK_05_W5_P3.md: báo cáo này.

## Tự kiểm tra

Trên project demo riêng, làm README và GETTING_STARTED từng bước, không dùng seed trên DB cần giữ. Tại backend chạy `node tests/w5-p3.integration.js` để kiểm cài/5 login; nếu không cấp backup, status INSTALL_PASS_RESTORE_NOT_RUN, không phải nghiệm thu đầy đủ. Từ root chạy:

```powershell
$env:W5_P3_BACKUP_DIR=(Resolve-Path backups/GOI_BACKUP_DA_CHON).Path
node backend/tests/w5-p3.integration.js
Remove-Item Env:W5_P3_BACKUP_DIR
```

Cần quyền tạo/xóa schema và backup hợp lệ có minh chứng cá nhân cùng giảng viên ngoài quyền. Test sẽ fail nếu dữ liệu/file không đủ; không âm thầm bỏ qua. Kết quả output/w5-p3/<id>/result.json; runner chỉ dọn schema của chính lượt chạy. Nếu kill giữa chừng, kiểm chính xác tên schema trước khi dọn. Chạy build/lint và test:w5-p1 như README. Bằng chứng clone clean hiện ở output/w5-p3/clean (Git ignore).

Chưa commit/push/merge. Commit đề xuất: `docs(W5-P3): document clean Supabase setup, role guide and demo; add restore HTTP acceptance smoke`.
