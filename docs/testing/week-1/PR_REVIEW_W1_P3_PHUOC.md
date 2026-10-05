# BẢN ĐÁNH GIÁ VÀ REVIEW HỒ SƠ/TỔ CHỨC (PR W1-P3)

- **Người thực hiện Review:** Tạ Trần Vinh Quang (Phụ trách W1-Q4: Audit nền, kiểm thử và review hồ sơ)
- **Đối tượng Review:** Module Hồ sơ cá nhân, Tập thể và Quản lý Cơ cấu tổ chức (W1-P2 & W1-P3) do **Võ Nhạc Phước** triển khai
- **Thời điểm nghiệm thu:** 2026-10-01
- **Trạng thái:** **CHẤP THUẬN CÓ ĐIỀU KIỆN & BỔ SUNG HOÀN THIỆN (APPROVED WITH AMENDMENTS)**

---

## 1. TỔNG QUAN PHẠM VI REVIEW

Module W1-P3 tập trung vào thiết kế cơ sở dữ liệu, nghiệp vụ backend và giao diện cho phân hệ:
1. **Hồ sơ cá nhân:** `GET/PATCH /api/v1/me/profile`, `GET/PATCH /api/v1/lecturers/{id}`.
2. **Hồ sơ tập thể đơn vị:** `GET /api/v1/units/{id}/profile`.
3. **Quản lý cơ cấu tổ chức:** `GET/POST /api/v1/organizations`, `PATCH/DELETE /api/v1/organizations/{id}`.
4. **Đại diện đơn vị & Điều chuyển công tác:** `POST /api/v1/organizations/{id}/representative`, `POST /api/v1/lecturers/{id}/assignments`.
5. **Ràng buộc toàn vẹn cơ sở dữ liệu:** Migrations `20261001000009_w1_p2_profiles_catalogs.sql` và `20261001000010_w1_p3_organization_integrity.sql`.

---

## 2. ĐÁNH GIÁ CHI TIẾT (STRENGTHS & WEAKNESSES)

### 2.1. Các điểm thực hiện xuất sắc (Strengths)

1. **Bảo toàn bất biến bối cảnh đơn vị (Immutable Context Unit Rule):**
   - Nghiệp vụ điều chuyển giảng viên (`transferLecturer`) chỉ tạo bản ghi phân công công tác mới và đóng `valid_to` của phân công cũ.
   - Hoàn toàn **không sửa** `app.achievements.context_unit_id` của các hồ sơ thành tích cũ. Điều này tuân thủ nguyên tắc liêm chính học thuật: thành tích đạt được trong giai đoạn nào thuộc về đơn vị công tác thời điểm đó.
2. **Chống chu trình cây tổ chức (Cycle Prevention):**
   - Đã triển khai ở cả 2 tầng:
     - Tầng Database: Trigger `app.prevent_organization_cycle()` chặn ngay từ cấp lưu trữ khi chọn một đơn vị con làm cha.
     - Tầng Service: `ensureParent` đệ quy kiểm tra `hasDescendant` trước khi gọi câu lệnh UPDATE.
3. **Kiểm soát ghi đè đồng thời (Optimistic Concurrency Control):**
   - Cả hồ sơ giảng viên và đơn vị tổ chức đều sử dụng trường `version BIGINT` bắt buộc trong payload cập nhật. Ngăn chặn hiện tượng *Lost Update* khi nhiều quản trị viên cùng thao tác.
4. **Bảo toàn dữ liệu lịch sử:**
   - Đã chuyển đổi các khóa ngoại sang `ON DELETE RESTRICT` và kiểm tra phụ thuộc trước khi xóa đơn vị (`getDependencyCounts`), ngăn chặn việc xóa nhầm đơn vị đang có hồ sơ, khen thưởng, phạm vi hoặc giảng viên.
5. **Đồng bộ hợp đồng tĩnh:**
   - Đạt 68/68 bài kiểm tra hợp đồng tĩnh tại `scripts/validate_contracts.mjs`.

---

### 2.2. Các tồn tại và rủi ro phát hiện trong quá trình kiểm thử thực tế (Issues & Risks)

Qua kiểm thử live end-to-end trên môi trường Supabase PostgreSQL thật (không chỉ dùng mock), Quang đã phát hiện các điểm nghẽn nghiêm trọng sau:

1. **Rủi ro thiếu sót Audit Log (Nghiêm trọng):**
   - Trong code của Phước, các thao tác quản trị đặc biệt nhạy cảm gồm:
     - Tạo, sửa, xóa đơn vị tổ chức (`createUnit`, `updateUnit`, `removeUnit`).
     - Bổ nhiệm lãnh đạo/đại diện đơn vị (`appointRepresentative`).
     - Điều chuyển nhân sự giữa các khoa/bộ môn (`transferLecturer`).
     - Cập nhật thông tin hồ sơ cá nhân (`updateProfile`).
   - Hoàn toàn **chưa gọi ghi nhận nhật ký kiểm toán** vào `app.audit_logs`. Khi xảy ra tranh chấp học thuật hoặc thanh tra phân quyền, hệ thống sẽ thiếu dấu vết người thực hiện (`actorId`), thời điểm và giá trị trước/sau thay đổi.
   - 👉 **Hành động xử lý của W1-Q4:** Quang đã xây dựng `auditService.js` với cơ chế che bí mật đệ quy (`maskSecrets`) và tích hợp trực tiếp vào toàn bộ các phương thức nhạy cảm trên trong `organizationService.js` và `profileService.js`.

2. **Chưa áp dụng Migration 009 & 010 vào cơ sở dữ liệu Supabase dùng chung:**
   - Trong quá trình chạy live demo, lệnh gọi API `GET /api/v1/organizations` và `GET /api/v1/units/1/profile` ban đầu trả về lỗi `500 Internal Server Error` do `column u.description does not exist`.
   - Nguyên nhân: Các file migration W1-P2 (`...009`) và W1-P3 (`...010`) mới chỉ nằm trong repository hoặc test DB cục bộ, chưa được chạy `migrateUp` trên Supabase chung.
   - 👉 **Hành động xử lý của W1-Q4:** Quang đã chạy `node database/scripts/migrate.js up` và `node database/scripts/seed.js` trên Supabase thật. Hiện tại cả 10 migration đều ở trạng thái `APPLIED` thành công 100%.

3. **Giao diện đăng nhập thiếu nút thử nghiệm vai trò ADMIN và ĐBCL:**
   - Giao diện `AuthPage.jsx` trước đó chỉ có nút bấm tài khoản cho Giảng viên (`an.nv`) và Lãnh đạo Khoa (`bich.tt`). Để kiểm thử tính năng quản lý cơ cấu tổ chức (vốn yêu cầu quyền `ADMIN`), người dùng phải tự gõ tài khoản `duc.pm`.
   - 👉 **Hành động xử lý của W1-Q4:** Đã bổ sung 2 nút đăng nhập nhanh `Admin (duc.pm)` và `ĐBCL (cuong.lh)` vào giao diện `AuthPage.jsx` mà không làm phá vỡ layout 16:9 của thẻ đăng nhập.

4. **Hiện tượng Race Condition tiềm ẩn khi xóa đơn vị:**
   - `organizationService.removeUnit` kiểm tra `getDependencyCounts(unitId)` trước bằng một lệnh `SELECT`, sau đó mới gọi `deleteUnit`.
   - Trong môi trường phân tán nếu có request tạo thành tích đồng thời xảy ra giữa 2 câu lệnh, dữ liệu có thể bị rò rỉ nếu không có khóa ngoại `RESTRICT`. May mắn là Phước đã bổ sung `ON DELETE RESTRICT` ở tầng DDL, đóng vai trò phòng vệ cuối cùng hiệu quả.

---

## 3. KẾT LUẬN & KIẾN NGHỊ NGHIỆM THU

| Hạng mục nghiệm thu | Kết quả | Ghi chú |
| :--- | :---: | :--- |
| Schema & Migration W1-P2/P3 | **ĐẠT** | Đã áp dụng 10/10 migration lên Supabase, seed đầy đủ danh mục năm học, loại giải thưởng và phân công. |
| API Hồ sơ cá nhân & Đơn vị | **ĐẠT** | `GET/PATCH /api/v1/me/profile`, `GET /api/v1/units/:id/profile` hoạt động chính xác với live DB. |
| API Cơ cấu tổ chức & Điều chuyển | **ĐẠT** | Đã chặn chu trình, chặn xóa đơn vị có dữ liệu, phân quyền ADMIN chuẩn. |
| Nhật ký kiểm toán & Che bí mật | **ĐẠT** | W1-Q4 đã bổ sung hoàn thiện audit log tự động khử thông tin nhạy cảm. |
| Kiểm thử tự động & CI | **ĐẠT** | 100% tests vượt qua; CI Pipeline sẵn sàng hoạt động trên GitHub. |

**Ý kiến phê duyệt:** Chấp thuận gộp toàn bộ công việc của W1-P3 cùng với các bổ sung hoàn thiện nền tảng của W1-Q4 vào nhánh chính phát triển.
