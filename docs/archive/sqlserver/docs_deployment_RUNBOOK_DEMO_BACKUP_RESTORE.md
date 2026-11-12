# SỔ TAY VẬN HÀNH DEMO, SAO LƯU & KHÔI PHỤC (OPERATIONAL RUNBOOK)
## Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
**Giai đoạn W5-Q3: Vận hành Demo, Sao lưu & Khôi phục CSDL / Kho File Private**  
**Tác giả:** Tạ Trần Vinh Quang (Phụ trách Backend / Database / Deployment)  
**Thời điểm:** 08/10/2026 (Asia/Saigon) — **Mã nhiệm vụ:** `[W5-Q3]`

---

## 1. QUY TRÌNH CHUẨN BỊ TRƯỚC BUỔI DEMO (PRE-DEMO CHECKLIST)

### 1.1 Mốc thời gian T-24 giờ (Trước buổi demo 1 ngày)
- [ ] **Kiểm tra trạng thái Supabase Free Tier:**
  Đăng nhập bảng điều khiển [supabase.com/dashboard](https://supabase.com/dashboard) kiểm tra xem project có bị tạm dừng tự động (Auto-paused) do không hoạt động quá 7 ngày hay không. Nếu bị tạm dừng, bấm **Restore project** để kích hoạt lại.
- [ ] **Chạy kiểm tra sức khỏe tự động:**
  ```powershell
  cd backend
  npm run pre-demo-check
  ```
  *Kỳ vọng:* Trạng thái trả về `READY`, độ trễ phản hồi `< 2000 ms`, dung lượng CSDL `< 500 MB`.
- [ ] **Thực hiện sao lưu dự phòng toàn diện:**
  ```powershell
  npm run backup
  ```
  Xác nhận tạo thành công bản backup tại thư mục `backups/backup_YYYYMMDD_HHMMSS/` gồm 4 file SQL, thư mục kho file và `backup_manifest.json`.

### 1.2 Mốc thời gian T-1 giờ (Trước buổi demo 60 phút)
- [ ] **Đánh thức CSDL (Warm-up Ping):**
  Gửi lệnh ping khởi động để tránh hiện tượng *Cold Start* (~1–2 giây trễ ở kết nối đầu tiên):
  ```powershell
  npm run pre-demo-check
  ```
- [ ] **Kiểm tra kết nối Readiness Probe:**
  ```powershell
  curl http://localhost:5000/api/v1/health/readiness
  ```
  *Kỳ vọng:* `{"success": true, "data": {"status": "UP", "database": {"status": "UP", "isConnected": true}}}`.
- [ ] **Khởi chạy ứng dụng:**
  - Backend: `npm run dev` (lắng nghe cổng 5000)
  - Frontend: `npm run dev` (lắng nghe cổng 5173)
- [ ] **Đăng nhập thử tài khoản demo:**
  - `an.nv` / `demo1234` (Giảng viên)
  - `bich.tt` / `demo1234` (Quản lý đơn vị FIT)
  - `duc.pm` / `demo1234` (Quản trị viên hệ thống)

---

## 2. QUY TRÌNH SAO LƯU DỮ LIỆU CHUẨN (BACKUP SOP)

### 2.1 Cấu trúc của một bản sao lưu (Backup Package)

Một bản sao lưu được lưu trữ độc lập tại thư mục `backups/backup_[TIMESTAMP]/`:

```text
backups/backup_20261008130615/
├── schema.sql                   # Cấu trúc DDL của schema 'app' (bảng, khóa ngoại, sequence, trigger)
├── roles.sql                    # Định nghĩa roles và lệnh cô lập Data API (ADR-001)
├── data.sql                     # Dữ liệu thực tế của toàn bộ 51 bảng (811 bản ghi)
├── full_db_dump.sql             # Bản sao lưu tổng hợp duy nhất (Schema + Roles + Data)
├── backup_manifest.json         # Siêu dữ liệu thống kê, mã băm SHA-256 của các tệp dump
└── storage_backup/              # KHO FILE PRIVATE SAO LƯU TÁCH BIỆT
    ├── storage_manifest.json    # Danh mục tệp tin, kích thước và mã băm SHA-256 từng file
    └── evidences/               # Cây thư mục tệp tin nhị phân (PDF, PNG, JPG, DOCX)
        └── 2026/
            ├── ach_13_ev_1791218733968_v1_b779f1b1.pdf
            └── ...
```

### 2.2 Lệnh thực hiện sao lưu

```powershell
# Cách 1: Sử dụng NPM script trong thư mục backend
cd backend
npm run backup

# Cách 2: Gọi trực tiếp từ thư mục gốc với tùy chọn đường dẫn xuất bản
node scripts/backup.mjs --out-dir=backups/my_custom_backup
```

### 2.3 Tiêu chí nghiệm thu cốt lõi: "File private không nằm trong DB dump"

1. **Nguyên tắc tách biệt dữ liệu:**
   - Trong CSDL (bảng `app.evidence_files` và `app.award_decision_files`), hệ thống **CHỈ LƯU TRỮ METADATA**:
     - `storage_key`: Đường dẫn định danh tệp tin trong kho lưu trữ private.
     - `sha256_hash`: Mã băm SHA-256 kiểm tra tính toàn vẹn.
     - `file_size`: Kích thước tệp (bytes).
     - `mime_type`: Định dạng tệp tin (ví dụ `application/pdf`).
   - Bản thân tệp tin nhị phân **HOÀN TOÀN KHÔNG LƯU DƯỚI DẠNG BLOB HOẶC BYTEA** trong PostgreSQL.
2. **Cơ chế xác thực tự động trong script:**
   Script `scripts/backup.mjs` tự động quét tệp `data.sql` và `full_db_dump.sql` để xác minh không có khối dữ liệu nhị phân hex bytea dung lượng lớn. Kết quả kiểm định được ghi nhận trong `backup_manifest.json`:
   ```json
   "acceptanceCriteria": {
     "privateFilesNotInDbDump": true,
     "evidenceFilesInDbAreMetadataOnly": true
   }
   ```

---

## 3. QUY TRÌNH KHÔI PHỤC DỮ LIỆU AN TOÀN (RESTORE SOP)

### 3.1 Cơ chế phòng vệ an toàn (Safety Guard)

> [!CAUTION]
> **TIÊU CHÍ BẮT BUỘC:** "KHÔNG RESTORE ĐÈ DB LÀM VIỆC".  
> Script `scripts/restore.mjs` có cơ chế tự động phát hiện đích khôi phục. Nếu người dùng vô tình trỏ đích khôi phục vào CSDL làm việc chính mà không có cờ an toàn, tiến trình **LẬP TỨC DỪNG LẠI** và báo lỗi.

### 3.2 Quy trình khôi phục sang môi trường thử nghiệm tách biệt (Isolated Restore)

1. **Khôi phục CSDL sang Isolated Test Schema:**
   - Schema đích mặc định: `app_restore_test`.
   - Script tạo schema `app_restore_test`, nạp DDL bảng và nạp 100% dữ liệu từ bản sao lưu.
   - Toàn bộ 51 bảng và các ràng buộc khóa ngoại được khôi phục nguyên vẹn mà không tác động đến schema `app` đang chạy.
2. **Khôi phục Kho File Private sang Thư mục Tách biệt:**
   - Thư mục đích mặc định: `storage/restored_test/`.
   - Tất cả 16 tệp tin được sao chép vào thư mục đích với cấu trúc thư mục nguyên gốc.
3. **Đối soát Mã băm SHA-256 (Hash Checksum Comparison):**
   - Script tính toán lại mã băm SHA-256 của từng file trên đĩa sau khi khôi phục.
   - Đối chiếu 1-1 với mã băm trong `storage_manifest.json` của bản sao lưu.
   - Tỷ lệ khớp bắt buộc: **100.0% (Zero byte corruption)**.
4. **Kiểm thử Tải minh chứng qua Storage Adapter (Proof Download Verification):**
   - Đọc các tệp minh chứng thông qua `LocalStorageAdapter` trỏ vào kho đã khôi phục.
   - Đối chiếu mã băm luồng tải về với mã băm `sha256_hash` ghi nhận trong bảng `app_restore_test.evidence_files`.
   - Xác nhận quyền truy cập: Kiểm tra chặn đứng Path Traversal (`../../etc/passwd`).
5. **Cấp lại Bộ khóa Bí mật (Secrets Re-issuing):**
   - Tự động sinh `restored_test_profile.json` cấp phát JWT secrets 256-bit mới độc lập cho phiên bản phục hồi.

### 3.3 Lệnh thực hiện khôi phục

```powershell
# Khôi phục bản backup mới nhất sang môi trường thử nghiệm độc lập
cd backend
npm run restore

# Khôi phục một bản backup cụ thể sang thư mục kho file tùy chọn
node ../scripts/restore.mjs --backup-dir=../backups/backup_20261008130615 --target-storage-dir=../storage/restored_demo
```

---

## 4. QUẢN LÝ TÀI NGUYÊN GÓI SUPABASE FREE & DỰ PHÒNG RỦI RO

### 4.1 Bảng đối chiếu hạn ngạch Gói Free Supabase

| Tài nguyên | Hạn ngạch Gói Free | Mức độ tiêu thụ của dự án | Đánh giá an toàn |
|---|---|---|---|
| **Dung lượng Database** | 500 MB | ~22.2 MB (schema `app`: 3.08 MB) | **4.4% quota — Cực kỳ an toàn** |
| **Dung lượng Supabase Storage** | 1 GB | **0 B (0%)** | Dự án dùng private storage Express |
| **Băng thông Egress/tháng** | 5 GB | < 100 MB | Đạt chuẩn |
| **Kết nối Pooler đồng thời** | 200 pool connections | `DB_POOL_MAX=10` | Thoải mái cho demo |
| **Chính sách Auto-pause** | Tạm dừng sau 7 ngày không hoạt động | Đã có script `npm run pre-demo-check` đánh thức | Ngăn chặn hoàn toàn |
| **Tính năng Backup tự động** | Cần gói Pro ($25/tháng) | Đã tự phát triển `scripts/backup.mjs` & `restore.mjs` | **Tự chủ 100%, 0 đồng chi phí** |

### 4.2 Kịch bản ứng phó sự cố trong buổi Demo (Disaster Recovery)

#### Tình huống 1: Supabase Cloud bị gián đoạn mạng hoặc quá tải
- **Biện pháp xử lý trong 60 giây:**
  1. Khởi chạy PostgreSQL cục bộ (Local PostgreSQL có sẵn tại `C:\Program Files\PostgreSQL\18` hoặc Docker).
  2. Nạp bản sao lưu mới nhất:
     ```powershell
     & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d postgres -f backups/backup_20261008130615/full_db_dump.sql
     ```
  3. Cập nhật `SUPABASE_DB_URL=postgresql://postgres:MatKhau123@localhost:5432/postgres` trong `backend/.env`.
  4. Khởi động lại backend server: `npm run dev`.

#### Tình huống 2: Người dùng thao tác xóa nhầm minh chứng hoặc dữ liệu demo
- **Biện pháp xử lý:**
  Chạy ngay lệnh nạp lại seed sạch sẽ:
  ```powershell
  cd backend
  npm run seed
  ```
  Dữ liệu mẫu chuẩn sẽ được khôi phục trong vòng 1.5 giây.

---

## 5. BIÊN BẢN TỔNG KẾT & XÁC NHẬN NGHIỆM THU

| Hạng mục kiểm tra | Tiêu chuẩn cam kết | Kết quả kiểm chứng thực tế | Trạng thái |
|---|---|---|:---:|
| Khôi phục CSDL | Schema và 811 dòng dữ liệu nguyên vẹn | 51/51 bảng, 811 bản ghi khôi phục thành công | **ĐẠT (100%)** |
| Quyền CSDL & Cô lập API | `anon` & `authenticated` bị thu hồi khỏi `app` | Bị từ chối SQLSTATE `42501` / HTTP 403 | **ĐẠT (100%)** |
| Tính toàn vẹn File | Không mất mát, không sai lệch hash | 16/16 file khớp SHA-256 100.0% | **ĐẠT (100%)** |
| Bảo vệ DB làm việc | Không restore đè schema `app` chính | Safety Guard chặn ngay lập tức nếu trỏ đè | **ĐẠT (100%)** |
| Tách biệt DB & File | File private không nằm trong DB dump | DB dump chỉ chứa metadata (text paths & hashes) | **ĐẠT (100%)** |
| Chi phí vận hành | Giới hạn gói Free, không tự bật dịch vụ trả phí | 22.2 MB / 500 MB DB, 0 B Supabase Storage | **ĐẠT (100%)** |


## Cập nhật W5-P3

Mật khẩu seed đúng là demo1234 (đã sửa ở trên). Xem GETTING_STARTED.md để cài sạch. Restore thử nghiệm W5-P3 ngày 08/10/2026 thất bại 42703 do DDL từ migrations thiếu achievements.verified_by có trong dữ liệu DB nguồn. Báo cáo Q3 trước đây không thay thế lần kiểm hiện tại. Không nghiệm thu tải file sau restore cho đến khi restore chạy được và HTTP kiểm quyền/hash PASS. Schema mặc định app_restore_test bị DROP khi restore: dùng tên riêng cho từng lượt, không chạy đè lượt người khác. Kho file quyết định có thể khác kho minh chứng, cần sao lưu cả hai nếu triển khai sử dụng.
