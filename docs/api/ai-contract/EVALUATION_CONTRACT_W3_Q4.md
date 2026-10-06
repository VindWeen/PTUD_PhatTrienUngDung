# HỢP ĐỒNG KỸ THUẬT AI EVALUATION CONTRACT (W3-Q4)
## THỐNG NHẤT SCHEMA EVALUATIONRUN & CRITERIONRESULT GIỮA AI VÀ PHÂN HỆ KPI

**Người phụ trách:** Tạ Trần Vinh Quang (W3-Q4)  
**Phối hợp:** Võ Nhạc Phước (W3-P1, W3-P2)  
**Dự án:** Hệ thống Quản lý Hồ sơ Thành tích Số & Khen thưởng - Đại học Lạc Hồng (PTUD)  
**Ngày ban hành:** 06/10/2026  

---

## 1. Bối cảnh và Mục tiêu Thống nhất

Nhằm bảo đảm tính đồng bộ dữ liệu giữa:
- Phân hệ **Quản lý Mục tiêu / Kết quả KPI nội bộ** (W3-P2 - Võ Nhạc Phước).
- Phân hệ **Kho Văn bản Quy định, Phiên bản & Tiêu chuẩn Xét thưởng** (W3-Q2 - Tạ Trần Vinh Quang).
- Phân hệ **AI Provider Adapter & Thẩm định Tiêu chí** (W3-Q3 - Tạ Trần Vinh Quang).

Hợp đồng kỹ thuật này chuẩn hóa cấu trúc dữ liệu đầu ra và đối tượng trao đổi (`EvaluationRun` và `CriterionResult`) giúp hệ thống vận hành tự động, độc lập, không phụ thuộc vào controller nội bộ và tuân thủ tuyệt đối nguyên tắc **Liêm chính Khoa học (Zero Auto-Award)**.

---

## 2. Đặc tả Schema Chuẩn hóa

### 2.1. Thực thể `EvaluationRun` (Phiên Đánh giá)

```typescript
interface EvaluationRun {
  runId: string; // UUID v4 định danh duy nhất phiên đánh giá
  evaluationType: 'CRITERION_ASSESSMENT' | 'KPI_VERIFICATION' | 'BATCH_BENCHMARK';
  targetSubject: {
    subjectType: 'LECTURER' | 'UNIT';
    subjectId: number; // lecturerId hoặc unitId
    achievementId?: number;
    kpiGoalId?: number;
  };
  providerInfo: {
    provider: 'groq' | 'openrouter' | 'mock';
    model: string; // Model Free Tier được tài khoản hỗ trợ
    isMock: boolean;
  };
  overallStatus: 'COMPLETED' | 'FLAGGED_UNCONFIRMED' | 'FAILED';
  overallConclusion: 'ELIGIBLE' | 'INELIGIBLE' | 'NEEDS_HUMAN_REVIEW' | 'SIMULATION_ONLY';
  automaticAwardGranted: false; // LUÔN LUÔN LÀ FALSE: AI không có thẩm quyền tự trao thưởng
  usageMetrics: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    cached: boolean;
  };
  executedAt: string; // ISO 8601 Timestamp
  criterionResults: CriterionResult[];
}
```

### 2.2. Thực thể `CriterionResult` (Kết quả Đánh giá từng Tiêu chí)

```typescript
interface CriterionResult {
  criterionId: number; // ID tiêu chí từ app.award_criteria_versions
  criterionCode: string; // Mã tiêu chí (VD: 'SIM-KPI-01')
  criterionName: string;
  isConfirmedByLhu: boolean; // Trạng thái phê duyệt chính thức từ Hội đồng LHU
  isSimulation: boolean; // True nếu tiêu chí thuộc nguồn mô phỏng W1-P4
  thresholdMetric: {
    targetMin: number | null;
    actualRecorded: number | null;
    unitMetric: string | null;
    isSatisfied: boolean | 'UNCONFIRMED';
  };
  legalReferences: {
    documentCode: string; // 'VN-LAW-002', 'VN-EDU-001'
    versionNumber: string;
    clauseReference: string; // 'Điều 3 Khoản 1'
    chunkHash: string; // SHA-256 64 hex characters
  }[];
  aiAnalysis: string; // Lời nhận định, diễn giải logic của AI
  humanReviewRequired: boolean; // Bắt buộc chuyên viên / Hội đồng rà soát lại
  warningNotice?: string | null; // Cảnh báo nếu tiêu chuẩn chưa duyệt
}
```

---

## 3. Ma trận Quyết định & Ràng buộc Nghiệp vụ (Fail-Closed Rules)

| Điều kiện Đầu vào | `isConfirmedByLhu` | `overallConclusion` | `humanReviewRequired` | Ghi chú Nghiệp vụ |
| :--- | :---: | :--- | :---: | :--- |
| Tiêu chí chính sách LHU đã duyệt | `true` | `ELIGIBLE` / `INELIGIBLE` | Tùy quyết định Hội đồng | Căn cứ pháp lý hoàn chỉnh |
| Tiêu chí mô phỏng W1-P4 | `false` | `SIMULATION_ONLY` | **BẮT BUỘC (true)** | Gắn nhãn cảnh báo rõ ràng |
| Hồ sơ thiếu minh chứng bắt buộc | Bất kỳ | `NEEDS_HUMAN_REVIEW` | **BẮT BUỘC (true)** | Chờ bổ sung hồ sơ |
| Quota 429 hoặc Timeout 504 | Bất kỳ | `NEEDS_HUMAN_REVIEW` | **BẮT BUỘC (true)** | Lỗi mạng ngoại vi |
