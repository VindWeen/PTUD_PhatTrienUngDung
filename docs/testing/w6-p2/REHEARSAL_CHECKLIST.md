# W6-P2 — Checklist tổng duyệt

Võ Nhạc Phước · 09/10/2026 (Asia/Saigon). Baseline `16ee566`. Chỉ đánh dấu PASS khi có bằng chứng; ô trống là việc người xem chưa thực hiện. API/DB thật với dữ liệu tổng hợp khác với dữ liệu vận hành thật.

## Kế hoạch và phụ thuộc

Áp dụng ADR-001: React/Vite/Tailwind → Express `/api/v1` → Supabase PostgreSQL qua pg thay DB SQL Server cũ. Giữ Express auth và file private. Tái sử dụng W6-P1 (`16ee566`), W5-P3 (`37a381e`), W4-P3 Hội đồng, W2-P2 RecordsOfficer và các runner schema riêng. Không chạy seed/migrate lên app đang dùng hoặc thay công việc Quang.

Không tìm thấy AGENTS.md trong repo và ba thư mục cha C:/, C:/Drive D/, root dự án. Hợp đồng đã đối chiếu: AWARDS_W2_P2, AWARD_APPLICATIONS_W3_P3, COUNCIL_W4_P3, W6_P1_FINAL_FIXES và mã routes/pages/services/backend. Chat không có PR đính kèm; `git ls-remote origin 'refs/pull/*/head'` thất bại SEC_E_NO_CREDENTIALS. Commit local chứng minh mã có trong checkout, không chứng minh PR remote đã merge.

## Chuẩn bị máy/tài khoản (trước buổi diễn)

- [ ] Người vận hành: __________; máy/OS: __________; Node/npm: __________; thời điểm: __________.
- [ ] Làm README/GETTING_STARTED trên môi trường demo riêng; backend và Vite cùng chạy, `VITE_DATA_SOURCE=api`, readiness DB UP. Build/lint thành công. Không mở env/token trên màn chiếu.
- [ ] Đăng nhập riêng an.nv, bich.tt, cuong.lh, duc.pm, records.demo; `demo1234` chỉ dùng demo riêng. Mỗi vai trò dùng phiên trình duyệt riêng hoặc đăng xuất trước đổi.
- [ ] Admin tạo Hội đồng demo riêng (không có role nghiệp vụ khác), cấp COUNCIL và scope/thời hạn hợp lệ; ghi username/mã user vào phiếu cục bộ, không ghi mật khẩu/token vào Git.
- [ ] Phiếu mã tham chiếu cục bộ: giảng viên ___; đơn vị cá nhân ___; đơn vị tập thể ___; loại thành tích cá nhân/tập thể ___; loại thưởng ___; kỳ ___; reviewer user ID ___; achievement ID ___; application ID ___; decision/record ID ___. Lấy từ API/danh mục thực tế, không đoán ID theo fixture.
- [ ] PDF/ảnh/DOCX mẫu hợp lệ không có dữ liệu thật; quyết định ghi MÔ PHỎNG; kho file minh chứng và kho file quyết định có quyền đọc/ghi và được backup đủ.
- [ ] Chọn năm có dữ liệu, kỳ đang mở, đại diện và scope còn hiệu lực. Chuẩn bị hai phiên cùng hồ sơ cho ca 409; một tài khoản ngoài scope do vận hành cấp cho ca 403.
- [ ] Nếu trình diễn AI: nguồn ACTIVE và tiêu chí được người có thẩm quyền xác nhận; ghi chế độ/provider/quota đã kiểm. Không có thì để NOT_RUN/thiếu dữ liệu, không bịa căn cứ. KPI mock/CSV thử nghiệm ghi MÔ PHỎNG.

## Người xem đi hết kịch bản

Ghi kết quả, HTTP status khi có lỗi, mã hồ sơ, lịch sử/version và đường dẫn ảnh/log cục bộ vào cột cuối. Ảnh không chứa token hoặc dữ liệu thật.

| ID | Người xem thực hiện theo USER_GUIDE | Kết quả bắt buộc | Kết quả/người kiểm |
|---|---|---|---|
| R01 | an.nv tạo nháp, upload/tải file, nộp | DRAFT → SUBMITTED; tải đúng byte, snapshot giữ phiên bản | ___ |
| R02 | bich.tt yêu cầu bổ sung; an.nv sửa/gửi lại; bich.tt xác nhận | Lý do/lịch sử đủ, VERIFIED; không tạo award record | ___ |
| R03 | cuong.lh tạo/nộp tập thể đúng đơn vị; Manager xác nhận | Chủ thể UNIT, không cộng cá nhân thành tập thể | ___ |
| R04 | duc.pm xem tài khoản/vai trò/scope, tạo Council demo | Cấp vai trò/scope đúng thời hạn; không thay quyền Manager/RecordsOfficer | ___ |
| R05 | records.demo mở kỳ; cá nhân/tập thể nộp đề nghị từ VERIFIED | Input đóng băng, SUBMITTED; không ghi nhận thưởng | ___ |
| R06 | Manager chuyển; Council phân công và ghi ý kiến | COUNCIL_PENDING → UNDER_REVIEW; ý kiến tăng version | ___ |
| R07 | Council yêu cầu bổ sung; chủ thể gửi qua Manager; Council kết luận | RECOMMENDED/NOT_RECOMMENDED, lịch sử/thông báo; không tạo quyết định/RECORDED | ___ |
| R08 | records.demo nhập quyết định/file mẫu, ghi nhận, tải file | DRAFT → RECORDED với quyết định/file; SHA256/size khớp | ___ |
| R09 | RecordsOfficer thu hồi có lý do, chuẩn bị bản thay thế | Lịch sử/file cũ giữ nguyên; không sửa RECORDED trực tiếp | ___ |
| R10 | Reports lọc/xuất CSV, KPI 0%, nguồn ngoài → kê khai | Cùng filter; 0% đúng; MÔ PHỎNG; kê khai chỉ DRAFT | ___ |
| N01 | an.nv mở /admin và GET /admin/users bằng token giảng viên | UI /404; API 403; không thay dữ liệu | ___ |
| N02 | Admin-only xác nhận/ghi nhận; Manager tự xác nhận | 403; không đổi trạng thái/lịch sử | ___ |
| N03 | Council chưa được giao/ngoài scope; đại diện hết hạn | 403; không ghi ý kiến/kết luận/tập thể | ___ |
| N04 | Hai phiên cùng version thao tác lần lượt | Phiên cũ 409; tải lại trước thao tác tiếp | ___ |
| N05 | Anonymous/giảng viên ngoài quyền tải minh chứng private | 401 và 403/404; không có public URL | ___ |

Nghiệm thu thuật ngữ: người xem giải thích được **xác nhận = VERIFIED**, **đề nghị = RECOMMENDED**, **ghi nhận = RECORDED** và không gọi ba thao tác là trao thưởng tự động.

## Review cài/restore của Quang

W6-Q2 có 36 test cấu trúc; W6-Q1 có 37 test, không thay bằng chứng restore end-to-end. Runner/backup thực tế đọc 25 file `supabase/migrations`; `database/migrations/009...` là legacy và không nằm trong nguồn đó. Supabase migration W2-Q3 đã có verified_by; cần kiểm cả dump DDL hiện tại và schema thực, không kết luận lỗi 42703 còn tồn tại hoặc đã hết chỉ dựa migration 009.

DEMO_VERSION_CONFIG của W6-Q1 ghi Vite 5/Node >=18 và migrations 001–009; package/README hiện dùng Vite 6, Node 20.19+/22.12+ và nguồn supabase. Dùng package-lock + migration status thực tế cho máy demo. Note ngày 28/10 là cấu hình mô tả; không coi là bằng chứng backend tự chọn quy định đúng nếu chưa kiểm nghiệp vụ. Giữ nguyên artefact Quang, ghi khác biệt tại đây.

- [ ] Clone/cài độc lập máy thứ hai, lưu phiên bản/lệnh/exit code; W5-P3 trước đó chỉ cài sạch trên cùng Windows.
- [ ] Chọn gói backup và đích schema/storage test riêng; không ghi đè app hoặc kho người khác.
- [ ] Restore mới PASS; ghi commit, tên migration/checksum, phiên bản DB, manifest và hash file cùng thời điểm.
- [ ] Sau restore, HTTP owner tải đúng SHA256/size, anonymous 401, ngoài quyền 403/404; lịch sử đúng; kiểm cả file quyết định.
- [ ] Chạy lại kịch bản browser trên DB/storage đã restore. Không dùng DB nguồn thay DB restored.

Gate release còn mở cho đến khi các ô trên có bằng chứng. Chi tiết kết quả lệnh và blocker mới nhất ở [bàn giao W6-P2](../../weekly/WEEK_06_W6_P2.md).

W6-P2 đã chạy restore gói cục bộ `backups/w5p3_http` vào schema ngẫu nhiên: **FAIL 42703 verified_by** tại Data DML; schema test được dọn. DDL đã chứa ADD COLUMN nhưng điều kiện literal table_schema vẫn là app nguồn. Đây là blocker thực tế mới, không chỉ NOT_RUN từ CI Quang. HTTP và browser trên DB restored chưa chạy được.
