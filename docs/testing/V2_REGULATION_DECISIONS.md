# Quy chế và seed V2 — quyết định triển khai

Ngày chốt: 15/11/2026. Người dùng đã đồng ý các chính sách dưới đây trong chat triển khai. Tài liệu này bổ sung mục 11 của [mục tiêu](../requirements/GOAL_REGULATIONS_AND_SEED_V2.md), không tự xác nhận nghiệm thu.

- Thu hồi lời chia sẻ hoặc tắt công khai chỉ ngừng việc tiếp nhận mới. Phiên bản đã tiếp nhận vẫn xem được nguồn và dùng trong thời hạn đánh giá đã cấu hình; giữ lịch sử sau hết hạn.
- Đơn vị con không tự bỏ quy chế cấp trên phân phối. Quyền quản lý quy chế của đơn vị con không cấp quyền sửa bản gốc cấp trên.
- Mỗi bối cảnh cá nhân/tổ chức giữ một phiên bản cụ thể của mỗi quy chế. Một người có thể thấy nhiều bối cảnh với phiên bản khác nhau và chọn bối cảnh khám. Bối cảnh được lưu cùng ảnh chụp đầu vào kết quả.
- Mọi phiên bản mới đều cần tiếp nhận/cập nhật chủ động, kể cả quy chế nội bộ của tổ chức phát hành. Công bố không tự thay pin. Thông báo và cảnh báo trong kho giúp phát hiện bản mới.
- Công khai nghĩa là tìm kiếm được trong cộng đồng. Không thêm chế độ chỉ xem khi có liên kết.
- Một phiên bản có một file nguồn PDF hoặc DOCX, tối đa 10 MB. PDF không có lớp văn bản báo cần OCR/chép và kiểm tra thủ công; không tạo tiêu chí từ văn bản không đọc được.
- Các quyền tổ chức độc lập: `REGULATIONS_CREATE`, `REGULATIONS_MANAGE`, `REGULATIONS_PUBLISH`, `REGULATIONS_SHARE`, `REGULATIONS_ADOPT`, `REGULATIONS_UPDATE`. Các quyền đọc/chạy khám vẫn độc lập. Quyền riêng tư cá nhân không bị mở chỉ vì tài khoản khác có quyền quản trị hệ thống.
- Quyền toàn hệ thống `REGULATION_MANAGER` cho phép tạo/quản lý/công bố/chia sẻ quy chế tổ chức trên toàn hệ thống; không mở kho quy chế cá nhân của người khác. Quyết định tiếp nhận/cập nhật cho tổ chức vẫn cần quyền tại tổ chức đó; `SYSTEM_ADMIN` giữ quyền quản trị toàn hệ thống.
- Tiêu chí phân biệt `AUTOMATED`, `MANUAL`, `UNSUPPORTED`. Hai loại sau cho kết quả chưa đủ dữ liệu, không được mặc nhiên xem là đạt. Các nhánh cấu hình một phần phải được ghi rõ trong thông tin bao phủ của phiên bản.

## Quy ước lưu trữ

Giữ nguyên `STORAGE_DIR` hiện hữu là thư mục minh chứng. File nguồn nằm trong thư mục `regulations` cùng cấp thư mục đó. Mặc định: `backend/storage/private/evidences` và `backend/storage/private/regulations`. Không mở static hai thư mục. Backup v3 ghi tên không gian `evidences/` và `regulations/`, cùng hash và phiên bản nguồn; xem [hướng dẫn backup](V2_STORAGE_BACKUP.md).

## Nguồn và thời gian demo

Mốc nghiệp vụ demo: 15/11/2026; các ca lịch sử dùng ngày đánh giá ghi riêng, không kéo dài hiệu lực bằng ngày tiếp nhận. Bộ dữ liệu giả lập phải có nhãn DỮ LIỆU DEMO. Cơ quan ban hành tài liệu và tổ chức quản lý cấu hình trong ứng dụng là hai thông tin khác nhau.

Danh mục nguồn thật: [source-register.json](../../database/sqlserver/v2/sources/source-register.json). Thông tư 08/2021 có file đính chính riêng và đã được 56/2026 thay thế từ 07/07/2026; phiên bản demo lịch sử mới giới hạn đến 06/07/2026, không sửa phiên bản/lịch sử đã công bố. Bản 56/2026 được giữ trong danh mục nghiên cứu vì nguyên gốc vượt 10 MB, không nhập lách giới hạn file. Quyết định UEH năm 2025 là nguồn lịch sử, chỉ cấu hình một nhánh thay thế kỹ năng; không nhận là quy chế hiện hành năm 2026 hoặc toàn bộ danh hiệu.

## Bằng chứng đang tích lũy

- Kiểm thử nền trước thay đổi: 15/15 đạt.
- Migration 003/004 đã áp dụng trên SQL Server local. Kiểm thử mô hình phân phối và ràng buộc: 6/6 đạt.
- Kiểm thử HTTP mới: 6/6 đạt, sử dụng SQL Server thật và rollback dữ liệu kiểm thử; gồm riêng tư/file, kiểm tra nguồn, nội bộ, chia sẻ, phiên bản/thông báo, công khai/hiệu lực.
- Trích xuất nguồn: 5/5 kiểm thử đạt với PDF/DOCX thật trong fixture; AI giả lập chỉ dùng kiểm tra hợp đồng/căn cứ, không phải bằng chứng provider trực tuyến.
- Backup: kiểm thử tệp thật + fixture metadata; chưa nhận đây là bằng chứng backup/restore SQL Server engine thực tế.

Các mục trên là kết quả tại thời điểm chạy; báo cáo nghiệm thu cuối cần cập nhật sau toàn bộ hồi quy, seed và trình duyệt.

Kết quả kiểm tra mới và trạng thái nghiệm thu đầy đủ được tập hợp tại [báo cáo nghiệm thu](V2_REGULATIONS_AND_SEED_ACCEPTANCE.md); các con số trên là mốc trong quá trình triển khai.
