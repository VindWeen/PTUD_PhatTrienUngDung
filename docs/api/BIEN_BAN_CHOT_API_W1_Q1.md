# BIÊN BẢN CHỐT HỢP ĐỒNG API VÀ BÀN GIAO KỸ THUẬT
## Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
**Nhiệm vụ:** `[W1-Q1]` — Chốt nghiệp vụ, Schema và API lõi  
**Thời gian lập:** 25/09/2026 — **Thời điểm bàn giao chính thức:** 26/09/2026  

---

## 1. THÀNH PHẦN THAM GIA

1. **Bên bàn giao (Backend / Cơ sở dữ liệu):**
   - Họ và tên: **Tạ Trần Vinh Quang**
   - Vai trò: Phụ trách thiết kế Cơ sở dữ liệu MSSQL, Kiến trúc Backend Express REST API `/api/v1`, Ma trận phân quyền và Hợp đồng dữ liệu.
2. **Bên tiếp nhận (Frontend / Giao diện người dùng):**
   - Họ và tên: **Bạn Phước**
   - Vai trò: Phụ trách phát triển giao diện React / Vite / Tailwind CSS, Tích hợp API Client, Quản lý trạng thái và luồng trải nghiệm người dùng (UX).

---

## 2. BỐI CẢNH VÀ NGUYÊN TẮC HỢP TÁC

1. **Thực trạng dự án:** Bản khởi đầu hiện tại chỉ có giao diện tĩnh với dữ liệu mẫu (`frontend/src/data/demo.js`), chưa kết nối backend hay cơ sở dữ liệu thật.
2. **Mục tiêu bàn giao W1-Q1:**
   - Cung cấp toàn bộ đặc tả chuẩn hóa OpenAPI 3.0 (`docs/api/openapi.yaml` & `docs/api/openapi.json`).
   - Cung cấp trọn bộ dữ liệu mẫu thực tế (**Fixtures**) tại `docs/api/fixtures/` để **Phước có thể đối chiếu payload và phát triển giao diện ngay lập tức mà không cần chờ backend chạy thật**.
   - Chốt các ràng buộc kiến trúc quan trọng: **Chủ thể XOR, ContextUnitId, RowVersion kiểm soát đồng thời, và Quy tắc Cấm tự duyệt**.
3. **Nguyên tắc nghiệm thu:**
   - Trong giai đoạn tuần 1–3, frontend được phép chạy kiểm thử với Mock Fixtures hoặc Mock Service Worker (MSW).
   - Nghiệm thu cuối cùng bắt buộc phải tích hợp thực tế với backend Express và SQL Server thật. Nếu thiếu phụ thuộc nào từ phía máy chủ, hai bên sẽ ghi nhận đúng phần bị chặn để cùng xử lý.

---

## 3. CÁC NỘI DUNG KỸ THUẬT ĐÃ CHỐT

### 3.1. Cấu trúc chuẩn của Request / Response

#### Phản hồi thành công (Success Response):
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { ... }
}
```

#### Phản hồi lỗi chuẩn hóa (Standard Error Response):
Áp dụng thống nhất cho tất cả mã lỗi HTTP 4xx và 5xx:
```json
{
  "success": false,
  "error": {
    "code": "TÊN_MÃ_LỖI_NGHIỆP_VỤ",
    "message": "Thông điệp mô tả lỗi thân thiện với người dùng",
    "fieldErrors": {
      "tên_trường": "Chi tiết lỗi của trường dữ liệu"
    },
    "details": [
      { "quy_tắc": "...", "lý_do": "..." }
    ],
    "timestamp": "2026-09-25T14:30:00.000Z",
    "correlationId": "req-xxxxxx"
  }
}
```

### 3.2. Bảng mã lỗi tiêu chuẩn giữa FE và BE

| Mã HTTP | Mã nghiệp vụ (`error.code`) | Ý nghĩa và Cách xử lý phía Frontend |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Dữ liệu form không hợp lệ. FE duyệt `error.fieldErrors` để bôi đỏ viền input và hiển thị câu thông báo dưới từng trường. |
| `401` | `UNAUTHORIZED` | Token hết hạn hoặc không hợp lệ. FE tự động gọi `POST /auth/refresh`, nếu thất bại thì điều hướng về `/login`. |
| `403` | `SELF_APPROVAL_PROHIBITED` | **CẤM TỰ DUYỆT:** Manager bấm duyệt hồ sơ của chính mình. FE hiển thị toast cảnh báo liêm chính học thuật và ẩn nút duyệt. |
| `403` | `OUT_OF_SCOPE` | Truy cập ngoài phạm vi phân công. FE hiển thị thông báo không có thẩm quyền. |
| `404` | `NOT_FOUND` | Tài nguyên không tồn tại hoặc đã bị xóa. Điều hướng hoặc hiển thị Empty State. |
| `409` | `CONCURRENCY_CONFLICT` | **Xung đột phiên bản RowVersion:** Có người khác đã cập nhật trước. FE hiển thị modal yêu cầu người dùng tải lại dữ liệu mới nhất. |
| `409` | `INVALID_STATE_TRANSITION` | Thao tác sai trạng thái (ví dụ cố bấm nộp hồ sơ đã bị thu hồi). FE làm mới lại trạng thái giao diện. |
| `413` | `PAYLOAD_TOO_LARGE` | Tập tin vượt quá 10MB. FE chặn kiểm tra dung lượng ngay tại trình duyệt trước khi upload. |

---

### 3.3. Bốn ràng buộc nghiệp vụ cốt lõi Frontend cần lưu ý

1. **Ràng buộc Chủ thể XOR (Subject XOR):**
   - Khi tạo thành tích (`POST /achievements`):
     - Nếu nộp cá nhân: Gửi `subjectType: "LECTURER"`, không gửi `organizationUnitId` (hoặc để `null`).
     - Nếu đại diện nộp cho tập thể: Gửi `subjectType: "UNIT"` và `organizationUnitId: <mã đơn vị>`.
     - Tuyệt đối không gửi đồng thời cả hai hoặc để trống cả hai.
2. **Tính bất biến của Bối cảnh đơn vị (`ContextUnitId`):**
   - Khi hiển thị danh sách hay chi tiết hồ sơ, luôn dựa vào `contextUnitId` và `contextUnitName` để biết thành tích đó thuộc về đơn vị nào trong lịch sử, không lấy theo đơn vị hiện tại nếu giảng viên đã chuyển công tác.
3. **Kiểm soát cập nhật đồng thời với `RowVersion`:**
   - Mỗi khi gọi `GET` chi tiết (thành tích, khen thưởng, hồ sơ), server luôn trả về trường `rowVersion` (chuỗi base64, ví dụ `"AAAAAAAADFE="`).
   - Mọi form chỉnh sửa (`PATCH`) và các nút bấm chuyển trạng thái (`submit`, `cancel`, `verify`, `request-correction`, `reject`, `revoke`) **bắt buộc phải gửi kèm trường `rowVersion` này**.
4. **Quy tắc Cấm tự duyệt (Anti-Self-Approval):**
   - Trên giao diện hàng chờ duyệt (`/approvals`):
     - Server sẽ tự động lọc các hồ sơ mà Manager không được phép duyệt.
     - Phía Frontend, nếu phát hiện `achievement.lecturerId == currentUser.lecturerId` hoặc `achievement.createdBy == currentUser.userId`, FE chủ động disable các nút Duyệt/Từ chối để tối ưu trải nghiệm người dùng.

---

## 4. HƯỚNG DẪN DÀNH CHO PHƯỚC ĐỂ TÍCH HỢP NGAY LẬP TỨC

Để Phước không bị chậm tiến độ giao diện trong khi Quang đang dựng cơ sở dữ liệu và code backend:

### Bước 1: Khai thác thư mục Fixtures
Trong thư mục `docs/api/fixtures/` đã có đầy đủ 5 file dữ liệu mẫu tương thích 100% với hợp đồng API:
- `auth.fixtures.json`: Mẫu token, thông tin giảng viên Nguyễn Văn An, Manager Trần Thị Bích.
- `profile.fixtures.json`: Mẫu hồ sơ năng lực cá nhân và hồ sơ đơn vị Bộ môn KTPM.
- `achievements.fixtures.json`: Đầy đủ hồ sơ `VERIFIED`, `SUBMITTED`, `NEED_CORRECTION`, `REJECTED`, `REVOKED` và thành tích tập thể.
- `evidences.fixtures.json`: Mẫu danh mục minh chứng, tệp tin đính kèm và thông số file.
- `awards.fixtures.json`: Mẫu quyết định khen thưởng và kết quả khen thưởng `RECORDED`.
- `errors.fixtures.json`: Mẫu tất cả các kịch bản lỗi (400, 401, 403 cấm tự duyệt, 409 xung đột rowVersion).

### Bước 2: Tạo API Client trong `frontend/src/services/`
Phước có thể cấu hình file `frontend/src/services/apiClient.js` như sau:
```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Gửi kèm HttpOnly cookie cho Refresh Token
});

// Interceptor tự động gắn Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ptud_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

---

## 5. CAM KẾT VÀ QUẢN LÝ THAY ĐỔI (CHANGE MANAGEMENT)

1. **Cam kết tính tương thích:**
   - Bên Backend cam kết giữ nguyên các tên trường, cấu trúc JSON và mã lỗi như đã định nghĩa trong OpenAPI specification.
   - Tuyệt đối không âm thầm thay đổi kiểu dữ liệu hoặc đổi tên trường mà không có sự đồng thuận của bên Frontend.
2. **Quy trình khi cần bổ sung trường mới:**
   - Nếu Frontend cần bổ sung thêm trường hiển thị mới, hai bên sẽ thảo luận và cập nhật đồng bộ vào `docs/api/openapi.json` và bộ fixtures trước khi tiến hành code.
3. **Lịch trình tiếp theo (Tuần 2):**
   - Quang hoàn thành dựng database bằng `database/migrations/` và kết nối Express REST API với SQL Server.
   - Phước hoàn thiện các biểu mẫu nhập liệu và kết nối gọi API thật.
   - Hai bên cùng thực hiện kiểm thử tích hợp (End-to-End Test) cho luồng: *Giảng viên tạo thành tích -> Tải file -> Gửi -> Quản lý duyệt -> Cập nhật Dashboard*.

---

**Đại diện Bên Backend / Database**  
*(Đã ký)*  
**Tạ Trần Vinh Quang**  

**Đại diện Bên Frontend**  
*(Đã tiếp nhận bàn giao)*  
**Bạn Phước**
