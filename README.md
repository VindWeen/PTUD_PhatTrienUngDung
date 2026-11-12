# Quản lý Hồ sơ Thành tích Số & Khen thưởng LHU

> Đầu mối tổng quan dự án. Cập nhật theo source trong workspace ngày **04/11/2026**, gồm thay đổi chưa commit. Phạm vi và bằng chứng kiểm tra từng đợt được ghi riêng; không phải xác nhận nghiệm thu toàn hệ thống.

**Tài liệu nên đọc:** README này → [bản đồ tài liệu](docs/README.md) → hướng dẫn theo nhu cầu. File tuần/review/test lưu lịch sử theo mốc, không đại diện toàn bộ trạng thái hiện tại.

## Phạm vi hiện có trong code

| Nhóm | Triển khai đang có |
| --- | --- |
| Tài khoản và quyền | Đăng nhập/refresh/logout, đổi mật khẩu, đăng ký giảng viên, khôi phục mật khẩu; nhiều vai trò và phạm vi đơn vị. Gửi email reset cần cấu hình dịch vụ riêng. |
| Hồ sơ và thành tích | Hồ sơ cá nhân/tập thể; kê khai, minh chứng private có phiên bản, nộp/bổ sung/xác nhận/từ chối, lịch sử xử lý. |
| Khen thưởng | Đợt và hồ sơ đề nghị, chuyển đơn vị/Hội đồng, phân công/phản hồi, đề nghị hoặc không đề nghị; chuyên viên chuẩn bị thưởng từ bản hồ sơ đã xét, bổ sung quyết định rồi ghi nhận. |
| Quản trị và theo dõi | Dashboard, báo cáo, thông báo, cơ cấu tổ chức, tài khoản, danh mục và phân công phạm vi. |
| AI và KPI | Đánh giá theo tiêu chí, lịch sử đánh giá, quy định và trích dẫn nguồn, gợi ý KPI, connector KPI ngoài. Phụ thuộc dữ liệu, cấu hình và provider. |
| Tiện ích | Lịch cá nhân lưu DB; soạn/xem CV và trang CV công khai theo trạng thái xuất bản. |

Sáu mã vai trò: `LECTURER`, `UNIT_REPRESENTATIVE`, `MANAGER`, `RECORDS_OFFICER`, `COUNCIL`, `ADMIN`. Backend kiểm quyền theo thao tác và phạm vi; ADMIN không mặc nhiên có quyền duyệt nghiệp vụ.

Đối chiếu tại [route UI](frontend/src/routes/AppRoutes.jsx), [đăng ký module API](backend/src/app.js), [module nghiệp vụ](backend/src/modules) và [schema chuẩn](supabase/migrations). Có code không đồng nghĩa mọi luồng đã được kiểm chứng trên môi trường triển khai.

## Luồng sử dụng chính

1. **Giảng viên/đại diện đơn vị** kê khai thành tích và minh chứng → nộp cho quản lý xác nhận. Hồ sơ cần bổ sung được chỉnh và gửi lại; xác nhận thành tích chưa đồng nghĩa đã được khen thưởng.
2. Người lập chọn thành tích đã xác nhận và loại khen thưởng để tạo **hồ sơ đề nghị** → quản lý ghi ý kiến, chuyển Hội đồng → thành viên được phân công xem xét, ghi ý kiến, yêu cầu bổ sung hoặc kết luận đề nghị/không đề nghị.
3. Hồ sơ được đề nghị xuất hiện ở trang **Khen thưởng** của chuyên viên. Chủ thể, loại thưởng và nguồn giữ theo bản nộp đã xét; form hiển thị tên/tóm tắt nguồn. Chuyên viên bổ sung quyết định, tệp quyết định rồi ghi nhận kết quả.
4. **Admin** quản lý tài khoản, vai trò, phạm vi và danh mục. Danh sách phân công hiển thị tên người/đơn vị và hiệu lực theo thời gian; quyền nghiệp vụ vẫn do backend kiểm tra.

Chi tiết từng bước, điều kiện và nhánh bổ sung/thu hồi tại [USER_GUIDE](docs/USER_GUIDE.md). Trên điện thoại, menu dưới chứa các mục chính; chọn **Thêm** để mở đầy đủ chức năng theo quyền và đăng xuất.

## Cập nhật giao diện ngày 04/11/2026

Đã cải thiện 16 điểm từ đợt rà soát: bố cục mobile và thẻ thành tích; trạng thái thu hồi/hết hạn; gợi ý bước tiếp theo của hồ sơ; nhóm thao tác Hội đồng; danh sách KPI đứng trước công cụ nhập; nội dung kỹ thuật thu gọn; phân cấp tổ chức; nguồn khen thưởng có tên; form đăng nhập, báo cáo, lịch tiếng Việt và thanh lưu CV.

Xem [báo cáo UI trước/sau và phạm vi kiểm tra](docs/testing/UI_VISUAL_AUDIT.md). Frontend lint/build đã qua; kiểm browser desktop 1440×1000 và mobile 390×844 trên các màn liên quan. Đợt kiểm tra UI không gửi biểu mẫu nghiệp vụ và không thay thế kiểm thử toàn bộ luồng ghi dữ liệu. Các thay đổi UI này **không cần migration mới**; backend cần khởi động lại để trả thêm tên/tóm tắt nguồn khen thưởng từ snapshot.

## Cấu trúc dự án

| Thư mục | Mục đích |
| --- | --- |
| `frontend/` | React/Vite; trang, component, context và lớp gọi API; có chế độ fixture. |
| `backend/` | Express; cấu hình, middleware quyền, module nghiệp vụ và test. |
| `supabase/` | Migration và seed chuẩn đang dùng. |
| `database/` | Script migrate/seed/scenario; migration ở đây là legacy. |
| `scripts/` | Backup/restore, kiểm tra demo, kiểm chứng scenario và công cụ minh chứng. |
| `cloudflare/ai-pool/` | Thành phần AI pool riêng, có README riêng. |
| `storage/` | File cục bộ; vị trí thật phụ thuộc cấu hình backend. |
| `docs/` | Hướng dẫn, đặc tả và lịch sử; tra mục lục trước khi đọc. |

Blueprint là thiết kế ban đầu: các câu “AI/Hội đồng/workflow đề nghị dành cho tương lai” không còn mô tả đủ code hiện tại.

React/Vite/Tailwind → Express REST `/api/v1` → SQL Server qua `mssql` theo yêu cầu cập nhật 11/11/2026. Auth do Express quản lý; file private trên ổ đĩa server, DB chỉ giữ metadata. Bản đầu là UI demo; bản hiện tại đã tích hợp API. Bản Supabase trước đây đã được chuyển sang SQL Server.

## Cài và chạy với SQL Server

Backend hiện dùng **Microsoft SQL Server** qua `mssql`; Supabase PostgreSQL là nguồn cũ đã được sao lưu và chuyển dữ liệu. Schema chuẩn: `database/sqlserver/migrations/`. Hai migration SQL Server tạo 53 bảng nghiệp vụ và 5 trigger; không chạy lại 31 migration PostgreSQL cũ.

1. Cài SQL Server và tạo DB/login riêng (máy hiện tại đã có `PTUD_LHU` trên `localhost`).
2. `cd backend`, `npm ci`; chép `.env.example` sang `.env` nếu chưa có rồi điền DB_HOST/PORT/NAME/USER/PASSWORD.
3. `npm run migrate`, `npm run migrate:status`, `npm start`.
4. Terminal khác: `cd frontend`, `npm ci`, `npm run dev`; mở http://localhost:5173.
5. Chỉ seed vào **DB mới rỗng**: `node ../database/scripts/seed.js --apply`. Không seed lại DB đã chuyển dữ liệu.

Backend local: http://localhost:5000/api/v1/health/readiness. Phải trả `databaseEngine: SQL Server`, `status: UP`; frontend dùng API thật (không bật fixture).

## Tài liệu và kiểm chứng

- [Môi trường demo riêng](docs/DEMO_RECORDING_SETUP.md): DB `PTUD_LHU_Demo`, frontend 5175; bộ mở rộng 40 tài khoản, 238 thành tích, AI thật và CV. [Kịch bản dưới 10 phút có lời thoại](docs/DEMO_9_PHUT.md), [tình huống theo vai trò](docs/RICH_DEMO_DATA.md), [tài khoản](docs/RICH_DEMO_ACCOUNTS.md).

- [Cài đặt SQL Server](docs/deployment/GETTING_STARTED.md), [schema và khác biệt](database/sqlserver/README.md).
- [Kết quả chuyển đổi](docs/testing/SQLSERVER_MIGRATION_REPORT.md): 53 bảng/609 bản ghi tại mốc chuyển, đối chiếu từng trường; tệp private 13/14 khớp hash, một tệp demo cũ đang thiếu.
- [Hướng dẫn theo vai trò](docs/USER_GUIDE.md), [quyền/phạm vi](docs/requirements/ACCOUNT_ROLES_AND_SCOPES.md), [bản đồ tài liệu](docs/README.md).
- [Báo cáo học phần ba chương cập nhật ngày 12/11/2026](docs/bao-cao/BaoCaoHocPhan_LHU_BanNop_20261112.docx): SQL Server, bộ demo mở rộng, AI thật, CV và kết quả khôi phục.
- [Backup/restore SQL Server](docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md). DB restore riêng đã kiểm; gói backup đầy đủ cả tệp hiện bị chặn vì một tệp nguồn thiếu.

## Kiểm tra

Từ `backend`: `npm test` (unit/API mock), `npm run test:sqlserver` (SQL Server thật, fixture rollback; chạy nối tiếp để tránh các bộ fixture khóa chéo nhau). Từ `frontend`: `npm run build`, `npm run lint`.

`pg` chỉ còn là phụ thuộc phát triển cho công cụ xuất dữ liệu nguồn một lần; backend chạy thường không kết nối PostgreSQL. Tài liệu W1–W6 và migration Supabase cũ là tư liệu lịch sử. Bản README trước chuyển đổi được giữ trong `docs/archive/sqlserver/`.

