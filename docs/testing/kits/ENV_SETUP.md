# Chuẩn bị môi trường trước khi giao bộ test

Phần này dành cho người phụ trách môi trường, thực hiện **trước buổi test**, không phải các ca kiểm chức năng. Hai người thao tác UI trên ENV-T1 và ENV-T2 độc lập. Mỗi bản cần database, backend và kho file private riêng; hai giao diện cùng database vẫn gây ảnh hưởng chéo.

## Thứ tự nạp ban đầu

1. Dùng hai bản checkout cùng commit, cài dependencies backend/frontend theo README dự án. Tạo database test riêng (ví dụ hai project Supabase). Cấu hình kết nối trong `backend/.env` của đúng bản; không đưa mật khẩu database vào bộ tài liệu hoặc ảnh chụp.
2. Đặt `STORAGE_DIR` là đường dẫn tuyệt đối riêng cho mỗi bản, ví dụ `C:/ptud-test/T1/private/evidences` và `C:/ptud-test/T2/private/evidences`. Nếu khác máy có thể dùng thư mục mặc định riêng của từng máy. DB và kho file phải đi cùng nhau.
3. Chạy lần lượt trong thư mục `backend` của **môi trường test cần nạp**:

```powershell
npm run migrate
npm run seed
npm run seed:scenario:preview
npm run seed:scenario
```

`seed` là dữ liệu nền; `seed:scenario` backup rồi xóa dữ liệu nghiệp vụ và dựng lại SCN. Chỉ chạy lúc chuẩn bị, không chạy giữa buổi test hoặc trỏ nhầm database đang dùng. Không cần nạp lại bản hiện tại chỉ để lấy các file mẫu.

4. Chỉ ENV-T2 cần thêm tài khoản riêng kiểm đổi mật khẩu. Trong `backend`, chạy preview rồi áp dụng:

```powershell
node ../database/scripts/prepareUiTestAccounts.js --tester=2
node ../database/scripts/prepareUiTestAccounts.js --tester=2 --apply
```

Script nằm trong repository, không chạy từ thư mục ZIP. Nó thêm/đặt lại riêng `ui.t2.password`, mật khẩu `demo1234`, đầy đủ role Giảng viên, hồ sơ và phân công KTPM. Không thêm thành tích/KPI/sổ. Không chạy lại sau AUTH-07 vì sẽ đổi lại mật khẩu của ca này. ENV-T1 không cần bước này.

5. Khởi động backend/frontend. Frontend dùng API mode và URL backend đúng bản; CORS đúng URL frontend. Mỗi người ghi URL UI, mã ENV, commit và thời điểm seed vào đầu plan. Đăng nhập An/Bích/Admin bằng UI, kiểm đếm và mở thử file seed qua UI trước khi giao.

## Baseline để đối chiếu

| Dữ liệu | ENV-T1 | ENV-T2 sau bước bổ sung |
| --- | --- | --- |
| Tài khoản | 10 | 11 |
| Thành tích | 12 | 12 |
| Hồ sơ đề nghị | 8 | 8 |
| Sổ thưởng | 4 | 4 |
| KPI | 4 | 4 |
| Phiên AI mô phỏng | 2 | 2 |
| Lịch cá nhân | 0 | 0 |

Danh sách trên là baseline **sau nạp mới**, không khẳng định database hiện tại còn nguyên số lượng. Lượt kiểm AI trước có thể đã thêm phiên đánh giá. Đổi mật khẩu dùng `ui.t2.password`, tránh đổi tài khoản seed còn dùng cho nhiều ca khác.

## Nguồn KPI mô phỏng cho người 2

Trên ENV-T2, chọn một chuỗi token thử nghiệm cục bộ, đặt cùng giá trị cho `KPI_SOURCE_TOKEN` của backend và `KPI_MOCK_TOKEN` của tiến trình mock. Token không cần là khóa thật, không đưa vào báo cáo.

Trong `backend/.env` đặt `KPI_SOURCE_URL=http://127.0.0.1:4301/kpi` và `KPI_SOURCE_TOKEN` đã chọn. Trong terminal chạy mock, đặt `KPI_MOCK_TOKEN` rồi chạy `npm run mock:kpi`. Tiến trình mock đọc biến môi trường terminal; không tự nạp file `.env`. Khởi động lại backend sau khi sửa cấu hình. Nếu cổng 4301 đang dùng thì đặt `KPI_MOCK_PORT` khác và sửa URL tương ứng.

Khi test, dùng UI ánh xạ `SIM-EMP-001` vào Nguyễn Văn An / GV00234, rồi preview/đồng bộ theo ca KPI. Không dùng lệnh gọi API để thay thao tác test UI. Nguồn này luôn mang nhãn mô phỏng.

## Điều kiện AI còn cần cung cấp

Bộ SCN có tiêu chí và phiên mô phỏng, không có văn bản chính sách LHU chính thức đã được xác nhận. File minh chứng/quyết định trong ZIP cũng là giả lập. Những ca yêu cầu nguồn chính thức hoặc provider thật cần đủ nguồn, cấu hình và phạm vi gửi dữ liệu trước khi chạy; nếu thiếu thì ghi **Bị chặn**, tiếp tục ca độc lập. Không gắn nhãn nguồn chính thức cho file mẫu để làm cho ca vượt qua.

## Giao file cho tester

Giải nén đúng `tester-1.zip` hoặc `tester-2.zip`, mở README rồi đọc thứ tự chạy. Không import toàn bộ mẫu copy vào database: đó là đầu vào cho các bước tạo/sửa bằng UI. Đổi `R01` thành `R02` khi làm lượt mới, giữ prefix T1/T2. Mốc ngày mẫu là 19/10/2026; nếu chạy ngày khác, chỉnh ngày lịch/hiệu lực/quyết định và chọn kỳ seed đang mở.
