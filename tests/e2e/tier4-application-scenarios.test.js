/**
 * tests/e2e/tier4-application-scenarios.test.js
 * E2E Test Suite - Milestone E2E-M4: Tier 4 Real-World Application Scenarios
 *
 * Implements all 7 end-to-end multi-step application scenarios defined in TEST_INFRA.md Section 4:
 *  - SC-01: New Lecturer Vault Onboarding & AI OCR Auto-Fill
 *  - SC-02: 100% Match Auto-Discovery & Instant Dossier ZIP Packaging
 *  - SC-03: Regulation Gap Analysis & AI Gap to KPI Action Plan Bridge
 *  - SC-04: Deadline Reminder Integration to Personal Calendar
 *  - SC-05: Public Career CV Custom Slug & DOCX Export Flow
 *  - SC-06: Department & Faculty Lead Unit-wide AI Audit Scan
 *  - SC-07: End-to-End Annual Award Campaign Lifecycle
 *
 * Native Node.js test runner with zero third-party testing dependencies.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient as createTestClient } from './helpers/testClient.js';
import { ROLES, USERS, ACHIEVEMENTS, REGULATIONS, CV_FIXTURES, OCR_FIXTURES, ORG_TREE } from './helpers/fixtures.js';

describe('Tier 4: Real-World Application Scenarios (7 Scenarios)', () => {
  const testMode = process.env.TEST_MODE || 'auto';

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
  // SC-01: New Lecturer Vault Onboarding & AI OCR Auto-Fill
  // =========================================================================
  test('SC-01: New Lecturer Vault Onboarding & AI OCR Auto-Fill — uploads cert, reviews extraction, creates ACTIVE vault record', async () => {
    // Step 1: Lecturer uploads a certificate PDF/image to AI Vision OCR
    const ocrUpload = OCR_FIXTURES.validCertificatePdf;
    const ocrRes = await memberClient.extractCertificateAi(ocrUpload);

    assert.equal(ocrRes.status, 200, 'AI Vision extraction should succeed with HTTP 200');
    assert.equal(ocrRes.data.success, true);
    assert.equal(ocrRes.data.fallback, false);
    assert.ok(ocrRes.data.data.title, 'Extracted title must exist');
    assert.ok(ocrRes.data.data.recognitionYear, 'Extracted year must exist');

    // Step 2: Lecturer reviews extracted data and refines title with notes
    const extractedData = ocrRes.data.data;
    const refinedTitle = `${extractedData.title} (Đã xác minh minh chứng số)`;

    // Step 3: Lecturer creates the achievement in personal vault
    const createRes = await memberClient.createAchievement({
      title: refinedTitle,
      recognitionYear: extractedData.recognitionYear,
      type: 'JOURNAL_PAPER',
      category: 'SCIENTIFIC_RESEARCH',
      issuer: extractedData.issuer || 'Elsevier Scopus Board',
      decisionNumber: extractedData.decisionNumber || 'SCOPUS-2024-VN-908',
      evidenceFileUrl: 'https://storage.lhu.edu.vn/evidences/scopus_cert_2024.pdf',
      description: 'Chứng nhận bài báo quốc tế nhóm Q2 công bố năm 2024',
    });

    assert.equal(createRes.status, 201, 'Should return HTTP 201 Created');
    assert.equal(createRes.data.success, true);
    assert.equal(createRes.data.data.status, 'ACTIVE', 'Achievement must immediately have ACTIVE status');
    assert.equal(createRes.data.data.statusLabel, 'Sẵn sàng sử dụng', 'Must have user-facing ready label');
    assert.equal(createRes.data.data.title, refinedTitle);
    assert.ok(createRes.data.data.achievementId > 0);

    const newId = createRes.data.data.achievementId;

    // Step 4: Verify the newly created achievement is immediately listed in user vault
    const listRes = await memberClient.listAchievements();
    assert.equal(listRes.status, 200);
    const found = listRes.data.data.find((a) => a.achievementId === newId || a.id === newId);
    assert.ok(found, 'Newly onboarded achievement must appear in member vault listing');
    assert.equal(found.status, 'ACTIVE');

    // Step 5: Verify direct retrieval by ID
    const getRes = await memberClient.getAchievement(newId);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.data.achievementId, newId);
    assert.equal(getRes.data.data.title, refinedTitle);
  });

  // =========================================================================
  // SC-02: 100% Match Auto-Discovery & Instant Dossier ZIP Packaging
  // =========================================================================
  test('SC-02: 100% Match Auto-Discovery & Instant Dossier ZIP Packaging — discovers eligible awards, validates criteria, downloads ZIP dossier', async () => {
    // Step 1: Lecturer triggers AI Auto-Discovery across all open regulations
    const discoveryRes = await memberClient.autoDiscover();

    assert.equal(discoveryRes.status, 200, 'Auto-discovery must return 200 OK');
    assert.equal(discoveryRes.data.success, true);
    assert.ok(Array.isArray(discoveryRes.data.data));

    // Step 2: Lecturer identifies top eligible award with 100% match
    const eligibleAward = discoveryRes.data.data.find((r) => r.percentage === 100);
    assert.ok(eligibleAward, 'Must discover at least one 100% eligible regulation');
    assert.equal(eligibleAward.regulationId, REGULATIONS.chienthithidua.id);
    assert.equal(eligibleAward.name, REGULATIONS.chienthithidua.name);

    // Step 3: Lecturer reviews detailed structured gap analysis before export
    const gapRes = await memberClient.evaluateStructured(eligibleAward.regulationId);
    assert.equal(gapRes.status, 200);
    assert.equal(gapRes.data.data.isSatisfied, true, 'All criteria must be satisfied');
    assert.equal(gapRes.data.data.percentage, 100);
    assert.ok(gapRes.data.data.criterionResults.length >= 3);

    // Verify all criteria have zero missing count and matched evidence records
    for (const crit of gapRes.data.data.criterionResults) {
      assert.equal(crit.isSatisfied, true);
      assert.equal(crit.missingCount, 0);
      assert.ok(crit.matchedRecords && crit.matchedRecords.length > 0);
    }

    // Step 4: Lecturer exports standardized ZIP dossier package
    const zipRes = await memberClient.exportDossierZip(eligibleAward.regulationId);

    assert.equal(zipRes.status, 200, 'Export dossier ZIP must return 200 OK');
    assert.ok(zipRes.headers.get('content-type').includes('application/zip'));
    const disposition = zipRes.headers.get('content-disposition');
    assert.ok(disposition.includes('attachment'));
    assert.ok(disposition.includes('.zip'));

    // Step 5: Verify archive stream integrity and PK zip header signature
    assert.ok(zipRes.buffer, 'Must return binary buffer');
    assert.ok(zipRes.buffer.length > 30, 'ZIP stream size must exceed header metadata length');
    assert.equal(zipRes.buffer.readUInt32LE(0), 0x04034b50, 'Must match ZIP local header signature PK\\x03\\x04');
  });

  // =========================================================================
  // SC-03: Regulation Gap Analysis & AI Gap to KPI Action Plan Bridge
  // =========================================================================
  test('SC-03: Regulation Gap Analysis & AI Gap to KPI Action Plan Bridge — identifies missing criteria, bridges directly into KPI roadmap', async () => {
    // Step 1: Candidate evaluates eligibility for "Giải thưởng Giảng viên Xuất sắc Toàn diện 2025" (Regulation 2)
    const evalRes = await memberClient.evaluateStructured(REGULATIONS.giangvienxuatsac.id);

    assert.equal(evalRes.status, 200, 'Gap evaluation should return 200 OK');
    assert.equal(evalRes.data.success, true);
    assert.equal(evalRes.data.data.isSatisfied, false, 'Candidate has not yet fulfilled all criteria');
    assert.equal(evalRes.data.data.percentage, 67, 'Candidate currently satisfies 67% of criteria');

    // Step 2: System detects exactly which criteria are missing
    const missingCriteria = evalRes.data.data.criterionResults.filter((c) => !c.isSatisfied);
    assert.equal(missingCriteria.length, 1, 'Must have exactly 1 missing criterion');
    assert.equal(missingCriteria[0].missingCount, 1);

    // Step 3: Candidate accepts AI recommendation and bridges missing criteria into KPI roadmap
    const kpiPayload = missingCriteria.map((c) => ({
      code: c.code,
      name: c.name,
      missingCount: c.missingCount,
      unit: 'Bài báo ISI/Scopus',
    }));

    const kpiBridgeRes = await memberClient.createKpiFromAiGap(REGULATIONS.giangvienxuatsac.id, kpiPayload);

    assert.equal(kpiBridgeRes.status, 201, 'KPI bridge creation should return 201 Created');
    assert.equal(kpiBridgeRes.data.success, true);
    assert.ok(Array.isArray(kpiBridgeRes.data.data));
    assert.equal(kpiBridgeRes.data.data.length, 1);

    // Step 4: Verify generated KPI goal attributes
    const goal = kpiBridgeRes.data.data[0];
    assert.ok(goal.kpiGoalId > 0, 'Must assign numerical kpiGoalId');
    assert.equal(goal.source, 'AI_GAP', 'Source field must strictly be AI_GAP');
    assert.equal(goal.status, 'IN_PROGRESS', 'New goal must be IN_PROGRESS');
    assert.equal(goal.targetValue, 1, 'Target value matches missing count');
    assert.ok(goal.title.includes('Bổ sung'), 'Goal title indicates gap remediation');
    assert.ok(goal.sourceNote.includes(String(REGULATIONS.giangvienxuatsac.id)), 'Source note links regulation ID');
  });

  // =========================================================================
  // SC-04: Deadline Reminder Integration to Personal Calendar
  // =========================================================================
  test('SC-04: Deadline Reminder Integration to Personal Calendar — prompts deadline confirmation, schedules reminder, prevents duplicates', async () => {
    // Step 1: User completes gap analysis or award discovery; system presents deadline prompt
    const deadlinePayload = {
      title: 'Hạn chót nộp hồ sơ xét tặng Chiến sĩ thi đua cấp cơ sở năm 2025',
      deadlineDate: '2025-12-15T17:00:00Z',
      regulationId: REGULATIONS.chienthithidua.id,
      notes: 'Hệ thống tự động nhắc nhở trước ngày đóng sổ 3 ngày.',
    };

    // Step 2: Member accepts prompt and schedules reminder event
    const scheduleRes = await memberClient.createCalendarReminder(deadlinePayload);

    assert.equal(scheduleRes.status, 201, 'Calendar reminder should be created with 201');
    assert.equal(scheduleRes.data.success, true);
    assert.equal(scheduleRes.data.data.status, 'SCHEDULED');
    assert.equal(scheduleRes.data.data.title, deadlinePayload.title);
    assert.equal(scheduleRes.data.data.deadlineDate, deadlinePayload.deadlineDate);
    assert.equal(scheduleRes.data.data.regulationId, deadlinePayload.regulationId);
    assert.ok(scheduleRes.data.data.reminderId > 0);

    // Step 3: Attempting to schedule duplicate reminder for the same regulation & deadline returns 409 Conflict
    const duplicateRes = await memberClient.createCalendarReminder(deadlinePayload);

    assert.equal(duplicateRes.status, 409, 'Duplicate reminder must be rejected with 409 Conflict');
    assert.equal(duplicateRes.data.success, false);
    assert.match(duplicateRes.data.message, /Đã tồn tại nhắc nhở/i);
  });

  // =========================================================================
  // SC-05: Public Career CV Custom Slug & DOCX Export Flow
  // =========================================================================
  test('SC-05: Public Career CV Custom Slug & DOCX Export Flow — customizes slug, toggles privacy, verifies public view & exports DOCX', async () => {
    const slug = 'nguyen-van-an';

    // Step 1: Member sets custom slug, chooses Modern template, sets public mode
    const updateRes = await memberClient.updateCv({
      slug,
      templateId: 'Modern',
      isPublic: true,
      headline: 'Phó Giáo sư, Tiến sĩ - Viện Nghiên cứu Trí tuệ Nhân tạo LHU',
      bio: 'Chủ nhiệm nhiều đề tài cấp Bộ và công bố quốc tế chuẩn Scopus.',
      contact: {
        email: 'an.nv@lhu.edu.vn',
        phone: '0901234567',
      },
      selectedAchievementIds: [1, 2, 3],
    });

    assert.equal(updateRes.status, 200, 'CV profile update should return 200 OK');
    assert.equal(updateRes.data.success, true);
    assert.equal(updateRes.data.data.slug, slug);
    assert.equal(updateRes.data.data.isPublic, true);

    // Step 2: Public anonymous visitor views CV via custom slug
    const guestPublicRes = await memberClient.getPublicCv(slug, { includeAuth: false });

    assert.equal(guestPublicRes.status, 200);
    assert.equal(guestPublicRes.data.success, true);
    assert.equal(guestPublicRes.data.data.isPublic, true);
    assert.equal(guestPublicRes.data.data.slug, slug);
    assert.ok(guestPublicRes.data.data.headline.includes('Trí tuệ Nhân tạo'));
    assert.ok(Array.isArray(guestPublicRes.data.data.achievements));
    assert.ok(guestPublicRes.data.data.achievements.length >= 3);

    // Step 3: Member turns off public toggle (isPublic = false)
    const turnPrivateRes = await memberClient.updateCv({
      slug,
      isPublic: false,
      headline: 'Hồ sơ đang ở chế độ bảo trì riêng tư',
    });
    assert.equal(turnPrivateRes.status, 200);

    // Step 4: Public guest accesses URL again and encounters privacy screen
    const guestPrivateRes = await memberClient.getPublicCv(slug, { includeAuth: false });

    assert.equal(guestPrivateRes.status, 200);
    assert.equal(guestPrivateRes.data.data.isPublic, false, 'isPublic flag must be false');
    assert.match(guestPrivateRes.data.data.message, /riêng tư/i, 'Must present private status message');
    assert.equal(guestPrivateRes.data.data.achievements, undefined, 'Must hide achievement data');

    // Step 5: Member restores public visibility and exports formatted Word (.docx) bundle
    await memberClient.updateCv({ slug, isPublic: true });
    const docxRes = await memberClient.exportCvDocx();

    assert.equal(docxRes.status, 200, 'DOCX export should succeed with 200 OK');
    assert.ok(
      docxRes.headers.get('content-type').includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      'Must have OpenXML Word document MIME type'
    );
    assert.ok(docxRes.headers.get('content-disposition').includes('attachment'));
    assert.ok(docxRes.headers.get('content-disposition').includes('.docx'));

    // Step 6: Verify binary DOCX integrity (PK zip container signature)
    assert.ok(docxRes.buffer);
    assert.equal(docxRes.buffer.readUInt32LE(0), 0x04034b50, 'Must be valid PK zip container');
  });

  // =========================================================================
  // SC-06: Department & Faculty Lead Unit-wide AI Audit Scan
  // =========================================================================
  test('SC-06: Department & Faculty Lead Unit-wide AI Audit Scan — scans department unit, executes faculty audit, tests batch scaling', async () => {
    // Step 1: Department Head checks organization tree for department unit ID
    const treeRes = await deptHeadClient.getOrganizationTree();
    assert.equal(treeRes.status, 200);
    const fitFaculty = treeRes.data.data.children.find((c) => c.unitId === 1);
    const seDept = fitFaculty.children.find((d) => d.unitId === 2);
    assert.ok(seDept, 'Must find Department of Software Engineering (unitId: 2)');

    // Step 2: Department Head initiates Unit AI Scan for annual award (Regulation 1)
    const deptScanRes = await deptHeadClient.scanUnitWithAi(seDept.unitId, REGULATIONS.chienthithidua.id);

    assert.equal(deptScanRes.status, 200, 'Department scan should return 200 OK');
    assert.equal(deptScanRes.data.success, true);
    assert.equal(deptScanRes.data.data.unitId, seDept.unitId);
    assert.ok(Array.isArray(deptScanRes.data.data.results));

    // Verify presence of member and department head in results
    const eligibleLecturer = deptScanRes.data.data.results.find((m) => m.userId === USERS.member.userId);
    assert.ok(eligibleLecturer, 'Lecturer An.NV must be included');
    assert.equal(eligibleLecturer.isEligible, true);
    assert.equal(eligibleLecturer.percentage, 100);

    // Step 3: Faculty Lead executes faculty-level audit scan (unitId: 1)
    const facultyScanRes = await facultyLeadClient.scanUnitWithAi(1, REGULATIONS.chienthithidua.id);

    assert.equal(facultyScanRes.status, 200, 'Faculty Lead must be authorized to scan faculty unit');
    assert.equal(facultyScanRes.data.success, true);
    assert.equal(facultyScanRes.data.data.unitId, 1);
    assert.ok(facultyScanRes.data.data.results.length >= 2);

    // Step 4: Batch audit scaling simulation (50 department members)
    const batchScanRes = await deptHeadClient.scanUnitWithAi(2, REGULATIONS.chienthithidua.id, {
      body: { simulateBatchCount: 50 },
    });
    // In our testClient.js, options.body or request body:
    // Let's pass simulateBatchCount through request
    const batchClient = createTestClient({ role: ROLES.DEPARTMENT_HEAD, testMode });
    const batchRes = await batchClient.request('POST', '/api/v1/organizations/units/2/ai-scan', {
      regulationId: REGULATIONS.chienthithidua.id,
      simulateBatchCount: 50,
    });

    assert.equal(batchRes.status, 200, 'Batch scan should return 200 OK');
    assert.equal(batchRes.data.data.totalMembers, 50, 'Must aggregate 50 members');
    assert.equal(batchRes.data.data.eligibleCount, 25, 'Half the members (even indices) are eligible');

    // Step 5: Security audit check — unauthorized attempts are guarded
    // MEMBER role cannot perform unit scan
    const forbiddenMemberRes = await memberClient.scanUnitWithAi(2, REGULATIONS.chienthithidua.id);
    assert.equal(forbiddenMemberRes.status, 403, 'MEMBER role must be rejected with 403 Forbidden');

    // DEPARTMENT_HEAD cannot scan other department or faculty level
    const forbiddenDeptHeadRes = await deptHeadClient.scanUnitWithAi(1, REGULATIONS.chienthithidua.id);
    assert.equal(forbiddenDeptHeadRes.status, 403, 'DEPARTMENT_HEAD scanning faculty level must be rejected with 403');
  });

  // =========================================================================
  // SC-07: End-to-End Annual Award Campaign Lifecycle
  // =========================================================================
  test('SC-07: End-to-End Annual Award Campaign Lifecycle — full journey across Admin setup, Member vault, Auto-Discovery, Gap to KPI, Dossier ZIP & Unit Audit', async () => {
    // Stage A: Admin verifies 3-Level Organization Tree
    const treeRes = await adminClient.getOrganizationTree();
    assert.equal(treeRes.status, 200, 'Admin accesses organization tree');
    assert.equal(treeRes.data.data.type, 'UNIVERSITY');
    assert.equal(treeRes.data.data.name, 'Trường Đại học Lạc Hồng');
    assert.ok(treeRes.data.data.children.length >= 2, 'Has Khoa CNTT and Khoa Dược');

    // Stage B: Member creates new achievement via AI Vision extraction flow
    const ocrRes = await memberClient.extractCertificateAi(OCR_FIXTURES.validCertificateImage);
    assert.equal(ocrRes.status, 200);
    assert.equal(ocrRes.data.fallback, false);

    const certData = ocrRes.data.data;
    const vaultRes = await memberClient.createAchievement({
      title: certData.title,
      recognitionYear: certData.recognitionYear,
      type: 'CERTIFICATE',
      category: 'SCIENTIFIC_RESEARCH',
      issuer: certData.issuer,
      decisionNumber: certData.decisionNumber,
    });
    assert.equal(vaultRes.status, 201);
    assert.equal(vaultRes.data.data.status, 'ACTIVE', 'Achievement is immediately ACTIVE without admin approval');

    // Stage C: Member runs AI Auto-Discovery & evaluates open regulations
    const discoveryRes = await memberClient.autoDiscover();
    assert.equal(discoveryRes.status, 200);
    const topAward = discoveryRes.data.data[0];
    assert.equal(topAward.percentage, 100, 'Top award matches 100%');
    assert.equal(topAward.regulationId, REGULATIONS.chienthithidua.id);

    // Stage D: Member checks Regulation 2 ("Giảng viên Xuất sắc"), identifies missing gap, bridges to KPI Roadmap
    const gapRes = await memberClient.evaluateStructured(REGULATIONS.giangvienxuatsac.id);
    assert.equal(gapRes.status, 200);
    const missing = gapRes.data.data.criterionResults.filter((c) => !c.isSatisfied);
    assert.ok(missing.length > 0);

    const kpiRes = await memberClient.createKpiFromAiGap(REGULATIONS.giangvienxuatsac.id, [
      {
        code: missing[0].code,
        name: missing[0].name,
        missingCount: 1,
        unit: 'Bài báo ISI/Scopus',
      },
    ]);
    assert.equal(kpiRes.status, 201);
    assert.equal(kpiRes.data.data[0].source, 'AI_GAP');

    // Stage E: Member adds calendar deadline reminder for the campaign
    const reminderRes = await memberClient.createCalendarReminder({
      title: 'Hạn chót Chiến dịch Thi đua & Khen thưởng Năm học 2025',
      deadlineDate: '2025-12-15T23:59:59Z',
      regulationId: REGULATIONS.chienthithidua.id,
      notes: 'Hệ thống tự động nhắc nhở hoàn thiện hồ sơ minh chứng.',
    });
    assert.equal(reminderRes.status, 201);
    assert.equal(reminderRes.data.data.status, 'SCHEDULED');

    // Stage F: Member exports Dossier ZIP Package for the 100% eligible award
    const zipRes = await memberClient.exportDossierZip(REGULATIONS.chienthithidua.id);
    assert.equal(zipRes.status, 200);
    assert.ok(zipRes.headers.get('content-type').includes('application/zip'));
    assert.equal(zipRes.buffer.readUInt32LE(0), 0x04034b50, 'Valid ZIP PK header');

    // Stage G: Department Head conducts Unit AI Scan, detects Member eligibility and generates unit nomination report
    const scanRes = await deptHeadClient.scanUnitWithAi(2, REGULATIONS.chienthithidua.id);
    assert.equal(scanRes.status, 200);
    const candidate = scanRes.data.data.results.find((m) => m.userId === USERS.member.userId);
    assert.ok(candidate, 'Candidate must be present in unit scan');
    assert.equal(candidate.isEligible, true, 'Candidate is eligible for unit nomination');
    assert.equal(candidate.percentage, 100, 'Candidate has 100% criteria fulfillment');
  });
});
