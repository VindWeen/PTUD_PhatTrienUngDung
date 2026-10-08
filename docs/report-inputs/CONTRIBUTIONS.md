# Đóng góp Võ Nhạc Phước — truy nguyên theo task

Commit dưới đây là bằng chứng thay đổi trong lịch sử local theo task; không thay xác nhận tác giả Git, peer approval hoặc PR remote. Báo cáo cũ có chỗ ghi tên Nguyễn Hữu Phước: chưa có căn cứ đồng nhất với Võ Nhạc Phước; không nhận thay xác nhận nhãn đó.

| Task / commit | Đóng góp theo phạm vi P | Test / nguồn kết quả | Demo / tài liệu |
|---|---|---|---|
| W2-P4 `2e27770` | Review submit/file, tiêu chí demo có nhãn | docs/testing/week-2/W2_P4_RESULT.json | docs/api/W2_P4_DEMO_REVIEW.md; ảnh W2 fixture |
| W3-P1 `d834b6a` | Dashboard, report SQL theo scope, CSV | backend/tests/w3-p1.test.js; w3-p1.integration.js | docs/api/REPORTS_W3_P1.md |
| W3-P2 `41b5577` | KPI nội bộ, CSV, nhãn khai báo | backend/tests/w3-p2.test.js; w3-p2.integration.js | docs/api/KPI_W3_P2.md |
| W3-P3 `4723c66` | Hồ sơ đề nghị, snapshot, replacement UI | docs/testing/week-3/W3_P3_TEST_REPORT.md | docs/api/AWARD_APPLICATIONS_W3_P3.md |
| W3-P4 `372d8f3` | Review revision, benchmark fixture có nhãn | docs/testing/week-3/W3_P4_FINAL_RESULT.json | docs/testing/week-3/DEMO_W3_P4.md |
| W4-P1 `b5bedf7` | KPI recommender và accept kế hoạch | docs/testing/W4_P1_TEST_REPORT.md; cập nhật W5-P2 | docs/api/KPI_RECOMMENDATIONS_W4_P1.md |
| W4-P2 `516fd61` | Connector KPI HTTP MÔ PHỎNG | docs/testing/W4_P2_TEST_REPORT.md | docs/api/EXTERNAL_KPI_W4_P2.md |
| W4-P3 `7851e61` | Phân công Hội đồng, chặn tự duyệt | docs/testing/W4_P3_TEST_REPORT.md | docs/api/COUNCIL_W4_P3.md |
| W4-P4 `82dfd48` | Citation fail closed, UI states | docs/testing/week-4/results.json; ui-result.json | docs/testing/week-4/DEMO_AI.md |
| W5-P1 `e777e70` | Scale fixture, đo hiệu năng và scope | docs/testing/w5-p1/*result.json | docs/api/PERFORMANCE_W5_P1.md; dashboard p95 còn chưa đạt |
| W5-P2 `99a94bf` | Provider/quota/connector/CSV review | docs/ai/recommender-eval/results.json; WEEK_05_W5_P2.md | Live LLM còn thiếu key; KPI upstream mô phỏng |
| W5-P3 `37a381e` | Cài sạch, role guide, runner restore HTTP | docs/weekly/WEEK_05_W5_P3.md | docs/DEMO_SCRIPT.md; docs/USER_GUIDE.md |
| W5-P4 diff chưa commit | Review quyền/file, thử restore, khóa tư liệu | verification.json; backend/tests/w5-p4.test.js | README.md và checklist trong thư mục này |

Kết quả lịch sử phải ghi ngày/commit của nguồn, không trình bày như vừa chạy lại trong W5-P4. Demo đề xuất: đăng nhập → file chính chủ/ngoài quyền → khóa VERIFIED → dashboard/export → restore (hiện trình bày lỗi thật) → KPI mô phỏng. Không gọi LLM hay tự trao thưởng để hoàn tất báo cáo.
