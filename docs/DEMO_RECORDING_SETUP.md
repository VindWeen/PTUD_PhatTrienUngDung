# Môi trường demo và cách khôi phục

Cập nhật **12/11/2026**. Bộ demo mở rộng đã có sẵn trong `PTUD_LHU_Demo`; không cần seed lại trước mỗi lần dùng.

## Chạy

Terminal backend:

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend
npm run demo
```

Terminal frontend:

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\frontend
npm run demo
```

Mở **http://127.0.0.1:5175**. Nếu hai tiến trình đã chạy thì dùng lại, không chạy thêm ở cùng cổng.

| Thành phần | Demo | Bản thường |
|---|---|---|
| SQL Server DB | PTUD_LHU_Demo | PTUD_LHU |
| Frontend | 127.0.0.1:5175 | localhost:5173 |
| Backend | 5001 | 5000 |
| Nguồn KPI ngoài giả lập | 5011, tự chạy cùng backend demo | Theo cấu hình bản thường |
| Môi trường | backend/.env.demo | backend/.env |
| Tệp private | backend/storage/demo/... | Kho bản thường |

Launcher kiểm tên DB và đường dẫn storage trước khi chạy. SQL login demo không có quyền trên DB chính. Không mở file môi trường khi đang trình chiếu.

## Nội dung đã chuẩn bị

- **40 tài khoản, 18 đơn vị, 238 thành tích, 134 KPI, 69 đề nghị và 44 bản ghi khen thưởng**, dữ liệu mở rộng qua 2024–2026.
- **8 CV có nội dung**; An có bản công khai, các CV còn lại giữ nháp.
- Có 6 văn bản, 7 phiên bản và 6 tiêu chí. Nguồn pháp luật thật là metadata tham khảo chưa xác nhận áp dụng; tiêu chí thực hành có nhãn giả lập.
- **281 tham chiếu private** đã đối chiếu dung lượng và SHA-256. Backup lưu 282 tệp vì giữ thêm tệp cũ không được tham chiếu; không thiếu tệp đang dùng.
- Thành tích, đề nghị, xét duyệt và khen thưởng được tạo qua service nghiệp vụ. Các hồ sơ đã nộp có snapshot nguồn.
- `DEMO-MAIN`: An đang được Hội đồng xét; `DEMO-READY`: một hồ sơ khác đã được đề nghị và liên kết quyết định `DEMO-LIEN-KET-AN` đã ghi nhận.

Mật khẩu web chung **demo1234**, ngoại trừ tài khoản `locked.demo` cố ý bị khóa. Tài khoản chính: `an.nv`, `bich.tt`, `hoidong.truong`, `records.demo`, `duc.pm`. Đại diện: `cuong.lh`. Chuyên viên toàn trường: `thidua.truong`.

Xem [tài khoản đầy đủ](RICH_DEMO_ACCOUNTS.md), [dữ liệu và tình huống theo vai trò](RICH_DEMO_DATA.md), [kịch bản 9 phút có lời thoại](DEMO_9_PHUT.md).

## AI thật và chế độ dự phòng

Bản demo hiện đặt **DEMO_AI_MODE=live**. Khi khởi động, launcher đọc riêng URL/token AI pool từ cấu hình backend gốc **vào bộ nhớ**, không chép khóa sang file demo và không thay cấu hình DB chính. AI pool được kiểm tra thật ngày 12/11: Groq / openai/gpt-oss-20b, cả ba giải thích có trích dẫn nguồn. Kết nối này cần mạng và pool còn hoạt động.

Payload giải thích gồm tiêu chí, số liệu đánh giá và đoạn nguồn giả lập; không gồm tên, email hay CV. Việc kiểm tra AI thật bằng payload giả lập này đã được người dùng cho phép. Email reset vẫn không bật gửi thật; nguồn KPI ngoài vẫn là mock cục bộ.

Đối chiếu dữ liệu là bước xác định bằng quy tắc, tách khỏi AI diễn giải. Chọn ba tiêu chí `DEMO-CO-BAN`, `DEMO-NANG-CAO`, `DEMO-CAN-BO-SUNG` để xem lần lượt **Đạt / Chưa đạt / Chưa thể kết luận**. Các tiêu chí thực hành không phải chính sách thật của LHU; không chuyển chúng sang DB vận hành.

Nếu muốn tắt AI ngoài, dừng backend demo rồi từ thư mục gốc chạy:

```powershell
node scripts/demo/configure-demo-ai.mjs --mock
```

Sau đó chạy lại `npm run demo` ở backend. Muốn bật lại, dùng `--live`. Hai lệnh chỉ đổi cờ chế độ; không sao chép khóa. Hoặc chọn **Mô phỏng bằng câu trả lời mẫu** trong Tùy chọn kỹ thuật ở trang phân tích cho một lần chạy.

## Tập lại từ đầu

Bản gốc mới nằm ở **backups/rich-demo-baseline**, gồm SQL Server BAK COPY_ONLY/CHECKSUM, manifest SHA-256 và kho tệp private. Bản SCN trước đây vẫn giữ ở `backups/video-demo-baseline`; lệnh reset mặc định hiện dùng bản mới.

1. Dừng backend demo bằng Ctrl+C, đóng các truy vấn SSMS đang kết nối PTUD_LHU_Demo. Frontend có thể giữ chạy.
2. Tại thư mục backend:

```powershell
npm run demo:reset -- -Apply
```

3. Chạy lại `npm run demo` ở backend; đăng xuất/đăng nhập lại, hoặc dùng phiên trình duyệt mới.

Không có `-Apply` thì chỉ xem hướng dẫn. Script không tự kill kết nối. Nó chỉ restore DB demo cố định, kiểm hash backup/tệp, CHECKDB và số dòng từng bảng, rồi khôi phục tệp vào thư mục demo mới. Thư mục cũ giữ lại. Reset không phục hồi file môi trường chính và không thay chế độ AI đã chọn.

**Đã kiểm tra ngày 12/11:** khôi phục sang DB riêng `PTUD_LHU_Demo_RichRestoreTest` và khôi phục thực tế vào `PTUD_LHU_Demo` đều thành công; CHECKDB, số dòng và 282 tệp khớp. Bằng chứng reset lưu trong `reset_report.json` tại thư mục storage được tạo sau mỗi lần khôi phục.

## Kiểm chứng

- [40 kiểm tra API, quyền, dữ liệu, snapshot và CHECKDB](testing/RICH_DEMO_VERIFICATION.json).
- [Kiểm tra browser: đăng nhập, ba giải thích AI thật, CV xem trước và CV công khai không đăng nhập](testing/RICH_DEMO_BROWSER.json).
- Ảnh đối chiếu ở `output/rich-demo/screenshots`.
- Seed mở rộng: `scripts/demo/seed-rich-demo.mjs`. Có preview khi bỏ `--apply`, chỉ nhận DB/storage demo, tự backup trước và từ chối nạp trùng.
- Không gọi các script seed cũ trước buổi trình bày. Không dùng reset để giữ lại kết quả đã thao tác trong buổi demo; cần xuất/ghi lại trước nếu muốn lưu riêng.

Kịch bản dài cũ [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md) vẫn giữ làm tài liệu tra cứu chức năng; bài trình bày dưới 10 phút dùng [DEMO_9_PHUT.md](DEMO_9_PHUT.md).
