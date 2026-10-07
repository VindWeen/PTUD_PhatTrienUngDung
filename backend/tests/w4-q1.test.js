import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateStructuredCriterion,
  buildInputSnapshot,
  buildEvaluationRunObject,
} from '../src/modules/ai/criteriaEvaluator.js';
import { evaluationRunSchema } from '../src/modules/ai/evaluationSchemas.js';

const mockSubject = {
  subjectType: 'LECTURER',
  subjectId: 1001,
};

const mockDocVersion = {
  versionId: 1,
  versionNumber: 'QD-LHU-2026/01',
  sha256Hash: 'a'.repeat(64),
  isConfirmed: true,
  lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  documentCode: 'LHU-REG-01',
};

const mockCriterion = {
  criteriaVersionId: 10,
  criterionCode: 'LHU-CSTT-01',
  name: 'Danh hiệu Chiến sĩ thi đua cơ sở',
  targetType: 'INDIVIDUAL',
  minThreshold: 3,
  unitMetric: 'năm liên tiếp',
  isConfirmed: true,
  versionId: 1,
  legalReferences: 'Điều 5 Khoản 2',
};

test('W4-Q1 [Ca 1]: Bộ đếm năm phân biệt bằng code xác định đạt chuẩn ELIGIBLE', () => {
  const records = [
    {
      id: 1,
      subjectId: 1001,
      year: 2023,
      status: 'VERIFIED',
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc1.pdf' },
    },
    {
      id: 2,
      subjectId: 1001,
      year: 2024,
      status: 'VERIFIED',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2.pdf' },
    },
    {
      id: 3,
      subjectId: 1001,
      year: 2025,
      status: 'RECORDED',
      file: { id: 103, sha256: 'd'.repeat(64), originalFileName: 'mc3.pdf' },
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true },
  });

  assert.equal(result.distinctYears, 3);
  assert.equal(result.consecutiveYears, true);
  assert.equal(result.thresholdMetric.isSatisfied, true);
  assert.equal(result.overallConclusion, 'ELIGIBLE');
  assert.equal(result.humanReviewRequired, false);
  assert.equal(result.issues.length, 0);
});

test('W4-Q1 [Ca 2]: Phát hiện gián đoạn chuỗi năm liên tiếp (YEAR_GAP) chuyển sang rà soát', () => {
  const records = [
    {
      id: 1,
      subjectId: 1001,
      year: 2022,
      status: 'VERIFIED',
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc1.pdf' },
    },
    {
      id: 2,
      subjectId: 1001,
      year: 2024, // Cách quãng năm 2023
      status: 'VERIFIED',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2.pdf' },
    },
    {
      id: 3,
      subjectId: 1001,
      year: 2025,
      status: 'RECORDED',
      file: { id: 103, sha256: 'd'.repeat(64), originalFileName: 'mc3.pdf' },
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true },
  });

  assert.equal(result.distinctYears, 3);
  assert.equal(result.consecutiveYears, false);
  assert.ok(result.issues.includes('YEAR_GAP'));
  assert.equal(result.thresholdMetric.isSatisfied, 'UNCONFIRMED');
  assert.equal(result.overallConclusion, 'NEEDS_HUMAN_REVIEW');
  assert.equal(result.humanReviewRequired, true);
});

test('W4-Q1 [Ca 3]: Loại trừ tuyệt đối hồ sơ thu hồi (REVOKED / CANCELLED)', () => {
  const records = [
    {
      id: 1,
      subjectId: 1001,
      year: 2023,
      status: 'REVOKED', // Đã thu hồi
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc1.pdf' },
    },
    {
      id: 2,
      subjectId: 1001,
      year: 2024,
      status: 'VERIFIED',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2.pdf' },
    },
    {
      id: 3,
      subjectId: 1001,
      year: 2025,
      status: 'RECORDED',
      file: { id: 103, sha256: 'd'.repeat(64), originalFileName: 'mc3.pdf' },
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true },
  });

  // Hồ sơ thu hồi bị loại bỏ, chỉ còn 2 năm hợp lệ
  assert.equal(result.distinctYears, 2);
  assert.ok(result.issues.includes('REVOKED_SOURCE'));
  // Do có nguồn thu hồi, hệ thống chuyển người rà soát chứ không phán quyết âm
  assert.equal(result.thresholdMetric.isSatisfied, 'UNCONFIRMED');
  assert.equal(result.overallConclusion, 'NEEDS_HUMAN_REVIEW');
  assert.equal(result.humanReviewRequired, true);
});

test('W4-Q1 [Ca 4]: Quy tắc nghiệm thu: Thiếu chứng cứ KHÔNG mặc định không đạt', () => {
  const records = [
    {
      id: 1,
      subjectId: 1001,
      year: 2023,
      status: 'VERIFIED',
      file: null, // Thiếu file minh chứng
    },
    {
      id: 2,
      subjectId: 1001,
      year: 2024,
      status: 'VERIFIED',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2.pdf' },
    },
    {
      id: 3,
      subjectId: 1001,
      year: 2025,
      status: 'RECORDED',
      file: { id: 103, sha256: 'd'.repeat(64), originalFileName: 'mc3.pdf' },
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true },
  });

  assert.ok(result.issues.includes('MISSING_DATA'));
  // QUY TẮC BẮT BUỘC: Không được đánh giá INELIGIBLE khi thiếu chứng cứ
  assert.notEqual(result.overallConclusion, 'INELIGIBLE');
  assert.equal(result.overallConclusion, 'NEEDS_HUMAN_REVIEW');
  assert.equal(result.thresholdMetric.isSatisfied, 'UNCONFIRMED');
  assert.equal(result.humanReviewRequired, true);
});

test('W4-Q1 [Ca 5]: Tiêu chuẩn mô phỏng / chưa duyệt LHU luôn trả SIMULATION_ONLY hoặc UNCONFIRMED', () => {
  const unconfirmedDoc = {
    ...mockDocVersion,
    isConfirmed: false,
    lhuApplicationStatus: 'SIMULATION_ONLY',
  };

  const simCriterion = {
    ...mockCriterion,
    criterionCode: 'SIM-KPI-01',
    isConfirmed: false,
  };

  const records = [
    {
      id: 1,
      subjectId: 1001,
      year: 2024,
      status: 'VERIFIED',
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc1.pdf' },
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: simCriterion,
    documentVersion: unconfirmedDoc,
    records,
  });

  assert.equal(result.isConfirmedByLhu, false);
  assert.equal(result.isSimulation, true);
  assert.equal(result.thresholdMetric.isSatisfied, 'UNCONFIRMED');
  assert.equal(result.overallConclusion, 'SIMULATION_ONLY');
  assert.equal(result.humanReviewRequired, true);
  assert.ok(result.warningNotice.includes('chưa được Hội đồng LHU phê duyệt'));
});

test('W4-Q1 [Ca 6]: Đối tượng EvaluationRun tuân thủ chuẩn W3-Q4 schema, cấm tự trao thưởng', () => {
  const records = [
    {
      id: 1,
      subjectId: 1001,
      year: 2024,
      status: 'VERIFIED',
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc1.pdf' },
    },
  ];

  const critResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
  });

  const run = buildEvaluationRunObject({
    subject: mockSubject,
    providerInfo: { provider: 'mock', model: 'deterministic-test', isMock: true },
    criterionResults: [critResult],
  });

  // 1. Phải thỏa mãn evaluationRunSchema
  const parseResult = evaluationRunSchema.safeParse(run);
  assert.ok(parseResult.success, `Schema validation thất bại: ${JSON.stringify(parseResult.error)}`);

  // 2. automaticAwardGranted BẮT BUỘC là false
  assert.equal(run.automaticAwardGranted, false);

  // 3. Nếu gán automaticAwardGranted = true -> Schema PHẢI từ chối ngay lập tức
  const illegalRun = { ...run, automaticAwardGranted: true };
  assert.equal(evaluationRunSchema.safeParse(illegalRun).success, false);
});
