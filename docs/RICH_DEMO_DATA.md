# Bộ dữ liệu demo mở rộng

Chuẩn bị ngày **12/11/2026**, trên **SQL Server `PTUD_LHU_Demo`**, giao diện **http://127.0.0.1:5175**. Không thay dữ liệu của `PTUD_LHU`. Bộ SCN cũ được giữ; dữ liệu mở rộng dùng tiền tố `DEMO-`. Cơ cấu mở rộng, người dùng bổ sung, thành tích, quyết định và tiêu chí thực hành là giả lập.

## Quy mô sau khi chuẩn bị

| Nội dung | Số lượng |
|---|---:|
| Tài khoản | 40 |
| Đơn vị | 18 |
| Thành tích | 238 |
| Mục tiêu/KPI | 134 |
| Hồ sơ đề nghị | 69 |
| Bản ghi khen thưởng | 44 |
| Văn bản / phiên bản / tiêu chí | 6 / 7 / 6 |
| CV đã có nội dung | 8 |
| Tham chiếu tệp private đã đối chiếu | 281 |

Lịch sử phân tích và thông báo tăng sau mỗi lần thao tác; số lượng tại lần kiểm tra được ghi trong [RICH_DEMO_VERIFICATION.json](testing/RICH_DEMO_VERIFICATION.json). Đây là dữ liệu trình diễn, không phải kết quả đo mức chịu tải của hệ thống.

## Tài khoản nên dùng

Mật khẩu web chung: **`demo1234`**. Không dùng mật khẩu này cho SQL Server. Danh sách đầy đủ, phạm vi và đơn vị được xuất trong [RICH_DEMO_ACCOUNTS.md](RICH_DEMO_ACCOUNTS.md).

| Đăng nhập | Vai trò / điều nên xem |
|---|---|
| `an.nv` | Nhân vật chính: lịch sử thành tích ba năm, KPI nhiều mức tiến độ, phân tích, CV đã chia sẻ |
| `mai.cntt` | Giảng viên CNTT khác; có thành tích/KPI và CV nháp chưa chia sẻ |
| `huy.cntt` | Giảng viên CNTT khác; xem hồ sơ riêng và lịch sử đánh giá |
| `bich.tt` | Quản lý Khoa CNTT và các đơn vị con, đồng thời là giảng viên; không xem hồ sơ Khoa Dược |
| `quanly.duoc` | Quản lý Khoa Dược; thấy dữ liệu Dược thay vì CNTT |
| `quanly.kinhte` | Quản lý Khoa Kinh tế |
| `quanly.kythuat` | Quản lý Khoa Kỹ thuật |
| `quanly.ngonngu` | Quản lý Khoa Ngôn ngữ |
| `cuong.lh` | Giảng viên KHMT, đại diện Bộ môn KTPM; chuyển giữa hồ sơ cá nhân và tập thể |
| `giangvien.13` đến `giangvien.18` | Kiêm đại diện các bộ môn Dược, Kinh tế, Kỹ thuật, Ngôn ngữ; có thành tích và đề nghị tập thể |
| `hoidong.truong` | Hội đồng phạm vi toàn cây tổ chức demo, được giao các hồ sơ mở rộng và `DEMO-MAIN` |
| `council.demo` | Hội đồng phạm vi CNTT; dùng các hồ sơ SCN đã phân công |
| `council.other` | Hội đồng CNTT nhưng chưa được giao hồ sơ: phân biệt quyền xem và quyền kết luận |
| `records.demo` | Chuyên viên phạm vi CNTT; chọn đơn vị cụ thể để xem sổ thưởng |
| `thidua.truong` | Chuyên viên phạm vi toàn cây tổ chức demo; đổi đơn vị để xem dữ liệu nhiều khoa |
| `duc.pm` | Quản trị: tổ chức, tài khoản, vai trò/phạm vi và kho quy định |
| `linh.pharm` | Giảng viên Dược, ngoài phạm vi của Bích |
| `rep.expired` | Vai trò đại diện còn có nhưng phân công đã hết hạn; không có quyền làm thay tập thể |
| `locked.demo` | Tài khoản cố ý khóa; đăng nhập bị từ chối |

Chỉ thêm vai trò không tự tạo quyền trên toàn trường. Phạm vi quản lý đi theo cây tổ chức; người xét còn cần được phân công. Admin không tự thay người duyệt nghiệp vụ. Các quản lý mới có hồ sơ giảng viên nhưng không được tự duyệt thành tích của mình.

## Cách tìm các tình huống

**Thành tích:** tìm `DEMO-`, lọc năm 2024–2026 hoặc trạng thái. Có nháp, chờ xác nhận, cần bổ sung, xác nhận, từ chối, chủ hồ sơ rút và thu hồi; có cá nhân và tập thể. Mỗi hồ sơ mở rộng có tệp private tồn tại thật. Năm ghi nhận, lịch sử thành tích và năm nguồn khen thưởng được sắp theo chuỗi quá khứ mô phỏng.

**KPI:** An và các giảng viên bổ sung có mục tiêu năm trước/năm hiện tại, bản nháp, chưa có kết quả, hoàn thành 100%, 75%, 50%, 25% và quá hạn. DB của ứng dụng dùng trạng thái **DRAFT/ACCEPTED**; hoàn thành/chưa đạt/quá hạn thể hiện qua kết quả và thời gian, không thêm các trạng thái giả không có trong code.

**Hồ sơ đề nghị:** dữ liệu mở rộng có đủ nháp, đã nộp, chờ Hội đồng, đang xét, cần bổ sung, đề nghị và không đề nghị. Hồ sơ đã nộp có bản chụp nguồn và lịch sử chuyển bước, tạo bằng service nghiệp vụ.

**Hai hồ sơ để trình bày:**

| Tìm theo tên | Trạng thái ban đầu | Dùng làm gì |
|---|---|---|
| `DEMO-MAIN` | Đang xét, đã giao `hoidong.truong` | Mở lịch sử, xem phân công, kết luận đề nghị khi trình bày |
| `DEMO-READY` | Đã đề nghị | Minh họa hồ sơ đã đi tiếp đến ghi sổ |
| Quyết định `DEMO-LIEN-KET-AN` | Khen thưởng đã ghi nhận, liên kết `DEMO-READY` | `records.demo` chọn Bộ môn KTPM, mở chi tiết và tệp quyết định |

**Khen thưởng:** có Chiến sĩ thi đua cơ sở/cấp Bộ, Bằng khen và Tập thể lao động xuất sắc; nhiều năm, chủ thể và trạng thái nháp/ghi nhận/thu hồi. Đây là bản ghi mô phỏng, không khẳng định người trong hồ sơ thật đã nhận các danh hiệu đó. PDF quyết định là tệp mẫu chung, không phải một quyết định cá nhân hóa có chữ ký/con dấu.

## Ba kết quả phân tích của An

Chọn riêng ba mục dưới đây; bỏ các tiêu chí SCN cũ. Giữ ngày phân tích trong hiệu lực phiên bản 2026-demo.

| Tiêu chí | Dữ liệu tính được | Kết quả thẻ tiêu chí |
|---|---|---|
| `DEMO-CO-BAN` | 3 giáo trình đã xác nhận, yêu cầu 2 | **Đạt** |
| `DEMO-NANG-CAO` | 3 giáo trình đã xác nhận, yêu cầu 5 | **Chưa đạt** |
| `DEMO-CAN-BO-SUNG` | Có hồ sơ nghiên cứu chưa hoàn thiện/đang xử lý | **Chưa thể kết luận** |

Bấm **Kiểm tra & phân tích bằng AI** thực hiện đối chiếu trên DB thật, sau đó gọi AI giải thích. Ngày 12/11 đã kiểm tra cả ba lời giải thích từ **Groq / openai/gpt-oss-20b**, `isMock=false`, mỗi kết quả có nguồn trích dẫn được kiểm chứng. Chi tiết ở [RICH_DEMO_BROWSER.json](testing/RICH_DEMO_BROWSER.json).

Nếu chọn cả ba mục thì dòng tổng hợp vẫn yêu cầu rà soát một tiêu chí; đó là kết quả đúng. Việc đạt một ngưỡng không đồng nghĩa được trao thưởng. Thông tin tổng thể của phiên đối chiếu xác định cũng không được dùng để giả danh một lượt gọi AI thật; phần AI giải thích có thông tin provider riêng.

## Kho quy định: thực tế và mô phỏng

Kho có metadata nguồn tham khảo từ [Luật 06/2022/QH15](https://vanban.chinhphu.vn/?docid=206170&pageid=27160), [Nghị định 98/2023/NĐ-CP](https://chinhphu.vn/?classid=1&docid=209421&orggroupid=2&pageid=27160), [Thông tư 01/2024/TT-BNV](https://vanban.chinhphu.vn/?classid=1&docid=209795&pageid=27160) và [Nghị định 152/2025/NĐ-CP](https://congbao.chinhphu.vn/tai-ve-van-ban-so-152-2025-nd-cp-45160-56921). Các mục này **chưa nhập toàn văn, chưa xác nhận hiệu lực/phạm vi áp dụng tại LHU và không dùng để tự động kết luận**. Chưa phải kho pháp lý đầy đủ để vận hành thật.

Bộ `DEMO-QUY-CHE-NOI-BO` có bản cũ hết kỳ và bản kế tiếp, trích đoạn, tiêu chí có cấu hình nguồn và một tiêu chí dự thảo. Bản đang dùng mô phỏng bước xác nhận bằng các trạng thái hiện có của ứng dụng, có `isOfficial=false` và ghi chú rõ **không phải chính sách LHU thật**. Không đưa bộ này sang DB vận hành. Nguồn SCN cũ vẫn giữ `SIMULATION_ONLY` để xem nhánh chặn xác nhận.

## CV và các phần bổ trợ

- An có CV mẫu modern, ba thành tích hợp lệ được chọn và link công khai. Các CV khác giữ bản nháp để so sánh trước/sau chia sẻ.
- Có giới thiệu, học vấn, chuyên môn, kỹ năng, chứng chỉ, kinh nghiệm và dự án. Nội dung bổ sung là ví dụ, không phải lý lịch thật.
- Xem trước mở từ nút trong trang chỉnh sửa, dùng bản đang soạn. Bản công khai chỉ đổi sau khi cập nhật công khai. Có thể ngừng chia sẻ và đổi link.
- CV hiện **không có chức năng AI tự viết CV** và không tự đưa mọi bản ghi khen thưởng lên CV. Điểm demo là người dùng chọn thành tích đã xác nhận từ hồ sơ của mình.
- Có lịch cá nhân và thông báo phát sinh từ workflow. Nguồn KPI ngoài vẫn là HTTP giả lập cục bộ `SIM-EMP-001`; email reset không bật gửi thật.

## Tạo lại, kiểm tra và khôi phục

Không seed thêm trước mỗi lần tập. Bộ mở rộng chỉ được nạp một lần, có chặn nạp trùng. Các lệnh từ thư mục gốc:

```powershell
# Chỉ khi đã khôi phục DB demo về trước bộ mở rộng, và backend demo đã dừng:
node --env-file=backend/.env.demo database/scripts/migrate.js up
node --env-file=backend/.env.demo scripts/demo/seed-rich-demo.mjs --apply

# Kiểm tra sau khi cả hai npm run demo đang chạy:
node --env-file=backend/.env.demo scripts/demo/verify-rich-demo.mjs
node scripts/demo/check-rich-ui.mjs --live
```

Lệnh kiểm tra UI `--live` gọi dịch vụ AI bên ngoài bằng tiêu chí/số liệu/trích đoạn giả lập; không gửi tên, email hoặc CV. Bỏ `--live` để chọn mock ngay trên giao diện. Hai script kiểm tra có phát sinh đăng nhập/lịch sử đánh giá; không chạy lại nếu chỉ muốn giữ nguyên số lượng.

Seed tự sao lưu trước khi thêm, dùng transaction và kiểm hash tệp trước commit. Các bảng liên quan được tạo qua service; không tắt kiểm quyền hoặc cơ chế kết luận. Nhật ký seed và ID nằm ở `output/rich-demo/manifest.json`; hồ sơ trình diễn ở `output/rich-demo/showcase.json`.

Để trở về đúng đầu buổi trình bày: dừng backend demo, chạy `npm run demo:reset -- -Apply` từ `backend`, rồi chạy lại `npm run demo`. Hướng dẫn đầy đủ ở [DEMO_RECORDING_SETUP.md](DEMO_RECORDING_SETUP.md). Bản gốc mới là `backups/rich-demo-baseline`; bản gốc SCN cũ vẫn còn ở `backups/video-demo-baseline`.

Kịch bản có lời thoại: [DEMO_9_PHUT.md](DEMO_9_PHUT.md).
