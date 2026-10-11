# Hoàn thiện luồng hồ sơ và minh chứng sau plan

Nhánh: `post-plan-integration`. Ngày: 11/10/2026 (Asia/Saigon).

Ưu tiên hiện tại theo yêu cầu người dùng: hoàn thiện chức năng PTUD trước, AI sau. Test hiệu năng và cài máy sạch tạm hoãn.

## Thay đổi chức năng

- Tạo/lưu hồ sơ mở ngay chi tiết để thêm minh chứng, sửa hồ sơ và nộp/gửi lại. Chưa có tệp thì nút nộp tại chi tiết bị khóa.
- Nạp danh mục phải thành công trước khi kê khai; lỗi có nút thử lại, không âm thầm biến lỗi thành danh mục rỗng.
- API danh sách/chi tiết trả `actions` theo chủ thể, đại diện hiện hành và phạm vi Manager. UI dùng thông tin này; endpoint ghi vẫn kiểm quyền lại. Admin-only không có nút duyệt. ID chủ hồ sơ dùng đúng trường API.
- Danh sách Manager/RecordsOfficer mở rộng xuống đơn vị con khi scope có `includeDescendants`; chỉ dùng scope của vai trò đọc phù hợp.
- Upload minh chứng để trình duyệt tạo multipart boundary; kiểm đuôi, file rỗng và 10 MB ở client, backend vẫn kiểm nội dung.
- Tải minh chứng dùng Blob đã được API client giải bọc. Phản hồi lỗi JSON của endpoint tải được đọc đúng.
- Thêm/thay/xóa minh chứng khóa cùng hàng achievement với thao tác nộp; kiểm trạng thái lại trong transaction. Version file tính dưới khóa, tránh ghi file vào hồ sơ đã nộp hoặc trùng version do thao tác đồng thời.
- Lịch sử/lần nộp đọc đúng `histories`/`submissions`, hiển thị người xử lý, ghi chú và version snapshot; lỗi tải được hiển thị và có thử lại.
- Tạo bản thay thế mở đúng hồ sơ trả về. Lỗi 409 cập nhật danh sách, yêu cầu chọn lại trước thao tác tiếp.

## Kiểm chứng chức năng

- `node --test backend/tests/core-workflow.test.js backend/tests/w6-p1.test.js backend/tests/w5-p4.test.js`: 10/10 PASS.
- W3-Q1 tích hợp API trên Supabase/Express thật: 36 kiểm tra PASS, gồm quyền owner/Manager trên danh sách/chi tiết và hàng chờ Khoa–Bộ môn.
- Browser Edge qua Vite/API thật: tạo → upload → tải đúng byte → bổ sung → thay file → gửi lại → hai snapshot → Manager duyệt → khóa file: PASS.
- W2-Q4 HTTP/Supabase thật: 68 assertions PASS, gồm hồ sơ tập thể, đại diện hết hạn, file phiên bản cũ, tải ngoài quyền, chống tự duyệt và rollback khi thông báo lỗi.
- Frontend build/lint: PASS. `git diff --check`: PASS.
- DB test là schema riêng với dữ liệu tổng hợp, outer rollback; dọn các file do runner tạo. Không seed/migrate schema app đang dùng.

Chạy lại API: `node backend/tests/w3-q1.integration.js`.

Chạy browser cùng API từ thư mục backend (PowerShell), với module Playwright đã cài:

```powershell
$env:CORE_WORKFLOW_UI='1'
$env:W6_PLAYWRIGHT_PATH='<đường dẫn tuyệt đối tới module playwright>'
node tests/w3-q1.integration.js
```

`CORE_WORKFLOW_UI_ONLY=1` chỉ chạy browser nếu cần điều tra UI; không tính đó là kết quả chạy bộ assertion API.

Đây là kiểm chứng luồng hồ sơ/minh chứng, chưa là nghiệm thu toàn bộ project. AI, nguồn KPI ngoài, restore, performance và cài máy sạch chưa được chốt trong đợt này.
