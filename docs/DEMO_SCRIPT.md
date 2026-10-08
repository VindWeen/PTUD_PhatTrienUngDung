# W5-P3 — Demo 12–15 phút

Người trình bày: Võ Nhạc Phước. Chạy API mode, Supabase thật, kho private thật trên môi trường demo riêng. Không dùng fixture để tuyên bố tích hợp. Dữ liệu seed/KPI mô phỏng phải được giới thiệu rõ.

## Chuẩn bị trước buổi demo

Làm README, kiểm readiness DB UP; upload một file PDF mẫu không chứa dữ liệu thật vào hồ sơ nháp của an.nv. Chuẩn bị các tài khoản trong USER_GUIDE, năm/đơn vị có dữ liệu, trình duyệt và terminal. Không hiển thị env/token/DB URL. Không seed lại trước buổi demo trên DB đã có hồ sơ cần giữ.

AI dùng mock thì gắn nhãn, không tính là provider thật; dùng provider thật cần kiểm key/quota/model free và nguồn/tiêu chí đã xác nhận trước. Thiếu tài khoản Hội đồng hoặc nguồn xác nhận thì giới thiệu giới hạn, không giả lập quyết định. Restore Q3 hiện bị chặn do schema drift (báo cáo W5-P3); không trình diễn tải DB gốc rồi gọi là tải sau restore.

| Phút | Thao tác | Kết quả cần nói/kiểm |
|---|---|---|
| 0–1 | Giới thiệu kiến trúc, readiness | Supabase giữ metadata; server giữ byte file; auth Express |
| 1–4 | an.nv: hồ sơ → tạo nháp → upload PDF → tải lại | Lưu API thật, tải đúng file, không có public URL |
| 4–6 | Gửi hồ sơ; đăng xuất; bich.tt mở hồ sơ vừa gửi | Kiểm trạng thái, phạm vi; không tự duyệt |
| 6–8 | Yêu cầu bổ sung có lý do; an.nv xem lịch sử và bổ sung/gửi lại nếu kịp | Lịch sử và version được backend kiểm; không lách 409 |
| 8–10 | bich.tt: Reports, lọc năm/trạng thái, xuất CSV | Giữ cùng filter; không khẳng định p95 dashboard đã đạt |
| 10–12 | KPI/AI với dữ liệu đã chuẩn bị | Nêu nguồn, hiệu lực, dữ liệu thiếu; mô phỏng gắn nhãn; không tự trao thưởng |
| 12–14 | Giới thiệu vận hành backup/restore, kết quả runner W5-P3 | Nêu rõ restore đang FAIL 42703; chưa nghiệm thu download sau restore |
| 14–15 | duc.pm hoặc records.demo mở menu theo vai trò, tổng kết giới hạn | Admin/văn thư không thay quyền xét chuyên môn; Hội đồng cần tài khoản/phân công riêng |

Nếu cần 10–12 phút: bỏ thao tác sửa/gửi lại lần hai và chỉ mở báo cáo, vẫn giữ phần giới hạn restore/AI. Nếu network/API/provider lỗi: hiển thị lỗi và chuyển sang giải thích quy trình; ảnh/fixture phải ghi mô phỏng, không ghi demo tích hợp PASS. Không thực hiện restore phá hủy schema ngay trong buổi trình diễn.

## Checklist nghiệm thu độc lập

Người khác từ clone mới thực hiện README mà không dùng node_modules cũ; migrate/seed project riêng; kiểm readiness; login 5 tài khoản bằng demo1234; tạo/upload/tải; đổi vai trò để kiểm phạm vi; xem lỗi/409; build/lint. Ghi phiên bản Node, thời điểm, lệnh, exit code. Sau khi Q3 sửa backup schema drift, chạy W5-P3 với W5_P3_BACKUP_DIR và chỉ đánh dấu restore PASS khi HTTP owner tải đúng hash/size, anonymous 401 và ngoài quyền bị từ chối.
