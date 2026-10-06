# W3-P4 — Test và bàn giao

Võ Nhạc Phước, 06/10/2026 (Asia/Saigon). **Hoàn thành bộ thử/demo/review kỹ thuật; chưa nghiệm thu accuracy hoặc quyết định AI chuyên môn.** W3-Q1/W3-Q2/W3-P2 đã có và được tích hợp thật trong harness mới; không chỉ kiểm fixture.

## Lệnh và kết quả thực tế

| Lệnh | Kết quả |
|---|---|
| `node scripts/w3-p4-eval.mjs` | Dev **12/12 PASS**; lần đầu 11/12 do label thiếu YEAR_GAP, đã sửa nhãn dev trước freeze và ghi protocol |
| `node scripts/w3-p4-freeze.mjs` | Khóa hashes dev/final/rules/evaluator; không overwrite manifest |
| `node scripts/w3-p4-eval.mjs --final` | Initial final **6/6 PASS**; chạy sau freeze; không sửa rule/label theo kết quả final |
| `npm --prefix backend run test:w3-p4` | **6/6 PASS**, exit 0 |
| `node --test backend/tests/w3-p4.test.js backend/tests/w3-q3.test.js` | **11/11 PASS**, exit 0; W3-Q3 test gate cũ còn yếu, có catch→null nên không dùng nó thay bằng chứng guard mới |
| `npm --prefix backend run test:w3-p4:integration` | **49 real HTTP/PostgreSQL checks PASS**, exit 0; provider mock; **2 findings được tái hiện**, không gọi đây là “bất biến hoàn toàn” |
| `npm --prefix frontend run build` | **PASS**, exit 0; Vite cảnh báo chunk JS >500 kB (fixture dev được bundle); không lỗi build |
| Từ frontend: `.\node_modules\.bin\eslint.cmd src/pages/AIForecast.jsx` | **PASS**, exit 0 |
| `git diff --check`, `node --check backend/src/modules/ai/aiService.js`, `node --check backend/tests/w3-p4.integration.js` | **PASS**; Git chỉ cảnh báo LF→CRLF |
| Parse `docs/api/W3_P4.openapi.json` bằng JSON.parse | **PASS**, 2 endpoint operations; đây là kiểm cú pháp, chưa phải full OpenAPI validator |
| Kiểm UI bundle không chứa `FINAL-01`…`FINAL-06` bằng Node | **PASS**, giữ holdout ngoài UI; build cuối JS ~540.31 kB |

Kết quả máy đọc: W3_P4_DEV_RESULT.json, W3_P4_FINAL_RESULT.json, W3_P4_INTEGRATION_RESULT.json. executedAt trong integration là thời gian test thực tế; executedAt cố định/usage=0 trong EvaluationRun là fixture, không lời khai gọi AI thật.

Harness apply toàn bộ Supabase migrations và seed vào schema ngẫu nhiên trong outer transaction, dùng pg/savepoint/Express/JWT thật; dọn file synthetic và rollback schema. Không migrate/seed app dùng chung, không ghi key/token hoặc dữ liệu thật vào Git. Chạy tuần tự một client, chưa chứng minh concurrency nhiều connections.

## Review và nghiệm thu

Đủ ca thiếu dữ liệu, đứt/trùng chuỗi năm, revoke/replacement, đổi quy định, tài liệu/tiêu chí chưa duyệt và KPI mô phỏng. Nhãn expectedIssues là kỹ thuật, luôn ghi UNCONFIRMED_BY_DOMAIN_EXPERT. Basis có đường dẫn/source/hash/phiên bản; legalReferences rỗng để không bịa điều khoản cho ngưỡng mô phỏng. Subject/group/file identities không trùng dev-final; không dùng final trong UI hoặc unit guard prediction.

API v1/v2/revoke tuần tự giữ snapshot/file; UI khóa VERIFIED. Review còn R01 DB snapshot thiếu guard, R02 file mutation race trước transaction, R03 biên regulation overlap, R05 replace audit ngoài transaction. AI gate R04 đã sửa và kiểm thử: quyền đọc, VERIFIED, criterion+parent confirmation/effective/target và provider mapping; mock không nói đạt điều kiện. Chi tiết/mức độ/tái hiện tại `docs/reviews/W3_P4_REVISION_AI_REVIEW.md`.

## File đổi

- Backend: `backend/package.json`, `backend/src/modules/ai/aiController.js`, `aiService.js`, `providers/mockProvider.js`, `evaluationSchemas.js`; `backend/tests/w3-p4.test.js`, `w3-p4.integration.js`.
- UI: `frontend/src/pages/AIForecast.jsx` (thay demo không có căn cứ bằng fixture viewer).
- Bộ dev: `docs/ai/eval-dev/README.md`, `rules.json`, `cases.dev.json`, `EvaluationRun.fixtures.json`.
- Holdout: `docs/ai/eval-final/README.md`, `cases.final.json`, `freeze-manifest.json`.
- Scripts: `scripts/w3-p4-eval.mjs`, `scripts/w3-p4-freeze.mjs`.
- `.gitattributes`: chỉ khóa LF của JSON corpus/script W3-P4 để frozen checksum ổn định giữa các checkout.
- API/plan/review: `docs/api/AI_EVALUATION_W3_P4.md`, `docs/api/W3_P4.openapi.json`, `docs/weekly/WEEK_03_W3_P4.md`, `docs/reviews/W3_P4_REVISION_AI_REVIEW.md`.
- Bàn giao/demo: báo cáo này, `DEMO_W3_P4.md` và ba RESULT.json.

## Tự kiểm tra và phần còn lại

Chạy các lệnh trên, rồi đăng nhập mở `/me/ai-forecast` theo DEMO_W3_P4.md: chọn ca dev, xem disclaimer/input/basis/diagnostic và EvaluationRun. UI đã build/lint, chưa kiểm tra trực tiếp bằng thao tác browser trong task. PR đang mở online chưa xác minh do không có gh; mã/hợp đồng/commit phụ thuộc đã kiểm tra.

Benchmark LLM/chuyên môn bị chặn bởi quy chế áp dụng LHU, tiêu chí/nguồn được chuyên môn xác nhận và gold labels. Chưa có EvaluationRun persistence/input snapshot API thật; legacy evaluate trả analysis, không tương đương hợp đồng run UI. Không gửi corpus tới vendor AI, không đo accuracy LLM, không gọi hay sửa key. Các review findings chưa sửa rộng cần người phụ trách xử lý trước production.

Đề xuất commit: `feat(W3-P4): review immutable revisions and add labelled AI benchmark fixtures`. **Chưa commit/push/merge**.
