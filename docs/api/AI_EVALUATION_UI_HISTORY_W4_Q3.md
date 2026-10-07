# TÀI LIỆU KỸ THUẬT: MÀN HÌNH ĐÁNH GIÁ VÀ LỊCH SỬ CHẠY AI (W4-Q3)
## AI EVALUATION UI, RUN HISTORY, SNAPSHOT REPRODUCTION & STALE DETECTION

**Người phụ trách:** Tạ Trần Vinh Quang (W4-Q3)  
**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU (PTUD)  
**Thời điểm ban hành:** 07/10/2026  
**Nhánh Git:** `w4-q3`  

---

## 1. Tổng quan Kiến trúc W4-Q3

Module **W4-Q3: Màn hình đánh giá và lịch sử chạy AI** hoàn thiện chu trình thẩm định hồ sơ thông minh, tích hợp toàn diện từ tầng backend (Deterministic Evaluator W4-Q1, RAG Trích dẫn W4-Q2) lên giao diện người dùng React/Vite:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (AIForecast.jsx)                       │
│  - Tab 1: Thẩm định Trực tiếp (Chọn chủ thể, tiêu chí, kỳ, provider)  │
│  - Tab 2: Lịch sử Phiên AI (Danh sách, Tái hiện Snapshot, Stale Alert) │
│  - Tab 3: 12 Hồ sơ Thử nghiệm Fixtures (Đối chiếu kỹ thuật W3-Q4)     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP REST API (/api/v1)
┌────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (aiRoutes / aiController)                   │
│  - POST /ai/evaluations/structured   -> Chạy đánh giá & lưu snapshot   │
│  - GET  /ai/evaluations/:runId       -> Đọc kết quả & tái hiện input   │
│  - GET  /ai/evaluations/:runId/stale-check -> Kiểm tra dữ liệu đổi     │
│  - GET  /ai/evaluations              -> Danh sách lịch sử theo scope   │
│  - POST /ai/rag/explain              -> Giải thích RAG & Citations     │
└────────────────────────────────────────────────────────────────────────┘
          │                                              │
          ▼                                              ▼
┌──────────────────────────────────────┐       ┌────────────────────────┐
│      Scope & RBAC Authorization      │       │   PostgreSQL / Supabase│
│  - LECTURER: Chính chủ duy nhất      │       │ - app.evaluation_runs  │
│  - MANAGER: Đơn vị trong phạm vi     │       │ - app.evaluation_      │
│  - ADMIN / OFFICER: Toàn quyền       │       │   criterion_results    │
│  - Người ngoài: 403 OUT_OF_SCOPE     │       │ - app.ai_rag_          │
└──────────────────────────────────────┘       │   explanations         │
                                               └────────────────────────┘
```

---

## 2. Các Quy tắc Nghiệm thu Bắt buộc (Acceptance Criteria)

1. **Một hồ sơ thật chạy end-to-end có lưu kết quả:**  
   Thực thi đánh giá hồ sơ giảng viên/đơn vị có trong cơ sở dữ liệu Supabase, tự động lưu `EvaluationRun` và danh sách `EvaluationCriterionResult` kèm đầy đủ `input_snapshot` và `input_hash`.
2. **Xem lại tái hiện nguyên trạng input cũ:**  
   Khi tra cứu lịch sử qua `GET /api/v1/ai/evaluations/:runId`, toàn bộ `inputSnapshot` (chủ thể, phiên bản quy chế, danh sách hồ sơ thành tích và mã băm SHA-256 các file minh chứng) được tái hiện trung thực như thời điểm chạy.
3. **Người ngoài scope không đọc nội dung AI:**  
   Bảo vệ dữ liệu nghiêm ngặt. Nếu người dùng khác cố truy cập phiên đánh giá hoặc chạy thẩm định ngoài phạm vi quyền hạn, hệ thống trả về ngay HTTP 403 Forbidden với mã lỗi chuẩn `OUT_OF_SCOPE`.
4. **Kiểm tra dữ liệu đổi (Stale Check):**  
   Hệ thống tự động so khớp `inputHash` được tính toán lại với `inputHash` đã lưu trữ trong snapshot. Khi có bất kỳ bản ghi thành tích hay khen thưởng nào được thêm/sửa/thu hồi, endpoint `/stale-check` trả về `isStale: true` và giao diện gắn nhãn cảnh báo đỏ `STALE (ĐÃ ĐỔI)`.
5. **Giữ kết quả khi AI Provider gặp lỗi/sự cố (Resilient Fallback):**  
   Nếu dịch vụ mô hình ngôn ngữ (Groq / OpenRouter) gặp lỗi mạng, quá tải (HTTP 429) hoặc timeout, kết quả thẩm định tiêu chí logic xác định từ hệ thống **vẫn được bảo toàn nguyên vẹn 100%**, đi kèm thông báo khuyến nghị Hội đồng thẩm định trực tiếp.
6. **Kết luận chỉ hỗ trợ xét duyệt:**  
   Không có cơ chế tự động trao thưởng (`automaticAwardGranted = false` luôn luôn). Banner cảnh báo pháp lý hiển thị thường trực trên giao diện.

---

## 3. Danh mục API Endpoints

### 3.1. Chạy thẩm định tiêu chí có cấu trúc
- **Endpoint:** `POST /api/v1/ai/evaluations/structured`
- **Quyền hạn:** `LECTURER` (chính chủ), `MANAGER` (trong scope đơn vị), `ADMIN`, `RECORDS_OFFICER`.
- **Request Body:**
```json
{
  "subjectType": "LECTURER",
  "subjectId": 2,
  "criteriaVersionIds": [1, 2],
  "asOfDate": "2026-10-01",
  "forcedProvider": "mock"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "runId": "bc1c4986-be7d-48f7-bb37-4342d973893c",
    "evaluationType": "CRITERION_ASSESSMENT",
    "targetSubject": { "subjectType": "LECTURER", "subjectId": 2 },
    "overallStatus": "FLAGGED_UNCONFIRMED",
    "overallConclusion": "SIMULATION_ONLY",
    "automaticAwardGranted": false,
    "inputHash": "3f98c...",
    "criterionResults": [
      {
        "criterionCode": "CSTĐCS-01",
        "thresholdMetric": { "targetMin": 3, "actualRecorded": 2, "isSatisfied": false },
        "aiAnalysis": "Hồ sơ ghi nhận 2 năm phân biệt có minh chứng hợp lệ...",
        "humanReviewRequired": false
      }
    ]
  }
}
```

### 3.2. Xem lại chi tiết phiên đánh giá & Tái hiện Snapshot
- **Endpoint:** `GET /api/v1/ai/evaluations/:runId`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "runId": "bc1c4986-be7d-48f7-bb37-4342d973893c",
    "inputSnapshot": {
      "subject": { "subjectType": "LECTURER", "subjectId": 2 },
      "criterion": { "criterionId": 1, "criterionCode": "CSTĐCS-01" },
      "records": [
        {
          "id": 10,
          "type": "ACHIEVEMENT",
          "year": 2024,
          "status": "VERIFIED",
          "file": { "id": 5, "sha256": "a1b2..." }
        }
      ]
    },
    "inputHash": "3f98c...",
    "isStale": false
  }
}
```

### 3.3. Kiểm tra tính stale của phiên đánh giá
- **Endpoint:** `GET /api/v1/ai/evaluations/:runId/stale-check`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "runId": "bc1c4986-be7d-48f7-bb37-4342d973893c",
    "isStale": true,
    "savedHash": "3f98c...",
    "currentHash": "9b12a...",
    "totalSavedRecords": 2,
    "totalCurrentRecords": 3,
    "reason": "Dữ liệu hồ sơ thành tích/khen thưởng của chủ thể đã thay đổi kể từ phiên đánh giá này"
  }
}
```

---

## 4. Tích hợp Giao diện Người dùng (Frontend Integration)

File giao diện chính: [AIForecast.jsx](file:///c:/DriveD/EverythingElse/LHU/PTUD_PhatTrienUngDung/frontend/src/pages/AIForecast.jsx)  
Service API: [aiEvaluationApi.js](file:///c:/DriveD/EverythingElse/LHU/PTUD_PhatTrienUngDung/frontend/src/services/aiEvaluationApi.js)

Các thành phần giao diện chính:
- **Thẩm định Trực tiếp (Live Tab):**
  - Tự động điền chủ thể theo thông tin đăng nhập của người dùng.
  - Tải danh mục tiêu chí đã duyệt từ kho quy chế.
  - Nút bấm chạy thẩm định AI không dùng LLM tự đếm năm.
  - Hiển thị chi tiết từng tiêu chí, badge Đạt / Chưa đạt / Cần rà soát.
  - Nút gọi RAG Service để xem giải thích trích dẫn Điều/Khoản/Trang.
  - Khu vực tái hiện snapshot và input hash.
- **Lịch sử Phiên AI (History Tab):**
  - Danh sách bảng các phiên thẩm định đã lưu.
  - Bộ lọc theo đối tượng (Giảng viên / Đơn vị).
  - Huy hiệu cảnh báo dữ liệu Stale (Đã đổi) hay Đồng nhất.
  - Nút "Xem lại hồ sơ" cho phép nạp lại toàn bộ trạng thái lịch sử.
- **12 Hồ sơ Thử nghiệm (Fixtures Tab):**
  - Giữ nguyên vẹn 12 hồ sơ mẫu fixture kỹ thuật từ W3-Q4 phục vụ kiểm tra đối chiếu.
