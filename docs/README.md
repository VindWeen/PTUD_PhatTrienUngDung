> **Hiện hành 11/11/2026:** SQL Server đã thay Supabase cho backend. Xem [kết quả chuyển đổi](testing/SQLSERVER_MIGRATION_REPORT.md), [cài đặt mới](deployment/GETTING_STARTED.md) và [báo cáo ba chương](bao-cao/BaoCaoHocPhan_LHU_3Chuong_SQLServer.docx). Tài liệu W1–W6/PostgreSQL là lịch sử.

# Bản đồ tài liệu

**Tài liệu cũ đã gom tại [archive/](archive/README.md)**: nhật ký tuần, review, scaffold ban đầu và ghi chú/demo theo mốc. Hướng dẫn đang dùng giữ ở các nhóm bên dưới.

Mục lục cập nhật ngày **04/11/2026**, gồm thay đổi chưa commit. [README gốc](../README.md) là điểm bắt đầu. Mục lục này phân biệt hướng dẫn đang dùng với kế hoạch và bằng chứng lịch sử; không xác nhận mọi chi tiết trong mọi file đã được kiểm chứng lại.

## Chọn theo nhu cầu

Rà soát code/workflow mới nhất: [WORKFLOW_AUDIT](testing/WORKFLOW_AUDIT.md) — lỗi, khoảng thiếu và mức kiểm chứng ngày 03/11/2026.

Rà soát giao diện: [UI_VISUAL_AUDIT](testing/UI_VISUAL_AUDIT.md) — 16 điểm desktop/mobile đã cải thiện ngày 04/11/2026; có ảnh trước/sau, kết quả và giới hạn kiểm tra.

| Cần làm gì | Đọc ở đâu | Lưu ý |
| --- | --- | --- |
| Hiểu dự án và chạy lần đầu | [README](../README.md), [cài đặt](deployment/GETTING_STARTED.md) | README tổng hợp phạm vi; hướng dẫn cài bổ sung cấu hình/xử lý lỗi. |
| Dùng ứng dụng | [USER_GUIDE](USER_GUIDE.md), [lịch cá nhân](PERSONAL_CALENDAR.md) | Đối chiếu UI khi có thay đổi chức năng mới. |
| Hiểu quyền và nghiệp vụ | [tài khoản/phạm vi](requirements/ACCOUNT_ROLES_AND_SCOPES.md), [ma trận quyền](requirements/PERMISSIONS_MATRIX.md), [quy tắc](requirements/BUSINESS_RULES.md) | Đọc cùng middleware/service; backend là nơi thực thi quyền. |
| Demo đủ vai trò | [scenario](testing/scenario/README.md), [demo script](DEMO_SCRIPT.md) | Scenario có dữ liệu sáu vai trò, khác bộ seed cơ bản. |
| Triển khai/phục hồi | [deployment](deployment/DEPLOYMENT_GUIDE.md), [backup/restore](deployment/RUNBOOK_DEMO_BACKUP_RESTORE.md), [AI pool](deployment/AI_POOL.md) | Kiểm cấu hình môi trường thực; seed/reset có thể xóa dữ liệu. |
| Sửa API/DB | [OpenAPI](api/openapi.json), [ERD](database/ERD.md), [từ điển dữ liệu](database/DATA_DICTIONARY.md) | Tham chiếu có thể chậm hơn source; kiểm route/validator và migration. |
| Kiểm thử UI | [test kits](testing/kits/README.md), [test plan](testing/UI_TEST_PLAN.md) | Kế hoạch test không phải kết quả PASS. |
| Viết báo cáo/bảo vệ | [báo cáo học phần 3 chương](report-inputs/REPORT_AND_SLIDES.md), [report inputs](report-inputs/README.md) | Khung áp dụng hiện tại ở đầu file; minh chứng W5/W6 và số liệu cũ phải giữ mốc. |

## File nào dễ gây hiểu nhầm?

| File/nhóm | Cách hiểu |
| --- | --- |
| `PROJECT_DEVELOPMENT_BLUEPRINT.md` | Thiết kế/kế hoạch ban đầu, hữu ích cho mục tiêu và ADR; chia giai đoạn đã lệch triển khai. AI, Hội đồng và hồ sơ đề nghị đã có trong source. |
| `archive/DEVELOPMENT.md` | Mô tả scaffold ban đầu, không dùng để kết luận phạm vi hiện tại. |
| `archive/CORE_WORKFLOW_POST_PLAN.md` | Nhật ký đợt 11/10; “hiện tại”, “tạm hoãn” chỉ áp dụng cho đợt đó. |
| `archive/weekly/`, `archive/reviews/`, `api/*W*.md` | Kế hoạch, hợp đồng/review theo task; tra lịch sử quyết định, không coi là đặc tả mới nhất toàn hệ thống. |
| `testing/week-*/`, `testing/w6-*/`, báo cáo có ngày | Bằng chứng lần chạy cụ thể, gắn với phiên bản, dữ liệu và môi trường lúc ghi. |
| `ai/` | Kiến trúc, nguồn và tập đánh giá theo từng đợt; số liệu không mặc nhiên áp dụng cho code/provider mới. |
| `report-inputs/`, `archive/DEMO_SCENARIO_W6Q3.md` | Tổng hợp/kịch bản ở mốc báo cáo, không thay tổng quan hiện tại. |

Nhật ký tuần/review đã chuyển vào archive và cập nhật tham chiếu trong Markdown, test và script. Hồ sơ test, hợp đồng API và report-inputs vẫn giữ vị trí vì còn dùng để tra cứu/kiểm chứng.

## Khi có mâu thuẫn

1. Hành vi triển khai: kiểm `frontend/src/routes/AppRoutes.jsx`, `backend/src/app.js` và route/validator/service tương ứng. Schema chuẩn nằm ở `supabase/migrations/`; trạng thái DB thật cần kiểm migration đã áp dụng.
2. Cách chạy: đối chiếu script trong hai `package.json`, `.env.example` và loader cấu hình. Không dùng mô tả scaffold hoặc SQL Server cũ để cài bản hiện tại.
3. Chất lượng: cần kết quả chạy trên phiên bản/môi trường đang xét. Có code hoặc báo cáo PASS cũ chưa chứng minh lần chạy hiện tại thành công.

## Quy ước cập nhật từ đây

- Đổi phạm vi/cách chạy: sửa README gốc và hướng dẫn chức năng liên quan.
- Thêm hướng dẫn lâu dài: liên kết tại mục lục này; ưu tiên cập nhật file có sẵn.
- Thêm log/test/review: ghi ngày, phạm vi, phiên bản, điều kiện chạy; lưu trong nhóm lịch sử phù hợp.
- Kết thúc đợt làm việc: đưa kết luận còn hiệu lực về hướng dẫn; giữ log tuần làm minh chứng.
