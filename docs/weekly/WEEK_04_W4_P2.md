# W4-P2 — Võ Nhạc Phước

Kế hoạch DB: dùng Supabase PostgreSQL/schema app qua pg, thay DB cũ; giữ auth Express và file private. Tái sử dụng validators, quyền chính chủ, audit transaction và luồng achievements DRAFT W3-P2. Hợp đồng và hướng dẫn: [EXTERNAL_KPI_W4_P2](../api/EXTERNAL_KPI_W4_P2.md).

Triển khai: mock HTTP service-auth, connector timeout/retry có giới hạn, mapping mã immutable, staging revisions/idempotency/hash conflict/quarantine, API logs/retry và UI tạo nháp chính chủ. Không ghi đè VERIFIED, không tự trao thưởng.

Đã đọc blueprint và review/hợp đồng W3-P2/W3-Q4 trong checkout. Không tìm thấy AGENTS.md. Chưa xác minh PR remote; chưa có hợp đồng nguồn ngoài chính thức. Nguồn hiện tại luôn MÔ PHỎNG, chưa tích hợp hệ thống bên ngoài thật.

Chưa commit/push/merge. Commit đề xuất: `feat(W4-P2): add simulated KPI HTTP connector, revision staging and sync logs`.

Kiểm tra thực tế: contract/HTTP 3/3, integration mock HTTP + Express + pg/Supabase 43 assertions, hồi quy W3-P2 2/2, hợp đồng tĩnh 68/68 và frontend build PASS (cảnh báo bundle >500 kB). Báo cáo/file đổi: [W4_P2_TEST_REPORT](../testing/W4_P2_TEST_REPORT.md). Đã thử đọc PR qua GitHub REST, SSL thất bại nên chưa xác minh trạng thái PR remote.
