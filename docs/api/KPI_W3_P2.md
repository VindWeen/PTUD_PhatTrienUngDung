# W3-P2 — KPI nội bộ (API thật)

Supabase PostgreSQL/schema `app` qua pg, auth JWT Express hiện có, private file giữ nguyên. Migration nguồn duy nhất: `supabase/migrations/20261006000017_w3_p2_kpi.sql`. KpiGoals/KpiResults tương ứng `app.kpi_goals`/`app.kpi_results`. Không tích hợp KPI ngoài, không AI, không áp dụng tiêu chí W2-P4 chưa xác nhận.

## Quyền và trạng thái

Mỗi request kiểm tra tài khoản ACTIVE và vai trò hiện hành trong DB, không tin roles trong JWT. LECTURER chỉ CRUD KPI của chính mình; UNIT_REPRESENTATIVE chỉ CRUD KPI của đơn vị có phân công còn hiệu lực và đơn vị hoạt động. MANAGER/ADMIN không có quyền sửa/chấp nhận KPI của người khác chỉ vì vai trò đó. CSV chỉ dành cho cá nhân chính chủ ở phiên bản này.

Mục tiêu `DRAFT → ACCEPTED` bằng POST accept có version. Đây là người dùng chấp nhận kế hoạch, không phải phê duyệt kết quả. DRAFT được sửa/xóa; ACCEPTED khóa thông tin mục tiêu/kỳ/chủ thể. Một mã KPI (trim, uppercase) của một chủ thể có tối đa một mục tiêu cho cặp ngày bắt đầu/kết thúc chính xác. Các kỳ khác nhau được phép, kể cả giao nhau; không cộng gộp để suy ra thành tích nhiều năm. DB unique bảo vệ cả race với import. Một mục tiêu chỉ có một kết quả; sửa/xóa bằng version, bị khóa sau khi tạo kê khai.

Nguồn do backend gán MANUAL hoặc CSV. Sửa thủ công chuyển nguồn thành MANUAL và audit lưu thao tác. Kết quả không có trạng thái VERIFIED, không ghi award_records. Mỗi ghi nghiệp vụ/audit cùng transaction. Mục tiêu giữ `context_unit_id` lúc tạo, kể cả điều chuyển sau đó. Minh chứng KPI là mô tả/tham chiếu do người dùng nhập (`evidenceNote`), chưa được xác nhận; không suy diễn thành file đã thẩm định.

## Endpoints dưới /api/v1/kpi

Tất cả cần Authorization Bearer; trả `{success:true,data:...}`, lỗi theo error envelope hiện có; Cache-Control no-store. Payload strict, trường lạ (status/source/owner…) trả 400. ID và version là số nguyên dương an toàn; response BIGINT/NUMERIC là chuỗi, kể cả result lồng trong list. Kỳ là YYYY-MM-DD (1990–2100), timestamp là ISO JSON; không đổi ngày của kỳ theo múi giờ. Hợp đồng máy đọc: `W3_P2.openapi.json`; tái tạo bằng `node scripts/update-w3-p2-contract.mjs`.

| Method/path | Request và kết quả |
|---|---|
| GET /catalogs | Các loại thành tích active và đơn vị được đại diện; không cần ADMIN |
| GET /goals | Query `subjectType=LECTURER` mặc định; `UNIT` cần organizationUnitId. Trả `{items:[goal với result hoặc null]}` |
| POST /goals | GoalInput; tạo DRAFT/MANUAL, HTTP 201 |
| PATCH /goals/:id | Tất cả trường GoalFields và version; chỉ DRAFT |
| DELETE /goals/:id | `{version}`; DRAFT |
| POST /goals/:id/accept | `{version}`; DRAFT → ACCEPTED |
| POST /goals/:id/result | ResultInput; cần ACCEPTED, HTTP 201 |
| PATCH /goals/:id/result | ResultInput + version của result |
| DELETE /goals/:id/result | `{version}` của result |
| POST /goals/:id/result/draft | `{version,achievementTypeId}` của result; HTTP 201 |
| GET /template.csv | UTF-8 BOM, mẫu có nhãn MO PHONG; không phải chỉ tiêu chính thức |
| POST /import/preview | `{csv}`; kiểm tra, không ghi DB |
| POST /import/commit | `{csv}`; xác nhận import, kiểm lại backend, atomic |

GoalFields: `code` (1–80), `title` (5–255), `measureUnit` (1–80), `periodStart`, `periodEnd` (ngày thật YYYY-MM-DD, end>=start), `target` (hữu hạn 0–10^12), `plan` (0–4000, mặc định rỗng), `sourceNote` (1–2000). GoalInput thêm subjectType (LECTURER/UNIT, mặc định LECTURER), organizationUnitId chỉ khi UNIT. ResultInput: `actual` (0–10^12), `sourceNote` (1–2000), `evidenceNote` (1–4000), bắt buộc cả ba. Kê khai giới hạn nội dung sao chép 4000 ký tự; vượt giới hạn trả 400, không cắt mất minh chứng.

Draft action chọn loại thành tích active, đúng LECTURER/UNIT/BOTH; khóa goal/result; tạo `achievements.status=DRAFT` và liên kết result trong cùng transaction/audit. Context, chủ thể, kỳ, năm cuối kỳ, tiêu đề và nguồn do server sao chép. Không tự chọn tiêu chí/quy chế/ngưỡng. Lặp action trả 409, không tạo trùng. Trả result có achievement_id. Người dùng mở `/achievements` để tải file private, bổ sung và nộp theo workflow W2-Q2/Q3. Findings W2-P4 vẫn là gate riêng cho workflow xác nhận; KPI không tuyên bố đã giải quyết chúng.

## CSV

Template lưu trong repository: `templates/W3_P2_kpi.csv`; endpoint trả thêm BOM để Excel nhận UTF-8. Dữ liệu ví dụ có nhãn MO PHONG và không phải tiêu chí chính thức.

Header chính xác theo thứ tự:
```csv
code,title,measureUnit,periodStart,periodEnd,target,plan,sourceNote,actual,evidenceNote
```
UTF-8/BOM, LF hoặc CRLF; hỗ trợ quoted comma/newline/doubled quote. 1–500 dòng, chuỗi CSV tối đa 500000 ký tự. Trống actual: nhập mục tiêu nháp. Muốn nhập actual: mục tiêu cùng mã/kỳ đã ACCEPTED và các trường title/measureUnit/target/plan phải khớp; không tạo/accept mục tiêu tự động. evidenceNote bắt buộc khi có actual. Dòng lỗi gồm số dòng và error/message, trùng gồm goalId nếu có.

Preview status: READY_GOAL, READY_RESULT, DUPLICATE, INVALID. Commit có bất kỳ INVALID nào trả 400, không ghi dòng nào. Bỏ qua DUPLICATE trong file/DB; ghi READY thành IMPORTED; trả `{rows,imported,duplicates}`. Lặp lại cùng CSV không sinh thêm kết quả. Không dùng tên giảng viên để ghép, không nhận owner ID trong file. Client gửi nguyên CSV để backend kiểm tra lại, không nhận rows/status do client phê chuẩn. UI vô hiệu hóa commit khi preview có lỗi và hủy preview khi nội dung thay đổi.

## Tự kiểm tra

1. Backend: cấu hình .env local (không commit), `npm --prefix backend run migrate` để áp migration 17 lên DB đích khi triển khai; `npm --prefix backend start`. Task chỉ chạy migration trong schema test rollback, chưa thay DB chung.
2. Frontend: `VITE_DATA_SOURCE=api`, URL `/api/v1` hoặc VITE_API_URL trỏ backend; `npm --prefix frontend run dev`. Đăng nhập tài khoản LECTURER có hồ sơ/phân công chính, mở `/kpi`. Fixture bị chặn rõ ràng vì chưa có fixture KPI chốt.
3. Tạo nháp, sửa, thử nhập trùng code/kỳ → 409. Chấp nhận mục tiêu, thử sửa/xóa → 409. Ghi/sửa/xóa kết quả, thử version cũ và tài khoản khác → 409/403.
4. Chọn đơn vị đại diện và lặp luồng. Thu hồi/hết hạn representative → không xem/ghi được; JWT ADMIN không vượt quyền.
5. Tải template, nhập mục tiêu CSV, preview và commit; lặp lại → bỏ qua trùng. Chấp nhận, bổ sung actual/evidenceNote vào CSV rồi import kết quả. Thêm dòng lỗi → toàn bộ lượt bị từ chối.
6. Chuẩn bị nháp, chọn loại và bấm xác nhận tạo DRAFT; mở Thành tích, bổ sung file private. Kiểm tra không có VERIFIED hoặc khen thưởng mới. Tạo lần hai → 409.

Các test dùng dữ liệu mô phỏng đã gắn nhãn, không lưu token/key thật. Chạy `npm --prefix backend run test:w3-p2` và `npm --prefix backend run test:w3-p2:integration`; integration cần mạng và cấu hình Supabase có quyền DDL tạo schema test. Harness outer rollback/savepoint, tuần tự; chưa chứng minh transaction song song.
