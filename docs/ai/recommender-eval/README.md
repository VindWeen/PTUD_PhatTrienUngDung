# W5-P2 — bàn giao kiểm chứng recommender/quota/connector

Võ Nhạc Phước, 08/10/2026 (Asia/Saigon).

## Triển khai

- Giữ Supabase PostgreSQL qua pg theo ADR-001; auth Express và file private giữ nguyên. Không thêm migration hoặc sửa DB app dùng chung.
- Chặn mock fallback cho recommender trước cache; kiểm tra default model trước cache và tách provider trong cache key.
- Ghi model upstream báo lại, requestedModel và cờ modelReportedByProvider; JSON lỗi/thiếu content trả lỗi provider, không cache thành công.
- Tách requiredCalendarYears khỏi target để giữ minimumDistinctYears; backend vẫn kiểm tra nguồn/quyền/trạng thái khi sinh và accept.
- CSV không âm thầm bỏ thay đổi dưới nhãn DUPLICATE: nội dung cùng mã/kỳ khác nhau trả INVALID/400; batch rollback. Trùng giống hệt vẫn idempotent.
- Mở rộng integration hiện có thay vì sao chép harness. Thêm fault injection, xóa ngoài contract, trùng batch, đối soát connector/CSV và regression cache/nhiều năm.

## Kết quả thực chạy

Xem results.json cho chi tiết từng ca giữ lại. `npm --prefix backend run test:w5-p2:eval`: 32/32 gate đúng, evaluator conclusion 32/32, false suggestion 0, missed 0; 3 positive/29 negative. Đây là phép kiểm offline tái sử dụng holdout Q2, không là độ chính xác LLM. Không sửa nhãn sau khi chạy.

`npm --prefix backend run test:w5-p2`: 13/13 PASS. Kiểm tra gồm adapter/provider lỗi, bounded retry, cache TTL/hash/version/provider, model không được phép, thiếu key và kỳ nhiều năm.

`node --test backend/tests/w3-q3.test.js backend/tests/w4-p4.test.js backend/tests/w4-q2.test.js backend/tests/w4-q1.test.js`: 21/21 PASS hồi quy AI.

`npm --prefix backend run test:w4-p1:real-provider`: exit 1 BLOCKED do thiếu key server-only; không có live LLM evidence. `git ls-remote origin HEAD`: lỗi schannel SEC_E_NO_CREDENTIALS, chưa xác minh PR remote.

Integration Supabase thật, Express HTTP thật, nguồn HTTP MÔ PHỎNG và provider fault injection; random schema + outer rollback. Số đo integration chi tiết ghi ở phần xác nhận cuối tài liệu.

## Tệp thay đổi

- backend/src/modules/ai/aiService.js; providers/groqProvider.js; providers/openrouterProvider.js.
- backend/src/modules/kpi/recommendationService.js; kpiService.js.
- backend/tests/w5-p2.test.js; w5-p2.integration.js; w4-p1.integration.js; w4-p2.integration.js; w3-p2.integration.js.
- backend/package.json; scripts/w5-p2-eval.mjs.
- docs/api/KPI_RECOMMENDATIONS_W4_P1.md; EXTERNAL_KPI_W4_P2.md.
- docs/ai/recommender-eval/PROTOCOL.md; README.md; results.json; docs/weekly/WEEK_05_W5_P2.md.

## Tự kiểm tra

Từ root repo:

```powershell
npm --prefix backend run test:w5-p2
npm --prefix backend run test:w5-p2:eval
npm --prefix backend run test:w5-p2:integration
npm --prefix backend run test:w4-p1:real-provider
```

Integration cần DB local cấu hình bí mật có quyền tạo schema; chạy schema test rollback, không yêu cầu migrate schema chung. Lệnh cuối chỉ PASS khi có key/provider miễn phí đã xác minh, tuyệt đối không đưa key lên Git/chat. Metadata chứng cứ live được runner hiện có lưu tại docs/testing/W4_P1_REAL_PROVIDER_EVIDENCE.json khi thành công.

Tự kiểm tra API/UI ở môi trường riêng: đăng nhập chính chủ, dùng run từ nguồn/tiêu chí đã xác nhận thật → xem căn cứ/model → sửa kế hoạch và đủ số năm → accept một lần. Thử accept lại/version cũ/tài khoản khác/nguồn stale phải bị chặn; không có award tự tạo. ADMIN kéo nguồn mô phỏng hai lần, kiểm tra revisions và quarantine; CSV sửa target/actual cùng mã/kỳ phải INVALID và không ghi một phần.

## Chưa hoàn tất nghiệm thu

Thiếu key model thật; thiếu nhà cung cấp KPI thật/hợp đồng nguồn và tombstone xóa; thiếu xác nhận độc lập mapping label/protocol recommender với W5-Q2 và tập holdout chất lượng checklist LLM. Chưa browser QA, chưa kiểm chứng tải đồng thời nhiều kết nối, chưa xác minh PR remote. Chi tiết ví dụ lỗi và giới hạn: PROTOCOL.md. Không coi fixture xác nhận là nguồn nghiệp vụ thật; không fallback thành công sang dữ liệu giả/model trả phí.

Commit đề xuất, chưa thực hiện: `fix(W5-P2): verify recommender quota and connector contracts; reject conflicting CSV imports`.
## Xác nhận chạy tích hợp ngày 08/10/2026

- `npm --prefix backend run test:w5-p2:integration`: exit 0; recommender **38 assertions PASS**, connector **53 assertions PASS**, KPI/CSV **96 assertions PASS**; outer rollback. Tổng lần này 187 assertions. Bộ connector được bổ sung đối soát CSV sau lần tổng hợp này, có kết quả chạy riêng bên dưới.
- Một lần chạy connector riêng cùng lúc với integration khác timeout SQL (57014) khi áp migration trong schema test. Đã rollback và chạy lại tuần tự; không tăng statement timeout và không coi lần lỗi là PASS. Vì các migrations có thể tranh khóa catalog, nên chạy các bộ DB tuần tự bằng script test:w5-p2:integration.
- Fault injection 429/504/500 xuất hiện trong log là kỳ vọng có assertion; khác với lỗi migration 57014 cần chạy lại.
- `git diff --check` và `node --check` cho kpiService.js/w4-p2.integration.js: PASS, chỉ cảnh báo Git chuyển LF/CRLF.

- `node backend/tests/w4-p2.integration.js` chạy lại tuần tự: exit 0, **67 assertions PASS**, gồm đối soát connector–CSV cùng target/unit/actual, import lặp và trạng thái staging giữ nguyên.
- Nghiệm thu live-provider còn kiểm tra `modelReportedByProvider=true`, `isMock=false`, `cached=false`; nếu upstream không báo model thực dùng, không xuất chứng cứ PASS chỉ dựa vào model yêu cầu.
- References/target được bảo toàn ở **3/3 gợi ý dương**; tổng 32/32 bao gồm 29 ca không tạo gợi ý, không dùng mẫu số đó để phóng đại citation precision.
- Sau sửa accept kiểm tra rule năm từ snapshot cho gợi ý lịch sử: `npm --prefix backend run test:w4-p1:integration` chạy lại **38 assertions PASS**, exit 0. Kết quả cuối theo từng bộ: recommender 38, connector+CSV 67, KPI/CSV 96; tổng 201 assertions từ các lần chạy thành công riêng, không phải một lần tổng hợp 201.
