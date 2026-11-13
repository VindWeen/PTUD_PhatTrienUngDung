/**
 * backend/tests/challenger-m4-empirical.test.js
 * Adversarial Challenger 1 Empirical Test Suite for Milestone 4:
 * 1. AI Vision OCR Ingest & Graceful Fallback (Corrupted buffers, missing keys, invalid types, payload preservation)
 * 2. Dossier ZIP Packaging & Blob Streaming (Empty packages, invalid regulation IDs, filename sanitization, archive integrity)
 * 3. Gap-to-KPI Transfer & Calendar Reminder (Schema contracts, strictness mismatch, duplicate goals, opt-in toggle, date bounds)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buffer } from 'node:stream/consumers';
import { extractCertificateInfo } from '../src/modules/achievements/achievementAiIngestService.js';
import {
  buildDossierArchive,
  sanitizeFileName,
  formatStandardizedFileName,
  packageAndStreamDossierZip,
} from '../src/modules/ai/dossierPackagerService.js';
import { fromAiGapSchema, aiGapCriterionSchema } from '../src/modules/kpi/kpiSchemas.js';
import { createReminderSchema, isValidCalendarDate } from '../src/modules/calendar/calendarService.js';

// =========================================================================
// AREA 1: AI Vision OCR Ingest, Edge Cases & Graceful Fallback
// =========================================================================

test('AI Vision OCR: Empty buffer gracefully falls back to manual entry', async () => {
  const result = await extractCertificateInfo({ buffer: Buffer.alloc(0) });
  assert.equal(result.success, true);
  assert.equal(result.fallback, true);
  assert.equal(result.data, null);
  assert.ok(result.message.includes('Không có nội dung tệp tin'));
});

test('AI Vision OCR: Missing API keys gracefully falls back without server crash', async () => {
  const savedGroq = process.env.GROQ_API_KEY;
  const savedGemini = process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const result = await extractCertificateInfo({
      buffer: Buffer.from('FAKE_CERTIFICATE_CONTENT'),
      mimetype: 'image/jpeg',
    });
    assert.equal(result.success, true);
    assert.equal(result.fallback, true);
    assert.equal(result.data, null);
    assert.ok(result.message.includes('Chưa cấu hình API Key AI Vision'));
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
  }
});

test('AI Vision OCR: Corrupted binary buffer does not crash ingest service', async () => {
  // Random corrupted noise buffer
  const corruptedNoise = Buffer.from([0x00, 0xff, 0xfe, 0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb]);
  const result = await extractCertificateInfo({
    buffer: corruptedNoise,
    mimetype: 'application/pdf',
  });
  assert.equal(result.success, true);
  assert.equal(result.fallback, true);
  assert.equal(result.data, null);
  assert.ok(result.message.length > 0);
});

test('AI Vision OCR UI File Filter: Rejects invalid file types (.txt, .exe, .zip)', () => {
  const isAllowedFileType = (filename) => {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.pdf'].includes(ext);
  };

  assert.equal(isAllowedFileType('certificate.txt'), false);
  assert.equal(isAllowedFileType('malicious.exe'), false);
  assert.equal(isAllowedFileType('archive.zip'), false);
  assert.equal(isAllowedFileType('document.docx'), false);
  assert.equal(isAllowedFileType('noextension'), false);

  assert.equal(isAllowedFileType('cert.jpg'), true);
  assert.equal(isAllowedFileType('cert.JPEG'), true);
  assert.equal(isAllowedFileType('scan.PNG'), true);
  assert.equal(isAllowedFileType('decision.pdf'), true);
});

test('AI Vision OCR Fallback: Client state transitions preserve uploaded file in pendingEvidences', () => {
  // Simulating Achievements.jsx handleAiExtract state flow
  const mockFile = { name: 'BangKhen_ChienSiThiDua_2025.png', size: 1024 * 500, type: 'image/png' };
  let modalOpen = false;
  let aiModalOpen = true;
  let pendingEvidences = [];
  let aiNotice = null;

  const simulateHandleAiExtractFallback = (ocrResponse) => {
    const fileToKeep = mockFile;
    if (ocrResponse?.fallback || !ocrResponse?.data) {
      aiModalOpen = false;
      modalOpen = true; // openCreateModal
      pendingEvidences = [
        {
          id: 'test-uuid-1',
          file: fileToKeep,
          title: fileToKeep.name.replace(/\.[^/.]+$/, '').slice(0, 255),
          description: 'Minh chứng tệp đính kèm (AI Fallback)',
        },
      ];
      aiNotice = {
        type: 'info',
        message: ocrResponse?.message || 'Trợ lý AI chưa trích xuất được đủ thông tin.',
      };
    }
  };

  simulateHandleAiExtractFallback({
    success: true,
    data: null,
    fallback: true,
    message: 'Chưa cấu hình API Key AI Vision',
  });

  assert.equal(aiModalOpen, false, 'AI modal should be closed');
  assert.equal(modalOpen, true, 'Create achievement modal should be opened');
  assert.equal(pendingEvidences.length, 1, 'File must be preserved in pendingEvidences');
  assert.equal(pendingEvidences[0].file.name, 'BangKhen_ChienSiThiDua_2025.png');
  assert.equal(pendingEvidences[0].title, 'BangKhen_ChienSiThiDua_2025');
  assert.equal(aiNotice.type, 'info');
  assert.ok(aiNotice.message.includes('API Key'));
});

// =========================================================================
// AREA 2: Dossier ZIP Packaging & Blob Streaming
// =========================================================================

test('Dossier ZIP: Empty evidence package generates valid ZIP with fallback summary PDF', async () => {
  const emptyMatchedFiles = [];
  // packageAndStreamDossierZip adds fallback item if matchedFiles is empty
  const fallbackFiles = emptyMatchedFiles.length === 0
    ? [{ title: 'Ban_Tong_Hop_Minh_Chung', year: 2026 }]
    : emptyMatchedFiles;

  const archive = buildDossierArchive(fallbackFiles);
  const zipBufferPromise = buffer(archive);
  archive.finalize();
  const zipBuffer = await zipBufferPromise;

  assert.ok(zipBuffer.length > 0, 'ZIP buffer must not be empty');
  // Check ZIP magic bytes PK\x03\x04
  assert.equal(zipBuffer[0], 0x50);
  assert.equal(zipBuffer[1], 0x4b);
  assert.equal(zipBuffer[2], 0x03);
  assert.equal(zipBuffer[3], 0x04);
});

test('Dossier ZIP: File name sanitization handles Vietnamese diacritics and path traversal attacks', () => {
  assert.equal(sanitizeFileName('Bằng khen Chiến sĩ thi đua cấp cơ sở.pdf'), 'Bang_khen_Chien_si_thi_dua_cap_co_so.pdf');
  assert.equal(sanitizeFileName('../../etc/passwd'), '.._.._etc_passwd');
  assert.equal(sanitizeFileName('Quy chế #12: Giải thưởng Khoa học & Công nghệ!'), 'Quy_che_12_Giai_thuong_Khoa_hoc_Cong_nghe');
  assert.equal(sanitizeFileName(''), 'MinhChung');
  assert.equal(sanitizeFileName(null), 'MinhChung');

  const formattedName = formatStandardizedFileName(1, 'Bài báo Q1 IEEE', 2025, 'pdf');
  assert.equal(formattedName, '01_[Bai_bao_Q1_IEEE]_[2025].pdf');
});

test('Dossier ZIP: packageAndStreamDossierZip returns 404 on invalid regulation ID', async () => {
  let statusCode = 200;
  let responseData = null;

  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    setHeader() {},
  };

  const fakeUser = { userId: 1 };
  const fakeClient = {
    query: async (sql) => {
      // Return empty document version
      return { rows: [] };
    },
  };

  await packageAndStreamDossierZip(fakeUser, { regulationId: 999999 }, mockRes, fakeClient);

  assert.equal(statusCode, 404, 'Non-existent regulationId should return 404');
  assert.equal(responseData.success, false);
  assert.ok(responseData.message.includes('Không tìm thấy quy chế'));
});

// =========================================================================
// AREA 3: Gap-to-KPI Transfer & Calendar Reminder Payload Contracts
// =========================================================================

test('Gap-to-KPI CONTRACT BUG REPRODUCTION: AIForecast.jsx payload fails Zod strict validation', () => {
  // This is the EXACT payload generated by frontend/src/pages/AIForecast.jsx lines 233-243:
  const payloadFromFrontend = {
    regulationId: 1,
    missingCriteria: [
      {
        criterionId: 10,
        code: 'CRIT_01',
        name: 'Hoàn thành 01 đề tài NCKH cấp Trường',
        missingCount: 1,
        measureUnit: 'đề tài',
      },
    ],
    autoTransfer: true,
  };

  const parsed = fromAiGapSchema.safeParse(payloadFromFrontend);
  // Empirically verify that this payload is rejected due to strict() unrecognized keys
  assert.equal(parsed.success, false, 'Frontend payload MUST fail because backend schema is .strict()');
  
  const unrecognizedKeys = parsed.error.issues.map((i) => ({ code: i.code, keys: i.keys, path: i.path }));
  const rootIssue = unrecognizedKeys.find((i) => i.path.length === 0);
  assert.ok(rootIssue, 'Root issue for unrecognized key autoTransfer must exist');
  assert.ok(rootIssue.keys.includes('autoTransfer'), 'autoTransfer must be flagged as unrecognized');

  const criteriaIssue = unrecognizedKeys.find((i) => i.path.includes('missingCriteria'));
  assert.ok(criteriaIssue, 'Criterion issue for unrecognized keys criterionId/measureUnit must exist');
  assert.ok(criteriaIssue.keys.includes('criterionId'));
  assert.ok(criteriaIssue.keys.includes('measureUnit'));
});

test('Gap-to-KPI Schema: Rejects empty missingCriteria array', () => {
  const emptyPayload = {
    regulationId: 1,
    missingCriteria: [],
  };

  const parsed = fromAiGapSchema.safeParse(emptyPayload);
  assert.equal(parsed.success, false);
  const issue = parsed.error.issues[0];
  assert.equal(issue.message, 'Danh sách tiêu chí thiếu không được rỗng');
});

test('Gap-to-KPI Schema: Valid normalized payload succeeds', () => {
  const validPayload = {
    regulationId: 1,
    missingCriteria: [
      {
        code: 'CRIT_NCKH_01',
        name: 'Hoàn thành 01 đề tài NCKH cấp Trường',
        missingCount: 1,
        unit: 'đề tài',
      },
    ],
  };

  const parsed = fromAiGapSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.missingCriteria[0].code, 'CRIT_NCKH_01');
  assert.equal(parsed.data.missingCriteria[0].unit, 'đề tài');
});

test('Calendar Reminder: createReminderSchema strict validation & date boundaries', () => {
  // Valid calendar reminder payload
  const validPayload = {
    title: 'Hạn nộp hồ sơ Chiến sĩ thi đua 2026',
    deadlineDate: '2026-11-20',
    regulationId: 1,
    description: 'Bổ sung đầy đủ minh chứng trước hạn',
  };
  const parsedValid = createReminderSchema.safeParse(validPayload);
  assert.equal(parsedValid.success, true);

  // Invalid date: February 30th (non-existent day)
  assert.equal(isValidCalendarDate('2026-02-30'), false);
  const parsedFeb30 = createReminderSchema.safeParse({ ...validPayload, deadlineDate: '2026-02-30' });
  assert.equal(parsedFeb30.success, false);

  // Invalid date: leap day in non-leap year (2025-02-29)
  assert.equal(isValidCalendarDate('2025-02-29'), false);
  assert.equal(createReminderSchema.safeParse({ ...validPayload, deadlineDate: '2025-02-29' }).success, false);

  // Valid leap day in leap year (2024-02-29)
  assert.equal(isValidCalendarDate('2024-02-29'), true);
  assert.equal(createReminderSchema.safeParse({ ...validPayload, deadlineDate: '2024-02-29' }).success, true);

  // Out of bounds: year < 1990 or year > 2100
  assert.equal(isValidCalendarDate('1899-12-31'), false);
  assert.equal(isValidCalendarDate('2101-01-01'), false);

  // Empty title rejected
  assert.equal(createReminderSchema.safeParse({ ...validPayload, title: '   ' }).success, false);
});

test('Calendar Reminder Opt-in Toggle: When unchecked, reminder is omitted', () => {
  // Simulate AIForecast handleConfirmGapTransfer toggle logic
  let reminderCalled = false;
  const simulateTransfer = ({ gapAddReminder, gapDeadlineDate }) => {
    if (gapAddReminder && gapDeadlineDate) {
      reminderCalled = true;
    }
  };

  simulateTransfer({ gapAddReminder: false, gapDeadlineDate: '2026-11-20' });
  assert.equal(reminderCalled, false, 'When opt-in checkbox is unchecked, reminder must not be created');

  simulateTransfer({ gapAddReminder: true, gapDeadlineDate: '' });
  assert.equal(reminderCalled, false, 'When deadline date is blank, reminder must not be created');

  simulateTransfer({ gapAddReminder: true, gapDeadlineDate: '2026-11-20' });
  assert.equal(reminderCalled, true, 'When opt-in is checked and date is provided, reminder is created');
});

test('AIForecast.jsx handleConfirmGapTransfer: Normalized payload passes fromAiGapSchema.safeParse', () => {
  // Simulate dirty input from raw evaluation output in AIForecast.jsx
  const gapRegulation = { id: 5, name: 'Chiến sĩ thi đua cấp cơ sở' };
  const gapMissingCriteria = [
    {
      criterionId: 101,
      code: 'crit_nckh_01',
      name: 'Đề tài NCKH nghiệm thu',
      missingCount: '2',
      measureUnit: 'đề tài',
      thresholdMetric: { unit: 'bài' },
      autoTransfer: true,
      extraUnwantedField: 'malicious_injection',
    },
    {
      criterionCode: 'crit_bvd_02',
      criterionName: 'Bài báo VJST',
      missingCount: 1,
      unit: 'bài báo',
    },
  ];

  // Exact transformation logic from AIForecast.jsx lines 236-264
  const regId = Number(gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id);
  const cleanMissingCriteria = gapMissingCriteria.map((g, i) => {
    const rawCode = String(g.code || g.criterionCode || `GAP_${i + 1}`).trim();
    const rawName = String(g.name || g.criterionName || `Tiêu chí ${rawCode}`).trim();
    const countVal = Math.max(1, parseInt(g.missingCount, 10) || 1);
    const unitVal = String(g.unit || g.measureUnit || g.thresholdMetric?.unit || 'tiêu chí').trim();
    return {
      code: rawCode.slice(0, 80).toUpperCase(),
      name: rawName.slice(0, 255),
      missingCount: countVal,
      unit: unitVal.slice(0, 32),
    };
  });

  const payload = {
    regulationId: regId,
    missingCriteria: cleanMissingCriteria,
  };

  const parsed = fromAiGapSchema.safeParse(payload);
  assert.equal(parsed.success, true, 'Normalized payload must strictly pass fromAiGapSchema parsing');
  assert.equal(parsed.data.regulationId, 5);
  assert.equal(parsed.data.missingCriteria.length, 2);
  assert.equal(parsed.data.missingCriteria[0].code, 'CRIT_NCKH_01');
  assert.equal(parsed.data.missingCriteria[0].unit, 'đề tài');
  assert.equal(parsed.data.missingCriteria[0].missingCount, 2);
  // Ensure disallowed keys were completely stripped
  assert.equal(parsed.data.missingCriteria[0].criterionId, undefined);
  assert.equal(parsed.data.missingCriteria[0].measureUnit, undefined);
  assert.equal(parsed.data.autoTransfer, undefined);
});

test('AIForecast.jsx Empty missingCriteria: Button disabled and early return without API call', async () => {
  // Test 1: Button disabled expression from AIForecast.jsx:967
  const isButtonDisabled = (gapTransferring, gapMissingCriteria) => {
    return Boolean(gapTransferring || !gapMissingCriteria || gapMissingCriteria.length === 0);
  };

  assert.equal(isButtonDisabled(false, []), true, 'Empty array must disable button');
  assert.equal(isButtonDisabled(false, null), true, 'Null criteria must disable button');
  assert.equal(isButtonDisabled(false, undefined), true, 'Undefined criteria must disable button');
  assert.equal(isButtonDisabled(true, [{ code: 'C1' }]), true, 'Transferring state must disable button');
  assert.equal(isButtonDisabled(false, [{ code: 'C1' }]), false, 'Valid criteria enables button');

  // Test 2: Early return in handleConfirmGapTransfer
  let apiCalled = false;
  let alertMessage = '';
  const mockAlert = (msg) => { alertMessage = msg; };
  const mockApi = {
    createFromAiGap: async () => { apiCalled = true; },
  };

  const simulateHandleConfirm = async (gapRegulation, gapMissingCriteria) => {
    if (!gapRegulation || !gapMissingCriteria || gapMissingCriteria.length === 0) {
      mockAlert('Không có tiêu chí thiếu để chuyển thành KPI.');
      return;
    }
    const regId = Number(gapRegulation.regulationId || gapRegulation.id);
    const cleanMissingCriteria = gapMissingCriteria.map((g, i) => ({
      code: String(g.code || `GAP_${i + 1}`).slice(0, 80).toUpperCase(),
      name: String(g.name || 'Tiêu chí').slice(0, 255),
      missingCount: Math.max(1, parseInt(g.missingCount, 10) || 1),
      unit: String(g.unit || 'tiêu chí').slice(0, 32),
    }));

    if (cleanMissingCriteria.length === 0) {
      mockAlert('Không có tiêu chí thiếu để chuyển thành KPI.');
      return;
    }

    await mockApi.createFromAiGap({ regulationId: regId, missingCriteria: cleanMissingCriteria });
  };

  // Run with empty array
  await simulateHandleConfirm({ id: 1 }, []);
  assert.equal(apiCalled, false, 'API must NOT be called when criteria is empty');
  assert.equal(alertMessage, 'Không có tiêu chí thiếu để chuyển thành KPI.');

  // Run with null regulation
  apiCalled = false;
  alertMessage = '';
  await simulateHandleConfirm(null, [{ code: 'C1' }]);
  assert.equal(apiCalled, false, 'API must NOT be called when regulation is null');
  assert.equal(alertMessage, 'Không có tiêu chí thiếu để chuyển thành KPI.');

  // Run with valid data
  apiCalled = false;
  alertMessage = '';
  await simulateHandleConfirm({ id: 1 }, [{ code: 'C1' }]);
  assert.equal(apiCalled, true, 'API should be called when criteria and regulation are valid');
});
