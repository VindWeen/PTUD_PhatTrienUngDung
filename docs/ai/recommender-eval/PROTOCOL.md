# W5-P2 — Protocol và kế hoạch kiểm chứng

Phụ trách: Võ Nhạc Phước. Ngày: 08/10/2026 (Asia/Saigon).

DB theo ADR-001: Supabase PostgreSQL qua pg, schema app; thay kế hoạch DB SQL Server cũ. Giữ auth Express và private files. Không thêm migration; chỉ chạy migration/seed hiện có trong schema ngẫu nhiên, outer transaction rollback. Không commit/push/merge.

Đã tìm AGENTS.md trong repo và ancestors: không có. AGENTS.md ở C:/Users/Nhac Phuoc/.codex trống. Đã đọc blueprint, W4-P1/W4-P2 API, review tuần 4 và báo cáo/dataset/runner W5-Q2. Dependency đã có trong Git local: W4-P2 516fd61, W5-Q2 d1572ab và W4-P1 implementation trên lịch sử trước đó. `git ls-remote origin HEAD` thất bại schannel SEC_E_NO_CREDENTIALS: chưa xác minh PR remote.

## Protocol dùng chung với W5-Q2

- Giữ nguyên 32 hồ sơ tại docs/ai/evaluation/holdout_dataset.json, SHA256 ea437e0ab9d80f9e30c469f94763b8957c25b656f294d04f5e756fd0c2838644. Runner kiểm tra hash và ID không giao với dev/final.
- Dùng conclusion groundTruth của Q2 để đối chiếu evaluator, sau đó ánh xạ INELIGIBLE thành có gợi ý; các nhãn khác phải không có gợi ý. Mapping recommender do tác giả W5-P2 đề xuất, chưa có đối soát độc lập. Không tự nhận người khác đã xác nhận mapping.
- Đây là tập giữ lại của Q2 đã được Q2 chạy trước đó; không tuyên bố unseen của toàn hệ thống. Không dùng kết quả để sửa label/prompt rồi báo lại như holdout mới. Ca lỗi tìm khi đọc code được giữ riêng ở regression tests.
- Đo gate accuracy, false suggestion, missed suggestion, và bảo toàn references. Bảo toàn references chỉ chứng minh sao chép đúng từ evaluator, không chứng minh tính đúng pháp lý hoặc citation precision của LLM.
- Offline evaluator là deterministic-evaluator-v1; không gọi LLM, token/cost LLM = 0. Không suy diễn chất lượng checklist hoặc model thật từ metric này. Báo từng ca, lỗi và giới hạn trong results.json; không ghi hồ sơ/key thật.
- Ngưỡng kỹ thuật đề xuất: false suggestion = 0; target/căn cứ không bị thay; thiếu dữ liệu không tự đặt mục tiêu; không tự trao thưởng. Ngưỡng chưa được người còn lại phê duyệt cho recommender nên không coi là nghiệm thu nghiệp vụ.

## Phạm vi và các lỗi được kiểm chứng

1. Recommender: giữ ngưỡng/căn cứ; kỳ năm đầy đủ; quyền/trạng thái/version; accept tạo goal và liên kết run; reject không tạo goal. Cần nguồn/tiêu chí được xác nhận thật khi nghiệm thu nghiệp vụ. Fixture confirmed chỉ nằm trong schema rollback, luôn ghi MO PHONG.
2. Cache: key tách provider, hash nguồn, phiên bản, prompt/model; hết TTL không dùng stale; kiểm tra model mặc định trước cache. Recommender bật requireRealProvider, thiếu key trả 503 AI_PROVIDER_UNAVAILABLE trước fallback/cache. Các caller khác giữ hợp đồng mock kiểm thử cũ.
3. Provider: 429 không retry spam; timeout/JSON lỗi không ghi recommendation; model trả phí bị chặn. Provider response có model thì log/lưu model đó, cùng requestedModel và modelReportedByProvider; nếu response không có model, chỉ ghi model yêu cầu với cờ false, không nhận đó là bằng chứng model thực dùng.
4. Connector W4-P2-v1: trùng cùng batch/cùng revision không thêm bản; sửa cùng version báo conflict giữ bản cũ, version mới tạo revision; không mapping quarantine, mapping rồi retry giải quarantine. Nguồn thiếu item không đồng nghĩa xóa, giữ lịch sử. DELETED không thuộc protocol: FAILED toàn batch, không nhập một phần. Đồng bộ xóa nghiệp vụ thật bị chặn đến khi có tombstone contract được xác nhận; không tự bịa.
5. CSV W3-P2: đối soát mã/kỳ cùng title/unit/target/plan/sourceNote và actual/evidenceNote/sourceNote khi đã có result. Nội dung khác trả INVALID ở preview, commit 400 và rollback cả batch. Bản giống hệt vẫn DUPLICATE. Không tự ghi đè dữ liệu đã có.

Ví dụ lỗi hồi quy: ngưỡng 2 bài với minimumDistinctYears=5 từng được rút thành 2 năm; CSV target 2 đổi 3 từng bị coi DUPLICATE; model mặc định không hợp lệ có thể tránh kiểm tra qua cache. Đã thêm regression riêng. JSON `{bad`, JSON plan chứa Điều/trao thưởng và field target ngoài hợp đồng bị từ chối.

## Chặn nghiệm thu thật và giới hạn

- GROQ_API_KEY/OPENROUTER_API_KEY chưa được cấu hình cho provider được chọn: real-provider runner exit 1 BLOCKED, không gọi model thật. Không dùng dữ liệu giả làm fallback production hoặc chuyển sang model tính phí.
- W4-P2 chỉ nhận isSimulation=true; thiếu nhà cung cấp thật, xác nhận giao thức ngoài và giao thức xóa. HTTP mock + Supabase thật chỉ là tích hợp adapter mô phỏng, không phải kết nối nguồn thật.
- Chia sẻ protocol qua tài liệu này; chưa có xác nhận trực tiếp từ W5-Q2 cho nhãn recommender. Không sửa dataset/báo cáo của người khác.
- Holdout có 3 ca dương và 29 ca âm, chỉ đánh giá gate; chưa có tập riêng độc lập cho chất lượng checklist LLM, deadline nghiệp vụ hoặc người dùng thật.
- Tests dùng một kết nối/savepoint, không chứng minh tranh chấp nhiều process; chưa browser QA. Bộ lọc plan dùng regex là guard kỹ thuật, không bảo đảm ngữ nghĩa hoàn toàn.
