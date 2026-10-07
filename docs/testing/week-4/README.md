# W4-P4 — Review Validator và kiểm thử UI AI

Người phụ trách: Võ Nhạc Phước. Ngày: 07/10/2026 (Asia/Saigon).
Trạng thái: đã triển khai sửa lỗi và kiểm thử dưới đây; **chưa nghiệm thu toàn bộ tích hợp AI thật**.

## Phụ thuộc và phạm vi

Không tìm thấy AGENTS.md khi chạy `rg --files --hidden -g AGENTS.md -g '!node_modules' -g '!.git'` tại root.
Đã đọc PROJECT_DEVELOPMENT_BLUEPRINT.md, hợp đồng/nhật ký W4-Q3, W4-P1, mã evaluator, RAG, API và UI. ADR-001 đã thay SQL Server bằng Supabase PostgreSQL qua pg. Giữ Express auth, RBAC và private storage.
Local có W4-Q3 tại b7f6504 và W4-P1 tại b5bedf7; không thiếu mã phụ thuộc. Không xác minh được PR remote: gh không có trong PATH; GitHub REST trả lỗi SSL. Review local ở PR_REVIEW.md; chưa đăng review lên GitHub.

## Thay đổi

- AIForecast: bỏ fallback hai tiêu chí hardcode khi API lỗi/rỗng; hiển thị loading, hướng xử lý và khóa submit khi chưa có tiêu chí. Dùng đúng criteria_version_id/criterion_code của API.
- Nhãn mock/dự phòng và hướng xử lý provider lỗi/quota, thiếu căn cứ; tab xuống dòng trên màn nhỏ. Khi tải lịch sử, xóa giải thích và stale của phiên trước. Không ghi dữ liệu đồng nhất trước kiểm tra stale.
- RAG: không tự ghép nguồn cho câu không citation; câu có mã nguồn không tồn tại bị thay bằng thông báo chưa đủ căn cứ, citations rỗng. Lưu is_sufficient_data theo kết quả kiểm tra. Không đưa thông báo lỗi thô của vendor vào phản hồi.
- Retrieval/citation mang versionId và sourceUrl từ DB; UI chỉ tạo link HTTP(S), mở tab mới với noopener/noreferrer. Không có URL thì báo cần bổ sung tài liệu gốc.
- Với runId: controller lấy criterionResult và ngày từ phiên đã lưu sau kiểm tra scope, từ chối criterion không thuộc phiên. Không tin các con số client gửi để lưu giải thích của phiên.

## Lệnh và kết quả thực tế

| Lệnh (tại root trừ khi ghi khác) | Kết quả |
|---|---|
| node --test backend/tests/w4-p4.test.js backend/tests/w4-q2.test.js backend/tests/w4-p1.test.js backend/tests/w4-q1.test.js | 21/21 pass; riêng W4-P4 5 ca |
| node backend/tests/w4-p1.integration.js | 28 assertions pass; Express + Supabase thật, schema tổng hợp riêng rollback; provider STUB |
| benchmark('development') import từ scripts/w3-p4-eval.mjs | 12/12 deterministic guards; corpus.json; không sửa corpus/holdout |
| npm run lint (frontend) | Pass |
| npm run build (frontend) | Pass; cảnh báo chunk JS 575.28 kB (>500 kB) |
| node scripts/w4-p4-ui.cjs | Pass với Playwright runtime có sẵn và Edge headless; loading/error/quota/missing-data; 390 px không tràn ngang, thêm ảnh 1440 px |
| node backend/tests/w4-p1.real-provider.js | Exit 1 BLOCKED: thiếu cấu hình key provider server-only; không gọi vendor |
| git diff --check | Pass (chỉ cảnh báo quy đổi LF/CRLF) |

Chạy UI: khởi động `npm run dev -- --host 127.0.0.1 --port 5173` trong frontend, đặt W4_PLAYWRIGHT_PATH trỏ package playwright đã cài, rồi chạy script tại root. Script route toàn bộ API sang dữ liệu tổng hợp, không dùng token hay hồ sơ thật. Không cần sửa auth sản phẩm. Ảnh trong media là fixture UI, **không phải bằng chứng tích hợp Supabase UI thật**. Video chưa ghi do runtime thiếu ffmpeg; đã lưu ảnh theo yêu cầu ảnh/video. Log .log cục bộ bị .gitignore loại; số liệu bàn giao được lưu trong results.json.

## Tự kiểm tra / phần còn lại

1. Đăng nhập tài khoản được cấp quyền, mở /me/ai-forecast. Mất API tiêu chí phải hiện hướng xử lý và khóa nút; không xuất hiện CSTĐCS/NCKH tự tạo.
2. Với tiêu chí/nguồn đã xác nhận, chạy trên hồ sơ thử nghiệm được phép. Xem snapshot/hash, mở lịch sử, kiểm tra stale, thử tài khoản ngoài scope nhận 403. Chưa chạy lại suite Q3 trên schema app chung vì suite hiện index nguồn và ghi run vào dữ liệu chung; cần chuyển suite sang schema cô lập trước khi dùng làm bằng chứng hồi quy.
3. Gọi RAG có runId, sửa criterionResult phía client: backend phải dùng kết quả đã lưu; criterion không thuộc phiên trả 400.
4. Dùng provider thật sau khi quản trị cấu hình key server-only; hết quota phải có hướng chuyển provider/thử lại và giữ kết quả tiêu chí. Không nhập key vào repository.
5. Bấm từng link nguồn và đối chiếu mã tài liệu/phiên bản/Điều/Khoản/Trang/hash. Chưa có bằng chứng mở link nguồn thực tế: sourceUrl chỉ là metadata lưu trong DB, chưa chứng minh nội dung URL trùng phiên bản. Đây là **điều kiện chặn nghiệm thu citation**, không tuyên bố đã đạt.
6. Kiểm tra màn 390 px và desktop bằng ảnh fixture; bổ sung phiên UI nối DB thật và ảnh đã loại thông tin cá nhân trước nghiệm thu.

KPI mô phỏng/corpus không được xem là KPI đã xác minh. Không thay ngưỡng nghiệp vụ, không tự trao thưởng, không sửa auth/private files hay migration dữ liệu chung. Không commit/push/merge.

Commit đề xuất: `fix(W4-P4): fail closed AI citations and validate evaluation UI states`.
