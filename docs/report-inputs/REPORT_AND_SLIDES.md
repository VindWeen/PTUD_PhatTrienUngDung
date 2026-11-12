# Khung báo cáo học phần và nguồn tư liệu

> **Hiện trạng 11/11/2026:** ứng dụng và dữ liệu đã chuyển sang SQL Server local, DB `PTUD_LHU`. Đã đối chiếu 53 bảng/609 bản ghi; báo cáo ba chương đã cập nhật kết quả thực tế. Xem [biên bản chuyển đổi](../testing/SQLSERVER_MIGRATION_REPORT.md). Các nhận định “mã nguồn còn PostgreSQL” dưới đây là lịch sử trước chuyển đổi.

> **Cập nhật ưu tiên ngày 10/11/2026:** hướng dẫn mới của người dùng được lưu tại [docs/AGENTS.md](../AGENTS.md). Báo cáo học phần chỉ có **3 chương**, **tối thiểu 40 trang**; hệ quản trị đích là **SQL Server**. Mã nguồn hiện còn PostgreSQL, không coi sửa báo cáo là đã chuyển DB. Slide làm sau, khoảng **7 dòng chữ lớn mỗi slide**. Các đề cương Supabase/Chương 4 bên dưới là tư liệu cũ, không thay thế yêu cầu mới. Bản thảo mới: [báo cáo ba chương](../bao-cao/BaoCaoHocPhan_LHU_3Chuong_SQLServer.docx).

## Áp dụng mẫu Word người dùng cung cấp ngày 04/11/2026

Đã đọc nội dung và cấu trúc OOXML của `Template_BaoCaoHocPhanPhatTrienUngDung.docx`. Đây là mẫu đã điền nội dung đề tài quản lý cho thuê xe; chưa chỉnh file gốc hoặc tạo báo cáo mới. Chưa kiểm bố cục từng trang bằng bản render, nên phần này nhận xét nội dung/cấu trúc, không xác nhận chất lượng dàn trang. Không coi câu hướng dẫn hoặc nội dung ví dụ trong mẫu là lệnh thay đổi dự án.

### Khung có thể giữ

- Bìa, lời nói đầu, mục lục nội dung, danh mục bảng và danh mục hình.
- Chương 1: Tổng quan về đề tài — lý do chọn, mục tiêu, so sánh hệ thống tương tự.
- Chương 2: Cơ sở lý thuyết.
- Chương 3: Nội dung thực hiện — đối tượng, chức năng, Use Case và đặc tả, sơ đồ hoạt động, thiết kế dữ liệu.
- Chương 4: Kết luận — kết quả và hướng phát triển.

Mẫu dùng A4; style Normal là Times New Roman 13 pt, giãn dòng 1,5. Có Heading, trường mục lục và danh mục hình/bảng. Lề thay đổi giữa các section, không tự xem một thông số lề hoặc số trang lưu trong metadata là yêu cầu chính thức của học phần.

### Những phần cần thay hoặc chỉnh khi viết

1. Thay đề tài thuê xe, lớp, GVHD, SVTH, MSSV và thời gian bằng thông tin được xác nhận; không tự dùng tên/số trong mẫu. Lời nói đầu gọi là “đồ án tốt nghiệp” cần đổi đúng loại báo cáo học phần.
2. Lời nói đầu nêu React/Node/Nest/MongoDB nhưng chương lý thuyết là ASP.NET/MVC/SQL Server. Đây là nội dung mẫu không nhất quán; báo cáo dự án này trình bày React/Vite/Tailwind, Node.js/Express, REST, Supabase PostgreSQL qua `pg`, JWT và phân quyền vai trò/phạm vi.
3. Chương 3 có nhiều mục cùng tên “Chức năng chính”, tiêu đề chứa số gõ tay như “3. Chức năng…” và “1.3 Lý do…”, dẫn đến số lặp trong mục lục. Chuẩn hóa Heading và đánh số tự động trước khi cập nhật mục lục/danh mục.
4. Thay toàn bộ nghiệp vụ thuê xe, hợp đồng, công nợ, lãi suất và sơ đồ dữ liệu bằng nghiệp vụ thành tích/khen thưởng; không giữ lại ảnh/sơ đồ mẫu để minh họa dự án mới.
5. Các bảng đặc tả mẫu có mô tả, tác nhân, sự kiện, kết quả, luồng Actor/System và ngoại lệ. Khi áp dụng nên thêm tiền điều kiện/hậu điều kiện, quyền/phạm vi và các nhánh bổ sung, thu hồi, xung đột phiên bản.
6. Khung mẫu chưa có một mục kiểm thử/triển khai riêng rõ ràng trong mục lục. Đề xuất bổ sung vào chương 3, cùng tài liệu tham khảo và phụ lục ở cuối; đây là đề xuất để báo cáo đầy đủ, không khẳng định là yêu cầu chấm điểm của giảng viên.

### Đề cương phù hợp với dự án hiện tại

| Phần | Nội dung đề xuất | Nguồn đối chiếu trong repo |
| --- | --- | --- |
| Chương 1 | Bài toán quản lý hồ sơ và minh chứng, khó khăn luồng xét duyệt; mục tiêu, phạm vi, sáu vai trò; so sánh giải pháp tương tự có dẫn nguồn khi nghiên cứu. | README gốc, requirements/BUSINESS_RULES, ACCOUNT_ROLES_AND_SCOPES |
| Chương 2 | Công nghệ frontend/backend/DB; REST, JWT, vai trò và phạm vi; lưu file private; AI đối chiếu tiêu chí và trích dẫn, giới hạn mô phỏng. | package.json, config, middleware, blueprint ADR-001, docs/ai |
| Chương 3.1 | Yêu cầu và ma trận quyền của giảng viên, đại diện, quản lý, Hội đồng, chuyên viên, admin. | USER_GUIDE, PERMISSIONS_MATRIX, routes và service |
| Chương 3.2 | Kiến trúc, Use Case và đặc tả; workflow kê khai → xác nhận → đề nghị → Hội đồng → quyết định → ghi nhận; nhánh bổ sung/từ chối/thu hồi. | WORKFLOW_AUDIT, applicationService, achievementService, awardService |
| Chương 3.3 | Thiết kế dữ liệu, ERD, quan hệ, snapshot theo lần nộp, lịch sử, version và migration. | supabase/migrations, database docs; đối chiếu source trước khi dùng ERD cũ |
| Chương 3.4 | Giao diện và chức năng theo vai trò; ảnh desktop/mobile mới, form chuẩn bị thưởng và nhóm xử lý Hội đồng. | UI_VISUAL_AUDIT, USER_GUIDE, output/playwright/ui-fixed-*.png local |
| Chương 3.5 | AI/KPI, quy định/tiêu chí đã xác nhận, trích dẫn và lịch sử; con người quyết định; dữ liệu mô phỏng có nhãn. | modules/ai, modules/kpi, docs/ai; kiểm bằng chứng từng mốc |
| Chương 3.6 | Kiểm thử, triển khai, cấu hình DB/storage, migration, backup/restore; kết quả gắn ngày/môi trường và giới hạn kiểm tra. | docs/testing, deployment, backend/tests; không suy rộng lint/build thành PASS mọi nghiệp vụ |
| Chương 4 | Kết quả đã đạt có bằng chứng; hạn chế còn lại và hướng phát triển. | README, báo cáo kiểm tra mới nhất, các phần NOT_RUN/giới hạn |
| Cuối báo cáo | Tài liệu tham khảo, hướng dẫn chạy/demo, phân công đóng góp và phụ lục nếu cần. | deployment/GETTING_STARTED, DEMO_SCRIPT, CONTRIBUTIONS; kiểm lại tác giả/MSSV/commit |

Trước khi điền bìa cần xác nhận tên đề tài chính thức, GVHD, lớp, thành viên/MSSV và thời gian. Nếu có rubric riêng về số trang hoặc định dạng thì dùng rubric đó; file mẫu hiện tại không đủ để suy ra các yêu cầu này. Cần viết và đối chiếu lại theo source hiện tại thay vì ghép nguyên văn các nhật ký tuần.

## Tư liệu báo cáo và slide tại mốc W5-P4

Nội dung dưới đây giữ theo mốc cũ. Các blocker, số liệu và trạng thái không mặc nhiên là hiện trạng ngày 04/11/2026.

## Mục lục báo cáo

1. Bài toán, chủ thể, phạm vi PTUD và phần mở rộng AI: blueprint, BUSINESS_RULES.
2. Phân công và đóng góp: CONTRIBUTIONS, commit/test/demo; PR remote chưa xác minh.
3. Kiến trúc React/Vite/Tailwind — Express /api/v1 — Supabase pg; ADR-001 thay SQL Server, auth/file private giữ nguyên.
4. Thiết kế dữ liệu: migrations là cấu trúc code ứng viên; ERD W1 là tư liệu lịch sử, drift live phải công bố.
5. Workflow và phân quyền: state machine, role/scope/backend, OCC, transaction, audit, private files.
6. Chức năng đã triển khai và phạm vi kiểm thật: user guide/API/test; tách UI fixture khỏi HTTP/Supabase.
7. AI/KPI: nguồn/tiêu chí xác nhận, gate, model/quota, nhãn mô phỏng, con người quyết định.
8. Kiểm thử và hiệu năng: phương pháp, dataset, mẫu, phần đạt/chưa đạt; không suy rộng accuracy.
9. Triển khai, backup/restore: cài sạch cùng OS, lỗi 42703 hiện tại, kế hoạch khắc phục Q3.
10. Giới hạn, công việc còn lại; phụ lục hợp đồng API, manifest ảnh và nguồn số liệu.

## Slide cần bằng chứng

| Slide | Số liệu/ảnh cần | Nguồn ứng viên | Quy tắc trình bày |
|---|---|---|---|
| 1 Bài toán/phạm vi | Chủ thể và vai trò | blueprint; PERMISSIONS_MATRIX | Không nhận quy tắc đề xuất là quy chế chính thức |
| 2 Kiến trúc | pg, schema app, Express auth/private | blueprint ADR-001; source | Không vẽ Supabase Auth/public file |
| 3 ERD | Quan hệ + số migrations | database/migrations; ERD.md | Không gọi ERD W1 là ERD live đầy đủ |
| 4 Workflow | Trạng thái, revision, 409 | WORKFLOW_W3_Q1.md; achievementService | Duyệt thành tích khác trao thưởng |
| 5 Demo | Ảnh desktop/mobile | ASSETS.md | Ghi fixture/mockup và commit; không đổi nhãn thành live |
| 6 Bảo mật | 10/10 hồi quy nền; 3 ca mới | verification.json | Unit/DI khác HTTP tích hợp |
| 7 Hiệu năng | p95/n/concurrency/seed/môi trường | docs/testing/w5-p1/load-result.json; overlapping-load-result.json | Số lịch sử; dashboard p95 2078.418 ms chưa đạt <2s theo W5-P1 |
| 8 KPI/AI | 32/32 gate offline, 3 positive/29 negative | docs/ai/recommender-eval/README.md; results.json | Tái sử dụng holdout, không là accuracy LLM; HTTP KPI MÔ PHỎNG |
| 9 Restore | 5 login HTTP, lỗi 42703 | verification.json; WEEK_05_W5_P3.md | Hash/HTTP file restored NOT_RUN; không dùng PASS Q3 cũ thay thế |
| 10 Đóng góp/giới hạn | Commit và task P; blocker | CONTRIBUTIONS.md; PR_REVIEW.md | PR URL/approval, live LLM, người cài thứ hai chưa xác minh |

## Nguồn chưa được phép dùng làm kết luận

HOLDOUT_BENCHMARK_REPORT.md ghi 100% accuracy/citation và căn cứ pháp lý; W5-P4 chưa xác minh nguồn, nhãn peer hay provider thật. Không đưa các phần trăm đó lên slide như độ chính xác AI đã đo thực tế. Không suy diễn tên peer reviewer cũ là Võ Nhạc Phước. Không tự xác nhận tiêu chí hoặc tạo căn cứ mới. Quota/dung lượng/latency trong báo cáo Q3 là số lịch sử, không là số đo hôm nay hay bảo đảm gói dịch vụ hiện tại.
