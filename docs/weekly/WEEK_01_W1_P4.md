# Nhật ký tuần 1 — W1-P4

Người phụ trách: Võ Nhạc Phước  
Ngày cập nhật: 01/10/2026

## Công việc hoàn thành

- Đọc blueprint, ma trận quyền, hợp đồng/profile hiện có và xác nhận kiến trúc Supabase PostgreSQL qua `pg`; không đưa SQL Server trở lại tài liệu.
- Lập `docs/ai/source-register/06_Nguon.csv`, phân biệt văn bản hiện hành, lịch sử, nguồn LHU hỗ trợ, nguồn nội bộ còn thiếu, nguồn sai đối tượng và dự thảo.
- Xác minh mốc hiệu lực/chuyển tiếp 01/10/2026; loại Nghị định 98/2023 và Thông tư 01/2024/TT-BNV khỏi tập căn cứ hiện hành.
- Soạn câu hỏi xin quy chế LHU và 04 mục tiêu demo có nhãn mô phỏng.
- Review login/role/scope; lập finding và checklist retest, không sửa mã auth của Quang.

## Quyết định

- Không dùng quy chế sinh viên cho giảng viên.
- Không biến bài viết LHU hoặc dashboard thành tiêu chí xét thưởng.
- Không để AI tự trao thưởng; kết quả AI chỉ hỗ trợ chuẩn bị hồ sơ và luôn cần nguồn/kiểm tra của backend/người có thẩm quyền.
- Không ghi secret, token, dữ liệu cá nhân thật hoặc ảnh chứa thông tin đăng nhập vào Git.

## Bằng chứng

- Sổ nguồn: `docs/ai/source-register/06_Nguon.csv` và `README.md`.
- Ghi chú nghiệp vụ: `docs/ai/BUSINESS_CONFIRMATION_W1_P4.md`.
- Review auth: `docs/reviews/W1_P4_AUTH_SCOPE_REVIEW.md`.
- Ảnh UI login đã làm mờ dữ liệu nhạy cảm sẽ lưu trong `docs/reviews/evidence/` sau bước chạy local.

## Việc chờ

- GVHD/LHU cung cấp quy chế thi đua giảng viên hiện hành và trả lời danh mục câu hỏi.
- Quang xử lý/xác nhận findings auth và cung cấp PR W1-Q3 để review theo diff chính thức.
- Chạy tích hợp Supabase test riêng sau khi hai mục trên hoàn tất; không dùng env thật cho runner có thao tác đổi mật khẩu.
