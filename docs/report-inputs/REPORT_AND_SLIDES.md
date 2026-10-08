# Mục lục báo cáo và slide cần số liệu

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
