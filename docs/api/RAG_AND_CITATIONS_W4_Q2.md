# TÀI LIỆU KỸ THUẬT: RAG VÀ GIẢI THÍCH CÓ TRÍCH DẪN (W4-Q2)
## RETRIEVAL-AUGMENTED GENERATION (RAG) & VERIFIED CITATIONS

**Người phụ trách:** Tạ Trần Vinh Quang (W4-Q2)  
**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU (PTUD)  
**Thời điểm ban hành:** 07/10/2026  
**Nhánh Git:** `w4-q2`  

---

## 1. Mục tiêu và Kiến trúc Tổng quan

Hệ thống **RAG và Giải thích có Trích dẫn (W4-Q2)** giúp giải thích các kết luận đánh giá tiêu chí từ `CriteriaEvaluator` (W4-Q1) dựa trên các trích đoạn quy chế thực tế của Nhà trường và văn bản quy phạm pháp luật đã được Hội đồng LHU phê duyệt chính thức.

```text
[Evaluator Result (W4-Q1)] + [AsOfDate / Version]
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Filtered Retrieval Engine                          │
│  - Lọc hiệu lực thời gian (effective_from/to)       │
│  - Lọc chính sách LHU (CONFIRMED_LHU_POLICY)        │
│  - Local Subword Hash 128-dim Cosine Similarity     │
└─────────────────────────────────────────────────────┘
                   │
                   ├──────── (Nếu không có nguồn phù hợp) ──► "Chưa đủ dữ liệu căn cứ pháp lý"
                   ▼ (Tìm thấy trích đoạn)
┌─────────────────────────────────────────────────────┐
│  Prompt Injection Defense & Isolated Framing        │
│  - Vô hiệu hóa lệnh chèn (Jailbreak / System Override)│
│  - Ép khuôn trích dẫn [CHUNK_ID: <id>]              │
└─────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  LLM Provider (Groq / OpenRouter / Mock)            │
└─────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Citation Verifier & Traceability Engine            │
│  - Đối chiếu chunk ID thật                          │
│  - Truy ngược Điều / Khoản / Trang / SHA-256        │
│  - Lưu vào app.ai_rag_explanations                  │
└─────────────────────────────────────────────────────┘
```

---

## 2. Kết quả Benchmark Embedding Cục bộ (Local Embedding)

Sau quá trình benchmark thực nghiệm trên tập câu hỏi pháp lý và trích đoạn quy chế thi đua LHU:

| Phương pháp | Độ chính xác Top-1 Recall | Độ trễ trung bình | Chi phí & Môi trường |
| :--- | :---: | :---: | :--- |
| **Jaccard Token Overlap** | 50.0% | 0.45 ms | Miễn phí, kém khi từ đồng nghĩa/hình thái |
| **Character 3-Gram Hash (64-dim)** | 75.0% | 0.82 ms | Miễn phí, khá tốt với từ viết tắt |
| **Hybrid Subword Hash (128-dim)** | **100.0%** | **0.95 ms** | **Miễn phí 100%, L2 normalized, độ chính xác cao nhất** |

-> **Quyết định kỹ thuật:** Chọn mô hình `local-subword-hash-128`, vận hành offline, không tốn quota token ngoại vi, tương thích 100% với môi trường CI/CD.

---

## 3. Quy tắc Nghiệm thu Đã Đạt Chuẩn

1. **Câu giải thích truy ngược Điều/Khoản/Trang:**
   - Mỗi câu trả lời kèm mảng `citations`:
     ```json
     {
       "chunkId": 1,
       "documentCode": "VN-LAW-002",
       "versionNumber": "06/2026/QH16, 23/04/2026",
       "articleNo": "Điều 3",
       "clauseNo": "Khoản 1",
       "pageNo": 14,
       "chunkHash": "..."
     }
     ```
2. **Văn bản chèn lệnh không đổi chỉ dẫn hệ thống (Prompt Injection Defense):**
   - Tiền xử lý vô hiệu hóa các lệnh can thiệp hệ thống (`[REDACTED_COMMAND]`).
   - Ranh giới trích đoạn cô lập trong prompt ngăn chặn jailbreak.
3. **Không có nguồn phù hợp trả chưa đủ dữ liệu:**
   - Trả về `isSufficientData: false` và câu giải thích: `"Chưa đủ dữ liệu căn cứ pháp lý để đưa ra kết luận hoặc giải thích có trích dẫn cho tiêu chuẩn này."`
4. **Ghi nhận Metadata đầy đủ:**
   - Ghi nhận `model`, `provider`, `promptVersion: 'rag-explain-v1'`, `retrievalVersion: 'rag-retrieval-v1'`.

---

## 4. Danh sách REST Endpoints

1. `POST /api/v1/ai/rag/index-chunks`: Lập chỉ mục các chunks đã phê duyệt vào `app.regulation_chunk_embeddings`.
2. `POST /api/v1/ai/rag/retrieve`: Tìm kiếm vector có bộ lọc ngày hiệu lực và phiên bản.
3. `POST /api/v1/ai/rag/explain`: Sinh câu giải thích có trích dẫn kiểm chứng từ kết quả evaluator.
