# HỢP ĐỒNG KỸ THUẬT VÀ QUY CHUẨN KHO VĂN BẢN QUY ĐỊNH (W3-Q2)

**Người phụ trách:** Tạ Trần Vinh Quang (W3-Q2)  
**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Khen thưởng - Đại học Lạc Hồng (PTUD)  
**Ngày ban hành:** 06/10/2026  

---

## 1. Mục tiêu và Nguyên tắc Thiết kế

1. **Tính Bất biến của Quy định (Immutability):**
   - Các văn bản quy phạm pháp luật và quy chế Nhà trường một khi đã ban hành không được sửa đổi trực tiếp dữ liệu cũ.
   - Khi có sửa đổi bổ sung, hệ thống tạo bản ghi phiên bản mới (`app.regulation_document_versions`) và liên kết quan hệ thay thế qua `supersedes_version_id`.
   - Phiên bản tiền nhiệm được tự động chốt ngày hết hiệu lực (`effective_to = new_version.effective_from`).

2. **Toàn vẹn Dữ liệu bằng Mã băm SHA-256:**
   - Mỗi phiên bản văn bản bắt buộc có mã băm SHA-256 (64 ký tự hex) bảo đảm tính toàn vẹn của tệp tài liệu gốc hoặc nội dung quy chế.
   - Các đoạn trích dẫn (Chunks) theo Điều, Khoản, Trang cũng được gắn mã băm tương ứng.

3. **Cổng Phê duyệt Tiêu chuẩn Chặt chẽ (Fail-closed Gatekeeper):**
   - Khi chưa được Hội đồng thẩm định phê duyệt chính thức (`is_confirmed = false`), trạng thái không bao giờ được gắn nhãn `CONFIRMED_LHU_POLICY`.
   - Khi truy vấn tiêu chí phục vụ Đánh giá Khen thưởng hoặc AI (`confirmedOnly = true`), hệ thống **chỉ trả về** các tiêu chí đã có `is_confirmed = true` từ các phiên bản văn bản đã được xác nhận. Mọi tiêu chí mô phỏng (Simulation) chưa duyệt đều bị loại trừ khỏi kết luận.

---

## 2. Cấu trúc Cơ sở Dữ liệu (Supabase PostgreSQL)

| Bảng | Mục đích | Ràng buộc chính |
| :--- | :--- | :--- |
| `app.regulation_documents` | Danh mục văn bản gốc (Luật, Thông tư, Quy chế) | `document_code` UNIQUE, `document_type` CHECK enum |
| `app.regulation_document_versions` | Các phiên bản văn bản kèm SHA-256 và hiệu lực | UNIQUE(`document_id`, `version_number`), FK `supersedes_version_id` |
| `app.regulation_chunks` | Trích đoạn phân mảnh theo Điều/Khoản/Trang | FK `version_id` ON DELETE CASCADE, `chunk_hash` 64 hex |
| `app.award_criteria_versions` | Bộ tiêu chí khen thưởng gắn với phiên bản | UNIQUE(`version_id`, `criterion_code`), cờ `is_confirmed` |

---

## 3. Danh sách Endpoints REST API (`/api/v1`)

### 3.1. Văn bản Quy định (`/regulations`)
- `GET /api/v1/regulations`: Lấy danh sách văn bản quy định (hỗ trợ lọc `documentType`, `asOfDate`, `confirmedOnly`).
- `GET /api/v1/regulations/:id`: Xem chi tiết văn bản kèm toàn bộ lịch sử các phiên bản.
- `POST /api/v1/regulations`: Tạo mới văn bản quy chế (Yêu cầu quyền Quản trị / Hội đồng).

### 3.2. Phiên bản Văn bản (`/regulations/versions`)
- `GET /api/v1/regulations/versions/:id`: Xem chi tiết phiên bản kèm chunks và tiêu chí.
- `POST /api/v1/regulations/:documentId/versions`: Ban hành phiên bản mới (tính/kiểm tra SHA-256, chuyển tiếp phiên bản cũ).
- `PATCH /api/v1/regulations/versions/:id/confirm`: Phê duyệt phiên bản áp dụng chính thức tại LHU.

### 3.3. Phân đoạn Trích dẫn (`/regulations/versions/:versionId/chunks`)
- `GET /api/v1/regulations/versions/:versionId/chunks`: Lấy danh sách trích đoạn theo Điều/Khoản/Trang.
- `POST /api/v1/regulations/versions/:versionId/chunks`: Thêm danh sách trích đoạn (tự động tính băm SHA-256 từng chunk).

### 3.4. Bộ Tiêu chí Khen thưởng (`/regulations/criteria`)
- `GET /api/v1/regulations/criteria`: Lấy danh sách tiêu chí (mặc định `confirmedOnly=true` cho AI/Evaluation).
- `POST /api/v1/regulations/versions/:versionId/criteria`: Tạo mới tiêu chí gắn với phiên bản quy định.
- `PATCH /api/v1/regulations/criteria/:id/confirm`: Thẩm định và phê duyệt tiêu chí đưa vào áp dụng.
