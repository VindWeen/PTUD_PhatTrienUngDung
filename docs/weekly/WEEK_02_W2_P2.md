# W2-P2 — Bàn giao Võ Nhạc Phước

## Kết quả

API/UI ghi nhận quyết định đã ban hành; DRAFT → RECORDED đủ quyết định/file, thu hồi có lý do, thay thế cùng chủ thể, liên kết thành tích tùy chọn, lịch sử và audit transaction. RecordsOfficer hiệu lực và scope DB, không bypass Admin. Private storage/validation W2-Q2 được tái sử dụng. Supabase migration 014 và partial unique cá nhân/tập thể chặn trùng chủ thể–loại–quyết định khi RECORDED, cho nhiều người cùng quyết định. Giữ dữ liệu legacy; không bịa metadata bị thiếu.

## File thay đổi

- `backend/src/modules/awards/awardService.js`, `awardRoutes.js`: validation, nghiệp vụ, DB transactions, scope, file, REST.
- `backend/src/app.js`, `backend/package.json`: mount routes và lệnh test.
- `backend/src/modules/profiles/profileRepository.js`: portfolio đọc lịch sử awards mới lẫn legacy.
- `backend/tests/w2-p2.test.js`, `w2-p2.integration.js`: unit và Express/PostgreSQL thật, schema tạm rollback và dọn file.
- `supabase/migrations/20261005000014_w2_p2_award_decisions.sql`: schema, constraints, index, private Data API permissions.
- `frontend/src/pages/Awards.jsx`, `services/awardsApi.js`, `routes/AppRoutes.jsx`, `components/common/Sidebar.jsx`: màn hình nhập và luồng API thật.
- `docs/api/AWARDS_W2_P2.md`, `W2_P2.openapi.json`, `openapi.json`, `openapi.yaml`: hợp đồng và hướng dẫn tự kiểm tra.
- `scripts/update-w2-p2-contract.mjs`: cập nhật riêng các path awards, giữ hợp đồng module khác.
- `.gitignore`: bỏ qua npm cache cục bộ; không đưa key, token hay file quyết định vào Git.

## Kiểm tra thực tế

| Lệnh | Kết quả |
|---|---|
| `npm --prefix backend run test:w2-p2` | 4/4 PASS |
| `npm --prefix backend run test:w2-p2:integration` | 27 assertions PASS, Express + Supabase PostgreSQL thật, toàn bộ migrations và seed trong schema tạm rollback |
| `node --test backend/tests/w2-p2.test.js backend/tests/w2-q2.test.js backend/tests/w2-q1.test.js backend/tests/w1-p3.test.js` | 18/18 PASS |
| `npm --prefix backend test` | 31/31 PASS auth/scope; runner hiện có dùng DB demo cấu hình, kiểm tra đăng nhập/refresh/đổi mật khẩu rồi khôi phục mật khẩu |
| `npm --prefix frontend run build` | PASS, Vite 1670 modules |
| `npm --prefix frontend run lint` | PASS |
| `node scripts/validate_contracts.mjs` | 68/68 PASS; đây là kiểm tra tĩnh, không thay thế integration |
| `git diff --check` | PASS |

Integration bao phủ thiếu file, role ADMIN, cá nhân/tập thể, unique hai chủ thể, nhiều người cùng quyết định, khóa upload sau RECORDED, stale version, lý do thu hồi, giải phóng unique sau revoke, bản thay thế, portfolio và scope hết hạn trên detail/list/download. Các lỗi phát hiện khi chạy thật (role lấy từ token và suy diễn kiểu tham số pg) đã sửa trong module awards.

## Tự kiểm tra và giới hạn

Đọc `docs/api/AWARDS_W2_P2.md` để chạy migrate, mở `/awards`, nhập và kiểm tra quyền/trùng/file. Migration chưa áp dụng vào schema `app` đang dùng; test chỉ áp dụng vào schema tạm. Không có phụ thuộc code bị chặn; chưa đối chiếu PR đang mở từ GitHub, chỉ xác nhận lịch sử tích hợp tại local.

UI dùng mã hồ sơ/danh mục, chưa có tìm kiếm lựa chọn; chưa kiểm tra thao tác UI bằng trình duyệt. Chưa có sửa nháp tại chỗ và endpoint đọc awards riêng cho Lecturer/Manager/đại diện; portfolio cá nhân vẫn tích hợp. Các fixture cũ không dùng cho API awards ghi. OpenAPI W2-P2 công bố response snake_case và BIGINT string, khác fixture đọc cũ; cần thống nhất nếu một client khác sử dụng fixture cũ.

Không triển khai AI, không tự trao thưởng, không bổ sung nguồn KPI. Không commit/push/merge.

Commit đề xuất: `feat(awards): [W2-P2] record decision-based awards with scoped private files and PostgreSQL uniqueness`
