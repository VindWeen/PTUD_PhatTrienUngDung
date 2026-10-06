# W3-P1 — Bàn giao Võ Nhạc Phước

Ngày 06/10/2026. Triển khai tại workspace, chưa commit/push/merge hoặc deploy môi trường chung.

## Kết quả

- API SQL trên Supabase PostgreSQL/pg theo ADR-001 thay DB SQL Server của plan cũ. Auth Express/private file giữ nguyên.
- Dashboard/report cùng nguồn và scope DB; VERIFIED/RECORDED tách riêng, cá nhân/tập thể riêng; năm hợp lệ phân biệt, REVOKED không tính hợp lệ.
- Tìm kiếm/lọc năm ghi nhận, năm học thành tích, đơn vị lịch sử, nguồn/loại, chủ thể, trạng thái; phân trang có tổng toàn tập.
- CSV UTF-8 BOM, CRLF, quote/escape và chống formula injection; toàn bộ kết quả cùng bộ lọc, không giới hạn theo trang. Quyền xuất kiểm tra backend theo ma trận.
- Reuse role/auth/dbHelper/apiClient. Không sửa workflow Q3, awards P2, auth, evidences/private storage, AI hoặc migrations người khác. Dashboard UI demo được thay bằng thống kê SQL; tài nguyên/demo của các màn hình khác giữ nguyên.
- W2-P2 và W2-Q3 đã có trong Git. Không tìm thấy AGENTS.md và không có gh để kiểm tra PR đang mở; không báo đã kiểm PR trên GitHub. Chi tiết commit/hợp đồng trong `docs/api/REPORTS_W3_P1.md`.

## Files thay đổi/thêm

| Nhóm | Files |
|---|---|
| Backend | `backend/src/modules/reports/reportService.js`, `reportRoutes.js`; đăng ký router `backend/src/app.js`; thêm scripts `backend/package.json` |
| UI | `frontend/src/pages/Reports.jsx`, `Dashboard.jsx`; `frontend/src/services/reportsApi.js`, `portfolioApi.js`; route `frontend/src/routes/AppRoutes.jsx`; menu `frontend/src/components/common/Sidebar.jsx` |
| Tests | `backend/tests/w3-p1.test.js`, `backend/tests/w3-p1.integration.js` |
| Hợp đồng | `docs/api/W3_P1.openapi.json`, `docs/api/openapi.json`, `docs/api/openapi.yaml`; `scripts/update-w3-p1-contract.mjs` chỉ cập nhật path W3-P1 |
| Tài liệu | `docs/api/REPORTS_W3_P1.md`, `docs/weekly/WEEK_03_W3_P1.md` |

## Kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `node --test backend/tests/w3-p1.test.js backend/tests/w2-p2.test.js backend/tests/w2-q3.test.js` | 11/11 PASS (W3-P1 3, W2-P2 4, W2-Q3 4) |
| Trong backend: `$env:NODE_ENV='test'; npm run test:w3-p1:integration` | **126 assertions PASS**, Express + pg + Supabase thật, fixture tổng hợp, rollback schema tạm và xác nhận schema đã bị xóa |
| `npm --prefix frontend run build` | PASS, Vite production build 1675 modules |
| Trong frontend: `npx eslint src/pages/Reports.jsx src/pages/Dashboard.jsx src/services/reportsApi.js src/services/portfolioApi.js src/routes/AppRoutes.jsx src/components/common/Sidebar.jsx` | PASS, exit 0 |
| `node scripts/validate_contracts.mjs` | 68/68 PASS, kiểm tra tĩnh hợp đồng cũ vẫn đạt |
| Kiểm tra references/schema W3_P1.openapi với root contract bằng Node | 6 path PASS |
| `node --check backend/src/modules/reports/reportService.js`, tương tự `reportRoutes.js`; `git diff --check` | PASS |

Các lần chạy đầu phát hiện assertion thừa trong unit test và import/route/menu bị lặp; đã sửa và chạy lại đạt. Lượt đối soát được mở rộng thêm alias blueprint, IDs BIGINT dạng chuỗi, so danh tính từng hàng CSV, nhóm/số năm trong CSV và legacy thiếu danh mục. Không dùng lại kết quả trước thay đổi làm kết quả cuối.

Fixture cơ sở: 12 hàng (7 thành tích, 5 awards mới), 8 hợp lệ. Nhóm lần lượt: thành tích cá nhân 6/4/3 năm; thành tích tập thể 1/1/1 năm; awards cá nhân 3/2/1 năm; awards tập thể 2/1/1 năm. Thêm awards legacy thiếu metadata để kiểm tra không suy diễn, và thành tích legacy thiếu loại ở cuối test để kiểm tra vẫn đọc được. Dữ liệu mô phỏng được gắn nhãn; không lưu ra DB app thật.

## Tự kiểm tra / giới hạn

1. Chạy các lệnh trên với env backend hợp lệ (không đưa env/token vào Git).
2. Chạy backend và Vite với `VITE_DATA_SOURCE=api`; đăng nhập API thật, vào `/me/dashboard`, `/reports`.
3. Áp dụng cùng bộ lọc; đối chiếu tổng/thẻ với CSV, thử trang 2, năm trùng, REVOKED, đơn vị lịch sử. ID đơn vị/danh mục/năm học lấy từ màn hình tổ chức/quản trị.
4. Lecturer chỉ xem mình và không xuất CSV; Manager/RecordsOfficer theo scope hiện tại; đại diện theo phân công hiệu lực. Gọi API trực tiếp để kiểm tra 401/403, không chỉ nhìn nút UI.

Không thiếu phụ thuộc để chặn SQL integration. Chưa kiểm thử UI bằng trình duyệt, chưa deploy chung. W2-P2 chưa có năm học award: lọc năm học áp dụng thành tích; chọn AWARD cùng academicYearId bị 400. Award legacy thiếu decision metadata không vào báo cáo mới; dữ liệu gốc giữ nguyên. CSV gom bộ nhớ, chưa streaming cho tập dữ liệu lớn. Không thêm AI hay tự xác định tiêu chí/trao thưởng.

Tài liệu API, plan Supabase, quy tắc scope, fixture và hướng dẫn đầy đủ: `docs/api/REPORTS_W3_P1.md`.

Commit đề xuất: `feat(W3-P1): add scoped SQL dashboard reports and safe CSV export`.
