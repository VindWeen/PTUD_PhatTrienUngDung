# Phạm vi bản khởi đầu

## Đã thực hiện

- Tái sử dụng React, Vite, Tailwind, biểu tượng Lucide và phong cách Soft UI từ bản gốc.
- Sao chép Dashboard, ProfilePortfolio, AIForecast, NotFound cùng CSS, theme và layout cần thiết.
- Thu gọn menu còn ba trang trong Page_Design; giữ bố cục responsive và chế độ sáng/tối.
- Thay phụ thuộc xác thực và API bằng dữ liệu mẫu cục bộ.
- Tạo khung backend, database, storage, docs để phát triển tiếp.

## Những đợt có thể làm tiếp

1. Điều chỉnh nội dung, màu sắc và thông tin hồ sơ cho bản mới.
2. Hoàn thiện biểu mẫu minh chứng, lưu dữ liệu và xuất hồ sơ.
3. Dựng backend, thiết kế database và kết nối API.
4. Thêm xác thực và phân quyền, rồi các trang nghiệp vụ khi cần.
5. Tích hợp phân tích/dự báo thật và kiểm thử các luồng nghiệp vụ.

Mỗi đợt nên commit những thay đổi thực tế đã hoàn thành. Lịch sử phát triển bắt đầu từ bản khởi đầu này.

## Vị trí chỉnh sửa

- `frontend/src/data/demo.js`: số liệu dashboard cá nhân/đơn vị.
- `frontend/src/pages/`: nội dung ba trang, bao gồm dữ liệu minh họa hồ sơ và AI kế thừa bản gốc.
- `frontend/src/components/common/Sidebar.jsx`: menu desktop/mobile.
- `frontend/src/routes/AppRoutes.jsx`: các đường dẫn đang có.
- `frontend/src/services/`: vị trí dành cho lớp gọi API trong tương lai.

Các con số, kết quả dự báo và năm 2024 trên giao diện là minh họa kế thừa thiết kế, không phải dữ liệu cập nhật thực tế.
