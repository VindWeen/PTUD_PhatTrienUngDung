# W2-Q1 — CRUD Thành tích Cá nhân và Tập thể Xuyên suốt

Người phụ trách: **Tạ Trần Vinh Quang** (W2-Q1)  
Bối cảnh kỹ thuật: React 18, Vite, TailwindCSS, Express REST (`/api/v1`), Supabase PostgreSQL, PG Pool, Zod validation, Optimistic Concurrency Control, Audit Logging.

---

## 1. Phạm vi thực hiện & Điểm cuối API

- **Danh sách thành tích (Phân trang & Bộ lọc)**: `GET /api/v1/achievements`
  - Hỗ trợ tham số truy vấn: `page`, `pageSize`, `type`, `status`, `recognitionYear`, `lecturerId`, `unitId`, `search`.
  - Phân quyền & Giới hạn phạm vi (RBAC & Unit Scopes):
    - `LECTURER`: Xem thành tích cá nhân của chính mình và thành tích của đơn vị công tác chính.
    - `UNIT_REPRESENTATIVE`: Xem thành tích của đơn vị được phân công đại diện còn hiệu lực.
    - `MANAGER`: Xem các thành tích có `context_unit_id` thuộc phạm vi quản lý và cây đơn vị con trực thuộc (sử dụng Recursive CTE phân cấp tổ chức).
    - `RECORDS_OFFICER`, `ADMIN`: Xem toàn quyền hệ thống.
- **Chi tiết thành tích**: `GET /api/v1/achievements/:id`
  - Trả về chi tiết bản ghi kèm thông tin giảng viên/đơn vị và đơn vị quản lý thời điểm lập hồ sơ (`context_unit_id`).
  - Kiểm tra nghiêm ngặt quyền truy cập của người yêu cầu (trả về `403 Forbidden` nếu ngoài phạm vi).
- **Tạo bản nháp thành tích**: `POST /api/v1/achievements`
  - Chỉ cho phép tạo ở trạng thái ban đầu `DRAFT`.
  - Bắt buộc tuân thủ ràng buộc chủ thể XOR (`lecturerId` XOR `unitId`).
  - Tự động gán `context_unit_id` bất biến:
    - Với thành tích cá nhân: Tự động truy vấn phân công công tác chính (`is_primary = TRUE`) còn hiệu lực của giảng viên.
    - Với thành tích tập thể: Gán chính `unitId` của đơn vị.
  - Kiểm tra quyền đại diện đơn vị: Với thành tích tập thể, người tạo phải có phân công đại diện (`app.unit_representatives`) đang còn hiệu lực tại ngày bắt đầu/nộp.
- **Chỉnh sửa bản nháp**: `PATCH /api/v1/achievements/:id`
  - Chỉ cho phép cập nhật khi trạng thái là `DRAFT` hoặc `NEED_CORRECTION`.
  - **Khóa các trường nhạy cảm khỏi PATCH trái phép**: Cấm sửa `status`, `createdBy`, `contextUnitId`, `lecturerId`, `unitId`. Schema kích hoạt `.strict()` và chặn mọi payload chứa các trường này với mã lỗi `400 Bad Request`.
  - **Kiểm soát đồng thời (Optimistic Concurrency Control)**: Client bắt buộc gửi trường `version`. Hệ thống kiểm tra `WHERE id = $1 AND version = $2` và tự động tăng `version = version + 1`. Nếu sai lệch version, ném lỗi `409 ConcurrencyConflictError`.
- **Xóa bản nháp**: `DELETE /api/v1/achievements/:id`
  - **Chỉ bản nháp chưa gửi (`DRAFT`) mới được phép xóa**.
  - Nếu bản ghi đã nộp (`SUBMITTED`), đã thẩm định (`VERIFIED`) hoặc bị từ chối (`REJECTED`), hệ thống kiên quyết từ chối với mã lỗi `409 Conflict`.
- **Nhật ký kiểm toán (Audit Logging)**:
  - Mọi thao tác Create, Update, Delete đều tự động kích hoạt `recordAuditLog` (tích hợp W1-Q4) với đầy đủ thông tin `actor_id`, `ip_address`, `user_agent`, và che giấu dữ liệu bí mật trước khi lưu.

---

## 2. Quy tắc toàn vẹn dữ liệu & Nghiệp vụ cốt lõi

1. **Ràng buộc chủ thể XOR**: Một bản ghi thành tích chỉ thuộc về duy nhất một Giảng viên HOẶC một Tập thể/Đơn vị:
   ```sql
   CHECK (
     (lecturer_id IS NOT NULL AND unit_id IS NULL) OR
     (lecturer_id IS NULL AND unit_id IS NOT NULL)
   )
   ```
2. **ContextUnitId bất biến**:
   - `context_unit_id` đại diện cho đơn vị quản lý hồ sơ tại thời điểm lập thành tích.
   - Khi giảng viên chuyển công tác sang đơn vị khác, `context_unit_id` của các thành tích quá khứ **giữ nguyên tuyệt đối**, không bị cập nhật theo đơn vị mới (đảm bảo tính toàn vẹn lịch sử xét duyệt và tính điểm KPI của đơn vị cũ).
3. **Kiểm tra ngày tháng và năm công nhận**:
   - Năm công nhận `recognition_year` hợp lệ từ năm 1990 đến năm hiện tại + 1.
   - Khoảng thời gian: Nếu có cả `start_date` và `end_date` thì bắt buộc `end_date >= start_date`.

---

## 3. Giao diện người dùng (Frontend UI)

- Trang `Achievements.jsx` được thiết kế đồng bộ theo hệ thống thiết kế chung của dự án (TailwindCSS, Lucide Icons, Dark/Light mode).
- Tái sử dụng một giao diện linh hoạt cho cả 2 chủ thể:
  - Tab chuyển đổi hoặc bộ lọc chủ thể (Tất cả / Cá nhân / Tập thể).
  - Bộ lọc trạng thái (`DRAFT`, `SUBMITTED`, `VERIFIED`, `REJECTED`, `NEED_CORRECTION`).
  - Hộp tìm kiếm theo từ khóa tiêu đề, số quyết định, đơn vị ban hành.
  - Phân trang dữ liệu rõ ràng.
- Modal tạo mới và chỉnh sửa bản nháp:
  - Form validation chặt chẽ cả ở phía client trước khi gửi.
  - Nút Xóa bản nháp hiển thị an toàn kèm cảnh báo xác nhận (chỉ xuất hiện đối với trạng thái `DRAFT`).
  - Modal xem chi tiết đầy đủ thông tin minh chứng, bối cảnh đơn vị và lịch sử trạng thái.

---

## 4. Kiểm thử tự động & Nghiệm thu

### Chạy toàn bộ kiểm thử xác thực:

```powershell
# 1. Kiểm thử hợp đồng tĩnh
node scripts/validate_contracts.mjs

# 2. Kiểm thử Unit Test logic nghiệp vụ W2-Q1
npm --prefix backend run test:w2-q1

# 3. Kiểm thử Tích hợp HTTP trên Live Supabase DB W2-Q1
npm --prefix backend run test:w2-q1:integration

# 4. Kiểm thử Frontend Lint & Build
npm --prefix frontend run lint
npm --prefix frontend run build
```

### Kết quả nghiệm thu thực tế:
- `validate_contracts.mjs`: **68/68 PASS**
- `test:w2-q1` (Unit Tests): **6/6 PASS**
- `test:w2-q1:integration` (Live HTTP Integration): **12/12 PASS**
- `frontend lint & build`: **100% không cảnh báo/lỗi**
