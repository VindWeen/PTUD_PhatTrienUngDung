# W4-P4 & W4-Q4 — Báo cáo Review PR và Hệ Thống Tuần 4

**Người thực hiện Review:** Tạ Trần Vinh Quang (Phụ trách W4-Q4: Review recommender, Hội đồng và kiểm tra kết nối)
**Phối hợp với:** Võ Nhạc Phước (W4-P4: Review Validator & UI AI)
**Phạm vi:** Toàn bộ các module tuần 4 gồm W4-Q1 (Tiêu chí cấu trúc), W4-Q2 (RAG & Citations), W4-Q3 (Tích hợp AI & Lịch sử), W4-P1 (KPI Recommender), W4-P2 (External KPI Connector), W4-P3 (Quy trình Hội đồng xét duyệt), W4-P4 (UI Validator), W4-Q4 (Review Recommender, Hội đồng & Kiểm tra kết nối).

---

## 1. Đánh giá KPI Recommender (W4-P1 & W4-Q4)

### 1.1 Tính bám sát tiêu chí và căn cứ pháp lý
- **Cơ chế hoạt động:** `recommendationService.generate` chỉ sinh gợi ý từ các tiêu chí thiếu (`c.thresholdMetric.isSatisfied === false`) thuộc phiên thẩm định hợp lệ (`overallStatus === 'COMPLETED'`, `isStale === false`).
- **Nguyên tắc dữ liệu sạch:** Tuyệt đối không gửi thông tin định danh cá nhân, tệp đính kèm riêng tư hoặc dữ liệu bí mật tới AI Provider. Chỉ gửi tên tiêu chí và đơn vị đo để sinh danh mục công việc chuẩn bị (preparation checklist).
- **Chỉ tiêu định lượng & Thời hạn:** Số lượng chỉ tiêu (`target`) và căn cứ pháp lý (`legalReferences`) được giữ nguyên bản từ quy chế LHU đã xác nhận, không cho phép LLM tự bịa ra con số hoặc thời hạn.
- **Ràng buộc thời hạn:** Hàm `validatePeriod` bắt buộc kế hoạch phải bao phủ đủ số năm lịch liên tục đối với các tiêu chí tính bằng năm, không cho phép biến điều kiện nhiều năm thành mục tiêu 1 năm.

### 1.2 Nguyên tắc liêm chính & Chống tự trao thưởng
- **Không tự trao thưởng:** Cả API tạo gợi ý lẫn API ra quyết định (`decide`) đều trả về trường bất biến `automaticAwardGranted = false`.
- **Ngôn ngữ khuyến nghị:** Bản kế hoạch gắn kèm các giả định bắt buộc (`assumptions`):
  1. Chỉ tiêu là tổng yêu cầu phấn đấu, không phải số lượng còn thiếu.
  2. Kế hoạch không xác nhận thành tích quá khứ và không tự động trao thưởng hay hứa chắc chắn đạt danh hiệu.
  3. Thời hạn mang tính chất giả định kế hoạch, người dùng phải tự rà soát theo quy chế thực tế.
- **Quyền quyết định thuộc về con người:** Kế hoạch chỉ được chuyển thành mục tiêu trong `app.kpi_goals` khi người dùng đích thân rà soát, chỉnh sửa kế hoạch hành động và bấm **Chấp nhận** (`POST /api/v1/kpi/recommendations/:id/decision` action: `accept`). Mọi quyết định đều được ghi nhận Audit Log.

---

## 2. Đánh giá Quy trình Hội đồng (Council Workflow - W4-P3 & W4-Q4)

### 2.1 Quy trình phân công & Bỏ phiếu
- **Trạng thái chuyển đổi chặt chẽ:** Hồ sơ đề xuất khen thưởng sau khi được Đơn vị cơ sở chuyển tiếp (`forward`) sẽ mang trạng thái `COUNCIL_PENDING`.
- **Phân công thẩm định viên (`assign`):** Thành viên Hội đồng có thẩm quyền chỉ định thẩm định viên (`reviewerId`), hồ sơ chuyển sang trạng thái `UNDER_REVIEW`.
- **Nhận xét & Đề xuất (`comment` & `recommend`):** Chỉ thẩm định viên đã được phân công chính thức trong bảng `app.application_reviews` mới được quyền ghi nhận xét hoặc đề xuất khuyến nghị.
- **Không tự cấp thưởng:** Hội đồng chỉ biểu quyết khuyến nghị (`RECOMMENDED` hoặc `NOT_RECOMMENDED`). Quyết định khen thưởng chính thức (`app.award_decisions`) và sổ lưu trữ (`app.award_records`) tách biệt hoàn toàn, thuộc thẩm quyền ký duyệt của Hội đồng Thường trực / Hiệu trưởng.

### 2.2 Quy tắc Liêm chính - Chống tự phê duyệt (Anti-Self-Approval)
- **Hàm kiểm soát `noSelf()`:** Ngăn chặn triệt để mọi hành vi xung đột lợi ích:
  ```javascript
  // Trích đoạn từ applicationService.js
  const own = (await c.query(`
    SELECT 1 FROM app.lecturers WHERE lecturer_id=$1 AND user_id=$2
    UNION ALL SELECT 1 FROM app.award_application_inputs WHERE application_id=$3 AND submitted_by=$2
    UNION ALL SELECT 1 FROM app.application_review_comments WHERE application_id=$3 AND actor_id=$2 AND action='resubmit'
  `, [r.lecturer_id, user.userId, r.application_id])).rows.length;
  if (own || representative || String(r.created_by) === String(user.userId))
    throw new ForbiddenError("Không tự xét hồ sơ cá nhân hoặc tập thể mình đại diện");
  ```
- **Kiểm chứng thực tế:** Ca kiểm thử số 6 trong `w4-q4.integration.js` chứng minh Giảng viên An dù được cấp tạm quyền Hội đồng cũng bị chặn đứng với mã lỗi 403 `FORBIDDEN` khi cố tự nhận xét hồ sơ của chính mình.

---

## 3. Đánh giá Schema Evaluator Dùng Chung & Giải Quyết Điểm P1

### 3.1 Khắc phục tồn đọng P1 từ bản review W4-P4
- **Vấn đề tồn đọng cũ (ghi nhận ở W4-P4):** Hàm `buildInputSnapshot` trong `criteriaEvaluator.js` trước đây chỉ nhận và lưu 1 tiêu chí đại diện (`primaryCrit`), dẫn đến việc khi đánh giá gói đa tiêu chí thì các tiêu chí thứ 2 trở đi không được lưu hash và metadata đầy đủ trong snapshot.
- **Giải pháp W4-Q4:**
  - Nâng cấp `buildInputSnapshot` lên **Schema version 2**:
    ```javascript
    snapshot = {
      schemaVersion: 2,
      snapshotDate,
      asOfDate,
      subject,
      criterion: primaryCrit, // Giữ tương thích ngược với Schema v1
      documentVersion: primaryDoc,
      criteria: allCriteria, // Mảng đầy đủ toàn bộ tiêu chí trong run
      documentVersions: allDocVersions, // Mảng đầy đủ toàn bộ phiên bản văn bản
      records: normalizedRecords,
    }
    ```
  - Tính toán `inputHash` bảo vệ toàn vẹn bằng SHA-256 dựa trên toàn bộ dữ liệu nội dung của `criteria` và `documentVersions`, không phụ thuộc vào timestamp tạo `snapshotDate`.
  - Cập nhật `checkEvaluationStale` trong `aiService.js` để đọc cả snapshot v1 và snapshot v2, đảm bảo tương thích 100%.

---

## 4. Bảng Tổng Hợp Kiểm Thử & Nghiệm Thu

| Bộ kiểm thử | Số ca kiểm tra | Kết quả | Ghi chú |
|---|---|---|---|
| `backend/tests/w4-q4.integration.js` | 7 ca kiểm tra HTTP & DB | **7/7 PASS (100%)** | E2E Demo, Schema v2, Scope Security, Anti-Self-Approval, Council Recommendation |
| `backend/tests/w4-q3.integration.js` | 5 ca tích hợp DB live | **5/5 PASS (100%)** | E2E Run & Save, Snapshot Reproduction, Scope Security, Stale Check, Resilient Provider |
| `backend/tests/w4-p1.integration.js` | 28 assertions DB | **28/28 PASS (100%)** | Recommender generation, validation, decision, optimistic lock, audit log |
| `backend/tests/w4-p2.integration.js` | 43 assertions DB | **43/43 PASS (100%)** | External KPI connector, mappings, sync runs, draft achievements |
| `backend/tests/w4-p4.test.js` | 5 ca unit test | **5/5 PASS (100%)** | Citation validation, quota fallback, unauthorized run rejection |
| `backend/tests/w4-q2.test.js` | 5 ca unit test | **5/5 PASS (100%)** | Local embedding, cosine similarity, citation extraction, prompt injection defense |
| `backend/tests/w4-q1.test.js` | 6 ca unit test | **6/6 PASS (100%)** | Deterministic year counting, gap detection, revoked exclusion, missing evidence review |
| `frontend` (lint) | ESLint toàn bộ src | **PASS (0 errors)** | Không có lỗi cú pháp hoặc vi phạm linting |

---

## 5. Kết luận Review

- **Trạng thái:** ĐỦ ĐIỀU KIỆN NGHIỆM THU TÍCH HỢP TUẦN 4.
- **Khuyến nghị:**
  1. Toàn bộ mã nguồn W4-Q1 -> Q4 và W4-P1 -> P4 đã hoạt động đồng bộ và đạt chuẩn 100% các tiêu chí an toàn (không tự trao thưởng, không hứa danh hiệu, phân biệt rõ provider thật và mô phỏng).
  2. Sẵn sàng tạo commit với thông điệp: `feat(W4-Q4): review recommender council workflow and verify multi criteria evaluator connectivity`.
