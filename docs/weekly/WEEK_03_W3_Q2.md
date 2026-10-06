# NHẬT KÝ BÀN GIAO CÔNG VIỆC TUẦN 3 — PHẦN VIỆC W3-Q2

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W3-Q2: Kho văn bản, phiên bản và tiêu chí được duyệt  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 06/10/2026  
**Nhánh thực hiện:** `w3q2` (tách từ `w3q1`)  

---

## 1. Mục tiêu và Phạm vi Đã Hoàn Thành

1. **Khởi tạo và Quản lý Kho Văn bản & Phiên bản:**
   - Xây dựng migration `20261006000018_w3_q2_regulations_and_criteria.sql` tạo 4 bảng CSDL: `app.regulation_documents`, `app.regulation_document_versions`, `app.regulation_chunks`, `app.award_criteria_versions`.
   - Thu hồi toàn bộ quyền trực tiếp của `anon` và `authenticated` để bảo đảm an toàn qua Data API.
   - Triển khai toàn bộ module backend `backend/src/modules/regulations/`: Schema, Repository, Service, Controller, Routes.

2. **Bảo toàn Tính Bất biến & Quan hệ Thay thế:**
   - Phiên bản quy chế là bất biến; khi ban hành phiên bản mới, hệ thống liên kết qua `supersedes_version_id`.
   - Tự động chuyển tiếp ngày hiệu lực (`effective_to = new_version.effective_from`) của phiên bản tiền nhiệm mà không sửa đổi nội dung cũ.
   - Bắt buộc kiểm tra mã băm SHA-256 (64 hex) cho toàn bộ phiên bản và từng đoạn trích dẫn (chunks).

3. **Cổng Phê duyệt Tiêu chuẩn Fail-Closed:**
   - Nếu chưa được thẩm định phê duyệt (`is_confirmed = false`), hệ thống chặn tuyệt đối việc gắn nhãn chính sách LHU (`CONFIRMED_LHU_POLICY`).
   - Mặc định truy vấn tiêu chí xét thưởng (`confirmedOnly = true`) chỉ trả về các tiêu chuẩn đã được Hội đồng LHU phê duyệt chính thức. Tài liệu và tiêu chí mô phỏng chưa duyệt không bao giờ đi vào kết luận.

4. **Nạp Dữ liệu Pháp lý Thực tế & Mô phỏng (Data Ingestion):**
   - Viết và chạy script `backend/src/scripts/seedRegulations.js` nạp:
     - `VN-LAW-002`: Luật số 06/2026/QH16 kèm các đoạn trích Điều 3, Điều 4.
     - `VN-EDU-001`: Thông tư 07/2026/TT-BGDĐT kèm các đoạn trích Điều 2, Điều 3, Điều 30, Điều 31, Điều 32.
     - `W1-P4-SIMULATION`: Tài liệu mô phỏng demo W1-P4 và 4 tiêu chí `SIM-KPI-01`..`SIM-KPI-04` gắn nhãn cảnh báo `SIMULATION_ONLY`.

5. **Giao diện Người dùng (Frontend UI):**
   - Xây dựng trang `frontend/src/pages/Regulations.jsx` với 3 tabs trực quan: Danh mục Văn bản & Phiên bản (kèm nút sao chép mã băm SHA-256), Trích đoạn Tra cứu (Chunks Viewer), và Bộ Tiêu chí Khen thưởng (hỗ trợ Hội đồng phê duyệt trực tiếp).
   - Đăng ký API service `frontend/src/services/regulationsApi.js`, thêm route trong `AppRoutes.jsx` và mục menu "Kho quy định" trong `Sidebar.jsx`.

---

## 2. Kết quả Kiểm thử Thực tế

| Bộ kiểm thử | File | Số lượng test | Kết quả |
| :--- | :--- | :--- | :--- |
| **Unit & Business Rules** | `backend/tests/w3-q2.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Database Integration** | `backend/tests/w3-q2.integration.js` | 5 tests | **5/5 PASS (100%)** trên live Supabase |
| **Hồi quy W3-Q1** | `backend/tests/w3-q1.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Frontend Lint** | `npm run lint` | Toàn bộ source code | **Exit code 0 (Clean)** |
| **Contract Validation** | `scripts/validate_contracts.mjs` | 68 kiểm tra tĩnh | **68/68 PASS (100%)** |

---

## 3. Danh sách Tệp Thay Đổi và Tạo Mới

- `supabase/migrations/20261006000018_w3_q2_regulations_and_criteria.sql`
- `backend/src/modules/regulations/regulationSchemas.js`
- `backend/src/modules/regulations/regulationRepository.js`
- `backend/src/modules/regulations/regulationService.js`
- `backend/src/modules/regulations/regulationController.js`
- `backend/src/modules/regulations/regulationRoutes.js`
- `backend/src/scripts/seedRegulations.js`
- `backend/src/app.js`
- `backend/tests/w3-q2.test.js`
- `backend/tests/w3-q2.integration.js`
- `frontend/src/services/regulationsApi.js`
- `frontend/src/pages/Regulations.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/components/common/Sidebar.jsx`
- `docs/api/REGULATIONS_W3_Q2.md`
- `docs/weekly/WEEK_03_W3_Q2.md`
