# Tư liệu báo cáo học phần

**Điểm bắt đầu hiện tại — 04/11/2026:** xem [khung báo cáo theo mẫu học phần](REPORT_AND_SLIDES.md) để áp dụng bố cục 4 chương cho dự án Quản lý Hồ sơ Thành tích Số & Khen thưởng LHU. Mẫu được đọc là file Word người dùng cung cấp; nội dung thuê xe và công nghệ trong mẫu chỉ là ví dụ, không phải yêu cầu đổi công nghệ của dự án.

Bản báo cáo Word cho lớp **23CT112**, GVHD **Hồ Ngọc Hoàng Long**, thành viên **Tạ Trần Vinh Quang — 123000033** và **Võ Nhạc Phước — 123000034**, thời gian **11/2026**, được tạo tại [output/reports/BaoCao_PhatTrienUngDung_23CT112.docx](../../output/reports/BaoCao_PhatTrienUngDung_23CT112.docx). Tên đề tài trên bìa để trống theo yêu cầu; file đầu ra nằm trong workspace, có thể không được Git theo dõi.

Phạm vi triển khai hiện tại tra [README gốc](../../README.md), luồng sử dụng tra [USER_GUIDE](../USER_GUIDE.md), cải thiện giao diện và ảnh mới tra [UI_VISUAL_AUDIT](../testing/UI_VISUAL_AUDIT.md). Các đoạn và bộ tư liệu W5-P4 dưới đây giữ làm lịch sử tại mốc bàn giao, không mô tả trạng thái live ngày 04/11.

## Bộ tư liệu ứng viên tại mốc W5-P4

Võ Nhạc Phước · 08/10/2026 (Asia/Saigon). Trạng thái: **đóng bộ tư liệu ứng viên, chưa nghiệm thu restore**.

Baseline code: `37a381e18dd6f07d63dcc55176f111a8f035b179` (W5-P3), cộng diff W5-P4 chưa commit. Danh sách và SHA-256 tư liệu ở [candidate-manifest.json](candidate-manifest.json); manifest không tự băm chính nó. Đây là khóa phiên bản đầu vào, không là chứng nhận mọi ảnh/ERD đúng với DB live.

Đã đọc blueprint `docs/PROJECT_DEVELOPMENT_BLUEPRINT.md`, source và hợp đồng API. Không tìm thấy AGENTS.md trong repo, `C:/Drive D` hoặc `C:/`. Kế hoạch dùng ADR-001: Supabase PostgreSQL qua pg/TLS thay SQL Server; Express auth và file private giữ nguyên. Backend quyết định quyền/phạm vi/trạng thái. Không đổi endpoint/payload/schema DB chung.

## Hồ sơ bàn giao

- [CHECKLIST.md](CHECKLIST.md): nghiệm thu, lệnh kiểm tra và phần chặn.
- [PR_REVIEW.md](PR_REVIEW.md): review quyền/file/restore và yêu cầu sửa trước duyệt.
- [CONTRIBUTIONS.md](CONTRIBUTIONS.md): đóng góp Phước gắn commit/test/demo.
- [REPORT_AND_SLIDES.md](REPORT_AND_SLIDES.md): mục lục, slide và nguồn số liệu.
- [ASSETS.md](ASSETS.md): bộ ảnh/ERD/workflow và giới hạn sử dụng.
- [verification.json](verification.json): kết quả đã lược dữ liệu nhạy cảm của lượt W5-P4.

## Phụ thuộc và phiên bản

| Phần | Commit local có trong baseline | Kết luận W5-P4 |
|---|---|---|
| W5-Q1 | `487a962` | Có source/hợp đồng, hồi quy quyền/file chạy lại; không suy rộng unit thành nghiệm thu HTTP toàn bộ |
| W5-Q3 | `fca04cc` | Restore độc lập FAIL lệch schema; chưa đạt |
| W5-P3 | `37a381e` | Tái dùng runner cô lập, migrate/seed/5 login qua; HTTP file restored bị chặn từ Q3 |

Chat artifacts trống khi kiểm tra; chưa có URL PR hoặc trạng thái remote được xác minh. PR_REVIEW là bản review sẵn cho PR, không tuyên bố đã gửi review GitHub hay PR đã merge. Không commit/push/merge trong W5-P4.

Nguồn KPI connector là **MÔ PHỎNG**; test gate offline không là độ chính xác LLM. Không dùng kết luận AI hoặc căn cứ chưa xác nhận để trao thưởng. Không đưa dump, env, key, file người dùng hoặc log HTTP chi tiết vào bộ Git.
