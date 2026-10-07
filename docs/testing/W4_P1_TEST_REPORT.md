# W4-P1 — Kiểm thử thực tế ngày 07/10/2026

- `npm --prefix backend run test:w4-p1`: PASS 5/5, gồm ngưỡng giữ nguyên, thiếu nguồn/dữ liệu, nhiều năm và pg Date.
- `node --test backend/tests/w4-p1.test.js backend/tests/w4-q1.test.js backend/tests/w3-q3.test.js`: PASS 16/16 (5 + 6 + 5).
- `npm --prefix backend run test:w3-p2`: PASS 2/2.
- `npm --prefix backend run test:w4-p1:integration`: PASS 28 assertions, evaluator + Express + Supabase thật, provider stub. Gồm chặn rút điều kiện 3 năm thành một năm và chấp nhận kỳ đủ 3 năm.
- `npm --prefix backend run test:w3-p2:integration`: chạy lại riêng PASS 86 assertions, schema rollback và lỗi audit 500 được inject có chủ đích. Lần chạy đầu exit 1 / PostgreSQL 57014 (statement timeout trong vòng áp migration của harness), chưa tới kiểm tra nghiệp vụ; không tính lần đó là PASS.
- `npm --prefix frontend run lint`: PASS.
- `npm --prefix frontend run build`: PASS; Vite cảnh báo chunk >500 kB, không phải lỗi build.
- `npm --prefix backend run test:w4-p1:real-provider`: BLOCKED/exit 1 vì không có key Groq/OpenRouter. Không có cuộc gọi LLM thật, chưa có real-provider evidence.

Integration dùng Supabase thật, schema ngẫu nhiên, tất cả migrations kể cả 22 và seed MO PHONG, outer transaction rollback; provider stub được ghi nhãn STUB-NOT-REAL. Luồng chạy trực tiếp evaluator W4-Q1, không dùng run dựng sẵn. Kiểm tra tạo gợi ý không tạo goal, accept mới tạo goal ACCEPTED và liên kết run, chống forge target, ngoài quyền/version cũ/accept lặp, reject không tạo goal, giữ kỳ nhiều năm và nguồn/stale thay đổi. Đây không phải test race song song hay browser QA.

Chi tiết API, file và thao tác tự kiểm tra: `docs/api/KPI_RECOMMENDATIONS_W4_P1.md`.
