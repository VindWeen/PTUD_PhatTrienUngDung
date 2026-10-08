# W4-P2 — Adapter nguồn KPI MÔ PHỎNG

Võ Nhạc Phước. **Chưa tích hợp hệ thống bên ngoài thật.** Không AI, không xác nhận KPI, không tự trao thưởng. DB dùng Supabase PostgreSQL/schema `app` qua `pg`, thay phương án SQL Server cũ; giữ Express auth và private files. Migration 23 bổ sung staging, không thay bảng KPI W3-P2.

## Phụ thuộc và hợp đồng

W3-P2 đã có migration 17/API/UI và review APPROVED trong `docs/testing/week-3/PR_REVIEW_W3_P1_P2.md`. W3-Q4 đã có `docs/api/ai-contract/EVALUATION_CONTRACT_W3_Q4.md` nhưng đó là EvaluationRun/CriterionResult, không phải giao thức KPI ngoài. Adapter không giả danh evaluation run và không đổi hợp đồng AI. Git checkout có phần triển khai W3-P2/W3-Q4; chưa xác minh trạng thái PR trên GitHub (máy không có `gh`). Không tìm thấy AGENTS.md trong cây dự án.

Hợp đồng nguồn bổ sung `W4-P2-v1` nằm trong `backend/src/modules/kpi/externalContract.js`. Đây là hợp đồng triển khai với mock đi kèm, **chưa phải hợp đồng được đơn vị bên ngoài xác nhận**. Nếu nghiệm thu đòi một hợp đồng KPI nguồn ngoài do W3-Q4 ký riêng, phần xác nhận đó còn thiếu; không chặn kiểm thử HTTP với mock này.

GET nguồn `/kpi`, service Authorization Bearer, trả:

```json
{"contractVersion":"W4-P2-v1","isSimulation":true,"items":[{
 "externalId":"SIM-KPI-001","employeeId":"SIM-EMP-001","status":"FINAL","version":1,
 "code":"SIM-PAPER","title":"KPI MÔ PHỎNG - bài nghiên cứu","measureUnit":"bài",
 "periodStart":"2026-01-01","periodEnd":"2026-12-31","target":2,"actual":1,
 "plan":"","sourceNote":"MÔ PHỎNG; chưa tích hợp hệ thống bên ngoài thật","isSimulation":true
}]}
```

Payload strict; tối đa 500 bản, 1 MB response; ngày thật 1990–2100, kỳ có thứ tự, số hữu hạn 0–10^12; version nguyên dương an toàn; trạng thái DRAFT/FINAL. Không nhận tên để ghép. Các trường mục tiêu dùng validator W3-P2. Sai hợp đồng làm FAILED toàn lượt, không nhập một phần.

## API Express `/api/v1/kpi/external`

JWT Express hiện có; response `{success:true,data:...}`, no-store. Kiểm tra ACTIVE/vai trò DB mỗi lần; không tin role JWT. Lỗi validation 400, quyền 403, không có 404, version/trạng thái/trùng mapping 409.

| Method/path | Input và hành vi |
|---|---|
| GET `/` | ADMIN xem 50 runs, items và 200 records mới nhất, mappings; LECTURER chỉ records chính chủ, không xem runs toàn hệ thống |
| POST `/mappings` | ADMIN; `{employeeId,lecturerId}`; ánh xạ mã chính xác, immutable; trùng trả 409; audit cùng transaction |
| POST `/runs` | ADMIN; `{}` hoặc `{retryOf: UUID}`; HTTP 201 trả run với COMPLETED/FAILED; thất bại nguồn là kết quả run, không phải thành công đồng bộ |
| POST `/records/:id/draft` | Chính chủ LECTURER; `{version,achievementTypeId}`; READY → DRAFTED, tạo achievements DRAFT; 201 |

Service URL/token chỉ ở env server `KPI_SOURCE_URL`/`KPI_SOURCE_TOKEN`; URL không do client cung cấp, HTTPS hoặc HTTP loopback; cấm redirect/userinfo/query/hash. Timeout 3s mỗi lần, tối đa 3 lần; retry lỗi mạng/timeout/429/5xx, backoff 100/200ms. 4xx khác và sai contract không retry. Log attempts và mã lỗi an toàn, không ghi token/response lỗi/URL.

Idempotency DB unique `(external_id,source_version)`; hash payload chuẩn hóa phát hiện cùng version khác nội dung → VERSION_CONFLICT, giữ nguyên bản cũ. Khóa advisory transaction tuần tự hóa import. Không có mapping → QUARANTINED/UNMAPPED_EMPLOYEE_ID; nguồn DRAFT → SOURCE_NOT_FINAL. Thêm mapping rồi retry cùng nguồn giải quarantine. Không ánh xạ theo tên hoặc tự tạo giảng viên.

Version mới được lưu thành **revision nguồn riêng**, liên hệ qua external_id. Không tự chấp nhận goal, không sửa KPI result/hồ sơ cũ, không thêm award. Người dùng chọn loại thành tích rồi tạo nháp riêng có source id/version/nhãn mô phỏng; record lock + version ngăn tạo nháp trùng. Hồ sơ VERIFIED vẫn nguyên trạng, nháp mới không tự nhận liên kết replaces_achievement_id vì luồng thay thế hồ sơ đã có quy tắc riêng W3-Q1.

UI `/kpi` có phần nguồn mô phỏng: tải logs, ADMIN mapping/pull/retry, chính chủ chọn loại/tạo nháp. Sang `/achievements` bổ sung minh chứng private và theo quy trình hiện có. Fixture mode bị chặn rõ ràng bởi API service hiện có.

## Tự kiểm tra

1. Cấu hình DB local bí mật như dự án; triển khai migration 23 bằng `npm --prefix backend run migrate` khi sẵn sàng. Task chỉ áp migration trong schema test rollback, không sửa DB chung.
2. Trong PowerShell terminal mock, đặt `$env:KPI_MOCK_TOKEN` thành một bí mật tự chọn rồi chạy `npm --prefix backend run mock:kpi`. Mock bind `127.0.0.1:4301`, không có endpoint ghi fixture công khai.
3. Trong terminal backend, đặt `$env:KPI_SOURCE_URL='http://127.0.0.1:4301/kpi'` và `$env:KPI_SOURCE_TOKEN` bằng token mock, chạy `npm --prefix backend start`. Không đặt service token trong biến VITE hoặc Git.
4. Vite `VITE_DATA_SOURCE=api`, đăng nhập ADMIN, `/kpi`: mapping `SIM-EMP-001` đến ID giảng viên test đã kiểm tra; pull rồi retry: lần sau duplicate, không tăng số bản. Chưa mapping thì quarantine.
5. Đăng nhập giảng viên được ánh xạ, tải nguồn, chọn loại thành tích và xác nhận tạo nháp. Lặp tạo trả 409. Mở Thành tích để xem nhãn mô phỏng.
6. `npm --prefix backend run test:w4-p2` và `npm --prefix backend run test:w4-p2:integration` chạy cả trường hợp nguồn version 2, giữ nguyên VERIFIED và tạo DRAFT riêng. Integration dùng Express HTTP + mock HTTP + pg/Supabase thật, migrations/seed trong schema random và outer rollback. Cần DB có quyền DDL và mạng.

Giới hạn: chưa tích hợp nhà cung cấp thật; chưa có xác nhận hợp đồng của họ. Một cấu hình nguồn mô phỏng cố định, chưa phân trang/đa nguồn/lịch sync. Process dừng đột ngột có thể để run RUNNING, cần vận hành đối soát trước retry; chưa có worker phục hồi. UI giới hạn lịch sử nêu trên, chưa tự động refresh/pagination. Integration dùng một kết nối và savepoint nên không chứng minh tải song song. Không gửi dữ liệu đến AI.
## W5-P2 — đối soát và sự kiện xóa

Xem [protocol W5-P2](../ai/recommender-eval/PROTOCOL.md). Hợp đồng W4-P2-v1 không có tombstone: một item vắng khỏi response không xóa staging/achievement; status DELETED bị từ chối cả batch với FAILED/SOURCE_CONTRACT_INVALID. Chưa triển khai đồng bộ xóa từ nguồn thật khi chưa có hợp đồng xác nhận.

CSV `/api/v1/kpi/import/preview` trả INVALID khi cùng mã/kỳ nhưng khác nội dung goal/result; `/import/commit` trả 400 và rollback cả batch. Chỉ nội dung khớp mới trả DUPLICATE, không dùng CSV như lệnh sửa/ghi đè. Connector và CSV là hai luồng riêng: staging revision không tự tạo KPI goal/result và nhập CSV không tự đánh dấu revision DRAFTED.
