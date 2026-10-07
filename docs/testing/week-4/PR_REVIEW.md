# W4-P4 — Review local W4-Q3 / W4-P1

Phạm vi review: mã local W4-Q3 b7f6504 và W4-P1 b5bedf7 trên HEAD 7851e61. Chưa review PR remote (REST SSL failure, không có gh); tài liệu này là bản review để đính kèm PR, chưa gửi comment/review ra ngoài.

## Đã sửa trong working tree

- P1: AIForecast tự tạo tiêu chí khi request lỗi/rỗng và dùng sai field ID. Bỏ fallback, chỉ submit criteria_version_id trả từ API; trạng thái lỗi/rỗng có hướng xử lý.
- P1: ragExplanationService tự gắn chunk đầu khi model không viện dẫn, khiến câu chưa kiểm chứng mang căn cứ có vẻ thật. Bỏ tự gắn; từ chối câu không citation hoặc chứa mã không tồn tại. Năm ca hồi quy W4-P4 pass, gồm controller chống ghép criterion khác vào run.
- P1: RAG với runId chỉ kiểm tra quyền run rồi dùng criterionResult do client gửi. Controller nay lấy criterion đã lưu sau authorize và ngày snapshot; không tìm thấy trả 400.
- P2: mock/dự phòng chưa rõ trên UI; bổ sung nhãn và hướng xử lý quota/thiếu nguồn. Lỗi vendor thô không được phản chiếu trong fallback.
- P2: badge đồng nhất xuất hiện trước stale-check và lịch sử giữ explanation từ phiên trước; sửa trạng thái chưa kiểm tra và reset khi tải phiên khác.

## Chưa đủ bằng chứng để approve nghiệm thu

- P1: link sourceUrl lấy từ DB chưa được đối chiếu nội dung/phiên bản tài liệu thật. Không thể khẳng định chỉ vì chunk ID hợp lệ mà mọi mệnh đề LLM đều được nguồn hỗ trợ. Kiểm tra hiện tại là kiểm tra định danh citation, không phải entailment.
- P1: buildInputSnapshot trong aiService chỉ lưu primaryCrit/primaryDoc khi chạy nhiều tiêu chí; cần W4-Q3/Q1 thống nhất snapshot toàn bộ tiêu chí/phiên bản để tái hiện đầy đủ. W4-P4 không thay hợp đồng snapshot rộng hơn.
- P2: explain không runId vẫn nhận kết quả client (preview compatibility). Không dùng nhánh này làm bằng chứng cho hồ sơ thật; muốn bỏ cần thống nhất hợp đồng W4-Q2/Q3.
- P2: suite W4-Q3 hiện index nguồn và ghi phiên vào schema app chung; chưa chạy lại trong lượt này. Chuyển sang schema tổng hợp rollback rồi kiểm tra history/stale/scope/RAG thật.
- W4-P1 Supabase tích hợp 28 assertion pass, nhưng provider stub; real-provider exit 1 vì chưa cấu hình key. UI fixture không thay thế nghiệm thu nối DB/provider thật.

Đề nghị: giữ trạng thái cần bổ sung bằng chứng; chưa approve/merge. Không có thay đổi auth/private files hoặc quy tắc tự trao thưởng.
