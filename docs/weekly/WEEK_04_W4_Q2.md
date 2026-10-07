# NHẬT KÝ BÀN GIAO CÔNG VIỆC TUẦN 4 — PHẦN VIỆC W4-Q2

**Người phụ trách:** Tạ Trần Vinh Quang  
**Nhiệm vụ:** W4-Q2: RAG và giải thích có trích dẫn  
**Dự án:** PTUD_PhatTrienUngDung  
**Thời điểm bàn giao:** 07/10/2026  
**Nhánh thực hiện:** `w4-q2` (tách từ `w4-q1`)  

---

## 1. Mục tiêu và Phạm vi Đã Hoàn Thành

1. **Lập chỉ mục Chunks Quy định Đã Duyệt:**
   - Xây dựng migration `20261007000021_w4_q2_rag_and_embeddings.sql` tạo bảng `app.regulation_chunk_embeddings` và `app.ai_rag_explanations`.
   - Triển khai hàm `indexConfirmedChunks` chỉ lập chỉ mục các văn bản chính thức của LHU (`CONFIRMED_LHU_POLICY`), loại bỏ các nguồn mô phỏng hoặc chưa duyệt.

2. **Công cụ Embedding Local Miễn phí & Benchmark:**
   - Xây dựng module `backend/src/modules/ai/rag/localEmbedding.js` sử dụng thuật toán Subword N-Gram Signed Random Projection 128-dim kết hợp chuẩn hóa L2.
   - Chạy benchmark so sánh đạt 100% Top-1 accuracy với độ trễ < 1ms, không cần API key thương mại.

3. **Retrieval Có Bộ lọc (Filtered Vector Retrieval):**
   - Lọc nghiêm ngặt thời hạn hiệu lực (`asOfDate` giữa `effective_from` và `effective_to`), đối tượng áp dụng và version.
   - Không có nguồn phù hợp trả `isSufficientData: false` ("chưa đủ dữ liệu căn cứ pháp lý"), ngăn chặn triệt để hành vi bịa đặt.

4. **Giải thích có Trích dẫn (Verified Citations) & Chống Prompt Injection:**
   - Hệ thống rào chắn làm sạch input và thẻ ranh giới cách ly ngăn chặn triệt để prompt injection / jailbreak cố tình ép trao thưởng.
   - Trích xuất và xác thực mã `[CHUNK_ID: <id>]`, loại bỏ citation giả mạo, truy ngược chính xác Điều, Khoản, Trang và mã băm SHA-256.
   - Ghi nhận đầy đủ metadata: `model`, `promptVersion: 'rag-explain-v1'`, `retrievalVersion: 'rag-retrieval-v1'`.

---

## 2. Kết quả Kiểm thử Thực tế

| Bộ kiểm thử | File | Số lượng test | Kết quả |
| :--- | :--- | :--- | :--- |
| **Unit Tests W4-Q2** | `backend/tests/w4-q2.test.js` | 5 tests | **5/5 PASS (100%)** |
| **Integration Live DB W4-Q2** | `backend/tests/w4-q2.integration.js` | 4 tests | **4/4 PASS (100%)** |
| **Hồi quy W4-Q1 Unit** | `backend/tests/w4-q1.test.js` | 6 tests | **6/6 PASS (100%)** |
| **Hồi quy W4-Q1 Integration** | `backend/tests/w4-q1.integration.js` | 5 tests | **5/5 PASS (100%)** |
| **Hồi quy 12 Ca Bắt buộc** | `backend/tests/w3-q4.mandatory12.js` | 12 tests | **12/12 PASS (100%)** |
| **Hồi quy W3-P4 AI Fixtures** | `backend/tests/w3-p4.test.js` | 6 tests | **6/6 PASS (100%)** |

---

## 3. Danh sách Tệp Thay Đổi và Tạo Mới

- `supabase/migrations/20261007000021_w4_q2_rag_and_embeddings.sql`
- `backend/src/modules/ai/rag/localEmbedding.js`
- `backend/src/modules/ai/rag/ragRetrievalService.js`
- `backend/src/modules/ai/rag/ragExplanationService.js`
- `backend/src/modules/ai/aiController.js`
- `backend/src/modules/ai/aiRoutes.js`
- `backend/tests/w4-q2.test.js`
- `backend/tests/w4-q2.integration.js`
- `backend/package.json`
- `docs/api/RAG_AND_CITATIONS_W4_Q2.md`
- `docs/weekly/WEEK_04_W4_Q2.md`
