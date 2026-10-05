# W2-P1 — Tài khoản, phân công và danh mục

Phụ trách: Võ Nhạc Phước. Bàn giao ngày 02/10/2026 (Asia/Saigon).

## Quyết định và phụ thuộc

- Không tìm thấy AGENTS.md trong repository hoặc các thư mục cha được kiểm tra.
- Dùng ADR-001 trong `docs/PROJECT_DEVELOPMENT_BLUEPRINT.md`: Supabase PostgreSQL, schema `app`, kết nối `pg`; không dùng phần SQL Server của kế hoạch cũ. Express JWT/refresh cookie và kho file private được giữ nguyên.
- Tái sử dụng W1-P2 (schema/danh mục/seed), W1-P3 (tổ chức/hồ sơ/lịch sử) và W1-Q3 (auth, requireRoles, requireScope, lỗi chung, bảng audit).
- Commit W1-P3 `9c77c82` đã có trong lịch sử local. Chưa xác nhận metadata review/merge PR: CLI `gh` không được cài, truy cập trang PR remote không trả nội dung. Không suy ra đã được duyệt từ sự hiện diện của mã nguồn.
- W2-P1 xử lý trạng thái tài khoản tức thời, mã Manager riêng khi kiểm tra thẩm quyền, role/scope/đại diện còn hiệu lực và quyền đọc hồ sơ. Các finding W1-Q3 về secret production, rememberMe khi refresh và rate limit (AUTH-02/04/05) vẫn thuộc phụ thuộc auth, chưa được sửa trong task này. Không coi W1-Q3 đã nghiệm thu toàn bộ.

## API và UI

UI `/admin` gồm tài khoản, gán/thu hồi vai trò, scope IncludeDescendants, đại diện có ngày kết thúc và ba danh mục. Chỉ dùng `VITE_DATA_SOURCE=api`; fixture không hỗ trợ ghi admin.

Base `/api/v1`. Các endpoint admin đều yêu cầu tài khoản ACTIVE và role ADMIN hiện tại, đọc lại từ DB thay vì tin roles trong JWT.

| Resource | Endpoint | Thao tác |
|---|---|---|
| Tài khoản | `/admin/users`, `/admin/users/{id}` | GET/POST, PATCH |
| Vai trò cố định | `/admin/roles` | GET; tái sử dụng seed vai trò, không tạo quyền tùy ý |
| Gán vai trò | `/admin/user-roles`, `/admin/user-roles/{id}` | GET/POST, DELETE để thu hồi |
| Scope | `/admin/scopes`, `/admin/scopes/{id}` | GET/POST, DELETE để thu hồi |
| Đại diện | `/admin/representatives`, `/admin/representatives/{id}` | GET/POST, DELETE để thu hồi |
| Năm học | `/admin/academic-years`, `/admin/academic-years/{id}` | GET/POST, PATCH/DELETE |
| Loại thành tích | `/admin/achievement-types`, `/admin/achievement-types/{id}` | GET/POST, PATCH/DELETE |
| Loại thưởng | `/admin/award-types`, `/admin/award-types/{id}` | GET/POST, PATCH/DELETE |

Request dùng camelCase; response admin dùng tên cột snake_case từ PostgreSQL, mutation có thêm `id`. Envelope `{success:true,data:...}`; danh sách tối đa 500 bản ghi. OpenAPI gốc tham chiếu `W2_P1.openapi.json`, chứa đủ request và status code cho 15 path. Mọi thay đổi admin ghi audit trong cùng transaction, không ghi mật khẩu/hash vào response hoặc audit.

Ví dụ cấp scope (phải có role MANAGER/RECORDS_OFFICER bao phủ thời hạn):

```json
{"userId":2,"roleId":3,"unitId":1,"includeDescendants":true,"validFrom":"2026-10-02T00:00:00+07:00","validTo":null}
```

Tài khoản mới có `must_change_password=true`. PATCH tài khoản cần `email`, `displayName`, `status` và `version`; version cũ trả 409. Dùng status INACTIVE/LOCKED thay xóa, đồng thời thu hồi refresh token. Access token còn hạn cũng bị chặn ngay tại request tiếp theo. Không có DELETE vật lý tài khoản.

Vai trò/scope sử dụng khoảng `[validFrom,validTo)`; `validTo=null` là không hạn. Thu hồi ghi `revoked_at`, kể cả phân công chưa đến ngày bắt đầu; giữ nguyên thời hạn lịch sử. Scope chỉ dành cho Manager/RecordsOfficer. Đại diện dùng bảng riêng và chỉ có hiệu lực tại đúng đơn vị, không kế thừa cây con. Đại diện mới bắt buộc ngày kết thúc và role UNIT_REPRESENTATIVE bao phủ thời hạn; phân công chồng lấn trả 409. Endpoint W1-P3 `/organizations/{id}/representative` cũng dùng validation/audit này; thay đại diện bằng thu hồi bản cũ rồi cấp mới.

Admin không được kiểm tra thẩm quyền xác nhận khi thiếu MANAGER + scope. Quyền quản trị đọc không cho phép xác nhận. `GET /units/{id}/profile` yêu cầu Admin hoặc role/phân công đang hiệu lực. `GET /lecturers/{id}` là hồ sơ toàn bộ lịch sử: chủ hồ sơ/Admin được xem; Manager/RecordsOfficer cần scope bao phủ mọi đơn vị công tác và context lịch sử, tránh lộ thống kê ngoài scope. Không có dữ liệu đơn vị hoặc context NULL thì từ chối người đọc không phải chủ/Admin.

Danh mục DELETE luôn ngừng hoạt động, giữ FK và lịch sử; năm học đồng thời bỏ `is_current`. Ngày kết thúc năm học phải sau ngày bắt đầu; năm hiện tại phải hoạt động và chỉ có một năm hiện tại. Mã danh mục cho phép chữ Unicode, số, `_` và `-`, chuẩn hóa chữ hoa; unique index kiểm tra không phân biệt hoa/thường. Giữ nguyên mã tiếng Việt đã chốt, ví dụ CSTĐ_CS. Trùng mã/username/email trả 409, sai dữ liệu trả 400, thiếu quyền trả 403.

## Demo và tự kiểm tra

Seed chung đã có LECTURER, MANAGER, ADMIN, UNIT_REPRESENTATIVE và RECORDS_OFFICER. W2-P1 thêm `records.demo@example.invalid` và scope văn thư; không thêm dữ liệu thực hay KPI. Mật khẩu demo của seed là `demo1234`.

| Tài khoản | Vai trò / phân công demo |
|---|---|
| an.nv | Lecturer |
| bich.tt | Lecturer + Manager, Khoa CNTT gồm đơn vị con |
| duc.pm | Admin, không có Manager |
| cuong.lh | Lecturer + đại diện Bộ môn #2 đến 02/10/2027 UTC |
| records.demo | RecordsOfficer, Khoa CNTT gồm đơn vị con |

Trước khi chạy backend mới, áp dụng migration W2-P1 bằng `npm --prefix backend run migrate`. Không sửa migrations W1 đã áp dụng. Chỉ chạy seed chung trên DB demo riêng vì seed hiện có TRUNCATE; không dùng để bổ sung tài khoản vào DB có dữ liệu cần giữ. Khi không seed lại, Admin có thể tạo tài khoản RecordsOfficer và gán scope tại UI.

1. Chạy backend/frontend theo README với `VITE_DATA_SOURCE=api`, đăng nhập Admin và mở `/admin`.
2. Tạo tài khoản, cấp role Manager, rồi cấp scope một Khoa với IncludeDescendants=false. Giữ access token Manager, gọi `/auth/verify-scope/{id}`: Khoa được phép, Bộ môn con bị 403.
3. Thu hồi scope, cấp lại với IncludeDescendants=true: Bộ môn con được phép. Thu hồi khi phiên Manager còn mở: request tiếp theo phải 403, kể cả đọc hồ sơ đơn vị.
4. Cấp role UNIT_REPRESENTATIVE rồi phân công có hạn; thử ngày kết thúc trước bắt đầu, phân công trùng, hết hạn và thu hồi. Đại diện không được duyệt bằng `/auth/verify-scope/{id}`.
5. Tạo/sửa ba danh mục, thử mã trùng (kể cả khác hoa/thường) và ngày năm học sai. Ngừng hoạt động danh mục có tham chiếu phải giữ hồ sơ/lịch sử.
6. Ngừng tài khoản đang đăng nhập: access token cũ bị 401. Admin thiếu role Manager phải bị 403 ở endpoint thẩm quyền xác nhận.

## Kiểm tra và giới hạn

```powershell
node --test backend/tests/w1-p3.test.js backend/tests/w2-p1.test.js
npm --prefix backend run test:w2-p1:integration
npm --prefix frontend run lint
npm --prefix frontend run build
node scripts/validate_contracts.mjs
git diff --check
```

Integration runner dùng Express HTTP, auth thật, migration/seed thật và `pg` kết nối Supabase. Nó tạo schema tên ngẫu nhiên trong outer transaction, chuyển toàn bộ SQL test sang schema đó và dùng savepoint cho transaction nghiệp vụ; cuối lượt ROLLBACK. Không migrate/seed schema `app` dùng chung, không đổi mật khẩu tài khoản thật. URL DB lấy từ cấu hình backend hiện có; cần quyền tạo schema và chạy migration. Không chạy runner auth cũ vì có nhánh thay mật khẩu tài khoản trong DB dùng chung.

Kết quả thực tế và danh sách file được ghi ở `docs/weekly/WEEK_02_W2_P1.md`. UI đã lint/build; chưa xác nhận thao tác bằng trình duyệt trên DB `app` dùng chung. Không triển khai workflow thành tích/khen thưởng hoặc AI ngoài scope. Danh mục không tự tạo căn cứ hay quyết định trao thưởng. Giới hạn hiện tại: danh sách tối đa 500, chưa phân trang; sửa danh mục theo lần ghi cuối, tài khoản dùng version.

Đề xuất commit: `feat(W2-P1): quản trị tài khoản, phân công và danh mục trên Supabase`. Chưa commit/push/merge.
