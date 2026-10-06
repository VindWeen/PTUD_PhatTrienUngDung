# BIÊN BẢN REVIEW PR KỸ THUẬT TUẦN 3 (W3-P1 & W3-P2)

**Người review:** Tạ Trần Vinh Quang (W3-Q4)  
**Tác giả được review:** Võ Nhạc Phước (W3-P1, W3-P2)  
**Thời điểm thực hiện:** 06/10/2026  
**Dự án:** PTUD_PhatTrienUngDung  
**Trạng thái Review:** **APPROVED (CHẤP THUẬN VỚI ĐÁNH GIÁ CAO)**

---

## 1. Phạm vi Review

1. **W3-P1: Dashboard Báo cáo & Xuất CSV an toàn**
   - Tệp mã nguồn: `backend/src/modules/reports/reportService.js`, `reportRoutes.js`, `frontend/src/pages/Reports.jsx`.
   - Tiêu chí: Cơ chế chống CSV Formula Injection, kiểm soát phạm vi truy cập (Scope Enforcement) và phân tách trạng thái hợp lệ.
2. **W3-P2: Quản lý Mục tiêu & Kết quả KPI nội bộ**
   - Tệp mã nguồn: `supabase/migrations/20261006000017_w3_p2_kpi.sql`, `backend/src/modules/kpi/kpiService.js`, `frontend/src/pages/Kpi.jsx`.
   - Tiêu chí: Quyền sở hữu chính chủ, tính độc lập của KPI nội bộ đối với luồng xét thưởng, nhập CSV an toàn và transaction isolation.

---

## 2. Kết quả Đánh giá Chi tiết

### 2.1. Cơ chế Chống CSV Formula Injection (W3-P1)
- **Đánh giá:** **ĐẠT XUẤT SẮC**
- **Chi tiết kỹ thuật:**
  - Hàm `csvCell(value)` sử dụng biểu thức chính quy:
    ```javascript
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
    ```
  - Xử lý triệt để các ký tự nhạy cảm kích hoạt macro trong Microsoft Excel / LibreOffice Calc (`=`, `+`, `-`, `@`) ngay cả khi có khoảng trắng hoặc ký tự điều khiển ASCII đứng trước.
  - Chuẩn hóa đầu ra bằng tiền tố UTF-8 BOM (`\uFEFF`) và ngắt dòng chuẩn CRLF (`\r\n`) tương thích tối đa với môi trường hệ điều hành Windows.

### 2.2. Kiểm soát Phạm vi Dữ liệu (Scope Enforcement)
- **Đánh giá:** **ĐẠT XUẤT SẮC**
- **Chi tiết kỹ thuật:**
  - Việc kiểm tra vai trò và đơn vị quản lý được tích hợp trực tiếp trong câu lệnh SQL thông qua Common Table Expression (CTE) đệ quy `scope_units` kết nối với bảng `app.user_unit_scopes`.
  - Cơ chế này tạo ra một single-statement snapshot, ngăn chặn hoàn toàn tấn công sửa tham số URL (Insecure Direct Object References - IDOR) và loại bỏ race conditions.
  - Giảng viên (`LECTURER`) bị từ chối quyền xuất CSV quản trị ở tầng backend với mã HTTP 403.

### 2.3. Tính Liêm chính của Module KPI (W3-P2)
- **Đánh giá:** **ĐẠT YÊU CẦU**
- **Chi tiết kỹ thuật:**
  - Bảng `app.kpi_goals` và `app.kpi_results` được cô lập hoàn toàn khỏi luồng phê duyệt thành tích (`achievements`) và quyết định khen thưởng (`award_records`).
  - Khi hoàn thành mục tiêu KPI, hệ thống **không tự động cấp quyền khen thưởng** hay tự chuyển thành tích sang trạng thái `VERIFIED`.
  - Nguồn dữ liệu mô phỏng được gắn nhãn minh bạch (`SIMULATION_ONLY`).

---

## 3. Kiến nghị và Khuyến nghị Tối ưu hóa (Non-blocking Findings)

1. **Khả năng Mở rộng Tập dữ liệu Lớn:**
   - Trong `reportService.js`, việc sử dụng `jsonb_agg` để nạp toàn bộ danh sách kết quả vào RAM trước khi xuất CSV phù hợp với quy mô hiện tại (< 10.000 dòng).
   - Với quy mô lớn hơn (> 50.000 dòng), khuyến nghị sử dụng cơ chế streaming cursor trực tiếp từ PostgreSQL xuống HTTP response stream để tối ưu RAM.
2. **Hợp đồng AI Evaluation Contract:**
   - Thống nhất sử dụng schema chuẩn `EvaluationRun` và `CriterionResult` theo tài liệu `docs/api/ai-contract/EVALUATION_CONTRACT_W3_Q4.md` khi triển khai tích hợp AI vào đánh giá KPI.
