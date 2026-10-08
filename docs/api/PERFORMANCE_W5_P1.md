# W5-P1: hợp đồng kiểm thử danh sách / dashboard / CSV

Kế thừa `/api/v1/achievements`, `/dashboard/summary`, `/reports`, `/reports/export.csv` của W2-Q1/W3-P1. Không thêm endpoint seed và không đổi payload/response. Auth Express và quyền/trạng thái từ DB giữ nguyên. Không dùng claim ADMIN trong JWT để mở rộng dữ liệu report.

Danh sách thành tích: thứ tự cùng giá trị `sortBy` dùng `achievement_id` cùng chiều làm khóa phụ, giúp không lặp ID giữa các trang khi nhiều timestamp bằng nhau. Count và page là hai query đọc độc lập chạy song song; chưa bảo đảm snapshot chung nếu có ghi đồng thời. Dashboard/report vẫn tính items/total/summary trong một statement.

CSV phải xuất toàn bộ bộ lọc, không chỉ trang hiện tại; giữ BOM UTF-8, quote RFC4180, neutralize công thức Excel. Giảng viên không có quyền export nhận 403. Bộ kiểm thử W5-P1 đối chiếu ID toàn bộ các trang, `valid_count`, distinct năm và escaping; không tính export vào p95.

Mục tiêu blueprint: p95 dưới 2 giây cho danh sách phân trang/dashboard, 10 người dùng đồng thời. Kết quả thật, máy đo và giới hạn: [bàn giao W5-P1](../weekly/WEEK_05_W5_P1.md). Chưa đạt mục tiêu không được báo nghiệm thu PASS toàn bộ.
