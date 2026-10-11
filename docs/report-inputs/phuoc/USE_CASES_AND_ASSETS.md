# Ảnh, use case và nguồn

Mọi ảnh dưới đây: **MÔ PHỎNG — HTTP Express/pg/Supabase thật trong schema test riêng; lịch sử W6-P3, chưa khớp release hiện tại**. Role/status mô tả theo timeline P3; SHA-256 trong manifest. Ảnh không chứng minh test vừa chạy W6-P4. Không dùng ảnh RECORDED để xác nhận ngày quyết định đúng: P3 ghi gate lệch một ngày còn mở.

| Use case / tác nhân | Ảnh / mốc video P3 | Kết quả và backend guard | Nguồn hợp đồng |
|---|---|---|---|
| Tra cứu báo cáo — Manager | [reports](images/reports.png), 01:41 | Tách VERIFIED và RECORDED, lọc/export cùng scope; số 1/1/0/0 chỉ là seed demo | docs/api/REPORTS_W3_P1.md |
| Xác nhận cá nhân/tập thể — Manager | [verified](images/verified.png), 01:30 | API xác nhận hai hồ sơ, cấm tự duyệt; VERIFIED khóa nội dung/minh chứng | docs/api/WORKFLOW_W3_Q1.md |
| Sai vai trò — Lecturer | [wrong-role](images/wrong-role.png), 00:46 | API 403, UI /404; UI không quyết định quyền | docs/requirements/PERMISSIONS_MATRIX.md |
| Phiên cũ — Council | [occ](images/occ.png), 03:47 | Version cũ bị 409, không ghi ý kiến | docs/api/COUNCIL_W4_P3.md |
| Kết luận đề nghị — Council | [recommended](images/recommended.png), 04:15 | RECOMMENDED không tăng decision/AwardRecord; AI không chạy trong video | docs/api/AWARD_APPLICATIONS_W3_P3.md |
| Ghi nhận quyết định — RecordsOfficer | [recorded](images/recorded.png), 05:01 | UI upload file rồi RECORDED, private download đối soát hash/size theo P3; hiện checkout thiếu multipart fix P3 | docs/api/AWARDS_W2_P2.md |

## Use case KPI/recommender cần trình bày

Lecturer nhập mục tiêu/kết quả, preview/commit CSV, chuyển kết quả sang achievement DRAFT; backend kiểm chủ thể/version/trạng thái, không tự xác nhận thành tích. ADMIN kéo connector mô phỏng → staging/quarantine → draft có nguồn. Hợp đồng: KPI_W3_P2.md, EXTERNAL_KPI_W4_P2.md.

Lecturer dùng run đã lưu → tạo gợi ý → xem căn cứ/model → sửa plan/kỳ → accept/reject; backend đối chiếu nguồn/tiêu chí được xác nhận, simulation/stale, role và version. Numeric target/citation lấy từ evaluator, không để model tự đặt ngưỡng. Hợp đồng KPI_RECOMMENDATIONS_W4_P1.md; source recommendationService.js và KpiRecommendations.jsx.

**Chưa có ảnh KPI/recommender release hoặc provider live trong bộ này.** kpiApi.js từ chối fixture mode; không dựng ảnh fixture thành bằng chứng API. Ảnh quota/loading/error W4 tại docs/testing/week-4/media là minh họa lịch sử bổ sung, không là màn KPI đã chạy với LLM thật. Mockup Page_Design chỉ dùng phụ lục thiết kế.
