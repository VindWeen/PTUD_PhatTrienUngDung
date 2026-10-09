# Release Candidate Notes — W5-Q4

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W5-Q4 — Review kết quả Phước và đóng bản ứng viên  
**Ngày lập:** 09/10/2026 (Asia/Saigon)  
**Baseline:** `b0a1548` (tip w5-p4 tại thời điểm tạo nhánh w5-q4)  
**Trạng thái bản ứng viên:** `RC_OPEN — RESTORE_BLOCKED`

---

## 1. Tóm tắt trạng thái

| Hạng mục | Trạng thái | Ghi chú |
|---|:---:|---|
| Bộ test unit/hồi quy (w5-p4 + w5-q1 + w2-q2) | ✅ 13/13 PASS | `node --test` exit 0 |
| Bộ test W5-Q2 (holdout benchmark) | ✅ 6/6 PASS | 32 ca, accuracy 100%, false-eligible 0 |
| Bộ test W5-Q3 (demo + backup + restore) | ✅ 7/7 PASS | TLS, CORS, safety guard, SHA-256 |
| Bộ test W5-Q4 (review + RC checks) | ✅ 20/20 PASS | Phân loại lỗi, nhất quán manifest |
| Restore tích hợp thật (w5-p3.integration.js) | ❌ EXIT 1 | Lỗi 42703 `verified_by` — **BLOCKER P1** |
| HTTP file download sau restore | ⛔ NOT_RUN | Bị chặn bởi blocker restore |
| Remote PR xác minh | ⚠️ UNVERIFIED | Chưa có URL PR remote đã merge |
| AI accuracy LLM live | ⛔ NONE | Chỉ offline evaluator gate; không tuyên bố LLM real |
| KPI upstream | ⚠️ SIMULATED | Connector mô phỏng; ghi nhãn rõ |

---

## 2. Phân loại lỗi chặn demo

### P1 — Schema Drift: `verified_by` vắng migrations DDL

- **Mô tả:** Cột `verified_by` được tham chiếu trong `backend/src/modules/achievements/achievementRepository.js` (dòng 66, 567) nhưng **không có trong bất kỳ file** `database/migrations/*.sql` nào. Cột tồn tại trên schema live Supabase (đã tạo thủ công hoặc qua lệnh ALTER ngoài migration runner).
- **Tác động:** Khi restore schema từ migrations DDL sang DB cô lập, bảng `app.achievements` thiếu cột → lỗi `SQLSTATE 42703: column verified_by of relation achievements does not exist` → restore thất bại, toàn bộ kiểm thử HTTP sau restore bị chặn.
- **Quyết định xử lý (W5-Q4):** Ghi nhận là **lỗi P1 blocker**, phân loại rõ trong notes và test. Không bỏ cột, không ép PASS. Cần bổ sung migration thêm cột (ví dụ `009_add_verified_by_to_achievements.sql`) trước khi restore có thể nghiệm thu.
- **Kế hoạch khắc phục:** Q3/Q4 phối hợp bổ sung migration `ALTER TABLE app.achievements ADD COLUMN IF NOT EXISTS verified_by BIGINT REFERENCES app.users(user_id);` và tái chạy restore integration.

### P1 — EvidenceService JWT Fallback (đã sửa W5-P4)

- **Mô tả:** Phát hiện fallback dùng `user.roles` từ JWT khi truy vấn quyền DB lỗi → có thể hồi sinh quyền cũ đã thu hồi.
- **Trạng thái:** **Đã sửa trong W5-P4** — `evidenceService.js` truyền lỗi DB tới middleware, response không hợp lệ trả roles rỗng. Ba ca hồi quy kiểm chặn trước storage: ✅ 3/3 PASS.

### P1 — restore.mjs: storageKey path không qua resolveSafePath khi copy

- **Mô tả:** `manifest.files[].storageKey` được `path.join` trực tiếp khi copy, không qua containment check tương đương `resolveSafePath`.
- **Quyết định xử lý:** Ghi nhận P1. Cần Q3 thêm validate containment nguồn/đích trước copy, chặn absolute/traversal và symlink ra ngoài.

### P1 — restore.mjs: `downloadCheck.allPassed` không làm fail

- **Mô tả:** Script báo `allPassed` nhưng không exit non-zero khi file thiếu/hash sai.
- **Quyết định xử lý:** Ghi nhận P1. Q3 cần fail hard khi bất kỳ file nào thiếu hoặc hash sai.

### P2 — TLS `rejectUnauthorized: false`

- **Mô tả:** Kết nối Supabase mã hóa nhưng không xác minh CA/server certificate.
- **Quyết định xử lý:** Ghi giới hạn rõ. Chấp nhận trong phạm vi demo free tier; không là lỗi chặn nghiệm thu core.

### P2 — targetSchema chèn thẳng SQL trong restore

- **Mô tả:** Tên schema không qua identifier validation; DROP trước nạp.
- **Quyết định xử lý:** Tên do runner sinh random; Q3 cần validate identifier và từ chối target tồn tại trước.

---

## 3. Checklist đóng bản ứng viên 25/10

| # | Hạng mục | Đến hạn | Trạng thái |
|---|---|---|:---:|
| 1 | Bổ sung migration `verified_by` + tái chạy restore integration thật | Trước 21/10 | ⏳ |
| 2 | Q3 sửa storageKey containment check trong restore.mjs | Trước 21/10 | ⏳ |
| 3 | Q3 restore script fail hard khi file thiếu/hash sai | Trước 21/10 | ⏳ |
| 4 | Chạy HTTP owner/anonymous/outside-scope sau restore thành công | Trước 21/10 | ⏳ |
| 5 | Chụp UI live demo khử định danh; gán nhãn nguồn; đối soát ERD với migrations | Trước 21/10 | ⏳ |
| 6 | Xác minh URL PR remote (GitHub) của từng nhánh W5 | Trước 21/10 | ⏳ |
| 7 | Tái chạy `node scripts/w5-p4-freeze.mjs` sau khi đầu vào mới ổn định | Trước 25/10 | ⏳ |
| 8 | Bản ứng viên ngày 25/10: checklist này hoàn thành + link PR thật | 25/10 | ⏳ |

> **Quy tắc đóng bản:** Không thêm tính năng sau 21/10. Mỗi lỗi P1 còn lại phải có quyết định xử lý rõ ràng (sửa / ghi nhận có lý do / defer). Không dùng kết quả cũ thay cho kết quả thực sau sửa code.

---

## 4. Hướng dẫn tự kiểm (Self-Check Steps)

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# 1. Bộ kiểm thử W5-Q4 (review + RC checks)
npm run test:w5-q4

# 2. Hồi quy W5-P4 (fallback JWT + evidence scope)
node --test tests/w5-p4.test.js tests/w5-q1.test.js tests/w2-q2.test.js

# 3. Bộ kiểm thử W5-Q2 (holdout benchmark)
npm run test:w5-q2

# 4. Bộ kiểm thử W5-Q3 (demo + backup + restore)
npm run test:w5-q3

# 5. Kiểm tra toàn bộ suite core
npm test
```

---

## 5. Lỗi còn lại — quyết định xử lý

| Lỗi | Mức | Quyết định | Người thực hiện |
|---|:---:|---|---|
| `verified_by` vắng migrations DDL → restore 42703 | P1 | Cần thêm migration 009 + tái nghiệm thu restore | Q3/Q4 trước 21/10 |
| storageKey path copy không qua containment check | P1 | Cần sửa restore.mjs | Q3 trước 21/10 |
| `downloadCheck.allPassed` không fail khi sai | P1 | Cần sửa restore exit code | Q3 trước 21/10 |
| HTTP file download sau restore chưa chạy | P1 | Bị chặn bởi restore blocker → unblock P1 trên | Q3 trước 21/10 |
| TLS rejectUnauthorized:false | P2 | Ghi nhận giới hạn; chấp nhận demo free tier | Đã ghi — không sửa |
| targetSchema chèn thẳng SQL | P2 | Ghi nhận; tên do runner sinh; Q3 validate identifier | Q3 trước 21/10 |

---

*Chưa commit/push/merge. Commit đề xuất: `feat(W5-Q4): review ket qua Phuoc, phan loai loi chan demo va dong ban ung vien`*
