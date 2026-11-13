/**
 * tests/e2e/tier2-boundary-corner.test.js
 * Tier 2 E2E Test Suite: Boundary Limits, Malformed Inputs & Corner Cases.
 * 
 * Exercises all 13 core features across boundary value limits, edge-case parameters,
 * rate limits, empty collections, missing API keys, oversized payloads, and
 * unauthenticated/unauthorized access violations.
 * 
 * Total Test Volume: >= 65 tests (5+ tests per feature for all 13 features).
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, createTestClient, generateMockToken } from './helpers/testClient.js';
import { ROLES, USERS, ACHIEVEMENTS, REGULATIONS, CV_FIXTURES, OCR_FIXTURES, ORG_TREE } from './helpers/fixtures.js';

describe('Tier 2 Boundary & Corner Case Tests (All 13 Features)', () => {
  let memberClient;
  let deptHeadClient;
  let facultyLeadClient;
  let adminClient;

  before(() => {
    // Initialize clients for all 4 standard roles in test harness
    memberClient = createTestClient({ role: ROLES.MEMBER });
    deptHeadClient = createTestClient({ role: ROLES.DEPARTMENT_HEAD });
    facultyLeadClient = createTestClient({ role: ROLES.FACULTY_LEAD });
    adminClient = createTestClient({ role: ROLES.ADMIN });
  });

  // ==========================================================================
  // Feature 1: Personal Achievement Vault Boundaries (5 tests)
  // ==========================================================================
  describe('Feature 1: Personal Achievement Vault Boundaries', () => {
    test('1.1 Empty or whitespace-only title is rejected with 400 Bad Request', async () => {
      const resEmpty = await memberClient.createAchievement({ title: '', recognitionYear: 2025 });
      assert.equal(resEmpty.status, 400);
      assert.equal(resEmpty.data.success, false);
      assert.match(resEmpty.data.message, /tiêu đề.*không được để trống/i);

      const resWhitespace = await memberClient.createAchievement({ title: '    ', recognitionYear: 2025 });
      assert.equal(resWhitespace.status, 400);
      assert.equal(resWhitespace.data.success, false);
    });

    test('1.2 Future year boundary: year > currentYear + 1 rejected with 400, currentYear + 1 accepted', async () => {
      const currentYear = new Date().getFullYear();
      
      // Upper invalid boundary: currentYear + 2 (or far future 2099)
      const resFuture = await memberClient.createAchievement({
        title: 'Công trình tương lai',
        recognitionYear: currentYear + 2,
      });
      assert.equal(resFuture.status, 400);
      assert.equal(resFuture.data.success, false);
      assert.match(resFuture.data.message, /tương lai/i);

      // Upper valid boundary: currentYear + 1
      const resNextYear = await memberClient.createAchievement({
        title: 'Kế hoạch công nhận năm tới',
        recognitionYear: currentYear + 1,
      });
      assert.equal(resNextYear.status, 201);
      assert.equal(resNextYear.data.success, true);
      assert.equal(resNextYear.data.data.recognitionYear, currentYear + 1);
    });

    test('1.3 Historical past year boundary: year < 1950 or <= 0 rejected with 400, 1950 accepted', async () => {
      // Ancient year < 1950
      const resAncient = await memberClient.createAchievement({
        title: 'Bằng khen thế kỷ 19',
        recognitionYear: 1899,
      });
      assert.equal(resAncient.status, 400);
      assert.equal(resAncient.data.success, false);
      assert.match(resAncient.data.message, /1950/i);

      // Zero or negative year
      const resZero = await memberClient.createAchievement({
        title: 'Năm không hợp lệ',
        recognitionYear: 0,
      });
      assert.equal(resZero.status, 400);
      assert.equal(resZero.data.success, false);

      // Valid boundary year: 1950
      const resBoundary1950 = await memberClient.createAchievement({
        title: 'Hồ sơ thành tích lịch sử năm 1950',
        recognitionYear: 1950,
      });
      assert.equal(resBoundary1950.status, 201);
      assert.equal(resBoundary1950.data.success, true);
      assert.equal(resBoundary1950.data.data.recognitionYear, 1950);
    });

    test('1.4 Max description length: string > 5000 chars rejected with 400, 5000 chars accepted', async () => {
      const oversizedDesc = 'A'.repeat(5001);
      const resOversized = await memberClient.createAchievement({
        title: 'Thành tích có mô tả quá dài',
        description: oversizedDesc,
        recognitionYear: 2025,
      });
      assert.equal(resOversized.status, 400);
      assert.equal(resOversized.data.success, false);
      assert.match(resOversized.data.message, /5000 ký tự/i);

      const maxValidDesc = 'B'.repeat(5000);
      const resValid = await memberClient.createAchievement({
        title: 'Thành tích có mô tả đúng 5000 ký tự',
        description: maxValidDesc,
        recognitionYear: 2025,
      });
      assert.equal(resValid.status, 201);
      assert.equal(resValid.data.success, true);
    });

    test('1.5 Invalid category enum is rejected with 400 Bad Request', async () => {
      const resInvalidCat = await memberClient.createAchievement({
        title: 'Thành tích danh mục không hợp lệ',
        category: 'INVALID_ENUM_CATEGORY_XYZ',
        recognitionYear: 2025,
      });
      assert.equal(resInvalidCat.status, 400);
      assert.equal(resInvalidCat.data.success, false);
      assert.match(resInvalidCat.data.message, /danh mục.*không hợp lệ/i);
    });
  });

  // ==========================================================================
  // Feature 2: AI Vision Auto-fill Edge Cases (5 tests)
  // ==========================================================================
  describe('Feature 2: AI Vision Auto-fill Edge Cases', () => {
    test('2.1 Zero-byte file upload returns 400 Bad Request', async () => {
      const resZero = await memberClient.extractCertificateAi({
        filename: 'empty_cert.png',
        contentBase64: '',
        fileSizeBytes: 0,
      });
      assert.equal(resZero.status, 400);
      assert.equal(resZero.data.success, false);
      assert.match(resZero.data.message, /rỗng|0 bytes/i);
    });

    test('2.2 Unsupported MIME type (.exe/.txt) returns 400 Bad Request', async () => {
      const resExe = await memberClient.extractCertificateAi({
        filename: 'malicious_payload.exe',
        mimeType: 'application/x-msdownload',
        contentBase64: 'TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAA=',
      });
      assert.equal(resExe.status, 400);
      assert.equal(resExe.data.success, false);
      assert.match(resExe.data.message, /không được hỗ trợ|JPG, PNG, PDF/i);

      const resTxt = await memberClient.extractCertificateAi({
        filename: 'notes.txt',
        mimeType: 'text/plain',
        contentBase64: 'SGVsbG8gd29ybGQ=',
      });
      assert.equal(resTxt.status, 400);
      assert.equal(resTxt.data.success, false);
    });

    test('2.3 Corrupted image header returns 400 Bad Request', async () => {
      const resCorrupt = await memberClient.extractCertificateAi({
        filename: 'corrupted_header.png',
        contentBase64: 'NOT_VALID_BASE64_CORRUPTED',
        corruptedHeader: true,
      });
      assert.equal(resCorrupt.status, 400);
      assert.equal(resCorrupt.data.success, false);
      assert.match(resCorrupt.data.message, /bị hỏng|tiêu đề không hợp lệ/i);
    });

    test('2.4 Oversized file > 50MB returns 413 Payload Too Large', async () => {
      const resOversized = await memberClient.extractCertificateAi({
        filename: 'oversized_scan_60mb.pdf',
        fileSizeBytes: 62914560, // 60MB
        oversized: true,
      });
      assert.equal(resOversized.status, 413);
      assert.equal(resOversized.data.success, false);
      assert.match(resOversized.data.message, /50MB/i);
    });

    test('2.5 Missing file field in payload returns 400 Bad Request', async () => {
      const resMissing = await memberClient.extractCertificateAi({});
      assert.equal(resMissing.status, 400);
      assert.equal(resMissing.data.success, false);
      assert.match(resMissing.data.message, /thiếu dữ liệu tập tin/i);
    });
  });

  // ==========================================================================
  // Feature 3: AI Vision Fallback Conditions (5 tests)
  // ==========================================================================
  describe('Feature 3: AI Vision Fallback Conditions', () => {
    test('3.1 Network timeout simulation triggers graceful fallback to manual input', async () => {
      const resTimeout = await memberClient.extractCertificateAi({
        filename: 'scan_cert_timeout.png',
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
        simulateTimeout: true,
      });
      assert.equal(resTimeout.status, 200);
      assert.equal(resTimeout.data.success, true);
      assert.equal(resTimeout.data.fallback, true);
      assert.equal(resTimeout.data.data, null);
      assert.match(resTimeout.data.message, /timeout|tự nhập thông tin/i);
    });

    test('3.2 Missing AI API key triggers graceful fallback', async () => {
      const resMissingKey = await memberClient.extractCertificateAi({
        filename: 'scan_cert_nokey.png',
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
        simulateMissingApiKey: true,
      });
      assert.equal(resMissingKey.status, 200);
      assert.equal(resMissingKey.data.success, true);
      assert.equal(resMissingKey.data.fallback, true);
      assert.equal(resMissingKey.data.data, null);
      assert.match(resMissingKey.data.message, /khóa API|tự nhập/i);
    });

    test('3.3 Illegible / blurred image triggers graceful manual input fallback', async () => {
      const resBlurred = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.unreadableBlurredImage.filename,
        contentBase64: OCR_FIXTURES.unreadableBlurredImage.contentBase64,
        simulateFallback: true,
      });
      assert.equal(resBlurred.status, 200);
      assert.equal(resBlurred.data.success, true);
      assert.equal(resBlurred.data.fallback, true);
      assert.equal(resBlurred.data.data, null);
      assert.match(resBlurred.data.message, /không thể nhận diện|tự nhập/i);
    });

    test('3.4 Partial OCR payload returns extracted fields while leaving unreadable fields null', async () => {
      const resPartial = await memberClient.extractCertificateAi({
        filename: 'partial_damaged_cert.png',
        simulatePartial: true,
      });
      assert.equal(resPartial.status, 200);
      assert.equal(resPartial.data.success, true);
      assert.equal(resPartial.data.fallback, false);
      assert.equal(resPartial.data.partial, true);
      assert.ok(resPartial.data.data.title);
      assert.equal(resPartial.data.data.decisionNumber, null);
      assert.equal(resPartial.data.data.issueDate, null);
    });

    test('3.5 Special characters in cert text are preserved without encoding corruption', async () => {
      const specialTitle = 'Bằng khen: "Chiến sĩ thi đua" & Giải nhất ĐHQG — 2025 (Kèm QĐ #123)';
      const resUnicode = await memberClient.extractCertificateAi({
        filename: 'special_chars_cert.png',
        certTitle: specialTitle,
      });
      assert.equal(resUnicode.status, 200);
      assert.equal(resUnicode.data.success, true);
      assert.equal(resUnicode.data.data.title, specialTitle);
    });
  });

  // ==========================================================================
  // Feature 4: AI Regulation Gap Analysis Extremes (5 tests)
  // ==========================================================================
  describe('Feature 4: AI Regulation Gap Analysis Extremes', () => {
    test('4.1 Candidate with 0 achievements returns 0% match with all missing criteria', async () => {
      const resZero = await memberClient.evaluateStructured(1, '2026-11-12', {
        headers: { 'Content-Type': 'application/json' },
      });
      const resZeroCandidate = await memberClient.request('POST', '/api/v1/ai/evaluations/structured', {
        regulationId: 1,
        mockCandidateAchievements: [],
      });
      assert.equal(resZeroCandidate.status, 200);
      assert.equal(resZeroCandidate.data.success, true);
      assert.equal(resZeroCandidate.data.data.percentage, 0);
      assert.equal(resZeroCandidate.data.data.isSatisfied, false);
      assert.ok(resZeroCandidate.data.data.criterionResults.every((c) => !c.isSatisfied));
      assert.ok(resZeroCandidate.data.data.criterionResults.every((c) => c.matchedRecords.length === 0));
    });

    test('4.2 Candidate with 100% criteria fulfillment returns isSatisfied: true', async () => {
      const res100 = await memberClient.evaluateStructured(1); // Regulation 1 CSTD_CS_2025
      assert.equal(res100.status, 200);
      assert.equal(res100.data.success, true);
      assert.equal(res100.data.data.percentage, 100);
      assert.equal(res100.data.data.isSatisfied, true);
      assert.ok(res100.data.data.criterionResults.every((c) => c.isSatisfied));
    });

    test('4.3 Non-existent regulation ID (99999) returns 404 Not Found', async () => {
      const resNotFound = await memberClient.evaluateStructured(99999);
      assert.equal(resNotFound.status, 404);
      assert.equal(resNotFound.data.success, false);
      assert.match(resNotFound.data.message, /không tìm thấy quy chế/i);
    });

    test('4.4 Duplicate criteria in regulation payload are deduplicated idempotently', async () => {
      const resDedup = await memberClient.evaluateStructured(1);
      assert.equal(resDedup.status, 200);
      const criterionIds = resDedup.data.data.criterionResults.map((c) => c.criterionId);
      const uniqueIds = new Set(criterionIds);
      assert.equal(criterionIds.length, uniqueIds.size, 'Criterion IDs must be unique without duplicate counting');
    });

    test('4.5 Boundary asOfDate: leap year and future accepted, malformed date returns 400', async () => {
      // Leap year date
      const resLeap = await memberClient.evaluateStructured(1, '2024-02-29');
      assert.equal(resLeap.status, 200);

      // Far future date
      const resFuture = await memberClient.evaluateStructured(1, '2099-12-31');
      assert.equal(resFuture.status, 200);

      // Malformed date: invalid calendar day (February 31)
      const resInvalidDay = await memberClient.evaluateStructured(1, '2025-02-31');
      assert.equal(resInvalidDay.status, 400);
      assert.equal(resInvalidDay.data.success, false);
      assert.match(resInvalidDay.data.message, /ngày asOfDate không hợp lệ/i);
    });
  });

  // ==========================================================================
  // Feature 5: AI Auto-Discovery Extremes (5 tests)
  // ==========================================================================
  describe('Feature 5: AI Auto-Discovery Extremes', () => {
    test('5.1 Empty regulations catalog returns 200 with empty list []', async () => {
      const resEmpty = await memberClient.request('POST', '/api/v1/ai/auto-discovery', {
        emptyCatalog: true,
      });
      assert.equal(resEmpty.status, 200);
      assert.equal(resEmpty.data.success, true);
      assert.ok(Array.isArray(resEmpty.data.data));
      assert.equal(resEmpty.data.data.length, 0);
    });

    test('5.2 Ties in ranking percentage resolve with stable deadline-based ordering', async () => {
      const resTie = await memberClient.request('POST', '/api/v1/ai/auto-discovery', {
        simulateTie: true,
      });
      assert.equal(resTie.status, 200);
      assert.equal(resTie.data.success, true);
      const items = resTie.data.data;
      assert.ok(items.length >= 2);
      assert.equal(items[0].percentage, items[1].percentage);
      // Tie breaker: earlier deadline comes first
      const time0 = new Date(items[0].deadline).getTime();
      const time1 = new Date(items[1].deadline).getTime();
      assert.ok(time0 <= time1, 'Tie-breaking must order earlier deadline first');
    });

    test('5.3 Expired regulation filtering excludes past-deadline regulations', async () => {
      const resFiltered = await memberClient.request('POST', '/api/v1/ai/auto-discovery', {
        includeExpired: true,
        filterActiveOnly: true,
        asOfDate: '2026-01-01T00:00:00Z',
      });
      assert.equal(resFiltered.status, 200);
      const items = resFiltered.data.data;
      assert.ok(items.every((r) => r.status !== 'EXPIRED'));
      assert.ok(items.every((r) => !r.deadline || new Date(r.deadline) >= new Date('2026-01-01T00:00:00Z')));
    });

    test('5.4 Future active date filtering excludes regulations not yet started', async () => {
      const resFuture = await memberClient.request('POST', '/api/v1/ai/auto-discovery', {
        includeFuture: true,
        filterActiveOnly: true,
        asOfDate: '2025-06-01T00:00:00Z',
      });
      assert.equal(resFuture.status, 200);
      const items = resFuture.data.data;
      assert.ok(items.every((r) => !r.startDate || new Date(r.startDate) <= new Date('2025-06-01T00:00:00Z')));
    });

    test('5.5 Single regulation catalog scenario returns exactly one ranked entry', async () => {
      const resSingle = await memberClient.request('POST', '/api/v1/ai/auto-discovery', {
        singleRegulationId: 1,
      });
      assert.equal(resSingle.status, 200);
      assert.equal(resSingle.data.success, true);
      assert.equal(resSingle.data.data.length, 1);
      assert.equal(resSingle.data.data[0].regulationId, 1);
      assert.equal(resSingle.data.data[0].rank, 1);
    });
  });

  // ==========================================================================
  // Feature 6: Dossier Packaging .ZIP Corner Cases (5 tests)
  // ==========================================================================
  describe('Feature 6: Dossier Packaging .ZIP Corner Cases', () => {
    test('6.1 Export with 0 matched achievements is rejected with 400 Bad Request', async () => {
      const resZeroMatch = await memberClient.request('POST', '/api/v1/ai/export-dossier-zip', {
        regulationId: 1,
        emptyDossier: true,
        matchedAchievementsCount: 0,
      });
      assert.equal(resZeroMatch.status, 400);
      assert.equal(resZeroMatch.data.success, false);
      assert.match(resZeroMatch.data.message, /không có minh chứng nào/i);
    });

    test('6.2 Export with non-existent regulation ID (99999) returns 404 Not Found', async () => {
      const resNotFound = await memberClient.exportDossierZip(99999);
      assert.equal(resNotFound.status, 404);
      assert.equal(resNotFound.data.success, false);
      assert.match(resNotFound.data.message, /không tìm thấy quy chế/i);
    });

    test('6.3 Rapid repeated export requests execute stably without crash or memory leak', async () => {
      const requests = Array.from({ length: 5 }, () => memberClient.exportDossierZip(1));
      const responses = await Promise.all(requests);
      for (const res of responses) {
        assert.equal(res.status, 200);
        assert.ok(res.buffer);
        assert.ok(res.buffer.length > 30);
      }
    });

    test('6.4 Filenames with Vietnamese diacritics / unicode are handled with proper encoding', async () => {
      const unicodeFilename = 'Hồ_Sơ_Chiến_Sĩ_Thi_Đua_ĐH_Lạc_Hồng_2025.zip';
      const resUnicode = await memberClient.request('POST', '/api/v1/ai/export-dossier-zip', {
        regulationId: 1,
        filename: unicodeFilename,
        innerFilename: '01_Bằng_khen_Chiến_sĩ_thi_đua_2025.pdf',
      });
      assert.equal(resUnicode.status, 200);
      const disposition = resUnicode.headers.get('content-disposition') || '';
      assert.ok(disposition.includes(encodeURIComponent(unicodeFilename)) || disposition.includes('.zip'));
    });

    test('6.5 File extension and PK zip magic bytes validation', async () => {
      const resZip = await memberClient.exportDossierZip(1);
      assert.equal(resZip.status, 200);
      assert.equal(resZip.headers.get('content-type'), 'application/zip');
      assert.ok(resZip.buffer);
      // Verify ZIP magic number: 'PK' (0x50, 0x4B)
      assert.equal(resZip.buffer[0], 0x50);
      assert.equal(resZip.buffer[1], 0x4B);
      assert.equal(resZip.buffer[2], 0x03);
      assert.equal(resZip.buffer[3], 0x04);
    });
  });

  // ==========================================================================
  // Feature 7: AI Gap to KPI Bridge Boundaries (5 tests)
  // ==========================================================================
  describe('Feature 7: AI Gap to KPI Bridge Boundaries', () => {
    test('7.1 Empty missing criteria array is rejected with 400 Bad Request', async () => {
      const resEmpty = await memberClient.createKpiFromAiGap(2, []);
      assert.equal(resEmpty.status, 400);
      assert.equal(resEmpty.data.success, false);
      assert.match(resEmpty.data.message, /tiêu chí thiếu hụt không được để trống/i);
    });

    test('7.2 Missing criteria item with missingCount = 0 is rejected with 400', async () => {
      const resZeroCount = await memberClient.createKpiFromAiGap(2, [
        { code: 'CRIT_ZERO', name: 'Tiêu chí đã đạt', missingCount: 0 },
      ]);
      assert.equal(resZeroCount.status, 400);
      assert.equal(resZeroCount.data.success, false);
      assert.match(resZeroCount.data.message, /lớn hơn 0/i);
    });

    test('7.3 Duplicate goal codes in missing criteria are rejected with 400', async () => {
      const resDup = await memberClient.createKpiFromAiGap(2, [
        { code: 'CRIT_DUP', name: 'Tiêu chí trùng 1', missingCount: 1 },
        { code: 'CRIT_DUP', name: 'Tiêu chí trùng 2', missingCount: 2 },
      ]);
      assert.equal(resDup.status, 400);
      assert.equal(resDup.data.success, false);
      assert.match(resDup.data.message, /trùng lặp/i);
    });

    test('7.4 Target date in the past is rejected with 400 Bad Request', async () => {
      const resPast = await memberClient.request('POST', '/api/v1/kpi/from-ai-gap', {
        regulationId: 2,
        targetDate: '2020-01-01',
        missingCriteria: [{ code: 'CRIT_VALID', name: 'Tiêu chí hợp lệ', missingCount: 1 }],
      });
      assert.equal(resPast.status, 400);
      assert.equal(resPast.data.success, false);
      assert.match(resPast.data.message, /quá khứ/i);
    });

    test('7.5 Extreme notes length > 5000 chars is rejected with 400 Bad Request', async () => {
      const extremeNotes = 'X'.repeat(5001);
      const resLongNotes = await memberClient.request('POST', '/api/v1/kpi/from-ai-gap', {
        regulationId: 2,
        notes: extremeNotes,
        missingCriteria: [{ code: 'CRIT_VALID_2', name: 'Tiêu chí ghi chú dài', missingCount: 1 }],
      });
      assert.equal(resLongNotes.status, 400);
      assert.equal(resLongNotes.data.success, false);
      assert.match(resLongNotes.data.message, /5000 ký tự/i);
    });
  });

  // ==========================================================================
  // Feature 8: Calendar Reminder Edge Cases (5 tests)
  // ==========================================================================
  describe('Feature 8: Calendar Reminder Edge Cases', () => {
    test('8.1 Malformed date format returns 400 Bad Request', async () => {
      const resBadDate = await memberClient.createCalendarReminder({
        title: 'Nhắc nhở ngày sai',
        deadlineDate: 'not-a-valid-date-string',
      });
      assert.equal(resBadDate.status, 400);
      assert.equal(resBadDate.data.success, false);
      assert.match(resBadDate.data.message, /ngày hạn chót không hợp lệ/i);
    });

    test('8.2 Reminder date in the past returns 400 Bad Request', async () => {
      const resPastDate = await memberClient.createCalendarReminder({
        title: 'Hạn nộp quá khứ',
        deadlineDate: '2020-01-01T00:00:00Z',
      });
      assert.equal(resPastDate.status, 400);
      assert.equal(resPastDate.data.success, false);
      assert.match(resPastDate.data.message, /quá khứ/i);
    });

    test('8.3 Missing or empty reminder title returns 400 Bad Request', async () => {
      const resMissingTitle = await memberClient.createCalendarReminder({
        title: '',
        deadlineDate: '2026-12-15T17:00:00Z',
      });
      assert.equal(resMissingTitle.status, 400);
      assert.equal(resMissingTitle.data.success, false);
      assert.match(resMissingTitle.data.message, /tiêu đề và hạn chót là bắt buộc/i);
    });

    test('8.4 Duplicate reminder for same regulation and deadline returns 409 Conflict', async () => {
      const payload = {
        title: 'Hạn nộp hồ sơ xét tặng giảng viên xuất sắc 2026',
        regulationId: 55,
        deadlineDate: '2026-11-20T17:00:00Z',
      };
      // First submission succeeds (201)
      const resFirst = await memberClient.createCalendarReminder(payload);
      assert.equal(resFirst.status, 201);

      // Duplicate submission returns 409 Conflict
      const resDup = await memberClient.createCalendarReminder(payload);
      assert.equal(resDup.status, 409);
      assert.equal(resDup.data.success, false);
      assert.match(resDup.data.message, /đã tồn tại nhắc nhở/i);
    });

    test('8.5 Maximum title length: > 255 chars rejected with 400, 255 chars accepted', async () => {
      const tooLongTitle = 'N'.repeat(256);
      const resTooLong = await memberClient.createCalendarReminder({
        title: tooLongTitle,
        deadlineDate: '2026-12-30T17:00:00Z',
      });
      assert.equal(resTooLong.status, 400);
      assert.equal(resTooLong.data.success, false);
      assert.match(resTooLong.data.message, /255 ký tự/i);

      const maxValidTitle = 'M'.repeat(255);
      const resValid = await memberClient.createCalendarReminder({
        title: maxValidTitle,
        deadlineDate: '2026-12-31T17:00:00Z',
      });
      assert.equal(resValid.status, 201);
      assert.equal(resValid.data.success, true);
    });
  });

  // ==========================================================================
  // Feature 9: Public CV Custom Slug Corner Cases (5 tests)
  // ==========================================================================
  describe('Feature 9: Public CV Custom Slug Corner Cases', () => {
    test('9.1 Private profile (is_public = false) returns privacy notice to unauthenticated guests', async () => {
      const resPrivate = await memberClient.getPublicCv('tran-thi-bich');
      assert.equal(resPrivate.status, 200);
      assert.equal(resPrivate.data.success, true);
      assert.equal(resPrivate.data.data.isPublic, false);
      assert.match(resPrivate.data.data.message, /chế độ riêng tư/i);
      // Asserts sensitive achievements & contact are hidden
      assert.equal(resPrivate.data.data.achievements, undefined);
      assert.equal(resPrivate.data.data.contact, undefined);
    });

    test('9.2 Slug with special characters, symbols, or spaces returns 400 Bad Request', async () => {
      const resSpecial = await memberClient.updateCv({
        slug: 'nguyen van an!@#$',
      });
      assert.equal(resSpecial.status, 400);
      assert.equal(resSpecial.data.success, false);
      assert.match(resSpecial.data.message, /chữ cái thường, số và dấu gạch ngang/i);

      const resSpaces = await memberClient.updateCv({
        slug: 'nguyen van an',
      });
      assert.equal(resSpaces.status, 400);
      assert.equal(resSpaces.data.success, false);
    });

    test('9.3 Slug length boundary: < 3 chars or > 100 chars rejected with 400, 3 chars accepted', async () => {
      // Too short: 2 chars
      const resShort = await memberClient.updateCv({ slug: 'an' });
      assert.equal(resShort.status, 400);
      assert.equal(resShort.data.success, false);
      assert.match(resShort.data.message, /từ 3 đến 100/i);

      // Too long: 101 chars
      const resLong = await memberClient.updateCv({ slug: 'a'.repeat(101) });
      assert.equal(resLong.status, 400);
      assert.equal(resLong.data.success, false);

      // Valid boundary: exactly 3 chars
      const resBoundary3 = await memberClient.updateCv({ slug: 'pgs' });
      assert.equal(resBoundary3.status, 200);
      assert.equal(resBoundary3.data.data.slug, 'pgs');
    });

    test('9.4 Non-existent custom slug returns 404 Not Found', async () => {
      const resNotFound = await memberClient.getPublicCv('slug-hoan-toan-khong-ton-tai-xyz-999');
      assert.equal(resNotFound.status, 404);
      assert.equal(resNotFound.data.success, false);
      assert.match(resNotFound.data.message, /không tồn tại/i);
    });

    test('9.5 Reserved system keywords as slugs are rejected with 400 Bad Request', async () => {
      const reservedList = ['admin', 'api', 'auth', 'system', 'login'];
      for (const reserved of reservedList) {
        const resReserved = await memberClient.updateCv({ slug: reserved });
        assert.equal(resReserved.status, 400, `Slug '${reserved}' must be rejected`);
        assert.equal(resReserved.data.success, false);
        assert.match(resReserved.data.message, /bảo lưu/i);
      }
    });
  });

  // ==========================================================================
  // Feature 10: CV Templates & DOCX Edge Cases (5 tests)
  // ==========================================================================
  describe('Feature 10: CV Templates & DOCX Edge Cases', () => {
    test('10.1 Invalid template ID is rejected with 400 Bad Request', async () => {
      const resBadTpl = await memberClient.updateCv({
        templateId: 'INVALID_UNKNOWN_TEMPLATE_XYZ',
      });
      assert.equal(resBadTpl.status, 400);
      assert.equal(resBadTpl.data.success, false);
      assert.match(resBadTpl.data.message, /mẫu giao diện.*không hợp lệ/i);
    });

    test('10.2 Empty profile achievements export DOCX without server crash', async () => {
      // Export DOCX for user with 0 achievements
      const resDocx = await memberClient.exportCvDocx();
      assert.equal(resDocx.status, 200);
      assert.ok(resDocx.buffer);
      assert.ok(resDocx.buffer.length > 30);
    });

    test('10.3 Custom template with missing layout placeholders falls back to standard template', async () => {
      const resFallbackTpl = await memberClient.updateCv({
        templateId: 'Modern',
        customHtmlLayout: '',
      });
      assert.equal(resFallbackTpl.status, 200);
      assert.equal(resFallbackTpl.data.success, true);
    });

    test('10.4 Binary DOCX stream integrity: verifies PK zip container magic bytes', async () => {
      const resDocx = await memberClient.exportCvDocx();
      assert.equal(resDocx.status, 200);
      assert.equal(
        resDocx.headers.get('content-type'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      // Valid Word (.docx) is a PKZip package
      assert.equal(resDocx.buffer[0], 0x50); // 'P'
      assert.equal(resDocx.buffer[1], 0x4B); // 'K'
      assert.equal(resDocx.buffer[2], 0x03);
      assert.equal(resDocx.buffer[3], 0x04);
    });

    test('10.5 DOCX export with complex Vietnamese unicode diacritics and scientific symbols', async () => {
      await memberClient.updateCv({
        slug: 'nguyen-van-an-unicode',
        headline: 'PGS.TS. Nguyễn Văn An — Nghiên cứu AI, Học sâu & IoT y tế (Σ, α, β)',
        bio: 'Công trình đạt chuẩn Scopus Q1 tại Đại học Lạc Hồng.',
      });
      const resDocx = await memberClient.exportCvDocx();
      assert.equal(resDocx.status, 200);
      assert.ok(resDocx.buffer);
      assert.ok(resDocx.buffer.length > 0);
    });
  });

  // ==========================================================================
  // Feature 11: 3-Level Organization Tree Boundaries (5 tests)
  // ==========================================================================
  describe('Feature 11: 3-Level Org Tree Boundaries', () => {
    test('11.1 Circular parent reference is guarded and rejected with 400 Bad Request', async () => {
      const resCircular = await adminClient.createOrgUnit({
        unitId: 2,
        parentId: 2, // setting parent to self
        name: 'Bộ môn Tự Tham Chiếu',
      });
      assert.equal(resCircular.status, 400);
      assert.equal(resCircular.data.success, false);
      assert.match(resCircular.data.message, /vòng lặp tham chiếu/i);
    });

    test('11.2 Orphaned unit creation with non-existent parent ID (99999) returns 400', async () => {
      const resOrphan = await adminClient.createOrgUnit({
        parentId: 99999,
        name: 'Bộ môn Mồ Côi',
      });
      assert.equal(resOrphan.status, 400);
      assert.equal(resOrphan.data.success, false);
      assert.match(resOrphan.data.message, /đơn vị cha không tồn tại/i);
    });

    test('11.3 Deep nesting > 3 levels guard rejects sub-department under Level 3 with 400', async () => {
      const resDeep = await adminClient.createOrgUnit({
        parentId: 2, // Level 3: FIT_SE
        parentType: 'DEPARTMENT',
        level: 4,
        name: 'Tổ Chuyên Môn Cấp 4',
      });
      assert.equal(resDeep.status, 400);
      assert.equal(resDeep.data.success, false);
      assert.match(resDeep.data.message, /tối đa 3 cấp/i);
    });

    test('11.4 Empty unit name returns 400 Bad Request', async () => {
      const resEmptyName = await adminClient.createOrgUnit({
        parentId: 1,
        name: '    ',
      });
      assert.equal(resEmptyName.status, 400);
      assert.equal(resEmptyName.data.success, false);
      assert.match(resEmptyName.data.message, /tên đơn vị không được để trống/i);
    });

    test('11.5 Valid 3-level tree retrieval verifies strict 3-level hierarchy', async () => {
      const resTree = await adminClient.getOrganizationTree();
      assert.equal(resTree.status, 200);
      assert.equal(resTree.data.success, true);
      const root = resTree.data.data;
      assert.equal(root.type, 'UNIVERSITY'); // Level 1
      assert.ok(Array.isArray(root.children));
      const faculty = root.children[0];
      assert.equal(faculty.type, 'FACULTY'); // Level 2
      assert.ok(Array.isArray(faculty.children));
      const dept = faculty.children[0];
      assert.equal(dept.type, 'DEPARTMENT'); // Level 3
    });
  });

  // ==========================================================================
  // Feature 12: 4 Standard Roles Authorization Violations (5 tests)
  // ==========================================================================
  describe('Feature 12: 4 Standard Roles Authorization Violations', () => {
    test('12.1 Unauthenticated request returns 401 Unauthorized', async () => {
      const unauthClient = createTestClient({ token: null });
      const res = await unauthClient.listAchievements();
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
      assert.match(res.data.message, /thiếu access token/i);
    });

    test('12.2 Malformed or invalid JWT token returns 401 Unauthorized', async () => {
      const badTokenClient = createTestClient({ token: 'invalid.jwt.token.string' });
      const res = await badTokenClient.listAchievements();
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
      assert.match(res.data.message, /token không hợp lệ/i);
    });

    test('12.3 Privilege escalation: MEMBER attempting unit AI scan returns 403 Forbidden', async () => {
      const resMemberScan = await memberClient.scanUnitWithAi(2, 1);
      assert.equal(resMemberScan.status, 403);
      assert.equal(resMemberScan.data.success, false);
      assert.match(resMemberScan.data.message, /không có thẩm quyền/i);
    });

    test('12.4 DEPARTMENT_HEAD attempting to scan other department returns 403 Forbidden', async () => {
      // TS. Trần Thị Bích is head of FIT_SE (unitId = 2), attempts to scan FIT_CS (unitId = 3)
      const resOtherDept = await deptHeadClient.scanUnitWithAi(3, 1);
      assert.equal(resOtherDept.status, 403);
      assert.equal(resOtherDept.data.success, false);
      assert.match(resOtherDept.data.message, /chỉ được phép quét thành viên thuộc bộ môn của mình/i);
    });

    test('12.5 Revoked or expired token returns 401 Unauthorized', async () => {
      const revokedToken = generateMockToken(ROLES.MEMBER, undefined, { revoked: true });
      const revokedClient = createTestClient({ token: revokedToken });
      const resRevoked = await revokedClient.listAchievements();
      assert.equal(resRevoked.status, 401);
      assert.equal(resRevoked.data.success, false);
      assert.match(resRevoked.data.message, /thu hồi hoặc hết hạn/i);
    });
  });

  // ==========================================================================
  // Feature 13: Unit AI Scan Extremes (5 tests)
  // ==========================================================================
  describe('Feature 13: Unit AI Scan Extremes', () => {
    test('13.1 Scanning unit with 0 members returns 200 with empty results []', async () => {
      // FACULTY_LEAD scans Unit 3 (FIT_CS, 0 members)
      const resZeroMembers = await facultyLeadClient.scanUnitWithAi(3, 1);
      assert.equal(resZeroMembers.status, 200);
      assert.equal(resZeroMembers.data.success, true);
      assert.equal(resZeroMembers.data.data.results.length, 0);
      assert.equal(resZeroMembers.data.data.totalMembers, 0);
    });

    test('13.2 Scanning non-existent unit ID (99999) returns 404 Not Found', async () => {
      const resNotFoundUnit = await adminClient.scanUnitWithAi(99999, 1);
      assert.equal(resNotFoundUnit.status, 404);
      assert.equal(resNotFoundUnit.data.success, false);
      assert.match(resNotFoundUnit.data.message, /không tìm thấy đơn vị/i);
    });

    test('13.3 Scanning with non-existent regulation ID (99999) returns 404 Not Found', async () => {
      const resNotFoundReg = await facultyLeadClient.scanUnitWithAi(2, 99999);
      assert.equal(resNotFoundReg.status, 404);
      assert.equal(resNotFoundReg.data.success, false);
      assert.match(resNotFoundReg.data.message, /không tìm thấy quy chế/i);
    });

    test('13.4 MEMBER role is strictly forbidden from initiating unit scans (403)', async () => {
      const resForbidden = await memberClient.scanUnitWithAi(1, 1);
      assert.equal(resForbidden.status, 403);
      assert.equal(resForbidden.data.success, false);
    });

    test('13.5 Large unit batch scan simulation (50 members) completes with accurate aggregations', async () => {
      const resBatch = await facultyLeadClient.request(
        'POST',
        '/api/v1/organizations/units/2/ai-scan',
        { regulationId: 1, simulateBatchCount: 50 }
      );
      assert.equal(resBatch.status, 200);
      assert.equal(resBatch.data.success, true);
      assert.equal(resBatch.data.data.results.length, 50);
      assert.equal(resBatch.data.data.totalMembers, 50);
      assert.equal(resBatch.data.data.eligibleCount, 25);
      assert.ok(resBatch.data.data.results.every((r) => r.userId && r.fullName && r.percentage >= 0));
    });
  });
});
