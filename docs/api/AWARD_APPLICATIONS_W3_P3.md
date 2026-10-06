# W3-P3 — Hồ sơ đề nghị, kỳ và bản thay thế

Phụ trách: Võ Nhạc Phước. Nguồn schema: `supabase/migrations/20261006000019_w3_p3_award_applications.sql`; hợp đồng bổ sung: `W3_P3.openapi.json`. Auth Express và file private W2-Q2 giữ nguyên.

## Phụ thuộc đã kiểm tra

- Không tìm thấy AGENTS.md trong workspace hoặc thư mục cha. Đọc blueprint/ADR-001 và plan tuần 3.
- W2-P2 đã tích hợp (merge `8e79471`): RecordsOfficer theo role DB/scope hiệu lực; RECORDED khóa thao tác ghi/file; thu hồi có lý do, version và history; tạo DRAFT cùng chủ thể bằng `replacesAwardRecordId`. Tái sử dụng toàn bộ API/file hiện có, bổ sung nút chuẩn bị thay thế trên UI `/awards`.
- W3-Q1 đã tích hợp tại `c03874b`: dùng `achievement_submissions.revision_no/snapshot_data` và `submission_evidence_files` thật. Hợp đồng `WORKFLOW_W3_Q1.md` đã đọc. Không thiếu phụ thuộc mã nguồn.
- Không có `gh` trên máy; chưa xác minh trạng thái PR đang mở trên GitHub. Các kết luận tích hợp dựa trên mã/lịch sử Git checkout, không khẳng định đã kiểm tra PR trực tuyến.

## Quyết định DB trong plan

W3-P3 dùng **Supabase PostgreSQL qua pg**, thay phương án DB SQL Server cũ: transaction ACID, row lock và version BIGINT. Migration Supabase là nguồn duy nhất; không sửa migration/checksum cũ hoặc tạo schema SQL Server song song. Cycles ánh xạ vào `app.award_periods` đã có. Mở rộng `app.award_applications` hiện hữu bằng cột nullable để giữ nguyên hồ sơ legacy; không tự tạo mục tiêu, nguồn hoặc tiêu chí cho dữ liệu cũ. Không seed DB dùng chung.

## API `/api/v1`

Bearer token bắt buộc; JSON envelope `{success:true,data:...}`. Response dùng snake_case; BIGINT pg trả string. Client không được gửi status, điểm, quyết định, snapshot hoặc actor.

| Method/path | Input / quyền / kết quả |
|---|---|
| GET /award-cycles | Danh sách kỳ; authenticated |
| POST /award-cycles | `{code,name,startDate,endDate}`; RecordsOfficer hiệu lực; tạo OPEN; ngày thật và end≥start |
| POST /award-applications | `{lecturerId OR organizationUnitId,cycleId,targetAwardTypeId,purpose,achievementIds?:[],awardRecordIds?:[]}`; chính chủ có Lecturer hoặc UnitRepresentative hiệu lực; 201 DRAFT |
| GET /award-applications | Không filter: hồ sơ người dùng tạo và còn quyền đọc; `contextUnitId`: Manager/RecordsOfficer trong scope của đơn vị đó; page≥1, pageSize 1–100; mặc định 20 |
| GET /award-applications/:id | Chủ thể/đại diện hiện hành hoặc Manager/RecordsOfficer đúng scope; gồm input và histories |
| POST /award-applications/:id/submit | `{version,reason?}`; applicant; DRAFT→SUBMITTED; đóng băng input v1 trong cùng transaction với trạng thái/history/audit |
| POST /award-applications/:id/forward | `{version,reason}`; Manager đúng scope; không phải người tạo/chủ thể cá nhân; SUBMITTED→COUNCIL_PENDING |

Mục tiêu phải active, phù hợp cá nhân/tập thể. Kỳ phải OPEN và ngày DB `CURRENT_DATE` nằm trong khoảng start/end; nộp kiểm tra lại để tránh kỳ đã đóng. Context cá nhân lấy đúng một công tác chính hiệu lực; tập thể lấy đơn vị chủ thể, không nhận context client. Mã input không được trùng, tối đa 100 mỗi nhóm.

Thiếu ít nhất một thành tích VERIFIED → 400 có thông báo rõ. Mọi input phải cùng chủ thể; thành tích phải có revision W3-Q1. Khen thưởng tùy chọn, nếu chọn phải RECORDED và có quyết định/file version W2-P2. Khen thưởng legacy thiếu căn cứ không được âm thầm đưa vào snapshot. Sai quyền 403, sai trạng thái/version 409. Nháp có thể lưu trước khi nguồn đủ; khi nộp kiểm tra lại mọi input.

Snapshot gồm mục tiêu, kỳ, purpose, id/version/status của từng nguồn; submission/revision thành tích và id/version/hash file đóng băng; quyết định và id/version/hash file khen thưởng. Kiểm tra file vật lý trong kho private trước nộp, thiếu file báo 400; không trả storage_key trong snapshot. Row nguồn khóa FOR SHARE theo thứ tự id khi lấy snapshot; thu hồi serialize với việc chụp input. Snapshot giữ nguyên khi nguồn về sau bị thu hồi; không thể UPDATE/DELETE qua trigger. Giữ nguyên file gốc, không sao chép hoặc đổi public URL. Tải file tiếp tục đi qua API quyền của hồ sơ gốc, snapshot không cấp quyền tải mới. Lịch sử application và audit ghi cùng transaction, lỗi audit rollback toàn bộ.

## Workflow cố định và giới hạn

`DRAFT → SUBMITTED (đơn vị) → COUNCIL_PENDING (Hội đồng)`.

Manager chuyển hồ sơ với ý kiến, không xác nhận đã trao thưởng. Chưa triển khai Hội đồng xét duyệt, tổng quát hóa workflow, trả lại/chỉnh sửa nháp hoặc resubmit application. Legacy UNDER_REVIEW/APPROVED/REJECTED được giữ nguyên nhưng không có action mới cho các trạng thái này. Không tích hợp AI, tiêu chí suy diễn hoặc KPI vào đề nghị; `criteriaEvaluation=null`. Nguồn KPI mô phỏng chưa được nhận làm input của module này; dữ liệu W3-P2 phải qua quy trình thành tích VERIFIED và giữ nhãn nguồn mô phỏng trong nội dung nếu dùng.

UI `/award-applications` gọi API thật, tách `/awards` của RecordsOfficer. Đang dùng mã tham chiếu nhập tay như module W2-P2, chưa có tìm kiếm danh mục. Danh sách UI tải trang đầu; API hỗ trợ phân trang. Lịch sử/snapshot xem được ngay trên chi tiết. Không phát notification mới cho application (hợp đồng notifications hiện chỉ ACHIEVEMENT/AWARD).

## Tự kiểm tra

1. Kiểm tra cấu hình DB riêng và quy trình backup; chạy `npm --prefix backend run migrate` để áp migration mới vào môi trường triển khai. Không chạy seed trên DB dùng chung.
2. Chạy backend/frontend, đăng nhập RecordsOfficer, mở `/award-applications`, tạo kỳ đang mở. Applicant không được tạo kỳ qua API.
3. Lecturer tạo đề nghị cho chính mình với mục tiêu/kỳ/purpose. Nộp thiếu input hoặc chọn DRAFT/REVOKED phải báo 400. Thêm mã thành tích VERIFIED và tùy chọn khen thưởng RECORDED rồi tạo/nộp hồ sơ.
4. Kiểm tra input v1 có revision và phiên bản file. Manager scope xem danh sách theo đơn vị, nhập ý kiến và chuyển Hội đồng. Người tạo/chủ thể không tự chuyển; chưa có thao tác trao thưởng.
5. Thu hồi nguồn, mở lại đề nghị: input v1 giữ nguyên. Applicant gọi POST /award-records phải 403; nộp đề nghị không tăng số AwardRecord.
6. RecordsOfficer vào `/awards`, thu hồi có lý do rồi bấm chuẩn bị bản thay thế. Tạo quyết định sửa sai/nháp mới, upload file và ghi nhận. Bản cũ vẫn REVOKED, giữ đủ history/file và link replaces; sai chủ thể bị chặn.

Test thật dùng schema tạm trên Supabase, áp migrations và seed fixture chỉ trong schema tạm, outer transaction rollback và dọn file synthetic. Không migrate/seed schema app dùng chung khi chạy test.
