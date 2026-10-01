# W1-P3 — Hồ sơ cá nhân, tập thể và tổ chức

## Phạm vi đã nối

- Hồ sơ cá nhân: `GET/PATCH /api/v1/me/profile`.
- Hồ sơ giảng viên: `GET/PATCH /api/v1/lecturers/{id}`. Backend chỉ cho phép chủ hồ sơ sửa `phone`, `title`, `degree`; `version` là bắt buộc để chống ghi đè đồng thời.
- Hồ sơ tập thể: `GET /api/v1/units/{id}/profile` gồm đơn vị cha, đại diện hiện tại, số giảng viên và thống kê.
- Cơ cấu: `GET/POST /api/v1/organizations`, `PATCH/DELETE /api/v1/organizations/{id}`.
- Đại diện: `POST /api/v1/organizations/{id}/representative`.
- Chuyển đơn vị chính: `POST /api/v1/lecturers/{id}/assignments`.

Các thao tác ghi cơ cấu, đại diện và điều chuyển yêu cầu role `ADMIN`; middleware đọc lại role đang hiệu lực từ PostgreSQL, không chỉ tin claim trong token. Migration chặn chu trình ở DB và đổi quan hệ lịch sử sang `ON DELETE RESTRICT`.

## Quy tắc giữ lịch sử

Điều chuyển khóa hồ sơ giảng viên trong transaction, đóng khoảng hiệu lực của phân công chính cũ rồi thêm phân công mới. Luồng này không cập nhật `app.achievements.context_unit_id`, vì đây là bối cảnh đơn vị tại thời điểm lập hồ sơ.

Đơn vị chỉ được xóa khi không còn đơn vị con, phân công công tác, thành tích/context, khen thưởng, scope hoặc lịch sử đại diện. API kiểm tra trước để trả lỗi `ORGANIZATION_HAS_DATA`; khóa ngoại `RESTRICT` vẫn là lớp bảo vệ khi có cạnh tranh đồng thời.

## Fixture và dữ liệu thật

`VITE_DATA_SOURCE=fixture` cho phép xem/sửa hồ sơ cá nhân trong bộ nhớ theo đúng version của hợp đồng. Hồ sơ tập thể dùng `profile.fixtures.json`. Các thao tác ghi cơ cấu cố ý bị từ chối ở fixture, tránh tạo cảm giác dữ liệu demo đã được lưu thật. `VITE_DATA_SOURCE=api` gọi Express `/api/v1` và không fallback sang fixture khi API lỗi.

## Kiểm thử

```powershell
npm --prefix backend run test:w1-p3
npm --prefix frontend run lint
npm --prefix frontend run build
node scripts/validate_contracts.mjs
```

Kiểm thử DB tích hợp chỉ được chạy trên DB test riêng:

```powershell
$env:TEST_DATABASE_URL = '<postgres-test-url>'
$env:CONFIRM_TEST_DB_RESET = 'W1-P3'
node database/scripts/test-w1-p3.js
```

Runner từ chối chạy nếu `TEST_DATABASE_URL` trùng `SUPABASE_DB_URL`/`DATABASE_URL`. Không dùng database auth hoặc production để chạy migration/seed nghiệm thu.
