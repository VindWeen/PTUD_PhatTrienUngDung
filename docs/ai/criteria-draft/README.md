# W2-P4 — Bộ tiêu chí demo dự thảo

Võ Nhạc Phước · 06/10/2026 · `W2-P4-draft-1` · baseline `f091c57` trên nhánh `w2-p4`.

**Chốt phạm vi demo mô phỏng; chưa xác nhận áp dụng quy chế LHU; chưa chấp thuận nghiệm thu submit/file.** `criteria.json` giữ đúng 4 mục tiêu W1-P4, không thêm Q1/Q2 hoặc KPI. Các số 02/03/01/100% có nguồn W1-P4, không phải ngưỡng pháp lý. `demo.fixtures.json` mang nhãn mô phỏng, không có deadline/mẫu hội đồng được tự điền. Từng mục có nguồn/phiên bản, trạng thái xác nhận, điều khoản liên quan, tiêu chí máy kiểm tra và người xác nhận.

## Quy tắc dùng bộ draft

- Chỉ dùng cho review và demo; không nạp vào AI như tiêu chí xét thưởng đã xác nhận.
- `CHUA_XAC_DINH` khi thiếu nguồn, phiên bản, thời điểm, mẫu, định danh hoặc xác nhận; thiếu dữ liệu không tự coi là không đạt.
- Số lượng/file/status là kiểm tra kỹ thuật. Nội dung, đóng góp, giá trị nghiên cứu, thẩm quyền và áp dụng quy chế do người có trách nhiệm xác nhận.
- Không suy ra xác suất nhận thưởng, không tạo AwardRecord từ KPI/AI; W2-P2 chỉ nhập quyết định và ghi nhận theo quyền.
- `LHU-REQ-001` còn thiếu: **CHƯA XÁC NHẬN ÁP DỤNG** cho cán bộ/giảng viên/nhân viên LHU. Không dùng quy chế sinh viên hoặc bài tin công khai để thay thế.

## Đối chiếu nguồn sau 01/10

Đã tải bản công bố từ nguồn chính thức, kiểm SHA-256 và xem các trang scan liên quan vào 06/10/2026. `sources.json` ghi URL, phiên bản, hash, trang và mức kiểm chứng. Xem [đối chiếu điều khoản](SOURCE_REVIEW.md). Kiểm chứng điều khoản không đồng nghĩa LHU xác nhận áp dụng; chưa thể khẳng định đã rà soát mọi sửa đổi mới trên toàn bộ hệ thống văn bản.

Các liên kết tới Luật/Thông tư ở từng criterion chỉ hỗ trợ kiểm tra đối tượng/hiệu lực/chuyển tiếp. Không tìm được căn cứ xác nhận các con số demo là tiêu chuẩn xét thưởng từ các điều khoản đã đối chiếu. Không gán nguồn luật cho con số fixture.

## Plan W2-P4 và DB

Tái sử dụng ADR-001 trong `docs/PROJECT_DEVELOPMENT_BLUEPRINT.md` mục 3: Supabase PostgreSQL/schema `app` qua `pg` pool/TLS **thay SQL Server trong kế hoạch cũ**; auth JWT/refresh cookie do Express quản lý, file private chỉ tải qua API có quyền. Không thêm Supabase Auth hoặc public bucket, không sửa migration đã chạy.

1. Review baseline: W1-P4 (`bb6eb73`), W2-P2 (`53167d8`), W2-Q2 (`d8448d8`), W2-Q3 (`f091c57`). Hợp đồng và ma trận đối chiếu nằm trong [API review](../../api/W2_P4_DEMO_REVIEW.md).
2. Demo fixture cho 4 mục tiêu; máy chỉ kiểm tra dữ liệu có sẵn, người xác nhận căn cứ. Giữ status UNCONFIRMED cho quy chế LHU.
3. Chạy Express + Supabase thật trong schema riêng, outer transaction rollback và cleanup đúng file do test tạo. Không chạy seed/migrate trên schema `app` chung.
4. Giải quyết findings quyền/scope/snapshot/audit, chốt quy chế và mẫu thực tế, rồi chạy nghiệm thu đầy đủ. Không thay thế tích hợp bằng fixture.

## Test và tự kiểm tra

```powershell
npm --prefix backend run test:w2-p4
npm --prefix backend run test:w2-p4:integration
npm --prefix backend run test:w2-q3
node scripts/validate_contracts.mjs
```

Test tích hợp thực thi cá nhân/tập thể, submit/bổ sung/resubmit/verify, snapshot v1/v2 và tải bytes cũ, chặn file VERIFIED cho lecturer/admin/records officer, version cũ, tự duyệt, scope/đại diện hết hạn, rollback khi notification lỗi và quyết định W2-P2. Kết quả `REPRO` là chứng minh lỗi, không phải pass nghiệm thu. Harness chạy tuần tự trên một pg client dùng savepoint; test interleaving là mô phỏng trình tự lỗi, không phải benchmark hai transaction đồng thời.

Tự kiểm tra UI với dữ liệu fixture riêng: `/achievements` tạo nháp cá nhân/tập thể, thêm PDF, submit, Manager yêu cầu bổ sung, thay v2, resubmit và verify; so snapshot hai lần và tải v1. Sau VERIFIED mọi vai trò thử thêm/thay/xóa file phải bị chặn. Dùng token khác chủ/ngoài scope, đại diện hết hạn và version cũ để thử từ chối. `/awards` phải có RecordsOfficer đúng scope, quyết định/file gốc trước ghi nhận. `/ai-forecast` hiện vẫn có gợi ý Q1/Q2/phần trăm mô phỏng cũ: không dùng chúng để diễn giải criteria này.

## Xác nhận còn cần

GVHD/LHU cung cấp quy chế nhân sự, quyết định ban hành, phụ lục tiêu chí, phiên bản/ngày áp dụng, mẫu hội đồng, đối tượng và chuyển tiếp. Mỗi criterion cần ghi người/ngày/bằng chứng xác nhận trước đổi sang CONFIRMED. SIM-KPI-02 chưa có nguồn/API hướng dẫn chuyên biệt; SIM-KPI-01 thiếu deadline xác nhận; SIM-KPI-04 thiếu mẫu hội đồng xác nhận. W2-Q3 đã có trong baseline, không còn ghi là thiếu dependency; các lỗi tích hợp còn lại nằm trong review.
