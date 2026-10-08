# W5-P4 — Bộ tư liệu báo cáo ứng viên

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
