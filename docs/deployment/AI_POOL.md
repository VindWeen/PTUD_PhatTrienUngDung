# Kết nối backend với Cloudflare AI pool

Worker hiện tại: `https://ai-pool.fw62262.workers.dev`.

Điền backend/.env:

```dotenv
AI_POOL_URL=https://ai-pool.fw62262.workers.dev
AI_POOL_TOKEN=<POOL_ACCESS_TOKEN trên Worker>
AI_POOL_MODE=auto
AI_TIMEOUT_MS=35000
AI_MAX_RETRIES=0
AI_CACHE_ENABLED=true
```

Khởi động lại backend. Có URL pool thì các lời gọi AI thật dùng Worker; thiếu
token/lỗi Worker trả lỗi dịch vụ, không tự rơi về mock hoặc key direct cũ.
Chế độ mock chỉ dùng khi được chọn rõ ràng. Khi không cấu hình URL pool, adapter
direct cũ vẫn dùng được với GROQ_API_KEY/OPENROUTER_API_KEY.

`auto` ưu tiên Groq rồi fallback OpenRouter ở Worker. API AI và gợi ý KPI chấp
nhận provider `auto`, `groq`, `openrouter`. Trang AI mặc định Tự động, vẫn có
lựa chọn provider riêng và mock. Đánh giá tiêu chí có cấu trúc vẫn là evaluator
bằng quy tắc; gọi LLM chỉ cho những chức năng giải thích/gợi ý đã có trong app.

Model được cấu hình trên Worker, không gửi trường `model` vào API backend khi
dùng pool. Backend xác nhận provider thực tế bằng X-AI-Provider và model thực tế
bằng response.model, rồi kiểm tra chính sách model free trước khi lưu cache.
Không chuyển trường reasoning ra UI. Cache tách theo pool mode, URL/token gateway,
prompt, nguồn và version. TTL mặc định 1 giờ; sau khi đổi model trên Worker,
khởi động lại backend để không dùng câu trả lời cũ trong cache.

Backend dành tối thiểu 35 giây cho Worker và không retry lại chuỗi gọi pool.
Worker vẫn có thời hạn upstream 25 giây. Không bảo đảm thử hết key khi upstream
chậm. Các pool dùng chung quota thực tế theo quy định nhà cung cấp.

Kiểm tra giả lập adapter, không dùng key thật:

```powershell
cd backend
npm run test:ai-pool
```

Setup dashboard: [hướng dẫn](../../cloudflare/ai-pool/dashboard/SETUP.md).
