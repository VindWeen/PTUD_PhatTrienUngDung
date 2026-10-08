# Khóa ảnh, ERD và workflow — ứng viên W5-P4

SHA-256 và baseline nằm candidate-manifest.json. Không chỉnh ảnh/ERD/workflow gốc của người khác; cập nhật source sau freeze phải tạo lại manifest và review lại. Bộ hiện tại khóa đầu vào để biên soạn; chưa khóa một release đã nghiệm thu.

| Bộ | Loại / phiên bản | Dùng trong báo cáo |
|---|---|---|
| docs/testing/week-4/media/*.png | Ảnh UI test W4: loading/error/quota desktop/mobile | Chỉ minh họa trạng thái UI; xem ui-result.json, không khẳng định provider live |
| docs/weekly/images/W2_P4_*.png | Fixture/report W2 | Luôn ghi FIXTURE, không là dữ liệu người dùng thật |
| Page_Design/*.png | Mockup thiết kế ban đầu | Chỉ dùng phụ lục thiết kế, không là ảnh nghiệm thu chức năng |
| docs/database/ERD.md + DATA_DICTIONARY.md + SCHEMA_DDL.sql | Thiết kế W1 | Nguồn lịch sử; chưa bao phủ migrations W2–W5 hoặc drift live verified_by |
| database/migrations/*.sql | Schema code ứng viên | Nguồn đối chiếu ERD hiện hành, chưa đồng nghĩa schema live |
| docs/api/WORKFLOW_W3_Q1.md | Hợp đồng state machine | Kèm source achievementService và applicationService trong manifest |
| docs/api/openapi.json | Hợp đồng API ứng viên | Kiểm endpoint thực trước demo; W5-P4 không thay payload |

Ảnh live toàn workflow theo đúng ứng viên chưa có bằng chứng mới W5-P4. Không tái gắn nhãn ảnh cũ thành ảnh live mới. Trước bản cuối: chụp lại dữ liệu demo đã khử định danh, kèm SHA code, role, bước demo, nhãn nguồn KPI; đối soát ERD với migrations và drift được Q3 xử lý.
