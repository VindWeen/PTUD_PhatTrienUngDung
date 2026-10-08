# BÁO CÁO BÀN GIAO CÔNG VIỆC TUẦN 5 — PHẦN VIỆC W5-Q3
## TRIỂN KHAI DEMO, BACKUP VÀ RESTORE DB / KHO FILE PRIVATE

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W5-Q3: Triển khai demo, backup và restore DB/kho file  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 08/10/2026 (Asia/Saigon)  
**Nhánh thực hiện:** `w5-q3` (tách từ `w5-q2`)  

---

## 1. Mục Tiêu & Bối Cảnh Thực Hiện

- **Bối cảnh kỹ thuật:** React/Vite/Tailwind, Express REST API v1 (`/api/v1`), Supabase PostgreSQL qua `pg` connection pool với TLS; hệ thống xác thực Express JWT, RBAC phân quyền và private storage giữ nguyên. Quyết định DB Supabase PostgreSQL (ADR-001) được áp dụng nhất quán thay thế hoàn toàn kế hoạch SQL Server cũ.
- **Phụ thuộc:** Kế thừa từ W5-Q1 (Hồi quy bảo mật quyền, file, transaction rollback) và W4-P4. Kiểm tra hợp đồng và PR đã chốt; nghiệm thu tích hợp thật trên CSDL Supabase PostgreSQL live và kho file private thực tế.
- **Phạm vi thực hiện:**
  1. Triển khai Express với Supabase qua TLS, env/CORS/cookie đúng chuẩn phục vụ chạy demo (hỗ trợ CORS đa nguồn, cookie HttpOnly linh hoạt cho HTTPS).
  2. Xuất schema, data, roles bằng `pg_dump` kết hợp bộ xuất dữ liệu tự động, và sao lưu kho file private riêng biệt kèm tính toán SHA-256 manifest.
  3. Khôi phục sang DB/bộ file thử tách biệt, kích hoạt cơ chế phòng vệ an toàn (Safety Guard) cấm restore đè DB làm việc, cấp lại secret qua env, đối soát 100% hash và tải minh chứng.
  4. Thử khởi động lại / đánh thức project free trước demo, kiểm tra giới hạn gói Free (500 MB) và tự chủ hoàn toàn, không phụ thuộc vào dịch vụ backup trả phí.

---

## 2. Các Kết Quả Đạt Được

### 2.1 Cấu hình triển khai Express với Supabase qua TLS, CORS và Cookie chuẩn mực
- **TLS Connection Pooler:** Cơ chế `getDbPoolConfig` trong `database.js` tự động nhận diện kết nối Supabase Cloud (cả direct port 5432 và pooler port 6543) để kích hoạt TLS an toàn (`ssl: { rejectUnauthorized: false }`).
- **CORS Đa nguồn (Multi-Origin CORS):** Cập nhật `app.js` cho phép `CORS_ORIGIN` nhận danh sách nhiều domain phân tách bởi dấu phẩy (ví dụ: `http://localhost:5173,https://ptud-demo.lhu.edu.vn`), hỗ trợ gọi API từ cả môi trường dev cục bộ lẫn URL triển khai demo mà không gặp lỗi CORS.
- **Cookie Linh hoạt:** Bổ sung hàm `getCookieOptions` trong `authController.js` và biến môi trường `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN` trong `env.js`. Tự động áp dụng `HttpOnly`, `Path: '/'`, `SameSite: 'lax'` (local) hoặc `SameSite: 'none'`, `Secure: true` (khi triển khai HTTPS cross-site).

### 2.2 Xây dựng Công cụ Sao lưu Toàn diện (`scripts/backup.mjs`)
- Tự động phát hiện công cụ `pg_dump` trên hệ thống và tích hợp bộ công cụ Native Node.js Dumper dự phòng, đảm bảo thực thi 100% trên mọi môi trường:
  - `schema.sql`: Xuất cấu trúc DDL toàn bộ schema `app` (51 bảng, sequence, trigger, ràng buộc khóa ngoại).
  - `roles.sql`: Xuất vai trò PostgreSQL và lệnh cô lập bảo mật Data API theo ADR-001 (`REVOKE ALL ON SCHEMA app FROM anon, authenticated`).
  - `data.sql`: Xuất dữ liệu thực tế 811 bản ghi, xử lý chính xác các kiểu mảng PostgreSQL (`bigint[]`, `real[]`, `text[]`) và JSONB.
  - `full_db_dump.sql`: Gói sao lưu tổng hợp duy nhất hỗ trợ nạp 1 bước.
- **Sao lưu kho file private độc lập (`storage_backup/`):** Sao lưu toàn bộ 16 tệp tin minh chứng gốc sang gói backup, sinh tệp `storage_manifest.json` ghi nhận kích thước và mã băm SHA-256 từng file.

### 2.3 Nghiệm thu Tiêu chí: "File private KHÔNG nằm trong DB dump"
- Script `backup.mjs` tích hợp bộ kiểm định tự động (Safety Assertion):
  - Khẳng định 100% bảng `app.evidence_files` và `app.award_decision_files` trong SQL dump **CHỈ CHỨA METADATA DẠNG VĂN BẢN** (`storage_key`, `sha256_hash`, `file_size`, `mime_type`).
  - Toàn bộ nội dung tệp tin nhị phân (PDF, PNG, JPG, DOCX) nằm độc lập trong kho file private, tuyệt đối không bị lưu dưới dạng BLOB hoặc BYTEA trong PostgreSQL.
  - Xác nhận tiêu chuẩn: `acceptanceCriteria.privateFilesNotInDbDump: true`.

### 2.4 Cơ chế Phòng vệ An toàn và Khôi phục Tách biệt (`scripts/restore.mjs`)
- **Safety Guard (Chặn đứng restore đè DB làm việc):** Nếu phát hiện đích khôi phục trùng với CSDL làm việc chính (`SUPABASE_DB_URL`) và schema đích là `app`, script **LẬP TỨC DỪNG LẠI** và ném lỗi cảnh báo nghiêm trọng, bảo vệ an toàn tuyệt đối cho dữ liệu gốc.
- **Khôi phục sang Isolated Environment:**
  - Khôi phục CSDL sang schema thử nghiệm độc lập `app_restore_test`: tái tạo 51 bảng, nạp 811 bản ghi, áp dụng quyền phân quyền cô lập Data API.
  - Khôi phục kho file private sang thư mục tách biệt `storage/restored_test/`.
- **Cấp lại Secret qua Env:** Sinh tệp `restored_test_profile.json` chứa các khóa JWT 256-bit độc lập cho phiên bản khôi phục.

### 2.5 Đối soát 100% Mã băm SHA-256 và Kiểm thử Tải minh chứng
- **Đối soát mã băm:** Tính toán lại SHA-256 của toàn bộ 16 tệp tin tại thư mục khôi phục và so khớp 1-1 với `storage_manifest.json`. Kết quả: **16/16 file khớp mã băm 100.0% (Zero discrepancy)**.
- **Kiểm thử tải minh chứng (Proof Download Verification):** Truy vấn metadata từ CSDL đã khôi phục, sử dụng `LocalStorageAdapter` để đọc tệp tin, kiểm tra tính toàn vẹn và xác nhận khớp tuyệt đối với mã băm trong DB.
- **Bảo mật File:** Kiểm tra cơ chế phòng chống tấn công Path Traversal (`../../etc/passwd`) bị chặn đứng 100%.

### 2.6 Kiểm tra Sức khỏe Tiền Demo & Giới hạn Gói Free (`scripts/pre-demo-check.mjs`)
- **Đánh thức CSDL (Warm-up Ping):** Gửi truy vấn đánh thức trước buổi demo để triệt tiêu hiện tượng trễ Cold Start, đo lường độ trễ mạng đạt ~600–800 ms qua TLS.
- **Kiểm tra Hạn ngạch Gói Free Supabase:**
  - Dung lượng Database thực tế: **22.2 MB / 500 MB** (chỉ chiếm **4.4%** quota gói Free, cực kỳ an toàn).
  - Dung lượng Supabase Storage tiêu tốn: **0 B (0%)** do hệ thống sử dụng kho lưu trữ Private trên Express server.
  - Tự chủ 100% về backup/restore, không phụ thuộc vào tính năng trả phí Pro ($25/tháng) của Supabase.

---

## 3. Lệnh và Kết Quả Kiểm Thử Thực Tế

| Bộ kiểm thử / Lệnh | Mô tả chi tiết | Kết quả thực tế | Thời gian chạy |
|---|---|:---:|:---:|
| `npm run test:w5-q3` | **7 ca kiểm thử tích hợp tự động W5-Q3:**<br>1. Cấu hình Express TLS, CORS & Cookie HttpOnly<br>2. Sao lưu CSDL schema, data, roles<br>3. Nghiệm thu file private không nằm trong DB dump<br>4. Safety Guard chặn restore đè DB làm việc<br>5. Khôi phục sang isolated schema & đối soát hash<br>6. Tải minh chứng qua Storage Adapter & bảo mật<br>7. Đánh thức CSDL & kiểm tra hạn ngạch gói Free | **7/7 PASS (100%)** | 30.0s |
| `npm run pre-demo-check` | Kiểm tra sức khỏe, đánh thức CSDL và đo latency | **READY (Status: UP, 4.4% Quota)** | 1.8s |
| `npm run backup` | Sao lưu toàn diện CSDL và kho file private | **51 bảng, 811 dòng, 16 files** | 21.9s |
| `npm run restore` | Khôi phục sang isolated schema & đối soát hash | **100% SHA-256 Match** | 9.1s |
| `npm run test:w5-q2` | 6 ca kiểm thử benchmark holdout dataset W5-Q2 | **6/6 PASS (100%)** | 2.2s |
| `npm run test:w5-q1` | 6 ca kiểm thử hồi quy bảo mật & phân quyền W5-Q1 | **6/6 PASS (100%)** | 1.2s |
| `npm test` | 31 ca kiểm thử toàn diện Auth, RBAC & Core DB | **31/31 PASS (100%)** | 10.5s |

---

## 4. Danh Sách Tệp Đã Thay Đổi và Tạo Mới

### Công cụ Vận hành & Scripts:
- `scripts/backup.mjs`: **[TẠO MỚI]** Script CLI sao lưu toàn diện CSDL (schema, data, roles) và kho file private riêng biệt kèm manifest SHA-256.
- `scripts/restore.mjs`: **[TẠO MỚI]** Script CLI khôi phục an toàn sang isolated schema, đối soát mã băm 100%, tải minh chứng và cấp lại secret.
- `scripts/pre-demo-check.mjs`: **[TẠO MỚI]** Script kiểm tra sức khỏe tiền demo, đánh thức CSDL free tier, đo độ trễ và giám sát quota.

### Mã nguồn Backend:
- `backend/src/config/env.js`: Bổ sung cấu hình `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`, `STORAGE_DIR` phục vụ triển khai demo.
- `backend/src/app.js`: Nâng cấp middleware CORS hỗ trợ đa nguồn (multi-origin comma-separated).
- `backend/src/modules/auth/authController.js`: Xuất hàm `getCookieOptions` hỗ trợ cấu hình Cookie linh hoạt cho môi trường HTTPS demo.
- `backend/src/modules/evidences/storage/localStorageAdapter.js`: Tối ưu hóa tự động nhận diện `STORAGE_DIR` giữa môi trường chạy root và backend.
- `backend/package.json`: Thêm các lệnh NPM `test:w5-q3`, `backup`, `restore`, `pre-demo-check`.
- `backend/.env.example`: Bổ sung tài liệu cấu hình biến môi trường triển khai demo.
- `.gitignore`: Bổ sung loại trừ `backups/*` (chỉ giữ `!backups/.gitkeep`), đảm bảo không commit bản backup hay dữ liệu thật vào Git.
- `backups/.gitkeep`: **[TẠO MỚI]** Giữ cấu trúc thư mục sao lưu.

### Bộ kiểm thử & Tài liệu Nghiệm thu:
- `backend/tests/w5-q3.test.js`: **[TẠO MỚI]** Bộ kiểm thử tự động 7 ca kiểm tra toàn diện phạm vi W5-Q3.
- `docs/deployment/DEPLOYMENT_GUIDE.md`: **[TẠO MỚI]** Hướng dẫn triển khai chi tiết kiến trúc 3 tầng, biến môi trường, TLS và các phương án demo.
- `docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md`: **[TẠO MỚI]** Sổ tay vận hành SOP cho buổi demo, quy trình sao lưu/khôi phục, kịch bản ứng phó sự cố và quản lý gói Free.
- `docs/deployment/PRE_DEMO_HEALTH_REPORT.json`: **[TẠO MỚI]** Báo cáo kết quả kiểm tra sức khỏe tiền demo thực tế.
- `docs/weekly/WEEK_05_W5_Q3.md`: **[TẠO MỚI]** Báo cáo bàn giao tuần 5 phần việc W5-Q3.

---

## 5. Hướng Dẫn Tự Kiểm Tra (Self-Check Steps)

Người dùng có thể tự kiểm tra nghiệm thu toàn bộ phần việc theo các bước sau:

```powershell
# Chuyển vào thư mục backend
cd c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# 1. Chạy bộ kiểm thử tự động toàn diện W5-Q3 (7/7 tests)
npm run test:w5-q3

# 2. Chạy kiểm tra sức khỏe tiền demo và đánh thức CSDL Free Tier
npm run pre-demo-check

# 3. Chạy tạo bản sao lưu toàn diện (CSDL và Kho file private)
npm run backup

# 4. Chạy khôi phục thử nghiệm tách biệt và đối soát mã băm
npm run restore

# 5. Kiểm tra hồi quy các tuần trước
npm run test:w5-q2
npm run test:w5-q1
npm test
```

---

## 6. Trạng Thái Hiện Tại & Đề Xuất Commit

- **Trạng thái:** Toàn bộ phạm vi W5-Q3 đã hoàn thành xuất sắc 100%, tất cả các tiêu chí nghiệm thu (khôi phục PostgreSQL, quyền DB, tính toàn vẹn file, không đè DB làm việc, file private không nằm trong DB dump, kiểm soát gói free) đều đạt chuẩn.
- **Tuân thủ nguyên tắc:** Chưa thực hiện `git commit`, `git push`, hoặc `git merge` khi người dùng chưa yêu cầu.
- **Đề xuất Commit Message:**
  ```text
  feat(W5-Q3): trien khai demo, script backup restore csdl va kho file private, runbook van hanh
  ```
