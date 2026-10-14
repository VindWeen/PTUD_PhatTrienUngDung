# Setup hoàn toàn bằng Cloudflare dashboard

Đây là bản Worker + D1, độc lập với bản Wrangler + Durable Objects ở thư mục cha.
Dùng `dashboard/worker.js` khi dán code. Không dán bản `src/worker.js` cho setup này.
Không cần chạy npm, Wrangler hoặc kết nối GitHub.

## 1. Tạo Worker

Đăng nhập https://dash.cloudflare.com và chọn account.
Vào Workers & Pages → Create application → Create Worker / Start with Hello World
(tên nút có thể khác theo giao diện). Đặt tên `lhu-ai-pool`, bấm Deploy.
Nếu đã có Worker cùng tên thì mở Worker đó.
Giữ lại URL `https://lhu-ai-pool.<subdomain>.workers.dev`.

## 2. Tạo D1 database và bảng

Vào Storage & databases → D1 → Create database, đặt tên `lhu-ai-pool-state`.
Mở database vừa tạo → Console. Copy nội dung `schema.sql` vào ô SQL và chạy.
Nếu Console chỉ cho chạy một statement, chạy riêng từng CREATE TABLE.
Database chỉ chứa trạng thái pool và hash key, không chứa API key thật/prompt.

## 3. Nối database vào Worker

Mở Worker `lhu-ai-pool` → Bindings → Add binding → D1 database.
Variable name phải là `DB` (viết hoa). Chọn database `lhu-ai-pool-state`.
Save/Deploy thay đổi nếu giao diện yêu cầu.

## 4. Thêm biến và Secrets

Worker → Settings → Variables and Secrets → Add.

| Tên | Loại | Giá trị lúc setup |
|---|---|---|
| POOL_ACCESS_TOKEN | Secret | Token ngẫu nhiên dài do bạn tạo, giữ lại để backend dùng |
| GROQ_KEYS | Secret | `[]` |
| OPENROUTER_KEYS | Secret | `[]` |
| GROQ_MODEL | Text | `openai/gpt-oss-20b` |
| OPENROUTER_MODEL | Text | `openrouter/free` |

Nhấn Deploy để áp dụng. Sau này sửa GROQ_KEYS thành `["key1","key2"]`,
tương tự OPENROUTER_KEYS. Không ghi key vào code hoặc database.
Token truy cập pool khác key provider và Cloudflare API token.

## 5. Dán code Worker

Worker → Edit code. Mở file JavaScript chính trong editor.
Xóa code mẫu, dán toàn bộ nội dung `dashboard/worker.js`, rồi Deploy.
File này không có dependency/import nên có thể dán trực tiếp.

## 6. Kiểm tra bằng browser và editor HTTP

Mở URL Worker thêm `/health`: cần trả `ok: true`.
Trong panel test HTTP của editor (nếu có), gửi GET `/status`, kèm header:

```
Authorization: Bearer TOKEN_CUA_BAN
```

Kết quả cần có `database: "ready"` và configured_keys groq/openrouter đều là 0.
Nếu editor chỉ có preview browser và không có ô custom headers, dùng công cụ API
như Postman để GET URL `/status` với header trên. Không cần CLI để deploy.
Mở `/status` bằng browser thường sẽ nhận 401 vì chưa có header token.

## 7. Sau khi thêm key

Gửi POST `<URL_WORKER>/v1/chat/completions` với các headers:

```
Authorization: Bearer TOKEN_CUA_BAN
Content-Type: application/json
```

Body:

```json
{
  "pool": "auto",
  "messages": [{ "role": "user", "content": "Chao ban, tra loi mot cau ngan." }],
  "max_tokens": 128
}
```

`groq` hoặc `openrouter` chỉ dùng pool chỉ định; `auto` ưu tiên Groq rồi OpenRouter.
Model đặt riêng trên Worker. Header X-AI-Provider cho biết provider phục vụ thành công.
Chưa có key thì completions trả 503; không dùng mock hoặc tự chuyển sang trả phí.

## Giới hạn

- D1 cập nhật con trỏ bằng SQL atomic. Hai pool dùng chung database nhưng có trạng thái riêng.
- Những request đã bắt đầu gọi upstream trước khi một key bị ghi cooldown vẫn có thể nhận 429.
- 429 cooldown theo Retry-After, thiếu header thì 60 giây; không theo dõi chính xác quota ngày.
- 401/403 vô hiệu hóa key (hash) đến khi thay key mới. Có thể reset trạng thái bằng
  `DELETE FROM key_states WHERE provider = 'groq';` trên database dành riêng cho pool này.
- Timeout/lỗi mạng/408/500/502/503/504 cooldown 15 giây rồi thử key khác.
- 404: pool trả PROVIDER_MODEL_UNAVAILABLE; auto chuyển provider ngay, không vô hiệu hóa key.
- Tối đa 10 lần thử/pool, tổng thời gian upstream tối đa 25 giây; auto dành tối đa
  12 giây cho Groq. Có thể chuyển pool trước khi thử hết key nếu hết thời gian.
- Bản này chỉ chuyển messages/max_tokens/temperature; chưa hỗ trợ streaming/tools.
- Worker/D1 có quota Free riêng. Pool không đảm bảo cộng quota nhiều tài khoản provider.
- Backend đã có adapter Worker: điền AI_POOL_URL, AI_POOL_TOKEN và AI_POOL_MODE
  trong backend/.env rồi khởi động lại backend. Token chỉ được giữ phía backend;
  không gọi endpoint này trực tiếp từ frontend. Model đặt trên Worker; bỏ trường
  model khỏi request API backend khi dùng pool. Sau khi đổi model trên Worker,
  khởi động lại backend để xóa cache câu trả lời cũ (TTL mặc định 1 giờ).

## Xử lý lỗi

| Kết quả | Kiểm tra |
|---|---|
| `/health` 404 | Đã Deploy đúng code/URL chưa |
| 401 | Header Bearer và POOL_ACCESS_TOKEN |
| ACCESS_TOKEN_NOT_CONFIGURED | Secret POOL_ACCESS_TOKEN đã Deploy chưa |
| POOL_CONFIGURATION_OR_SERVICE_ERROR | Binding DB, hai bảng SQL, JSON array Secrets; lỗi dịch vụ D1 cũng có thể gây mã này |
| INVALID_MODEL_CONFIGURATION | Hai biến Text model |
| ALL_POOLS_UNAVAILABLE | Key trống/cooldown/bị vô hiệu hóa hoặc upstream chưa phục vụ được |

Tài liệu chính thức:
[Workers dashboard](https://developers.cloudflare.com/workers/get-started/dashboard/),
[D1 setup](https://developers.cloudflare.com/d1/get-started/),
[Secrets dashboard](https://developers.cloudflare.com/workers/configuration/secrets/).
