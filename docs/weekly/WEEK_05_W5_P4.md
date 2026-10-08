# W5-P4 — Review bảo mật/restore và đóng tư liệu báo cáo

Võ Nhạc Phước · 08/10/2026, Asia/Saigon.

Bộ bàn giao: [docs/report-inputs](../report-inputs/README.md). Baseline `37a381e18dd6f07d63dcc55176f111a8f035b179` + diff W5-P4 chưa commit. Đã đọc blueprint/source/hợp đồng; không tìm thấy AGENTS.md ở repo và thư mục cha đã kiểm. Kế hoạch DB dùng Supabase PostgreSQL qua pg theo ADR-001 thay SQL Server, Express auth/file private giữ nguyên.

## Triển khai và kiểm chứng

- Review quyền/file phát hiện fallback JWT cũ khi truy vấn quyền DB lỗi. EvidenceService đã bỏ fallback đó; thêm ba ca DB lỗi/response sai/role thu hồi để bảo đảm chặn trước storage.
- Tái dùng runner P3 thử độc lập schema/thư mục riêng trên Supabase thật: migrate/seed + 5 login HTTP qua, restore DDL qua, nạp data lỗi 42703 (`achievements.verified_by`). Không thay schema nguồn, không bỏ dữ liệu để ép PASS. Runner finally dọn schema; không báo lỗi cleanup.
- `node --test backend/tests/w5-q1.test.js backend/tests/w2-q2.test.js`: 10/10 PASS trước sửa.
- `node --test backend/tests/w5-p4.test.js backend/tests/w5-q1.test.js backend/tests/w2-q2.test.js`: 13/13 PASS sau sửa, exit 0.
- `node backend/tests/w5-p3.integration.js` với env/backup cục bộ theo checklist: exit 1, restore FAIL. File/hash/quyền HTTP sau restore chưa chạy.
- Lập mục lục, slide cần số liệu, nguồn đóng góp theo commit/test/demo; khóa ảnh/ERD/workflow ứng viên bằng SHA-256. Ảnh cũ giữ nhãn fixture/mockup/UI test. ERD W1 chưa được coi là ERD live W5.

## File đổi và API

`backend/src/modules/evidences/evidenceService.js`; `backend/tests/w5-p4.test.js`; `scripts/w5-p4-freeze.mjs`; toàn bộ tài liệu/manifest/kết quả đã lược nhạy cảm trong `docs/report-inputs`; báo cáo tuần này. Không đổi endpoint hoặc payload. Download chuyển lỗi đọc quyền DB tới middleware lỗi, không dùng role JWT fallback.

## Bàn giao và phần còn lại

Q1/Q3/P3 có commit local, chưa có PR remote xác minh. [PR review](../report-inputs/PR_REVIEW.md) yêu cầu sửa drift và các guard/đối soát restore Q3 trước duyệt. Chưa nghiệm thu restore đầy đủ, file quyết định sau restore, ảnh live/ERD đồng bộ hoặc AI provider thật. Không công bố accuracy AI chưa đo; KPI upstream mô phỏng ghi rõ. Không nhận peer approval ghi tên khác làm xác nhận của Võ Nhạc Phước.

Tự kiểm theo [CHECKLIST](../report-inputs/CHECKLIST.md), chạy ba file test, rồi restore lại chỉ sau Q3 cung cấp backup đúng. `node scripts/w5-p4-freeze.mjs` tái khóa hash khi đã review đầu vào mới. Log/dump/env/file người dùng giữ Git ignore, không đưa vào báo cáo Git.

Chưa commit/push/merge. Commit đề xuất: `fix(W5-P4): fail closed evidence role lookup and freeze sourced report inputs`.
