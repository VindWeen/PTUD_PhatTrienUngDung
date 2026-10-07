# NHẬT KÝ BÀN GIAO CÔNG VIỆC TUẦN 4 — PHẦN VIỆC W4-Q1

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W4-Q1: Bộ kiểm tra tiêu chí có cấu trúc  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 07/10/2026  
**Nhánh thực hiện:** `w4-q1`  

---

## 1. Mục tiêu và Phạm vi Đã Hoàn Thành

1. **Bộ kiểm tra tiêu chí xác định (Deterministic Criteria Evaluator):**
   - Xây dựng module `backend/src/modules/ai/criteriaEvaluator.js`.
   - Xử lý các tiêu chuẩn số lượng, năm phân biệt (`distinctYears`), chuỗi năm liên tiếp (`consecutiveYears`), và cửa sổ hiệu lực (`timeWindow` / `effective_from` -> `effective_to`) hoàn toàn bằng code xác định, tuyệt đối không dùng LLM để tự đếm năm.

2. **Quy tắc Nghiệm thu & Liêm chính Học thuật:**
   - **Loại hồ sơ thu hồi:** Hồ sơ `REVOKED`, `CANCELLED` hoặc đã có bản thay thế bị loại khỏi tập tính toán.
   - **Thiếu chứng cứ không mặc định không đạt:** Nếu hồ sơ thiếu file minh chứng hoặc hash không khớp, hệ thống đánh dấu `NEEDS_HUMAN_REVIEW` và `humanReviewRequired: true`, tuyệt đối không tự ý đánh rớt `INELIGIBLE`.
   - **Không tự động trao thưởng:** Cấm mọi đường tự phong tặng danh hiệu (`automaticAwardGranted: false` luôn luôn).
   - **Cổng phê duyệt LHU Fail-Closed:** Tiêu chí mô phỏng hoặc chưa duyệt LHU luôn trả `SIMULATION_ONLY` hoặc `UNCONFIRMED`.

3. **Lưu trữ CSDL (Supabase PostgreSQL):**
   - Migration `20261007000020_w4_q1_evaluation_runs.sql` tạo 2 bảng: `app.evaluation_runs` và `app.evaluation_criterion_results`.
   - Thu hồi toàn bộ quyền Data API trực tiếp của `anon` và `authenticated`.
   - Lưu trữ đầy đủ `input_snapshot` và `input_hash` (SHA-256) phục vụ tái hiện phiên đánh giá cũ và phát hiện dữ liệu cũ (stale).

4. **REST API & Kiểm soát Phạm vi (Scope Guards):**
   - Đăng ký `POST /api/v1/ai/evaluations/structured`, `GET /api/v1/ai/evaluations/:runId`, `GET /api/v1/ai/evaluations`.
   - Giảng viên chỉ xem được của chính mình; Manager kiểm tra theo cây đơn vị CTE; người ngoài scope bị chặn `403 OUT_OF_SCOPE`.

---

## 2. Kết quả Kiểm thử Thực tế

| Bộ kiểm thử | File | Số lượng test | Kết quả |
| :--- | :--- | :--- | :--- |
| **Unit Tests W4-Q1** | `backend/tests/w4-q1.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Integration Live DB W4-Q1** | `backend/tests/w4-q1.integration.js` | 5 tests | **5/5 PASS (100%)** |
| **Hồi quy 12 Ca Bắt buộc** | `backend/tests/w3-q4.mandatory12.js` | 12 tests | **12/12 PASS (100%)** |
| **Hồi quy W3-P4 AI Fixtures** | `backend/tests/w3-p4.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Hồi quy W3-Q3 Smoke** | `backend/tests/w3-q3.smoke.js` | 2 tests | **2/2 PASS (100%)** |
| **Toàn bộ Test Runner** | `backend/tests/runner.js` | 31 tests | **31/31 PASS (100%)** |

---

## 3. Danh sách Tệp Thay Đổi và Tạo Mới

- `supabase/migrations/20261007000020_w4_q1_evaluation_runs.sql`
- `backend/src/modules/ai/criteriaEvaluator.js`
- `backend/src/modules/ai/evaluationRepository.js`
- `backend/src/modules/ai/evaluationSchemas.js`
- `backend/src/modules/ai/aiService.js`
- `backend/src/modules/ai/aiController.js`
- `backend/src/modules/ai/aiRoutes.js`
- `backend/tests/w4-q1.test.js`
- `backend/tests/w4-q1.integration.js`
- `backend/package.json`
- `docs/api/CRITERIA_EVALUATOR_W4_Q1.md`
- `docs/weekly/WEEK_04_W4_Q1.md`
