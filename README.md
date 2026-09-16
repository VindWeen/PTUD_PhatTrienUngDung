# Quản lý Hồ sơ Thành tích Số & Khen thưởng LHU

Bản khởi đầu giao diện được sao chép có chọn lọc từ `PTUD`, để tiếp tục phát triển độc lập. Phạm vi hiện tại bám theo ba nhóm thiết kế trong `Page_Design`.

## Khởi chạy

Yêu cầu Node.js 20.19+ hoặc 22.12+ và npm.

```bash
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (mặc định http://localhost:5173). Nếu cổng đang được dùng, Vite sẽ chọn cổng kế tiếp. Không cần backend, database, tài khoản thật hay file `.env`. Lần đầu ứng dụng mở form đăng nhập demo tại `/login`: nhập email hợp lệ và mật khẩu bất kỳ từ 6 ký tự (ví dụ `demo@example.com` / `demo123`).

```bash
npm run build
npm run lint
```

## Giao diện đã có

| Đường dẫn | Nội dung |
| --- | --- |
| `/login` | Đăng nhập/đăng ký mô phỏng, hiệu ứng mây trượt và loader sách từ LacHong |
| `/` | Dashboard quản lý thành tích; chuyển dữ liệu mẫu cá nhân/đơn vị |
| `/profile` | Hồ sơ năng lực, các tab thành tích và giao diện minh chứng |
| `/ai-forecast` | Phân tích & Dự báo AI, biểu đồ radar và gợi ý KPI |

Phân tích và Dự báo AI nằm chung một trang như thiết kế. Có menu desktop/mobile, chế độ sáng/tối được lưu riêng trên trình duyệt và trang 404.

## Cấu trúc

```text
PTUD_PhatTrienUngDung/
├── frontend/
│   └── src/
│       ├── components/common/  # Menu, thông báo
│       ├── data/               # Dữ liệu dashboard mẫu
│       ├── hooks/              # Theme
│       ├── layouts/            # Layout dùng chung
│       ├── pages/              # Ba trang chính và trang 404
│       ├── routes/             # Khai báo đường dẫn
│       └── services/           # Chừa chỗ tích hợp API
├── backend/src/                # Khung config, middlewares, modules, utils
├── database/                   # Khung migrations, scripts, seed
├── storage/                    # Chừa chỗ lưu minh chứng
├── docs/                       # Phạm vi và kế hoạch phát triển
├── Page_Design/                # Thiết kế tham khảo đã có
└── PROJECT_DEVELOPMENT_BLUEPRINT.md
```

Backend, database và storage mới là khung thư mục, chưa có chức năng chạy. Dữ liệu hiển thị là dữ liệu mẫu; không gửi yêu cầu API. Xuất PDF/Excel, lưu minh chứng và phân tích AI thật chưa được triển khai. Các thao tác mẫu trên trang chỉ thay đổi trạng thái giao diện, không lưu dữ liệu nghiệp vụ.

Form đăng nhập/đăng ký được tái sử dụng riêng từ LacHong. Không sao chép các trang kê khai, thẩm định, sổ khen thưởng, quản trị, báo cáo hoặc lịch sử Git của bản gốc. Repository: https://github.com/VindWeen/PTUD_PhatTrienUngDung.

Xem [phạm vi phát triển](docs/DEVELOPMENT.md). Blueprint đã có là định hướng dài hạn, không phải danh sách tính năng đã hoàn thành.

## Form đăng nhập từ LacHong

- Giữ nền mây SVG, logo, chuyển form hai chiều, loader sách lật trang và phóng lớn, công tắc ngày/đêm.
- CSS giới hạn trong `.ptud-auth`; dùng chung theme PTUD, không cần Supabase hay thư viện animation mới.
- Đăng nhập là mô phỏng, không xác minh tài khoản. Đăng ký/quên mật khẩu không gửi email hay tạo tài khoản.
- Chỉ lưu cờ `ptud-demo-session` trong sessionStorage, hoặc localStorage khi chọn ghi nhớ; không lưu email/mật khẩu.
- Menu có nút đăng xuất để xóa phiên demo và quay lại form. Đây không phải cơ chế bảo mật cho dữ liệu thật.
- Có bố cục mobile/tablet và hỗ trợ giảm chuyển động theo cài đặt trình duyệt.

