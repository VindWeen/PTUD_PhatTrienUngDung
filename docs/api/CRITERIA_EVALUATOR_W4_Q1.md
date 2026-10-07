# TÀI LIỆU KỸ THUẬT: BỘ KIỂM TRA TIÊU CHÍ CÓ CẤU TRÚC (W4-Q1)
## STRUCTURED CRITERIA EVALUATOR & EVALUATION RUNS PERSISTENCE

**Người phụ trách:** Tạ Trần Vinh Quang (W4-Q1)  
**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU (PTUD)  
**Thời điểm ban hành:** 07/10/2026  
**Nhánh Git:** `w4-q1`  

---

## 1. Mục tiêu và Nguyên tắc Cốt lõi

Phân hệ **Bộ kiểm tra tiêu chí có cấu trúc (Structured Criteria Evaluator)** xử lý các bài toán thẩm định điều kiện khen thưởng theo thuật toán xác định (deterministic code), hoàn toàn độc lập với mô hình ngôn ngữ lớn (LLM):
1. **Tuyệt đối không dùng LLM để tự đếm năm**: Việc đếm năm phân biệt, kiểm tra chuỗi năm liên tiếp và ngưỡng số lượng hoàn toàn do mã nguồn logic kiểm soát.
2. **Loại trừ hồ sơ thu hồi (Fail-Safe Revocation)**: Mọi hồ sơ có trạng thái `REVOKED`, `CANCELLED`, hoặc đã bị thay thế bị loại bỏ ngay lập tức khỏi tập thành tích hợp lệ.
3. **Thiếu chứng cứ không mặc định không đạt (Human-Review Gatekeeper)**: Nếu hồ sơ thiếu chứng cứ hoặc mã băm không khớp, hệ thống không được đánh rớt `INELIGIBLE` mà phải trả trạng thái `NEEDS_HUMAN_REVIEW` để bảo đảm quyền lợi của người nộp.
4. **Không có đường tự động trao thưởng (Zero Auto-Award)**: Thuộc tính `automaticAwardGranted` luôn luôn là `false`. Kết quả đánh giá chỉ mang tính hỗ trợ ra quyết định.
5. **Lưu trữ phiên đánh giá bất biến kèm Snapshot đầu vào**: Lưu vào bảng `app.evaluation_runs` và `app.evaluation_criterion_results` kèm `input_snapshot` và mã băm `input_hash` (SHA-256) để bảo đảm tính tái hiện và phát hiện dữ liệu cũ (stale).

---

## 2. Cấu trúc Cơ sở Dữ liệu (Supabase PostgreSQL Migration 020)

### 2.1. Bảng `app.evaluation_runs`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `run_id` | `UUID` | PRIMARY KEY | Định danh phiên đánh giá |
| `evaluation_type` | `VARCHAR(50)` | CHECK IN (...) | `CRITERION_ASSESSMENT`, `KPI_VERIFICATION`, `BATCH_BENCHMARK` |
| `subject_type` | `VARCHAR(20)` | CHECK IN ('LECTURER', 'UNIT') | Loại chủ thể |
| `subject_id` | `BIGINT` | NOT NULL | ID giảng viên hoặc đơn vị |
| `achievement_id` | `BIGINT` | REFERENCES app.achievements | ID thành tích (nếu đánh giá theo hồ sơ) |
| `application_id` | `BIGINT` | REFERENCES app.award_applications | ID hồ sơ xét thưởng (nếu có) |
| `provider` | `VARCHAR(50)` | NOT NULL | Provider (`mock`, `groq`, `openrouter`) |
| `model` | `VARCHAR(100)` | NOT NULL | Tên model phục vụ |
| `is_mock` | `BOOLEAN` | DEFAULT FALSE | Cờ đánh dấu mock provider |
| `overall_status` | `VARCHAR(50)` | CHECK IN (...) | `COMPLETED`, `FLAGGED_UNCONFIRMED`, `FAILED` |
| `overall_conclusion` | `VARCHAR(50)` | CHECK IN (...) | `ELIGIBLE`, `INELIGIBLE`, `NEEDS_HUMAN_REVIEW`, `SIMULATION_ONLY` |
| `automatic_award_granted` | `BOOLEAN` | CHECK (= FALSE) | Luôn luôn là FALSE |
| `input_snapshot` | `JSONB` | NOT NULL | Toàn bộ dữ liệu snapshot đầu vào |
| `input_hash` | `VARCHAR(64)` | NOT NULL | SHA-256 hash của snapshot |
| `is_stale` | `BOOLEAN` | DEFAULT FALSE | Cờ đánh dấu dữ liệu đã bị biến đổi |
| `executed_by` | `BIGINT` | REFERENCES app.users | Người thực thi phiên đánh giá |
| `executed_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm thực thi |

### 2.2. Bảng `app.evaluation_criterion_results`
| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `result_id` | `BIGINT` | PRIMARY KEY IDENTITY | ID kết quả tiêu chí |
| `run_id` | `UUID` | REFERENCES app.evaluation_runs | Khóa ngoại phiên đánh giá |
| `criterion_id` | `BIGINT` | REFERENCES app.award_criteria_versions | Khóa ngoại tiêu chí quy định |
| `criterion_code` | `VARCHAR(50)` | NOT NULL | Mã tiêu chí (VD: `LHU-CSTT-01`, `SIM-KPI-01`) |
| `is_confirmed_by_lhu` | `BOOLEAN` | NOT NULL | Trạng thái phê duyệt LHU |
| `is_simulation` | `BOOLEAN` | NOT NULL | Cờ mô phỏng |
| `target_min` | `NUMERIC(10,2)` | NULLABLE | Ngưỡng tối thiểu yêu cầu |
| `actual_recorded` | `NUMERIC(10,2)` | NULLABLE | Giá trị / số năm thực tế đạt được |
| `is_satisfied` | `VARCHAR(20)` | NOT NULL | `'true'`, `'false'`, `'UNCONFIRMED'` |
| `distinct_years` | `INT` | NULLABLE | Số năm phân biệt ghi nhận |
| `consecutive_years` | `BOOLEAN` | NULLABLE | Tính liên tiếp của chuỗi năm |
| `ai_analysis` | `TEXT` | NOT NULL | Nhận định logic chi tiết |
| `human_review_required` | `BOOLEAN` | DEFAULT TRUE | Cờ bắt buộc chuyên viên duyệt lại |

---

## 3. Danh sách REST Endpoints

1. **`POST /api/v1/ai/evaluations/structured`**
   - **Xác thực:** Bearer Token (JWT).
   - **Phân quyền:** Giảng viên chỉ được đánh giá chính mình; Manager đánh giá trong scope CTE; Admin đánh giá toàn trường.
   - **Payload mẫu:**
     ```json
     {
       "subjectType": "LECTURER",
       "subjectId": 1,
       "criteriaVersionIds": [1, 2],
       "asOfDate": "2026-10-07"
     }
     ```
   - **Mã phản hồi:** `201 Created` kèm thực thể `EvaluationRun`.

2. **`GET /api/v1/ai/evaluations/:runId`**
   - **Mô tả:** Lấy chi tiết phiên đánh giá và tái hiện lại `inputSnapshot`.
   - **Bảo mật:** Kiểm tra chặt chẽ Scope. Người ngoài scope bị từ chối `403 OUT_OF_SCOPE`.

3. **`GET /api/v1/ai/evaluations`**
   - **Mô tả:** Lấy danh sách lịch sử đánh giá theo chủ thể (hỗ trợ phân trang).
