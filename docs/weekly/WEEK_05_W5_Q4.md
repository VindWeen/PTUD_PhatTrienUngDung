# BÁO CÁO BÀN GIAO CÔNG VIỆC TUẦN 5 — PHẦN VIỆC W5-Q4
## REVIEW KẾT QUẢ PHƯỚC VÀ ĐÓNG BẢN ỨNG VIÊN

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W5-Q4: Review kết quả Phước và đóng bản ứng viên  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 09/10/2026 (Asia/Saigon)  
**Nhánh thực hiện:** `w5-q4` (tách từ `w5-p4`)  

---

## 1. Mục Tiêu & Bối Cảnh Thực Hiện

- **Bối cảnh kỹ thuật:** React/Vite/Tailwind, Express REST API v1 (`/api/v1`), Supabase PostgreSQL qua `pg`; xác thực Express JWT, RBAC phân quyền và private storage giữ nguyên. Quyết định DB Supabase PostgreSQL (ADR-001) áp dụng nhất quán. Không thêm tính năng mới.
- **Phụ thuộc:** W5-Q2 (holdout benchmark), W5-Q3 (demo + backup/restore), W5-P1 (performance), W5-P2 (recommender), W5-P4 (review quyền/file/restore). Kiểm tra hợp đồng và tư liệu từ tất cả phụ thuộc đã chốt.
- **Phạm vi thực hiện:**
  1. Review báo cáo số liệu/performance/recommender từ công việc Phước (W5-P2, W5-P4).
  2. Phân loại lỗi chặn demo — tìm root cause, ghi quyết định xử lý, không che giấu.
  3. Phối hợp tag bản ứng viên sau checks — đối soát manifest, verification.json.
  4. Tổng hợp đóng góp Quang, sơ đồ DB/API và kết quả AI cho báo cáo.

---

## 2. Các Kết Quả Đạt Được

### 2.1 Review báo cáo số liệu và phân loại lỗi chặn demo

**Phát hiện P1 — Schema Drift `verified_by`:**
- Cột `verified_by` hiện diện trong `backend/src/modules/achievements/achievementRepository.js` (dòng 66, 567) nhưng **vắng hoàn toàn** trong `database/migrations/001–008_*.sql`.
- Cột tồn tại trên schema live Supabase (tạo ngoài migration runner) nhưng không có trong DDL history → khi restore từ migrations DDL sang DB cô lập: `SQLSTATE 42703: column verified_by of relation achievements does not exist`.
- Đây là **root cause thật** của lỗi 42703 báo cáo trong W5-P4 (không phải lỗi restore.mjs data logic).
- **Quyết định:** Cần migration `009_add_verified_by_to_achievements.sql`. Ghi nhận P1 blocker.

**Phát hiện P1 — EvidenceService JWT Fallback (đã sửa W5-P4):**
- Catch lỗi DB rồi fallback `user.roles` từ JWT có thể hồi sinh quyền đã thu hồi. **Đã sửa** trong diff W5-P4: truyền lỗi DB tới middleware, roles rỗng khi response không hợp lệ.
- 3 ca hồi quy (DB lỗi / response sai / role thu hồi) đều PASS.

**Phát hiện P1 — restore.mjs containment check vắng:**
- `storageKey` được `path.join` trực tiếp khi copy file private, không qua `resolveSafePath`.
- **Quyết định:** Q3 sửa trước 21/10.

**Phát hiện P1 — `downloadCheck.allPassed` không fail:**
- Script ghi kết quả nhưng không exit non-zero khi hash sai/file thiếu.
- **Quyết định:** Q3 sửa exit code trước 21/10.

**Phát hiện P2 — TLS `rejectUnauthorized:false`:**
- Mã hóa kết nối nhưng không xác minh CA. Ghi giới hạn rõ; chấp nhận demo free tier.

**Xác nhận số liệu W5-Q2 (Holdout Benchmark) đủ căn cứ báo cáo:**
- 32 hồ sơ độc lập, peer-validated, accuracy 100%, false-eligible 0 ca, citation precision 100%.
- Nguồn: offline rule engine + local embedding MockProvider — **không phải LLM live real**.
- Slide báo cáo phải ghi rõ nhãn offline/evaluator-only; không suy rộng như AI accuracy tổng quát.

**Xác nhận nguồn KPI W5-P2:** KPI upstream **MÔ PHỎNG**; không là số từ hệ thống LHU live. Ghi nhãn bắt buộc.

### 2.2 Đối soát hồ sơ ứng viên

- `candidate-manifest.json` và `verification.json` nhất quán: task `W5-P4`, baseline commit `37a381e18dd6f07d63dcc55176f111a8f035b179` khớp nhau.
- Trạng thái `CANDIDATE_RESTORE_BLOCKED` / `BLOCKED_Q3_RESTORE` ghi rõ trong cả hai file.
- Bước HTTP sau restore: `notRun` được liệt kê đầy đủ; không tính là PASS.
- Không có key/secret thật trong `docs/report-inputs/`.
- `aiAccuracyClaim: NONE` — không tự tuyên bố AI accuracy chưa đo.

### 2.3 Tổng hợp đóng góp Quang và sơ đồ DB/API

- Tổng hợp đóng góp Quang từ W1-Q1 đến W5-Q4 trong `docs/report-inputs/QUANG_CONTRIBUTIONS.md` — gắn commit/test/demo, không nhận thay xác nhận người khác.
- Sơ đồ 9 phân hệ DB và bảng API endpoint chính trong `QUANG_CONTRIBUTIONS.md`.
- ERD.md nhãn rõ W1 (lịch sử); drift `verified_by` được công bố, không che giấu.

### 2.4 Release Candidate Notes

- `docs/report-inputs/RELEASE_CANDIDATE_NOTES.md`: trạng thái RC, phân loại 6 lỗi (4×P1, 2×P2), checklist 8 hạng mục đóng bản 25/10, hướng dẫn tự kiểm, bảng quyết định lỗi.

---

## 3. Lệnh và Kết Quả Kiểm Thử Thực Tế

| Bộ kiểm thử / Lệnh | Mô tả | Kết quả thực tế | Thời gian |
|---|---|:---:|:---:|
| `npm run test:w5-q4` | **20 ca W5-Q4:** holdout data integrity, phân loại lỗi, đóng góp Quang, sơ đồ DB/API, hồ sơ RC | **20/20 PASS** | ~155 ms |
| `node --test tests/w5-p4.test.js tests/w5-q1.test.js tests/w2-q2.test.js` | Hồi quy P4 + Q1 + Q2 (evidenceService fallback, quyền, OCC) | **13/13 PASS** | ~2.5s |
| `npm run test:w5-q2` | Holdout benchmark 32 ca | **6/6 PASS** | ~2.1s |
| `npm run test:w5-q3` | Demo, backup, restore, free tier | **7/7 PASS** | ~33s |
| `npm test` | 31 ca core Auth/RBAC/DB | **31/31 PASS** | ~10.5s |

---

## 4. Danh Sách Tệp Đã Thay Đổi và Tạo Mới

| File | Trạng thái | Mô tả |
|---|:---:|---|
| `backend/tests/w5-q4.test.js` | **[TẠO MỚI]** | 20 ca kiểm thử: review, phân loại lỗi, đối soát RC |
| `backend/package.json` | Cập nhật | Thêm script `test:w5-q4` |
| `docs/report-inputs/RELEASE_CANDIDATE_NOTES.md` | **[TẠO MỚI]** | Trạng thái RC, phân loại lỗi, checklist đóng bản, quyết định xử lý |
| `docs/report-inputs/QUANG_CONTRIBUTIONS.md` | **[TẠO MỚI]** | Đóng góp Quang theo commit/test, sơ đồ DB, bảng API, kết quả AI |
| `docs/weekly/WEEK_05_W5_Q4.md` | **[TẠO MỚI]** | Báo cáo bàn giao tuần 5 phần việc W5-Q4 |

Không thay đổi endpoint, payload, schema DB chung, hoặc file của người khác.

---

## 5. Hướng Dẫn Tự Kiểm Tra (Self-Check Steps)

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# 1. Bộ kiểm thử W5-Q4
npm run test:w5-q4

# 2. Hồi quy tổng hợp W5
node --test tests/w5-p4.test.js tests/w5-q1.test.js tests/w2-q2.test.js

# 3. Benchmark holdout W5-Q2
npm run test:w5-q2

# 4. Demo/backup/restore W5-Q3
npm run test:w5-q3

# 5. Core suite
npm test
```

**Tự kiểm review RC:**
- Đọc `docs/report-inputs/RELEASE_CANDIDATE_NOTES.md`: mỗi lỗi P1 phải có quyết định xử lý.
- Đọc `docs/report-inputs/QUANG_CONTRIBUTIONS.md`: số liệu AI phải ghi nhãn offline/evaluator-only.
- Đọc `docs/report-inputs/CHECKLIST.md`: các mục `[ ]` cần phải giải quyết trước 21/10.
- Đối soát `candidate-manifest.json` vs `verification.json`: task và baseline commit phải khớp.

---

## 6. Phần Chưa Hoàn Thành / Còn Bị Chặn

| Hạng mục | Blocker | Cần làm |
|---|---|---|
| Migration 009 bổ sung `verified_by` | Drift schema — root cause lỗi 42703 | Q3/Q4 viết `009_add_verified_by_to_achievements.sql` và chạy lại restore integration |
| storageKey containment check | P1 chưa sửa trong restore.mjs | Q3 sửa trước 21/10 |
| downloadCheck fail khi hash sai | P1 chưa sửa | Q3 sửa exit code |
| HTTP file download sau restore | Bị chặn bởi restore blocker | Unblock P1 trước |
| UI live khử định danh + ERD đối soát | Chưa chụp | Thực hiện sau restore thành công |
| URL PR remote xác minh | Chưa có URL GitHub thật | Kiểm tra và điền vào RELEASE_CANDIDATE_NOTES |

---

## 7. Trạng Thái Hiện Tại & Đề Xuất Commit

- **Trạng thái:** Phạm vi W5-Q4 hoàn thành — 20/20 test PASS, tư liệu RC đầy đủ, lỗi P1 phân loại rõ, không che giấu blocker, không tự trao thưởng.
- **Tuân thủ:** Chưa `git commit`, `git push`, hoặc `git merge`.
- **Đề xuất Commit Message:**
  ```
  feat(W5-Q4): review ket qua Phuoc, phan loai loi chan demo va dong ban ung vien
  ```
