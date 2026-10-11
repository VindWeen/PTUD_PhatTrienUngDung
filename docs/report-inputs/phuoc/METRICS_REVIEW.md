# Review số liệu Quang và phần Phước

Review mã và artefact ngày 11/10/2026; không xác nhận thay peer reviewer, không sửa báo cáo của Quang.

| Claim / nguồn | Đối chiếu thực tế | Cách dùng |
|---|---|---|
| Q4: evaluator 32/32, false eligible 0, thiếu dữ liệu 15/15 | evaluation_run_results.json có đúng số tổng; labels trong holdout tự ghi CONFIRMED_BY_PEER_REVIEWER, tên Nguyễn Hữu Phước, không phải Võ Nhạc Phước | Chỉ nói kết quả rule engine theo nhãn lưu; chưa có xác nhận độc lập thẩm quyền nhãn |
| Q4: RAG citation precision 100%, latency 111.6 ms | scripts/w5-q2-eval.mjs ép forcedProvider='mock'; token được ước lượng 430/120/45 | Là benchmark mock lịch sử; không là LLM live, token billing hoặc chứng thực pháp lý |
| Q4: latency evaluator 0.102 ms | JSON là trung bình 32 ca, không phải p95 HTTP; ngày đo 07/10 | Không so trực tiếp với API/dashboard hoặc dùng làm SLA |
| Q4: version stack React18/Vite5/Tailwind3, Node>=18 | frontend package.json khai Vite ^6.0.7; README cần Node20.19+/22.12+ | Ưu tiên package-lock/runtime và README; bảng Q4 cần Quang đối soát trước slide |
| Q3: migration009/P1 đã fix | Test Q3 chủ yếu kiểm artefact/nội dung; P3 dẫn P2 FAIL restore 42703 do nguồn migration khác legacy | Cần kiểm Supabase/restored thật, không thay FAIL tích hợp bằng PASS test tài liệu |
| Q3: 38/38 PASS | Chạy lại W6-P4: đúng 38 PASS, 0 fail | Test cấu trúc/tài liệu, không có buổi demo live trong lệnh này |
| P2 recommender 32/32 | results.json: 3 positive, 29 negative, false/missed 0, groundedSuggestions 3 | Gate offline trên holdout Q2 tái dùng; không là unseen accuracy hoặc 32 citation có gợi ý |

KPI source **MÔ PHỎNG**, confirmed flags trong fixture không phải xác nhận quy chế. Mapping recommendation tác giả tự dẫn xuất còn chờ review độc lập. Chỉ dùng nguồn/tiêu chí xác nhận đúng thẩm quyền khi chạy thật; không lấy ví dụ holdout làm căn cứ trao thưởng.

## Hiệu năng Phước — lịch sử 08/10/2026

performance.json tính lại p95 nearest rank từ samplesMs: bốn kết quả đều khớp số gốc. Dữ liệu synthetic: 100 lecturers, 10 units, 5000 achievements, 7 năm; 10 client, 200 request/endpoint, warmup 10 theo WEEK_05_W5_P1. Máy i5-11400H, 16 GiB, Windows, Node20.20.1; Express local, Supabase remote TLS. Không tính login/seed/AI/upload/export; closed-loop không suy ra throughput production.

| Lượt | Achievements p95 ms | Dashboard p95 ms | Ngưỡng <2000 ms |
|---|---:|---:|---|
| load-result | 1650.780 | 2078.418 | Achievements đạt, dashboard chưa đạt |
| overlapping-load-result | 2167.016 | 2873.549 | Cả hai chưa đạt khi chạy chồng tải |

Không chọn riêng lượt đẹp để nói toàn bộ hiệu năng đạt. browser-result ghi login/report thật với dữ liệu synthetic; UI width 390/768/1440 ở ui-result là kiểm bố cục lịch sử, không là ảnh release mới. Chưa chạy lại load hoặc live AI trong W6-P4 vì task gom tư liệu và release/dependency chưa thống nhất.
