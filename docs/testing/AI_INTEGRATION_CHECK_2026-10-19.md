# Kiểm tra tích hợp AI — 19/10/2026

## Kết luận

**Đã tích hợp và kết nối được mô hình thật. Chưa thể xác nhận toàn bộ luồng nghiệp vụ AI/RAG chạy hoàn chỉnh với bộ dữ liệu hiện tại.**

| Hạng mục | Kết quả kiểm tra | Giới hạn |
| --- | --- | --- |
| Kết nối provider thật | Thành công: backend → Cloudflare AI pool → Groq, model `openai/gpt-oss-20b` | Chỉ thử câu kiểm tra kết nối, không gửi hồ sơ cá nhân hoặc văn bản quy chế |
| Chế độ tự chọn provider | Lượt kiểm tra chọn được Groq, không dùng cache/mock | Chưa chứng minh nhánh dự phòng OpenRouter đã hoạt động |
| Thẩm định có cấu trúc qua UI | Đăng nhập An, chọn SCN-CRIT-01, bấm Thực hiện Thẩm định AI: có kết quả và lưu được phiên | Đây là evaluator theo quy tắc, không phải một lượt gọi LLM để đọc hồ sơ |
| Mở lại phiên từ lịch sử UI | Mở lại được kết quả/snapshot | Bảng lịch sử có lỗi cột thời gian/chủ thể, xem BUG-AI-UI-001 |
| Giải thích RAG qua UI ở chế độ mock | Hiện đúng thông báo thiếu căn cứ, `Model: none` | Không có nguồn chính thức được phê duyệt để lấy trích dẫn |
| Giải thích RAG gửi hồ sơ đến provider thật | Chưa thực thi | Bước bấm với provider thật bị kiểm duyệt tự động chặn do chưa có xác nhận gửi payload hồ sơ ra bên ngoài; đã dùng chế độ mock để kiểm gate trên UI |
| Gợi ý KPI dùng AI thật | Có mã tích hợp provider và kiểm căn cứ | Chưa chạy UI trong đợt này; cùng cần nguồn/tiêu chí hợp lệ, phiên còn hiệu lực |

## 1. Bằng chứng kết nối mô hình

- Thời điểm: **19:34:24 ngày 19/10/2026**, giờ Việt Nam.
- Prompt chỉ yêu cầu trả chuỗi `AI_CONNECTION_OK`, không chứa dữ liệu người dùng.
- Câu trả lời nhận được: `AI_CONNECTION_OK`.
- Provider phản hồi: `groq`; chế độ pool `auto`.
- Model thực tế: `openai/gpt-oss-20b`.
- `isMock: false`, `cached: false`; thời gian khoảng **2.250 ms**.
- Tổng token do provider báo: 170.
- Chỉ kiểm có/không cấu hình; không ghi key/token vào tài liệu hoặc log kết quả.

Log kết quả an toàn ở `output/scenario/ai-provider-check.json` (nội bộ, Git bỏ qua).

## 2. Bằng chứng trên UI thật

Không giả lập phản hồi trình duyệt; frontend tại `http://localhost:5173` nối backend/database demo hiện tại.

1. Đăng nhập `an.nv` bằng giao diện.
2. Mở **Phân tích & Thẩm định AI** qua menu.
3. Chọn chủ thể Nguyễn Văn An, ngày đánh giá 19/10/2026 và tiêu chí SCN-CRIT-01. Provider giải thích ban đầu là Tự động.
4. Bấm **Thực hiện Thẩm định AI**.
5. UI nhận phiên `38697c5c-94d6-4d59-97ee-00623d41378b`, trạng thái `FLAGGED_UNCONFIRMED`, kết luận cần người có thẩm quyền rà soát.
6. UI hiển thị 2/2 hồ sơ cùng các vấn đề như nguồn thu hồi, KPI mô phỏng, quy định chưa được phê duyệt. Không tự trao thưởng.
7. Chuyển provider giải thích sang **Mô phỏng provider (không gọi LLM thật)**, bấm giải thích RAG. UI trả:

   > Chưa đủ dữ liệu căn cứ pháp lý để đưa ra kết luận hoặc giải thích có trích dẫn cho tiêu chuẩn này.

8. Mở **Lịch sử Phiên AI**, thấy phiên mới và mở lại được snapshot/kết quả.

Ảnh nội bộ: `output/playwright/ai-live-ui-2026-10-19.png`, `output/playwright/ai-history-2026-10-19.png`.

## 3. Vì sao có kết nối AI nhưng RAG chưa giải thích được?

Nguồn SCN-REGULATION được xác nhận cho dữ liệu demo nhưng vẫn có trạng thái `SIMULATION_ONLY`. Các tiêu chí nền SIM-KPI cũng chưa được xác nhận. Hiện không có nguồn thuộc trạng thái `CONFIRMED_LHU_POLICY`.

Theo mã nguồn, RAG chỉ lấy trích đoạn của phiên bản được xác nhận, thuộc nguồn LHU chính thức và có hiệu lực tại ngày đánh giá. Nếu không có trích đoạn phù hợp, hàm trả thông báo thiếu dữ liệu trước bước gọi mô hình. Vì vậy kết quả này không phải bằng chứng key/token lỗi hay model không chạy.

Không đổi nhãn văn bản giả thành chính sách chính thức để thử cho qua. Muốn nghiệm thu RAG thật cần nguồn phù hợp được phê duyệt đúng quy trình và xác nhận phạm vi dữ liệu được gửi qua provider.

## 4. Phân biệt evaluator và LLM

- `aiService.evaluateStructured()` thu thập dữ liệu, chạy `evaluateStructuredCriterion()`, tạo snapshot và lưu lịch sử. Trong luồng hiện tại nó không gọi `completeWithRetry()` để xin kết luận từ LLM.
- Chọn provider trong UI là chọn **provider giải thích**. Vì vậy bấm Thực hiện Thẩm định AI thành công chưa chứng minh mô hình đã đọc hồ sơ.
- RAG giải thích và tạo gợi ý KPI có mã gọi provider thật; phải kiểm riêng điều kiện dữ liệu và kết quả trả về.
- Các widget “AI” trên trang chủ hiện có chỉ số tính từ số hồ sơ, tỷ lệ cố định và gợi ý mô phỏng; không phải tất cả đều là kết quả suy luận từ model.

## 5. Bug đã tái hiện

### BUG-AI-UI-001 — Lịch sử thiếu thời gian và chủ thể

- Mức độ: Trung bình; cần sửa trước khi nghiệm thu lịch sử đánh giá.
- Tài khoản: `an.nv`.
- Bước tái hiện: đăng nhập → Phân tích & Thẩm định AI → Lịch sử Phiên AI.
- Thực tế: cột thời gian hiện `N/A`, cột chủ thể chỉ hiện `#`, cả phiên mới và phiên seed của An.
- Mong đợi: có thời gian thực hiện và thông tin cá nhân/tập thể được đánh giá.
- Đối chiếu mã: danh sách backend trả `executedAt`, `subjectType`, `subjectId`; UI đang đọc `evaluatedAt`, `targetSubject.*` hoặc tên trường dạng snake_case.
- Mở Xem lại hồ sơ vẫn hoạt động; đây là lỗi nối dữ liệu hiển thị, chưa thấy bằng chứng mất dữ liệu đánh giá.
- Nguồn kiểm tra: `frontend/src/pages/AIForecast.jsx`, `backend/src/modules/ai/evaluationRepository.js`.
- Trạng thái: **Mới, chưa sửa trong lượt kiểm tra này**.

### Rủi ro cần kiểm thêm — metadata provider của evaluator

Mã `evaluateStructured()` có thể gán nhãn provider Groq/OpenRouter và `isMock` theo lựa chọn đầu vào dù bước tính tiêu chí vẫn là deterministic. Lượt UI này dùng `auto` nên lưu `mock`; chưa chạy ca chọn Groq/OpenRouter riêng. Cần tách rõ engine tính tiêu chí và provider giải thích trong metadata, không dùng nhãn provider làm bằng chứng đã gọi LLM.

## 6. Ảnh hưởng dữ liệu và phạm vi chưa kiểm

- Lượt UI tạo **một phiên đánh giá mới** bên cạnh hai phiên seed, và một kết quả RAG thiếu căn cứ; không thay đổi thành tích, đề nghị, sổ thưởng, quy chế hoặc KPI.
- Đăng nhập có tạo phiên đăng nhập theo cơ chế thông thường. Biên bản reset trước đó vẫn là ảnh chụp tại thời điểm reset, không phải số lượng sau mọi thao tác test.
- Chưa kiểm dự phòng provider khi hết quota, tải đồng thời, chất lượng trả lời RAG trên nguồn chính thức, bảo vệ trích dẫn trong câu trả lời live hoặc gợi ý KPI live.
- Phần thử kết nối mô hình là kiểm tra kỹ thuật độc lập. Các bước thẩm định/xem lịch sử/RAG thiếu nguồn nêu trên được thao tác trên UI; không dùng Postman để thay thế.
- Không coi kiểm tra giới hạn này là hoàn tất 145 ca UI hoặc chứng nhận đủ điều kiện khen thưởng.
