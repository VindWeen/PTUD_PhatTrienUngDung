# W3-P1 — Thống kê, tìm kiếm, CSV

Phụ trách: Võ Nhạc Phước. Ngày bàn giao: 06/10/2026.

## Plan và quyết định DB

1. Theo ADR-001 blueprint: Supabase PostgreSQL/schema `app` qua `pg` thay SQL Server của kế hoạch cũ. Tái sử dụng auth Express, JWT/refresh cookie, private file và phân công W1-P3; không đổi các module đó.
2. Đọc dữ liệu W2-Q3 `achievements` và W2-P2 `award_records`/`award_decisions`. Không cần migration mới; dùng các index scope/năm/trạng thái đã có. Role và phạm vi hiện tại lấy từ DB, không tin role trong JWT.
3. Một CTE SQL dùng chung nguồn, phạm vi, tìm kiếm và bộ lọc cho dashboard/report/export. Tổng, nhóm và trang nằm trong một statement để cùng snapshot DB. Mỗi request sau đó có snapshot mới; nếu trạng thái thay đổi giữa hai lần gọi thì số liệu có thể khác.
4. UI dashboard và `/reports` dùng cùng component; CSV xuất toàn bộ kết quả theo bộ lọc đã áp dụng. Không dùng `dashboardSummaries` hoặc các tỷ lệ AI demo để tạo thống kê.
5. Nghiệm thu bằng Express + pg + Supabase thật trong schema tạm, migrations/seed/fixture tổng hợp được rollback. Không migrate/seed DB `app` dùng chung hoặc ghi secret/dữ liệu thật vào Git.

Không tìm thấy `AGENTS.md` trong workspace (kể cả hidden) và các thư mục cha đã kiểm tra. Không có `gh` trên máy để kiểm tra PR đang mở; xác nhận phụ thuộc bằng mã nguồn/hợp đồng và lịch sử Git:

- W2-P2: commit `53167d8`, merge `8e79471`, hợp đồng `AWARDS_W2_P2.md`, migration 014.
- W2-Q3: commit `f091c57`, hợp đồng `ACHIEVEMENTS_W2_Q3.md`, migration 016.
- Tái sử dụng `getActiveRoles`, `authenticate`, `dbHelper`, `apiClient` và error middleware.

## API `/api/v1`

Tất cả endpoint cần Bearer token/tài khoản ACTIVE. JSON envelope `{success:true,data:{total,summary,items,page,pageSize}}`. IDs BIGINT trả chuỗi thập phân; counts/year/page là số. `summary` là mảng nhóm `{kind,subject_type,total,valid_count,distinct_years}`. Nhóm không có bản ghi không xuất hiện; UI hiển thị 0.

| GET path | Hành vi |
|---|---|
| `/dashboard/summary` | Thống kê và trang kết quả cùng hợp đồng `/reports` |
| `/reports` | Tìm kiếm/lọc và phân trang, thống kê trên toàn bộ kết quả |
| `/reports/achievements` | Cố định `kind=ACHIEVEMENT`, nhận alias `unitId=contextUnitId` |
| `/reports/awards` | Cố định `kind=AWARD`, nhận alias `unitId=contextUnitId` |
| `/reports/export.csv` | UTF-8 BOM, CRLF, attachment; tất cả hàng, bỏ phân trang |
| `/reports/export` | Alias blueprint, nhận `type=achievements|awards`, `unitId=contextUnitId` |

Query chung:

- `kind=ACHIEVEMENT|AWARD`; bỏ trống lấy cả hai nguồn.
- `subjectType=LECTURER|UNIT`; cá nhân và tập thể không cộng lẫn.
- `recognitionYear=1990..2100`; không dùng năm quyết định thay thế.
- `academicYearId`: lọc riêng thành tích. W2-P2 chưa có năm học cho khen thưởng; `kind=AWARD&academicYearId=...` trả 400. Không suy diễn hoặc nhân số lượng qua bảng liên kết achievement.
- `contextUnitId`: chính xác đơn vị lịch sử trên hồ sơ. Quyền cấp ở khoa có `include_descendants` mở rộng quyền xuống đơn vị con; bộ lọc một đơn vị vẫn là exact match.
- `typeId`: bắt buộc có `kind`, tránh nhầm ID giữa hai danh mục.
- `status`: DRAFT/SUBMITTED/NEED_CORRECTION/VERIFIED/REJECTED/CANCELLED/REVOKED/RECORDED. Trạng thái không áp dụng nguồn sẽ cho kết quả rỗng.
- `search`: tối đa 200 ký tự, tìm không phân biệt hoa/thường trong tiêu đề/chủ thể/tên loại/số quyết định; `%`, `_`, `\` được tìm như ký tự literal. Prepared params ngăn SQL injection.
- `page=1`, `pageSize=20` (1..100); sắp xếp năm giảm dần, nguồn, ID số giảm dần để trang ổn định. Query lạ hoặc alias mâu thuẫn trả 400.

Lỗi chung: 400 bộ lọc, 401 thiếu/sai token hoặc user không ACTIVE, 403 không có role đọc/xuất. Scope không có hàng cho bộ lọc trả 200 với tổng 0. Response dùng `Cache-Control: no-store`.

## Quyền và đối soát

Quyền đọc: Lecturer xem chính mình; UnitRepresentative xem tập thể mình đại diện; Manager/RecordsOfficer xem hồ sơ có `context_unit_id` thuộc scope hiệu lực; Admin đọc toàn hệ thống như module hồ sơ/thành tích hiện có. Admin không được cấp thêm quyền ghi nhận/xác nhận. Các vai trò được hợp theo OR, không nhân hàng khi scope chồng lấn. Scope/đại diện kiểm tra role, thời hạn, thu hồi, trạng thái đơn vị; mở rộng hậu duệ bằng CTE.

Theo ma trận quyền, Lecturer đơn thuần không xuất CSV (403). CSV cần UnitRepresentative/Manager/RecordsOfficer/Admin và vẫn dùng đúng tập hàng có quyền đọc, cùng filter. UI chỉ hỗ trợ ẩn nút; backend thực thi quyền.

`is_valid` chỉ đúng cho ACHIEVEMENT/VERIFIED hoặc AWARD/RECORDED. REVOKED vẫn có thể tra cứu, không vào `valid_count` và `distinct_years`. `distinct_years=COUNT(DISTINCT recognition_year)` trên hàng hợp lệ trong từng nhóm nguồn/chủ thể; không phải số năm liên tục hoặc điều kiện trao thưởng. Không join assignments hiện tại để phân loại đơn vị; điều chuyển không viết lại báo cáo lịch sử.

Award legacy không có `decision_id`/metadata W2-P2 được loại khỏi tập báo cáo mới, như hợp đồng danh sách W2-P2. Không bịa quyết định/loại/năm/đơn vị để bổ sung. Dữ liệu gốc giữ nguyên.

Thành tích legacy chưa có loại vẫn được đọc và đếm theo trạng thái; loại/năm học chưa biết giữ NULL. Không loại bỏ hàng chỉ vì danh mục chuyển tiếp chưa được bổ sung.

CSV cột cố định: `kind,id,subject_type,subject_name,context_unit_id,context_unit_name,type_id,type_name,title,recognition_year,academic_year_code,status,is_valid,decision_number`. Mọi ô được quote và escape dấu nháy kép. Ô bắt đầu với `= + - @` (kể cả sau whitespace/control), hoặc tab/CR/LF, được thêm dấu `'` để chống formula injection. Số hàng CSV khớp `total`, số hàng `is_valid=true` khớp tổng `valid_count`.

## Fixture và tự kiểm tra

Fixture tổng hợp nằm trong `backend/tests/w3-p1.integration.js`, dùng chủ thể/danh mục mẫu đã có trong seed W2. Đây là dữ liệu kiểm thử mô phỏng, không phải thành tích/quyết định thật hoặc căn cứ thưởng. 7 thành tích + 5 khen thưởng; Manager khoa gồm đơn vị con thấy 12 hàng.

| Nhóm | Tất cả | Hợp lệ | Năm phân biệt hợp lệ |
|---|---:|---:|---:|
| Thành tích cá nhân | 6 | 4 | 3 |
| Thành tích tập thể | 1 | 1 | 1 |
| Khen thưởng cá nhân | 3 | 2 | 1 |
| Khen thưởng tập thể | 2 | 1 | 1 |

Tests đối soát dashboard/report/CSV, lọc năm/năm học/đơn vị/loại/trạng thái/tìm kiếm, phân trang, CSV multiline/Unicode/formula, năm trùng, REVOKED, đổi công tác, scope con/hết hạn, đại diện bị thu hồi, role DB khác role JWT, tài khoản INACTIVE và rollback schema. Không dùng runner W2-Q3 tích hợp cũ vì runner đó thao tác trên schema dùng chung; W3-P1 tích hợp kiểm tra cả hai bảng/migrations trong schema riêng.

Chạy từ root:

```powershell
npm --prefix backend run test:w3-p1
npm --prefix backend run test:w3-p1:integration
node --test backend/tests/w2-p2.test.js backend/tests/w2-q3.test.js
npm --prefix frontend run build
node scripts/validate_contracts.mjs
```

Integration cần env backend hợp lệ và quyền tạo schema test trên Supabase. Runner không in connection string/password/token và không lưu fixture vào DB thật sau khi kết thúc.

UI: đặt `VITE_DATA_SOURCE=api`, kiểm tra `VITE_API_URL`/Vite proxy, chạy backend/frontend và đăng nhập tài khoản có sẵn. Mở `/me/dashboard` hoặc `/reports`; chọn nguồn/chủ thể/filter rồi **Áp dụng**. Số trên bốn thẻ lấy trên toàn bộ kết quả, không riêng trang. CSV dùng filter đã áp dụng, không dùng giá trị draft chưa submit. Kiểm tra tổng CSV sau khi export, thử role Lecturer không có nút xuất và gọi API export bị 403. ID danh mục/đơn vị/năm học tra trong màn hình quản trị/tổ chức hiện có. Chế độ fixture hiển thị hướng dẫn chuyển sang API, không tạo số liệu giả.

## Giới hạn

- Không có phụ thuộc W2-P2/W2-Q3 thiếu để chặn tích hợp SQL thật. Đã chạy Supabase với schema tạm; chưa kiểm thử thao tác UI trong trình duyệt và chưa deploy môi trường dùng chung.
- Năm học khen thưởng bị giới hạn bởi hợp đồng/schema W2-P2; hỗ trợ cần bổ sung nghiệp vụ và cột DB ở task riêng, không suy diễn tại W3-P1.
- Không thêm AI/KPI hoặc căn cứ thưởng. Dashboard chỉ hiển thị thống kê dữ liệu; màn hình AI ngoài phạm vi được giữ nguyên.
- CSV hiện gom kết quả trong bộ nhớ; dữ liệu rất lớn cần nâng cấp streaming ở task riêng.
- Không commit/push/merge. Đề xuất: `feat(W3-P1): add scoped SQL dashboard reports and safe CSV export`.

OpenAPI riêng: `W3_P1.openapi.json`; root JSON/YAML chỉ cập nhật các path reports/dashboard. Script `scripts/update-w3-p1-contract.mjs` cập nhật lặp lại được và giữ path của người khác.
