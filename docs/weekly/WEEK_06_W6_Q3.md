# Week 6 — W6-Q3: Demo cuối và tag bản phát hành

**Người thực hiện:** Tạ Trần Vinh Quang  
**Sprint:** W6 (tuần cuối demo PTUD)  
**Nhánh:** `w6-q3` (tạo từ `w6-q2`)  
**HEAD commit khi tạo nhánh:** `afd2377` — feat(W6-Q2): kiem chung migration, backup/restore script, hash manifest, version matrix  
**Ngày bàn giao:** 09/10/2026  
**Phụ thuộc:** W6-Q2 ✅, W6-P2 (remote, không thay đổi)

---

## Tổng kết

| Hạng mục | Trạng thái |
|---|:---:|
| Test suite `w6-q3.test.js` | **38/38 PASS** |
| Kịch bản demo (`DEMO_SCENARIO_W6Q3.md`) | ✅ |
| Release record (`RELEASE_RECORD_W6Q3.json`) | ✅ |
| Known limitations (`KNOWN_LIMITATIONS_W6Q3.md`) | ✅ |
| Tag `v0.6-demo-ptud` | ⏳ Chờ Quang xác nhận, tạo thủ công |
| Restore end-to-end | 🔴 BLOCKED (cần `RESTORE_TARGET_DB_URL`) |
| AI live smoke test | ⏳ Cần set `OPENAI_API_KEY`/`GROQ_API_KEY` |

---

## Đầu ra đã tạo

| File | Dòng | Mô tả |
|---|:---:|---|
| `backend/tests/w6-q3.test.js` | 280 | 5 suite, 38 test nghiệm thu demo cuối |
| `docs/DEMO_SCENARIO_W6Q3.md` | 61 | Kịch bản PTUD→đề nghị→AI→KPI chi tiết theo phút |
| `docs/report-inputs/RELEASE_RECORD_W6Q3.json` | 51 | Release metadata, tag v0.6-demo-ptud, SHA afd2377, known limitations |
| `docs/report-inputs/KNOWN_LIMITATIONS_W6Q3.md` | 101 | 8 giới hạn đã biết, mỗi giới hạn ghi trạng thái và hành động unblock |

---

## Chi tiết test suite

| Suite | Số test | PASS | FAIL |
|---|:---:|:---:|:---:|
| S1: Checklist nghiệm thu cuối | 8 | 8 | 0 |
| S2: Kịch bản PTUD→AI→KPI | 8 | 8 | 0 |
| S3: Release doc verification | 9 | 9 | 0 |
| S4: Known limitations | 8 | 8 | 0 |
| S5: Commit SHA | 5 | 5 | 0 |
| **Tổng** | **38** | **38** | **0** |

```
ℹ tests 38 | ℹ pass 38 | ℹ fail 0 | ℹ skipped 0 | ℹ duration_ms ~200
```

---

## Kịch bản demo (tóm tắt)

| Phút | Bước chính |
|:---:|---|
| 0–2 | Kiến trúc + readiness check `GET /api/v1/health/readiness` |
| 2–6 | Đăng nhập, tạo thành tích, upload minh chứng (`an.nv`) |
| 6–9 | Manager xác nhận / yêu cầu bổ sung (`bich.tt`) |
| 9–11 | Dashboard, Reports, CSV export (phân quyền) |
| 11–13 | KPI / AI gợi ý — **nhãn MÔ PHỎNG** |
| 13–15 | Backup/Restore, Admin, tổng kết giới hạn |

---

## Giới hạn đã biết (công bố trước demo)

| Giới hạn | Mức | Trạng thái |
|---|:---:|:---:|
| Restore end-to-end cần `RESTORE_TARGET_DB_URL` | P0 | BLOCKED |
| AI live provider cần `OPENAI_API_KEY`/`GROQ_API_KEY` | P1 | NOT_RUN |
| KPI nguồn HTTP connector | — | SIMULATED |
| Dashboard p95 = 2078 ms (mục tiêu < 2000 ms) | P2 | Chưa đạt |
| Hội đồng chưa có tài khoản/phân công | — | Chưa có |
| PR remote chưa xác minh URL | — | NOT_VERIFIED |
| TLS `rejectUnauthorized: false` | P2 | Ghi nhận |
| Cài thứ hai độc lập chưa hoàn thành | — | Chưa làm |

---

## Hướng dẫn tag chính thức (Quang tự chạy sau xác nhận)

```bash
# Kiểm tra nhánh hiện tại
git branch
# → w6-q3

# Kiểm tra test PASS lần cuối
cd backend && npm run test:w6-q3

# Tạo tag annotated
git tag -a v0.6-demo-ptud afd2377 \
  -m 'Release demo cuoi PTUD W6 — 28/10/2026. 38/38 PASS.'

# Kiểm tra tag
git tag -l "v0.6*"

# Push nhánh và tag (chỉ khi Quang chỉ thị)
# git push origin w6-q3
# git push origin v0.6-demo-ptud
```

---

## Bước tự kiểm tra

```bash
cd backend

# Chạy test W6-Q3
npm run test:w6-q3
# Kỳ vọng: 38/38 PASS

# Chạy toàn bộ test W6
npm run test:w6-q1 && npm run test:w6-q2 && npm run test:w6-q3
# Kỳ vọng: 37+36+38 = 111 PASS, 0 FAIL

# Kiểm readiness endpoint (cần backend chạy)
# curl http://localhost:5000/api/v1/health/readiness
```

---

## Phần chưa xong

- Tag `v0.6-demo-ptud`: cần Quang xác nhận sau review thực tế.
- Restore integration: cần `RESTORE_TARGET_DB_URL` → chạy migration 009 → `node scripts/restore.mjs`.
- AI smoke test live: cần key thật trước demo.
- Cài thứ hai: clone mới, project Supabase riêng, không dùng `node_modules` cũ.
- Video capture buổi demo: lưu vào `docs/demo/VIDEO_W6Q3.mp4`.

---

*W6-Q3 — Tạ Trần Vinh Quang — 09/10/2026*
