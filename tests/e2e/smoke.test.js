/**
 * tests/e2e/smoke.test.js
 * Verification smoke test suite for the E2E Test Infrastructure and TestClient harness.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, generateMockToken } from './helpers/testClient.js';
import { ROLES, USERS, ACHIEVEMENTS, REGULATIONS, CV_FIXTURES, OCR_FIXTURES } from './helpers/fixtures.js';

describe('E2E Harness Smoke Verification', () => {
  let memberClient;
  let deptHeadClient;
  let adminClient;

  before(() => {
    memberClient = createClient({ role: ROLES.MEMBER, testMode: 'mock' });
    deptHeadClient = createClient({ role: ROLES.DEPARTMENT_HEAD, testMode: 'mock' });
    adminClient = createClient({ role: ROLES.ADMIN, testMode: 'mock' });
  });

  describe('Auth & Multi-Role Tokens', () => {
    test('generateMockToken generates valid JWTs for all 4 standard roles', () => {
      const roles = [ROLES.MEMBER, ROLES.DEPARTMENT_HEAD, ROLES.FACULTY_LEAD, ROLES.ADMIN];
      for (const role of roles) {
        const token = generateMockToken(role);
        assert.ok(token, `Token for role ${role} must exist`);
        const parts = token.split('.');
        assert.equal(parts.length, 3, 'JWT must have header, payload, and signature');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        assert.ok(payload.roles.includes(role), `Payload must include role ${role}`);
      }
    });

    test('Unauthenticated requests to secured endpoints return 401', async () => {
      const unauthClient = createClient({ token: null, testMode: 'mock' });
      const res = await unauthClient.request('GET', '/api/v1/achievements');
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
    });
  });

  describe('Feature 1: Personal Achievement Vault (immediate ACTIVE status)', () => {
    test('Creating an achievement sets status to ACTIVE immediately', async () => {
      const payload = {
        title: 'Bằng khen Sáng kiến Cải tiến Kỹ thuật 2025',
        recognitionYear: 2025,
        type: 'INNOVATION',
        issuer: 'Đại học Lạc Hồng',
      };
      const res = await memberClient.createAchievement(payload);
      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.status, 'ACTIVE');
      assert.equal(res.data.data.statusLabel, 'Sẵn sàng sử dụng');
      assert.ok(res.data.data.achievementId > 0);
    });

    test('Listing achievements returns user-scoped active achievements', async () => {
      const res = await memberClient.listAchievements();
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(res.data.data.length > 0);
      assert.ok(res.data.data.every((a) => a.status === 'ACTIVE'));
    });
  });

  describe('Feature 2 & 3: AI Vision Auto-fill & Graceful Fallback', () => {
    test('AI Vision extracts metadata from valid certificate', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.validCertificateImage.filename,
        contentBase64: OCR_FIXTURES.validCertificateImage.contentBase64,
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.fallback, false);
      assert.ok(res.data.data.title);
      assert.equal(res.data.data.recognitionYear, 2025);
    });

    test('AI Vision provides graceful fallback when image is unreadable', async () => {
      const res = await memberClient.extractCertificateAi({
        filename: OCR_FIXTURES.unreadableBlurredImage.filename,
        contentBase64: OCR_FIXTURES.unreadableBlurredImage.contentBase64,
        simulateFallback: true,
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.fallback, true);
      assert.equal(res.data.data, null);
      assert.ok(res.data.message.includes('tự nhập thông tin'));
    });
  });

  describe('Feature 4: AI Regulation Gap Analysis', () => {
    test('Structured evaluation returns passed criteria and missing criteria', async () => {
      const res = await memberClient.evaluateStructured(2); // Regulation 2 (GV Xuất Sắc)
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(typeof res.data.data.isSatisfied === 'boolean');
      assert.ok(typeof res.data.data.percentage === 'number');
      assert.ok(Array.isArray(res.data.data.criterionResults));
      const missingCriterion = res.data.data.criterionResults.find((c) => !c.isSatisfied);
      assert.ok(missingCriterion, 'Should have at least 1 missing criterion for regulation 2');
      assert.ok(missingCriterion.missingCount > 0);
    });
  });

  describe('Feature 5: AI Auto-Discovery (Khám Ngược)', () => {
    test('Auto-discovery scans open regulations and ranks by % match', async () => {
      const res = await memberClient.autoDiscover();
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(res.data.data.length >= 2);
      // Top regulation has highest percentage
      assert.ok(res.data.data[0].percentage >= res.data.data[1].percentage);
      assert.ok(res.data.data[0].satisfiedCount <= res.data.data[0].totalCount);
    });
  });

  describe('Feature 6: Dossier Packaging (.ZIP)', () => {
    test('Exporting dossier zip returns binary zip stream with correct headers', async () => {
      const res = await memberClient.exportDossierZip(1);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/zip');
      assert.ok(res.headers.get('content-disposition').includes('.zip'));
      assert.ok(Buffer.isBuffer(res.buffer));
      // Assert ZIP file magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
      assert.equal(res.buffer[0], 0x50);
      assert.equal(res.buffer[1], 0x4b);
      assert.equal(res.buffer[2], 0x03);
      assert.equal(res.buffer[3], 0x04);
    });
  });

  describe('Feature 7: AI Gap to KPI Roadmap Bridge', () => {
    test('Transferring AI gaps creates KPI goals with source AI_GAP', async () => {
      const missingCriteria = [
        { code: 'CRIT_Q1_PAPER', name: 'Công bố 01 bài báo Q1', missingCount: 1, unit: 'Bài' },
      ];
      const res = await memberClient.createKpiFromAiGap(2, missingCriteria);
      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.equal(res.data.data[0].source, 'AI_GAP');
      assert.equal(res.data.data[0].targetValue, 1);
      assert.equal(res.data.data[0].status, 'IN_PROGRESS');
    });
  });

  describe('Feature 8: Calendar Reminder Integration', () => {
    test('Schedules deadline reminder event in personal calendar', async () => {
      const reminderPayload = {
        title: 'Hạn nộp hồ sơ Chiến sĩ thi đua 2025',
        deadlineDate: '2025-12-15T17:00:00Z',
        regulationId: 1,
        notes: 'Kiểm tra kỹ minh chứng trước ngày nộp',
      };
      const res = await memberClient.createCalendarReminder(reminderPayload);
      assert.equal(res.status, 201);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.title, reminderPayload.title);
      assert.equal(res.data.data.status, 'SCHEDULED');
    });
  });

  describe('Feature 9 & 10: Public CV & DOCX Export', () => {
    test('Public CV endpoint allows unauthenticated access for public profiles', async () => {
      const res = await memberClient.getPublicCv('nguyen-van-an');
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.isPublic, true);
      assert.equal(res.data.data.slug, 'nguyen-van-an');
      assert.ok(Array.isArray(res.data.data.achievements));
    });

    test('Public CV endpoint shows privacy message when is_public is false', async () => {
      const res = await memberClient.getPublicCv('tran-thi-bich');
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.isPublic, false);
      assert.ok(res.data.data.message.includes('chế độ riêng tư'));
    });

    test('Exporting CV as DOCX returns valid Word document binary stream', async () => {
      const res = await memberClient.exportCvDocx();
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type').includes('wordprocessingml'));
      assert.ok(Buffer.isBuffer(res.buffer));
      // DOCX is a zip container (PK\x03\x04)
      assert.equal(res.buffer[0], 0x50);
      assert.equal(res.buffer[1], 0x4b);
      assert.equal(res.buffer[2], 0x03);
      assert.equal(res.buffer[3], 0x04);
    });
  });

  describe('Feature 11 & 12: 3-Level Organization Tree & Roles', () => {
    test('Organization tree returns Trường -> Khoa -> Bộ môn hierarchy', async () => {
      const res = await adminClient.getOrganizationTree();
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      const root = res.data.data;
      assert.equal(root.code, 'LHU');
      assert.equal(root.type, 'UNIVERSITY');
      assert.ok(Array.isArray(root.children));
      const faculty = root.children.find((c) => c.code === 'FIT');
      assert.ok(faculty, 'Faculty FIT must exist');
      assert.equal(faculty.type, 'FACULTY');
      const dept = faculty.children.find((c) => c.code === 'FIT_SE');
      assert.ok(dept, 'Department FIT_SE must exist');
      assert.equal(dept.type, 'DEPARTMENT');
    });
  });

  describe('Feature 13: Unit AI Scan & Role Authorization', () => {
    test('MEMBER is rejected with 403 Forbidden when calling unit AI scan', async () => {
      const res = await memberClient.scanUnitWithAi(2, 1);
      assert.equal(res.status, 403);
      assert.equal(res.data.success, false);
    });

    test('DEPARTMENT_HEAD is authorized to scan department unit members', async () => {
      const res = await deptHeadClient.scanUnitWithAi(2, 1);
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.unitId, 2);
      assert.ok(Array.isArray(res.data.data.results));
      assert.ok(res.data.data.results.length >= 2);
      assert.ok(res.data.data.results[0].fullName);
      assert.ok(typeof res.data.data.results[0].percentage === 'number');
    });
  });
});
