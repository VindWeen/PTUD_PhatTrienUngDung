# W3-P3 — Plan và bàn giao

Võ Nhạc Phước. Cơ sở: blueprint ADR-001, AWARDS_W2_P2, WORKFLOW_W3_Q1.

1. Tái sử dụng khóa RECORDED, revoke/history/file private và creates replacement W2-P2; thêm thao tác chuẩn bị thay thế trong UI.
2. Supabase PostgreSQL/pg thay DB SQL Server cũ; additive migration 019, dùng award_periods cho Cycles, mở rộng AwardApplications legacy.
3. Tách UI/API đề nghị khỏi ghi nhận quyết định; applicant chỉ nộp hồ sơ của mình/đơn vị đại diện hiệu lực.
4. Chụp input v1 từ VERIFIED achievements (revision/file W3-Q1) và RECORDED awards (decision/file W2-P2); transaction + version + audit; thiếu input báo cụ thể.
5. Workflow cố định DRAFT→SUBMITTED→COUNCIL_PENDING. Hội đồng xử lý là phác mở rộng, không tự tạo AwardRecord.
6. Kiểm thử unit, hồi quy W2-P2/W3-Q1, Express+Supabase thật trong schema cô lập, build/lint phần UI đổi; tài liệu nghiệm thu và giới hạn tại `docs/api/AWARD_APPLICATIONS_W3_P3.md`.

Chưa commit/push/merge. Đề xuất: `feat(W3-P3): add award applications, frozen inputs and replacement UI`.

Kết quả và danh sách file đổi: `docs/testing/week-3/W3_P3_TEST_REPORT.md`. W3-P3 + W2-P2 unit 10/10 PASS, integration 68 assertions PASS, build và lint phần UI đổi PASS. Migration chỉ được chạy trong schema test cô lập; chưa áp vào schema app dùng chung.
