# Demo PTUD — W3-P4 (10–15 phút)

## Chuẩn bị

Chạy backend/frontend theo README với cấu hình DB Supabase local, không đưa .env/key vào Git. Dùng tài khoản phát triển đã có của Lecturer, Manager và Admin; không viết mật khẩu/token vào tài liệu hoặc quay màn hình chứa key. Không chạy seed trên app dùng chung. Dữ liệu nhập demo phải có nhãn SYNTHETIC/MO PHONG.

## Demo UI bộ phát triển (không gọi provider)

1. Đăng nhập và mở `/me/ai-forecast`. Xác nhận banner MÔ PHỎNG và nhãn chưa được chuyên môn xác nhận luôn hiển thị, kể cả khi VITE_DATA_SOURCE=api.
2. Chọn DEV-01: input 3 năm theo đặc tả mô phỏng, conclusion SIMULATION_ONLY, isSatisfied UNCONFIRMED. Không có phần trăm đủ điều kiện hoặc nút trao thưởng.
3. Chọn DEV-02/03/04: thiếu file, đứt chuỗi, trùng năm; số năm khác nhau không đếm hai lần cùng năm. Mở input và xem id/version/hash tổng hợp.
4. Chọn DEV-05/11: thu hồi/replacement, nguồn cũ không cộng thêm vào input hiện trạng; đây là fixture so sánh với API kiểm thử, không phải tự thay bản ghi thật.
5. Chọn DEV-06/07/08: đổi rule v1→v2, tài liệu/tiêu chí chưa duyệt. Xem basis/source hash và disclaimer: test-spec không là chính sách LHU.
6. Chọn DEV-09: KPI nguồn mô phỏng giữ sourceNote MO PHONG. Chọn DEV-12: khác chủ thể phải báo WRONG_SUBJECT.
7. Mở EvaluationRun: provider mock, isSimulation true, isConfirmedByLhu false, humanReviewRequired true, legalReferences rỗng, automaticAwardGranted false. UI chỉ import 12 dev; 6 final không có trong lựa chọn.

## Chứng minh tích hợp API/DB thật

Chạy `npm --prefix backend run test:w3-p4:integration` trước demo hoặc trong terminal: tạo schema ngẫu nhiên trên Supabase, dựng data synthetic, chạy KPI→DRAFT→upload v1→submit→correction→upload v2→resubmit→verify→revoke. Download v1/v2 vẫn đúng bytes/hash. Tạo regulation v1/v2 và xác nhận flags **chỉ trong schema test**, ép mock, kiểm HTTP 403/400 trước provider. Tất cả rollback/dọn file sau test; không thay app dùng chung.

Nếu thao tác tay, dùng `/kpi` và `/achievements` theo đúng chủ thể/scope; thử sửa VERIFIED phải 409. **Không phê duyệt văn bản mô phỏng vào kho thật chỉ để chạy demo AI.** Nguồn thật chưa duyệt thì endpoint AI mới trả 400 là hành vi đúng.

## Trình bày kết quả và finding

Kết quả dev 12/12 và final 6/6 là deterministic data guards, không phải accuracy LLM. Frozen initial holdout do developer tạo, nhãn chuyên môn đang thiếu. Tích hợp thật 49 kiểm tra, provider mock; test còn chứng minh hai finding: DB snapshot UPDATE chưa bị guard và hai version cùng active ở ngày chuyển tiếp. Giới thiệu review để người nhận hiểu phạm vi đạt/chưa đạt.

Bộ final đã freeze; không chỉnh rule sau xem kết quả. Khi muốn đánh giá LLM thật, cần xác nhận quy chế/tiêu chí/nguồn và gold labels chuyên môn, snapshot/persistence run, protocol privacy/provider và holdout mới; không xem fixture demo là quyết định thưởng.
