import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStructuredCriterion } from '../src/modules/ai/criteriaEvaluator.js';

const mockSubject = {
  subjectType: 'LECTURER',
  subjectId: 2001,
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
  criteriaVersionId: 101,
  criterionCode: 'LHU-CSTT-ACTIVE',
  name: 'Danh hiệu Chiến sĩ thi đua cơ sở (Kho ACTIVE)',
  targetType: 'INDIVIDUAL',
  minThreshold: 3,
  unitMetric: 'năm liên tiếp',
  isConfirmed: true,
  versionId: 1,
  legalReferences: 'Điều 5 Quy chế Thi đua',
};

test('AI Criteria Evaluator: Chấp nhận hồ sơ thành tích trạng thái ACTIVE từ Kho cá nhân', () => {
  const records = [
    {
      id: 11,
      achievementId: 11,
      title: 'Chiến sĩ thi đua cơ sở 2023',
      subjectId: 2001,
      year: 2023,
      status: 'ACTIVE', // Trạng thái mới trong kho lưu trữ
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc2023.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
    {
      id: 12,
      achievementId: 12,
      title: 'Chiến sĩ thi đua cơ sở 2024',
      subjectId: 2001,
      year: 2024,
      status: 'ACTIVE',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2024.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
    {
      id: 13,
      achievementId: 13,
      title: 'Chiến sĩ thi đua cơ sở 2025',
      subjectId: 2001,
      year: 2025,
      status: 'ACTIVE',
      file: { id: 103, sha256: 'd'.repeat(64), originalFileName: 'mc2025.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
  });

  assert.equal(result.thresholdMetric.isSatisfied, true, '3 năm ACTIVE liên tiếp phải được công nhận đạt');
  assert.equal(result.isSatisfied, true);
  assert.equal(result.overallConclusion, 'ELIGIBLE');
  assert.equal(result.distinctYears, 3);
  assert.equal(result.consecutiveYears, true);
  assert.equal(result.missingCount, 0, 'Đã đạt tiêu chí thì missingCount = 0');

  // Kiểm tra matchedRecords trả về đúng 3 bản ghi
  assert.equal(Array.isArray(result.matchedRecords), true);
  assert.equal(result.matchedRecords.length, 3);
  assert.equal(result.matchedRecords[0].title, 'Chiến sĩ thi đua cơ sở 2023');
  assert.equal(result.matchedRecords[0].year, 2023);
  assert.equal(result.matchedRecords[0].status, 'ACTIVE');
});

test('AI Criteria Evaluator: Tính toán chính xác missingCount khi chưa đủ số lượng yêu cầu', () => {
  // Chỉ có 1 bản ghi ACTIVE năm 2024
  const records = [
    {
      id: 12,
      achievementId: 12,
      title: 'Chiến sĩ thi đua cơ sở 2024',
      subjectId: 2001,
      year: 2024,
      status: 'ACTIVE',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2024.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion, // minThreshold = 3
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
  });

  assert.equal(result.thresholdMetric.isSatisfied, false);
  assert.equal(result.isSatisfied, false);
  assert.equal(result.thresholdMetric.targetMin, 3);
  assert.equal(result.thresholdMetric.actualRecorded, 1);
  assert.equal(result.missingCount, 2, 'Yêu cầu 3, đã có 1 -> missingCount phải là 2');
  assert.equal(result.matchedRecords.length, 1);
});

test('AI Criteria Evaluator: Kết hợp cả ACTIVE, VERIFIED và RECORDED song song', () => {
  const records = [
    {
      id: 11,
      title: 'Thành tích cũ thẩm định (VERIFIED)',
      subjectId: 2001,
      year: 2023,
      status: 'VERIFIED',
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc2023.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
    {
      id: 12,
      title: 'Khen thưởng đã cấp (RECORDED)',
      subjectId: 2001,
      year: 2024,
      status: 'RECORDED',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2024.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
    {
      id: 13,
      title: 'Thành tích mới trong kho (ACTIVE)',
      subjectId: 2001,
      year: 2025,
      status: 'ACTIVE',
      file: { id: 103, sha256: 'd'.repeat(64), originalFileName: 'mc2025.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
  });

  assert.equal(result.thresholdMetric.isSatisfied, true);
  assert.equal(result.distinctYears, 3);
  assert.equal(result.matchedRecords.length, 3);
  assert.equal(result.missingCount, 0);
});

test('AI Criteria Evaluator: Loại trừ tuyệt đối REVOKED và CANCELLED khỏi matchedRecords', () => {
  const records = [
    {
      id: 11,
      title: 'Hồ sơ bị hủy',
      subjectId: 2001,
      year: 2023,
      status: 'CANCELLED',
      file: { id: 101, sha256: 'b'.repeat(64), originalFileName: 'mc1.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
    {
      id: 12,
      title: 'Hồ sơ bị thu hồi',
      subjectId: 2001,
      year: 2024,
      status: 'REVOKED',
      file: { id: 102, sha256: 'c'.repeat(64), originalFileName: 'mc2.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 1,
    },
  ];

  const result = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: { minimumDistinctYears: 3, requireConsecutive: true, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] },
  });

  assert.notEqual(result.thresholdMetric.isSatisfied, true);
  assert.equal(result.isSatisfied, false);
  assert.equal(result.matchedRecords.length, 0, 'Các hồ sơ bị thu hồi hoặc hủy không được đưa vào matchedRecords');
  assert.equal(result.missingCount, 3);
  assert.ok(result.issues.includes('REVOKED_SOURCE'));
});
