# W6-P3 — Quay video và tổng hợp minh chứng hai người

Võ Nhạc Phước · 09/10/2026 (Asia/Saigon). Baseline `2774075b319964a9fd4839070a428bd4fe667a09` (W6-P2); W6-Q2 `afd237763d903f990fc1b84f9aab9c1489eac404` có trong HEAD. Không tìm thấy AGENTS.md trong repo hoặc thư mục cha đã kiểm. Blueprint/ADR-001 chốt Supabase PostgreSQL qua pg thay SQL Server; giữ Express auth và private storage, tái sử dụng chức năng/runner đã có.

## Triển khai và phạm vi video

Thêm hook `W6_P3_VIDEO=1` vào runner W5-P3. Runner migrate/seed 25 Supabase migrations vào schema ngẫu nhiên riêng, đăng nhập mật khẩu thật, tạo Council qua Admin API chỉ trong schema test. File và quyết định mẫu ghi MÔ PHỎNG; không đưa secrets/dữ liệu vận hành vào Git. Schema dọn trong finally, kho private thử nghiệm nằm trong output bị ignore; không thay app hoặc kho người khác.

Recorder ghi liên tục CDP screencast từ Edge headless, encode WebM bằng MediaRecorder trong browser theo thời gian thật; có caption tiếng Việt, không âm thanh, không ghép ảnh thành video hay tải encoder. Kịch bản sáu vai trò: Admin/scope → cá nhân/tập thể kê khai/upload/nộp qua HTTP thật → Manager xác nhận/CSV → RecordsOfficer mở kỳ → cá nhân tạo/nộp đề nghị UI → Manager chuyển UI → Council phân công/ý kiến/kết luận UI → RecordsOfficer quyết định/file/RECORDED UI. Caption nói rõ bước HTTP và UI. Kiểm 403 sai role, 409 phiên cũ, 400 thiếu file; kết luận Council không tạo AwardDecision/AwardRecord; tải private quyết định so SHA256/size.

Không thay endpoint/payload hoặc mã auth/RBAC/trạng thái của sản phẩm. Hợp đồng tái dùng: ACHIEVEMENTS_CRUD_W2_Q1, EVIDENCE_FILES_W2_Q2, ACHIEVEMENTS_W2_Q3, ADMIN_W2_P1, REPORTS_W3_P1, AWARD_APPLICATIONS_W3_P3, COUNCIL_W4_P3, AWARDS_W2_P2. Không cần endpoint/hợp đồng API mới. Không gọi AI, xác nhận căn cứ nghiệp vụ hoặc suy ra trao thưởng.

Quay thật phát hiện upload quyết định UI trả 400: awardsApi.upload gửi FormData nhưng kế thừa Content-Type application/json của apiClient. Sửa riêng request upload sang multipart/form-data theo cách module evidences hiện có, để trình duyệt tạo boundary và gửi byte file. Backend multer/validateUploadedFile, quyền/scope và trạng thái vẫn giữ nguyên. Bộ quay kiểm request có boundary, HTTP 201 và tải file đúng hash; sourceHashes gồm awardsApi.js đã sửa, không gọi đây là bản HEAD thuần.

## Đóng góp, PR và review

Xuất lịch sử Git reachable từ HEAD ra CSV/JSON/bảng Markdown: full SHA, tác giả/committer nguyên bản, ngày Git nguyên bản, parents, task từ subject hoặc tên file có nhãn association. Không tạo commit rỗng, đổi tác giả hay lùi ngày để chia đều. Có 64 commit, 3 nhãn tác giả: Phước 23 non-merge + 1 merge; Quang 32 non-merge + 6 merge; VindWeen 2 merge. Không đồng nhất VindWeen với người khác. Số commit không là số giờ hay chất lượng đóng góp. W6-P3 chưa có commit riêng nên không cộng một SHA mới vào thống kê.

PR #1/#2 xuất từ merge subject local với merge SHA/parents; `git ls-remote origin 'refs/pull/*/head'` exit 1 SEC_E_NO_CREDENTIALS. Không có artifact PR trong chat, không xác nhận được GitHub review/merge live, không tạo PR URL theo suy đoán cho task khác. Link commit là tham chiếu theo SHA local, chưa chứng minh đã push.

Review Quang W5-Q4 ở `d3986f0` đã kiểm trong repo, phân biệt kết quả lịch sử với review mới. W6-Q2 ghi restore NOT_RUN trong CI; W6-P2 đã tái hiện restore thật FAIL 42703 verified_by. Chưa có artefact Quang review W6-P2/video hoặc hai người ký release. [Phiếu review/release](../testing/w6-p3/REVIEW_RELEASE.md) giữ trống phần xác nhận, ghi mục tiêu 28/10/2026 và các gate cụ thể; không gửi tin nhắn hay tự tag/merge/publish.

## Kiểm chứng thực tế

| Lệnh | Kết quả |
|---|---|
| `node --check scripts/w6-p3-video.mjs` / recorder / evidence / verify-video và runner W5-P3 | PASS ở các lần kiểm cú pháp |
| `node --test backend/tests/w6-q1.test.js backend/tests/w6-q2.test.js backend/tests/w5-q4.test.js` | 93/93 PASS, 15 suites, exit 0; test cấu trúc/regression không thay restore thật |
| `npm --prefix frontend run build` | PASS exit 0 sau sửa multipart; cảnh báo chunk >500 kB còn |
| `npm --prefix frontend run lint` | PASS exit 0 sau sửa multipart |
| `W6_P3_VIDEO=1; node backend/tests/w5-p3.integration.js` | Lượt cuối PASS exit 0: 25 migrations/seed, 5 seed HTTP login và 6 browser login, sáu vai trò/17 mốc; W5-P3 status INSTALL_PASS_RESTORE_NOT_RUN; schema dọn |
| `node scripts/w6-p3-verify-video.mjs` | PASS exit 0: WebM VP9 1280×720, decode/seek 4 mốc; đã xem trực tiếp 4 ảnh playback |

Video cuối dài theo thời gian capture **306.706 giây (~5:07)**, 15,852,561 bytes, 628 CDP frame updates, frameFailures=0; có caption tiếng Việt, không âm thanh. Recording-result status PASS, 14 API calls qua helper và các request UI thật trong log. Kết luận Hội đồng giữ số quyết định/bản ghi 0→0; multipart có boundary, upload 201, thiếu file 400; file private tải 611 bytes đúng SHA256 `b85862f563a709fb023f6c215b26de9284d0230512de2c7e8ea62c97f390ec8c`. Không tính thao tác fixture là PASS.

Log `output/w6-p3/recording.log`, report `output/w6-p3/recording-result.json`; runner install `output/w5-p3/befe03e198ca/result.json`. Video ghi từ 21:30:28 đến 21:35:35 ngày 09/10/2026 (Asia/Saigon; timestamps trong JSON là UTC). MediaRecorder WebM chưa có duration index hữu hạn trong metadata; player Edge đã decode và seek các mốc 43.328/256.952/302.331/304.216 giây thành công, thời lượng ghi ở report/timeline.

Các lượt quay đầu FAIL selector dropdown và chuyển trang/refresh đang chạy; lượt thứ ba đi tới RECOMMENDED rồi phát hiện upload UI 400. Lượt thứ tư gặp HTTP login 500 do pg-pool timeout kết nối Supabase. Giữ video/log lỗi ở output/w6-p3-attempt1/2/3/4, không dùng làm video nghiệm thu. Harness đổi selector, điều hướng qua menu SPA/chờ request hoàn tất và giới hạn pool test còn 3 kết nối khi W6_P3_VIDEO=1; chỉ sửa header upload quyết định cần cho demo, không sửa auth hoặc mock API để lấy PASS. Video menu SPA không chứng minh refresh/reload đồng thời an toàn; log 401 của lượt reload đầu vẫn được giữ.

## Minh chứng và tự kiểm

[Index video/test/ảnh](../testing/w6-p3/README.md) → [timeline](../testing/w6-p3/TIMELINE.md) → [bảng đóng góp](../testing/w6-p3/CONTRIBUTIONS.md) → [manifest SHA256](../testing/w6-p3/evidence-manifest.json). Media local trong output/w6-p3, Git ignore; clone đơn thuần không có video. Bàn giao kèm cả thư mục media và manifest, không kèm .env/dump/backup.

Làm các lệnh quay, decode và export/verify trong index. Chạy DB integration tuần tự. Tự mở video tại các mốc VERIFIED/RECOMMENDED/RECORDED, đối chiếu action HTTP/UI và 403/409/400. Kiểm SHA với `git show --no-patch --format=fuller <SHA>`; chạy `node scripts/w6-p3-evidence.mjs --verify`. Quang review độc lập, ghi SHA/source/media và GO/NO-GO thật vào phiếu, không điền thay.

## Phần còn mở

Video trên schema mới tích hợp thật, **không phải schema đã restore**. W6-Q2 chưa đủ nghiệm thu restore; lỗi 42703 của W6-P2 vẫn là blocker, chưa có HTTP/browser/file quyết định restored, người xem đi hết checklist sau restore hoặc cài máy thứ hai. Provider AI live/quota và p95 dashboard <2s chưa có bằng chứng mới. PR live và Quang ký review/release còn thiếu. Release 28/10 là mục tiêu tương lai, chưa chốt chung hoặc có tag thực tế.

QA ảnh playback thấy ngày quyết định UI hiển thị 2026-10-08 trong khi kịch bản điền 2026-10-09. Chưa đối soát DATE/serialization/timezone độc lập sau schema đã dọn; ghi issue cho review trước release, không tự xác nhận ngày hiển thị đúng hoặc sửa thêm nghiệp vụ ngoài phạm vi quay. Test status/hash PASS không bao phủ ngữ nghĩa ngày.

## File đổi

- `backend/tests/w5-p3.integration.js`: hook video/pool max 3 tùy chọn, giữ hành vi mặc định W5-P3/W6-P2.
- `scripts/w6-p3-{video,recorder,verify-video,evidence}.mjs`: quay, kiểm playback và xuất/kiểm hash + Git history.
- `frontend/src/services/awardsApi.js`: gửi đúng multipart cho upload file quyết định; `docs/api/AWARDS_W2_P2.md`: ghi rõ cách gọi và hồi quy W6-P3.
- `docs/testing/w6-p3/`: index, timeline, bảng/CSV/JSON commit, PR evidence, manifest, phiếu review/release.
- `docs/weekly/WEEK_06_W6_P3.md`, README.md: bàn giao và link minh chứng.

Chưa commit/push/merge. Đề xuất commit: `fix(W6-P3): record integrated demo and correct decision multipart upload with SHA evidence`.
