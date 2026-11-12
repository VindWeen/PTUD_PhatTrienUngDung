# Tệp đầu vào để tự quay video demo

Tất cả nội dung là **MÔ PHỎNG - PHỤC VỤ DEMO**, không xác nhận thành tích hay ban hành quyết định thực tế. Các tệp này chỉ là đầu vào upload/import; việc mở thư mục không thay đổi DB.

| Cảnh trong kịch bản | Tệp | Cách dùng |
|---|---|---|
| 05 - nhập KPI | `KPI - xem trước có lỗi.csv` | Xem trước 3 dòng: 2 hợp lệ, 1 lỗi kỳ ngày. Chưa bấm nhập khi còn lỗi. |
| 05 - nhập KPI | `KPI - lỗi.csv` | 2 dòng lỗi: ngày kết thúc trước bắt đầu và chỉ tiêu âm. |
| 05 - nhập KPI | `KPI - hợp lệ.csv` | 2 dòng hợp lệ; dòng thứ hai có kết quả tự kê khai 1/2 để hiện 50%. |
| 06 - thêm minh chứng | `Minh chứng nghiên cứu - bản 1.pdf` | Thêm vào A-MAIN; tên tiếng Việt, phiên bản nội dung V1. |
| 06/07 - thay tệp, bổ sung | `Minh chứng nghiên cứu - bản 2.pdf` | Có nội dung khác V1: bổ sung vai trò tác giả và thời gian. Thay tệp để quan sát tăng phiên bản. |
| 06 - ảnh minh chứng phụ | `Minh chứng nghiên cứu - bản 1 - xem trước.png` | Ảnh render từ PDF V1, có thể dùng để minh họa upload ảnh rồi xóa minh chứng phụ. |
| 13 - quyết định, ghi sổ | `Quyết định khen thưởng - mô phỏng.pdf` | Số quyết định mẫu `VID-01-QD-001-DEMO`, ngày 11/11/2026, chủ thể An. |
| 14 - thu hồi, thay thế | `Quyết định sửa sai - mô phỏng.pdf` | Số mẫu `VID-01-QD-002-DEMO`, có nội dung khác quyết định ban đầu. |
| 23 - sai định dạng | `Không hỗ trợ - thử định dạng.txt` | Dùng cho nhánh từ chối định dạng; nếu hộp chọn tệp lọc định dạng thì chọn “All files”. |

Các PNG “xem trước” còn lại chỉ giúp xem nhanh PDF, không cần upload toàn bộ. PDF đã được render và kiểm tra tiếng Việt, bố cục một trang; không có chữ ký hay con dấu giả.

## Thứ tự quay nhập KPI

1. Chọn `KPI - xem trước có lỗi.csv`, bấm kiểm tra và quay lỗi dòng ngày.
2. Đổi sang `KPI - hợp lệ.csv`, kiểm tra lại, rồi mới nhập.
3. Các mã trong CSV là `VID-01-CSV-01` và `VID-01-CSV-02`. Nếu nhập lại sau lần quay trước, hệ thống có thể báo trùng. Khôi phục DB demo ban đầu hoặc đổi tiền tố `VID-01` trong các tệp trước lượt quay mới.

CSV dùng đúng 10 cột của template hiện tại: `code,title,measureUnit,periodStart,periodEnd,target,plan,sourceNote,actual,evidenceNote`. Mã hóa UTF-8 có BOM để mở Excel đúng tiếng Việt. Bộ đọc CSV thật trong backend đã xác nhận số dòng hợp lệ/lỗi tương ứng 2/0, 0/2 và 2/1; đây là kiểm tra định dạng, không phải nhập dữ liệu vào DB.

## Tệp vượt giới hạn 10 MB - tạo khi cần

Không lưu sẵn tệp lớn vào repository. Để quay nhánh lỗi dung lượng, mở PowerShell tại thư mục dự án và chạy:

```powershell
& './docs/testing/video-demo/create-oversized-fixture.ps1'
```

Lệnh tạo `Minh chứng quá dung lượng - 11 MiB.pdf` ngay trong thư mục này bằng cách thêm byte đệm sau PDF mẫu; mục đích duy nhất là kiểm tra giới hạn dung lượng, không phải minh chứng nội dung mới. Không dùng tệp đó cho luồng nộp chính.

## Tái tạo và đối chiếu

`generate-assets.py` tạo lại 4 PDF, 3 CSV và TXT bằng Python có ReportLab, sử dụng font Arial có sẵn trên Windows. `assets-manifest.json` liệt kê kích thước/SHA-256 để đối chiếu tệp. Không chạy script này chỉ để quay video; các tệp đã chuẩn bị sẵn.

Phạm vi bộ tệp này không gồm DOCX/XLSX. Chức năng import CSV đã có đủ dữ liệu để quay luồng nhập mục tiêu; nếu muốn quay riêng bộ chọn XLSX, mở CSV hợp lệ bằng Excel và Save As XLSX, giữ nguyên header.
