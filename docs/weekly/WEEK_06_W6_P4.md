# W6-P4 — Bàn giao tư liệu sản phẩm Phước

Võ Nhạc Phước · 11/10/2026 (Asia/Saigon). Đầu ra: [docs/report-inputs/phuoc](../report-inputs/phuoc/README.md). Nghiệm thu release **BLOCKED**, bộ đầu vào đã gom để review. Không nhận báo cáo/slide hoàn chỉnh là sản phẩm task.

Kế hoạch thực hiện: đọc blueprint/source/API; dùng Supabase PostgreSQL/pg theo ADR-001 thay DB cũ, giữ auth Express/private file; kiểm dependency/PR; tái dùng ảnh P3 được kiểm hash; đối soát KPI/recommender/hiệu năng; viết mục lục/storyboard và giải thích phần phụ trách. Không có AGENTS.md tại root/ancestor/docs đã tìm. Không đổi endpoint/schema/nghiệp vụ.

## File đổi

- scripts/w6-p4-inputs.mjs: collector allowlist, manifest hash, đối chiếu source P3 và p95; verifier drift.
- docs/report-inputs/phuoc/: README, USE_CASES_AND_ASSETS, METRICS_REVIEW, REPORT_AND_SLIDES, DEFENSE_NOTES, performance.json, manifest.json, sáu ảnh images và năm bản lưu dependency-w6-p3.
- docs/weekly/WEEK_06_W6_P4.md: kế hoạch/kết quả/bàn giao này.

Giữ nguyên tài liệu Quang và bộ W5-P4. Không đọc/copy env/key/storage dump hoặc dữ liệu người dùng thật. Media tái dùng synthetic theo manifest P3, chưa chụp lại release.

## Kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
|---|---|
| npm --prefix backend run test:w6-q3 | exit0, 38/38 PASS; chỉ tài liệu/artefact, không HTTP/Supabase end-to-end |
| node scripts/w6-p4-inputs.mjs | exit0, gom25 assets, P3 integrated=false |
| node scripts/w6-p4-inputs.mjs --verify | exit0, PASS25 assets và5 dependency sources; release vẫn BLOCKED |
| node --check scripts/w6-p4-inputs.mjs | exit0, PASS cú pháp |
| git diff --check | exit0; file mới được kiểm whitespace riêng, không lỗi |
| p95 tính lại từ mẫu gốc | 4/4 khớp; achievements/dashboard load1650.780/2078.418, overlapping2167.016/2873.549ms |
| git merge-base --is-ancestor 3cb8789 HEAD | exit1, P3 chưa tích hợp |
| git tag --list v0.6-demo-ptud | Không có tag local |
| GitHub REST qua web tool | Không truy cập được; PR approval remote UNVERIFIED |

## Tự kiểm và phần chưa xong

Chạy verifier và testQ3 từ root; mở ảnh với caption, đọc METRICS_REVIEW và đối chiếu manifest/performance mẫu gốc. Các bản lưu P3 giữ nguyên văn lịch sử; link tương đối trong chúng thuộc vị trí gốc, README W6-P4 là điểm điều hướng chính.

W6-P3 tồn tại commit3cb8789 trên nhánh khác; phải tích hợp và chốt SHA trước quay/chụp lại. Q3 record trỏ afd2377 khác HEAD460c5bd, chưa tag; restore/provider live/máy thứ hai/review Quang và ngày quyết định còn mở. Không có ảnh KPI release thật hoặc xác nhận peer nhãn đúng Võ Nhạc Phước. W6-P4 không chạy DB/LLM mới để thay thế bằng chứng dependency, không tự sửa báo cáo Quang hoặc điền approval.

Chưa commit/push/merge. Đề xuất: `docs(W6-P4): collect Phuoc product evidence, review metrics and storyboard with release blockers`.
