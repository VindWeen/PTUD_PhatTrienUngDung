# Sổ nguồn nghiệp vụ W1-P4

Ngày chốt trạng thái: **01/10/2026**. Bảng máy đọc được nằm tại [06_Nguon.csv](./06_Nguon.csv). Repo không có workbook/sheet `06_Nguon` sẵn, vì vậy CSV này là bản tương thích để nhập thẳng vào sheet `06_Nguon` mà không tạo hoặc sửa nhầm workbook của thành viên khác.

## Kết luận áp dụng tại ngày chuyển tiếp

- Luật 06/2022/QH15 có hiệu lực từ 01/01/2024 và phải được đọc cùng Luật sửa đổi 06/2026/QH16 từ **01/10/2026**.
- Với hồ sơ đã được cơ quan có thẩm quyền tiếp nhận để thẩm định trước 01/10/2026, tiếp tục xử lý theo Luật 06/2022/QH15; nếu quy định sửa đổi có lợi hơn cho chủ thể thì áp dụng quy định mới. Trường hợp nhiệm vụ khoa học thuộc Điều 4 Luật 06/2026/QH16 phải giữ dấu thời gian và căn cứ chuyển tiếp, không tính lại âm thầm.
- Nghị định 98/2023/NĐ-CP đã hết hiệu lực từ 01/07/2025; căn cứ hiện hành là Nghị định 152/2025/NĐ-CP.
- Thông tư 01/2024/TT-BNV đã được thay thế từ 05/08/2025; căn cứ hiện hành là Thông tư 15/2025/TT-BNV.
- Trong ngành Giáo dục, Thông tư 07/2026/TT-BGDĐT có hiệu lực từ 02/04/2026. Thông tư 29/2023/TT-BGDĐT chỉ còn dùng cho hồ sơ đã gửi Bộ GDĐT trước ngày đó.
- Chưa có bản quy chế thi đua/khen thưởng nội bộ LHU dành cho cán bộ, giảng viên, nhân viên trong nguồn dự án. Vì vậy chưa được cấu hình tiêu chí xét thưởng thật.

## Phân tầng nguồn

| Nhãn | Ý nghĩa | Cách dùng |
|---|---|---|
| `OFFICIAL_PRIMARY` | Văn bản gốc/cơ sở dữ liệu pháp luật chính thức | Có thể làm căn cứ pháp lý trong đúng phạm vi và thời gian hiệu lực |
| `OFFICIAL_HISTORICAL` | Văn bản chính thức đã hết hiệu lực/bị thay thế | Chỉ dùng cho lịch sử hoặc trường hợp chuyển tiếp được nêu rõ |
| `LHU_PUBLIC_SUPPORTING` | Trang/văn bản công khai của LHU nhưng chưa đủ để tạo bộ tiêu chí | Dùng truy vết và chuẩn bị xác nhận nghiệp vụ |
| `LHU_INTERNAL_REQUIRED` | Quy chế nội bộ cần xin nhưng chưa có | Chặn tích hợp rule thật |
| `EXCLUDED_WRONG_AUDIENCE` | Nguồn đúng nhưng sai đối tượng | Không được dùng cho giảng viên |
| `DRAFT_NON_AUTHORITATIVE` | Dự thảo/chưa có hiệu lực | Chỉ theo dõi, không dùng ra quyết định |

## Quy tắc dùng dữ liệu cho AI/KPI

1. Mọi gợi ý KPI demo phải mang nhãn `MÔ PHỎNG – KHÔNG PHẢI TIÊU CHÍ XÉT THƯỞNG` ở dữ liệu và giao diện.
2. Hệ thống không tự suy ra điều kiện được thưởng từ bài tin, dashboard, dữ liệu sinh viên hay văn bản hết hiệu lực.
3. Kết quả AI chỉ là gợi ý chuẩn bị hồ sơ; backend và người có thẩm quyền kiểm tra nguồn, phiên bản, phạm vi, trạng thái và bằng chứng.
4. Mỗi rule thật phải lưu tối thiểu `SourceId`, số/ký hiệu, ngày hiệu lực, phiên bản/phụ lục và ngày kiểm tra.

## Nguồn kiểm tra

- Cổng TTĐT Chính phủ: [Luật 06/2022/QH15](https://vanban.chinhphu.vn/?classid=1&docid=206170&orggroupid=1&pageid=27160), [Luật 06/2026/QH16](https://vanban.chinhphu.vn/?classid=1&docid=218100&pageid=27160&typegroupid=3).
- CSDL quốc gia về VBPL: [Nghị định 152/2025/NĐ-CP](https://vbpl.vn/TW/Pages/vbpq-van-ban-goc.aspx?ItemID=178327), [Thông tư 15/2025/TT-BNV](https://vbpl.vn/TW/Pages/vbpq-thuoctinh.aspx?ItemID=180280&Keyword=), [Thông tư 07/2026/TT-BGDĐT](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187172).
- LHU: [Danh mục quy định KHCN](https://lhu.edu.vn/520/36255/Tong-hop-cac-Quy-dinh-Quy-che-ve-Khoa-hoc-va-Cong-nghe-Truong-Dai-hoc-Lac-Hong.html), [bài viết về thực tiễn công khai thi đua](https://tckt.lhu.edu.vn/118/46555/Kip-thoi-minh-bach-va-sang-tao-Chia-khoa-thuc-day-phong-trao-thi-dua-tai-Truong-Dai-hoc-Lac-Hong.html), [quy chế sinh viên bị loại khỏi phạm vi](https://lhu.edu.vn/Data/News/8/files/QUI_CHE_SV_LAC_HONG_85vux.pdf).

> Đây là sổ nguồn phục vụ phân tích sản phẩm, không phải ý kiến pháp lý. Trước khi vận hành phải được GVHD/đầu mối nghiệp vụ LHU xác nhận văn bản nội bộ và các mốc chuyển tiếp áp dụng cho hồ sơ của trường.
