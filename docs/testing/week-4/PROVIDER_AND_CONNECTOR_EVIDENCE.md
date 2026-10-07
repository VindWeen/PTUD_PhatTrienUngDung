# Minh Chứng Provider Thật, Connector Mô Phỏng & Tổng Hợp Lỗi Đã Sửa (W4-Q4)

**Phụ trách:** Tạ Trần Vinh Quang (W4-Q4: Review recommender, Hội đồng và kiểm tra kết nối)  
**Dự án:** PTUD_PhatTrienUngDung  
**Ngày cập nhật:** 07/10/2026 (Asia/Saigon)  

---

## 1. Bằng Chứng Phân Biệt Cuộc Gọi Thật vs Dữ Liệu Mô Phỏng

Theo nguyên tắc liêm chính học thuật và bảo mật của dự án, hệ thống thiết lập cơ chế phân biệt rạch ròi giữa cuộc gọi AI vendor thật và dữ liệu mô phỏng/stub:

### 1.1 Cuộc gọi Provider Thật (Real Provider Calls)
- **Cấu hình:** Khóa API server-only (`OPENROUTER_API_KEY`, `GROQ_API_KEY`) được nạp qua biến môi trường bí mật `.env`, **tuyệt đối không bao giờ commit vào Git**.
- **Chỉ số lưu trong `provider_evidence`:**
  - `provider`: `"openrouter"` hoặc `"groq"`
  - `model`: Model thật được ủy quyền (ví dụ: `deepseek/deepseek-chat`, `llama-3.3-70b-versatile`)
  - `isMock`: `false` (bắt buộc)
  - `usage`: Thống kê token thực tế `{ promptTokens: N, completionTokens: M, totalTokens: N+M }`
  - `latencyMs`: Độ trễ mạng thực tế đo bằng mili-giây (> 0 ms)
  - `timestamp`: Thời điểm hoàn tất lệnh gọi chuẩn ISO 8601
  - `cached`: Cờ nhận diện cache truy vấn
- **Chặn gian lận trong Production / Recommender:**
  Trong `recommendationService.js`, nếu `completion.isMock || completion.provider === "mock"`, hệ thống chủ động ném lỗi:
  ```javascript
  if (completion.isMock || completion.provider === "mock")
    throw new ValidationError("Cần provider thật; chưa cấu hình key server-only");
  ```
  Điều này ngăn chặn việc ngụy tạo kết quả AI mock thành kết quả chính thức khi triển khai thực tế.

### 1.2 Dữ liệu Mô Phỏng & External Connector (Simulated Data)
- **Gắn nhãn bắt buộc:** Mọi dữ liệu xuất phát từ nguồn mô phỏng, fixture demo, hoặc connector ngoại vi chưa được đối soát đều phải gắn tiền tố hoặc nhãn rõ ràng: `[MÔ PHỎNG]`, `SIMULATION_ONLY`, hoặc `is_simulated = true`.
- **Connector Ngoại vi (`externalService.js`):**
  - Đồng bộ KPI ngoài qua các bảng `app.external_kpi_runs`, `app.external_kpi_records`.
  - Mọi bản ghi nháp thành tích chuyển đổi từ dữ liệu ngoài (`POST /api/v1/kpi/external/records/:id/draft`) phải trải qua quy trình xác minh minh chứng độc lập của Lãnh đạo Đơn vị (`POST /api/v1/achievements/:id/verify`), không mặc nhiên biến thành tích mô phỏng thành thành tích chính thức.
- **Dự phòng Quota & Vendor Failure (Graceful Degradation):**
  - Khi provider hết quota hoặc gặp sự cố mạng, hệ thống chuyển sang chế độ fallback an toàn: hiển thị cảnh báo cho người dùng, lưu trữ trạng thái chờ xử lý, và **giữ nguyên kết quả thẩm định tiêu chí** đã tính toán trước đó, không làm sập tiến trình.

---

## 2. Bảng Đối Chiếu Minh Chứng

| Tiêu chí | Provider Thật (OpenRouter / Groq) | Connector / Adapter Mô Phỏng |
|---|---|---|
| **Cờ `isMock`** | `false` | `true` |
| **Header / Nguồn** | Server-only API key | Internal Mock Adapter / Fixture |
| **Token Usage** | Đo đếm thực tế từ API Gateway | Giá trị 0 hoặc ước tính cố định |
| **Nhãn hiển thị** | Tên Model chính thức (`deepseek-chat`, `llama-3.3`) | Nhãn `[MÔ PHỎNG]` hoặc `STUB` |
| **Lưu vết Database** | Lưu trường `provider_evidence` trong `app.kpi_recommendations` | Ghi nhận cờ `is_simulated = true` |
| **Tính hợp lệ** | Được dùng để người dùng duyệt thành KPI Goal | Chỉ dùng cho kiểm thử và đối chiếu |

---

## 3. Tổng Hợp Lỗi & Bất Cập Phát Hiện Trong Review và Giải Pháp Đã Sửa

| STT | Vấn đề / Lỗi phát hiện | Module liên quan | Hậu quả / Rủi ro | Giải pháp đã triển khai trong W4-Q4 |
|---|---|---|---|---|
| **1** | **Multi-criteria Snapshot Gap (Điểm P1 trong PR_REVIEW.md)** | `criteriaEvaluator.js`, `aiService.js` | Hàm `buildInputSnapshot` chỉ nhận 1 tiêu chí đại diện (`primaryCrit`), khi chạy đa tiêu chí thì các tiêu chí thứ 2 trở đi bị thiếu hash và metadata trong snapshot. | Nâng cấp `buildInputSnapshot` lên **Schema v2**: lưu đầy đủ mảng `criteria` và `documentVersions`, tính toán `inputHash` bất biến trên toàn bộ dữ liệu, cập nhật `checkEvaluationStale` tương thích 100%. |
| **2** | **Bất cập định danh route RAG Retrieve** | `aiRoutes.js`, test suites | Test tích hợp gọi nhầm `/ai/rag/chunks` thay vì route chuẩn `/ai/rag/retrieve`. | Chuẩn hóa toàn bộ request kiểm thử sang `/api/v1/ai/rag/retrieve`, xác nhận schema response trả về mảng `chunks`. |
| **3** | **Check Constraint trên Document Type** | Database `regulation_documents` | Khi tạo tài liệu kiểm thử dùng type `'REGULATION'` bị lỗi vi phạm ràng buộc `regulation_documents_document_type_check`. | Chuẩn hóa document_type về `'UNIVERSITY_REGULATION'` (thuộc enum hợp lệ của hệ thống). |
| **4** | **Foreign Key Constraint khi dọn dẹp kiểm thử** | Database Supabase | Xóa `award_criteria_versions` trước khi xóa `evaluation_criterion_results` gây vi phạm khóa ngoại `evaluation_criterion_results_criterion_id_fkey`. | Điều chỉnh thứ tự dọn dẹp (cascade cleanup): xóa `kpi_recommendations` → `evaluation_criterion_results` → `award_criteria_versions`. |
| **5** | **Xung đột Trạng thái Hội đồng khi chưa Phân công** | `applicationService.js` | Thành viên Hội đồng cố gọi `comment` hoặc `recommend` khi chưa được phân công qua bước `assign` bị chặn 403 ("Chưa được phân công hồ sơ"). | Bổ sung đầy đủ chuỗi quy trình: Phân công (`assign`) → Thẩm định viên nhận xét (`comment`) → Bỏ phiếu khuyến nghị (`recommend`). |
| **6** | **Chống Tự Phê Duyệt (Anti-Self-Approval)** | `applicationService.js` | Cán bộ Hội đồng có thể có xung đột lợi ích nếu tự chấm hồ sơ do mình nộp. | Kiểm chứng cơ chế `noSelf()`: chặn đứng 403 `FORBIDDEN` mọi hành vi tự xét hồ sơ cá nhân hoặc tập thể mình làm đại diện. |
| **7** | **Không Tự Phong Thưởng** | `recommendationService.js`, `aiService.js` | AI tự động sinh quyết định khen thưởng mà không qua cấp thẩm quyền. | Khẳng định `automaticAwardGranted: false` ở toàn bộ API, quyết định khen thưởng phải qua thẩm quyền xét duyệt độc lập. |
