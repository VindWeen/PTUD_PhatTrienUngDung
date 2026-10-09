# Bàn giao kỹ thuật Quang — W6-Q4

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W6-Q4 — Bàn giao phần kỹ thuật của Quang  
**Ngày:** 09/10/2026 (Asia/Saigon)  
**Phụ thuộc đã xác minh:** W6-Q3 (release record, known limitations, demo scenario)

Tài liệu này gom ERD, kiến trúc, workflow, kết quả Validator, commit/PR list của Quang, phục vụ viết báo cáo và slide sau 28/10. Không nhận thay đóng góp của Phước; không tự trao thưởng hoặc tự xác nhận tiêu chí.

---

## 1. ERD và Thiết kế CSDL (W1-Q1)

### 1.1 Sơ đồ 9 phân hệ (tóm tắt)

```
app.users ←→ app.roles (qua app.user_roles)
app.users → app.user_unit_scopes → app.organization_units
app.users → app.lecturers → app.lecturer_assignments
app.achievements → app.evidence_files (private storage)
app.achievements → app.achievement_verifications
app.achievements → app.award_applications → app.award_records
app.award_records → app.award_decisions → app.award_decision_files
app.criteria / app.achievement_categories / app.academic_years (danh mục)
app.audit_logs / app._schema_migrations (hệ thống)
```

**Nguồn:** `docs/database/ERD.md` + `docs/database/DATA_DICTIONARY.md` (W1-Q1, commit `6c75a4b`)  
**Lưu ý:** ERD.md là tư liệu W1; drift live `verified_by` được ghi nhận và fix bởi migration 009 (W6-Q1).

### 1.2 Migration status (001–009)

| Migration | Nội dung | Trạng thái |
|:---:|---|:---:|
| 001 | Schema `app`, extensions | ✅ |
| 002 | `users`, `roles`, `user_roles`, `user_unit_scopes` | ✅ |
| 003 | `organization_units`, `lecturers`, `lecturer_assignments` | ✅ |
| 004 | `achievement_categories`, `academic_years`, `award_types` | ✅ |
| 005 | `achievements` (legacy, PostgreSQL-compat) | ✅ |
| 006 | `evidence_files`, `achievement_verifications` | ✅ |
| 007 | `award_applications`, `award_records`, `award_decisions` | ✅ |
| 008 | `audit_logs`, `_schema_migrations`, `criteria` | ✅ |
| 009 | ADD COLUMN verified_by, verified_at, submitted_at, version (W6-Q1 drift fix) | ✅ |

**Drift đã fix:** `achievements.verified_by BIGINT` bị thiếu trong migrations DDL (phát hiện W5-P4, fix W6-Q1).  
**Nguồn:** `database/migrations/*.sql`

---

## 2. Kiến trúc hệ thống

### 2.1 Stack đã chốt (DEMO_VERSION_CONFIG.json — W6-Q1)

| Tầng | Công nghệ | Phiên bản |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | 18 / 5 / 3 |
| Backend | Node.js + Express | ≥18 / 4.21.2 |
| DB driver | pg (node-postgres) | 8.23.1 |
| Auth | jsonwebtoken + bcryptjs | 9.0.2 / — |
| Validation | zod | 3.24.1 |
| Upload | multer | 2.4.0 |
| Security | helmet | 8.0.0 |
| Database | PostgreSQL (Supabase), schema `app` | — |
| Auth model | Express JWT + HttpOnly refresh cookie + token rotation | — |
| File storage | Private, Express-controlled, LocalStorageAdapter | — |

### 2.2 Quyết định kiến trúc (ADR-001 — W1-Q1/Q2)

Chuyển từ SQL Server cục bộ sang **Supabase PostgreSQL qua driver `pg`**. Schema `app` cô lập; Data API (`anon`/`authenticated` roles) bị thu hồi quyền để tránh bypass nghiệm vụ qua PostgREST. Auth và private storage vẫn do Express kiểm soát hoàn toàn.

### 2.3 Cơ chế bảo vệ chính

- **OCC (Optimistic Concurrency Control):** `WHERE id = $1 AND version = $2` → 409 Conflict khi conflict.
- **Auth:** JWT access token in-memory; refresh token HttpOnly cookie với thu hồi DB + rotation.
- **File:** Download qua `/api/v1/evidence-files/:id/download` — kiểm chủ hồ sơ/đại diện/role+scope trước khi đọc byte.
- **CSV export:** Vệ sinh formula injection; giữ scope phân quyền.

---

## 3. Workflow và State Machine (W3-Q1)

### 3.1 Trạng thái hồ sơ thành tích

```
DRAFT → [Gửi] → SUBMITTED → [Xác nhận] → VERIFIED
                           → [Yêu cầu bổ sung] → NEED_CORRECTION → [Gửi lại] → SUBMITTED
                           → [Từ chối] → REJECTED
DRAFT / SUBMITTED / NEED_CORRECTION → [Hủy] → CANCELLED
VERIFIED → [Thu hồi] → REVOKED
```

**Quy tắc bảo vệ:**
- Người tạo/nộp **không được tự xác nhận**.
- Manager không xác nhận thành tích cá nhân mình.
- VERIFIED khóa nội dung/minh chứng; sửa sai bằng thu hồi + tạo bản thay thế.
- Mỗi gửi lưu snapshot nội dung + phiên bản file đúng lúc gửi.

**Nguồn:** `docs/api/WORKFLOW_W3_Q1.md` + `backend/src/modules/achievements/achievementService.js`

### 3.2 Revision / Snapshot

Mỗi lần gửi/gửi lại → snapshot `achievement_verifications` lưu nội dung + file version tại thời điểm. VERIFIED không ghi đè; phải thu hồi và tạo bản mới.

---

## 4. Kết quả AI Validator — Holdout Benchmark (W5-Q2)

> **Nhãn bắt buộc:** Evaluator-Only là rule engine OFFLINE; không phải LLM live thật. Số liệu này không suy rộng thành accuracy AI tổng quát.

| Chỉ số | Ngưỡng (pre-agreed) | Kết quả | Nguồn |
|---|:---:|:---:|---|
| Accuracy (Evaluator-Only) | ≥ 95% | **100%** (32/32) | `docs/ai/evaluation/evaluation_run_results.json` |
| False Eligible | 0 ca | **0 ca** | idem |
| Missing Data → NEEDS_HUMAN_REVIEW | 100% | **100%** (15/15) | idem |
| Citation Precision (RAG) | ≥ 90% | **100%** | idem |
| Latency Evaluator-Only | < 500 ms | **0.102 ms** | idem |
| Latency Evaluator+RAG | < 500 ms | **111.6 ms** | idem |

**Phương pháp:**
- Tập giữ lại: 32 hồ sơ độc lập (HOLDOUT-01 đến HOLDOUT-32), 8 nhóm, không trùng dev/final splits.
- Peer-validated: nhãn xác nhận bởi thành viên còn lại trước khi chạy (`labelAuthority: CONFIRMED_BY_PEER_REVIEWER`).
- Ngưỡng chốt trước kiểm thử (pre-agreed thresholds).
- Kiến trúc: Hybrid 2 tầng — Evaluator-Only cho batch/form; Evaluator+RAG cho màn hình Hội đồng.

**Bằng chứng test:** `npm run test:w5-q2` → **6/6 PASS** (kiểm tập holdout, threshold, nhãn nguồn).

---

## 5. Danh sách commit và PR của Quang

| Task | Nhánh / Commit | Test chính | Ghi chú |
|---|---|---|---|
| W1-Q1 | `quang/w1-q1` / `6c75a4b` | — | Schema PostgreSQL, ERD, API contract, migrations 001–008 |
| W1-Q2 | `quang/w1-q2` / `be7f2b7` | — | Express server, Supabase pg, migration runner, health probes |
| W1-Q3 | `quang/w1-q3` / `de1fdc6` | — | Login bằng username, nút demo auditor |
| W3-Q1 | `w3q1` / `c03874b` | `tests/w3-q1.test.js` | Resubmit revisions, cancel/reject bắt buộc, replacement |
| W3-Q2 | `w3q2` / `2501093` | `tests/w3-q2.test.js` | Kho văn bản, phiên bản, tiêu chí được duyệt |
| W3-Q3 | `w3q3` / `7dafe57` | `tests/w3-q3.test.js` | Provider adapter, Groq/OpenRouter thật |
| W3-Q4 | `w3q4` / `17c1d58` | — | Dashboard/UI đồng bộ theme |
| W4-Q1 | `w4-q1` / `7785e14` | `tests/w4-q1.test.js` | Tiêu chí có cấu trúc, evaluation runs, snapshot |
| W4-Q2 | `w4-q2` / `524aa28` | `tests/w4-q2.test.js` | RAG + trích dẫn, phòng thủ prompt injection |
| W4-Q3 | `w4-q3` / `b7f6504` | `tests/w4-q3.test.js` | Màn hình đánh giá, lịch sử phiên AI, stale warning |
| W4-Q4 | `w4-q4` / `fa7aa5c` | `tests/w4-q4.integration.js` | Recommender council workflow, multi-criteria |
| W5-Q1 | `w5-q1` / `487a962` | `tests/w5-q1.test.js` | Hồi quy bảo mật quyền, file private, OCC, pg transaction |
| W5-Q2 | `w5-q2` / `d1572ab` | `tests/w5-q2.test.js` | Holdout benchmark 32 ca, Evaluator-Only vs RAG |
| W5-Q3 | `w5-q3` / `fca04cc` | `tests/w5-q3.test.js` | Demo, backup/restore script, runbook vận hành |
| W5-Q4 | `w5-q4` / `d3986f0` | `tests/w5-q4.test.js` | Review RC, phân loại lỗi P1/P2, đóng bản ứng viên |
| W6-Q1 | `w6-q1` / `1638173` | `tests/w6-q1.test.js` | Fix P1 schema-drift, containment check, fail-hard restore |
| W6-Q2 | `w6-q2` / `afd2377` | `tests/w6-q2.test.js` | Kiểm chứng migration, backup/restore script, hash manifest |
| W6-Q3 | `w6-q3` / *(nhánh này)* | `tests/w6-q3.test.js` | Demo cuối, kịch bản, release record, known limitations |
| W6-Q4 | `w6-q3` / *(nhánh này)* | `tests/w6-q4.test.js` | Bàn giao kỹ thuật, tư liệu báo cáo |

**PR remote:** Chưa có URL PR remote đã merge được xác minh. Kiểm tại `https://github.com/VindWeen/PTUD_PhatTrienUngDung/pulls`.

---

## 6. Kiểm chéo nội dung Phước — Nhận xét và Chuẩn bị Q&A

### 6.1 Nhận xét về bộ tư liệu Phước (CONTRIBUTIONS.md)

| Hạng mục | Đánh giá | Lưu ý |
|---|:---:|---|
| Phân công task P đúng với lịch sử commit | ✅ | Commit hash ghi rõ; nguồn lịch sử local |
| Tách rõ fixture/mockup/KPI mô phỏng | ✅ | Nhãn `FIXTURE`, `SIMULATED` nhất quán |
| Không nhận thay tên peer cũ chưa xác định | ✅ | Ghi rõ "chưa có căn cứ đồng nhất" |
| Kết quả restore W5-P3 ghi đúng FAIL | ✅ | Exit 1, lỗi 42703 được ghi |
| PR_REVIEW.md ghi đúng "chưa có URL remote" | ✅ | Không tuyên bố PR đã merge |
| Dashboard p95 ghi đúng 2078 ms chưa đạt | ✅ | Nguồn `w5-p1/load-result.json` |
| Số liệu AI accuracy không suy rộng quá | ✅ | Nhãn "offline evaluator gate" |

### 6.2 Câu hỏi kỹ thuật thường gặp — Chuẩn bị trả lời

**Q: Tại sao chọn Supabase thay SQL Server?**  
A: ADR-001 (W1-Q1): linh hoạt cloud, free tier, PostgreSQL chuẩn, dễ mở rộng cho KLTN. Supabase chỉ là PostgreSQL host; mọi logic vẫn qua Express — không dùng Supabase Auth/PostgREST/public bucket.

**Q: Auth hoạt động như thế nào?**  
A: JWT access token ngắn hạn (in-memory frontend); refresh token HttpOnly cookie (không đọc được từ JS). Khi refresh: verify DB → xoay token → thu hồi token cũ. Backend kiểm quyền DB trước mỗi action; không fallback JWT cũ khi DB lỗi (fix W5-P4).

**Q: OCC là gì? Tại sao dùng?**  
A: Optimistic Concurrency Control — `version INTEGER` tăng mỗi lần update. `WHERE id=$1 AND version=$2` → nếu ai đó đã update thì version không khớp → 409 Conflict thay vì ghi đè mù. Không cần lock.

**Q: File private được bảo vệ thế nào?**  
A: File lưu ở kho private server; không có URL public. Download qua `/api/v1/evidence-files/:id/download` — backend kiểm: tài khoản ACTIVE, chủ hồ sơ/đại diện đơn vị/role có scope hợp lệ → đọc byte → stream response. `LocalStorageAdapter` chặn path traversal và absolute path.

**Q: AI Validator hoạt động thế nào? Độ chính xác?**  
A: Evaluator-Only: rule engine offline, không dùng LLM. Kiểm tiêu chí có cấu trúc (criteria), trả kết quả `ELIGIBLE/NOT_ELIGIBLE/NEEDS_HUMAN_REVIEW`. Holdout 32 ca → 100% accuracy (W5-Q2). **Không suy rộng là accuracy LLM live.** RAG dùng local embedding trong unit test.

**Q: KPI nguồn từ đâu?**  
A: Connector HTTP mô phỏng (W4-P2) — **MÔ PHỎNG**, không phải KPI LHU thật. Gắn nhãn rõ. Tích hợp thật thuộc KLTN.

**Q: Restore có hoạt động không?**  
A: Scripts đã có (backup.mjs/restore.mjs), P1 blockers đã fix (W6-Q1): migration 009 fix schema drift, containment check, fail-hard download. Restore integration thật (DB test env riêng) **BLOCKED** — chưa có `RESTORE_TARGET_DB_URL` trong CI. Không tuyên bố restore PASS.

---

## 7. Hướng dẫn tự kiểm tra

```powershell
cd C:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\backend

# W6-Q4: tư liệu bàn giao
npm run test:w6-q4

# Regression đầy đủ Quang
npm run test:w6-q3
npm run test:w6-q2
npm run test:w6-q1
npm run test:w5-q4
npm run test:w5-q2
npm run test:w5-q3
```

---

*Nguồn KPI: MÔ PHỎNG. Chỉ nhận phần đóng góp và kết quả đã thực hiện.*  
*W6-Q4 — Tạ Trần Vinh Quang — 09/10/2026*
