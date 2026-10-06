# Nhật ký Xử lý Lỗ hổng Bảo mật & Vượt quyền (Week 2 Security Issues Log)

- **Dự án**: PTUD_PhatTrienUngDung
- **Phụ trách kiểm thử & an ninh**: Tạ Trần Vinh Quang (W2-Q4)
- **Người rà soát & phản biện**: Võ Nhạc Phước (W2-P4)
- **Ngày cập nhật**: 06/10/2026
- **Tình trạng tổng thể**: **100% ISSUES RESOLVED & VERIFIED IN REAL TESTS**

---

## 1. Bảng Tổng hợp Quản lý Lỗi (Issue Tracking Matrix)

| Mã Issue | Mức độ | Mô tả ngắn | Người phụ trách | Trạng thái | Kiểm thử xác nhận |
|---|---|---|---|---|---|
| **SEC-W2-01** | **P1 (Nghiêm trọng)** | Quản trị viên (`ADMIN`) tự động bypass phạm vi đơn vị khi phê duyệt thành tích | Tạ Trần Vinh Quang | **CLOSED** | `w2-q4.test.js` (Test 3), `w2-q4.integration.js` (Test 3) |
| **SEC-W2-02** | **P1 (Nghiêm trọng)** | Cán bộ văn thư (`RECORDS_OFFICER`) tải tệp minh chứng cá nhân ngoài scope qua URL; quyền lấy từ JWT cũ | Tạ Trần Vinh Quang | **CLOSED** | `w2-q4.test.js` (Test 4), `w2-q4.integration.js` (Test 4) |
| **SEC-W2-03** | **P1 (Nghiêm trọng)** | Snapshot đọc tệp trước transaction; Nộp hồ sơ không kiểm tra sự tồn tại của tệp vật lý | Tạ Trần Vinh Quang | **CLOSED** | `w2-q4.test.js` (Test 5), `w2-q4.integration.js` (Test 5) |
| **SEC-W2-04** | **P2 (Trung bình)** | Audit log tệp truyền sai tên tham số (`actorId` vs `userId`) và ghi bên ngoài transaction | Tạ Trần Vinh Quang | **CLOSED** | `evidenceService.js` (Lines 169-178, 260-269, 310-318) |
| **SEC-W2-05** | **P1 (Nghiêm trọng)** | Nguy cơ hồ sơ `VERIFIED` tự ý phát sinh bản ghi khen thưởng `AwardRecord` ngầm | Võ Nhạc Phước & Tạ Trần Vinh Quang | **CLOSED** | `w2-q4.test.js` (Test 6), `w2-q4.integration.js` (Test 6) |
| **SEC-W2-06** | **P1 (Nghiêm trọng)** | Đại diện tập thể hết hạn ủy quyền hoặc tài khoản hết hạn scope vẫn nộp/thẩm định | Tạ Trần Vinh Quang | **CLOSED** | `w2-q4.test.js` (Test 1), `w2-q4.integration.js` (Test 1) |
| **SEC-W2-07** | **P1 (Nghiêm trọng)** | Vi phạm nguyên tắc liêm chính: Người tạo (`createdBy`) hoặc người nộp (`submittedBy`) tự duyệt hồ sơ | Tạ Trần Vinh Quang | **CLOSED** | `w2-q4.test.js` (Test 2), `w2-q4.integration.js` (Test 2) |

---

## 2. Chi tiết Kỹ thuật Từng Issue & Biện pháp Khắc phục

### SEC-W2-01: ADMIN Bypass Scope Thẩm định
- **Hiện tượng**: `achievementService.js` trước đây cho phép tài khoản có vai trò `ADMIN` bỏ qua kiểm tra `isUnitInUserScope` khi gọi `verifyAchievement`, `requestCorrection`, và `rejectAchievement`.
- **Rủi ro**: Vi phạm ma trận phân quyền trong `docs/architecture/PERMISSIONS_MATRIX.md` (chỉ Trưởng khoa / Quản lý đơn vị có scope mới được thẩm định chuyên môn).
- **Giải pháp**:
  - Gỡ bỏ hoàn toàn điều kiện `if (userRoles.includes('ADMIN')) return;` trong các hàm thẩm định.
  - Bắt buộc kiểm tra `isUnitInUserScope(client, user.id, achievement.unit_id)` và vai trò `MANAGER` còn hiệu lực trong database.
- **Xác nhận**: Test giả lập và test tích hợp gửi request với user `ADMIN` không có scope đơn vị trả về HTTP 403 `FORBIDDEN` (`SCOPE_UNAUTHORIZED`).

### SEC-W2-02: RECORDS_OFFICER Bỏ qua Scope tải tệp Private & Token Cũ
- **Hiện tượng**: `evidenceService.js` có đoạn `if (user.roles.includes('RECORDS_OFFICER')) return true;` cho phép tải bất kỳ tệp minh chứng cá nhân nào của mọi giảng viên qua URL `/evidence-files/:id/download`. Đồng thời sử dụng claim `user.roles` từ JWT đã ký.
- **Rủi ro**: Lộ lọt tài liệu minh chứng riêng tư giữa các đơn vị; tài khoản bị thu hồi vai trò hoặc hết hạn scope vẫn dùng token còn hạn để trích xuất tệp.
- **Giải pháp**:
  - Loại bỏ hoàn toàn ngoại lệ cho `RECORDS_OFFICER` khi tải minh chứng hồ sơ thành tích cá nhân/đơn vị chưa công bố.
  - Tích hợp hàm `getActiveRoles(client, user.id)` và `isUnitInUserScope` truy vấn quyền từ CSDL thật thay vì tin cậy vào JWT.
- **Xác nhận**: Tải tệp với vai trò `RECORDS_OFFICER` ngoài đơn vị hoặc token có scope hết hạn trả về HTTP 403 `FORBIDDEN`.

### SEC-W2-03: Race Condition Snapshot & Thiếu Kiểm tra Tệp Vật lý
- **Hiện tượng**: Khi gọi `submitAchievement`, danh sách tệp đính kèm được truy vấn ngoài transaction pool trước khi gọi `withTransaction`. Nếu tệp bị xóa vật lý trên ổ đĩa sau khi tải lên hoặc bị xóa mềm song song, hệ thống vẫn nộp thành công và snapshot danh sách tệp không tồn tại.
- **Rủi ro**: Dữ liệu snapshot không phản ánh đúng thực tế, hồ sơ đóng băng các tệp rỗng hoặc hỏng (corrupted files).
- **Giải pháp**:
  - Đưa thao tác đọc danh sách minh chứng vào bên trong transaction client sau khi đã giữ khóa hàng `findAchievementForUpdate`.
  - Tích hợp kiểm tra tồn tại tệp vật lý trên private disk storage (`storage.fileExists(file.storage_key)`) trước khi tạo bản ghi snapshot.
- **Xác nhận**: Giả lập xóa tệp vật lý trên disk trước khi submit trả về HTTP 400 `PHYSICAL_FILE_MISSING`.

### SEC-W2-04: Lệch Tên Tham số Audit Log & Nằm Ngoài Transaction
- **Hiện tượng**: `evidenceService.js` gọi `recordAuditLog` truyền `{ actorId, beforeData, afterData }`, trong khi `auditService.js` yêu cầu `{ userId, oldValues, newValues }`. Ngoài ra audit được gọi sau khi transaction đã COMMIT.
- **Rủi ro**: Bảng `app.audit_logs` bị ghi nhận `user_id = NULL` và `new_values = NULL`; nếu xảy ra lỗi ghi audit thì nghiệp vụ chính đã hoàn tất, không đảm bảo tính toàn vẹn (ACID).
- **Giải pháp**:
  - Đồng bộ chuẩn hóa tên tham số thành `{ userId, oldValues, newValues }`.
  - Đưa lệnh ghi audit vào bên trong transaction client trước `COMMIT`.
- **Xác nhận**: Audit log được lưu đầy đủ thông tin định danh và payload thay đổi trên PostgreSQL Supabase.

### SEC-W2-05: Tách biệt Nghiệp vụ VERIFIED và AwardRecord
- **Hiện tượng**: Mối lo ngại về việc hệ thống tự động sinh bản ghi khen thưởng khi một hồ sơ được phê duyệt thẩm định.
- **Rủi ro**: Phá vỡ quy trình pháp lý khen thưởng của Nhà trường (thẩm định chuyên môn khác với ban hành quyết định thi đua khen thưởng của Hội đồng).
- **Giải pháp**:
  - Rà soát mã nguồn `achievementService.js`, khẳng định không có bất kỳ logic nào gọi sang `AwardService` hoặc chèn vào `app.award_records`.
- **Xác nhận**: Kiểm tra thực tế bằng truy vấn `SELECT COUNT(*) FROM app.award_records WHERE achievement_id = $1` sau khi duyệt hồ sơ cho kết quả bằng 0.

### SEC-W2-06 & SEC-W2-07: Chống Tự Duyệt & Kiểm soát Đại diện Hết hạn
- **Hiện tượng**: Nguy cơ người tự kê khai, người tạo hộ, hoặc người nộp thay có tài khoản Quản lý tự duyệt hồ sơ của chính mình; đại diện đơn vị hết thời hạn ủy quyền vẫn nộp hồ sơ tập thể.
- **Giải pháp**:
  - Triển khai nguyên tắc Liêm chính (Anti-Self-Approval): Chặn tuyệt đối nếu `verifierId` trùng với `lecturer_id`, `created_by`, hoặc `submitted_by` (HTTP 403 `SELF_APPROVAL_PROHIBITED`).
  - Kiểm tra ngày hiệu lực ủy quyền đại diện `effective_to < NOW()` hoặc trạng thái `INACTIVE` trước khi cho phép nộp hồ sơ tập thể.
- **Xác nhận**: Các bài kiểm thử đơn vị và tích hợp trong `w2-q4.test.js` và `w2-q4.integration.js` đều vượt qua 100%.
