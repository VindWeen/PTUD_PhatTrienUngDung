# W6-P1 — Log và bộ ảnh cuối

Bàn giao: [WEEK_06_W6_P1.md](../../weekly/WEEK_06_W6_P1.md). Các ảnh là dữ liệu tổng hợp có nhãn chạy trên Express/pg/Supabase thật trong schema kiểm thử rollback; không là ảnh dữ liệu vận hành LHU hay ảnh sau restore. Metadata/hash được ghi trong [verification.json](verification.json).

| Trang | 390px | 768px | 1440px |
|---|---|---|---|
| Báo cáo | [Mobile](../../../output/w6-p1/ui/reports-390.png) | [Tablet](../../../output/w6-p1/ui/reports-768.png) | [Desktop](../../../output/w6-p1/ui/reports-1440.png) |
| KPI | [Mobile](../../../output/w6-p1/ui/kpi-390.png) | [Tablet](../../../output/w6-p1/ui/kpi-768.png) | [Desktop](../../../output/w6-p1/ui/kpi-1440.png) |

Đã xem ảnh mobile báo cáo/KPI và desktop báo cáo: thanh 0%, nhãn MÔ PHỎNG, bố cục và cuộn bảng. Browser tự kiểm không tràn ngang cả sáu trạng thái; tải CSV thật, preview READY_GOAL tô xanh, lỗi tải mẫu có alert trong trang, tạo DRAFT và theo link sang Thành tích đọc được danh mục dành cho giảng viên. Không có dialog alert mẫu hoặc pageerror trong luồng được chạy.

Log local (Git ignore): [E2E cuối](../../../output/w6-p1/ui-e2e.log), [unit](../../../output/w6-p1/unit.log), [báo cáo ban đầu](../../../output/w6-p1/reports-integration.log), [KPI](../../../output/w6-p1/kpi-integration.log), [connector](../../../output/w6-p1/connector-integration.log), [build](../../../output/w6-p1/build.log), [lint](../../../output/w6-p1/lint.log). Lượt connector timeout trước khi chạy tuần tự giữ tại [connector-first-fail.log](../../../output/w6-p1/connector-first-fail.log).

KPI ngoài dùng upstream HTTP mô phỏng có nhãn; chỉ ca lỗi template 503 của browser bị mô phỏng để kiểm tra vùng lỗi. Các phản hồi thành công và luồng nghiệp vụ khác gọi API/DB thật. Không lưu token, password thực, dữ liệu hồ sơ thực hoặc backup vào tư liệu Git.
