# Giải thích phần Phước phụ trách

Trình bày: “Tôi phụ trách phần sản phẩm và tích hợp frontend theo API đã chốt, tái sử dụng backend/DB của Quang; bộ này gom bằng chứng theo task, không chia đều hoặc nhận thay đóng góp.” Đối chiếu đóng góp chi tiết ở lịch sử Git và bộ P3 trên nhánh dependency, không suy ra tác giả chỉ từ tên file.

| Câu hỏi | Câu trả lời có căn cứ |
|---|---|
| Vì sao Supabase nhưng vẫn Express auth? | ADR-001 thay SQL Server bằng PostgreSQL qua pg; auth JWT/cookie, scope, status và tải file vẫn do Express quyết định. Frontend không có DB key. |
| UI có thể tự cho phép duyệt không? | UI hỗ trợ thao tác; backend kiểm role/scope/status/version và cấm tự xác nhận. P3 có ca 403/409 lịch sử; cần kiểm lại release. |
| VERIFIED hay RECOMMENDED có nghĩa đã thưởng? | VERIFIED là xác nhận thành tích; RECOMMENDED là kết luận đề nghị. RECORDED cần người có quyền ghi quyết định/file; AI không tự tạo award. |
| KPI có phải số LHU thật? | Không có nguồn upstream thật đã nghiệm thu; connector hiện MÔ PHỎNG. Mục tiêu/kết quả có nguồn và trace; conversion chỉ tạo DRAFT. |
| Recommender lấy ngưỡng ở đâu? | buildCandidate lấy threshold và references từ evaluator/run; model không tự đặt target/citation. Nguồn/tiêu chí chưa xác nhận, simulation/stale hoặc thiếu dữ liệu bị chặn. |
| Có thể nói AI chính xác 100%? | Chỉ 32/32 gate offline theo nhãn đã lưu, 3 gợi ý dương; Q2 RAG dùng mock, nhãn peer chưa xác minh đúng người. Chưa có bằng chứng accuracy LLM live. |
| Hiệu năng đạt chưa? | Achievements 1650.780ms đạt trong lượt load lịch sử, dashboard 2078.418ms chưa <2s. Lượt tải chồng cả hai chưa đạt. Không là SLA production. |
| Tư liệu đã khớp release chưa? | Chưa: HEAD, SHA record Q3 và baseline video P3 khác; P3 chưa tích hợp, tag chưa có. Hash chỉ chứng minh toàn vẹn file, không chứng minh release hay approval. |
| Restore đã sửa chưa? | Q1/Q2 có fix và test cấu trúc; Q3 vẫn BLOCKED, P2/P3 ghi FAIL42703 ở nhánh dependency. Cần chạy restored HTTP/hash ở SHA thống nhất trước nói hoàn tất. |

Khi chưa có nguồn xác nhận, trả lời bằng phạm vi đo và trạng thái còn mở; không bổ sung quy định/ngưỡng, tên reviewer hoặc kết quả test tưởng tượng để lấp chỗ trống.
