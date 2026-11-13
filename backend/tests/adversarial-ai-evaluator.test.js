import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStructuredCriterion } from '../src/modules/ai/criteriaEvaluator.js';
import { buildDossierArchive } from '../src/modules/ai/dossierPackagerService.js';

const mockSubject = {
  subjectType: 'LECTURER',
  subjectId: 3001,
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
  name: 'Danh hiệu Chiến sĩ thi đua cơ sở',
  targetType: 'INDIVIDUAL',
  minThreshold: 2,
  unitMetric: 'năm liên tiếp',
  isConfirmed: true,
  versionId: 1,
  legalReferences: 'Điều 5 Quy chế Thi đua',
};

const baseRules = {
  minimumDistinctYears: 2,
  requireConsecutive: true,
  sourceType: 'ACHIEVEMENT',
  achievementTypeIds: [10],
};

// =========================================================================
// SECTION 2: AI Evaluator Status Conformance & Evidence Preservation
// =========================================================================

test('Adversarial 2.1: ACTIVE records are recognized as valid inputs and fulfill criteria', () => {
  const records = [
    {
      achievementId: 101,
      title: 'Thành tích NCKH 2024',
      subjectId: 3001,
      year: 2024,
      status: 'ACTIVE',
      file: { id: 1, sha256: 'f'.repeat(64), originalFileName: 'paper2024.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      achievementId: 102,
      title: 'Thành tích NCKH 2025',
      subjectId: 3001,
      year: 2025,
      status: 'ACTIVE',
      file: { id: 2, sha256: 'e'.repeat(64), originalFileName: 'paper2025.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: baseRules,
  });

  assert.equal(evalResult.isSatisfied, true, 'Criteria should be satisfied with 2 consecutive ACTIVE records');
  assert.equal(evalResult.thresholdMetric.actualRecorded, 2);
  assert.equal(evalResult.missingCount, 0, 'missingCount must be 0 when satisfied');
  assert.equal(evalResult.overallConclusion, 'ELIGIBLE');
  assert.equal(evalResult.matchedRecords.length, 2);
  assert.equal(evalResult.issues.length, 0, 'No issues should be raised for valid ACTIVE records');
});

test('Adversarial 2.2: DRAFT records are NOT counted in matchedRecords and are flagged with MISSING_DATA', () => {
  const records = [
    {
      achievementId: 201,
      title: 'Bản nháp 2024',
      subjectId: 3001,
      year: 2024,
      status: 'DRAFT', // Unofficial draft
      file: { id: 11, sha256: 'a'.repeat(64), originalFileName: 'draft1.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      achievementId: 202,
      title: 'Bản nháp 2025',
      subjectId: 3001,
      year: 2025,
      status: 'DRAFT',
      file: { id: 12, sha256: 'b'.repeat(64), originalFileName: 'draft2.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: baseRules,
  });

  assert.equal(evalResult.isSatisfied, false, 'DRAFT records must not satisfy criteria');
  assert.equal(evalResult.matchedRecords.length, 0, 'matchedRecords must be completely empty');
  assert.equal(evalResult.thresholdMetric.actualRecorded, 0, 'actualRecorded must be 0 for DRAFTs');
  assert.equal(evalResult.missingCount, 2, 'missingCount must be targetMin (2)');
  assert.ok(evalResult.issues.includes('MISSING_DATA'), 'Issues must contain MISSING_DATA');
  assert.equal(evalResult.overallConclusion, 'NEEDS_HUMAN_REVIEW', 'Unverified/draft inputs trigger NEEDS_HUMAN_REVIEW');
  assert.equal(evalResult.humanReviewRequired, true);
});

test('Adversarial 2.3: PENDING records are NOT counted in matchedRecords and are flagged with MISSING_DATA', () => {
  const records = [
    {
      achievementId: 301,
      title: 'Thành tích chờ duyệt 2024',
      subjectId: 3001,
      year: 2024,
      status: 'PENDING', // legacy or pending status
      file: { id: 21, sha256: 'c'.repeat(64), originalFileName: 'pending1.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: baseRules,
  });

  assert.equal(evalResult.isSatisfied, false, 'PENDING records must not satisfy criteria');
  assert.equal(evalResult.matchedRecords.length, 0, 'PENDING records must not be in matchedRecords');
  assert.equal(evalResult.thresholdMetric.actualRecorded, 0);
  assert.ok(evalResult.issues.includes('MISSING_DATA'));
  assert.equal(evalResult.missingCount, 2);
});

test('Adversarial 2.4: Mixed input filters out DRAFT and PENDING while retaining ACTIVE records', () => {
  const records = [
    {
      achievementId: 401,
      title: 'Valid Active 2024',
      subjectId: 3001,
      year: 2024,
      status: 'ACTIVE',
      file: { id: 31, sha256: 'd'.repeat(64), originalFileName: 'active2024.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      achievementId: 402,
      title: 'Poison Draft 2025',
      subjectId: 3001,
      year: 2025,
      status: 'DRAFT',
      file: { id: 32, sha256: 'e'.repeat(64), originalFileName: 'draft2025.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      achievementId: 403,
      title: 'Poison Pending 2025',
      subjectId: 3001,
      year: 2025,
      status: 'PENDING',
      file: { id: 33, sha256: 'f'.repeat(64), originalFileName: 'pending2025.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: baseRules,
  });

  // Only the 1 ACTIVE record must be in matchedRecords
  assert.equal(evalResult.matchedRecords.length, 1);
  assert.equal(evalResult.matchedRecords[0].achievementId, 401);
  assert.equal(evalResult.matchedRecords[0].title, 'Valid Active 2024');
  assert.equal(evalResult.matchedRecords[0].status, 'ACTIVE');

  // Verify neither DRAFT nor PENDING leaked into matchedRecords
  const matchedIds = evalResult.matchedRecords.map((r) => r.achievementId);
  assert.ok(!matchedIds.includes(402), 'DRAFT must not leak into matchedRecords');
  assert.ok(!matchedIds.includes(403), 'PENDING must not leak into matchedRecords');

  // actualRecorded must count ONLY the ACTIVE record
  assert.equal(evalResult.thresholdMetric.actualRecorded, 1);
  assert.equal(evalResult.missingCount, 1, 'Target 2 - 1 active = missing 1');
  assert.ok(evalResult.issues.includes('MISSING_DATA'), 'Draft/pending entries must raise MISSING_DATA flag');
  assert.equal(evalResult.isSatisfied, false);
});

test('Adversarial 2.5: Unknown or corrupted status values are rejected and flagged', () => {
  const corruptedRecords = [
    {
      achievementId: 501,
      title: 'Corrupted Status',
      subjectId: 3001,
      year: 2024,
      status: 'CORRUPTED_INJECTION_ATTEMPT',
      file: { id: 41, sha256: '1'.repeat(64), originalFileName: 'hack.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      achievementId: 502,
      title: 'Null Status',
      subjectId: 3001,
      year: 2025,
      status: null,
      file: { id: 42, sha256: '2'.repeat(64), originalFileName: 'null.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records: corruptedRecords,
    rules: baseRules,
  });

  assert.equal(evalResult.matchedRecords.length, 0);
  assert.ok(evalResult.issues.includes('MISSING_DATA'));
  assert.equal(evalResult.isSatisfied, false);
});

test('Adversarial 2.6: matchedRecords faithfully preserves achievement IDs and evidence files metadata', () => {
  const richRecords = [
    {
      achievementId: 778899, // Achievement ID test
      title: 'Bằng khen Bộ Giáo dục & Đào tạo',
      subjectId: 3001,
      year: 2024,
      status: 'ACTIVE',
      file: {
        id: 9001,
        sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        originalFileName: 'bang_khen_bgd_2024.pdf',
        storageKey: 'evidence/2024/bang_khen.pdf',
      },
      evidenceFiles: [
        {
          id: 9001,
          sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          name: 'bang_khen_bgd_2024.pdf',
          storageKey: 'evidence/2024/bang_khen.pdf',
        },
        {
          id: 9002,
          sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          name: 'quyet_dinh_khen_thuong.pdf',
          storageKey: 'evidence/2024/quyet_dinh.pdf',
        },
      ],
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      id: 889900, // ID fallback test (when achievementId is omitted)
      title: 'Bằng khen UBND Tỉnh Đồng Nai',
      subjectId: 3001,
      year: 2025,
      status: 'ACTIVE',
      file: {
        id: 9003,
        sha256: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        originalFileName: 'bang_khen_ubnd_2025.pdf',
      },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records: richRecords,
    rules: baseRules,
  });

  assert.equal(evalResult.matchedRecords.length, 2);

  // Record 1 verification
  const rec1 = evalResult.matchedRecords[0];
  assert.equal(rec1.achievementId, 778899, 'Must preserve original achievementId');
  assert.equal(rec1.id, 778899, 'id must match achievementId');
  assert.equal(rec1.title, 'Bằng khen Bộ Giáo dục & Đào tạo');
  assert.equal(rec1.year, 2024);
  assert.equal(rec1.status, 'ACTIVE');
  assert.ok(rec1.file, 'Must preserve file object');
  assert.equal(rec1.file.id, 9001);
  assert.equal(rec1.file.storageKey, 'evidence/2024/bang_khen.pdf');
  assert.equal(rec1.evidenceFiles.length, 2, 'Must preserve all evidenceFiles in array');
  assert.equal(rec1.evidenceFiles[1].name, 'quyet_dinh_khen_thuong.pdf');

  // Record 2 verification (id fallback)
  const rec2 = evalResult.matchedRecords[1];
  assert.equal(rec2.achievementId, 889900, 'Must fallback to id when achievementId is omitted');
  assert.equal(rec2.id, 889900);
  assert.equal(rec2.year, 2025);
  assert.equal(rec2.status, 'ACTIVE');
  assert.equal(rec2.evidenceFiles.length, 1, 'Should auto-populate evidenceFiles from file');
  assert.equal(rec2.evidenceFiles[0].id, 9003);
});

test('Adversarial 2.7: End-to-end evidence file preservation feeding into Dossier ZIP Packager', async () => {
  const records = [
    {
      achievementId: 9991,
      title: 'Giang Vien Xuat Sac',
      subjectId: 3001,
      year: 2024,
      status: 'ACTIVE',
      file: { id: 101, sha256: 'a'.repeat(64), originalFileName: 'mc1.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
    {
      achievementId: 9992,
      title: 'Nha Khoa Hoc Tieu Bieu',
      subjectId: 3001,
      year: 2025,
      status: 'ACTIVE',
      file: { id: 102, sha256: 'b'.repeat(64), originalFileName: 'mc2.pdf' },
      type: 'ACHIEVEMENT',
      sourceTypeId: 10,
    },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: mockSubject,
    criterion: mockCriterion,
    documentVersion: mockDocVersion,
    records,
    rules: baseRules,
  });

  assert.equal(evalResult.isSatisfied, true);

  // Transform matchedRecords into dossier files
  const dossierFiles = evalResult.matchedRecords.map((r) => ({
    title: r.title,
    year: r.year,
    buffer: Buffer.from(`%PDF-1.4 Fake PDF for ${r.title}`),
    fileExtension: 'pdf',
  }));

  const zipArchive = buildDossierArchive(dossierFiles);

  const chunks = [];
  zipArchive.on('data', (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    zipArchive.on('end', resolve);
    zipArchive.on('error', reject);
    zipArchive.finalize();
  });

  const zipBuffer = Buffer.concat(chunks);
  assert.ok(zipBuffer.length > 0, 'Generated ZIP bundle must not be empty');
  // Check standard ZIP header 'PK\x03\x04'
  assert.equal(zipBuffer.subarray(0, 4).toString('utf-8'), 'PK\x03\x04', 'Valid ZIP file signature');
});
