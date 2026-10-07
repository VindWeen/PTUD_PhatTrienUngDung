# W4-P1 — Gợi ý KPI bằng AI và chuyển thành kế hoạch

Võ Nhạc Phước. Kiến trúc: React/Vite/Tailwind → Express `/api/v1` → Supabase PostgreSQL/schema `app` qua `pg`. Dùng quyết định ADR-001 trong blueprint thay DB SQL Server cũ; không đổi auth Express hoặc private files. Không tìm thấy AGENTS.md ở workspace/ancestor khi triển khai.

## Hợp đồng và kế hoạch tích hợp

Tái sử dụng W3-P2 (quyền chính chủ/đại diện, tạo KpiGoal), W3-Q3 (`AiService.completeWithRetry`, free-model whitelist, timeout/cache), W3-Q4 (EvaluationRun) và W4-Q1 (criterionResults, snapshot, stale check). Các phần này đã có trên lịch sử Git local, bao gồm commit W4-Q1 `7785e14`; không kiểm chứng trạng thái PR trên remote.

Migration mới duy nhất: `supabase/migrations/20261007000022_w4_p1_kpi_recommendations.sql`. Bảng recommendation tham chiếu `run_id`, `criterion_id`, `goal_id`. RLS bật, thu hồi PUBLIC/anon/authenticated. Chưa áp migration lên schema app dùng chung; integration chạy toàn bộ migrations trong schema ngẫu nhiên trên Supabase rồi rollback.

Luồng: run hiện hữu → kiểm tra quyền KPI đang hiệu lực → kiểm tra run hoàn tất, nguồn hiện hành và stale → lọc tiêu chí thiếu đã xác nhận → gọi adapter thật → lưu gợi ý PENDING → người dùng sửa kế hoạch/thời hạn → chấp nhận → atomic tạo goal ACCEPTED, liên kết recommendation/run và audit. Reject chỉ đổi trạng thái, không tạo goal. Có thể tải lại gợi ý theo run. Tối đa 10 tiêu chí thiếu mỗi lượt; không ghi một phần nếu provider/validation lỗi trong lượt.

## API

Tất cả cần Bearer token; backend đọc user ACTIVE và roles/phân công hiện hành từ DB. ADMIN/MANAGER không vượt quyền chính chủ/đại diện KPI. Trả envelope `{success:true,data:...}`, `Cache-Control: no-store`; payload strict.

| Method/path dưới `/api/v1/kpi` | Request | Kết quả |
|---|---|---|
| POST `/recommendations` | `{runId: UUID, provider?: "groq" hoặc "openrouter"}` | 201 `{items,automaticAwardGranted:false}`; không đủ dữ liệu trả `{items:[],missingData}` |
| GET `/recommendations?runId=UUID` | UUID bắt buộc | 200 `{items}`; vẫn đọc được lịch sử khi run stale |
| POST `/recommendations/:id/decision` | `{version: số nguyên dương, action:"accept", edits:{plan,periodStart,periodEnd}}` hoặc `{version,action:"reject"}` | 200 `{recommendation,goal,automaticAwardGranted:false}`; reject có goal null |

Một item gồm `recommendation_id`, `run_id`, `criterion_id`, `created_by`, `payload`, `provider_evidence`, `status`, `goal_id`, `version`, `created_at`. BIGINT theo pg là chuỗi. Payload chứa `title`, `criterionCode`, `target` (tổng yêu cầu, không lấy số còn thiếu làm tổng mới), `actualRecorded`, `measureUnit`, `priority:MEDIUM` (mặc định, không suy ra mức ưu tiên chính thức), `legalReferences`, `explanation`, `assumptions`, `plan`, `periodStart`, `periodEnd`, `requiresYearReview`, `subjectType`.

Ngưỡng/đơn vị/căn cứ/tiêu chí không cho client hoặc LLM sửa. Client chỉ sửa kế hoạch và ngày. `source=MANUAL` giữ hợp đồng W3-P2 vì người dùng chấp nhận thủ công; source_note ghi rõ AI W4-P1, run, mã tiêu chí, căn cứ và giải thích; liên kết AI có cấu trúc ở kpi_recommendations. Không sửa bất biến evaluation_run để thêm goal. Không tạo KpiResult, thành tích VERIFIED hoặc khen thưởng.

400: UUID/payload/ngày/JSON model sai, mock fallback hoặc kỳ nhiều năm bị rút ngắn. 401: chưa đăng nhập/user inactive. 403: ngoài quyền KPI. 409: version cũ, đã xử lý, run stale/chưa hoàn tất, nguồn/tiêu chí thay đổi hoặc hết hiệu lực. Provider dùng lỗi timeout/rate-limit của adapter W3-Q3; không có silent mock success.

## Nguồn, điều kiện nhiều năm và dữ liệu thiếu

Chỉ tiêu phải được xác nhận LHU, không simulation, kết quả evaluator phải false và không yêu cầu human review, có ngưỡng/đơn vị/căn cứ. Trước khi lưu gợi ý và chấp nhận, kiểm tra lại ngưỡng, tên/mã, đối tượng, điều khoản, hash, phiên bản, hiệu lực và stale. Chỉ gửi tên tiêu chí/đơn vị đã xác nhận tới LLM; không gửi hồ sơ cá nhân hoặc private files. LLM trả JSON plan, không được đặt số, căn cứ, thời hạn pháp lý hoặc kết luận trao thưởng. Nội dung vẫn phải được người dùng rà soát.

Ngày gợi ý là **giả định lập kế hoạch**, không phải hạn theo quy chế: chỉ tiêu số lượng từ hôm nay (Asia/Ho_Chi_Minh) đến cuối năm sau; chỉ tiêu năm từ đầu năm sau, phủ đủ ceil(target) năm lịch. Người dùng sửa ngày trước khi chấp nhận. Điều kiện năm từ unit/rules snapshot được giữ nguyên; backend từ chối kỳ không đủ số năm đầy đủ. Kế hoạch không xác nhận đã đạt chuỗi năm/cửa sổ hay đủ điều kiện danh hiệu. Nếu W4-Q1 trả UNCONFIRMED/thiếu chứng cứ, không tự đặt mục tiêu; phải bổ sung và đánh giá lại. Không có fixture KPI đã chốt nên UI fixture vẫn báo cần API thật. Mọi nguồn MO PHONG trong test được ghi nhãn, chỉ giả lập cờ confirmed trong schema test đã rollback; không xác nhận nguồn thật.

Sửa nhỏ bắt buộc khi tích hợp: `criteriaEvaluator.js` chuẩn hóa `Date` do pg trả về thành ISO day trước khi so hiệu lực; trước đó String(Date) có thể đánh nhầm nguồn ngoài hiệu lực. Có test hồi quy riêng, không thay thuật toán đếm năm.

## Tự kiểm tra và bằng chứng provider

1. Cấu hình key ở backend/.env local hoặc biến môi trường server, không đưa key lên Git/trình duyệt/chat. Chọn AI_PROVIDER=groq hoặc openrouter, model miễn phí đã được adapter hỗ trợ.
2. Áp migration bằng `npm --prefix backend run migrate` trong môi trường triển khai sau khi kiểm tra danh sách migrations; khởi động backend. Frontend dùng `VITE_DATA_SOURCE=api`, `npm --prefix frontend run dev`.
3. Đăng nhập LECTURER/UNIT_REPRESENTATIVE có phân công; chạy đánh giá structured từ UI AI với nguồn/tiêu chí được xác nhận, sao chép run ID; mở `/kpi`, nhập run ID và tạo gợi ý. Kiểm tra căn cứ, giả định và model. Không có goal mới ở bước này.
4. Sửa kế hoạch/ngày, chấp nhận: goal ACCEPTED xuất hiện, recommendation.goal_id tham chiếu goal và run_id. Thử tài khoản khác/version cũ/lặp accept → từ chối. Reject → không tạo goal. Thử rút kỳ nhiều năm còn một năm → 400. Thu hồi xác nhận tiêu chí hoặc đánh dấu run stale → accept 409.
5. `npm --prefix backend run test:w4-p1:real-provider`: chạy Express + evaluator + Supabase thật + LLM thật với dữ liệu **MO PHONG** trong schema rollback. Lưu bằng chứng metadata an toàn vào `docs/testing/W4_P1_REAL_PROVIDER_EVIDENCE.json` chỉ khi đạt; không lưu key/token/hồ sơ thật. Chưa có key thì exit 1 BLOCKED, không tuyên bố gọi thật. Test DB thường stub provider và không phải bằng chứng LLM.

Hiện chưa thể nghiệm thu đầy đủ: thiếu GROQ_API_KEY/OPENROUTER_API_KEY local. Không thiếu mã phụ thuộc W3-P2/Q3/Q4/W4-Q1. Chưa kiểm tra trình duyệt trực quan; lint/build không thay thế browser QA. Gợi ý commit, chưa commit/push/merge: `feat(W4-P1): suggest grounded KPIs and persist accepted plans linked to evaluation runs`.
