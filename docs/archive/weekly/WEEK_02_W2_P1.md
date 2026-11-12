# Bàn giao W2-P1 — 02/10/2026

Phụ trách Võ Nhạc Phước. Kế hoạch dùng Supabase PostgreSQL qua pg theo ADR-001, thay phần DB SQL Server cũ. Auth Express và private file không đổi kiến trúc.

## File thay đổi

- `backend/src/modules/admin/adminSchemas.js`, `adminRepository.js`, `adminRoutes.js`: validation, API quản trị, audit transaction.
- `backend/src/app.js`, `backend/package.json`: mount API và lệnh test.
- `backend/src/middlewares/authenticate.js`, `requireUnitRead.js`, `requireLecturerRead.js`: trạng thái tài khoản tức thời, quyền đọc theo phân công hiện tại.
- `backend/src/modules/auth/authRepository.js`, `authRoutes.js`: scope/role còn hiệu lực, đại diện riêng, không dùng role khác để xác nhận.
- `backend/src/modules/organizations/organizationController.js`, `organizationRepository.js`, `organizationRoutes.js`, `backend/src/modules/profiles/profileRoutes.js`: tích hợp phân công có hạn và policy đọc W1-P3.
- `frontend/src/pages/AdminManagement.jsx`, `Organizations.jsx`, `frontend/src/routes/AppRoutes.jsx`, `frontend/src/components/common/Sidebar.jsx`: UI admin, route/menu, ngày kết thúc đại diện.
- `supabase/migrations/20261002000011_w2_p1_assignment_revocation.sql`, `supabase/seed.sql`: thu hồi có lịch sử, unique mã chuẩn hóa, demo văn thư và thời hạn đại diện.
- `backend/tests/w2-p1.test.js`, `w2-p1.integration.js`: kiểm thử cô lập và HTTP + Supabase thực.
- `docs/api/openapi.json`, `openapi.yaml`, `W2_P1.openapi.json`, `ADMIN_W2_P1.md`, `scripts/update-w2-p1-contract.mjs`: hợp đồng và hướng dẫn; tài liệu tuần này.

## Kiểm tra thực tế

- `node --test backend/tests/w1-p3.test.js backend/tests/w2-p1.test.js`: **9/9 PASS**.
- `npm --prefix frontend run lint`: **exit 0**.
- `npm --prefix frontend run build`: **exit 0**, Vite build thành công.
- `node scripts/validate_contracts.mjs`: **68/68 PASS** (hợp đồng W1 được giữ).
- `npm --prefix backend run migrate:status`: 10 migrations W1 APPLIED; migration W2-P1 PENDING tại lúc kiểm tra cấu hình dùng chung.
- `npm --prefix backend run test:w2-p1:integration` (thực thi tương đương `node tests/w2-p1.integration.js` trong backend): **66/66 HTTP assertions PASS**, trên Supabase thật, rollback schema tạm. Bao gồm code tiếng Việt, code khác hoa/thường, đơn vị inactive và danh sách ngày năm học.
- `git diff --check`: **exit 0**, không lỗi whitespace.

Integration kiểm tra quyền Admin, không tự duyệt; thu hồi scope/role tức thời, descendants=true/false, scope chưa đến hạn/hết hạn, đại diện có hạn/chồng lấn/thu hồi, CRUD ba danh mục, trùng mã, giữ FK khi deactivate, đăng nhập cả năm vai trò demo, deactivate tài khoản chặn token cũ, audit không chứa mật khẩu và version tài khoản stale.

Hai lượt đầu của integration test chưa đạt vì seed W1 không có bản ghi achievements để kiểm tra FK (lần lượt kiểm tra liên kết sẵn có và UPDATE bảng rỗng). Đã tạo riêng một thành tích mô phỏng trong schema test; không thay dữ liệu thật. Các lượt lỗi đều rollback trong finally.

## Phần còn lại

- Xác nhận PR/approval W1-P3/W1-Q3 chưa lấy được do không có gh và trang remote không trả nội dung. Không có phụ thuộc code thiếu khiến W2-P1 phải dùng fixture để nghiệm thu.
- Finding AUTH-02/04/05 của review W1-P4 còn thuộc W1-Q3; cần xử lý trước nghiệm thu production auth.
- Cần áp dụng migration mới trước khi chạy bản backend này với schema `app` dùng chung. Chưa nạp lại seed hoặc triển khai giao diện lên hosting. UI chưa kiểm tra thao tác bằng trình duyệt trên DB dùng chung.
- Hướng dẫn API, demo và các bước tự kiểm tra ở `docs/api/ADMIN_W2_P1.md`. Danh sách admin giới hạn 500; không có phân trang; danh mục chưa có optimistic version.
- Không commit, push hoặc merge. Đề xuất: `feat(W2-P1): quản trị tài khoản, phân công và danh mục trên Supabase`.
