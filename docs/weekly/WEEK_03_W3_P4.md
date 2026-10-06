# W3-P4 — Plan và bàn giao

Phụ trách: Võ Nhạc Phước. Không tìm thấy AGENTS.md trong workspace/thư mục cha. Đã đọc blueprint/ADR-001 và các hợp đồng W3-Q1/W3-Q2/W3-P2/W3-Q4.

**DB trong plan:** Supabase PostgreSQL/schema app qua pg thay DB SQL Server cũ, tái sử dụng migrations Supabase duy nhất. Auth Express và file private hiện có giữ nguyên. W3-P4 không cần migration mới; kiểm tra DB bằng schema ngẫu nhiên, seed synthetic và outer rollback, không tác động app dùng chung.

Phụ thuộc đã có: W3-Q1 `c03874b`, W3-Q2 `2501093`, W3-P2 `41b5577`. Kiểm tra hợp đồng/mã/lịch sử Git tại checkout; máy không có gh, chưa xác minh PR đang mở trên GitHub. Tái sử dụng KPI/achievement/evidence/regulations API, provider adapter và hợp đồng EvaluationRun. Giữ W3-P3 đã commit trước task tại `4723c66`.

1. Review revision/file v1/v2, gửi lại và thu hồi; tái hiện findings trong test schema.
2. Viết 12 ca dev và 6 initial holdout, nhãn kỹ thuật UNCONFIRMED chuyên môn, căn cứ repository version/hash và đặc tả mô phỏng riêng.
3. Tạo EvaluationRun dev fixture cho UI; bỏ kết luận/xác suất demo thiếu căn cứ.
4. Guard backend AI trước provider: quyền đọc, trạng thái VERIFIED, confirmed criterion+parent version, hiệu lực và subject target; mock không tự nhận xét đạt điều kiện.
5. Test Express/Supabase thật với provider mock; unit schema/guards, dev và frozen final, build/lint. Kết quả tại docs/testing/week-3/W3_P4_TEST_REPORT.md.

Không bị chặn ở tích hợp kỹ thuật các phụ thuộc. Benchmark chuyên môn/vendor thật bị chặn bởi quy chế áp dụng LHU và nhãn chuyên gia chưa xác nhận; thiếu API snapshot/persistence EvaluationRun thực tế. Hội đồng/GVHD cần duyệt nguồn/tiêu chí và gold labels trước benchmark eligibility.

Đề xuất commit: `feat(W3-P4): review immutable revisions and add labelled AI benchmark fixtures`. Chưa commit/push/merge.
