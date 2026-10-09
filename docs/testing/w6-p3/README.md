# W6-P3 — Video và minh chứng hai người

Phụ trách: Võ Nhạc Phước. Dữ liệu trong video là **MÔ PHỎNG**, browser → Vite → Express `/api/v1` → pg/Supabase thật, file private. Không dùng phản hồi fixture để nghiệm thu. Video WebM VP9 1280×720, ~5:07, không có âm thanh; caption tiếng Việt ghi vai trò, thao tác và kết quả thực tế. Kê khai/nộp/xác nhận thành tích dùng HTTP thật và được ghi rõ; hồ sơ đề nghị, Hội đồng và RecordsOfficer dùng nút/form UI thật.

- [Video demo WebM local](../../../output/w6-p3/demo.webm).
- [Timeline task/SHA/ảnh](TIMELINE.md), [recording-result](../../../output/w6-p3/recording-result.json), [log chạy thật](../../../output/w6-p3/recording.log).
- [Kiểm decoder/timeline video](../../../output/w6-p3/video-validation.json); ảnh playback được giải mã từ video, ảnh images được chụp trong lúc quay.
- [Bảng đóng góp](CONTRIBUTIONS.md), [CSV](commits.csv), [JSON nguyên tác giả/committer/ngày/parents](commits.json), [PR evidence](prs.json).
- [Manifest SHA256/bytes](evidence-manifest.json), [review hai người và release 28/10](REVIEW_RELEASE.md).
- [Hồi quy phụ thuộc 93 ca](../../../output/w6-p3/dependency-tests.log).
- [User guide cuối](../../USER_GUIDE.md), [checklist W6-P2](../w6-p2/REHEARSAL_CHECKLIST.md), [bàn giao W6-P3](../../weekly/WEEK_06_W6_P3.md).

SHA chạy là baseline `2774075b319964a9fd4839070a428bd4fe667a09` cộng hash harness và sửa header multipart upload quyết định W6-P3 chưa commit. Không tự gán SHA mới cho W6-P3. SHA video/file là SHA-256 nội dung, khác SHA commit Git. Link GitHub là tham chiếu SHA local; trạng thái PR live chưa xác minh. Ngày Git là ngày ghi trong lịch sử, không chứng minh đã release hoặc đã peer approve.

Video quay trên schema mới được migrate/seed riêng, **chưa trên DB restored**. Restore W6-P2 còn FAIL 42703; các gate restore/file restored/người xem độc lập và Quang review video vẫn mở. Kết luận RECOMMENDED không tạo quyết định/AwardRecord; ghi RECORDED cần quyết định/file mô phỏng riêng. AI không chạy; không xác nhận căn cứ hay tuyên bố accuracy. KPI upstream của project phải giữ nhãn MÔ PHỎNG.

QA playback còn ghi nhận ngày quyết định hiển thị lệch một ngày so với form; gate DATE/timezone ở REVIEW_RELEASE còn mở. Metadata WebM không có duration index hữu hạn; dùng 306.706 giây ở recording-result và các mốc seek đã kiểm trong video-validation, không gọi đây là MP4 đã index.

## Quay và xuất lại

Từ root, cần Node/dependencies backend/frontend, Edge và module Playwright có sẵn, cấu hình DB server-only có quyền tạo/xóa schema test. Không seed/migrate DB app dùng chung. Chạy các runner DB tuần tự, không đưa env/token vào lệnh/log công khai:

```powershell
$env:W6_P3_VIDEO='1'
$env:W6_PLAYWRIGHT_PATH='<đường dẫn module Playwright đã cài>'
node backend/tests/w5-p3.integration.js
Remove-Item Env:W6_P3_VIDEO,Env:W6_PLAYWRIGHT_PATH

$env:W6_PLAYWRIGHT_PATH='<đường dẫn module Playwright đã cài>'
node scripts/w6-p3-verify-video.mjs
Remove-Item Env:W6_PLAYWRIGHT_PATH
node scripts/w6-p3-evidence.mjs
node scripts/w6-p3-evidence.mjs --verify
```

Recorder dùng CDP screencast và MediaRecorder trong Edge, quay liên tục theo thời gian thật; không ghép ảnh tĩnh thành video và không tải encoder/dịch vụ ngoài. Pool test giới hạn 3 khi quay để hạn chế số session Supabase; pool sản phẩm giữ nguyên. Việc chờ 1.8 giây cho caption là thời gian đọc có chủ ý. Nếu script FAIL, không dùng đoạn dang dở làm video nghiệm thu; log và recording-result phải cùng lượt. Các lần lỗi trước giữ ngoài bộ final, trong output/w6-p3-attempt*.

Sau khi người dùng yêu cầu commit W6-P3, cần xuất lại/đối chiếu metadata cho SHA mới; không đổi baseline trong video cũ để gọi đó là video của SHA mới. Quay lại khi mã nghiệp vụ thay đổi. `--verify` phát hiện file thiếu/đổi hash/bytes và kiểm mọi SHA Git được liệt kê còn resolve; không chứng minh PR live approval.

## Bàn giao và tự kiểm

Media/log cục bộ bị Git ignore; clone riêng sẽ không có video. Bàn giao **cả output/w6-p3 và docs/testing/w6-p3**, không đưa gói backup, storage dump hoặc .env vào gói. Thư mục output/w5-p3 chứa schema/private file thử nghiệm không cần gửi để xem video.

1. Chạy `node scripts/w6-p3-evidence.mjs --verify` từ root; kiểm không có hash drift.
2. Mở video, xem các mốc VERIFIED, RECOMMENDED, RECORDED; đối chiếu timeline/report và caption thao tác HTTP/UI. Xem các ca 403, 409, thiếu file 400 và tải quyết định đúng SHA256.
3. Kiểm bảng tác giả bằng `git show --no-patch --format=fuller <SHA>`; không đổi VindWeen thành người khác. Task FILE_NAME_ASSOCIATION cần đối chiếu phân công trước dùng làm kết luận trách nhiệm.
4. Quang ghi review thực tế và source/media SHA vào phiếu REVIEW_RELEASE; Phước ghi kết quả tự xem. Không điền thay người còn lại.
5. Đóng blocker restore và kiểm các gate trước cùng quyết định GO/NO-GO ngày 28/10/2026.
