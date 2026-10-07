# NHẬT KÝ BÀN GIAO CÔNG VIỆC TUẦN 4 — PHẦN VIỆC W4-Q3
## MÀN HÌNH ĐÁNH GIÁ VÀ LỊCH SỬ CHẠY AI

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W4-Q3: Màn hình đánh giá và lịch sử chạy AI  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 07/10/2026  
**Nhánh thực hiện:** `w4-q3` (tách từ `w4-q2`)  

---

## 1. Mục tiêu và Phạm vi Đã Hoàn Thành

1. **Thay mock AIForecast phần xét điều kiện bằng API:**
   - Xây dựng service `frontend/src/services/aiEvaluationApi.js` kết nối các endpoints RESTful `/ai/evaluations/structured`, `/ai/evaluations/:runId`, `/ai/evaluations/:runId/stale-check`, `/ai/rag/explain`, `/regulations/criteria`.
   - Nâng cấp toàn diện màn hình `frontend/src/pages/AIForecast.jsx` với 3 tab: Thẩm định Trực tiếp (Live AI Evaluation), Lịch sử Phiên AI (Runs History), và 12 Hồ sơ Thử nghiệm Fixtures (W3-Q4).

2. **UI Chọn Chủ thể / Mục tiêu / Kỳ / Tiêu chí & Nguồn:**
   - Cho phép chọn đối tượng Cá nhân (Giảng viên) hoặc Tập thể (Đơn vị), tự động điền theo thông tin đăng nhập của người dùng.
   - Chọn ngày hiệu lực thẩm định (`asOfDate`).
   - Tải danh sách tiêu chí đã xác nhận từ kho quy chế LHU, cho phép chọn nhiều tiêu chí để đánh giá đồng thời.
   - Banner cảnh báo pháp lý thường trực: kết quả AI chỉ hỗ trợ xét duyệt, không có cơ chế tự động trao thưởng.

3. **Xem Lịch sử & Tái hiện Phiên bản Input Snapshot Cũ:**
   - Bảng lịch sử các phiên thẩm định đã lưu trữ trong Supabase PostgreSQL (`app.evaluation_runs`).
   - Nhấp vào phiên lịch sử để tải lại toàn bộ kết quả và tái hiện nguyên trạng `inputSnapshot` tại thời điểm chạy kèm mã băm `inputHash` SHA-256 (tamper-evident).

4. **Giữ Kết quả Khi Provider Lỗi & Hiển thị Cảnh báo Stale:**
   - **Stale Check:** Tự động so sánh mã băm dữ liệu hiện tại với snapshot cũ. Khi có thành tích phát sinh hoặc thay đổi, hiển thị huy hiệu cảnh báo đỏ `STALE (ĐÃ ĐỔI)`.
   - **Resilient Provider Fallback:** Khi AI Provider (LLM) gặp lỗi mạng, rate limit hoặc timeout, kết quả thẩm định tiêu chí logic xác định từ hệ thống vẫn được bảo toàn nguyên vẹn 100%, kèm thông báo hướng dẫn Hội đồng thẩm định trực tiếp.

5. **Phân quyền Truy cập AI / History & Scope Security:**
   - Cập nhật định tuyến `AppRoutes.jsx` và thanh điều hướng `Sidebar.jsx` cho các vai trò hợp lệ.
   - Backend kiểm soát phạm vi nghiêm ngặt: giảng viên chỉ được xem hồ sơ của chính mình; người ngoài scope bị từ chối với HTTP 403 `OUT_OF_SCOPE`.

---

## 2. Kết quả Kiểm thử Thực tế

| Bộ kiểm thử | File / Lệnh | Số lượng test | Kết quả |
| :--- | :--- | :--- | :--- |
| **Integration Live DB W4-Q3** | `node --test tests/w4-q3.integration.js` | 5 tests | **5/5 PASS (100%)** |
| **Unit Tests W4-Q2** | `npm run test:w4-q2` | 5 tests | **5/5 PASS (100%)** |
| **Integration DB W4-Q2** | `npm run test:w4-q2:integration` | 4 tests | **4/4 PASS (100%)** |
| **Unit Tests W4-Q1** | `npm run test:w4-q1` | 6 tests | **6/6 PASS (100%)** |
| **Integration DB W4-Q1** | `npm run test:w4-q1:integration` | 5 tests | **5/5 PASS (100%)** |
| **Hồi quy 12 Ca Bắt buộc** | `node tests/w3-q4.mandatory12.js` | 12 tests | **12/12 PASS (100%)** |
| **Frontend Lint** | `npm run lint` (frontend) | - | **0 lỗi (PASS)** |
| **Frontend Production Build** | `npm run build` (frontend) | - | **Thành công (PASS)** |

---

## 3. Danh sách Tệp Thay Đổi và Tạo Mới

- `frontend/src/services/aiEvaluationApi.js` (Tạo mới: API client cho AI Evaluation & History)
- `frontend/src/pages/AIForecast.jsx` (Nâng cấp: Màn hình thẩm định trực tiếp, lịch sử, stale alert, trích dẫn RAG)
- `frontend/src/routes/AppRoutes.jsx` (Cập nhật: Quyền truy cập màn hình AI cho các vai trò)
- `frontend/src/components/common/Sidebar.jsx` (Cập nhật: Mở rộng menu Phân tích & Thẩm định AI)
- `backend/src/modules/ai/aiController.js` (Cập nhật: validate scope trong explainEvaluation & checkEvaluationStale)
- `backend/src/modules/ai/aiService.js` (Cập nhật: checkEvaluationStale, phân quyền listEvaluations)
- `backend/src/modules/ai/criteriaEvaluator.js` (Cập nhật: tính inputHash nội dung xác định không phụ thuộc thời gian chạy)
- `backend/src/modules/ai/rag/ragExplanationService.js` (Cập nhật: resilient fallback khi provider lỗi)
- `backend/tests/w4-q3.integration.js` (Tạo mới: 5 ca integration test W4-Q3)
- `backend/package.json` (Cập nhật: thêm script test:w4-q3:integration)
- `docs/api/AI_EVALUATION_UI_HISTORY_W4_Q3.md` (Tạo mới: Tài liệu kỹ thuật W4-Q3)
- `docs/weekly/WEEK_04_W4_Q3.md` (Tạo mới: Báo cáo bàn giao tuần 4 W4-Q3)
