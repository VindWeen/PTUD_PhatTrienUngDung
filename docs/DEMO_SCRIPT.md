# W6-P2 — Demo theo vai trò (20–25 phút)

Người trình bày: Võ Nhạc Phước. Chạy API mode, Supabase thật, kho private thật trên môi trường demo riêng. Không dùng fixture để tuyên bố tích hợp. Dữ liệu seed/KPI mô phỏng phải được giới thiệu rõ.

## Chuẩn bị trước buổi demo

Làm README, kiểm readiness DB UP; upload một file PDF mẫu không chứa dữ liệu thật vào hồ sơ nháp của an.nv. Chuẩn bị các tài khoản trong USER_GUIDE, năm/đơn vị có dữ liệu, trình duyệt và terminal. Không hiển thị env/token/DB URL. Không seed lại trước buổi demo trên DB đã có hồ sơ cần giữ.

AI dùng mock thì gắn nhãn, không tính là provider thật; dùng provider thật cần kiểm key/quota/model free và nguồn/tiêu chí đã xác nhận trước. Thiếu tài khoản Hội đồng hoặc nguồn xác nhận thì giới thiệu giới hạn, không giả lập quyết định. W6-Q2 chưa kiểm chứng restore thật; báo cáo W5-P3 ghi lỗi 42703 của lượt cũ. Chỉ thay trạng thái này khi có log restore và HTTP hash/quyền mới, không dùng tải DB gốc làm bằng chứng. Xem checklist W6-P2 và user guide cuối; chuẩn bị mã tham chiếu/tài khoản Hội đồng trước buổi diễn.

| Phút | Thao tác | Kết quả cần nói/kiểm |
|---|---|---|
| 0–1 | Giới thiệu kiến trúc, readiness | Supabase giữ metadata; server giữ byte file; auth Express |
| 1–4 | an.nv: hồ sơ → tạo nháp → upload PDF → tải lại | Lưu API thật, tải đúng file, không có public URL |
| 4–6 | Gửi hồ sơ; đăng xuất; bich.tt mở hồ sơ vừa gửi | Kiểm trạng thái, phạm vi; không tự duyệt |
| 6–8 | Yêu cầu bổ sung có lý do; an.nv xem lịch sử và bổ sung/gửi lại nếu kịp | Lịch sử và version được backend kiểm; không lách 409 |
| 8–10 | bich.tt: Reports, lọc năm/trạng thái, xuất CSV | Giữ cùng filter; không khẳng định p95 dashboard đã đạt |
| 10–12 | KPI/AI với dữ liệu đã chuẩn bị | Nêu nguồn, hiệu lực, dữ liệu thiếu; mô phỏng gắn nhãn; không tự trao thưởng |
| 12–14 | cuong.lh tạo/gửi thành tích tập thể đúng đơn vị | Không cộng thành tích cá nhân thành tập thể; hết phân công phải bị chặn |
| 14–19 | records.demo mở kỳ; chủ thể tạo/nộp đề nghị từ VERIFIED; Manager chuyển; Hội đồng phân công, ghi ý kiến và kết luận | RECOMMENDED chỉ là đề nghị; kiểm lịch sử, không tự sinh quyết định/RECORDED |
| 19–22 | records.demo nhập quyết định MÔ PHỎNG, tạo nháp, upload file và ghi nhận | RECORDED cần quyết định/file; tải file private; giữ lịch sử |
| 22–24 | duc.pm quản trị; an.nv mở /admin, minh họa API 403 và version cũ 409 | Quản trị không thay quyền nghiệp vụ; từ chối không đổi lịch sử |
| 24–25 | Trình bày kết quả cài/restore và giới hạn còn lại | Không tuyên bố restore/AI live/hiệu năng PASS khi thiếu bằng chứng |

Nếu cần bản rút gọn 12–15 phút: dùng hồ sơ đã chuẩn bị cho đoạn Hội đồng và RecordsOfficer, vẫn đi qua cả sáu vai trò và ca quyền sai; chạy trọn checklist riêng trước buổi diễn. Nếu network/API/provider lỗi: hiển thị lỗi và chuyển sang giải thích quy trình; ảnh/fixture phải ghi mô phỏng, không ghi demo tích hợp PASS. Không thực hiện restore phá hủy schema ngay trong buổi trình diễn.

## Checklist nghiệm thu độc lập

Người khác từ clone mới thực hiện README mà không dùng node_modules cũ; migrate/seed project riêng; kiểm readiness; login 5 tài khoản bằng demo1234; tạo/upload/tải; đổi vai trò để kiểm phạm vi; xem lỗi/409; build/lint. Ghi phiên bản Node, thời điểm, lệnh, exit code. Sau khi Q3 sửa backup schema drift, chạy W5-P3 với W5_P3_BACKUP_DIR và chỉ đánh dấu restore PASS khi HTTP owner tải đúng hash/size, anonymous 401 và ngoài quyền bị từ chối.
