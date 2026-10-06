# W3-P4 — Bộ phát triển AI ban đầu

**12 hồ sơ tổng hợp; nhãn kỹ thuật chưa được chuyên môn xác nhận.** Không có dữ liệu người thật, không dùng pháp luật hoặc quy chế LHU để suy ra ngưỡng. `rules.json` là đặc tả **MÔ PHỎNG** do người phát triển viết cho guard dữ liệu: 3 năm riêng liên tiếp ở v1, 4 năm ở v2. Hai số này không là điều kiện danh hiệu nào.

## Dữ liệu và căn cứ

- `cases.dev.json`: nhãn kỳ vọng viết riêng (`expectedIssues`, `expectedDistinctYears`), scenario flags, groupId và các source ID.
- `rules.json`: nội dung nguyên văn, phiên bản và disclaimer của đặc tả mô phỏng.
- `EvaluationRun.fixtures.json`: chỉ 12 ca dev, materialized input tổng hợp và run theo hợp đồng W3-Q4; generated bằng `node scripts/w3-p4-eval.mjs`.
- `basis` trỏ tài liệu repository cụ thể, SHA-256 bytes và xác nhận chỉ ở mức hợp đồng kỹ thuật/spec mô phỏng. `legalReferences=[]` vì không có căn cứ pháp lý xác nhận cho ngưỡng thử nghiệm.

Source IDs: W3-Q1 → WORKFLOW_W3_Q1.md (revision/revoke), W3-Q2 → REGULATIONS_W3_Q2.md (version/confirmation), W3-P2 → KPI_W3_P2.md (nguồn tự khai, không VERIFIED), W2-P2 → AWARDS_W2_P2.md (recorded/revoke/replacement), W1-P4 → BUSINESS_CONFIRMATION_W1_P4.md (chưa có quy chế LHU). SIM-YEARS-v1/v2 → rules.json. Những tài liệu phần mềm này không phải văn bản pháp lý hoặc xác nhận chuyên môn.

Mỗi input có chủ thể tổng hợp, record id/version/status/năm, file id/version/hash và bytes synthetic để kiểm tra hash; document/version/effective dates; criterion và KPI provenance. `isConfirmedForTest=true` chỉ là cờ scenario tổng hợp. `professionalConfirmation=false` luôn giữ nguyên, không biến thành `isConfirmedByLhu=true` trong EvaluationRun.

| Ca | Nội dung | Nhãn kỹ thuật chính |
|---|---|---|
| DEV-01 | Đủ 3 năm mô phỏng | Không có lỗi input; SIMULATION_ONLY |
| DEV-02 | Thiếu file năm giữa | MISSING_DATA, YEAR_GAP |
| DEV-03 | Đứt chuỗi năm | YEAR_GAP |
| DEV-04 | Trùng năm | DUPLICATE_YEAR, BELOW_SIMULATED_THRESHOLD |
| DEV-05 | Nguồn thu hồi | REVOKED_SOURCE |
| DEV-06 | Đổi v1→v2 | RULE_CHANGED, BELOW_SIMULATED_THRESHOLD |
| DEV-07 | Tài liệu chưa duyệt | UNAPPROVED_DOCUMENT |
| DEV-08 | Tiêu chí chưa duyệt | UNAPPROVED_CRITERION |
| DEV-09 | KPI mô phỏng | SIMULATED_KPI |
| DEV-10 | Thiếu năm | MISSING_DATA, YEAR_GAP |
| DEV-11 | Replacement thay nguồn thu hồi | REVOKED_SOURCE; không nhân đôi năm |
| DEV-12 | Khác chủ thể | WRONG_SUBJECT |

## Protocol phát triển / test cuối

Development được phép sửa trước khi freeze. Lần chạy đầu dev đạt 11/12: nhãn DEV-02 thiếu YEAR_GAP dù mất nguồn năm giữa; đã rà soát và bổ sung nhãn kỹ thuật trước freeze, không thay thuật toán để hợp thức hóa lỗi. Nhãn FINAL-03 cũng được rà soát nhất quán trước bất kỳ lần chạy final nào. Đây là nhãn của tác giả phát triển, không phải chuyên gia.

Holdout 6 ca nằm trong `../eval-final/cases.final.json`; không trùng case/group/chủ thể hay file identity với dev, không import vào UI. Cùng nhóm tình huống nghiệp vụ được dùng để kiểm tra khả năng bao phủ, không tuyên bố độc lập hoàn toàn về phân phối. Trước chạy cuối: `node scripts/w3-p4-freeze.mjs` khóa hashes của dev/final/rules/evaluator. Sau freeze chỉ chạy `node scripts/w3-p4-eval.mjs --final`; thay nội dung bị từ chối. Không chỉnh rule/label sau nhìn kết quả final, cần benchmark version mới khi muốn nghiên cứu tiếp.

Kết quả chỉ là **deterministic data guards**, không phải độ chính xác LLM, không phải nhãn eligibility chuẩn chuyên môn. Chưa gọi vendor AI với corpus vì thiếu quy chế áp dụng LHU và nhãn chuyên môn đã xác nhận. Initial holdout do chính người phát triển tạo, không phải đánh giá độc lập/blind. PromptTokens/latency bằng 0 là fixture không gọi AI; executedAt cố định là timestamp fixture, không thời điểm gọi provider thật.

## UI và an toàn

Trang `/me/ai-forecast` đọc fixture dev, chọn từng ca, xem diagnostic/input/basis/hash/EvaluationRun. Không có xác suất thưởng, điều kiện đủ, hoặc nút gửi duyệt giả. Tất cả run `automaticAwardGranted=false`, `isSimulation=true`, `isConfirmedByLhu=false`, `humanReviewRequired=true`, `isSatisfied=UNCONFIRMED`.

Zod `backend/src/modules/ai/evaluationSchemas.js` kiểm tra cấu trúc full EvaluationRun/CriterionResult và chống auto award/eligibility mô phỏng. Đây là schema interchange của fixture, chưa có API lưu EvaluationRun thật. Legacy AI endpoint vẫn trả analysis riêng; xem `docs/api/AI_EVALUATION_W3_P4.md` cho thay đổi fail-closed.
