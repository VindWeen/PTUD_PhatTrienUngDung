# W1-P2 — Dữ liệu tổ chức, hồ sơ và danh mục

## Phạm vi triển khai

Migration `20261001000009_w1_p2_profiles_catalogs.sql` bổ sung trên schema `app` của W1-Q1, không tạo lại `organization_units`, `lecturers`, `lecturer_assignments`, `achievements` hoặc `award_records`.

- `unit_representatives`: lịch sử người đại diện hồ sơ tập thể, có người phân công và khoảng hiệu lực.
- `academic_years`, `achievement_types`, `award_types`: danh mục dùng chung theo ERD/Data Dictionary đã chốt.
- `lecturer_assignments.assigned_by`: lưu người phân công công tác.
- Exclusion constraint PostgreSQL chặn lịch sử cùng đơn vị bị chồng lấn và chặn hai đơn vị chính cùng hiệu lực.
- `organization_units.description`: dữ liệu mô tả cho hợp đồng hồ sơ tập thể.
- Khóa ngoại chuyển tiếp từ `achievements` tới năm học/loại thành tích và từ `award_records` tới loại thưởng.

Các cột khóa ngoại mới trên bảng nghiệp vụ cũ tạm cho phép `NULL` để không làm hỏng dữ liệu W1-Q1 đã tồn tại. Backend phải bắt buộc `achievementTypeId` cho bản ghi mới theo OpenAPI. Việc chuyển sang `NOT NULL` chỉ thực hiện sau khi Quang xác nhận chiến lược backfill dữ liệu cũ.

## Quy tắc thời gian

Khoảng hiệu lực dùng quy ước PostgreSQL `[valid_from, valid_to)`: có ngày bắt đầu, không gồm thời điểm kết thúc. `valid_to = NULL` nghĩa là vô thời hạn. Vì vậy một phân công mới có thể bắt đầu đúng tại thời điểm phân công cũ kết thúc nhưng không thể giao nhau.

Một đơn vị chỉ có một đại diện còn hiệu lực tại một thời điểm. Một giảng viên có thể kiêm nhiệm nhiều đơn vị, nhưng không thể có hai phân công chính chồng lấn; hai bản ghi của cùng giảng viên tại cùng đơn vị cũng không được chồng lấn.

## Seed

`supabase/seed.sql` cung cấp dữ liệu phát triển có gắn mô tả mô phỏng:

- ba năm học tham chiếu; không tự gắn năm hiện hành khi chưa có quyết định cấu hình;
- ba loại thành tích và bốn loại thưởng dùng đúng mã trong Data Dictionary/fixtures;
- lịch sử công tác cá nhân và một phân công đại diện tập thể;
- không chứa key, dữ liệu thật, điểm KPI hoặc quyết định khen thưởng thật.

## Hợp đồng profile

OpenAPI giữ các endpoint đã chốt:

- `GET/PATCH /api/v1/me/profile`;
- `GET /api/v1/lecturers/{id}`;
- `GET /api/v1/units/{id}/profile`.

`PersonalPortfolioResponse` mô tả rõ lịch sử công tác và thống kê. `UnitProfileResponse` có `parentUnit`, `representative`, `lecturersCount`, trạng thái và version. Đại diện được trả về theo component `UnitRepresentative` và chỉ hợp lệ khi thời điểm hiện tại thuộc khoảng phân công.

## Kiểm thử trên DB riêng

Sau khi khởi động Supabase local/test database:

```powershell
$env:TEST_DATABASE_URL='postgresql://...database-test-rieng...'
$env:CONFIRM_TEST_DB_RESET='W1-P2'
node database/scripts/test-w1-p2.js
```

Runner từ chối chạy nếu `TEST_DATABASE_URL` bị thiếu hoặc trùng `SUPABASE_DB_URL`/`DATABASE_URL`. Không chạy `seed` trên database dùng chung vì seed chủ động `TRUNCATE ... CASCADE`. Các thao tác cố tình vi phạm constraint trong bài test SQL chạy trong transaction và luôn `ROLLBACK`.
