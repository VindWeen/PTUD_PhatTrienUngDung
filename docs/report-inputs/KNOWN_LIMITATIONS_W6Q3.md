# Giới hạn đã biết — W6-Q3 Demo Cuối

**Người lập:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W6-Q3 — Demo cuối và tag bản phát hành  
**Ngày:** 09/10/2026 (Asia/Saigon)  
**Chính sách:** Mọi phạm vi chưa xác nhận được công bố rõ; không tự tích đạt.

---

## 1. Restore End-to-End — BLOCKED

| Trường | Nội dung |
|---|---|
| **Trạng thái** | BLOCKED — cần `RESTORE_TARGET_DB_URL` trỏ DB test riêng |
| **Lý do gốc** | Schema drift `verified_by`: lỗi SQLSTATE 42703 khi restore từ DDL migration (W5-P4) |
| **Đã sửa** | Migration 009 bổ sung cột `verified_by`, `verified_at`, `submitted_at`, `version` (W6-Q1) |
| **Còn lại** | Restore integration thật (`node scripts/restore.mjs`) cần DB test env với migration 009 đã nạp |
| **Hệ quả** | HTTP file download sau restore (owner/anonymous/outside-scope) chưa nghiệm thu |
| **Không PASS** | Kết quả restore chưa đủ điều kiện PASS; không tuyên bố PASS thay bằng kết quả lịch sử |

**Hành động unblock:** Set `RESTORE_TARGET_DB_URL` → chạy migration 009 → `node scripts/restore.mjs --target-schema=app_restore_test` → kiểm hash/HTTP.

---

## 2. AI Live Provider — NOT_RUN

| Trường | Nội dung |
|---|---|
| **Trạng thái** | NOT_RUN — không có `OPENAI_API_KEY` / `GROQ_API_KEY` trong CI |
| **Evaluator offline** | PASS — 32/32 holdout (W5-Q2); rule engine offline, không phải LLM live |
| **Accuracy claim** | NONE — không tuyên bố độ chính xác AI live |
| **Chính sách quota** | Nếu quota fail → ghi log + retry schedule; không tuyên bố là kết quả mới |
| **Smoke test** | `node scripts/w5-q3-smoke-provider.mjs` sau khi set key |

---

## 3. KPI Nguồn — Mô phỏng

| Trường | Nội dung |
|---|---|
| **Nhãn bắt buộc** | **MÔ PHỎNG** — không là số liệu thực từ hệ thống LHU live |
| **Connector** | HTTP connector mô phỏng (W4-P2) |
| **Sử dụng** | Demo / development only; không dùng làm căn cứ xét khen thưởng thật |
| **Nguồn KPI thật** | Cần tích hợp hệ thống KPI LHU — thuộc phạm vi KLTN |

---

## 4. Dashboard p95 — Chưa đạt mục tiêu

| Trường | Nội dung |
|---|---|
| **Số đo** | p95 = **2078 ms** (môi trường W5-P1, seed 50 user x 200 hồ sơ) |
| **Mục tiêu** | < 2000 ms |
| **Trạng thái** | Chưa đạt; nêu rõ trong demo, không khẳng định đã đạt |
| **Nguồn** | `docs/testing/w5-p1/load-result.json` (lịch sử W5-P1) |

---

## 5. Hội đồng — Chưa có tài khoản / phân công

| Trường | Nội dung |
|---|---|
| **Trạng thái** | Seed chưa có tài khoản Hội đồng |
| **Phạm vi** | Hội đồng là phần mở rộng (KLTN); không là điều kiện nghiệm thu PTUD lõi |
| **Trong demo** | Giới thiệu giới hạn; không giả lập quyết định Hội đồng |
| **Hành động cần** | Tạo tài khoản + phân công `council` nếu muốn demo workflow mở rộng |

---

## 6. Remote PR — Chưa xác minh URL

| Trường | Nội dung |
|---|---|
| **Trạng thái** | `NOT_VERIFIED` — chưa có URL PR remote đã merge được xác nhận |
| **Kiểm tra** | `https://github.com/VindWeen/PTUD_PhatTrienUngDung/pulls` |
| **Lưu ý** | PR_REVIEW.md là bản review sẵn cho PR; không tuyên bố đã gửi review GitHub hay PR đã merge |

---

## 7. TLS — rejectUnauthorized: false

| Trường | Nội dung |
|---|---|
| **Mức** | P2 |
| **Mô tả** | Kết nối Supabase mã hóa nhưng không xác minh CA/server certificate |
| **Quyết định** | Chấp nhận cho demo free tier; ghi nhận giới hạn rõ; không sửa trong phạm vi PTUD |

---

## 8. Người cài thứ hai — Chưa xác minh

| Trường | Nội dung |
|---|---|
| **Trạng thái** | Checklist nghiệm thu độc lập (người khác từ clone mới) chưa hoàn thành |
| **Yêu cầu** | Theo DEMO_SCRIPT.md: clone mới, không dùng node_modules cũ, project Supabase riêng |

---

*Mọi giới hạn trên phải nêu trong buổi demo. Không tự tích PASS cho phần chưa nghiệm thu.*  
*W6-Q3 — Tạ Trần Vinh Quang — 09/10/2026*
