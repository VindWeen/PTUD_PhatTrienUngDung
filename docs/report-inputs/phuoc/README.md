# W6-P4 — Tư liệu sản phẩm Võ Nhạc Phước

Ngày đối soát: 11/10/2026, Asia/Saigon. Đây là đầu vào biên soạn; không phải báo cáo hoặc slide hoàn chỉnh. **Nghiệm thu khớp release: BLOCKED**.

Đã đọc blueprint/ADR-001, hợp đồng API, mã KPI/recommender, bằng chứng hiệu năng và lịch sử Git. Không tìm thấy AGENTS.md tại root, các thư mục cha hoặc trong docs. Plan dùng Supabase PostgreSQL/schema app qua pg thay DB SQL Server cũ; giữ React/Vite/Tailwind, Express `/api/v1`, auth Express và file private. Không sửa nghiệp vụ, schema, quyền hoặc API.

## Bộ đầu vào

- [Ảnh và use case](USE_CASES_AND_ASSETS.md): sáu ảnh tích hợp lịch sử, chú thích nguồn và phần chưa nghiệm thu.
- [Số liệu và review Quang](METRICS_REVIEW.md): KPI/recommender, hiệu năng, giới hạn benchmark.
- [Mục lục báo cáo và storyboard](REPORT_AND_SLIDES.md): nội dung, ảnh, lời trình bày, gate theo từng slide.
- [Giải thích phần phụ trách](DEFENSE_NOTES.md): câu hỏi và căn cứ trả lời.
- [Manifest](manifest.json), [số liệu hiệu năng rút gọn](performance.json): SHA-256, baseline, đối soát p95 từ mẫu gốc.
- `dependency-w6-p3/`: bản chép nguyên byte từ Git commit P3 để review khi dependency chưa có trong checkout. Link tương đối bên trong các bản lưu này thuộc vị trí gốc `docs/testing/w6-p3`, không phải liên kết điều hướng của bộ W6-P4.

## Phụ thuộc và release

HEAD lúc gom: `460c5bd6976330789a01aa9d700d833c32d5b3a5`. W6-Q3 `b83c3d7` reachable; record của Quang trỏ `afd2377`, vẫn PENDING_RUN/tag PENDING; không có tag local `v0.6-demo-ptud`. Test tài liệu Q3 PASS không chứng minh một buổi demo hoặc release thật.

W6-P3 `3cb8789bf800678d5101f29cfff44584b4004ec6` tồn tại trên nhánh khác, **không reachable HEAD**. Tái dùng ảnh local có SHA-256 trùng manifest P3, nhưng baseline quay `2774075` + diff/harness. `awardsApi.js` và runner hiện tại không khớp hash recording; các page Achievements/AwardApplications/Awards khớp. Vì vậy ảnh được gắn nhãn lịch sử tích hợp thật với dữ liệu **MÔ PHỎNG**, chưa là ảnh release W6-P4. Không tự merge/cherry-pick dependency.

Đã đọc PR evidence P3: #1/#2 là tham chiếu merge trong lịch sử local; trạng thái review remote chưa xác minh. Thử đọc GitHub REST công khai 11/10/2026 không truy cập được bằng web tool. Không tạo PR hoặc điền approval.

## Điều kiện hoàn tất nghiệm thu

1. Tích hợp W6-P3 và chọn SHA release thống nhất với W6-Q3; cập nhật record/tag khi người dùng yêu cầu.
2. Chạy lại kịch bản API/pg/Supabase và chụp ảnh ở SHA đó; kiểm upload quyết định multipart, status/version, tải private/hash. Không chỉ đổi caption/SHA ảnh cũ.
3. Quang đối soát restore thực tế: Q3 còn thiếu target DB; P2/P3 trên nhánh dependency ghi FAIL 42703. Kiểm restored HTTP/hash và máy thứ hai, date quyết định lệch ngày trong P3.
4. Có review thật của Quang, xác nhận nguồn/tiêu chí và mapping nhãn bởi người có thẩm quyền; live provider nếu trình diễn phải có evidence riêng. KPI upstream hiện MÔ PHỎNG.

## Tự kiểm tra

Từ root: `node scripts/w6-p4-inputs.mjs --verify` kiểm hash/source HEAD; `npm --prefix backend run test:w6-q3` kiểm tài liệu release. Mở sáu ảnh, đọc caption kèm USE_CASES; đối chiếu p95 trong performance.json với mẫu gốc. Chỉ chạy `node scripts/w6-p4-inputs.mjs` để gom lại sau review nguồn, vì lệnh đó thay manifest và bản chép cho W6-P4.

Kết quả thực chạy và file đổi ở [WEEK_06_W6_P4](../../weekly/WEEK_06_W6_P4.md). Chưa commit/push/merge. Commit đề xuất: `docs(W6-P4): collect Phuoc product evidence, review metrics and storyboard with release blockers`.
