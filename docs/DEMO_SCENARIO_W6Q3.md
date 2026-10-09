# Kịch bản Demo Cuối — W6-Q3
## PTUD → Đề nghị khen thưởng → AI gợi ý → KPI

**Người trình bày:** Tạ Trần Vinh Quang (phần kỹ thuật) + Võ Nhạc Phước (phần nghiệp vụ)  
**Thời lượng:** 12–15 phút  
**Môi trường:** API mode, Supabase thật, kho file private thật, môi trường demo riêng.  
**Bắt buộc:** Không dùng fixture để tuyên bố tích hợp. KPI/AI mô phỏng gắn nhãn rõ.

---

## Chuẩn bị trước buổi demo

1. Kiểm readiness: `Invoke-RestMethod http://localhost:5000/api/v1/health/readiness` → DB phải `UP`.
2. Tài khoản seed (`demo1234`): `an.nv` (giảng viên), `bich.tt` (manager + giảng viên), `duc.pm` (admin), `cuong.lh` (đại diện tập thể), `records.demo` (văn thư).
3. Chuẩn bị một file PDF mẫu (không có dữ liệu thật) sẵn sàng upload.
4. Không seed lại nếu DB đã có dữ liệu cần giữ.
5. Không hiển thị env/token/DB URL trong quá trình demo.

---

## Kịch bản chi tiết

| Phút | Bước | Người dùng | Thao tác | Kết quả cần kiểm / nói |
|:---:|---|---|---|---|
| 0–1 | **Giới thiệu kiến trúc** | — | Trình bày sơ đồ: React → Express REST `/api/v1` → Supabase PostgreSQL. Auth Express JWT+cookie; file private trên server. Supabase chỉ giữ metadata. | Không vẽ Supabase Auth/public bucket. ADR-001 đã thay SQL Server. |
| 1–2 | **Kiểm readiness** | — | `GET /api/v1/health/readiness` → `{"db":"UP"}` | DB phải UP; chỉ load trang login KHÔNG chứng minh DB. |
| 2–4 | **Đăng nhập + hồ sơ cá nhân** | `an.nv` | Đăng nhập bằng username/password. Mở hồ sơ cá nhân. | Tài khoản ACTIVE từ DB, không login bằng email tùy ý như bản UI demo đầu. |
| 4–6 | **Tạo thành tích + upload minh chứng** | `an.nv` | Tạo hồ sơ nháp → điền thông tin → upload PDF mẫu → gửi (`POST /achievements/{id}/submit`). | Lưu API thật. File ở kho private, không có public URL. Status chuyển SUBMITTED. |
| 6–8 | **Xác nhận bởi Manager** | `bich.tt` | Đăng nhập. Mở hồ sơ vừa gửi. Xem lịch sử. Xác nhận (`PATCH /achievements/{id}/verify`). | Phạm vi phân công; manager không tự duyệt thành tích của mình. OCC version guard. |
| 8–9 | **Kịch bản yêu cầu bổ sung** | `bich.tt` + `an.nv` | `bich.tt` yêu cầu bổ sung có lý do → `an.nv` bổ sung và gửi lại. | Lịch sử và version backend kiểm; không lách 409 Conflict. |
| 9–11 | **Dashboard, Reports, CSV export** | `bich.tt` | Mở Dashboard → Reports → lọc năm học/trạng thái → Export CSV. | Giữ đúng filter phân quyền. Chú ý: dashboard p95 hiện **2078 ms**, chưa đạt mục tiêu <2s (W5-P1) — nêu giới hạn rõ. |
| 11–13 | **KPI / AI Gợi ý** | `bich.tt` hoặc `duc.pm` | Mở màn hình AI evaluator. Chạy đánh giá hồ sơ VERIFIED. Xem gợi ý KPI. | **Gắn nhãn rõ: KPI MÔ PHỎNG, nguồn connector SIMULATED.** AI gợi ý, con người quyết định. Không tuyên bố AI trao thưởng. Nếu provider live: nêu key/quota kiểm trước. |
| 13–14 | **Backup/Restore và giới hạn** | — | Giới thiệu `scripts/backup.mjs` và `scripts/restore.mjs`. Nêu rõ: restore end-to-end hiện **BLOCKED** (cần DB test env riêng với `RESTORE_TARGET_DB_URL`). Migration 009 đã fix schema drift `verified_by`. | Không trình diễn restore phá hủy schema. Nêu P1 đã fix, tình trạng nghiệm thu restore. |
| 14–15 | **Giới thiệu vai trò Admin + tổng kết giới hạn** | `duc.pm` | Mở menu Admin: quản lý tài khoản, đơn vị, danh mục. | Admin không mặc nhiên có quyền xác nhận chuyên môn. Hội đồng cần tài khoản/phân công riêng — chưa có trong bản demo. |

---

## Xử lý lỗi trong buổi demo

| Tình huống | Cách xử lý |
|---|---|
| Network / API lỗi | Hiển thị lỗi thật; giải thích quy trình bằng lời; không dùng fixture để thay thế |
| AI provider quota lỗi | Ghi log, giải thích kiến trúc evaluator offline; không tự gọi là PASS live |
| DB không UP readiness | Dừng demo phần DB; giải thích kiến trúc; không fake health |
| Restore thất bại | Đã kỳ vọng: nêu blocker restore (cần RESTORE_TARGET_DB_URL) |

---

## Ghi chú nghiệm thu

- **AI live:** Chỉ nghiệm thu nếu có key và quota thật trước buổi demo. Mock → gắn nhãn mô phỏng, không tính là AI thật.
- **KPI:** Connector mô phỏng — ghi nhãn rõ, không suy rộng là số liệu LHU.
- **Hội đồng:** Chưa có tài khoản và phân công — không giả lập quyết định hội đồng.
- **Restore:** Nghiệm thu đầy đủ (HTTP owner/anonymous/outside-scope) chỉ khi `RESTORE_TARGET_DB_URL` có sẵn; hiện BLOCKED.
- **Dashboard p95:** 2078 ms trong môi trường W5-P1 — chưa đạt mục tiêu <2s. Nêu giới hạn, không khẳng định đạt.

---

*Nguồn KPI: MÔ PHỎNG. AI hỗ trợ quyết định, không ban hành quyết định khen thưởng.*  
*W6-Q3 — Tạ Trần Vinh Quang — 09/10/2026*
