# Nghiệm thu quy chế và seed V2

Ngày kiểm tra: 16/11/2026. Môi trường: Express, Microsoft SQL Server local `PTUD_LHU`, Edge headless và frontend Vite. Các chính sách mục 11 đã được người dùng chấp thuận, ghi tại [quyết định triển khai](V2_REGULATION_DECISIONS.md).

## Đối chiếu mục tiêu

| Phạm vi trong tài liệu mục tiêu | Kết quả và bằng chứng |
|---|---|
| 3 — Sở hữu, riêng tư, nội bộ, chia sẻ, công khai | API thực thi quyền theo chủ sở hữu/cây thành viên, độc lập quyền xem và quyền dùng. Kiểm thử HTTP trên SQL Server gồm đoán ID/file, kho cá nhân kể cả admin, Khoa khác, pending/rejected/accepted/revoked và public chỉ xem trước tiếp nhận. Bốn cách phân phối đã thao tác qua trình duyệt: [UI](V2_REGULATION_UI.md). |
| 4 — Ghim phiên bản, thời hạn, lịch sử | Không tự thay pin khi công bố. Thông báo đến người có quyền ở đơn vị tiếp nhận hoặc cấp trên có quyền cây con. Snapshot lưu phiên bản, tiêu chí, hồ sơ và bối cảnh. API bản lịch sử #179 từ chối ngày 15/11/2026 (400), cho ngày 15/11/2025 (201); xem `final-http-bounded-date.log`. |
| 5 — Nhập thủ công và nguồn/AI | PDF/DOCX → trích xuất hoặc chép kiểm tra thủ công → đề xuất có trích dẫn → chọn/sửa → xác nhận người kiểm tra → công bố. AI không tự ghi tiêu chí/công bố. Có phân biệt AUTOMATED/MANUAL/UNSUPPORTED. Unit test kiểm tra nguồn, giới hạn, căn cứ và chia nhỏ yêu cầu; provider thật chạy thành công bằng văn bản giả lập, lưu `ai-live-test.json` (Groq/openai/gpt-oss-20b). |
| 6 — File riêng tư và toàn vẹn | Nguồn nằm cạnh kho minh chứng, không static public; tải lại kiểm quyền, dung lượng và SHA256; một PDF/DOCX ≤10 MB mỗi phiên bản. Schema/ràng buộc khóa nguồn đã công bố. Backup v3 chứa hai namespace và liên kết version; xem [backup/restore](V2_STORAGE_BACKUP.md) về bằng chứng và điều kiện vận hành. |
| 7 — Giao diện | Có bốn tab áp dụng/quản lý/cộng đồng/chia sẻ; chọn phiên bản và bối cảnh; phân biệt thêm cá nhân/áp dụng tổ chức/cập nhật. Desktop và mobile tối đã xem; mobile 390 px không tràn ngang. Khóa action khi đang xử lý. [Báo cáo UI](V2_REGULATION_UI.md). |
| 8 — Seed tái lập và nguồn thật | Revision 4: 24 tài khoản, 14 tổ chức, 9 quy chế, 86 thành tích, 27 minh chứng. Manifest gốc giữ 15 phiên bản/15 nguồn/15 lịch sử và các KPI/CV/lịch/thông báo liên kết. Apply lặp không nhân đôi; validate rollback; cleanup/reactivate theo manifest, giữ dữ liệu ngoài bộ demo. 163 kiểm tra ngữ nghĩa đạt. [Tài khoản, lệnh và kết quả mong đợi](V2_DEMO_SEED.md). |
| 8.6–8.7 — Ma trận và hành trình | Đạt/chưa đạt/chưa đủ dữ liệu/không áp dụng, thiếu định lượng, ngoài kỳ, loại trừ, rỗng, stale, quyền hết hạn và tách biệt tổ chức được kiểm tra bằng seed và SQL suite. [Hành trình thật](V2_JOURNEY.md): nguồn UEH gốc → khám thiếu → KPI → bổ sung → khám lại → CV, kết quả cũ giữ nguyên. |
| 10 — Giới hạn phạm vi V2 | Dữ liệu tự khai và kết quả đối chiếu không phải quyết định công nhận. Không đưa lại luồng xét duyệt thành tích cũ. Nguồn Nhà nước/Trường/Hội có issuer, URL, hash và phạm vi cấu hình; minh chứng giả lập có nhãn DỮ LIỆU DEMO. |

## Kiểm thử cuối

Log tại [output/regulations](../../output/regulations):

| Kiểm tra | Kết quả | Log |
|---|---|---|
| Backend unit | 21/21 | `final-backend-test.log` |
| Backup/file workflow (SQL/BAK fixture) | 4/4 | `final-backend-backup.log` |
| Backup/restore SQL Server engine thật, database cô lập | COPY_ONLY/CHECKSUM, VERIFYONLY, RESTORE, 36 table counts, 2 file/reference/hash và CHECKCONSTRAINTS/CHECKDB đạt | [rehearsal-report.json](../../output/storage-backup-rehearsal-20261116/rehearsal-report.json), [engine-audit.json](../../output/storage-backup-rehearsal-20261116/engine-audit.json), [hướng dẫn và phạm vi](V2_STORAGE_BACKUP.md) |
| SQL Server integration toàn bộ | 46/46 | `final-test-sqlserver.log` |
| Regulation HTTP integration sau sửa quyền global manager và cache theo request | 9/9, không cộng gộp thành một lần full suite mới | `final-regulations-api.log` |
| Frontend | 11/11, lint và production build đạt; UI agent chạy lại lint/build sau thay đổi cuối | `final-frontend-test.log`, `final-frontend-lint.log`, `final-frontend-build.log`, báo cáo UI |
| Schema SQL Server thật | 36 bảng nghiệp vụ, 85 FK, 95 CHECK, 16 trigger; 5 migration đã áp dụng, không vô hiệu ràng buộc | `final-v2-schema-verify.log` |
| Seed revision 4 | 163 kiểm tra đạt | `final-seed-v2-verify.log` |

## Dữ liệu kiểm thử giữ lại và giới hạn

- UI tạo thêm `UI-CHECK-20261116`, `UI-SYNTHETIC-SHARE-20261116` và tiếp nhận công khai trong các tài khoản demo. Đây là dữ liệu ngoài manifest; không được hiểu số bản ghi toàn database bằng số fixture.
- Một lần kiểm tra HTTP lịch sử chạy trước khi bọc transaction đã lưu run **141**. Giữ nguyên như dấu vết kiểm thử bổ sung, không tắt trigger để xóa kết quả hoàn tất. Lần chạy lại dùng outer transaction tạo run 142 rồi rollback; seed vẫn đạt. Log verifier hiện có 16 lịch sử liên quan thay vì 15 fixture.
- Thông tư 08/2021 được đánh dấu lịch sử, bản mới giới hạn hết 06/07/2026 vì đã được 56/2026 thay thế từ 07/07/2026. Giữ nguyên phiên bản/lịch sử cũ; không sửa ngược bản đã công bố. Bản ký 56/2026 vượt 10 MB nên chỉ lưu nghiên cứu, không nhập kho hay tự động hóa. UEH chỉ cấu hình nhánh hai khóa kỹ năng năm 2025; niên giám LHU là tham khảo thủ công. Xem [danh mục nguồn](../../database/sqlserver/sources/source-register.json).
- AI là đề xuất cần người kiểm tra; PDF scan cần OCR/chép thủ công. Live smoke thành công không bảo đảm mọi lần gọi provider hoặc mọi văn bản đều phân tích được. Không tự kết luận đã bao phủ toàn bộ văn bản.
- Kiểm thử trình duyệt tập trung các luồng chính; các tổ hợp quyền và nhánh từ chối/thu hồi được kiểm tra API/SQL, không tuyên bố đều đã bấm bằng UI. Danh sách có thể còn mất vài giây dưới tải local; số thời gian trong báo cáo UI không phải benchmark.
- Rehearsal backup dùng database/storage fixture sở hữu riêng và dừng ghi riêng fixture đó. Không tuyên bố đã sao lưu nhất quán database ứng dụng đang hoạt động; khi vận hành phải dừng mọi writer theo hướng dẫn. Hai database cô lập và file backup/restore được giữ lại để đối chiếu.

Đăng nhập demo: `sv-gap@demo-v2.example.test` hoặc `school-manager@demo-v2.example.test`, mật khẩu mặc định `Demo-V2-2026!`. Chỉ dùng các tài khoản này trong môi trường demo.
