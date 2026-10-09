# BÁO CÁO BÀN GIAO TUẦN 6 — PHẦN VIỆC W6-Q2
## KIỂM CHỨNG CÀI ĐẶT VÀ KHÔI PHỤC LẦN CUỐI

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W6-Q2 — Kiểm chứng cài đặt và khôi phục lần cuối  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 09/10/2026 (Asia/Saigon)  
**Nhánh thực hiện:** `w6-q2` (tách từ `w6-q1`)  
**Phụ thuộc đã xác minh:** W6-Q1 (migration 009, restore P1-fix), W5-Q3 (backup/restore scripts)

---

## 1. Phạm vi thực hiện

1. Kiểm tra bộ migration PostgreSQL, DB dump, backup file và manifest.
2. Restore trong DB test riêng và xác nhận quyền schema/role — **bị chặn** (xem mục 5).
3. Tải đúng minh chứng/lịch sử, đối chiếu hash.
4. Ghi phiên bản DB, file và code cùng nhau.

---

## 2. Kết quả thực hiện

### 2.1 Kiểm tra bộ migration PostgreSQL

- **9 migrations (001–009) đều có mặt** — kiểm tra từng file.
- Migration 009 (W6-Q1): PostgreSQL syntax, không T-SQL, idempotent `IF NOT EXISTS`, không `DROP TABLE` / `TRUNCATE`.
- Tất cả migrations: không chứa key/secret thật, không DROP/TRUNCATE.
- Migration 005 (legacy T-SQL) vẫn còn — không bị xóa, đây là artefact historical.

### 2.2 Backup script và manifest

- `backup.mjs`: export `runBackup`, tạo `backup_manifest.json` và `storage_manifest.json`, tính SHA-256 từng file.
- `restore.mjs`: có `runRestore`, safety guard chặn ghi đè DB, P1-fix containment check và fail-hard `downloadCheck` (đã sửa W6-Q1).

### 2.3 Đối chiếu hash candidate-manifest

- `candidate-manifest.json`: 80+ entries, tất cả có `path`, `sha256` (64 hex), `bytes >= 0`.
- **Hash drift ghi nhận:** 26 file thay đổi sau baseline W5-P4 (`37a381e`) — đây là **bình thường** vì code đã phát triển thêm W5-Q1 → W5-Q4 → W6-Q1 → W6-Q2.
- Drift không phải lỗi — manifest là bằng chứng tại baseline W5-P4 để so sánh, không phải snapshot hiện tại.
- File PNG/asset lớn không commit → bỏ qua trong kiểm tra hash; không coi là lỗi.

### 2.4 verification.json nhất quán với candidate-manifest

- `task` và `baselineCommit` khớp giữa hai file.
- `aiAccuracyClaim: "NONE"` và `externalKpiSource: "SIMULATED"` — đúng nhãn.
- Lỗi 42703 (`verified_by`) được ghi rõ trong `checks`.
- `acceptance: "BLOCKED_Q3_RESTORE"` — phản ánh trạng thái thực (không PASS giả).

### 2.5 Ghi phiên bản DB, file và code — RELEASE_CHECKLIST_W6Q2.json

**File mới:** `docs/report-inputs/RELEASE_CHECKLIST_W6Q2.json`

| Trường | Giá trị |
|---|---|
| `dbVersion` | PostgreSQL via Supabase |
| `lastMigration` | `009_add_missing_columns_to_achievements.sql` |
| `codeCommit` | `1638173` (tip w6-q1) |
| `restoreIntegrationStatus` | `NOT_RUN` — cần `RESTORE_TARGET_DB_URL` |
| `deliverableReproducible` | `PARTIAL` — migrations + code OK; restore end-to-end còn chặn |
| `aiAccuracyClaim` | `NONE` |
| `kpiSource` | `SIMULATED` |

### 2.6 Cập nhật test W5-Q4

- Test `[P1-SCHEMA-DRIFT]` đã flip: trước là assert `!foundInMigration` (xác nhận bug P1), nay flip thành assert `foundInMigration` (xác nhận W6-Q1 đã fix).
- Tên test được cập nhật rõ: `đã fix bởi W6-Q1 migration 009`.

---

## 3. Lệnh và Kết Quả Kiểm Thử Thực Tế

| Bộ kiểm thử | Lệnh | Kết quả |
|---|---|:---:|
| W6-Q2 (5 suite, 36 ca) | `npm run test:w6-q2` | **36/36 PASS** |
| W6-Q1 regression | `npm run test:w6-q1` | **37/37 PASS** |
| W5-Q4 (sau flip P1 test) | `npm run test:w5-q4` | **20/20 PASS** |

---

## 4. Danh Sách Tệp Thay Đổi / Tạo Mới

| File | Trạng thái | Mô tả |
|---|:---:|---|
| `backend/tests/w6-q2.test.js` | **[TẠO MỚI]** | 36 ca kiểm thử W6-Q2 (5 suite) |
| `docs/report-inputs/RELEASE_CHECKLIST_W6Q2.json` | **[TẠO MỚI]** | Release checklist — DB/file/code đồng bộ |
| `backend/tests/w5-q4.test.js` | **[SỬA]** | Flip P1-SCHEMA-DRIFT test: assert fix thay assert bug |
| `backend/package.json` | **[SỬA]** | Thêm script `test:w6-q2` |
| `docs/weekly/WEEK_06_W6_Q2.md` | **[TẠO MỚI]** | Báo cáo bàn giao W6-Q2 |

---

## 5. Hướng Dẫn Tự Kiểm Tra

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# 1. W6-Q2 (36 ca: migration, backup/restore scripts, hash, version matrix)
npm run test:w6-q2

# 2. Regression W6-Q1 (37 ca: P1 fixes, ngày 28/10, demo config)
npm run test:w6-q1

# 3. Regression W5-Q4 (20 ca, bao gồm P1-fix assertion flip)
npm run test:w5-q4
```

**Kiểm tra restore integration thật (cần DB test riêng):**
```bash
export RESTORE_TARGET_DB_URL="postgresql://..."   # DB test — KHÔNG phải DB sản xuất
node scripts/restore.mjs --target-schema=app_restore_test
```

---

## 6. Phần Chưa Hoàn Thành (BLOCKED)

| Hạng mục | Lý do | Hành động cần làm |
|---|---|---|
| Restore end-to-end thật | `RESTORE_TARGET_DB_URL` không có trong CI | Set env + chạy `node scripts/restore.mjs`, deadline 21/10 |
| HTTP file download sau restore | Blocked bởi restore integration | Unblock restore trước |
| Smoke provider AI live | Không có key trong CI | Set `OPENAI_API_KEY` / `GROQ_API_KEY` + chạy smoke trước demo |
| URL PR GitHub merge | Chưa verify remote | Kiểm tra https://github.com/VindWeen/PTUD_PhatTrienUngDung/pulls |

---

*Đề xuất commit: `feat(W6-Q2): kiem chung migration, backup/restore script, hash manifest, version matrix`*
