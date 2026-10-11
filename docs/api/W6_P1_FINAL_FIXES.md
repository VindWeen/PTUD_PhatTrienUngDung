# W6-P1 — Danh mục cho luồng kê khai từ KPI

Hợp đồng máy đọc: [W6_P1.openapi.json](W6_P1.openapi.json).

`GET /api/v1/achievements/catalogs` là endpoint chỉ đọc metadata danh mục thành tích đang hoạt động. Cần Bearer token hợp lệ và ít nhất một vai trò hiện hành trong DB: LECTURER, UNIT_REPRESENTATIVE, MANAGER, RECORDS_OFFICER, ADMIN. Không nhận quyền từ claims JWT thay DB. Lỗi đọc quyền DB truyền tới middleware, không fallback JWT.

200: `{success:true,data:[{achievement_type_id,code,name,applicable_subject_type}]}`. ID PostgreSQL bigint được trả dạng chuỗi. `Cache-Control: no-store`. 401 khi thiếu phiên/tài khoản không hoạt động; 403 khi không còn vai trò cho phép. Lỗi DB theo middleware chung. Không nhận bộ lọc, không trả hồ sơ/chủ thể hay số liệu cá nhân.

Route đặt trước `/achievements/:id`; tuân theo controller → service → repository. Frontend `achievementsApi.listAchievementTypes()` dùng endpoint này khi mở hồ sơ nguồn từ KPI. Endpoint `/admin/achievement-types` và toàn bộ quyền quản trị/ghi vẫn giữ nguyên. Loại ngừng hoạt động không xuất hiện trong danh mục mới.

Kiểm thử: `npm --prefix backend run test:w6-p1`; integration `node backend/tests/w3-p1.integration.js` kiểm tra giảng viên đọc được, danh mục ngừng hoạt động bị loại, thiếu token bị 401 và vai trò bị thu hồi bị 403. E2E browser kiểm tra phản hồi danh mục 200 sau khi tạo DRAFT từ KPI và theo link `/achievements`.
