# W3-P4 — AI guard và EvaluationRun fixture

Supabase PostgreSQL qua pg; auth Express/file private giữ nguyên. Không migration mới. Hợp đồng EvaluationRun/CriterionResult W3-Q4 tái sử dụng và được kiểm bằng `evaluationSchemas.js`; UI đọc fixture development, không có endpoint lưu EvaluationRun thật.

Hợp đồng máy đọc cho hai endpoint analysis hiện hữu: `W3_P4.openapi.json` (OpenAPI 3.0.3); không giả lập endpoint EvaluationRun chưa triển khai.

## Thay đổi fail-closed ở API hiện hữu

`POST /api/v1/ai/evaluate-criterion`: Bearer; `{criterionId,achievementId,provider?,model?}`. `achievementId` nay bắt buộc ở service: thiếu trả 400, không đánh giá nguyên lý khi chưa có input. Provider/model giữ hợp đồng cũ; sửa mapping `provider` HTTP sang `forcedProvider` để không vô tình dùng provider cấu hình khác.

Backend dùng `achievementService.getAchievementById(req.user,id)` đúng chữ ký và quyền đọc đã có (DB role/scope/ownership), chặn ngoài quyền 403. Chỉ nhận trạng thái VERIFIED; DRAFT/REVOKED trả 400. Tiêu chí phải `is_confirmed=true`; version cha phải `is_confirmed=true`, `lhu_application_status=CONFIRMED_LHU_POLICY` và còn hiệu lực tại ngày hiện tại (service so sánh ngày UTC). Target INDIVIDUAL/COLLECTIVE/BOTH phải phù hợp chủ thể. Mọi chặn diễn ra trước completeWithRetry/provider.

`POST /api/v1/ai/smoke-test`: payload giữ nguyên; nay version cha của chunk cũng phải confirmed/CONFIRMED_LHU_POLICY và còn hiệu lực, nguồn chưa duyệt trả 400. Không gọi smoke vendor trên nguồn mô phỏng chưa duyệt để giả làm quy định chính thức. Các smoke script cũ sử dụng nguồn chưa xác nhận sẽ bị chặn theo guard mới.

Mock provider vẫn có `isMock=true` và `automaticAward=false` ở endpoint đánh giá, nhưng đã bỏ câu khẳng định hồ sơ thỏa điều kiện. Mock không phân tích eligibility. Trả error envelope chuẩn hiện hữu. Response analysis legacy chưa phải EvaluationRun và không đủ hồ sơ nhiều năm/file/revision để dùng làm quyết định; UI W3-P4 chỉ hiển thị fixture rõ nguồn.

Chưa có bộ quy chế LHU/tiêu chí chuyên môn được xác nhận cho corpus này; không gửi corpus tới vendor, không đo accuracy LLM. Không thay seed/phê duyệt nguồn thật. Integration chỉ bật flags confirmed trên dữ liệu **SYNTHETIC trong schema test rollback** và ép provider mock để kiểm tra đường đi API; flags không là xác nhận chuyên môn.

Review rủi ro revision/file và phiên bản quy định tại `docs/reviews/W3_P4_REVISION_AI_REVIEW.md`. Quyền/state/version hiện tại được check trước provider, chưa bảo đảm source không thay đổi trong lúc chờ provider; cần run input snapshot và schema lưu run cho mở rộng production.
