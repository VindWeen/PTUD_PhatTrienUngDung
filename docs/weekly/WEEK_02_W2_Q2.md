# Bàn giao W2-Q2 — Upload, Tải và Quản lý Phiên bản Tệp tin Minh chứng Số

Phụ trách: **Tạ Trần Vinh Quang**.  
Bối cảnh: React 18 / Vite / TailwindCSS, Express REST `/api/v1`, Supabase PostgreSQL qua `pg` pool, Private Storage, JWT auth và phân quyền phạm vi quản lý CTE. Tái sử dụng các module đã hoàn thành (W1-Q4 Audit Log, W1-P3 Tổ chức & Phạm vi, W2-Q1 CRUD Thành tích).

---

## 1. Các file thay đổi & tạo mới

### Backend & Database:
- `supabase/migrations/20261005000013_w2_q2_evidence_files.sql`: Khởi tạo bảng danh mục minh chứng `app.evidences` (có `is_removed`, trigger `update_updated_at_column`) và tái cấu trúc bảng phiên bản tệp tin bất biến `app.evidence_files` (chứa `version_no`, `original_file_name`, `storage_key`, `file_size`, `sha256_hash`, ràng buộc duy nhất `uq_evidence_files_version`, quan hệ khóa ngoại `ON DELETE RESTRICT`). Đã áp dụng thành công trên Supabase DB.
- `backend/src/modules/evidences/storage/localStorageAdapter.js`: Bộ chuyển đổi lưu trữ tệp tin trong kho Private (`backend/storage/private/evidences`). Phòng chống tấn công Path Traversal, kiểm tra giới hạn thư mục gốc an toàn, stream tệp và dọn dẹp file vật lý.
- `backend/src/modules/evidences/evidenceValidators.js`: Kiểm tra 3 lớp cho tệp tin đính kèm: Đuôi mở rộng (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.docx`), MIME Type, dung lượng tối đa 10 MB, và kiểm tra Chữ ký ma thuật nhị phân (Magic Bytes: `%PDF-`, PNG header, JPEG header, PK ZIP container). Tính toán mã băm SHA-256.
- `backend/src/modules/evidences/evidenceRepository.js`: Tầng truy cập CSDL hỗ trợ giao dịch, phân trang danh mục, tra cứu phiên bản mới nhất (`latestVersionNo`), tự động ánh xạ kiểu dữ liệu `Number` an toàn cho các trường định danh và dung lượng `file_size`.
- `backend/src/modules/evidences/evidenceService.js`: Nghiệp vụ cốt lõi:
  - Kiểm tra trạng thái hồ sơ thành tích (`DRAFT`, `NEED_CORRECTION`).
  - Kiểm tra chủ sở hữu (giảng viên chủ hồ sơ / đại diện đơn vị còn hiệu lực).
  - Tự động sinh `storageKey` ngẫu nhiên và lưu file vật lý.
  - Tự động dọn dẹp file vật lý (Cleanup on failure) khi giao dịch CSDL gặp sự cố.
  - Quản lý phiên bản tệp tin: Tải file mới tự động tăng `version_no = max_version + 1`.
  - Phân quyền tải file: Chặn người ngoài tải file (`403 Forbidden`); cho phép chủ sở hữu, đại diện đơn vị, Manager theo CTE Scope và Admin/Records Officer.
  - Ghi nhật ký kiểm toán `recordAuditLog` cho các hành vi `CREATE_EVIDENCE`, `UPLOAD_EVIDENCE_VERSION`, `DELETE_EVIDENCE`.
- `backend/src/modules/evidences/evidenceController.js` & `evidenceRoutes.js`: Xử lý HTTP request/response RESTful, tích hợp Multer Memory Storage để kiểm tra tệp an toàn trước khi lưu đĩa.
- `backend/src/app.js`: Mount router `/api/v1` cho phân hệ evidence.
- `backend/package.json`: Cài đặt `multer` và thêm các npm script `test:w2-q2`, `test:w2-q2:integration`.

### Frontend:
- `frontend/src/services/evidencesApi.js`: API service kết nối Express REST endpoints và fixture client.
- `frontend/src/services/fixtureClient.js`: Bổ sung các fixture methods cho evidence.
- `frontend/src/pages/Achievements.jsx`: Tích hợp phân hệ minh chứng số vào modal chi tiết thành tích:
  - Hiển thị danh sách minh chứng kèm thông tin tệp mới nhất, dung lượng, phiên bản `vN`.
  - Nút **Tải về**: Stream tệp tin an toàn từ backend.
  - Nút **Thay file**: Tải lên phiên bản mới với version tăng dần.
  - Form **Thêm minh chứng**: Upload tệp ban đầu kèm tiêu đề và mô tả.
  - Nút **Xóa minh chứng**: Xóa mềm an toàn.

### Tests & Documentation:
- `backend/tests/w2-q2.test.js`: 4 bài kiểm thử đơn vị (Magic Bytes sniffing, dung lượng, định dạng, Path Traversal, dọn dẹp file vật lý khi DB thất bại).
- `backend/tests/w2-q2.integration.js`: 10 bài kiểm thử tích hợp HTTP thực tế với Supabase PostgreSQL cloud (CRUD minh chứng, phiên bản v1 -> v2, chặn file giả mạo 400, chặn tải file trái quyền 403, tải file stream thành công 200).
- `docs/api/EVIDENCE_FILES_W2_Q2.md`: Tài liệu kỹ thuật chi tiết các điểm cuối API và cơ chế bảo mật.
- `docs/weekly/WEEK_02_W2_Q2.md`: Báo cáo bàn giao tuần 2 nhiệm vụ W2-Q2.

---

## 2. Kết quả kiểm tra thực tế

- `node scripts/validate_contracts.mjs`: **68/68 PASS**
- `npm --prefix frontend run lint`: **0 errors, 0 warnings** (exit code 0)
- `npm --prefix frontend run build`: **Vite build thành công** (exit code 0)
- `npm --prefix backend run test:w2-q2`: **4/4 PASS**
- `npm --prefix backend run test:w2-q2:integration`: **10/10 PASS** (chạy trên live Supabase DB)
- `npm --prefix backend run test:w2-q1`: **6/6 PASS**
- `npm --prefix backend run test:w2-q1:integration`: **12/12 PASS**
- `npm --prefix backend run test:audit`: **5/5 PASS**
- `npm --prefix backend run test:w1-p3`: **4/4 PASS**
- `npm --prefix backend run test:w2-p1`: **5/5 PASS**
- `npm --prefix backend test` (Runner W1-Q3): **31/31 PASS**
- `git diff --check`: **exit 0**, sạch sẽ hoàn toàn.

---

## 3. Tiêu chí nghiệm thu đã hoàn thành

1. **Không tải file bằng ID trái quyền**: Người dùng ngoài phạm vi quản lý hoặc không phải chủ hồ sơ/đại diện khi gọi `GET /api/v1/evidence-files/:id/download` bị chặn `403 Forbidden`.
2. **Thay file tạo version mới**: Không ghi đè bản ghi cũ; mỗi lần thay file hệ thống tự động lưu file mới và tạo bản ghi với `version_no = version_no + 1`.
3. **File độc lập với public**: Tệp tin lưu trữ trong thư mục Private và chỉ được tải qua API có xác thực kèm kiểm tra phân quyền RBAC Scope.
4. **Kiểm tra loại file sai, quá cỡ, path traversal**: Chặn file giả mạo chữ ký (Magic Bytes), chặn file quá 10 MB, chặn các chuỗi `..` và null-bytes.
5. **Dọn dẹp file khi DB thất bại**: Đã kiểm thử và xác nhận cơ chế tự động xóa file vật lý trên đĩa nếu giao dịch CSDL gặp lỗi.
6. **UI upload/download**: Giao diện trực quan, đồng bộ trên trang Quản lý thành tích.
