# BÁO CÁO BÀN GIAO TUẦN 6 — PHẦN VIỆC W6-Q1
## SỬA LỖI CHẶN CUỐI VÀ CHẠY LẠI BACKEND/AI

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W6-Q1 — Sửa lỗi chặn cuối và chạy lại backend/AI  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 09/10/2026 (Asia/Saigon)  
**Nhánh thực hiện:** `w6-q1` (tách từ `w5-q4`)  
**Phụ thuộc đã xác minh:** W5-Q4 (phân loại lỗi), W5-P4 (fix fallback JWT)

---

## 1. Phạm vi thực hiện

1. Chỉ xử lý lỗi chặn đã ghi (3 P1 còn lại từ W5-Q4).
2. Chạy regression bị ảnh hưởng.
3. Kiểm tra ngày áp dụng quy định 28/10 — ghi vào cấu hình và test.
4. Đóng băng cấu hình/model/version dùng demo.

---

## 2. Kết quả thực hiện

### 2.1 Sửa P1 — Schema Drift `verified_by`

**File mới:** `database/migrations/009_add_missing_columns_to_achievements.sql`

- Bổ sung 4 cột còn thiếu vào `app.achievements`:
  - `verified_by BIGINT NULL REFERENCES app.users(user_id)` — người duyệt
  - `verified_at TIMESTAMPTZ NULL` — thời điểm duyệt
  - `submitted_at TIMESTAMPTZ NULL` — thời điểm nộp gần nhất
  - `version INTEGER NOT NULL DEFAULT 1` — OCC counter
- Tất cả dùng `ADD COLUMN IF NOT EXISTS` → idempotent, an toàn chạy lại.
- Index `ix_achievements_verified_by` để tìm kiếm nhanh.
- Ghi nhận vào `app._schema_migrations` version `'009'` với `ON CONFLICT DO NOTHING`.
- **Không chứa DROP TABLE, TRUNCATE, hoặc T-SQL syntax.**

### 2.2 Sửa P1 — StorageKey Containment Check

**File sửa:** `scripts/restore.mjs` — hàm `restorePrivateStorage`

- Thay `path.join(backupStorageDir, item.storageKey)` bằng `path.resolve(...)`.
- Kiểm tra `srcPath.startsWith(resolvedBackupRoot + path.sep)` → throw nếu thoát.
- Kiểm tra `dstPath.startsWith(resolvedTargetRoot + path.sep)` → throw nếu thoát.
- Chặn absolute path, path traversal (`../`), và symlink ra ngoài thư mục.

### 2.3 Sửa P1 — `downloadCheck.allPassed` Fail Hard

**File sửa:** `scripts/restore.mjs` — hàm `runRestore` sau `verifyEvidenceDownload`

- Thêm `if (!downloadCheck.allPassed) { throw new Error(...) }` với thông báo rõ: số file lỗi, danh sách storageKey.
- Restore bị từ chối khi bất kỳ file nào thiếu hoặc hash sai.

### 2.4 Ngày áp dụng quy định 28/10

- Ghi `regulationEnforcementDate: "2026-10-28"` vào `docs/deployment/DEMO_VERSION_CONFIG.json`.
- `regulationNote` mô tả ngữ nghĩa: thành tích nộp trước 28/10 tính theo quy định cũ; backend kiểm tra `academic_year` trước khi tính điểm.
- Test suite S3 (5 ca) xác nhận ngày và note đúng.

### 2.5 Đóng băng cấu hình phiên bản demo

**File mới:** `docs/deployment/DEMO_VERSION_CONFIG.json`

- Stack: frontend React 18/Vite 5/Tailwind 3; backend Express 4.21.2/pg 8.23.1/jwt 9.0.2/zod 3.24.1.
- DB: migrations 001–009 áp dụng; ghi nhận migration 009.
- AI: `accuracyClaim: NONE`; `kpiSource: SIMULATED`; smoke provider NOT_RUN với chính sách quota.
- Blocker status: 3 P1 = FIXED; 1 P1 prior = FIXED (W5-P4); 2 P2 = ghi nhận.
- Feature freeze: 21/10; candidate tag: 25/10.

### 2.6 Smoke Provider

- **Trạng thái:** NOT_RUN — không có provider key trong môi trường CI.
- **Chính sách:** Khi quota fail → ghi log + lịch chạy lại; **không tuyên bố là kết quả AI mới.**
- **Hướng dẫn chạy:** `node scripts/w5-q3-smoke-provider.mjs` sau khi set `OPENAI_API_KEY` hoặc `GROQ_API_KEY`.

---

## 3. Lệnh và Kết Quả Kiểm Thử Thực Tế

| Bộ kiểm thử | Lệnh | Kết quả |
|---|---|:---:|
| W6-Q1 (5 suite, 37 ca) | `npm run test:w6-q1` | **37/37 PASS** |
| W5-Q4 regression | `npm run test:w5-q4` | **20/20 PASS** |
| W5-Q2 holdout benchmark | `npm run test:w5-q2` | **6/6 PASS** |
| W5-Q3 demo/backup/restore | `npm run test:w5-q3` | **7/7 PASS** |

---

## 4. Danh Sách Tệp Thay Đổi / Tạo Mới

| File | Trạng thái | Mô tả |
|---|:---:|---|
| `database/migrations/009_add_missing_columns_to_achievements.sql` | **[TẠO MỚI]** | ADD COLUMN IF NOT EXISTS verified_by, verified_at, submitted_at, version |
| `scripts/restore.mjs` | **[SỬA]** | P1-fix containment check srcPath/dstPath; P1-fix fail hard downloadCheck |
| `docs/deployment/DEMO_VERSION_CONFIG.json` | **[TẠO MỚI]** | Cấu hình đóng băng phiên bản demo, ngày 28/10, blocker status |
| `backend/tests/w6-q1.test.js` | **[TẠO MỚI]** | 37 ca kiểm thử W6-Q1 |
| `backend/package.json` | **[SỬA]** | Thêm script `test:w6-q1` |
| `docs/weekly/WEEK_06_W6_Q1.md` | **[TẠO MỚI]** | Báo cáo bàn giao W6-Q1 |

Không chạm endpoint, payload, hoặc file của người khác.

---

## 5. Hướng Dẫn Tự Kiểm Tra

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# 1. W6-Q1 (37 ca: migration 009, restore fixes, ngày 28/10, demo config)
npm run test:w6-q1

# 2. Regression W5-Q4 (20 ca: phân loại lỗi, RC checks)
npm run test:w5-q4

# 3. Holdout benchmark (6 ca)
npm run test:w5-q2

# 4. Demo/backup/restore (7 ca)
npm run test:w5-q3
```

**Kiểm tra thủ công migration 009:**
- Mở `database/migrations/009_add_missing_columns_to_achievements.sql`
- Xác nhận 4 cột, tất cả `IF NOT EXISTS`, không DROP/TRUNCATE, không T-SQL.

**Kiểm tra restore.mjs sửa:**
- `grep -n "resolvedBackupRoot\|Chặn path traversal\|downloadCheck.allPassed" scripts/restore.mjs`

---

## 6. Phần Chưa Hoàn Thành

| Hạng mục | Lý do | Cần làm tiếp |
|---|---|---|
| Chạy `node scripts/restore.mjs` thật với DB test | Không có `RESTORE_TARGET_DB_URL` riêng trong môi trường | W6-Q2 xác nhận restore end-to-end |
| Smoke provider AI live | Không có key trong CI | Set key và chạy `w5-q3-smoke-provider.mjs` trước demo |
| UI live demo | Chờ restore thành công | W6-Q2 |

---

*Đề xuất commit: `fix(W6-Q1): sua P1 schema-drift verified_by, containment check va fail-hard restore`*
