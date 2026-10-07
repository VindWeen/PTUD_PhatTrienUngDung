# Demo Tích Hợp AI: RAG → Gợi Ý KPI → Người Dùng Chấp Nhận Kế Hoạch (W4-Q4)

**Phụ trách thực hiện:** Tạ Trần Vinh Quang (W4-Q4)  
**Thời gian kiểm chứng:** 07/10/2026 (Asia/Saigon)  
**Môi trường:** Live Supabase PostgreSQL + Express REST API v1  
**Kịch bản kiểm thử tự động:** `backend/tests/w4-q4.integration.js` (Test 1, 2, 3)

---

## 1. Tổng quan Kịch bản E2E Demo

Kịch bản thực tế mô phỏng quy trình hoàn chỉnh của một Giảng viên (**PGS.TS. Nguyễn Văn An - `an.nv`**):
1. **Bước 1 (RAG Retrieval & Căn cứ quy chế):** Hệ thống tra cứu vector embedding cục bộ trên quy chế LHU đã xác nhận và trích xuất các điều khoản liên quan tới tiêu chuẩn nghiên cứu khoa học / thi đua.
2. **Bước 2 (Thẩm định tiêu chí - Evaluator):** Đánh giá hồ sơ hiện tại của Giảng viên qua code logic xác định (deterministic). Kết quả phát hiện tiêu chí thiếu (ví dụ: yêu cầu 10 bài báo khoa học, hiện tại mới có 4 bài đạt chuẩn `isSatisfied = false`). Phiên đánh giá được lưu vào bảng `app.evaluation_runs` với snapshot bất biến và mã băm SHA-256 (`inputHash`).
3. **Bước 3 (Sinh gợi ý KPI - Recommender):** Dựa trên tiêu chí thiếu đã được xác nhận của phiên đánh giá, AI Recommender đề xuất danh mục công việc chuẩn bị trung lập (neutral preparation checklist). AI không tự ý đặt ra con số hoặc thời hạn, không tự trao thưởng (`automaticAwardGranted = false`).
4. **Bước 4 (Người dùng rà soát & Chấp nhận kế hoạch):** Giảng viên trực tiếp xem xét, tinh chỉnh kế hoạch hành động và xác nhận thời hạn cam kết. Khi gửi hành động `accept`, hệ thống tạo mới bản ghi mục tiêu trong `app.kpi_goals` với trạng thái `ACCEPTED`, cập nhật liên kết `goal_id` trong `app.kpi_recommendations` và ghi nhận nhật ký kiểm toán (`app.audit_logs`).

---

## 2. Chi Tiết Thực Thi & Dữ Liệu Thực Tế

### Bước 1: Tra cứu RAG & Trích dẫn Quy chế LHU
**Endpoint:** `POST /api/v1/ai/rag/retrieve`  
**Quyền:** Giảng viên (`Bearer tokenAn`)  
**Request Payload:**
```json
{
  "queryText": "nghiên cứu khoa học"
}
```
**Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "isSufficient": true,
    "chunks": [
      {
        "chunkId": 1,
        "documentCode": "W4Q4-DOC-01",
        "documentTitle": "Quy định tiêu chuẩn khen thưởng nghiên cứu khoa học LHU",
        "versionNumber": "1.0",
        "articleNo": "Điều 5",
        "clauseNo": "Khoản 1",
        "content": "Giảng viên phải công bố công trình nghiên cứu khoa học trên các tạp chí chuyên ngành...",
        "similarity": 0.8245
      }
    ]
  }
}
```

---

### Bước 2: Thẩm định Tiêu chí Có Cấu trúc (Evaluator)
**Endpoint:** `POST /api/v1/ai/evaluations/structured`  
**Request Payload:**
```json
{
  "subjectType": "LECTURER",
  "subjectId": 1,
  "criteriaVersionIds": [8],
  "asOfDate": "2026-10-07"
}
```
**Response (HTTP 201 Created):**
```json
{
  "success": true,
  "data": {
    "runId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "targetSubject": {
      "subjectType": "LECTURER",
      "subjectId": 1
    },
    "overallStatus": "COMPLETED",
    "automaticAwardGranted": false,
    "inputHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "criterionResults": [
      {
        "criterionId": 8,
        "criterionCode": "W4Q4-CRIT-01",
        "criterionName": "Công bố bài báo khoa học trên tạp chí uy tín",
        "isConfirmedByLhu": true,
        "isSimulation": false,
        "thresholdMetric": {
          "targetMin": 10,
          "actualRecorded": 4,
          "unitMetric": "bài",
          "isSatisfied": false
        },
        "legalReferences": [
          {
            "documentCode": "W4Q4-DOC-01",
            "versionNumber": "1.0",
            "clauseReference": "Điều 5 Quy định NCKH LHU",
            "chunkHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          }
        ],
        "aiAnalysis": "Đánh giá tiêu chí [W4Q4-CRIT-01]: Ghi nhận 4/10 (bài). Chưa đạt ngưỡng tối thiểu.",
        "humanReviewRequired": false
      }
    ]
  }
}
```

---

### Bước 3: Recommender Sinh Gợi Ý KPI Bám Đúng Tiêu Chí Thiếu
**Endpoint:** `POST /api/v1/kpi/recommendations`  
**Request Payload:**
```json
{
  "runId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```
**Response (HTTP 201 Created):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "recommendation_id": "257761b4-5ef7-4ef0-ad84-b9954ae7ed53",
        "run_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "criterion_id": 8,
        "status": "PENDING",
        "version": 1,
        "payload": {
          "criterionCode": "W4Q4-CRIT-01",
          "title": "Công bố bài báo khoa học trên tạp chí uy tín",
          "target": 10,
          "actualRecorded": 4,
          "measureUnit": "bài",
          "plan": "Rà soát kế hoạch giảng dạy, chủ động đăng ký đề tài NCKH cấp cơ sở và nộp minh chứng đúng hạn.",
          "periodStart": "2026-10-07",
          "periodEnd": "2027-12-31",
          "assumptions": [
            "Chỉ tiêu là tổng yêu cầu, không phải số còn thiếu.",
            "Kế hoạch không xác nhận thành tích hoặc tự trao thưởng.",
            "Thời hạn gợi ý là giả định lập kế hoạch: đến cuối năm sau cho chỉ tiêu số lượng, hoặc đủ số năm lịch từ năm sau cho chỉ tiêu năm. Người dùng phải rà soát thời hạn/cửa sổ theo căn cứ; không thay đổi điều kiện của tiêu chí."
          ]
        },
        "provider_evidence": {
          "provider": "openrouter",
          "model": "deepseek/deepseek-chat",
          "isMock": false,
          "usage": { "promptTokens": 35, "completionTokens": 42, "totalTokens": 77 },
          "latencyMs": 310,
          "timestamp": "2026-10-07T14:49:03.000Z",
          "cached": false
        }
      }
    ],
    "automaticAwardGranted": false
  }
}
```

---

### Bước 4: Người Dùng Rà Soát & Chấp Nhận (Accept) Kế Hoạch
**Endpoint:** `POST /api/v1/kpi/recommendations/257761b4-5ef7-4ef0-ad84-b9954ae7ed53/decision`  
**Request Payload:**
```json
{
  "version": 1,
  "action": "accept",
  "edits": {
    "plan": "Kế hoạch cá nhân: Hoàn thành các bài báo NCKH trên tạp chí chuyên ngành đúng hạn năm học 2026-2027",
    "periodStart": "2026-10-07",
    "periodEnd": "2027-12-31"
  }
}
```
**Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "recommendation_id": "257761b4-5ef7-4ef0-ad84-b9954ae7ed53",
      "status": "ACCEPTED",
      "goal_id": 1,
      "version": 2
    },
    "goal": {
      "goal_id": 1,
      "code": "AI-257761B4-5EF7-4EF0-AD84-B9954AE7ED53",
      "title": "Công bố bài báo khoa học trên tạp chí uy tín",
      "measure_unit": "bài",
      "target": "10",
      "plan": "Kế hoạch cá nhân: Hoàn thành các bài báo NCKH trên tạp chí chuyên ngành đúng hạn năm học 2026-2027",
      "status": "ACCEPTED",
      "accepted_by": 1,
      "accepted_at": "2026-10-07T14:49:07.133Z"
    },
    "automaticAwardGranted": false
  }
}
```

**Bản ghi Audit Log được tạo tự động:**
- `action`: `KPI_RECOMMENDATION_ACCEPT`
- `entity_name`: `kpi_recommendations`
- `user_id`: `1` (an.nv)
- `new_values`: Lưu toàn bộ snapshot trạng thái sau chấp nhận và `goal_id`.

---

## 3. Các Rào Cản An Toàn Đã Được Kiểm Chứng

1. **AI không tự duyệt hồ sơ / phong thưởng:** `automaticAwardGranted: false` ở mọi cấp độ.
2. **Không hứa chắc chắn nhận danh hiệu:** Chỉ tiêu là mục tiêu phấn đấu, ngôn ngữ cam kết trung lập, disclaimer nêu rõ không tương đương với quyết định khen thưởng.
3. **Chống can thiệp trái phép (Scope Security):** Tài khoản khác không có quyền can thiệp vào gợi ý hoặc quyết định của Giảng viên (HTTP 403 `FORBIDDEN`).
4. **Kiểm soát tính toàn vẹn (Stale Detection):** Nếu hồ sơ nền tảng có phát sinh mới làm sai lệch hiện trạng, phiên đánh giá lập tức bị đánh dấu `isStale = true` và ngăn chặn việc sinh gợi ý trên dữ liệu cũ.
