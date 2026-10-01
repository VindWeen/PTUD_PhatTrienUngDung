# TÀI LIỆU KIẾN TRÚC HỆ THỐNG TUẦN 1 (WEEK 1 ARCHITECTURE)

**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU  
**Tác giả tổng hợp:** Tạ Trần Vinh Quang (Phụ trách W1-Q3 & W1-Q4)  
**Đóng góp chuyên môn:** Võ Nhạc Phước (Phụ trách W1-P1, W1-P2 & W1-P3)  
**Thời điểm phê duyệt:** 2026-10-01  
**Phiên bản:** v1.0.0 (Hoàn tất giai đoạn Tuần 1)

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ CHỦ ĐẠO

Hệ thống được thiết kế theo kiến trúc hướng dịch vụ nhiều tầng (Multi-tier Enterprise Architecture), phân định rõ ràng ranh giới giữa giao diện người dùng, lớp trung gian API nghiệp vụ và cơ sở dữ liệu quan hệ bảo toàn lịch sử.

```mermaid
graph TD
    Client[Frontend Client\nReact 18 + Vite 6 + Tailwind]\n    -->|REST API /api/v1\nBearer JWT + HttpOnly Cookie| Express[Backend API Service\nExpress.js REST API v1]
    
    subgraph Express_Layers [Express Architecture]
        Middlewares[Bảo mật, Helmet, CORS, CorrelationId,\nToken Extraction, RBAC Scope Check]
        AuditService[Audit Service\nData Masking & Redaction Engine]
        Controllers[API Controllers & Zod Validation]
        Services[Business Services\nAuth, Profile, Organization]
        Repositories[Repository Data Access\npg Pool Parameterized Queries]
    end

    Express --> Middlewares
    Middlewares --> Controllers
    Controllers --> Services
    Services --> AuditService
    Services --> Repositories
    
    Repositories -->|TLS 5432\npg Pooler| Supabase[(Supabase PostgreSQL\nSchema 'app' riêng biệt)]
    AuditService -->|Lưu vết che bí mật| Supabase
```

### Bảng thành phần công nghệ:
- **Frontend SPA:** React 18, Vite 6, Tailwind CSS, Lucide React icons, Vanilla CSS Soft UI. Hỗ trợ 2 chế độ dữ liệu: `VITE_DATA_SOURCE=api` (kết nối máy chủ thật) và `fixture` (chế độ độc lập không backend).
- **Backend Service:** Node.js 20+, Express 4.21 (ES Modules), Zod, Helmet, Cookie-parser, Morgan, Bcryptjs, Jsonwebtoken.
- **Database Engine:** Supabase PostgreSQL trên hạ tầng AWS Tokyo (`aws-0-ap-northeast-2.pooler.supabase.com:5432`), kết nối an toàn qua `pg` connection pool có TLS/SSL bắt buộc.
- **Phân tách Schema:** Mọi bảng nghiệp vụ, thủ tục và view đều nằm trong schema `app.` riêng biệt; thu hồi toàn bộ quyền từ `anon` và `authenticated` của PostgREST để chống bypass logic kiểm soát quyền từ phía client.

---

## 2. MÔ HÌNH XÁC THỰC, PHIÊN LÀM VIỆC & PHÂN QUYỀN RBAC (W1-Q3)

### 2.1. Chu trình Token Kép & Xoay vòng Refresh Token (Token Rotation)
- **Access Token:** Ký số thuật toán HMAC-SHA256, thời hạn 2 giờ (7200s), mang theo danh tính `sub` (UserId), `username`, `email` và danh sách mã vai trò `roles`.
- **Refresh Token:** Chuỗi ngẫu nhiên mật mã 64 ký tự hex. Phía client chỉ nhận chuỗi thô qua HttpOnly Cookie (`ptud_refresh_token`), trong khi cơ sở dữ liệu chỉ lưu bản băm SHA-256 trong bảng `app.refresh_tokens`.
- **Cơ chế chống tấn công Replay Attack:** Khi một Refresh Token hợp lệ được gửi lên để làm mới (`POST /api/v1/auth/refresh`), nó sẽ bị thu hồi ngay lập tức và sinh ra token mới thay thế (`replaced_by_token_id`). Nếu token cũ đã bị thu hồi bị gửi lại, hệ thống nhận diện đây là hành vi chiếm đoạt phiên và kích hoạt thu hồi toàn bộ tất cả token đang có của người dùng (`revokeAllUserTokens`).

### 2.2. Phân quyền đa cấp & Cây phạm vi quản lý (CTE Scopes)
1. **Bốn vai trò cốt lõi:**
   - `ADMIN`: Quản trị hệ thống, danh mục, cơ cấu tổ chức và nhật ký kiểm toán. **Quy tắc bảo mật cốt lõi: ADMIN != MANAGER**, Quản trị viên không mặc nhiên có quyền thẩm định thành tích nếu không được bổ nhiệm scope đơn vị cụ thể.
   - `MANAGER`: Lãnh đạo khoa/đơn vị, có thẩm quyền phê duyệt hồ sơ trong cây phạm vi được giao.
   - `LECTURER`: Giảng viên, có quyền quản lý hồ sơ cá nhân và kê khai thành tích.
   - `UNIT_REPRESENTATIVE`: Đại diện đơn vị tập thể.
2. **Cây kế thừa phạm vi (Recursive CTE Scope Hierarchy):**
   - Khi thẩm định hồ sơ của một đơn vị con (ví dụ: Bộ môn KTPM), middleware gọi truy vấn đệ quy `WITH RECURSIVE ScopeHierarchy` để kiểm tra lãnh đạo Khoa cha có cờ `include_descendants = TRUE` hay không. Cho phép phân cấp thẩm định tự động, linh hoạt.
3. **Quy tắc liêm chính học thuật (Anti-Self Approval):**
   - Thẩm định viên có vai trò `MANAGER` tuyệt đối bị cấm tự phê duyệt hồ sơ thành tích do chính mình kê khai. Hệ thống chặn với mã lỗi `403 SELF_APPROVAL_PROHIBITED`.

---

## 3. TOÀN VẸN CƠ CẤU TỔ CHỨC VÀ HỒ SƠ NĂNG LỰC (W1-P2 & W1-P3)

### 3.1. Nguyên tắc bất biến bối cảnh đơn vị (Immutable Context Unit)
Khi giảng viên chuyển công tác từ Khoa/Bộ môn này sang đơn vị khác:
- Hệ thống đóng hiệu lực phân công công tác cũ (`valid_to = NOW()`) và tạo phân công mới trong `app.lecturer_assignments`.
- **Tuyệt đối không sửa `app.achievements.context_unit_id`** của các hồ sơ trước đây. Thành tích quá khứ mãi mãi gắn liền với đơn vị mà giảng viên công tác vào thời điểm phát sinh thành tích.

### 3.2. Chống chu trình cây tổ chức ở 2 tầng
- **Tầng Database:** Trigger `app.prevent_organization_cycle()` được gắn trên `app.organization_units`, ngăn chặn việc cấu hình cha con dẫn đến chu trình kín (A là cha của B, B là cha của A).
- **Tầng Ứng dụng:** Hàm `ensureParent` kiểm tra đệ quy hàm `hasDescendant` trước khi phát lệnh ghi xuống database.

### 3.3. Kiểm soát xung đột đồng thời (Optimistic Concurrency Control)
- Cột `version BIGINT` trên `app.lecturers` và `app.organization_units` bắt buộc phải khớp với phiên bản hiện tại trong cơ sở dữ liệu khi gọi `PATCH`.
- Nếu có người khác đã chỉnh sửa trước, lệnh UPDATE sẽ không làm thay đổi dòng nào (`rowCount = 0`) và ném ra lỗi `409 CONCURRENCY_CONFLICT`.

### 3.4. Bảo toàn dữ liệu lịch sử (No Cascade Deletes)
- Các quan hệ lịch sử quan trọng đều dùng khóa ngoại `ON DELETE RESTRICT`.
- API xóa đơn vị kiểm tra trước các bảng phụ thuộc (`getDependencyCounts`). Đơn vị đã có lịch sử công tác, thành tích, khen thưởng hoặc scope không bao giờ bị xóa vật lý.

---

## 4. PHÂN HỆ KIỂM TOÁN AN NINH VÀ CHE BÍ MẬT (W1-Q4)

Được bổ sung bởi **Tạ Trần Vinh Quang (W1-Q4)** nhằm hoàn thiện lỗ hổng giám sát và đáp ứng tiêu chí nghiệm thu doanh nghiệp.

### 4.1. Cơ chế Che bí mật đệ quy (Recursive Data Masking Engine)
Module `backend/src/modules/audit/auditService.js` cung cấp hàm `maskSecrets`:
- Nhận diện đệ quy mọi trường thông tin nhạy cảm dựa trên mẫu Regex:
  `password`, `oldPassword`, `newPassword`, `password_hash`, `token`, `refreshToken`, `apiKey`, `clientSecret`, `cookie`, `authorization`.
- Tự động thay thế giá trị nhạy cảm thành `***REDACTED***`.
- Quét và che giấu chuỗi Bearer token (`Bearer ***REDACTED***`) và chuỗi JWT độc lập (`***REDACTED_JWT***`).
- Hỗ trợ khử tham chiếu vòng (`WeakSet`) để bảo vệ tiến trình không bị tràn bộ nhớ đệm (stack overflow).

### 4.2. Bảng nhật ký kiểm toán `app.audit_logs`
```sql
CREATE TABLE IF NOT EXISTS app.audit_logs (
    audit_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id BIGINT NULL REFERENCES app.users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id BIGINT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3. Tích hợp tự động vào các thay đổi quan trọng
Mọi hành vi có tính chất thay đổi trạng thái đều được tự động lưu vết qua `recordAuditLog`:
- **Xác thực:** `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_CHANGE_PASSWORD`.
- **Hồ sơ:** `PROFILE_UPDATE`.
- **Cơ cấu tổ chức:** `ORGANIZATION_CREATE`, `ORGANIZATION_UPDATE`, `ORGANIZATION_DELETE`, `ORGANIZATION_APPOINT_REPRESENTATIVE`, `ORGANIZATION_TRANSFER_LECTURER`.

---

## 5. TỔ CHỨC CI/CD VÀ CHIẾN LƯỢC KIỂM THỬ TỰ ĐỘNG

Hệ thống thiết lập đường ống kiểm định tự động qua GitHub Actions (`.github/workflows/ci.yml`):

1. **Job 1: Frontend Lint & Build:**
   - Chạy `npm run lint` (ESLint 9 với React Hooks plugin, 0 cảnh báo).
   - Chạy `npm run build` (Vite 6 bundling sang thư mục `dist/`).
2. **Job 2: Backend API & Contract Tests:**
   - `node scripts/validate_contracts.mjs`: Kiểm tra tính toàn vẹn tĩnh của 68 hợp đồng API/OpenAPI/DDL/Fixtures.
   - `npm test`: Bộ 31 test cases kiểm thử Auth, Scopes, Token Rotation, Replay Attack, CTE Hierarchy.
   - `npm run test:w1-p3`: Bộ 4 test cases kiểm thử bảo toàn bối cảnh hồ sơ và chống chu trình.
   - `npm run test:audit`: Bộ 5 test cases kiểm thử Data Masking đệ quy và cơ chế ghi/đọc audit log.
