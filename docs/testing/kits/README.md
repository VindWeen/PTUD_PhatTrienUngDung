# Bộ dữ liệu và file sẵn cho hai người test UI

Hai bộ gồm plan riêng, thứ tự thao tác, bảng tra từng ca, dữ liệu copy theo form, file upload hợp lệ/lỗi và mẫu ghi bug. Người 1 có 72 ca; người 2 có 73 ca, không trùng ID. Mỗi người tự chuyển các tài khoản trong môi trường của mình, không chờ người kia xử lý hồ sơ.

- [Tải bộ người 1](packages/tester-1.zip) — luồng hồ sơ, đề nghị, sổ thưởng, lịch, hồ sơ năng lực, thông báo.
- [Tải bộ người 2](packages/tester-2.zip) — kê khai, KPI/import, AI/quy chế, báo cáo, tổ chức, quản trị và UX.
- [Chuẩn bị môi trường và thứ tự seed](ENV_SETUP.md) — dành cho người phụ trách trước buổi test.
- [Phân công song song](../UI_TEST_PLAN_PARALLEL.md).

## Bên trong mỗi ZIP

| File/thư mục | Cách dùng |
| --- | --- |
| README.md | Bắt đầu từ đây |
| 00_ENV_SETUP.md | Nạp nền → SCN → tài khoản bổ sung T2; chỉ lúc chuẩn bị môi trường |
| 01_TEST_PLAN.md | Chỉ các ca của người nhận, trạng thái chưa chạy |
| 02_COPY_DATA.md; copy/*.txt | Copy tên hồ sơ, mô tả, lý do, thông tin quyết định, lịch, quản trị… |
| 03_FILES_BY_CASE.md | Tra ID ca để biết dùng mẫu/file nào |
| 04_RUN_ORDER.md | Thứ tự thao tác để có dữ liệu cho bước sau |
| 05_BASELINE.md | Phân biệt cái có sẵn với cái phải tạo qua UI |
| 06_UPLOAD_EXPECTATIONS.md | File nào hợp lệ, file nào cố ý lỗi và mong đợi |
| 07_BUG_TEMPLATE.md | Ghi lỗi và bằng chứng |
| uploads/valid | PDF V1/V2 khác nội dung, quyết định, ảnh PNG/JPG, tên file dài |
| uploads/invalid | File rỗng, sai định dạng, giả PDF, quá 10 MB |
| kpi/ (chỉ T2) | CSV/TSV/XLSX hợp lệ và file cố ý lỗi để chọn upload |
| MANIFEST.json | Danh sách ca và dấu kiểm toàn vẹn file |

XLSX trong bộ người 2 là **file đầu vào nhập KPI**; test plan vẫn là Markdown như đã thống nhất. Không import sẵn các hồ sơ cần tự tạo trong ca test. Mẫu mô phỏng không thay thế văn bản quy chế chính thức cho AI.

## Tạo lại bộ file sau khi clone

Trong thư mục gốc repository:

```powershell
node scripts/prepare-ui-test-kits.mjs
node scripts/validate-ui-test-kits.mjs
python scripts/package-ui-test-kits.py
```

Hai ZIP trong `packages/` được lưu cùng repository, không bị `.gitignore` bỏ qua; người nhận chỉ cần giải nén để dùng. Không cần tự chạy lệnh tạo bộ file.

Khi cập nhật nội dung, các lệnh trên dựng và kiểm tra thư mục tạm trong `output/ui-test-kits`, rồi đóng ZIP vào `docs/testing/kits/packages`. Không kết nối/reset database. Các PDF/ảnh/XLSX nhỏ dùng để dựng bộ được lưu ở `fixtures`. File lỗi dung lượng lớn chỉ nằm trong thư mục tạm và bản ZIP nén, không lưu bản rời trong Git.

Lần chuẩn bị này chỉ tạo tài liệu và file mẫu, không reset lại database hiện tại và chưa tạo Supabase/môi trường thứ hai. Tài khoản bổ sung T2 đã có script, cần nạp trên ENV-T2 sau khi có môi trường đó.
