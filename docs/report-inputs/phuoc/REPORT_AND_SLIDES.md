# Mục lục báo cáo và storyboard W6-P4

Đây là dàn ý và đầu vào; báo cáo/slide hoàn chỉnh chưa thuộc sản phẩm đã làm. Mỗi chương/slide cần giữ source SHA, ngày đo và nhãn mô phỏng. Chỉ thay bộ W5-P4 bằng bản này khi gate release đã đóng.

## Mục lục báo cáo

1. Bài toán, chủ thể cá nhân/tập thể và phạm vi PTUD/KLTN — blueprint, BUSINESS_RULES; quy tắc đề xuất chưa là quy chế chính thức.
2. Phân công hai người — contributions/commit P3; tác giả Git khác approval hoặc người chạy test.
3. Kiến trúc và ADR-001 — React/Vite/Tailwind → Express `/api/v1` → Supabase PostgreSQL qua pg; auth/file private Express.
4. Use case, role/scope, state machine, version/snapshot — USE_CASES_AND_ASSETS, API contracts.
5. Sản phẩm Phước — profile/admin, awards, notifications, reports, KPI, applications/council UI; dẫn task/hợp đồng, không nhận backend Quang là đóng góp riêng.
6. KPI/recommender và giới hạn AI — nguồn/tiêu chí/model, accept/reject, gate fail closed; dữ liệu mô phỏng.
7. Kiểm thử và hiệu năng — phương pháp, mẫu, p95, review số liệu Quang; PASS tài liệu khác integration.
8. Triển khai/demo/backup/restore — readiness, schema/storage riêng, bằng chứng hash, blocker thực tế.
9. Đánh giá và việc còn lại — release alignment, provider, nhãn peer, date/timezone, máy thứ hai.
10. Phụ lục — API, manifest ảnh, metadata release, PR evidence, lệnh và kết quả thật.

## Storyboard 10 slide, khoảng 10 phút

| Slide / thời gian | Nội dung và lời trình bày Phước | Tư liệu | Điều kiện trước chốt |
|---|---|---|---|
| 1 / 30s | Bài toán hồ sơ số; xác nhận thành tích khác trao thưởng | blueprint | Không khẳng định quy tắc đề xuất đã được LHU duyệt |
| 2 / 45s | React → Express → pg/Supabase; backend giữ quyền/trạng thái/file | ADR-001, API | Ghi runtime theo lockfile, không chép Vite5 từ Q4 |
| 3 / 45s | Use case sáu vai trò, phân biệt người nộp/người xác nhận | USE_CASES, matrix | Scope và anti-self-approval |
| 4 / 60s | VERIFIED và snapshot; sửa sai qua revision/replacement | images/verified.png, workflow | Ảnh lịch sử P3 cần chụp lại release |
| 5 / 60s | Reports/CSV đúng scope, tách 4 nhóm chỉ số | images/reports.png, REPORTS_W3_P1 | Số seed không phải thống kê LHU |
| 6 / 60s | Đề nghị → Hội đồng; OCC409; RECOMMENDED chưa tạo award | images/occ.png, recommended.png | Không gọi đây là AI tự xét thưởng |
| 7 / 60s | RecordsOfficer ghi quyết định/file private → RECORDED | images/recorded.png, AWARDS_W2_P2 | Tích hợp multipart P3 và kiểm lệch ngày |
| 8 / 75s | KPI MÔ PHỎNG; 32 gate offline = 3 dương/29 âm; 3/3 có nguồn | recommender results, METRICS_REVIEW | Chưa có ảnh/live LLM; review nhãn còn mở |
| 9 / 75s | p95 1650.780/2078.418; tải chồng 2167.016/2873.549; dashboard chưa đạt | performance.json | Không trình bày số lịch sử là đo release |
| 10 / 90s | Đóng góp, giới hạn và kế hoạch release 28/10 | manifest, README, review P3/Q3 | Release/tag/restore/peer review còn mở |

Hình trong slide 4–7 phải giữ caption **MÔ PHỎNG / lịch sử W6-P3 / chưa khớp release** đến khi có lượt chụp mới. Slide 8 dùng bảng gate có nguồn, không tạo ảnh KPI giả. Bản mục lục chung W5-P4 REPORT_AND_SLIDES.md được giữ nguyên để tránh ghi đè công việc cũ; W6-P4 cung cấp bản tiếp nối này.
