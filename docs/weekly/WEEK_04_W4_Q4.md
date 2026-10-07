# BÁO CÁO BÀN GIAO CÔNG VIỆC TUẦN 4 — PHẦN VIỆC W4-Q4
## REVIEW RECOMMENDER, HỘI ĐỒNG VÀ KIỂM TRA KẾT NỐI

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W4-Q4: Review recommender, Hội đồng và kiểm tra kết nối  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm:** 07/10/2026 (Asia/Saigon)  
**Nhánh thực hiện:** `w4-q4` (tách từ `origin/w4-p4`)  

---

## 1. Mục Tiêu & Bối Cảnh Thực Hiện

- **Bối cảnh kỹ thuật:** React/Vite/Tailwind, Express REST API v1 (`/api/v1`), Supabase PostgreSQL qua `pg` connection pool; hệ thống xác thực Express JWT, RBAC phân quyền và private storage giữ nguyên. Quyết định DB Supabase PostgreSQL (ADR-001) được áp dụng nhất quán.
- **Phụ thuộc:** Kế thừa đầy đủ các hợp đồng và mã nguồn từ W4-Q3, W4-P1, W4-P2, W4-P3 trên nhánh `w4-p4`. Toàn bộ 24 file migration từ W1 đến W4-P3 đã được áp dụng thành công trên Supabase PostgreSQL.
- **Phạm vi thực hiện:**
  1. Review gợi ý KPI bám tiêu chí (`recommendationService.js`) và workflow Hội đồng (`applicationService.js`).
  2. Kiểm tra và nâng cấp schema evaluator dùng chung (`buildInputSnapshot`, `inputHash` đa tiêu chí).
  3. Chạy demo E2E: RAG trích dẫn quy chế → Đánh giá tiêu chí thiếu → Gợi ý KPI thiếu → Người dùng rà soát & Chấp nhận.
  4. Lưu trữ minh chứng provider thật vs connector mô phỏng, ghi nhận và sửa toàn diện các lỗi/bất cập phát hiện trong review.

---

## 2. Các Kết Quả Đạt Được

### 2.1 Review KPI Recommender bám tiêu chí & An toàn
- Recommender chỉ trích xuất từ các tiêu chí thiếu (`isSatisfied === false`) của các phiên đánh giá hợp lệ, chưa bị stale.
- Tuyệt đối không gửi dữ liệu cá nhân hay file private tới AI Provider.
- Chỉ tiêu định lượng (`target`) và căn cứ pháp lý (`legalReferences`) bảo toàn nguyên vẹn từ văn bản quy chế LHU, không để LLM tự bịa ra con số.
- Thời hạn kế hoạch được kiểm soát qua `validatePeriod`: đối với tiêu chí tính bằng năm, kế hoạch bắt buộc phải phủ đủ số năm lịch liên tiếp.
- `automaticAwardGranted: false` luôn luôn được trả về; disclaimer nhấn mạnh kế hoạch chỉ là cơ sở phấn đấu, không hứa chắc chắn nhận danh hiệu và không tự sinh quyết định khen thưởng.

### 2.2 Review Workflow Hội đồng & Chống Tự Phê Duyệt (Anti-Self-Approval)
- Quy trình Hội đồng tuân thủ nghiêm ngặt các bước: Đơn vị đề xuất chuyển tiếp (`forward` → `COUNCIL_PENDING`) → Hội đồng phân công thẩm định viên (`assign` → `UNDER_REVIEW`) → Thẩm định viên nhận xét (`comment`) → Bỏ phiếu khuyến nghị (`recommend` → `RECOMMENDED` hoặc `not-recommend` → `NOT_RECOMMENDED`).
- Kiểm chứng hàm `noSelf()`: Cán bộ thuộc Hội đồng bị chặn 403 `FORBIDDEN` nếu cố tự nhận xét, tự đánh giá hoặc tự đề xuất hồ sơ do chính mình đứng tên hoặc đại diện.
- AI và Hội đồng không tự sinh quyết định trao thưởng; quyết định khen thưởng chính thức tách biệt trong quy trình riêng của Hội đồng Thường trực / Hiệu trưởng.

### 2.3 Nâng cấp Schema Evaluator Dùng Chung (Giải quyết dứt điểm Điểm P1)
- Khắc phục lỗ hổng được ghi nhận trong `PR_REVIEW.md` của W4-P4: `buildInputSnapshot` nay nâng cấp lên **Schema version 2**, lưu trữ đầy đủ mảng `criteria` và `documentVersions` cho tất cả các tiêu chí trong run (không chỉ còn lưu 1 tiêu chí đại diện).
- Thuật toán băm `inputHash` SHA-256 tính toán dựa trên dữ liệu nội dung của toàn bộ mảng tiêu chí, bất biến và độc lập với timestamp `snapshotDate`.
- `checkEvaluationStale` trong `aiService.js` được cập nhật để đọc mượt mà cả snapshot v1 lẫn v2, tương thích ngược 100%.

### 2.4 Bộ Kiểm Thử Tích Hợp Tự Động W4-Q4 (`w4-q4.integration.js`)
Xây dựng kịch bản kiểm thử E2E 7 ca kiểm tra toàn diện, chạy thành công 100% trên live Supabase DB:
1. `Demo E2E RAG trích dẫn quy chế thật, Evaluator thẩm định tiêu chí và lưu phiên đánh giá` (**PASS**)
2. `Demo E2E Recommender sinh gợi ý KPI bám đúng tiêu chí thiếu, không hứa danh hiệu` (**PASS**)
3. `Demo E2E Người dùng rà soát và Chấp nhận (Accept) kế hoạch KPI; lưu vào kpi_goals & ghi audit log` (**PASS**)
4. `Schema Evaluator: buildInputSnapshot hỗ trợ đa tiêu chí và tính toán hash xác định` (**PASS**)
5. `Scope Security: Chặn người dùng ngoài phạm vi can thiệp gợi ý KPI của người khác (403 FORBIDDEN)` (**PASS**)
6. `Hội đồng & Liêm chính: Quy tắc chống tự phê duyệt (Anti-Self-Approval) chặn cán bộ tự xét hồ sơ mình` (**PASS**)
7. `Hội đồng & Quy trình: Thành viên Hội đồng phân công, đánh giá & khuyến nghị khen thưởng (RECOMMENDED)` (**PASS**)

---

## 3. Lệnh và Kết Quả Kiểm Thử Thực Tế

| Bộ kiểm thử / Lệnh | Mô tả | Kết quả thực tế |
|---|---|---|
| `npm run test:w4-q4:integration` | 7 ca kiểm thử tích hợp E2E W4-Q4 | **7/7 PASS (100%)** (27.4s) |
| `npm run test:w4-q3:integration` | 5 ca tích hợp DB live AI Evaluator | **5/5 PASS (100%)** (12.3s) |
| `node --test tests/w4-p4.test.js tests/w4-q2.test.js tests/w4-p1.test.js tests/w4-q1.test.js` | 21 ca unit tests hồi quy cốt lõi | **21/21 PASS (100%)** (295ms) |
| `npm test` | 31 ca kiểm thử Auth, Scopes & DB Core | **31/31 PASS (100%)** |
| `npm run lint` (frontend) | Kiểm tra mã nguồn Frontend ESLint | **0 lỗi (PASS)** |

---

## 4. Danh Sách Tệp Đã Thay Đổi và Tạo Mới

### Mã nguồn Backend:
- `backend/src/modules/ai/criteriaEvaluator.js`: Nâng cấp `buildInputSnapshot` lên Schema v2 hỗ trợ `criteria` và `documentVersions` đa tiêu chí, tính toán `inputHash` bất biến.
- `backend/src/modules/ai/aiService.js`: Cập nhật `checkEvaluationStale` truyền đầy đủ `criteria` và `documentVersions` từ `savedSnapshot`.
- `backend/tests/w4-p3.integration.js`: Bổ sung error handler trên pg pool & client tránh unhandled ECONNRESET khi test dài qua remote Supabase pooler.
- `backend/tests/w4-q4.integration.js`: **[TẠO MỚI]** Bộ kiểm thử tích hợp tự động 7 ca cho W4-Q4.
- `backend/package.json`: Bổ sung script `"test:w4-q4:integration": "node --test tests/w4-q4.integration.js"`.

### Tài liệu Nghiệm thu & Bàn giao:
- `docs/testing/week-4/PR_REVIEW.md`: Cập nhật đánh giá toàn diện Recommender, Hội đồng và xác nhận giải quyết dứt điểm điểm P1.
- `docs/testing/week-4/DEMO_AI.md`: **[TẠO MỚI]** Tài liệu kịch bản chi tiết và payload minh chứng demo E2E.
- `docs/testing/week-4/PROVIDER_AND_CONNECTOR_EVIDENCE.md`: **[TẠO MỚI]** Bằng chứng phân biệt Provider thật vs Dữ liệu mô phỏng và bảng tổng hợp lỗi đã sửa.
- `docs/weekly/WEEK_04_W4_Q4.md`: **[TẠO MỚI]** Báo cáo bàn giao tuần 4 phần việc W4-Q4.

---

## 5. Hướng Dẫn Tự Kiểm Tra (Self-Check Steps)

Người dùng có thể tự kiểm tra nghiệm thu nhanh trên máy theo các bước sau:

1. **Chạy bộ kiểm thử tích hợp tự động W4-Q4:**
   ```powershell
   cd backend
   npm run test:w4-q4:integration
   ```
   *Kỳ vọng:* Cả 7 test cases đều hiển thị dấu tích xanh `✔ PASS` 100%.

2. **Chạy kiểm tra hồi quy W4-Q3:**
   ```powershell
   npm run test:w4-q3:integration
   ```
   *Kỳ vọng:* 5/5 test cases đạt `✔ PASS`.

3. **Chạy kiểm tra 21 ca unit tests cốt lõi:**
   ```powershell
   node --test tests/w4-p4.test.js tests/w4-q2.test.js tests/w4-p1.test.js tests/w4-q1.test.js
   ```
   *Kỳ vọng:* 21/21 test cases đạt `✔ PASS`.

4. **Kiểm tra tính an toàn liêm chính:**
   - Mở file `docs/testing/week-4/PR_REVIEW.md` và `docs/testing/week-4/DEMO_AI.md`.
   - Xác nhận: trường `automaticAwardGranted` luôn luôn là `false`.
   - Xác nhận: quy tắc `noSelf()` chặn thành viên Hội đồng tự duyệt hồ sơ của chính mình với mã lỗi 403 `FORBIDDEN`.

---

## 6. Đề Xuất Commit

- **Trạng thái Git:** Hiện tại mã nguồn và tài liệu nằm trên nhánh `w4-q4`, **chưa commit/push/merge** theo đúng yêu cầu của người dùng.
- **Thông điệp commit đề xuất:**
  ```bash
  feat(W4-Q4): review recommender council workflow and verify multi criteria evaluator connectivity
  ```
