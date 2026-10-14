# Setup Cloudflare AI pool

Worker độc lập cho hai pool Groq và OpenRouter. Project gọi Worker từ backend;
Worker chọn key, xử lý cooldown và chuyển provider trong chế độ `auto`.
Chưa cần API key provider để deploy. Bản này gọi provider trực tiếp, chưa cần AI Gateway.

## 1. Deploy lần đầu (PowerShell)

Đăng ký/đăng nhập tài khoản Cloudflare. Dùng Node.js LTS được Wrangler hỗ trợ.
Từ thư mục gốc project:

```powershell
cd cloudflare/ai-pool
npm install
npx wrangler login
npm run deploy
```

Wrangler mở trình duyệt: đăng nhập và chấp nhận quyền của Wrangler.
Nếu có nhiều tài khoản Cloudflare, chọn tài khoản muốn deploy khi được hỏi.
Deploy sẽ tạo Worker `lhu-ai-pool` và namespace Durable Objects SQLite.
Giữ nguyên migration `v1`; không xóa hoặc sửa migration này sau khi deploy.
Copy URL `https://lhu-ai-pool.<subdomain-cua-ban>.workers.dev` từ kết quả.
Nếu được hỏi tạo subdomain workers.dev lần đầu, chọn tên subdomain của bạn.
Không cần mua domain. Có thể đổi `name` trong wrangler.jsonc trước deploy đầu tiên.

## 2. Đặt token để backend truy cập Worker

```powershell
npx wrangler secret put POOL_ACCESS_TOKEN
```

Khi prompt yêu cầu giá trị, dán một token ngẫu nhiên dài rồi Enter.
Token này do bạn tạo, khác API key Groq/OpenRouter. Lưu lại để cấu hình backend sau.
Có thể tạo token 32 byte trong PowerShell bằng:

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Không đưa token vào Git hoặc frontend. Chưa có token thì tất cả API riêng trả 503;
sau khi có token, request thiếu/sai token trả 401.

## 3. Kiểm tra khi chưa thêm provider key

```powershell
$poolUrl = 'https://lhu-ai-pool.SUBDOMAIN.workers.dev'
Invoke-RestMethod "$poolUrl/health"
$poolSecureToken = Read-Host 'Token truy cập Worker' -AsSecureString
$poolToken = [System.Net.NetworkCredential]::new('', $poolSecureToken).Password
$poolHeaders = @{ Authorization = "Bearer $poolToken" }
Invoke-RestMethod "$poolUrl/status" -Headers $poolHeaders
```

Health trả `ok: true`; status trả `configured_keys: { groq: 0, openrouter: 0 }`.
Health chỉ kiểm tra Worker đang chạy, không chứng minh provider key/model dùng được.
Không có key: gọi completions trả 503, không tự dùng mock hay model trả phí.

## 4. Thêm key sau bằng dashboard

Vào Cloudflare dashboard → Workers & Pages → `lhu-ai-pool` → Settings →
Variables and Secrets → Add. Chọn loại **Secret**, tạo hai giá trị:

| Tên | Giá trị |
|---|---|
| `GROQ_KEYS` | `["key-groq-1","key-groq-2"]` |
| `OPENROUTER_KEYS` | `["key-openrouter-1","key-openrouter-2"]` |

Mỗi secret là một JSON array chứa chuỗi key thật. Có thể bắt đầu bằng một key;
thêm key bằng cách sửa cả array. Dùng dấu nháy kép, không có dấu phẩy cuối.
Tối đa 20 key/provider; thiết kế ban đầu là 10 key/provider.
Nhấn lưu/deploy thay đổi theo giao diện dashboard. Không dán key vào chat.
Nếu chưa có key cho provider nào, bỏ trống secret đó hoặc dùng `[]`.

Hoặc từ thư mục này:

```powershell
npx wrangler secret put GROQ_KEYS
npx wrangler secret put OPENROUTER_KEYS
```

Dán JSON array tại prompt. Không dùng biến môi trường Text cho các key.
Secret được giữ khi deploy lại bằng Wrangler.

## 5. Gọi thử sau khi có key

Trong phiên PowerShell ở bước 3:

```powershell
$poolBody = @{
  pool = 'auto'
  messages = @(@{ role = 'user'; content = 'Chao ban, tra loi mot cau ngan.' })
  max_tokens = 128
} | ConvertTo-Json -Depth 8
Invoke-RestMethod "$poolUrl/v1/chat/completions" -Method Post -Headers $poolHeaders -ContentType 'application/json' -Body $poolBody
```

`pool=groq`: chỉ dùng Groq; `pool=openrouter`: chỉ dùng OpenRouter;
`pool=auto`: ưu tiên Groq rồi chuyển OpenRouter nếu pool Groq không phục vụ được.
Đổi `pool` trong request để chọn. Response giữ cấu trúc chat completions;
header `X-AI-Provider` cho biết provider thực tế phục vụ request thành công.

Model được đặt phía Worker: `GROQ_MODEL` và `OPENROUTER_MODEL` trong wrangler.jsonc.
Đổi trong file rồi `npm run deploy` để cấu hình không bị deploy sau ghi đè.
OpenRouter chỉ chấp nhận `openrouter/free` hoặc tên có hậu tố `:free`.
Bạn cần xác nhận model Groq còn khả dụng và quota của tài khoản trước demo.
Router `openrouter/free` có thể chọn model khác nhau giữa các request;
nếu cần đánh giá AI nhất quán, chọn một model `:free` cụ thể đang khả dụng.

## Hành vi và giới hạn của bản này

- Durable Objects giữ con trỏ round-robin và trạng thái cooldown giữa các request.
  Storage chỉ giữ hash của key và trạng thái, không giữ key hay prompt.
- 429: cooldown theo Retry-After; thiếu header thì 60 giây. Đây không phải theo dõi
  chính xác quota ngày của provider; nếu quota ngày hết và thiếu thông tin reset,
  key có thể lại được thử sau cooldown rồi tiếp tục nhận 429.
- 401/403: key bị bỏ qua cho tới khi thay bằng key mới (hash mới).
- Timeout/lỗi mạng/408/500/502/503/504: cooldown 15 giây rồi thử key khác.
- 400 và lỗi khác không nằm trong nhóm retry: trả lỗi ngay, không đổi pool.
- Tối đa 10 lần thử/pool và 25 giây cho các lần gọi upstream. Auto dành tối đa
  12 giây cho Groq để còn thời gian cho OpenRouter. Không bảo đảm thử hết key
  khi provider chậm. Mỗi lần gọi upstream timeout tối đa 8 giây.
- Không hỗ trợ streaming/tools/JSON schema ở bản đầu; chỉ chuyển messages,
  temperature, max_tokens. Body tối đa 64 KiB, max_tokens tối đa 2048.
- Không có user quota/cache ở Worker. Backend hiện tại vẫn cần auth, phân quyền,
  giới hạn người dùng và cache. Pool token là quyền truy cập chung của backend.
- Cloudflare Free có giới hạn riêng; không có bảo đảm uptime/quota miễn phí vô hạn.
  Pool không đảm bảo cộng được quota từ nhiều tài khoản nhà cung cấp.
- Backend đã có adapter Worker. Cấu hình AI_POOL_URL, AI_POOL_TOKEN và AI_POOL_MODE
  trong backend/.env; khởi động lại backend để áp dụng. Model đặt trên Worker,
  không gửi model override từ backend. Adapter đọc provider thực tế từ header,
  giữ cache và không lặp chuỗi retry/fallback của Worker. Sau khi đổi model trên
  Worker, khởi động lại backend để xóa cache câu trả lời cũ.

## Tài liệu chính thức

- [Deploy Worker với Wrangler](https://developers.cloudflare.com/workers/get-started/guide/)
- [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Durable Objects pricing và Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits)

## Kiểm tra local không gọi API thật

```powershell
npm test
```

Các test giả lập provider và storage để kiểm tra auth, xoay key, cooldown, đổi pool
và xử lý lỗi. Không thay thế kiểm tra deploy thực tế trên Cloudflare.
