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

React/Vite/Tailwind → Express REST `/api/v1` → Supabase PostgreSQL qua `pg` theo ADR-001. Auth do Express quản lý; file private trên ổ đĩa server, DB chỉ giữ metadata. Bản đầu là UI demo; bản hiện tại đã tích hợp API. Kế hoạch SQL Server cũ được thay bằng Supabase.

## Cài trên máy mới

Đã bổ sung sửa/gửi bổ sung hồ sơ đề nghị, ánh xạ nguồn tiêu chí AI và chuẩn bị bản ghi thưởng trực tiếp từ hồ sơ Hội đồng đã đề nghị. Schema trong repo hiện có **31 migration**. Máy/DB chưa cập nhật cần chạy `npm run migrate` trong `backend/` rồi kiểm `npm run migrate:status`; nếu không còn pending thì không cần chạy lại seed. Migration chạy các script chưa áp dụng, không tự sửa mọi thay đổi thủ công trên DB. Backup trước khi nâng cấp DB có dữ liệu cần giữ.

Yêu cầu Git, Node.js 20.19+ hoặc 22.12+, npm và Supabase project **demo riêng, không có dữ liệu cần giữ**. Lệnh PowerShell, bắt đầu tại thư mục muốn clone:

```powershell
git clone https://github.com/VindWeen/PTUD_PhatTrienUngDung.git
cd PTUD_PhatTrienUngDung
Copy-Item backend/.env.example backend/.env
cd backend
npm ci
cd ../frontend
npm ci
cd ..
```

Điền `backend/.env` theo [hướng dẫn cài sạch](docs/deployment/GETTING_STARTED.md): URL DB, JWT secrets riêng và storage tuyệt đối. Backend ưu tiên `backend/.env`, chỉ fallback root `.env` khi file đó không tồn tại. Biến môi trường tiến trình ưu tiên hơn file. Không đưa secrets vào frontend/Git.

```powershell
cd backend
npm run migrate
npm run migrate:status
# CHỈ chạy trên DB demo mới: seed.sql có TRUNCATE, xóa dữ liệu cũ.
npm run seed
npm start
```

Giữ terminal backend mở. Terminal thứ hai tại root:

```powershell
Set-Content frontend/.env.local "VITE_DATA_SOURCE=api`nVITE_API_URL=/api/v1"
cd frontend
npm run dev -- --strictPort
```

Mở [đăng nhập](http://localhost:5173/login). Tài khoản seed: `an.nv` (giảng viên), `bich.tt` (quản lý + giảng viên), `duc.pm` (admin), `cuong.lh` (đại diện + giảng viên), `records.demo` (văn thư). Mật khẩu mẫu chung **`demo1234`**, chỉ cho demo riêng. Seed chưa có tài khoản Hội đồng. Không đăng nhập bằng email tùy ý như bản UI đầu.

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
Invoke-RestMethod http://localhost:5000/api/v1/health/readiness
```

Readiness phải có DB `UP`; tải được trang đăng nhập chưa chứng minh DB hoạt động. `VITE_DATA_SOURCE=fixture` chỉ dùng phát triển, không nghiệm thu tích hợp. Vite proxy chỉ chạy ở dev; hosting build tĩnh cần reverse proxy `/api/v1` hoặc `VITE_API_URL` tuyệt đối trước build.

## Sử dụng và bàn giao

- [Kịch bản SCN đầy đủ để thực hành workflow](docs/testing/scenario/README.md): tài khoản sáu vai trò, các nhánh xử lý, file mẫu và cách reset/kiểm chứng. Từ `backend`, dùng `npm run seed:scenario` trên DB demo để backup rồi dựng lại dữ liệu nghiệp vụ; `npm run verify:scenario` kiểm tra HTTP và rollback lượt test.
- [Hướng dẫn theo vai trò](docs/USER_GUIDE.md), [demo đủ vai trò 20–25 phút](docs/DEMO_SCRIPT.md) (có bản rút gọn).
- [Tài khoản, nhiều vai trò và phạm vi quản lý](docs/requirements/ACCOUNT_ROLES_AND_SCOPES.md): mô hình phân quyền hiện tại và cách cấp phân công tại trang Quản trị.
- [Checklist tổng duyệt W6-P2](docs/testing/w6-p2/REHEARSAL_CHECKLIST.md): sáu vai trò, thuật ngữ, quyền sai và gate restore thật.
- [Video và minh chứng hai người W6-P3](docs/testing/w6-p3/README.md): timeline task/SHA, bảng đóng góp, PR/test evidence và phiếu review release 28/10.
- [Cài đặt, TLS, free API và xử lý lỗi](docs/deployment/GETTING_STARTED.md).
- [Triển khai](docs/deployment/DEPLOYMENT_GUIDE.md), [backup/restore W5-Q3](docs/deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md).
- [Kết quả và tự kiểm tra W5-P3](docs/archive/weekly/WEEK_05_W5_P3.md).
- [Blueprint/ADR-001](docs/PROJECT_DEVELOPMENT_BLUEPRINT.md), [hợp đồng API](docs/api/openapi.json).
- [Chuẩn bị báo cáo theo mẫu học phần](docs/report-inputs/REPORT_AND_SLIDES.md): ánh xạ khung 4 chương sang dự án hiện tại; các tư liệu W5/W6 bên dưới vẫn mang mốc lịch sử.

AI chỉ tham khảo với nguồn/tiêu chí đã xác nhận, không tự quyết định trao thưởng. KPI mock/CSV thử nghiệm phải gắn nhãn mô phỏng. Provider free cần key server-only và quota; không bảo đảm luôn sẵn sàng. Báo cáo W5-P1 từng ghi p95 dashboard vượt 2 giây; chưa đo lại workspace hiện tại trong đợt rà soát tài liệu này.

## Kiểm tra

```powershell
cd frontend
npm run build
npm run lint
cd ../backend
npm run test:w5-p1
# DB demo có quyền tạo/xóa schema; không chạy production.
node tests/w5-p3.integration.js
```

Lệnh cuối migrate/seed schema ngẫu nhiên, đăng nhập thật rồi dọn schema. Kiểm restore HTTP cần `W5_P3_BACKUP_DIR` theo hướng dẫn W5-P3; chưa cấp thì ghi `NOT_RUN`. `npm test` có fallback mock nên PASS không thay thế bằng chứng Supabase thật.
