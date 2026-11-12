# Rà soát chức năng, phân quyền và workflow

Ngày 03/11/2026 (Asia/Saigon). Đối tượng: source trong workspace, gồm thay đổi chưa commit. Các phát hiện dưới đây giữ mô tả lúc audit; trạng thái sửa mới nhất nằm ngay bên dưới, không thay bằng chứng của các lần bàn giao cũ.

## Cập nhật sửa 4 mục ưu tiên

**Bổ sung 04/11/2026 — điều hướng Hội đồng và bàn giao sang ghi thưởng:** logo dùng đường dẫn gốc để resolver đưa Hội đồng về Hồ sơ đề nghị; không ép vào Dashboard ngoài quyền. Trang Khen thưởng có danh sách RECOMMENDED trong phạm vi chuyên viên, tổng hợp đúng từng đơn vị. Chọn hồ sơ để chuẩn bị nháp với chủ thể/loại thưởng/nguồn cố định; chỉ bổ sung quyết định và năm. Backend dẫn xuất từ snapshot đã xét, lưu liên kết và input version, kiểm lại trước ghi nhận, chặn trùng active record; bản đã tạo được mở lại. Nhập quyết định ngoài luồng giữ riêng. Migration **31** cần áp dụng cùng các migration còn thiếu trước khi dùng code mới; chưa thay đổi DB nghiệp vụ.

Kiểm chứng đợt bổ sung: **28 HTTP/PostgreSQL checks mới PASS**, **27 checks khen thưởng cũ PASS**, **16 unit/regression PASS**, frontend lint/build và diff check PASS. Browser Edge/Playwright CLI với API giả lập: click logo COUNCIL không 404; queue, chọn quyết định, payload chỉ gồm version/decision/year, mở nháp và bỏ nút tạo trùng PASS; lượt cuối không có console error. Đây là kiểm UI giả lập cộng kiểm backend thật độc lập, chưa phải một lượt browser xuyên suốt với DB thật. Guard dropdown được bổ sung để không đọc ref đã unmount khi scroll/hot reload.

- **A01 đã sửa:** cấp role LECTURER tạo/liên kết lecturer trong cùng transaction; UI cho nhập mã và chọn công tác chính. Giữ hồ sơ/lịch sử hiện có, chặn chuyển đơn vị hoặc đổi danh tính ngầm. Kiểm chứng mở profile/CV, tạo achievement và rollback khi lỗi: W2-P1 **76 HTTP assertions PASS** trên PostgreSQL cô lập.
- **A02 đã sửa:** PATCH purpose/nguồn chỉ cho chủ hồ sơ/đại diện hiện hành, đúng version và DRAFT/NEED_CORRECTION. Mỗi resubmit kiểm lại nguồn rồi ghi input_version mới; snapshot cũ bất biến và detail đọc phiên mới nhất. UI có sửa và gửi bổ sung. W4-P3 **55 HTTP checks PASS**, W3-P3 **67 assertions PASS** với schema rollback; gồm nguồn bị thu hồi, quyền sai, version cũ, snapshot v1 giữ nguyên/v2 có nội dung sửa.
- **A03 đã sửa:** UI và create/update schema đều yêu cầu ít nhất một achievement; award records là nguồn tùy chọn. Draft cũ thiếu nguồn có thể sửa tại chi tiết trước khi nộp.
- **A04 đã sửa đường cấu hình:** lưu ánh xạ và revision theo từng tiêu chí; Admin/Hội đồng cấu hình loại nguồn trên UI. Đổi mapping bỏ xác nhận, ghi lịch sử/actor và cần xác nhận lại đúng revision. AI tải mapping server theo từng criterion, không nhận rules tùy ý từ client; snapshot/hash kiểm thay đổi mapping. Hội đồng có menu Kho quy định. Mapping thiếu/chưa duyệt/mô phỏng vẫn fail-closed.
- **A05–A08 chưa sửa** trong đợt này theo phạm vi người dùng chọn.

Nâng cấp cần chạy `npm run migrate` trong `backend/` để áp dụng migration **29–30** trước khi dùng code mới. Các lần kiểm chứng đã chạy trên schema riêng; **chưa migrate DB nghiệp vụ đang dùng**, không cần seed lại dữ liệu. Backup DB trước nâng cấp. Quy tắc hạn nộp của kỳ hiện vẫn áp dụng cho resubmit.

Kiểm tra tổng hợp sau sửa: frontend lint/build PASS; lần chạy đầy đủ **340 backend test: 337 PASS, 3 FAIL**. Ba FAIL vẫn thuộc W5-Q2 cũ (dataset chưa có mapping; RAG cần căn cứ phù hợp), giống baseline trước sửa. Sau bổ sung hai unit test mapping, nhóm regression liên quan chạy lại **16/16 PASS**. Không sửa nhãn holdout hay bỏ guard để làm xanh benchmark. Integration mapping riêng **30 HTTP assertions PASS**, gồm quyền, nguồn inactive/sai đối tượng, revision, phê duyệt cả sau khi xóa mapping, từng loại nguồn và stale hash; xem `backend/tests/criteria-source-rules.integration.js`. Chưa kiểm tương tác các form mới bằng browser.

## Kết luận

Các module chính đã có, nhưng **chưa đủ căn cứ kết luận mọi chức năng hoàn chỉnh**. Khoảng thiếu rõ nhất nằm ở cấp tài khoản giảng viên, chỉnh sửa/bổ sung hồ sơ đề nghị và khả năng đánh giá AI theo nguồn đã ánh xạ. Không phát hiện bypass cụ thể cho phép ADMIN tự duyệt thay MANAGER trong các đường duyệt đã xem.

P1: cần ưu tiên vì làm đứt luồng chính. P2: sai hành vi, thiếu chức năng hoặc thiếu kiểm soát cần sửa. “Đối chiếu code” khác “tái hiện HTTP/DB”; mức bằng chứng của từng mục được ghi riêng.

## Các vấn đề

### A01 — P1 — Tạo tài khoản giảng viên bằng admin chưa hoàn tất provisioning

- Vị trí: `backend/src/modules/admin/adminRepository.js:26`, `backend/src/modules/profiles/profileService.js:31`, `backend/src/modules/achievements/achievementService.js:165`.
- Trigger: admin tạo user rồi cấp role LECTURER. `createUser` chỉ tạo `app.users`; cấp role không tạo `app.lecturers`.
- Kết quả: tài khoản đăng nhập được nhưng `/me/profile` báo chưa có hồ sơ; kê khai thành tích cá nhân bị chặn. Chức năng chuyển đơn vị chỉ nhận một lecturer đã tồn tại, không giải quyết được bước thiếu này. Không tìm thấy endpoint/UI tạo lecturer cho user đó.
- Bằng chứng: đối chiếu route, repository, UI quản trị và kiểm tra điều kiện ở service. Chưa chạy riêng tình huống này qua browser.
- Đề xuất: một luồng admin tạo/liên kết lecturer với user và gán công tác chính có transaction. Self-registration hiện là luồng khác, có tạo lecturer; không nên coi đó là cách hoàn thiện tài khoản admin đã tạo.

### A02 — P1 — “Bổ sung” hồ sơ đề nghị chưa cho sửa hồ sơ hoặc tạo phiên input mới

- Vị trí: `backend/src/modules/awards/applicationService.js:125`, `backend/src/modules/awards/applicationRoutes.js`, `frontend/src/pages/AwardApplications.jsx:301`.
- Trigger: Hội đồng yêu cầu bổ sung tài liệu/nguồn → applicant mở NEED_CORRECTION.
- UI chỉ có lời nhắn và nút gửi bổ sung; không có sửa purpose, thay danh sách thành tích/khen thưởng hoặc thêm nguồn. API không có endpoint cập nhật application.
- `review(...,'resubmit')` chỉ chuyển về SUBMITTED, ghi comment/history; không gọi `snapshot()` hoặc tạo `award_application_inputs` mới. Hội đồng tiếp tục xem input lần đầu, dù nguồn thực tế đã thay đổi.
- Bằng chứng: đã tái hiện đường service với DB giả lập, xác nhận state đổi nhưng số lần snapshot và ghi input đều bằng 0. Không phải tái hiện đầy đủ bằng browser.
- Đề xuất: cho sửa phần được phép khi DRAFT/NEED_CORRECTION; mỗi lần nộp lại kiểm nguồn/quyền/hiệu lực và lưu input_version mới. Detail phải chọn input mới nhất có thứ tự rõ ràng.

### A03 — P2 — UI cho tạo bản nháp không thể nộp và không có cách sửa

- Vị trí: `frontend/src/pages/AwardApplications.jsx:215`, `backend/src/modules/awards/applicationService.js:338`.
- Trigger: chỉ chọn khen thưởng RECORDED, không chọn thành tích VERIFIED. UI cho bấm tạo; schema cũng chấp nhận achievementIds rỗng. Khi submit, snapshot bắt buộc ít nhất một thành tích VERIFIED.
- Bản nháp không có API sửa danh sách nguồn, nên người dùng phải tạo lại hồ sơ khác. Tương tự, chọn nhầm nguồn trong draft cũng không sửa được.
- Bằng chứng: đối chiếu điều kiện UI và tái hiện schema/snapshot bằng service.
- Đề xuất: chốt nghiệp vụ tối thiểu nguồn, đồng bộ validator/UI và bổ sung cập nhật draft. Nếu achievement là bắt buộc, thể hiện ngay từ form thay vì chặn ở bước nộp.

### A04 — P1 nếu cần nghiệm thu AI — Structured evaluation chưa có đường cấu hình ánh xạ nguồn từ ứng dụng

- Vị trí: `backend/src/modules/ai/aiController.js:24`, `backend/src/modules/ai/aiService.js:301`, `backend/src/modules/ai/criteriaEvaluator.js:140` (khu vực kiểm tra `CRITERION_SOURCE_UNMAPPED`).
- Evaluator yêu cầu `rules.sourceType` và danh sách loại nguồn tương ứng. Service mặc định `rules=null`; request schema strict không nhận rules; UI không gửi rules; service không lấy ánh xạ đã xác nhận từ tiêu chí DB.
- Vì vậy đường structured API hiện không thể tính đạt ngưỡng theo nguồn đã ánh xạ, kể cả có hồ sơ VERIFIED. Giữ NEEDS_HUMAN_REVIEW là hành vi an toàn, nhưng chức năng thẩm định tự động theo tiêu chí chưa hoàn thiện.
- Bằng chứng: đối chiếu toàn đường payload/controller/service/evaluator. Bộ test W5-Q2 hiện có 3 ca fail: accuracy trên bộ dữ liệu cũ là 65,6%, thiếu YEAR_GAP kỳ vọng và không có citation trong ca RAG. Đây không chứng minh accuracy trên dữ liệu nghiệp vụ thật; holdout cũ thiếu mapping và báo cáo đã cảnh báo điều đó.
- Đề xuất: lưu mapping có kiểm duyệt theo từng phiên bản tiêu chí, tải từ server, chuẩn hóa dataset/ground truth và đánh giá lại. Không bỏ guard hoặc đưa lại số liệu lịch sử để làm test xanh.

### A05 — P2 — Mọi tài khoản đăng nhập có thể chạy tác vụ lập chỉ mục toàn bộ quy định

- Vị trí: `backend/src/modules/ai/aiRoutes.js:20`, `backend/src/modules/ai/aiController.js:101`, `backend/src/modules/ai/rag/ragRetrievalService.js:14`.
- Route chỉ dùng authenticate. Controller không xét actor, service quét các chunk đã xác nhận và upsert embedding toàn bộ.
- Tài khoản giảng viên/Hội đồng có thể yêu cầu mutation bảo trì này lặp lại, gây tải DB/CPU ngoài thao tác nghiệp vụ thông thường. Chưa thấy quyền quản trị hoặc điều phối chống chạy đồng thời. Embedding này là local; không khẳng định nó gọi dịch vụ AI trả phí.
- Bằng chứng: đối chiếu middleware và tái hiện controller với actor LECTURER, DB giả lập ghi nhận INSERT embedding.
- Đề xuất: giới hạn vai trò được bảo trì, giới hạn/tổ chức tác vụ và chỉ index phần thay đổi. Cần chốt role sản phẩm, vì tài liệu hiện chưa quy định rõ.

### A06 — P2 — Tra đơn vị để tạo thành tích có thể lấy phân công chưa đến ngày hiệu lực

- Vị trí: `backend/src/modules/achievements/achievementRepository.js:14`, `backend/src/modules/achievements/achievementService.js:175`.
- Join `lecturer_assignments` chỉ kiểm valid_to, thiếu `valid_from <= NOW()`; còn có LIMIT 1 không chọn thứ tự. Auth/profile/application lại có kiểm valid_from.
- Nếu chỉ có phân công tương lai, có thể tạo thành tích trước thời điểm được phân công; nếu công tác hiện tại và tương lai cùng được trả về, ContextUnitId có thể sai đơn vị. Điều này ảnh hưởng hàng chờ Manager và scope xử lý.
- Bằng chứng: đối chiếu SQL và nơi dùng primaryUnitId; chưa dựng riêng fixture SQL cho tình huống tương lai. Không khẳng định dữ liệu hiện tại đang mắc lỗi này.
- Đề xuất: dùng cùng quy tắc công tác chính hiệu lực giữa các module, kiểm đúng một kết quả và từ chối dữ liệu mơ hồ.

### A07 — P2 — Cờ bắt đổi mật khẩu chỉ được trả về, chưa được cưỡng chế

- Vị trí: `backend/src/modules/admin/adminRepository.js:27`, `backend/src/modules/auth/authService.js:113`, `backend/src/middlewares/authenticate.js`, `frontend/src/routes/AppRoutes.jsx`.
- User do admin tạo có must_change_password=TRUE; login/getMe trả cờ này. Không tìm thấy gate buộc đổi mật khẩu trước khi dùng chức năng, cả frontend và authenticate.
- Người dùng tiếp tục dùng mật khẩu tạm để thao tác nghiệp vụ sau khi được cấp quyền. Đây là thiếu thực thi ý nghĩa của cờ, không phải lỗi không đăng nhập được.
- Đề xuất: giới hạn API cho tài khoản còn cờ, điều hướng tới form đổi mật khẩu và chỉ mở nghiệp vụ sau khi đổi thành công.

### A08 — P2 — Quy tắc độ dài mật khẩu không nhất quán

- Vị trí: `backend/src/modules/auth/authController.js:15`, `backend/src/modules/auth/authService.js:233`, `backend/src/utils/crypto.js:8`.
- Register/reset giới hạn 72 byte UTF-8; change-password chỉ kiểm tối thiểu 8 ký tự. Admin create-user giới hạn 72 ký tự, vẫn có thể vượt 72 byte nếu dùng Unicode. Bcrypt bỏ phần sau 72 byte, nên hai mật khẩu khác nhau ở phần đuôi có thể đăng nhập tương đương.
- Bằng chứng: tái hiện bcrypt với cùng 72 byte đầu và hai hậu tố khác nhau: compare trả true. Chưa gọi HTTP đổi mật khẩu để tránh sửa mật khẩu tài khoản có sẵn.
- Đề xuất: dùng chung validator mật khẩu theo byte cho mọi nơi tạo/đổi/reset mật khẩu, kể cả tài khoản admin tạo.

## Phạm vi đã xem và điểm chưa chốt

| Luồng/nhóm | Kết quả rà soát |
| --- | --- |
| Lecturer/đại diện → thành tích → Manager | Có kiểm owner/scope, chống tự duyệt, phiên bản và snapshot. Evidence mutation khóa hàng achievement cùng submission. Chưa thấy race cụ thể trong các nhánh đã xem. |
| Manager/RecordsOfficer → ghi nhận khen thưởng | Tách xác nhận thành tích khỏi ghi nhận có quyết định; transition có khóa và kiểm version/state. |
| Applicant → Manager → Council → bổ sung | Có state/role/scope/assignment checks; còn A02/A03. |
| Admin → tài khoản/role/scope | Middleware đọc role hiện tại từ DB; không xác nhận nghi ngờ stale ADMIN JWT. Còn A01/A07. |
| Profile, CV, reports, KPI | Có ownership/scope ở service hoặc SQL. Không tìm thấy bypass cụ thể trong phạm vi đọc; chưa phải kiểm chứng mọi màn hình và tổ hợp nhiều role. |
| AI/RAG | Có cơ chế không tự trao thưởng và fail-closed; còn A04/A05, benchmark hiện tại chưa đạt bộ kiểm tra cũ. |
| Lịch cá nhân | CRUD ràng buộc user_id, version và kiểm ngày; cần dùng kết quả integration bên dưới. |

Các điểm cần chốt nghiệp vụ, chưa tính là bug xác nhận: Manager đang là một đại diện khác của đơn vị có được duyệt thành tích do đại diện khác nộp không; việc cấp lại role có nên kích hoạt lại scope cũ chưa hết hạn không; quyền ADMIN trong tài liệu cũ khác quyền Awards UI hiện tại. Không tự sửa theo suy đoán.

## Kiểm chứng

- Frontend lint: PASS. Production build: PASS khi chạy ngoài sandbox; lần đầu EPERM là hạn chế môi trường. Có cảnh báo chunk ExcelJS lớn, không phải lỗi build.
- Tất cả `backend/tests/*.test.js`: **337 test; 334 PASS, 3 FAIL**, chạy ngoài sandbox. Log: `tmp/audit-unit-tests-unrestricted.log`. Những lỗi mạng/localhost ở lần sandbox đầu không tính thành bug.
- Bốn tình huống service/controller/bcrypt tại `tmp/audit-workflow-repro.mjs`: PASS tái hiện; DB giả lập, không ghi DB thực.
- `w3-q1.integration.js`: **36/36 PASS**, Express + Supabase, schema thử cô lập và rollback. Gồm correction/resubmit, verify/reject/cancel/revoke/replace và snapshot/history.
- `w4-p3.integration.js`: **47 kiểm tra HTTP PASS** và invariant PostgreSQL, schema thử rollback. Test kiểm state/comment khi bổ sung, chưa kiểm sửa nguồn/tạo input version mới nên không phủ A02.
- `registration.integration.js`: **PASS** validation, trùng email đồng thời, role/profile và login. Schema riêng được dọn sau test. Test này không phủ provisioning bằng admin ở A01.
- `calendar.integration.js` bản gốc: **FAIL 401 tại bước tạo**, do token tự ký thiếu claim `passwordChangedAt` trong khi tài khoản DB đã có thời điểm đổi mật khẩu. Không phải bằng chứng lỗi CRUD lịch.
- Bản runner tạm `tmp/audit-calendar-current-auth.mjs` bổ sung claim từ DB, giữ nguyên assertion: **PASS** HTTP/DB cho CRUD, ownership, ngày giờ và xung đột version; transaction rollback. Cần cập nhật runner chính thức theo hợp đồng auth mới.
- Chưa kiểm mọi màn hình bằng browser, chưa đo lại performance/quota provider thật, chưa nghiệm thu môi trường production. Các log tạm `tmp/audit-*.log` là đầu ra đợt này; test có thể sinh backup và báo cáo kiểm thử theo cơ chế sẵn có.

Ưu tiên sửa: A01 → A02/A03 → A04 → A05/A06/A07/A08, sau đó chạy lại các luồng sáu vai trò và kiểm nhiều role, role bị thu hồi, scope hết hạn, bổ sung qua nhiều vòng.
