# NHẬT KÝ BÀN GIAO CÔNG VIỆC TUẦN 3 — PHẦN VIỆC W3-Q3

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W3-Q3: Provider adapter và thử nghiệm Groq/OpenRouter thật  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 06/10/2026  
**Nhánh thực hiện:** `w3q3` (tách từ `w3q2`)  

---

## 1. Mục tiêu và Phạm vi Đã Hoàn Thành

1. **Khởi tạo Module AI Provider Adapter (`backend/src/modules/ai/`):**
   - Thiết kế interface `AiProvider` thống nhất hỗ trợ **Groq**, **OpenRouter** và **Mock Provider** (phục vụ offline/CI).
   - Thiết lập cấu hình biến môi trường server-only trong `backend/src/config/env.js` và tài liệu mẫu `backend/.env.example`.
   - Tuyệt đối không commit key thật vào Git.

2. **Chính sách Free Tier Whitelist:**
   - Whitelist kiểm duyệt chỉ cho phép các mô hình miễn phí:
     - Groq: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `gemma2-9b-it`, `mixtral-8x7b-32768`.
     - OpenRouter: `meta-llama/llama-3.2-3b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `mistralai/mistral-7b-instruct:free`.
   - Ngăn chặn triệt để hành vi chuyển sang model trả phí thương mại (báo lỗi `AI_INVALID_FREE_MODEL`).

3. **Xử lý Giới hạn Tài nguyên & Caching:**
   - Xử lý lỗi Rate Limit 429 và truyền đạt rõ ràng `retryAfterSeconds`.
   - Khống chế thời gian chờ Timeout 504 bằng `AbortController` (mặc định 15s).
   - Xây dựng bộ đệm `AiCache` theo mã băm SHA-256 có quản lý version và TTL.
   - Ghi log usage an toàn: ghi nhận `promptTokens`, `completionTokens`, `latencyMs`, `timestamp`, `model` mà không in key ra log.

4. **Thực thi Smoke Test từ Trích đoạn Quy định Thực tế (W3-Q2):**
   - Lấy trích đoạn quy định thực tế từ cơ sở dữ liệu (`app.regulation_chunks`), ghép ngữ cảnh và thực thi smoke test thành công.
   - Đảm bảo tính trung thực: nếu dùng mock trong môi trường không có key thì gắn nhãn `isMock: true`, không dùng câu trả lời mẫu giả mạo thành kết quả AI.

5. **Đăng ký Endpoints REST API:**
   - `POST /api/v1/ai/smoke-test`: Thực hiện smoke test từ chunk quy định.
   - `POST /api/v1/ai/evaluate-criterion`: Đánh giá tiêu chuẩn khen thưởng theo nguyên tắc fail-closed.

---

## 2. Kết quả Kiểm thử Thực tế

| Bộ kiểm thử | File | Số lượng test | Kết quả |
| :--- | :--- | :--- | :--- |
| **Unit Tests & Whitelist** | `backend/tests/w3-q3.test.js` | 5 tests | **5/5 PASS (100%)** |
| **Smoke Test trên DB Chunk** | `backend/tests/w3-q3.smoke.js` | 2 tests | **2/2 PASS (100%)** |
| **Hồi quy W3-Q2** | `backend/tests/w3-q2.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Hồi quy W3-Q1** | `backend/tests/w3-q1.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Contract Validation** | `scripts/validate_contracts.mjs` | 68 kiểm tra tĩnh | **68/68 PASS (100%)** |

---

## 3. Danh sách Tệp Thay Đổi và Tạo Mới

- `backend/.env.example`
- `backend/src/config/env.js`
- `backend/src/app.js`
- `backend/src/modules/ai/aiErrors.js`
- `backend/src/modules/ai/aiProviderInterface.js`
- `backend/src/modules/ai/aiCache.js`
- `backend/src/modules/ai/aiService.js`
- `backend/src/modules/ai/aiController.js`
- `backend/src/modules/ai/aiRoutes.js`
- `backend/src/modules/ai/providers/groqProvider.js`
- `backend/src/modules/ai/providers/openrouterProvider.js`
- `backend/src/modules/ai/providers/mockProvider.js`
- `backend/src/modules/regulations/regulationRepository.js`
- `backend/tests/w3-q3.test.js`
- `backend/tests/w3-q3.smoke.js`
- `docs/api/ai-contract/PROVIDER_CONTRACT_W3_Q3.md`
- `docs/weekly/WEEK_03_W3_Q3.md`
