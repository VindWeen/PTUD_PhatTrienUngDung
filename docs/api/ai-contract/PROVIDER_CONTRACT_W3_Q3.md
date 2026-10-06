# HỢP ĐỒNG KỸ THUẬT AI PROVIDER ADAPTER (W3-Q3)

**Người phụ trách:** Tạ Trần Vinh Quang (W3-Q3)  
**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Khen thưởng - Đại học Lạc Hồng (PTUD)  
**Ngày ban hành:** 06/10/2026  

---

## 1. Mục tiêu và Nguyên tắc Thiết kế

1. **Chuẩn hóa Adapter Độc lập (Provider Agnostic):**
   - Hỗ trợ linh hoạt cả **Groq** và **OpenRouter** thông qua interface `AiProvider` chuẩn hóa phía backend Express.
   - Toàn bộ API keys đều là **Server-Only** trong `backend/.env`, tuyệt đối không truyền xuống trình duyệt hoặc ghi vào Git.

2. **Chính sách Free Tier Nghiêm ngặt (Zero Paid Cost):**
   - Whitelist kiểm duyệt chặt chẽ, chỉ cho phép các mô hình miễn phí được tài khoản hỗ trợ:
     - **Groq:** `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `gemma2-9b-it`, `mixtral-8x7b-32768`.
     - **OpenRouter:** `meta-llama/llama-3.2-3b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `mistralai/mistral-7b-instruct:free`.
   - Bắt buộc kích hoạt `AiInvalidModelError` (HTTP 400) nếu phát hiện bất kỳ yêu cầu nào cố tình chuyển sang mô hình tính phí thương mại (như GPT-4o, Claude 3.5 Sonnet).

3. **Cơ chế Quản lý Tài nguyên & Độ tin cậy (Resilience):**
   - **Timeout:** Khống chế qua `AbortController` (mặc định 15.000ms), trả về `AI_REQUEST_TIMEOUT` (HTTP 504).
   - **Rate Limit (429):** Phân tích header `retry-after`, ném lỗi `AI_RATE_LIMIT_EXCEEDED` (HTTP 429) thông báo chính xác số giây cần chờ.
   - **Cache có Version:** Lưu trữ bộ đệm kết quả bằng mã băm SHA-256 của `(version + model + prompt + chunkHash)` giúp tiết kiệm quota.
   - **Logging An toàn:** Ghi nhận `tokens (prompt/completion/total)`, `latencyMs`, `model`, `timestamp` nhưng không bao giờ in key hay dữ liệu nhạy cảm ra log.

---

## 2. Đặc tả Schema Đầu vào và Đầu ra

### 2.1. Smoke Test Endpoint (`POST /api/v1/ai/smoke-test`)

**Request Body:**
```json
{
  "chunkId": 1,
  "question": "Tóm tắt nguyên tắc khen thưởng trong trích đoạn này?",
  "provider": "groq",
  "model": "llama-3.1-8b-instant"
}
```

**Response Body (200 OK):**
```json
{
  "success": true,
  "data": {
    "chunkId": 1,
    "articleNo": "Điều 3",
    "clauseNo": "Khoản 1",
    "chunkHash": "f3a1...64hex",
    "question": "Tóm tắt nguyên tắc khen thưởng...",
    "aiResponse": "Nguyên tắc khen thưởng bao gồm...",
    "model": "llama-3.1-8b-instant",
    "provider": "groq",
    "isMock": false,
    "usage": {
      "promptTokens": 142,
      "completionTokens": 86,
      "totalTokens": 228
    },
    "latencyMs": 420,
    "timestamp": "2026-10-06T14:00:28.905Z",
    "cached": false
  }
}
```

---

## 3. Cổng Kiểm soát Fail-Closed đối với Tiêu chí (Gatekeeper)

- Khi gọi phân hệ AI đánh giá (`POST /api/v1/ai/evaluate-criterion`), hệ thống bắt buộc kiểm tra cờ `is_confirmed` từ bảng `app.award_criteria_versions`:
  - **Nếu tiêu chí chưa duyệt (`is_confirmed = false`):**
    - Trường `warning` trả về: `CẢNH BÁO: Tiêu chuẩn này chưa được Hội đồng LHU phê duyệt chính thức (UNCONFIRMED / SIMULATION)`.
    - Thuộc tính `automaticAward` luôn là `false` để ngăn chặn AI tự ý đưa ra quyết định khen thưởng.
