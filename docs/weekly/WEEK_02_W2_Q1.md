# Bàn giao W2-Q1 — CRUD Thành tích Cá nhân và Tập thể Xuyên suốt

Phụ trách: **Tạ Trần Vinh Quang**.  
Bối cảnh: React 18 / Vite / TailwindCSS, Express REST `/api/v1`, Supabase PostgreSQL qua `pg` pool, JWT auth và file private giữ nguyên. Tái sử dụng các module đã hoàn thành (W1-Q4 Audit Log, W1-P3 Tổ chức & Phạm vi, W2-P1 Quản trị phân công).

---

## 1. Các file thay đổi & tạo mới

### Backend & Database:
- `supabase/migrations/20261005000012_w2_q1_achievements_crud.sql`: Bổ sung chỉ mục tối ưu tìm kiếm theo bối cảnh đơn vị (`context_unit_id`), năm công nhận và loại thành tích; Trigger cập nhật `updated_at`. Đã áp dụng thành công trên Supabase DB.
- `backend/src/modules/achievements/achievementSchemas.js`: Schema validation bằng Zod. Kiểm tra nghiêm ngặt ràng buộc chủ thể XOR (`lecturerId` XOR `unitId`), tính hợp lệ của ngày tháng và năm công nhận; Kích hoạt `.strict()` để khóa cứng các field nhạy cảm (`status`, `createdBy`, `contextUnitId`, `lecturerId`, `unitId`) khi PATCH.
- `backend/src/modules/achievements/achievementRepository.js`: Tầng truy cập dữ liệu với parameterized queries 100%, bảo vệ chống SQL Injection; Hỗ trợ phân trang, bộ lọc linh hoạt, optimistic locking `version = version + 1`, kiểm tra phân cấp quản lý CTE recursive.
- `backend/src/modules/achievements/achievementService.js`: Nghiệp vụ cốt lõi:
  - Tự động gán `context_unit_id` bất biến từ đơn vị công tác chính của Giảng viên hoặc ID của tập thể.
  - Kiểm tra đại diện đơn vị còn hiệu lực (`findActiveRepresentative`) khi tạo thành tích tập thể.
  - Giới hạn quyền xem theo `isUnitInUserScope` cho vai trò `MANAGER`.
  - Giới hạn quyền sửa ở trạng thái `DRAFT` và `NEED_CORRECTION`.
  - Giới hạn quyền xóa duy nhất cho bản ghi `DRAFT` (chặn xóa hồ sơ đã nộp/thẩm định với mã lỗi `409 Conflict`).
  - Ghi nhật ký kiểm toán `recordAuditLog` tự động cho Create, Update, Delete.
- `backend/src/modules/achievements/achievementController.js` & `achievementRoutes.js`: Xử lý HTTP request/response RESTful, gắn middleware xác thực và phân quyền.
- `backend/src/app.js`: Mount router `/api/v1/achievements`.
- `backend/package.json`: Thêm npm scripts `test:w2-q1` và `test:w2-q1:integration`.

### Frontend:
- `frontend/src/services/fixtureClient.js`: Bổ sung client fixture cho `listAchievements` và `getAchievementById`.
- `frontend/src/services/achievementsApi.js`: API service tích hợp cả Express REST backend thật và fixture fallback.
- `frontend/src/pages/Achievements.jsx`: Màn hình giao diện quản lý thành tích thống nhất cho cả Cá nhân và Tập thể: bộ lọc phân trang, tìm kiếm, modal tạo mới/chỉnh sửa bản nháp, modal xem chi tiết hồ sơ, nút xóa an toàn bản nháp `DRAFT`.
- `frontend/src/routes/AppRoutes.jsx`: Khai báo route `/achievements` và alias `/me/achievements`.
- `frontend/src/components/common/Sidebar.jsx`: Thêm mục menu "Thành tích" với icon `Award`.

### Tests & Documentation:
- `backend/tests/w2-q1.test.js`: 6 bài kiểm thử đơn vị logic nghiệp vụ (XOR, auto contextUnitId, đại diện đơn vị, manager scope, draft delete, concurrency conflict).
- `backend/tests/w2-q1.integration.js`: 12 bài kiểm thử tích hợp HTTP thực tế với Supabase PostgreSQL cloud.
- `docs/api/ACHIEVEMENTS_CRUD_W2_Q1.md`: Tài liệu kỹ thuật chi tiết các điểm cuối API và quy tắc nghiệp vụ.
- `docs/weekly/WEEK_02_W2_Q1.md`: Báo cáo bàn giao tuần 2.

---

## 2. Kết quả kiểm tra thực tế

- `node scripts/validate_contracts.mjs`: **68/68 PASS**
- `npm --prefix frontend run lint`: **0 errors, 0 warnings** (exit code 0)
- `npm --prefix frontend run build`: **Vite build thành công** (exit code 0)
- `npm --prefix backend test` (Runner W1-Q3): **31/31 PASS**
- `npm --prefix backend run test:w2-q1`: **6/6 PASS**
- `npm --prefix backend run test:w2-q1:integration`: **12/12 PASS** (chạy trên live Supabase DB)
- `npm --prefix backend run test:audit`: **5/5 PASS**
- `npm --prefix backend run test:w1-p3`: **4/4 PASS**
- `npm --prefix backend run test:w2-p1`: **5/5 PASS**
- `git diff --check`: **exit 0**, không có lỗi whitespace hay conflict markers.

---

## 3. Tiêu chí nghiệm thu đã hoàn thành

1. **Chủ hồ sơ và đại diện đúng hạn tạo/sửa được**: Giảng viên tạo bản nháp cá nhân thành công; đại diện đơn vị được ủy quyền trong thời hạn tạo bản nháp tập thể thành công; người không có ủy quyền đại diện bị chặn `403`.
2. **Manager xem theo ContextUnitId**: Người quản lý chỉ xem được hồ sơ có `context_unit_id` thuộc đơn vị mình phụ trách hoặc cây đơn vị con (thông qua CTE). Truy cập ngoài phạm vi bị chặn `403`.
3. **Khóa các trường nhạy cảm khỏi PATCH trái phép**: Cấm client thay đổi `status`, `createdBy`, `contextUnitId`, `lecturerId`, `unitId` thông qua API PATCH (trả về `400 Bad Request`).
4. **Chỉ nháp chưa gửi được xóa**: Chỉ cho phép xóa khi `status === 'DRAFT'`. Hồ sơ đã nộp (`SUBMITTED`) hoặc đã duyệt (`VERIFIED`) bị chặn xóa với lỗi `409 Conflict`.
5. **Kiểm tra XOR / ngày / năm / scope**: Kiểm tra chặt chẽ XOR giữa cá nhân và tập thể, `recognition_year >= 1990`, `end_date >= start_date`.
6. **Kiểm soát đồng thời (Optimistic Concurrency Control)**: Sử dụng trường `version`, tự động phát hiện và chặn ghi đè khi có xung đột phiên bản (`409 ConcurrencyConflictError`).
7. **UI dùng lại cho cả hai chủ thể**: Một màn hình giao diện duy nhất đáp ứng trọn vẹn cả quản lý thành tích cá nhân và thành tích tập thể.
