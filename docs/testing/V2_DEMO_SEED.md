# Bộ demo quy chế và hành trình hồ sơ V2

> Tài liệu lịch sử. Bộ seed demo V2 và các lệnh dưới đây đã được gỡ khỏi dự án.

Mốc đánh giá demo là **15/11/2026**. Namespace dữ liệu là `DEMO-V2-20261115`; toàn bộ 24 tài khoản, tổ chức và thành tích là giả lập, không phải hồ sơ người thật. File minh chứng và nguồn quy chế tự đặt có dòng **DỮ LIỆU DEMO**. Bốn PDF chính thức giữ nguyên nội dung và cơ quan ban hành, được phân biệt với chủ thể quản lý bản cấu hình trong ứng dụng.

## Chạy và kiểm tra

Chạy từ thư mục gốc repository. Backend đọc kết nối SQL Server trong `backend/.env`; tham số `--database` bắt buộc và ghi đè riêng tên database cho tiến trình seed. Script xác nhận `DB_NAME()` trước khi làm việc. Script không chạy từ luồng khởi động ứng dụng, không tạo/xóa database và không dùng PostgreSQL.

```powershell
# Xem kế hoạch; không kết nối DB, không tạo tệp.
node scripts/seed-v2-demo.mjs --database=PTUD_LHU

# Thử toàn bộ trên SQL Server thật trong một transaction rồi rollback.
# Các file fixture tạo tạm được xóa sau kiểm tra.
node scripts/seed-v2-demo.mjs --database=PTUD_LHU --validate

# Ghi bộ demo vào đúng database đã chọn.
node scripts/seed-v2-demo.mjs --database=PTUD_LHU --apply

# Kiểm tra dữ liệu đã ghi, hash/tính đọc được của file và kết quả mong đợi.
node scripts/seed-v2-demo.mjs --database=PTUD_LHU --verify
```

Áp dụng migration V2 hiện hành trước seed. Backend có lệnh `npm run migrate` trong thư mục `backend`. Tên `PTUD_LHU` ở ví dụ là lựa chọn cụ thể của môi trường local; thay bằng database demo được chỉ định khi triển khai nơi khác. Chỉ dùng `--apply` khi muốn ghi dữ liệu demo vào database đó.

Lần chạy thành công lưu manifest trong `app.audit_events` với action `V2_DEMO_SEEDED`, entity `DEMO_FIXTURE`, entity ID bằng namespace. Có bản sao tiện tra cứu tại `backend/storage/demo-v2/<database>.manifest.json`. Audit trong DB là bản ghi gốc để chạy lại, không phụ thuộc bản sao trên ổ đĩa. Chạy `--apply` lần nữa chỉ xác minh bộ hiện có, không thêm tài khoản, thành tích hay file, trừ nâng cấp bổ sung có số revision rõ ràng. Nếu email demo đã tồn tại mà không có manifest tương ứng, script dừng; không cập nhật tài khoản đó.

**Revision 2** bổ sung một minh chứng PNG và một minh chứng PDF có nhãn DỮ LIỆU DEMO vào thành tích bổ sung của `sv-gap`; tạo thêm ba lịch sử ghi nguyên bối cảnh tiếp nhận (`adoption_id`, `context_type`, `organization_id`, `member_organization_id`). `multi` có một lần khám theo kho cá nhân v2 và một lần theo tổ chức v1; `sv-gap` có một lần khám sau bổ sung theo bối cảnh Trường. Mười lịch sử cũ giữ nguyên. Khi nâng từ revision 1, script ghi audit `V2_DEMO_UPGRADED` với manifest revision 2; các lần sau không lặp lại nâng cấp. Seed mới tạo thẳng revision 2 và mọi lịch sử mới đều lưu bối cảnh.

Tạo/kiểm tra PNG và PDF dùng Python với `reportlab`, `pillow`, `pypdf`; có thể chỉ định executable bằng `V2_DEMO_PYTHON` và font Unicode TrueType bằng `V2_DEMO_FONT`. Script ưu tiên executable đã chỉ định, runtime Codex có sẵn rồi Python trong PATH. Font mặc định là Arial trên Windows hoặc DejaVu Sans trên Linux. PDF được tạo chuẩn với font Unicode nhúng, kiểm tra bằng pypdf; ảnh được giải mã thực bằng Pillow. Thiếu dependency sẽ dừng và rollback, không bỏ qua fixture.

**Revision 3** bổ sung nguồn cấp Trường: PDF niên giám sinh viên 2025 của Trường Đại học Lạc Hồng, giữ nguyên cơ quan ban hành; Trường demo chỉ quản lý cấu hình. Bản này có phạm vi tham khảo lịch sử 01/01–31/12/2025, không khẳng định ngày hiệu lực pháp lý của niên giám hoặc quy định hiện hành. Không có tiêu chí tự động: một tiêu chí `UNSUPPORTED`, hướng dẫn đối chiếu thủ công, kho cá nhân của `multi` ghim rõ phiên bản và có một lần khám lịch sử `INSUFFICIENT_DATA` ngày 01/11/2025. Lưu PDF riêng tư, SHA256/URL và văn bản trích xuất nếu đọc được; lỗi trích xuất được ghi trung thực để yêu cầu OCR/đọc thủ công. Nâng cấp chỉ thêm dữ liệu và audit `V2_DEMO_UPGRADED`, giữ nguyên 13 lịch sử cũ. Seed mới và seed nâng cấp đều kết thúc ở revision 3; cleanup/reactivate bao gồm quy chế mới qua manifest.

**Revision 4 — kiểm toán hiệu lực nguồn:** Thông tư 08/2021 đã được thay thế từ **07/07/2026** bởi Thông tư 56/2026/TT-BGDĐT. Seed thêm phiên bản tham chiếu lịch sử có khoảng 03/05/2021–**06/07/2026**, giữ nguyên mọi phiên bản/file nguồn/lịch sử cũ. Thao tác nâng seed chủ động đổi pin cá nhân demo của `multi` sang bản lịch sử mới, tắt công khai tài liệu cũ, ghi rõ ngày thay thế trong tên/mô tả và thêm lần khám lịch sử ngày **15/11/2025** (`INSUFFICIENT_DATA`). Lưu SHA256 tổng hợp phiên bản/nguồn/tiêu chí cũ và mọi lần khám có trong manifest trước nâng cấp để kiểm tra tính bất biến. Seed mới cũng dùng ngày lịch sử, không tạo lần khám hiện tại cho nguồn đã bị thay thế. Revision hiện hành là **4**.

Nguồn thay thế được xác minh ở [Cổng Chính phủ](https://chinhphu.vn/?classid=1&docid=219044&orggroupid=4&pageid=27160), đối chiếu Điều 2 trang 1 của [bản PDF Thông tư 56/2026](https://ttgdtc.vnu.edu.vn/wp-content/uploads/2026/03/56_2026_TT_BGDDT.pdf). Bản ký nguyên gốc **11.394.397 byte** vượt giới hạn **10 MB** đã chốt: chỉ giữ trong danh mục nghiên cứu với `importToPrivateStorage: false`, không nhập kho nguồn ứng dụng, không sửa/nén văn bản ký để lách giới hạn, không tự động hóa quy định mới. Provenance của bản 08 lịch sử giữ cả đính chính 2024 và metadata/URL văn bản thay thế.

Mật khẩu mặc định của **tất cả tài khoản demo** là `Demo-V2-2026!`. Có thể đặt biến `V2_DEMO_PASSWORD` trước lần seed đầu; không ghi mật khẩu vào manifest. Chạy lại không đổi mật khẩu.

## Tài khoản và phạm vi

Địa chỉ đăng nhập là `<tên>@demo-v2.example.test`.

| Tên | Mục đích |
|---|---|
| `admin` | Quản trị hệ thống; vẫn không đọc quy chế cá nhân của tài khoản khác |
| `reg-manager` | Quản lý quy chế tổ chức toàn hệ thống |
| `school-manager` | Quản lý Trường, quyền cây con, tạo/công bố/chia sẻ/tiếp nhận/cập nhật |
| `faculty-a`, `faculty-b`, `faculty-c` | Quản lý riêng từng Khoa và cây con |
| `viewer` | Xem thành viên/kết quả Trường, không chạy khám |
| `runner` | Chạy/xem khám Trường, không quản lý quy chế |
| `sv-complete` | Đủ hồ sơ, có CV công khai, có thành tích trong thùng rác |
| `sv-gap` | Thiếu đúng hai giờ, KPI từ phần thiếu, bổ sung thành tích, khám lại đạt; CV riêng tư |
| `sv-unknown` | Thiếu thuộc tính số giờ cần đối chiếu |
| `sv-time` | Hoạt động nằm ngoài khoảng xét |
| `sv-excluded` | Đủ định lượng nhưng có điều kiện loại trừ |
| `sv-empty` | Không có thành tích, kiểm tra hướng dẫn hồ sơ rỗng |
| `lecturer` | Giảng viên, không thuộc đối tượng quy chế sinh viên |
| `staff` | Nhân viên Khoa C |
| `outsider` | Không có tổ chức; chủ quy chế cá nhân, tự thêm quy chế công khai |
| `multi` | Thành viên hai tổ chức; nhận cùng quy chế công khai theo hai phiên bản/bối cảnh; hai khóa kỹ năng giả lập cho ví dụ nguồn UEH |
| `former` | Đã kết thúc thành viên Khoa A |
| `invitee` | Lời mời chưa chấp nhận, chưa có thành viên |
| `other-school` | Thành viên Trường khác; chia sẻ đích danh đã từ chối |
| `union-manager` | Quản lý Đoàn/Hội độc lập; chia sẻ đã tiếp nhận |
| `group-member` | Nhóm độc lập; chia sẻ đang chờ, không được thừa hưởng |
| `expired` | Còn thành viên nhưng quyền xem/chạy khám đã hết hạn |

Có 14 tổ chức: một Trường với ba Khoa, mỗi Khoa hai Lớp; một Trường khác, một Đoàn/Hội độc lập, một nhóm độc lập và một nhóm ngoài để minh họa thu hồi chia sẻ. Phần lớn tài khoản có 3–8 thành tích; hồ sơ rỗng được giữ có chủ đích. Mọi loại thành tích đều có thuộc tính `category`; gồm hoạt động, ngoại ngữ, nghiên cứu, giải thưởng và chứng nhận chuyên môn; đa dạng năm, có thiếu thuộc tính, không có minh chứng và thùng rác.

## Quy chế, phiên bản và kết quả mong đợi

Quy chế tự đặt dùng tiêu chí: ít nhất hai hoạt động trong năm 2026, tổng ít nhất mười giờ hoạt động trong năm 2026 và không có thành tích loại kỷ luật. Đây là quy tắc minh họa, không phải quy định thật của bất kỳ trường nào.

| Tình huống | Kết quả mong đợi |
|---|---|
| `sv-complete` khám `school_v1` ngày 15/11/2026 | `MET`; bản trong thùng rác không được tính |
| `sv-gap` trước bổ sung | `NOT_MET`; thiếu đúng 2 giờ ở tiêu chí `HOURS` |
| `sv-gap` sau bổ sung ngày 12/11/2026 | `MET`; lịch sử trước bổ sung giữ `NOT_MET`, hiện cảnh báo dữ liệu đổi |
| `sv-unknown` | `INSUFFICIENT_DATA` do thiếu `hours` |
| `sv-time` | `NOT_MET`; hoạt động năm 2024 không được tính trong năm 2026 |
| `sv-excluded` | `NOT_MET` dù hai tiêu chí định lượng đạt |
| `sv-empty` | `NOT_MET`; danh sách thành tích rỗng |
| `lecturer` | `NOT_APPLICABLE` |
| Tài khoản khác biết ID nguồn/quy chế `personal` | Không đọc được; kể cả `admin` |
| Thành viên Khoa/Lớp dưới Trường | Thừa hưởng đúng pin `school_v1` |
| Trường đã có `school_v2` | Pin tổ chức vẫn là v1, có thông báo phiên bản mới |
| Khoa B đọc `faculty_a` | Không đọc được |
| Chia sẻ tới nhóm độc lập còn chờ | Không phân phối tới `group-member` |
| Chia sẻ tới Đoàn/Hội đã chấp nhận | Phân phối tới `union-manager` |
| Chia sẻ tới Trường khác đã từ chối | Không phân phối |
| `multi` thêm công khai v2 riêng | Không làm đổi pin v1 của Trường khác; giữ hai bối cảnh |
| `former` / `invitee` | Không thừa hưởng quy chế Trường |
| `viewer` / `expired` chạy khám tổ chức | Bị từ chối theo quyền |
| `draft` / `future` / `expired` | Có dữ liệu nháp, hiệu lực 2027 và hiệu lực 2025 để kiểm tra chặn ngoài khoảng ngày |
| `multi`, nguồn LHU 2025, ngày 01/11/2025 | `INSUFFICIENT_DATA`; tham khảo lịch sử, cần đọc/đối chiếu thủ công, không tự công nhận đủ điều kiện |

Danh sách ID cụ thể, phiên bản, file, KPI và kết quả nằm trong manifest. Không dùng ID cứng giữa các database.

## Nguồn chính thức và giới hạn tự động hóa

Danh mục gốc: `database/sqlserver/sources/source-register.json`. Registry ghi URL gốc, thời điểm thu thập, SHA256, dung lượng, cơ quan ban hành, tình trạng nguồn và phần đã cấu hình. Seed xác nhận hash trước khi sao chép file vào kho riêng tư.

| Nguồn | Cấu hình và giới hạn |
|---|---|
| Thông tư 08/2021/TT-BGDĐT, Bộ GDĐT | **Nguồn lịch sử đã bị thay thế từ 07/07/2026**; bản tham chiếu mới chỉ dùng đến 06/07/2026, không công khai tìm kiếm. Tiêu chí `UNSUPPORTED`, ngày khám demo 15/11/2025 cho `INSUFFICIENT_DATA`. PDF scan chưa có trích xuất tin cậy được ghi `FAILED`. Không dùng bản này để tự động xét tốt nghiệp hoặc kết luận quy định hiện hành. |
| Đính chính Thông tư 08 năm 2024 | File gốc lưu ở một phiên bản nháp tham chiếu trong cùng quy chế, có liên kết provenance từ nguồn chính; không coi là quy chế mới độc lập. |
| Đề án SV5T UEH năm 2025 | Chỉ nhánh thay thế hai khóa kỹ năng ở I.5.2; kèm điều kiện đào tạo trực tuyến ở Phụ lục IV và nhóm kỹ năng Phụ lục V. Bộ lọc yêu cầu hoàn thành, nhà cung cấp uy tín, tương tác trực tiếp, đánh giá tham gia. Khoảng thành tích 01/11/2024–01/11/2025; khám lịch sử ngày 01/11/2025. Hai khóa của `multi` là **giả lập**, cho kết quả `MET` của riêng nhánh. Không kết luận toàn bộ I.5.2 hay danh hiệu SV5T. |
| Niên giám sinh viên 2025, Trường Đại học Lạc Hồng | Nguồn chính thức cấp Trường, PDF 5.402.286 byte, SHA256 `64b8951b7243b5b67068e4ad116b64615958054a806166f559860c3e867c8ad7`. Chỉ tham khảo lịch sử 2025; tiêu chí `UNSUPPORTED`, không xét tự động. `multi` có kết quả `INSUFFICIENT_DATA` ngày 01/11/2025. Cần đối chiếu khóa/ngành, quy định hiện hành và sửa đổi trước khi sử dụng nghiệp vụ. |
| Thông tư 56/2026/TT-BGDĐT | Thay thế 08/2021 từ 07/07/2026; nguồn nghiên cứu đã xác minh. PDF vượt 10 MB, không nhập vào kho ứng dụng và chưa cấu hình tiêu chí. |

Khoảng áp dụng cấu hình UEH là 14/03/2025–01/11/2025, phục vụ minh họa lịch sử; ngày kết thúc không được diễn giải là ngày văn bản mất hiệu lực pháp lý. Nguồn UEH2022 trả HTTP 404 tại lúc thu thập nên không được nhập. Chủ thể quản lý các bản cấu hình là Trường demo; trường demo không được gán làm cơ quan ban hành văn bản gốc.

## Hành trình demo

Đăng nhập `sv-gap`, mở quy chế Trường đang áp dụng v1, xem lần khám `initial` còn thiếu hai giờ. KPI “Bổ sung hai giờ hoạt động” liên kết chính xác với kết quả thiếu của tài khoản này, có việc con và tiến độ. Thành tích bổ sung kèm DOCX minh chứng demo đã được thêm; lần khám `after-supplement` đạt. Lịch sử đầu giữ nguyên snapshot và báo hồ sơ đã đổi. CV riêng tư chọn một tập thành tích, không xuất toàn bộ kho. `sv-complete` có CV công khai để so sánh phạm vi.

Khi chạy khám lại thủ công, chọn ngày **2026-11-15**. Với ví dụ UEH chọn **2025-11-01**. Quyền thành viên hiện tại và trạng thái tài khoản được kiểm tra theo giờ máy chủ; mốc hiệu lực thành tích/phiên bản dùng ngày đánh giá. Mục tiêu tự đặt của `sv-complete` có hạn 01/10/2026 để minh họa quá hạn ở mốc demo.

## Dọn riêng bộ demo và sao lưu

```powershell
# Ẩn/ngừng hoạt động toàn bộ bộ demo đã đăng ký, giữ lịch sử bất biến.
node scripts/seed-v2-demo.mjs --database=PTUD_LHU --cleanup

# Mở lại đúng tài khoản/tổ chức/phạm vi công khai đã seed.
node scripts/seed-v2-demo.mjs --database=PTUD_LHU --reactivate
```

Cleanup là **vô hiệu hóa có phạm vi**: xác minh ID/email theo manifest, tắt tài khoản demo, lưu trữ tổ chức có đúng namespace, tắt công khai quy chế demo và chuyển CV demo sang riêng tư. Không xóa phiên bản đã công bố, kết quả khám hoặc file đang được lịch sử tham chiếu; không tắt trigger, không xóa dữ liệu ngoài demo. Sau cleanup dùng `--reactivate` trước `--verify`; `--apply` không tự làm sống lại tài khoản đã dọn. Muốn loại bỏ vật lý toàn bộ dữ liệu thử, dùng database demo riêng và quy trình quản trị database đã được cho phép.

Sao lưu cần bao gồm database, manifest và cả hai kho file private (`evidences`, `regulations`). Giữ nguyên storage key khi khôi phục; chạy `--verify` sau khôi phục để phát hiện mất file hoặc sai hash.

## Bằng chứng kiểm tra

Ngày 15/11/2026: chạy `--validate` trên SQL Server thật, database `PTUD_LHU`, **123 kiểm tra đạt**, gồm 10 lịch sử khám, liên kết KPI từ phần thiếu, snapshot trước/sau, quyền phân phối, file DOCX có nhãn đọc được, SHA256 3 PDF chính thức và ngày hiệu lực. Toàn bộ dữ liệu của lần validation rollback, 38 file fixture tạm đã xóa.

Sau đó đã chạy **`--apply` bền vững**, **`--verify` độc lập** và **`--apply` lần hai** trên cùng SQL Server/database. Cả ba thành công; lần hai trả `already_seeded: true`, 123 kiểm tra vẫn đạt. Số lượng giữ nguyên trước/sau chạy lại:

| Đối tượng | Số lượng trong namespace demo |
|---|---:|
| Tài khoản | 24 |
| Tổ chức | 14 |
| Quy chế | 8 |
| Phiên bản / file nguồn | 13 / 13 |
| Thành tích | 86 |
| File minh chứng | 25 |
| Lịch sử khám | 10 |
| KPI | 2 |
| CV | 2 |

Có tổng 38 file private thật, gồm 35 DOCX demo và 3 PDF chính thức. Đây là bằng chứng SQL Server thật và chạy seed không nhân đôi, không phải database giả lập. Kiểm thử UI/API là bằng chứng riêng; không suy ra kết quả UI/API chỉ từ script seed.

Sau nâng cấp revision 2 trên cùng `PTUD_LHU`: `--validate` rollback đạt, `--apply` đạt, `--verify` độc lập đạt **136 kiểm tra**; chạy `--apply` lần nữa vẫn đạt cùng số lượng. Hiện có **27 file minh chứng**, **13 lịch sử khám**, tổng **40 file private** (35 DOCX demo, 3 PDF chính thức, 1 PDF minh chứng demo, 1 PNG minh chứng demo). Các số lượng tài khoản, tổ chức, quy chế, phiên bản, thành tích, KPI và CV giữ nguyên. PNG giải mã đủ 1400×900; PDF đọc được một trang và có nhãn Unicode trong nội dung. Đã render PDF bằng Poppler và quan sát cả trang PDF/ảnh PNG: chữ tiếng Việt đủ dấu, không cắt chữ, nhãn demo rõ ràng, không có chữ ký/con dấu giả lập.

Ngày 16/11/2026, revision 3 trên cùng SQL Server `PTUD_LHU`: `--validate` rollback và `--apply` bền vững đạt **148 kiểm tra**. Nguồn PDF LHU mở được bằng pypdf, hash khớp registry; URL chính thức trả HEAD **200**, `application/pdf`, đúng **5.402.286 byte**. Trích xuất và lưu **1.433.390 ký tự** với trạng thái `EXTRACTED`; cảnh báo font của pdfjs không được coi là lỗi hoặc bằng chứng mất lớp văn bản. Có **24 tài khoản, 14 tổ chức, 9 quy chế, 14 phiên bản/14 file nguồn, 86 thành tích, 27 file minh chứng, 14 lịch sử khám, 2 KPI, 2 CV**, tổng **41 file private**. Phiên bản nguồn LHU và lần khám lịch sử mới được lưu trong manifest; không dùng ID cố định để tra cứu.

Đã chạy `--cleanup` **hai lần** rồi `--reactivate` **hai lần**, đối chiếu trạng thái/phạm vi hiển thị trước/sau của toàn bộ tài khoản, tổ chức, quy chế và CV: dữ liệu demo trở lại đúng giá trị ban đầu, toàn bộ giá trị của dữ liệu ngoài demo giữ nguyên. SHA256 tổng hợp **mọi** `assessment_runs.input_snapshot_json` giữ nguyên qua chu kỳ; không xóa hay ghi lại lịch sử. Quy chế mới được dọn/mở lại theo manifest, không bỏ sót do nâng revision.

Sau khi mở lại, `--verify` độc lập đạt **148 kiểm tra**; `--apply` lần nữa trả `already_seeded: true`, revision **3**, vẫn **148 kiểm tra**, toàn bộ số lượng giữ nguyên. Database được để ở trạng thái demo hoạt động đúng phạm vi trước chu kỳ cleanup.

Revision 4 ngày 16/11/2026: validation rollback và apply nâng cấp đạt **161 kiểm tra**, sau bổ sung hai kiểm tra quyền pin, apply lại và verify độc lập đạt **163 kiểm tra**. Pin cá nhân `multi` chỉ dùng được phiên bản lịch sử mới, không dùng lại được pin phiên bản cũ; nguồn/văn bản/tiêu chí đã công bố và mọi lịch sử có trước nâng cấp giữ đúng SHA256 đã ghi trong manifest. PDF thay thế quá 10 MB không có trong source rows của tài khoản demo.

Manifest revision 4 quản lý đúng **24 tài khoản, 14 tổ chức, 9 quy chế, 15 phiên bản/15 file nguồn, 86 thành tích, 27 minh chứng, 15 lịch sử khám, 2 KPI và 2 CV**. Tổng **42 file private**, gồm 5 bản lưu PDF chính thức của 4 tài liệu gốc khác nhau (bản 08/2021 được lưu thêm cho phiên bản lịch sử mới). Bộ đếm SQL theo chủ tài khoản demo có thể lớn hơn manifest khi kiểm thử UI tạo thêm nháp/file bằng tài khoản này; seed không nhận sở hữu hay xóa những bản ngoài manifest. Tại lần apply lại và verify cuối của revision 4, SQL cùng trả 17 phiên bản/16 file nguồn; manifest vẫn đúng 15/15, không sinh bản nâng cấp trùng.
