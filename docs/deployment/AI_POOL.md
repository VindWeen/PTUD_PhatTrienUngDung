# Kết nối backend với Cloudflare AI Pool

Thiết lập Worker theo [hướng dẫn Cloudflare](../../cloudflare/ai-pool/README.md) hoặc [hướng dẫn dashboard](../../cloudflare/ai-pool/dashboard/SETUP.md). Trong `backend/.env`, cấu hình:

```dotenv
AI_POOL_URL=https://<worker-host>
AI_POOL_TOKEN=<POOL_ACCESS_TOKEN>
AI_POOL_MODE=auto
AI_TIMEOUT_MS=35000
```

Luồng đề xuất tiêu chí từ văn bản nguồn ưu tiên adapter Pool khi có URL. `AI_POOL_MODE` nhận `auto`, `groq` hoặc `openrouter`. Worker quản lý model, quota và fallback theo cấu hình của nó. Backend kiểm header `X-AI-Provider`, model trả về và chính sách model miễn phí. Khi bỏ URL pool, đặt `AI_PROVIDER=groq` hoặc `openrouter` và cung cấp key/model cho adapter trực tiếp tương ứng.

Đối chiếu thành tích theo tiêu chí dùng bộ máy quy tắc. Trích xuất minh chứng qua vision có luồng và cấu hình provider riêng. Tiêu chí AI đề xuất từ văn bản nguồn phải được người có quyền kiểm tra trước khi công bố.

Từ `backend/`, chạy `npm test` hoặc `node --test tests/ai-pool.test.js` để kiểm adapter bằng phản hồi giả lập. Xem [regulationSources.js](../../backend/src/modules/regulationSources.js) và [poolProvider.js](../../backend/src/integrations/ai/providers/poolProvider.js).
