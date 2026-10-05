# W2-Q2 — Upload, Tải và Quản lý Phiên bản Tệp tin Minh chứng Số

Người phụ trách: **Tạ Trần Vinh Quang** (W2-Q2)  
Bối cảnh kỹ thuật: React 18, Vite, TailwindCSS, Express REST (`/api/v1`), Supabase PostgreSQL, PG Pool, Multer Memory Storage, Private Local Storage Adapter, Magic Bytes Sniffing, SHA-256 Hashing, Path Traversal Defense, Audit Logging.

---

## 1. Phạm vi thực hiện & Điểm cuối API

- **Thêm danh mục minh chứng kèm tệp ban đầu (v1)**: `POST /api/v1/achievements/:id/evidences`
  - Nhận form-data: `title` (bắt buộc), `description` (tùy chọn), `file` (bắt buộc).
  - Chỉ cho phép khi hồ sơ đang ở trạng thái `DRAFT` hoặc `NEED_CORRECTION`.
  - Tự động lưu tệp vật lý vào kho Private và tạo bản ghi phiên bản đầu tiên (`version_no = 1`).
  - Tự động dọn dẹp file vật lý vừa lưu nếu giao dịch CSDL (Transaction) bị lỗi.
- **Lấy danh sách minh chứng của một hồ sơ**: `GET /api/v1/achievements/:id/evidences`
  - Trả về danh sách các minh chứng đính kèm thông tin phiên bản mới nhất (`latestVersionNo`, `latestFileName`, `latestFileSize`, `latestMimeType`, `totalVersions`, `latestDownloadUrl`).
- **Tải lên phiên bản mới cho minh chứng (Thay file)**: `POST /api/v1/evidences/:id/versions`
  - Nhận form-data: `file` (bắt buộc).
  - Tự động truy vấn phiên bản cao nhất hiện tại và tạo bản ghi bất biến mới với `version_no = max_version + 1`.
  - Giữ nguyên các phiên bản cũ trong CSDL và kho lưu trữ (Append-only).
- **Xóa mềm danh mục minh chứng**: `DELETE /api/v1/evidences/:id`
  - Đánh dấu `is_removed = TRUE`. Không xóa cứng dữ liệu lịch sử.
- **Tải về tệp tin minh chứng (Private Stream)**: `GET /api/v1/evidence-files/:id/download`
  - **Kiểm soát phân quyền nghiêm ngặt**:
    - Chủ sở hữu hồ sơ cá nhân (`LECTURER`) tải được tệp.
    - Đại diện đơn vị (`UNIT_REPRESENTATIVE`) còn hiệu lực của thành tích tập thể tải được tệp.
    - Quản lý (`MANAGER`) chỉ được tải khi `context_unit_id` của hồ sơ nằm trong phạm vi quản lý (CTE cây đơn vị con).
    - Cán bộ hồ sơ (`RECORDS_OFFICER`) và Quản trị viên (`ADMIN`) có quyền tải toàn hệ thống.
    - Người ngoài cố tình truy cập bằng ID tệp bị từ chối `403 Forbidden` (`OutOfScopeError`).
  - Trả về binary stream với các headers an toàn: `Content-Type`, `Content-Disposition`, `Content-Length`, `ETag` (SHA-256), `Cache-Control: private`.

---

## 2. Tiêu chuẩn Bảo mật & Ràng buộc Kỹ thuật

1. **Kiểm tra 3 lớp (Đuôi mở rộng, MIME, Magic Bytes)**:
   - Các định dạng được phép: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.docx`.
   - Dung lượng: `0 < file_size <= 10 * 1024 * 1024` bytes (Tối đa 10 MB).
   - Kiểm tra chữ ký ma thuật nhị phân (Magic Bytes):
     - PDF: bắt đầu bằng `%PDF-` (`0x25, 0x50, 0x44, 0x46, 0x2D`).
     - PNG: 8 bytes `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`.
     - JPEG: 3 bytes `0xFF, 0xD8, 0xFF`.
     - DOCX: PK ZIP container `0x50, 0x4B`.
   - Ngăn chặn tệp tin giả mạo (ví dụ: đổi đuôi `.sh` hay `.exe` thành `.pdf`) với mã lỗi `400 Bad Request`.
2. **Kho lưu trữ Private & Chống Path Traversal**:
   - Tệp tin không nằm trong thư mục web công khai. Mọi thao tác tải tệp đều phải qua middleware xác thực JWT và kiểm tra quyền RBAC Scope.
   - Cơ chế sinh `storageKey` ngẫu nhiên kèm mã băm SHA-256 chống trùng lặp:
     `evidences/<YYYY>/ach_<achId>_ev_<evId>_v<ver>_<randomHex>.<ext>`
   - `LocalStorageAdapter` chuẩn hóa đường dẫn tuyệt đối và chặn mọi ký tự `..` hoặc null-bytes.
3. **Cơ chế Rollback & Dọn file khi DB thất bại**:
   - Nếu xảy ra lỗi ghi DB trong quá trình tạo hoặc thay file, hệ thống tự động xóa tệp tin vật lý vừa lưu trên đĩa để tránh tồn đọng file mồ côi (orphaned files).

---

## 3. Kiểm thử tự động & Nghiệm thu

```powershell
# Kiểm thử Unit Test (Magic Bytes, Dung lượng, Storage Adapter, Path Traversal, Cleanup)
npm --prefix backend run test:w2-q2

# Kiểm thử Tích hợp HTTP trên Live Supabase DB (Upload, Versioning, Download Stream, 403 Forbidden, Xóa mềm)
npm --prefix backend run test:w2-q2:integration

# Kiểm thử Frontend Lint & Build
npm --prefix frontend run lint
npm --prefix frontend run build
```

### Kết quả nghiệm thu thực tế:
- `test:w2-q2` (Unit Tests): **4/4 PASS**
- `test:w2-q2:integration` (Live HTTP Integration): **10/10 PASS**
- `frontend lint & build`: **100% thành công không cảnh báo/lỗi**
- Kiểm thử hồi quy toàn bộ hệ thống (`test:w2-q1`, `test:audit`, `test:w1-p3`, `test:w2-p1`, `runner.js`): **Tất cả đều PASS**.
