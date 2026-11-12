# W1-P4 — Review login và scope

Ngày review: **01/10/2026**  
Phạm vi: mã hiện có của Express auth, middleware role/scope, route profile/organization, frontend session/route. Đây là review; W1-P4 không sửa ranh giới auth của Quang.

## Kết luận

**REQUEST CHANGES trước khi nghiệm thu tích hợp thật.** Cơ chế nền đã đúng hướng (access token trong bộ nhớ, refresh token HttpOnly có rotation, role nhạy cảm đọc lại DB, admin không tự bypass scope), nhưng còn finding High làm lộ dữ liệu hồ sơ và cấu hình production không an toàn nếu thiếu env.

## Findings

| ID | Mức | Vị trí | Phát hiện / tác động | Yêu cầu xử lý |
|---|---|---|---|---|
| `AUTH-01` | HIGH | `profileRoutes.js`, `organizationRoutes.js` | `GET /lecturers/:id` và `GET /units/:id/profile` chỉ qua `authenticate`. Mọi tài khoản đăng nhập có thể đọc hồ sơ người/đơn vị bất kỳ, trái ma trận quyền yêu cầu phạm vi đơn vị cho hồ sơ tập thể và nguyên tắc tối thiểu quyền. | Thêm policy đọc: chủ hồ sơ hoặc role+scope hợp lệ; unit profile phải kiểm tra đại diện/scope hoặc admin. Test chéo hai đơn vị. |
| `AUTH-02` | HIGH | `backend/src/config/env.js` | Hai JWT secret có giá trị mặc định dev. Production vẫn khởi động nếu thiếu secret và dùng chuỗi biết trước. | Không có default cho production; fail-fast, yêu cầu secret riêng đủ mạnh. Không commit secret. |
| `AUTH-03` | MEDIUM | `authRoutes.js`, `requireScope.js`, hợp đồng quyền | Route test dùng `UNIT_REP`, trong khi hợp đồng/seed/frontend dùng `UNIT_REPRESENTATIVE`. Người đại diện hợp lệ sẽ bị 403 hoặc code tiếp theo tiếp tục dùng sai tên. | Chuẩn hóa một mã duy nhất theo hợp đồng (`UNIT_REPRESENTATIVE`) và thêm contract test. |
| `AUTH-04` | MEDIUM | `authController.refresh`, `authService.refreshToken` | Phiên `rememberMe` 30 ngày bị đổi thành cookie/token 7 ngày ngay lần refresh đầu (`false` và `+7 ngày`). | Lưu loại/độ dài phiên cùng refresh token hoặc giữ hạn tuyệt đối đã chọn; test qua rotation. |
| `AUTH-05` | MEDIUM | `app.js`, public auth routes | Chưa thấy rate limit/throttling cho `/auth/login` và `/auth/refresh`; tăng rủi ro brute force và làm cạn tài nguyên. | Thêm giới hạn theo IP+tài khoản, phản hồi chung, log có correlation ID; không log mật khẩu/token. |
| `AUTH-06` | MEDIUM | `authenticate.js`, các route chỉ dùng authenticate | Access token 2 giờ không đọc lại trạng thái tài khoản. Tài khoản vừa `LOCKED` vẫn gọi được endpoint chỉ yêu cầu authenticate đến khi token hết hạn. | Với dữ liệu nhạy cảm, kiểm tra session/user active hoặc giảm TTL; test khóa tài khoản tức thời theo yêu cầu nghiệp vụ. |
| `AUTH-07` | LOW | `AppRoutes.jsx`, `AuthContext.jsx` | Frontend `hasScope` chỉ so khớp unit trực tiếp, chưa phản ánh `IncludeDescendants`; menu/route chỉ là UX và không thể thay backend guard. | Không dùng helper frontend làm căn cứ cấp quyền; nếu hiển thị cây con, nhận effective scope từ API nhưng backend vẫn quyết định. |

## Kiểm soát đã đạt

- Access token chỉ giữ trong bộ nhớ frontend; refresh token dùng cookie `HttpOnly`.
- Refresh token được lưu dạng băm, có rotation và phát hiện tái sử dụng; đổi mật khẩu thu hồi toàn bộ refresh token.
- `requireRoles` đọc vai trò còn hiệu lực trực tiếp từ DB, phù hợp yêu cầu thu hồi quyền có hiệu lực ngay trên route có middleware này.
- `requireScope` không cấp ngoại lệ cho `ADMIN`; `antiSelfApproval` tách thành middleware backend.
- Frontend không âm thầm fallback từ API thật sang fixture; `VITE_DATA_SOURCE` chọn rõ `api|fixture`.

## Checklist retest cho Quang

1. Đăng nhập sai/đúng, tài khoản `LOCKED`, bắt buộc đổi mật khẩu và refresh-token reuse.
2. Thu hồi role/scope trong lúc access token còn hạn; route nhạy cảm phải trả 403 ngay.
3. Lecturer A không đọc/sửa Lecturer B; đại diện Khoa A không đọc hồ sơ Khoa B.
4. `IncludeDescendants=true/false`, scope hết hạn, chuyển đơn vị và dữ liệu có `ContextUnitId` lịch sử.
5. `ADMIN` không duyệt khi thiếu scope; manager không tự duyệt hồ sơ mình tạo/nộp/là chủ thể.
6. Phiên 30 ngày vẫn giữ đúng chính sách sau nhiều lần rotation.
7. Production thiếu JWT secret phải từ chối khởi động.

## Trạng thái phụ thuộc

- W1-P3 có route/profile/organization trong cây mã hiện tại.
- Middleware W1-Q3 có mặt nhưng chưa thể coi là nghiệm thu vì `AUTH-01` và `AUTH-03`; metadata PR/approval của Quang không có trong workspace để xác nhận đã merge/review.
- Không chạy `backend/tests/runner.js` trên env hiện có vì runner có nhánh live thay mật khẩu tài khoản thử nghiệm. Chỉ chạy test cô lập không đụng DB thật khi bàn giao.
