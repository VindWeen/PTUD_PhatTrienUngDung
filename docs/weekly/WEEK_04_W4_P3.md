# W4-P3 — Kế hoạch và bàn giao

Võ Nhạc Phước phụ trách workflow đơn vị → Hội đồng. Chốt DB: Supabase PostgreSQL qua `pg`, migration nguồn trong `supabase/migrations`; bỏ phương án SQL Server/ROWVERSION cũ. Auth Express và file private giữ nguyên.

Tái sử dụng ApplicationService và snapshot W3-P3; auth/scope W1-Q3 đã có qua PR #2; notifications W2-P3. Triển khai lần lượt migration reviews/comments, kiểm tra Council và tự xét, mutation atomic/OCC, UI hàng chờ và kết luận, tests HTTP/PostgreSQL trong schema tạm rollback. Không tự tạo AwardRecord từ kết luận.

Hợp đồng, chính sách bổ sung văn bản, bước demo và giới hạn: [COUNCIL_W4_P3.md](../api/COUNCIL_W4_P3.md). Kết quả kiểm tra thực tế: [W4_P3_TEST_REPORT.md](../testing/W4_P3_TEST_REPORT.md).

Commit đề xuất: `feat(W4-P3): add scoped council assignments and recommendation workflow`. Chưa commit/push/merge.
