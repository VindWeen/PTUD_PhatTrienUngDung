/**
 * tests/e2e/tier1-feature-coverage.test.js
 * E2E Test Suite - Milestone E2E-M2: Tier 1 Feature Coverage Tests
 *
 * Covers all 13 core features with >= 5 nominal happy path & contract adherence tests each
 * Total tests: 67 tests (strictly >= 65 tests).
 *
 * Feature Inventory:
 *  1. Personal Achievement Vault (immediate ACTIVE status)
 *  2. AI Vision Auto-fill for Certificates
 *  3. AI Vision Graceful Fallback (manual input continuity)
 *  4. AI Regulation Gap Analysis (passed & missing criteria)
 *  5. AI Auto-Discovery (Khám Ngược - ranked regulations)
 *  6. Dossier Packaging (.ZIP binary stream & file format)
 *  7. AI Gap to KPI Roadmap Bridge (source = 'AI_GAP')
 *  8. Calendar Reminder Integration (deadline popup into personal calendar)
 *  9. Public CV with Custom Slug (/cv/:slug & visibility toggle)
 * 10. CV Web & Word (.docx) Template Export (3 web templates + DOCX binary)
 * 11. 3-Level Organization Hierarchy (Trường -> Khoa -> Bộ môn)
 * 12. 4 Standard Roles Authorization Matrix (MEMBER, DEPT_HEAD, FACULTY_LEAD, ADMIN)
 * 13. Unit AI Scan & Reports (unit-level scans for leaders)
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, createClient as createTestClient, generateMockToken } from './helpers/testClient.js';
import { ROLES, USERS, ACHIEVEMENTS, REGULATIONS, CV_FIXTURES, OCR_FIXTURES } from './helpers/fixtures.js';

describe('Tier 1: Comprehensive Feature Coverage Tests (13 Features)', () => {
  const testMode = process.env.TEST_MODE || 'mock';

  let memberClient;
  let deptHeadClient;
  let facultyLeadClient;
  let adminClient;

  before(() => {
    memberClient = createTestClient({ role: ROLES.MEMBER, testMode });
    deptHeadClient = createTestClient({ role: ROLES.DEPARTMENT_HEAD, testMode });
    facultyLeadClient = createTestClient({ role: ROLES.FACULTY_LEAD, testMode });
    adminClient = createTestClient({ role: ROLES.ADMIN, testMode });
  });

  // =========================================================================
  // Feature 1: Personal Achievement Vault (immediate ACTIVE status)
  // =========================================================================
  describe('Feature 1: Personal Achievement Vault (immediate ACTIVE status)', () => {
    test('TC-F1-01: Creating an achievement sets status to ACTIVE and label "Sẵn sàng sử dụng" immediately', async () => {
      const payload = {
        title: 'Bằng khen Sáng kiến Cải tiến Giảng dạy Số 2025',
        recognitionYear: 2025,
        type: 'INNOVATION',
        issuer: 'Trường Đại học Lạc Hồng',
      };
      const res = await memberClient.createAchievement(payload);

      assert.equal(res.status, 201, 'Should return HTTP 201 Created');
      assert.equal(res.data.success, true, 'Response must indicate success');
      assert.equal(res.data.data.status, 'ACTIVE', 'New achievement must immediately be ACTIVE');
      assert.equal(res.data.data.statusLabel, 'Sẵn sàng sử dụng', 'Status label must indicate ready to use');
      assert.ok(res.data.data.achievementId > 0, 'Achievement must receive valid numerical ID');
      assert.equal(res.data.data.title, payload.title);
    });

    test('TC-F1-02: Creating a journal paper achievement captures publication metadata correctly', async () => {
      const payload = {
        ...ACHIEVEMENTS.validPaperQ1,
        title: 'Nghiên cứu ứng dụng Transformer trong thị giác máy tính y sinh',
      };
      const res = await memberClient.createAchievement(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.type, 'JOURNAL_PAPER');
      assert.equal(res.data.data.issuer, payload.issuer);
      assert.equal(res.data.data.decisionNumber, payload.decisionNumber);
      assert.equal(res.data.data.evidenceFileUrl, payload.evidenceFileUrl);
      assert.equal(res.data.data.status, 'ACTIVE');
    });

    test('TC-F1-03: Creating a patent achievement records innovation category without administrative review', async () => {
      const payload = {
        ...ACHIEVEMENTS.validPatent,
        title: 'Hệ thống AI nhận dạng bất thường trong dây chuyền sản xuất dược phẩm',
      };
      const res = await memberClient.createAchievement(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.type, 'PATENT');
      assert.equal(res.data.data.category, 'INNOVATION');
      assert.equal(res.data.data.status, 'ACTIVE');
    });

    test('TC-F1-04: Listing achievements returns user-scoped list with pagination and ACTIVE status', async () => {
      const res = await memberClient.listAchievements();

      assert.equal(res.status, 200, 'Should return HTTP 200 OK');
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data), 'Data must be an array of achievements');
      assert.ok(res.data.data.length >= 3, 'Should contain at least the seeded achievements');
      assert.ok(res.data.data.every((a) => a.status === 'ACTIVE'), 'All retrieved achievements must have ACTIVE status');
      assert.ok(res.data.pagination, 'Response must include pagination metadata');
      assert.equal(typeof res.data.pagination.total, 'number');
      assert.ok(res.data.pagination.total >= res.data.data.length);
    });

    test('TC-F1-05: Getting specific achievement by ID returns full record details', async () => {
      const res = await memberClient.getAchievement(1);

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.achievementId, 1);
      assert.equal(res.data.data.status, 'ACTIVE');
      assert.ok(res.data.data.title.length > 0);
      assert.ok(res.data.data.issuer.length > 0);
    });

    test('TC-F1-06: Creating teaching award achievement with evidence file URL stores link directly', async () => {
      const payload = {
        ...ACHIEVEMENTS.validTeachingAward,
        title: 'Giảng viên dạy giỏi cấp Tỉnh năm học 2024 - 2025',
        evidenceFileUrl: 'https://storage.lhu.edu.vn/evidences/gvdg_tinh_2025.pdf',
      };
      const res = await memberClient.createAchievement(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.status, 'ACTIVE');
      assert.equal(res.data.data.evidenceFileUrl, 'https://storage.lhu.edu.vn/evidences/gvdg_tinh_2025.pdf');
    });
  });

  // =========================================================================
  // Feature 2: AI Vision Auto-fill for Certificates
  // =========================================================================
  describe('Feature 2: AI Vision Auto-fill for Certificates', () => {
    test('TC-F2-01: AI Vision extracts certificate data from valid image file', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.validCertificateImage.filename,
        mimeType: OCR_FIXTURES.validCertificateImage.mimeType,
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.fallback, false, 'Should not trigger fallback for readable image');
      assert.ok(res.data.data, 'Extracted data payload must exist');
    });

    test('TC-F2-02: Extracted metadata contains non-empty title and integer recognitionYear', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.validCertificateImage.filename,
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
      });

      assert.equal(res.status, 200);
      const data = res.data.data;
      assert.ok(typeof data.title === 'string' && data.title.length > 0, 'Title must be non-empty string');
      assert.equal(typeof data.recognitionYear, 'number', 'Recognition year must be numerical');
      assert.equal(data.recognitionYear, 2025);
    });

    test('TC-F2-03: Extracted metadata includes issuer and decisionNumber fields', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.validCertificateImage.filename,
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
      });

      assert.equal(res.status, 200);
      const data = res.data.data;
      assert.ok(data.issuer, 'Issuer must be extracted');
      assert.ok(data.decisionNumber, 'Decision number must be extracted');
      assert.equal(data.decisionNumber, '1245/QD-UBND');
    });

    test('TC-F2-04: AI Vision processes PDF certificate documents accurately', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.validCertificatePdf.filename,
        mimeType: OCR_FIXTURES.validCertificatePdf.mimeType,
        contentBase64: OCR_FIXTURES.validCertificatePdf.contentBase64,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.fallback, false);
      assert.ok(res.data.data.title);
    });

    test('TC-F2-05: Vision extraction response includes descriptive success message', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.validCertificateImage.filename,
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
      });

      assert.equal(res.status, 200);
      assert.ok(res.data.message, 'Message must be present');
      assert.ok(res.data.message.toLowerCase().includes('vision ai') || res.data.message.toLowerCase().includes('thành công'));
    });
  });

  // =========================================================================
  // Feature 3: AI Vision Graceful Fallback (manual input continuity)
  // =========================================================================
  describe('Feature 3: AI Vision Graceful Fallback (manual input continuity)', () => {
    test('TC-F3-01: Blurred certificate returns HTTP 200 with fallback flag set to true', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.unreadableBlurredImage.filename,
        mimeType: OCR_FIXTURES.unreadableBlurredImage.mimeType,
        contentBase64: OCR_FIXTURES.unreadableBlurredImage.contentBase64,
      });

      assert.equal(res.status, 200, 'Fallback must return HTTP 200, not 500 error');
      assert.equal(res.data.success, true);
      assert.equal(res.data.fallback, true, 'Fallback flag must be true');
      assert.equal(res.data.data, null, 'Data payload must be null on fallback');
    });

    test('TC-F3-02: Fallback response provides user-friendly Vietnamese guidance message', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: 'mo_hinh_anh_khong_ro.jpg',
        simulateFallback: true,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.fallback, true);
      assert.ok(typeof res.data.message === 'string');
      assert.ok(
        res.data.message.includes('tự nhập thông tin') || res.data.message.includes('nhập tay'),
        'Message must politely advise user to fill form manually'
      );
    });

    test('TC-F3-03: Corrupted certificate file gracefully triggers fallback without crashing', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: 'corrupted_certificate.png',
        simulateFallback: true,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.fallback, true);
      assert.equal(res.data.data, null);
    });

    test('TC-F3-04: Simulated AI service unavailability returns fallback without breaking workflow', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: 'certificate_test.jpg',
        simulateFallback: true,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.fallback, true);
    });

    test('TC-F3-05: Following fallback, manual achievement entry succeeds seamlessly with ACTIVE status', async () => {
      // 1. Trigger fallback
      const fallbackRes = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.unreadableBlurredImage.filename,
        contentBase64: OCR_FIXTURES.unreadableBlurredImage.contentBase64,
      });
      assert.equal(fallbackRes.data.fallback, true);

      // 2. Seamlessly submit manual entry
      const manualPayload = {
        title: 'Giấy chứng nhận Báo cáo viên xuất sắc Hội thảo Quốc tế 2025',
        recognitionYear: 2025,
        type: 'CERTIFICATE',
        issuer: 'Ban Tổ chức Hội thảo IEEE ICSET',
        decisionNumber: 'IEEE-ICSET-2025-012',
      };
      const createRes = await memberClient.createAchievement(manualPayload);

      assert.equal(createRes.status, 201, 'Manual input must succeed with 201 Created');
      assert.equal(createRes.data.success, true);
      assert.equal(createRes.data.data.status, 'ACTIVE', 'Manually created achievement is immediately ACTIVE');
      assert.equal(createRes.data.data.title, manualPayload.title);
    });
  });

  // =========================================================================
  // Feature 4: AI Regulation Gap Analysis (passed & missing criteria)
  // =========================================================================
  describe('Feature 4: AI Regulation Gap Analysis (passed & missing criteria)', () => {
    test('TC-F4-01: Structured evaluation against eligible regulation returns 100% satisfied', async () => {
      const res = await memberClient.evaluateStructured(1); // Regulation 1: CSTD_CS_2025

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.regulationId, 1);
      assert.equal(res.data.data.isSatisfied, true, 'User with 3 qualifying achievements should be satisfied');
      assert.equal(res.data.data.percentage, 100);
    });

    test('TC-F4-02: Structured evaluation returns criterionResults with evidence for satisfied criteria', async () => {
      const res = await memberClient.evaluateStructured(1);

      assert.equal(res.status, 200);
      const results = res.data.data.criterionResults;
      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 3, 'Must have at least 3 criteria evaluated');
      assert.ok(results.every((c) => c.isSatisfied === true));
      assert.ok(results.every((c) => Array.isArray(c.matchedRecords) && c.matchedRecords.length > 0));
    });

    test('TC-F4-03: Structured evaluation against demanding regulation detects unsatisfied criteria', async () => {
      const res = await memberClient.evaluateStructured(2); // Regulation 2: GV_XUATSAC_2025

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.regulationId, 2);
      assert.equal(res.data.data.isSatisfied, false, 'Regulation 2 should have unmet criteria');
      assert.ok(res.data.data.percentage < 100, 'Percentage must be strictly less than 100%');
    });

    test('TC-F4-04: Gap analysis explicitly details missing criteria count and codes', async () => {
      const res = await memberClient.evaluateStructured(2);

      assert.equal(res.status, 200);
      const results = res.data.data.criterionResults;
      const missingCriteria = results.filter((c) => !c.isSatisfied);

      assert.ok(missingCriteria.length > 0, 'Must have at least one missing criterion');
      assert.ok(missingCriteria[0].missingCount > 0, 'Missing count must be greater than zero');
      assert.ok(missingCriteria[0].code, 'Missing criterion must provide unique code');
      assert.ok(missingCriteria[0].name, 'Missing criterion must provide human-readable name');
    });

    test('TC-F4-05: Gap analysis response adheres to contract schema with regulation name and date', async () => {
      const res = await memberClient.evaluateStructured(1, '2026-11-12');

      assert.equal(res.status, 200);
      const data = res.data.data;
      assert.ok(data.regulationName, 'Must include regulationName');
      assert.equal(typeof data.percentage, 'number');
      assert.equal(typeof data.isSatisfied, 'boolean');
      assert.ok(Array.isArray(data.criterionResults));
    });
  });

  // =========================================================================
  // Feature 5: AI Auto-Discovery (Khám Ngược - ranked regulations)
  // =========================================================================
  describe('Feature 5: AI Auto-Discovery (Khám Ngược - ranked regulations)', () => {
    test('TC-F5-01: Auto-discovery scans active regulations and returns 200 OK with candidates', async () => {
      const res = await memberClient.autoDiscover();

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data), 'Data must be array of regulation candidates');
      assert.ok(res.data.data.length >= 2, 'Must discover at least 2 open regulations');
    });

    test('TC-F5-02: Auto-discovery ranks candidates in descending order of match percentage', async () => {
      const res = await memberClient.autoDiscover();

      assert.equal(res.status, 200);
      const candidates = res.data.data;
      for (let i = 0; i < candidates.length - 1; i++) {
        assert.ok(
          candidates[i].percentage >= candidates[i + 1].percentage,
          `Candidate at index ${i} (${candidates[i].percentage}%) must be >= index ${i + 1} (${candidates[i + 1].percentage}%)`
        );
      }
    });

    test('TC-F5-03: Top candidate reports satisfiedCount and totalCount matching 100% eligibility', async () => {
      const res = await memberClient.autoDiscover();

      assert.equal(res.status, 200);
      const topCandidate = res.data.data[0];
      assert.equal(topCandidate.percentage, 100);
      assert.equal(topCandidate.satisfiedCount, topCandidate.totalCount);
      assert.ok(topCandidate.totalCount > 0);
    });

    test('TC-F5-04: Auto-discovery candidates include submission deadlines for timeline planning', async () => {
      const res = await memberClient.autoDiscover();

      assert.equal(res.status, 200);
      for (const item of res.data.data) {
        assert.ok(item.deadline, `Candidate ${item.name} must specify deadline`);
        assert.ok(!isNaN(Date.parse(item.deadline)), 'Deadline must be valid parseable date string');
      }
    });

    test('TC-F5-05: Auto-discovery candidate schema conforms strictly to contract requirements', async () => {
      const res = await memberClient.autoDiscover();

      assert.equal(res.status, 200);
      const first = res.data.data[0];
      assert.ok(first.regulationId > 0, 'regulationId must be positive integer');
      assert.ok(typeof first.name === 'string' && first.name.length > 0, 'name must be valid string');
      assert.ok(first.percentage >= 0 && first.percentage <= 100, 'percentage must be between 0 and 100');
      assert.ok(first.satisfiedCount <= first.totalCount, 'satisfiedCount must not exceed totalCount');
    });
  });

  // =========================================================================
  // Feature 6: Dossier Packaging (.ZIP binary stream & file format)
  // =========================================================================
  describe('Feature 6: Dossier Packaging (.ZIP binary stream & file format)', () => {
    test('TC-F6-01: Exporting dossier zip returns HTTP 200 for eligible regulation', async () => {
      const res = await memberClient.exportDossierZip(1);

      assert.equal(res.status, 200, 'Must return HTTP 200 OK');
      assert.equal(res.ok, true);
    });

    test('TC-F6-02: Dossier export sets Content-Type header to application/zip', async () => {
      const res = await memberClient.exportDossierZip(1);

      assert.equal(res.status, 200);
      const contentType = res.headers.get('content-type');
      assert.ok(contentType, 'Content-Type header must exist');
      assert.equal(contentType.toLowerCase(), 'application/zip');
    });

    test('TC-F6-03: Dossier export includes Content-Disposition attachment with .zip extension', async () => {
      const res = await memberClient.exportDossierZip(1);

      assert.equal(res.status, 200);
      const disposition = res.headers.get('content-disposition');
      assert.ok(disposition, 'Content-Disposition header must be present');
      assert.ok(disposition.includes('attachment'), 'Must be attachment disposition');
      assert.ok(disposition.includes('.zip'), 'Filename must have .zip extension');
    });

    test('TC-F6-04: Dossier binary buffer starts with valid PK zip magic bytes (0x50 0x4B 0x03 0x04)', async () => {
      const res = await memberClient.exportDossierZip(1);

      assert.equal(res.status, 200);
      assert.ok(Buffer.isBuffer(res.buffer), 'Response buffer must be a valid Node Buffer');
      assert.ok(res.buffer.length >= 30, 'Buffer must be at least minimum ZIP header length');
      // ZIP magic bytes: PK\x03\x04
      assert.equal(res.buffer[0], 0x50, 'Byte 0 must be 0x50 (P)');
      assert.equal(res.buffer[1], 0x4b, 'Byte 1 must be 0x4B (K)');
      assert.equal(res.buffer[2], 0x03, 'Byte 2 must be 0x03');
      assert.equal(res.buffer[3], 0x04, 'Byte 3 must be 0x04');
    });

    test('TC-F6-05: Packaged dossier files follow standardized numbering format (01_[Title]_[Year].pdf)', async () => {
      const res = await memberClient.exportDossierZip(1);

      assert.equal(res.status, 200);
      const bufferText = res.buffer.toString('utf-8');
      // Check for standardized numbered pattern inside zip file header
      assert.ok(
        /01_.*\.pdf/.test(bufferText),
        'Zip container should contain standardized evidence filename starting with index 01_'
      );
    });
  });

  // =========================================================================
  // Feature 7: AI Gap to KPI Roadmap Bridge (source = 'AI_GAP')
  // =========================================================================
  describe('Feature 7: AI Gap to KPI Roadmap Bridge (source = \'AI_GAP\')', () => {
    test('TC-F7-01: Transferring missing criteria creates KPI goal with source "AI_GAP"', async () => {
      const missingCriteria = [
        { code: 'CRIT_Q1_PAPER', name: 'Công bố tối thiểu 02 bài báo quốc tế nhóm Q1/Q2', missingCount: 1, unit: 'Bài' },
      ];
      const res = await memberClient.createKpiFromAiGap(2, missingCriteria);

      assert.equal(res.status, 201, 'Should return HTTP 201 Created');
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data), 'Data must be array of created goals');
      assert.equal(res.data.data.length, 1);
      assert.equal(res.data.data[0].source, 'AI_GAP', 'Goal source must strictly be AI_GAP');
    });

    test('TC-F7-02: Created KPI goal records targetValue matching missing criteria count', async () => {
      const missingCriteria = [
        { code: 'CRIT_PATENT', name: 'Đăng ký sáng chế hoặc giải pháp hữu ích', missingCount: 2, unit: 'Sáng chế' },
      ];
      const res = await memberClient.createKpiFromAiGap(2, missingCriteria);

      assert.equal(res.status, 201);
      const goal = res.data.data[0];
      assert.equal(goal.targetValue, 2, 'targetValue must equal missingCount (2)');
      assert.equal(goal.unit, 'Sáng chế');
    });

    test('TC-F7-03: Created KPI goal defaults to status "IN_PROGRESS" and current year', async () => {
      const missingCriteria = [
        { code: 'CRIT_RESEARCH', name: 'Đề tài NCKH cấp Bộ', missingCount: 1, unit: 'Đề tài' },
      ];
      const res = await memberClient.createKpiFromAiGap(1, missingCriteria);

      assert.equal(res.status, 201);
      const goal = res.data.data[0];
      assert.equal(goal.status, 'IN_PROGRESS', 'Default goal status must be IN_PROGRESS');
      assert.equal(goal.year, new Date().getFullYear(), 'Goal year must be current year');
    });

    test('TC-F7-04: Created KPI goal includes sourceNote referencing regulation ID', async () => {
      const missingCriteria = [
        { code: 'CRIT_COMMUNITY', name: 'Hoạt động phục vụ cộng đồng', missingCount: 1, unit: 'Đợt' },
      ];
      const res = await memberClient.createKpiFromAiGap(5, missingCriteria);

      assert.equal(res.status, 201);
      const goal = res.data.data[0];
      assert.ok(goal.sourceNote, 'sourceNote must be provided');
      assert.ok(goal.sourceNote.includes('5') || goal.sourceNote.includes('quy chế'));
    });

    test('TC-F7-05: Batch transfer of multiple missing criteria creates multiple KPI goals', async () => {
      const multipleMissing = [
        { code: 'CRIT_A', name: 'Tiêu chuẩn A', missingCount: 1, unit: 'Bài' },
        { code: 'CRIT_B', name: 'Tiêu chuẩn B', missingCount: 2, unit: 'Giờ' },
        { code: 'CRIT_C', name: 'Tiêu chuẩn C', missingCount: 1, unit: 'Giải' },
      ];
      const res = await memberClient.createKpiFromAiGap(2, multipleMissing);

      assert.equal(res.status, 201);
      assert.equal(res.data.data.length, 3, 'Must create exactly 3 KPI goals');
      assert.ok(res.data.data.every((g) => g.source === 'AI_GAP'));
      assert.ok(res.data.data.every((g) => g.kpiGoalId > 0));
    });
  });

  // =========================================================================
  // Feature 8: Calendar Reminder Integration (deadline popup into personal calendar)
  // =========================================================================
  describe('Feature 8: Calendar Reminder Integration', () => {
    test('TC-F8-01: Schedules submission deadline reminder returning HTTP 201 Created', async () => {
      const payload = {
        title: 'Hạn chót nộp hồ sơ xét tặng Chiến sĩ thi đua cấp cơ sở',
        deadlineDate: '2025-12-15T17:00:00Z',
        regulationId: 1,
        notes: 'Xuất gói minh chứng ZIP trước ngày nộp 3 ngày.',
      };
      const res = await memberClient.createCalendarReminder(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.ok(res.data.data.reminderId > 0, 'Reminder must receive numerical reminderId');
    });

    test('TC-F8-02: Created reminder records correct title and regulationId association', async () => {
      const payload = {
        title: 'Hạn nộp hồ sơ Giảng viên Xuất sắc Toàn diện 2025',
        deadlineDate: '2025-11-30T17:00:00Z',
        regulationId: 2,
      };
      const res = await memberClient.createCalendarReminder(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.data.title, payload.title);
      assert.equal(res.data.data.regulationId, 2);
    });

    test('TC-F8-03: Created reminder sets status to SCHEDULED with matching deadlineDate', async () => {
      const payload = {
        title: 'Hạn nộp hồ sơ Đăng ký Đề tài NCKH Trọng điểm',
        deadlineDate: '2025-10-31T23:59:59Z',
        regulationId: 3,
      };
      const res = await memberClient.createCalendarReminder(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.data.status, 'SCHEDULED');
      assert.equal(res.data.data.deadlineDate, payload.deadlineDate);
    });

    test('TC-F8-04: Reminder preserves optional user notes for submission instructions', async () => {
      const notes = 'Đính kèm bảng điểm danh giảng dạy và chứng chỉ Scopus';
      const payload = {
        title: 'Hạn chót bổ sung minh chứng',
        deadlineDate: '2025-12-01T12:00:00Z',
        notes,
      };
      const res = await memberClient.createCalendarReminder(payload);

      assert.equal(res.status, 201);
      assert.equal(res.data.data.notes, notes);
    });

    test('TC-F8-05: Scheduling multiple reminders produces unique IDs for each event', async () => {
      const res1 = await memberClient.createCalendarReminder({
        title: 'Sự kiện 1',
        deadlineDate: '2025-11-01T08:00:00Z',
      });
      const res2 = await memberClient.createCalendarReminder({
        title: 'Sự kiện 2',
        deadlineDate: '2025-11-02T08:00:00Z',
      });

      assert.equal(res1.status, 201);
      assert.equal(res2.status, 201);
      assert.notEqual(res1.data.data.reminderId, res2.data.data.reminderId, 'Reminder IDs must be distinct');
    });
  });

  // =========================================================================
  // Feature 9: Public CV with Custom Slug (/cv/:slug & visibility toggle)
  // =========================================================================
  describe('Feature 9: Public CV with Custom Slug (/cv/:slug & visibility toggle)', () => {
    test('TC-F9-01: Updating CV profile with custom slug returns 200 OK and version count', async () => {
      const payload = {
        slug: 'nguyen-van-an',
        templateId: 'Modern',
        isPublic: true,
        headline: 'Phó Giáo sư, Tiến sĩ Khoa học Máy tính - ĐH Lạc Hồng',
        bio: 'Chuyên gia nghiên cứu Trí tuệ Nhân tạo và Thị giác máy tính.',
        version: 1,
      };
      const res = await memberClient.updateCv(payload);

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.slug, 'nguyen-van-an');
      assert.equal(res.data.data.isPublic, true);
      assert.equal(res.data.data.version, 2, 'Version should increment');
    });

    test('TC-F9-02: Public CV endpoint allows unauthenticated access when isPublic is true', async () => {
      // Unauthenticated access via getPublicCv
      const res = await memberClient.getPublicCv('nguyen-van-an');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.isPublic, true);
      assert.equal(res.data.data.slug, 'nguyen-van-an');
      assert.ok(res.data.data.headline);
    });

    test('TC-F9-03: Public CV payload includes user active achievements list and contact details', async () => {
      const res = await memberClient.getPublicCv('nguyen-van-an');

      assert.equal(res.status, 200);
      const data = res.data.data;
      assert.ok(Array.isArray(data.achievements), 'Public CV must include achievements array');
      assert.ok(data.achievements.length > 0, 'Should include active achievements');
      assert.ok(data.contact, 'Contact section must exist');
    });

    test('TC-F9-04: Accessing private CV (isPublic = false) displays privacy notice and hides profile details', async () => {
      // User 2 (tran-thi-bich) has isPublic = false in fixtures
      const res = await memberClient.getPublicCv('tran-thi-bich');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.isPublic, false);
      assert.ok(res.data.data.message.includes('riêng tư'), 'Should display privacy notice');
      assert.equal(res.data.data.achievements, undefined, 'Achievements must not be leaked when private');
    });

    test('TC-F9-05: Accessing non-existent slug returns HTTP 404 Not Found', async () => {
      const res = await memberClient.getPublicCv('non-existent-lecturer-slug-9999');

      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
      assert.ok(res.data.message.includes('không tồn tại') || res.data.message.includes('404'));
    });

    test('TC-F9-06: Toggling CV from private to public makes profile immediately accessible', async () => {
      // Update tran-thi-bich to public
      await memberClient.updateCv({
        slug: 'tran-thi-bich',
        templateId: 'Academic',
        isPublic: true,
        headline: 'TS. Trần Thị Bích - Trưởng Bộ môn',
      });

      const res = await memberClient.getPublicCv('tran-thi-bich');
      assert.equal(res.status, 200);
      assert.equal(res.data.data.isPublic, true);
    });
  });

  // =========================================================================
  // Feature 10: CV Web & Word (.docx) Template Export (3 web templates + DOCX binary)
  // =========================================================================
  describe('Feature 10: CV Web & Word (.docx) Template Export', () => {
    test('TC-F10-01: Configuring CV with "Modern" web template persists successfully', async () => {
      const res = await memberClient.updateCv({
        slug: 'nguyen-van-an',
        templateId: 'Modern',
        isPublic: true,
      });

      assert.equal(res.status, 200);
      const cvRes = await memberClient.getPublicCv('nguyen-van-an');
      assert.equal(cvRes.data.data.templateId, 'Modern');
    });

    test('TC-F10-02: Configuring CV with "Academic" web template persists successfully', async () => {
      const res = await memberClient.updateCv({
        slug: 'nguyen-van-an',
        templateId: 'Academic',
        isPublic: true,
      });

      assert.equal(res.status, 200);
      const cvRes = await memberClient.getPublicCv('nguyen-van-an');
      assert.equal(cvRes.data.data.templateId, 'Academic');
    });

    test('TC-F10-03: Configuring CV with "Minimalist" web template persists successfully', async () => {
      const res = await memberClient.updateCv({
        slug: 'nguyen-van-an',
        templateId: 'Minimalist',
        isPublic: true,
      });

      assert.equal(res.status, 200);
      const cvRes = await memberClient.getPublicCv('nguyen-van-an');
      assert.equal(cvRes.data.data.templateId, 'Minimalist');
    });

    test('TC-F10-04: Exporting CV as DOCX returns HTTP 200 with Word OpenXML MIME type', async () => {
      const res = await memberClient.exportCvDocx();

      assert.equal(res.status, 200);
      const contentType = res.headers.get('content-type');
      assert.ok(contentType, 'Content-Type must exist');
      assert.ok(
        contentType.includes('wordprocessingml') || contentType.includes('application/vnd.openxmlformats'),
        'MIME type must be Word OpenXML document'
      );
      const disposition = res.headers.get('content-disposition');
      assert.ok(disposition.includes('.docx'), 'Filename must end with .docx');
    });

    test('TC-F10-05: DOCX export buffer contains valid PK zip magic bytes confirming Word container', async () => {
      const res = await memberClient.exportCvDocx();

      assert.equal(res.status, 200);
      assert.ok(Buffer.isBuffer(res.buffer), 'Response buffer must exist');
      assert.ok(res.buffer.length >= 30);
      // DOCX files are zip containers (PK\x03\x04)
      assert.equal(res.buffer[0], 0x50);
      assert.equal(res.buffer[1], 0x4b);
      assert.equal(res.buffer[2], 0x03);
      assert.equal(res.buffer[3], 0x04);
      assert.ok(
        res.buffer.toString('utf-8').includes('word/document.xml'),
        'DOCX container must include word/document.xml entry'
      );
    });
  });

  // =========================================================================
  // Feature 11: 3-Level Organization Hierarchy (Trường -> Khoa -> Bộ môn)
  // =========================================================================
  describe('Feature 11: 3-Level Organization Hierarchy (Trường -> Khoa -> Bộ môn)', () => {
    test('TC-F11-01: Organization root represents Level 1 University (Trường LHU)', async () => {
      const res = await adminClient.getOrganizationTree();

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      const root = res.data.data;
      assert.equal(root.code, 'LHU');
      assert.equal(root.type, 'UNIVERSITY');
      assert.ok(root.unitId > 0);
      assert.ok(Array.isArray(root.children));
    });

    test('TC-F11-02: Level 2 children represent Faculties (Khoa) with parentId pointing to University', async () => {
      const res = await adminClient.getOrganizationTree();

      assert.equal(res.status, 200);
      const root = res.data.data;
      const fitFaculty = root.children.find((c) => c.code === 'FIT');

      assert.ok(fitFaculty, 'Faculty FIT must exist');
      assert.equal(fitFaculty.type, 'FACULTY');
      assert.equal(fitFaculty.parentId, root.unitId, 'Faculty parentId must point to University unitId');
      assert.ok(Array.isArray(fitFaculty.children));
    });

    test('TC-F11-03: Level 3 children represent Departments (Bộ môn) under their respective Faculty', async () => {
      const res = await adminClient.getOrganizationTree();

      assert.equal(res.status, 200);
      const root = res.data.data;
      const fitFaculty = root.children.find((c) => c.code === 'FIT');
      const deptSe = fitFaculty.children.find((c) => c.code === 'FIT_SE');

      assert.ok(deptSe, 'Department FIT_SE must exist');
      assert.equal(deptSe.type, 'DEPARTMENT');
      assert.equal(deptSe.parentId, fitFaculty.unitId, 'Department parentId must point to Faculty unitId');
    });

    test('TC-F11-04: Department nodes include assigned faculty members roster', async () => {
      const res = await adminClient.getOrganizationTree();

      assert.equal(res.status, 200);
      const root = res.data.data;
      const fitFaculty = root.children.find((c) => c.code === 'FIT');
      const deptSe = fitFaculty.children.find((c) => c.code === 'FIT_SE');

      assert.ok(Array.isArray(deptSe.members), 'Department must contain members array');
      assert.ok(deptSe.members.length >= 2, 'FIT_SE should have at least 2 assigned members');
      assert.ok(deptSe.members.some((m) => m.username === USERS.member.username));
    });

    test('TC-F11-05: Tree hierarchy validates complete 3-level parent-child referential integrity', async () => {
      const res = await adminClient.getOrganizationTree();

      assert.equal(res.status, 200);
      const root = res.data.data;
      for (const faculty of root.children) {
        assert.equal(faculty.parentId, root.unitId);
        for (const dept of faculty.children || []) {
          assert.equal(dept.parentId, faculty.unitId);
        }
      }
    });
  });

  // =========================================================================
  // Feature 12: 4 Standard Roles Authorization Matrix
  // =========================================================================
  describe('Feature 12: 4 Standard Roles Authorization Matrix', () => {
    test('TC-F12-01: MEMBER role has personal vault access but is rejected (403) from unit AI scan', async () => {
      // 1. Can list own achievements
      const vaultRes = await memberClient.listAchievements();
      assert.equal(vaultRes.status, 200);

      // 2. Denied from unit scan
      const scanRes = await memberClient.scanUnitWithAi(2, 1);
      assert.equal(scanRes.status, 403, 'MEMBER must receive 403 Forbidden on unit scan');
      assert.equal(scanRes.data.success, false);
      assert.ok(scanRes.data.message.includes('thẩm quyền'));
    });

    test('TC-F12-02: DEPARTMENT_HEAD role is authorized to perform AI scan on department unit', async () => {
      const res = await deptHeadClient.scanUnitWithAi(2, 1);

      assert.equal(res.status, 200, 'DEPARTMENT_HEAD must be authorized (200 OK)');
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.unitId, 2);
    });

    test('TC-F12-03: FACULTY_LEAD role is authorized to perform AI scan across faculty units', async () => {
      const res = await facultyLeadClient.scanUnitWithAi(1, 1);

      assert.equal(res.status, 200, 'FACULTY_LEAD must be authorized (200 OK)');
      assert.equal(res.data.success, true);
    });

    test('TC-F12-04: ADMIN role has global access to organization tree and administrative scans', async () => {
      const treeRes = await adminClient.getOrganizationTree();
      assert.equal(treeRes.status, 200);
      assert.equal(treeRes.data.success, true);

      const scanRes = await adminClient.scanUnitWithAi(100, 1);
      assert.equal(scanRes.status, 200);
      assert.equal(scanRes.data.success, true);
    });

    test('TC-F12-05: Unauthenticated request without Bearer token is rejected with HTTP 401', async () => {
      const unauthClient = createTestClient({ token: null, testMode });
      const res = await unauthClient.request('GET', '/api/v1/achievements');

      assert.equal(res.status, 401, 'Must return HTTP 401 Unauthorized');
      assert.equal(res.data.success, false);
      assert.ok(res.data.message.includes('Xác thực') || res.data.message.includes('Token'));
    });
  });

  // =========================================================================
  // Feature 13: Unit AI Scan & Reports
  // =========================================================================
  describe('Feature 13: Unit AI Scan & Reports', () => {
    test('TC-F13-01: Department Head executes unit AI scan returning HTTP 200 with unitId and regulationId', async () => {
      const res = await deptHeadClient.scanUnitWithAi(2, 1);

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.unitId, 2);
      assert.equal(res.data.data.regulationId, 1);
    });

    test('TC-F13-02: Unit AI scan returns member roster evaluation with fullName and percentage', async () => {
      const res = await deptHeadClient.scanUnitWithAi(2, 1);

      assert.equal(res.status, 200);
      const results = res.data.data.results;
      assert.ok(Array.isArray(results), 'Results must be array of member evaluations');
      assert.ok(results.length >= 2, 'Must include evaluations for unit members');
      assert.ok(results.every((r) => r.fullName && typeof r.percentage === 'number'));
    });

    test('TC-F13-03: Qualifying member in unit report shows isEligible = true and 100% completion', async () => {
      const res = await deptHeadClient.scanUnitWithAi(2, 1);

      assert.equal(res.status, 200);
      const qualifying = res.data.data.results.find((r) => r.percentage === 100);

      assert.ok(qualifying, 'Must find qualifying member with 100%');
      assert.equal(qualifying.isEligible, true);
      assert.equal(qualifying.missingCount, 0);
      assert.ok(qualifying.matchedCount > 0);
    });

    test('TC-F13-04: Non-qualifying member in unit report details isEligible = false and missing criteria count', async () => {
      const res = await deptHeadClient.scanUnitWithAi(2, 1);

      assert.equal(res.status, 200);
      const nonQualifying = res.data.data.results.find((r) => r.percentage < 100);

      assert.ok(nonQualifying, 'Must find non-qualifying member');
      assert.equal(nonQualifying.isEligible, false);
      assert.ok(nonQualifying.missingCount > 0, 'missingCount must be greater than zero');
    });

    test('TC-F13-05: Faculty Lead scans entire faculty unit and receives aggregated member evaluations', async () => {
      const res = await facultyLeadClient.scanUnitWithAi(1, 1);

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.unitId, 1);
      assert.ok(Array.isArray(res.data.data.results));
    });
  });
});
