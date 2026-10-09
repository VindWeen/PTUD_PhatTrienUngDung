# W6-P3 — Review hai người và gate release 28/10/2026

Võ Nhạc Phước · 09/10/2026 (Asia/Saigon). Mục tiêu release **28/10/2026**, chưa có xác nhận release chung. Không tạo tag, commit rỗng, đổi tác giả, sửa ngày Git hoặc chia đều số commit. W6-P3 hiện là diff chưa commit; SHA quay video là baseline W6-P2 cộng hash harness và sửa multipart upload quyết định chưa commit, không phải SHA mới cho W6-P3.

## Kế hoạch và nguồn

Áp dụng blueprint/ADR-001: Supabase PostgreSQL qua pg thay SQL Server cũ, Express auth và private files giữ nguyên. W6-P2 `2774075b319964a9fd4839070a428bd4fe667a09`, W6-Q2 `afd237763d903f990fc1b84f9aab9c1489eac404` có trong lịch sử reachable HEAD. Không tìm thấy AGENTS.md trong repo hoặc C:/, C:/Drive D/. Tái dùng user guide, kịch bản, runner W5-P3 và API achievements/W3-P3/W4-P3/W2-P2. Quay trên schema Supabase test riêng; dữ liệu/file/quyết định đều tổng hợp có nhãn MÔ PHỎNG. Không gọi AI, xác nhận nguồn/tiêu chí mới hoặc tự trao thưởng. Không đổi hợp đồng API.

## Review đã tìm thấy và giới hạn

| Người/phạm vi | Bằng chứng trong repo | Kết luận dùng được | Điều chưa thể nhận thay |
|---|---|---|---|
| Quang review Phước W5-P2/P4 | [W5-Q4](../../weekly/WEEK_05_W5_Q4.md), commit `d3986f0813590b3505c874a213e3548405f0d706` | Ghi nhận fallback quyền đã sửa, KPI mô phỏng, benchmark offline và blocker restore | Đây là review lịch sử, không duyệt video/W6-P2/W6-P3 mới |
| Quang W6-Q1/Q2 | [W6-Q2](../../weekly/WEEK_06_W6_Q2.md), [release checklist](../../report-inputs/RELEASE_CHECKLIST_W6Q2.json) | Test cấu trúc/script, containment/fail-hard; restore integration NOT_RUN trong báo cáo Quang | Không là bằng chứng HTTP restored/file quyết định hoặc máy thứ hai |
| Phước review Quang W6-P2 | [W6-P2](../../weekly/WEEK_06_W6_P2.md), commit `2774075b319964a9fd4839070a428bd4fe667a09` | Restore thật gói cục bộ FAIL 42703 verified_by; chỉ ra nguồn supabase/migrations khác legacy 009 và literal table_schema không rewrite | Không bỏ cột dữ liệu để lấy PASS; chưa sửa/duyệt thay Quang |
| Phước W6-P3 | [Video và test evidence](README.md), [manifest](evidence-manifest.json) | Công cụ chạy/ghi hình cho task Phước, dùng API/DB thật và kiểm status/hash | Không khẳng định hai người cùng ngồi chạy hoặc Quang đã xem/đồng ý |
| Quang review W6-P2/video và ký release | Chưa có artefact trong checkout | **PENDING** | Không điền chữ ký, approval, ngày hoặc SHA thay Quang |

Git author cho biết tác giả của commit tài liệu, không tự chứng minh người đó đã chạy mọi lệnh ghi trong tài liệu. Test mới W6-P3 được tách riêng khỏi kết quả lịch sử W6-P2/Q2. Khẳng định nhãn holdout peer-validated trong báo cáo cũ chưa được xác nhận độc lập ở W6-P3; không dùng để tuyên bố accuracy LLM live.

PR #1/#2 có merge subject trong lịch sử local; xem [prs.json](prs.json) với merge SHA/parents. Truy vấn GitHub refs chưa xác minh được remote (SEC_E_NO_CREDENTIALS); không tạo URL PR cho mỗi task nếu chưa có PR thật. Commit URL chỉ là tham chiếu SHA local, chưa chứng minh đã push.

## Phiếu review để hai người chốt

| Gate | Người phụ trách kiểm/chốt | Điều kiện và bằng chứng cần bổ sung | Trạng thái hiện tại |
|---|---|---|---|
| Video đúng SHA/source | Phước chuẩn bị, Quang review | Xem video cùng recording-result, đối chiếu sourceHashes, caption và timeline; xác nhận API achievements và UI applications/awards được phân biệt | Quang **PENDING** |
| Restore DDL/DML | Quang sửa/kiểm, Phước kiểm lại | Dump tương thích schema đích; không skip verified_by; schema/storage test riêng; log exit 0 và bảng/dòng/FK/sequence/hash | **BLOCKED 42703** từ W6-P2 |
| File restored | Hai người kiểm độc lập | HTTP owner SHA256/size, anonymous 401, ngoài scope 403/404; đủ minh chứng và file quyết định; thiếu/hash sai phải FAIL | **NOT_RUN**, phụ thuộc restore |
| Kịch bản người xem | Phước tổ chức, Quang hoặc người xem thực hiện | Đi hết checklist W6-P2 trên DB/storage restored; ghi người kiểm, ngày, ID hồ sơ, status/version/lịch sử | **PENDING**; video chạy schema mới, chưa phải restored |
| Máy thứ hai | Quang vận hành, Phước kiểm tài liệu | Clone/cài độc lập theo README, ghi Node/npm/DB/migration/source/storage version | **PENDING** |
| Release source và media | Hai người | Chọn SHA ứng viên đã commit theo yêu cầu người dùng; xuất lại manifest, kiểm SHA-256, link PR/review thật; không gắn video của SHA khác thành video release | **PENDING** |
| AI/KPI | Hai người + người có thẩm quyền nghiệp vụ | KPI mô phỏng luôn có nhãn; AI chỉ chạy nguồn/tiêu chí đã xác nhận; provider live/quota nếu trình diễn phải có log riêng | Video **AI NOT_RUN**; không có claim accuracy |
| Hiệu năng và giới hạn | Hai người | W5-P1 p95 dashboard chưa <2s; ghi quyết định xử lý/chấp nhận có người duyệt, không sửa con số trong report | **OPEN** |
| Ngày quyết định hiển thị | Phước ghi nhận, Quang đối soát | Playback RECORDED hiển thị 2026-10-08 khi form điền 2026-10-09; kiểm DATE/timezone/serialization và UI trước chốt | **OPEN**, không nằm trong assertion status/hash |

Mốc phối hợp dự kiến: xử lý blocker trước 21/10; đối soát ứng viên/manifest trước 25/10; hai người kiểm lại và quyết định GO/NO-GO ngày **28/10/2026** (Asia/Saigon). Đây là kế hoạch, chưa là lịch sử đã thực hiện hoặc automation đã được đặt.

Phước xác nhận sau tự xem: ___; ngày/giờ: ___; source SHA: ___; video SHA256: ___.

Quang xác nhận sau review độc lập: ___; ngày/giờ: ___; PR/review URL hoặc file review: ___; source SHA: ___; quyết định GO/NO-GO và gate còn mở: ___.

Không gửi tin nhắn/email, không publish/tag/merge thay hai người. Phiếu này sẵn để Quang review; giữ trống cho đến khi có bằng chứng xác nhận thật.
