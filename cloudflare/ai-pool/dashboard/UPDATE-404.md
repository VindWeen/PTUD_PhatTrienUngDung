# Sửa lỗi Groq 404

1. Worker → Settings → Variables and Secrets: đổi GROQ_MODEL thành
   `openai/gpt-oss-20b`, bấm Deploy. Model llama-3.1-8b-instant hiện được Groq
   đánh dấu Enterprise. 404 có thể do model không có/quyền truy cập hoặc endpoint
   sai; chưa có raw provider response thì không xác nhận tuyệt đối nguyên nhân.
2. Worker → Edit code: thay bằng toàn bộ dashboard/worker.js mới, bấm Deploy.
   Bản mới chuyển sang OpenRouter khi Groq trả 404 trong chế độ auto, không
   đánh dấu key lỗi và không thử cùng model không khả dụng qua mọi key.
3. Test lần lượt pool groq, openrouter, auto. Khi dùng groq riêng, model/endpoint
   404 trả PROVIDER_MODEL_UNAVAILABLE với upstream_status 404 để chẩn đoán.
4. Nếu Groq vẫn 404, gọi trực tiếp GET https://api.groq.com/openai/v1/models
   trong Postman với Authorization: Bearer KEY_GROQ_CUA_BAN. Chọn model ID
   có trong danh sách tài khoản. Token Worker không dùng cho endpoint Groq.

Body test gpt-oss nên dùng max_tokens 1024 vì model có thể dùng token reasoning
trước khi xuất câu trả lời. Pool cho phép max_tokens tối đa 2048.

Tài liệu: https://console.groq.com/docs/models và https://console.groq.com/docs/rate-limits.
