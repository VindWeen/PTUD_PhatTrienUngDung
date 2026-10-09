# Đóng góp Tạ Trần Vinh Quang — Tổng hợp W5-Q4

Người phụ trách: Tạ Trần Vinh Quang · W5-Q4 · 09/10/2026 (Asia/Saigon)

Tài liệu này tổng hợp đóng góp của Quang theo commit/test/demo từ lịch sử nhánh đã chốt, phục vụ phần tổng hợp đóng góp và báo cáo. Không nhận thay xác nhận người khác; không gán nhãn peer lại.

---

## 1. Sơ đồ DB / API — phần Quang phụ trách

### 1.1 Thiết kế CSDL (W1-Q1)
- **Nhánh:** `quang/w1-q1`; commit `6c75a4b`
- **Đóng góp:** Chốt schema PostgreSQL schema `app`, 9 phân hệ dữ liệu, ERD Mermaid, Data Dictionary, OpenAPI contracts, business rules, migration runner và test fixtures.
- **File chính:** `docs/database/ERD.md`, `docs/database/DATA_DICTIONARY.md`, `docs/database/SCHEMA_DDL.sql`, `database/migrations/001–008_*.sql`, `docs/api/openapi.json`
- **Lưu ý:** ERD.md là tư liệu W1 — chưa bao phủ drift `verified_by` phát sinh sau W1; migrations là cấu trúc code ứng viên, không đồng nghĩa schema live.

### 1.2 Express Backend & Auth (W1-Q2)
- **Nhánh:** `quang/w1-q2`; commit `be7f2b7`
- **Đóng góp:** Setup Express server, kết nối Supabase qua `pg`, migration runner, health probes.

### 1.3 Frontend / UI fixes (W1-Q3)
- **Nhánh:** `quang/w1-q3`; commit `de1fdc6`
- **Đóng góp:** Cho phép đăng nhập bằng username (không bắt buộc email format), thêm nút demo auditor.

### 1.4 Dashboard & UI đồng bộ (W3-Q4)
- **Nhánh:** `w3q4`; commit `17c1d58`
- **Đóng góp:** Khôi phục giao diện dashboard, đồng bộ theme KPI/reports/notifications.

### 1.5 Màn hình đánh giá AI và lịch sử phiên chạy (W4-Q3)
- **Nhánh:** `w4-q3`; commit `b7f6504`
- **Đóng góp:** Hoàn thiện màn hình đánh giá, lịch sử phiên chạy AI, tái hiện snapshot, cảnh báo stale.

---

## 2. Kết quả AI — Holdout Benchmark (W5-Q2)

| Chỉ số | Ngưỡng | Kết quả | Nguồn |
|---|:---:|:---:|---|
| Accuracy (Evaluator-Only) | ≥ 95% | **100%** (32/32) | `docs/ai/evaluation/evaluation_run_results.json` |
| False Eligible | 0 ca | **0 ca** | idem |
| Missing Data → NEEDS_HUMAN_REVIEW | 100% | **100%** (15/15) | idem |
| Citation Precision (RAG) | ≥ 90% | **100%** | idem |
| Latency Evaluator-Only | < 500 ms | **0.102 ms** | idem |
| Latency Evaluator+RAG | < 500 ms | **111.6 ms** | idem |

> **Nhãn nguồn:** Evaluator-Only là rule engine offline (không dùng LLM real). RAG dùng local embedding với MockAiProvider trong unit test. Số liệu này **không phải** accuracy của LLM live thật; không suy rộng như kết quả AI tổng quát.

### Phương pháp đo (tóm tắt)
- Tập giữ lại: 32 hồ sơ độc lập (`HOLDOUT-01` đến `HOLDOUT-32`), 8 nhóm kiểm thử, không trùng dev/final splits.
- Peer-validated: 100% nhãn xác nhận bởi thành viên còn lại trước khi chạy (`labelAuthority: CONFIRMED_BY_PEER_REVIEWER`).
- Ngưỡng chốt trước kiểm thử (pre-agreed thresholds).
- Kiến trúc đề xuất: Hybrid 2 tầng — Evaluator-Only cho batch/form, Evaluator+RAG cho màn hình Hội đồng.

---

## 3. Danh sách commit và test của Quang (W3–W5)

| Task | Nhánh / Commit | Test chính | Ghi chú |
|---|---|---|---|
| W3-Q1 | `w3q1 c03874b` | `tests/w3-q1.test.js` | Resubmit revisions, mandatory cancel/reject, replacement |
| W3-Q2 | `w3q2 2501093` | `tests/w3-q2.test.js` | Kho văn bản, phiên bản và tiêu chí được duyệt |
| W3-Q3 | `w3q3 7dafe57` | `tests/w3-q3.test.js` | Provider adapter, thử nghiệm Groq/OpenRouter thật |
| W3-Q4 | `w3q4 17c1d58` | — | Dashboard/UI đồng bộ theme |
| W4-Q1 | `w4-q1 7785e14` | `tests/w4-q1.test.js` | Bộ kiểm tra tiêu chí có cấu trúc, evaluation runs, snapshot |
| W4-Q2 | `w4-q2 524aa28` | `tests/w4-q2.test.js` | RAG và giải thích có trích dẫn kiểm chứng, phòng thủ prompt injection |
| W4-Q3 | `w4-q3 b7f6504` | `tests/w4-q3.test.js` | Màn hình đánh giá, lịch sử phiên AI, snapshot, stale warning |
| W4-Q4 | `w4-q4 fa7aa5c` | `tests/w4-q4.integration.js` | Review recommender council workflow, multi-criteria connectivity |
| W5-Q1 | `w5-q1 487a962` | `tests/w5-q1.test.js` | Hồi quy bảo mật quyền, file private, OCC, pg transaction rollback |
| W5-Q2 | `w5-q2 d1572ab` | `tests/w5-q2.test.js` | Holdout benchmark 32 ca, Evaluator-Only vs RAG |
| W5-Q3 | `w5-q3 fca04cc` | `tests/w5-q3.test.js` | Demo, backup/restore, runbook |
| W5-Q4 | nhánh `w5-q4` (chưa commit) | `tests/w5-q4.test.js` | Review RC, phân loại lỗi, đóng bản ứng viên |

---

## 4. Sơ đồ DB tổng quan (9 phân hệ — W1-Q1)

```
app.users ←→ app.roles (qua app.user_roles)
app.users → app.user_unit_scopes → app.organization_units
app.users → app.lecturers → app.lecturer_assignments
app.achievements → app.evidence_files (private storage)
app.achievements → app.achievement_verifications
app.achievements → app.award_applications → app.award_records
app.award_records → app.award_decisions → app.award_decision_files
app.criteria / app.achievement_categories / app.academic_years (catalogs)
app.audit_logs / app._schema_migrations (system)
```

**Drift chưa trong migrations DDL:**
- `app.achievements.verified_by BIGINT` — có trong live schema và `achievementRepository.js` nhưng thiếu file migration. Nguyên nhân lỗi 42703 khi restore từ DDL. **Cần migration 009.**

---

## 5. Danh sách API endpoint chính (openapi.json)

| Nhóm | Endpoint | Phương thức | Ghi chú |
|---|---|---|---|
| Auth | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/change-password` | POST/GET | JWT + cookie HttpOnly |
| Thành tích | `/achievements`, `/achievements/{id}`, `/achievements/{id}/submit`, `/achievements/{id}/cancel`, `/achievements/{id}/verify`, `/achievements/{id}/reject`, `/achievements/{id}/revoke`, `/achievements/{id}/request-correction`, `/achievements/{id}/history`, `/achievements/{id}/evidences` | GET/POST/PATCH | RBAC + OCC version |
| Minh chứng | `/evidences/{id}/versions`, `/evidence-files/{id}/download` | GET | Private storage, quyền kiểm trước download |
| Khen thưởng | `/award-records`, `/award-records/{id}/record`, `/award-records/{id}/revoke`, `/award-decisions`, `/award-decision-files/{id}/download` | GET/POST/PATCH | Hội đồng phân công |
| Báo cáo | `/reports/achievements`, `/reports/awards`, `/reports/export.csv`, `/dashboard/summary` | GET | Scope phân quyền, CSV vệ sinh |
| Admin | `/admin/users`, `/admin/roles`, `/admin/user-roles`, `/admin/scopes`, `/admin/representatives`, `/admin/academic-years`, `/admin/achievement-types`, `/admin/award-types` | CRUD | Admin only |
| Profile/Đơn vị | `/me/profile`, `/lecturers/{id}`, `/units/{id}/profile`, `/organizations`, `/organizations/{id}` | GET | |
| Thông báo | `/notifications`, `/notifications/{id}/read`, `/approvals/pending` | GET/PATCH | |

---

*Nguồn KPI upstream: MÔ PHỎNG — không là số liệu thực từ hệ thống LHU live. Không dùng làm căn cứ khen thưởng.*  
*Chưa commit/push/merge.*
