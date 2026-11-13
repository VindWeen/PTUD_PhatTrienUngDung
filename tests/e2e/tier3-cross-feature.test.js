/**
 * tests/e2e/tier3-cross-feature.test.js
 * E2E Test Suite - Milestone E2E-M4: Tier 3 Cross-Feature Pairwise Tests
 *
 * Validates 15 2-factor combinatorial feature interactions between interconnected domains:
 *  - Pair 1:  AI Vision OCR -> Achievement Vault creation (ACTIVE status)
 *  - Pair 2:  AI Vision Fallback -> Manual Vault Entry -> ACTIVE status & label
 *  - Pair 3:  Achievement Vault -> AI Structured Gap Evaluation
 *  - Pair 4:  Achievement Vault -> AI Auto-Discovery Ranking (%)
 *  - Pair 5:  Auto-Discovery 100% Match -> Dossier Packaging .ZIP export
 *  - Pair 6:  AI Gap Evaluation (unmet criteria) -> KPI Roadmap Goal Bridge (source = 'AI_GAP')
 *  - Pair 7:  KPI Goal from Gap -> Personal Calendar Deadline Reminder
 *  - Pair 8:  Achievement Vault -> Personal CV Profile inclusion
 *  - Pair 9:  Custom Slug -> Public CV View (/cv/:slug)
 *  - Pair 10: Custom Slug -> Unauthenticated Privacy Screen (is_public = 0)
 *  - Pair 11: Personal CV -> Word (.docx) Custom Template Export
 *  - Pair 12: 3-Level Organization Hierarchy -> Department Head Unit AI Scan
 *  - Pair 13: Faculty Lead -> Multi-Department Faculty Unit AI Scan
 *  - Pair 14: Member Vault -> Department Head Scan Visibility
 *  - Pair 15: Role Permission Guard: MEMBER attempting Unit Scan vs DEPARTMENT_HEAD attempting Faculty Scan
 *
 * Native Node.js test runner with zero third-party testing dependencies.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient as createTestClient } from './helpers/testClient.js';
import { ROLES, USERS, ACHIEVEMENTS, REGULATIONS, CV_FIXTURES, OCR_FIXTURES } from './helpers/fixtures.js';

describe('Tier 3: Cross-Feature Pairwise Integration Tests (15 Pairs)', () => {
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
  // Pair 1: AI Vision OCR -> Achievement Vault creation (ACTIVE status)
  // =========================================================================
  test('TC-T3-01 (Pair 1): AI Vision OCR extraction feeds directly into Achievement Vault creating ACTIVE status without approval', async () => {
    // Step 1: Upload certificate image to Vision OCR
    const ocrPayload = OCR_FIXTURES.validCertificateImage;
    const ocrRes = await memberClient.extractCertificateAi(ocrPayload);

    assert.equal(ocrRes.status, 200, 'OCR extraction should succeed with 200');
    assert.equal(ocrRes.data.success, true);
    assert.equal(ocrRes.data.fallback, false, 'Should extract cleanly without fallback');
    assert.ok(ocrRes.data.data.title, 'Extracted title must not be empty');

    const extracted = ocrRes.data.data;

    // Step 2: Use extracted metadata to create Achievement in Vault
    const vaultPayload = {
      title: extracted.title,
      recognitionYear: extracted.recognitionYear || 2025,
      type: 'CERTIFICATE',
      category: 'SCIENTIFIC_RESEARCH',
      issuer: extracted.issuer || 'UBND Tỉnh',
      decisionNumber: extracted.decisionNumber || '123/QD',
      evidenceFileUrl: 'https://storage.lhu.edu.vn/evidences/bang_khen_2025.png',
    };

    const vaultRes = await memberClient.createAchievement(vaultPayload);

    assert.equal(vaultRes.status, 201, 'Vault creation should return 201 Created');
    assert.equal(vaultRes.data.success, true);
    assert.equal(vaultRes.data.data.status, 'ACTIVE', 'Created record must immediately be ACTIVE');
    assert.equal(vaultRes.data.data.statusLabel, 'Sẵn sàng sử dụng', 'Status label must indicate ready to use');
    assert.equal(vaultRes.data.data.title, extracted.title);
    assert.ok(vaultRes.data.data.achievementId > 0, 'Must have numerical achievementId');
  });

  // =========================================================================
  // Pair 2: AI Vision Fallback -> Manual Vault Entry -> ACTIVE status & label
  // =========================================================================
  test('TC-T3-02 (Pair 2): AI Vision unreadable image triggers gentle fallback and preserves seamless manual entry into Vault', async () => {
    // Step 1: Upload blurred/unreadable image triggering fallback
    const blurredPayload = OCR_FIXTURES.unreadableBlurredImage;
    const fallbackRes = await memberClient.extractCertificateAi(blurredPayload);

    assert.equal(fallbackRes.status, 200, 'Fallback response should return 200 OK');
    assert.equal(fallbackRes.data.fallback, true, 'Fallback flag must be true');
    assert.equal(fallbackRes.data.data, null, 'Extracted data is null upon fallback');
    assert.match(fallbackRes.data.message, /tự nhập thông tin bằng tay/i, 'Message guides user to enter manually');

    // Step 2: User manually fills form and creates record in Vault
    const manualPayload = {
      title: 'Bằng khen Sáng kiến Cải tiến Kỹ thuật Cấp Bộ 2025 (Nhập thủ công)',
      recognitionYear: 2025,
      type: 'INNOVATION',
      category: 'INNOVATION',
      issuer: 'Bộ Khoa học và Công nghệ',
      decisionNumber: '998/QD-BKHCN',
      description: 'Nhập thủ công sau khi AI Vision không thể đọc ảnh mờ',
    };

    const manualRes = await memberClient.createAchievement(manualPayload);

    assert.equal(manualRes.status, 201, 'Manual entry should create achievement with 201');
    assert.equal(manualRes.data.success, true);
    assert.equal(manualRes.data.data.status, 'ACTIVE', 'Manual achievement must also be ACTIVE immediately');
    assert.equal(manualRes.data.data.statusLabel, 'Sẵn sàng sử dụng');
    assert.equal(manualRes.data.data.title, manualPayload.title);
  });

  // =========================================================================
  // Pair 3: Achievement Vault -> AI Structured Gap Evaluation
  // =========================================================================
  test('TC-T3-03 (Pair 3): Active achievements in Vault are evaluated by AI structured evaluator to determine full regulation satisfaction', async () => {
    // Step 1: Verify achievements exist in member's vault
    const vaultList = await memberClient.listAchievements();
    assert.equal(vaultList.status, 200);
    assert.ok(vaultList.data.data.length >= 3, 'Vault should contain pre-seeded achievements');

    // Step 2: Run structured evaluation against Regulation 1 (Chiến sĩ thi đua)
    const evalRes = await memberClient.evaluateStructured(REGULATIONS.chienthithidua.id);

    assert.equal(evalRes.status, 200, 'Evaluation should return 200 OK');
    assert.equal(evalRes.data.success, true);
    assert.equal(evalRes.data.data.regulationId, REGULATIONS.chienthithidua.id);
    assert.equal(evalRes.data.data.isSatisfied, true, 'Should be 100% satisfied with active vault records');
    assert.equal(evalRes.data.data.percentage, 100);
    assert.ok(Array.isArray(evalRes.data.data.criterionResults));
    assert.ok(evalRes.data.data.criterionResults.every((c) => c.isSatisfied === true));
  });

  // =========================================================================
  // Pair 4: Achievement Vault -> AI Auto-Discovery Ranking (%)
  // =========================================================================
  test('TC-T3-04 (Pair 4): Vault achievements drive AI Auto-Discovery to rank open regulations by descending match percentage', async () => {
    const discoveryRes = await memberClient.autoDiscover();

    assert.equal(discoveryRes.status, 200, 'Auto-discovery should return 200 OK');
    assert.equal(discoveryRes.data.success, true);
    assert.ok(Array.isArray(discoveryRes.data.data), 'Returns an array of ranked regulations');
    assert.ok(discoveryRes.data.data.length >= 2, 'Should rank at least 2 regulations');

    const ranked = discoveryRes.data.data;
    // Verify descending sort order by percentage
    for (let i = 0; i < ranked.length - 1; i++) {
      assert.ok(
        ranked[i].percentage >= ranked[i + 1].percentage,
        `Regulation at rank ${i} (${ranked[i].percentage}%) must be >= rank ${i + 1} (${ranked[i + 1].percentage}%)`
      );
    }

    // Top ranked should be 100% matched
    assert.equal(ranked[0].percentage, 100, 'Top recommendation should be 100% complete');
    assert.equal(ranked[0].regulationId, REGULATIONS.chienthithidua.id);
  });

  // =========================================================================
  // Pair 5: Auto-Discovery 100% Match -> Dossier Packaging .ZIP export
  // =========================================================================
  test('TC-T3-05 (Pair 5): 100% match discovery result enables instant Dossier ZIP export with binary archive stream', async () => {
    // Step 1: Run Auto-Discovery and locate 100% match regulation
    const discoveryRes = await memberClient.autoDiscover();
    const topMatch = discoveryRes.data.data.find((r) => r.percentage === 100);
    assert.ok(topMatch, 'Must find at least one 100% match regulation');

    // Step 2: Request dossier ZIP packaging for the matched regulation
    const zipRes = await memberClient.exportDossierZip(topMatch.regulationId);

    assert.equal(zipRes.status, 200, 'Dossier packaging should return 200 OK');
    assert.ok(zipRes.headers.get('content-type').includes('application/zip'), 'Content-Type must be application/zip');
    const disposition = zipRes.headers.get('content-disposition');
    assert.ok(disposition.includes('attachment'), 'Content-Disposition must be attachment');
    assert.ok(disposition.includes('.zip'), 'Filename must have .zip extension');

    // Step 3: Validate binary ZIP header magic bytes (PK\x03\x04)
    assert.ok(zipRes.buffer, 'Response must provide binary buffer');
    assert.equal(zipRes.buffer.subarray(0, 2).toString('ascii'), 'PK', 'ZIP archive must start with PK signature');
    assert.equal(zipRes.buffer.readUInt16LE(0), 0x4b50, 'Magic bytes must be 0x04034b50 / PK');
  });

  // =========================================================================
  // Pair 6: AI Gap Evaluation (unmet criteria) -> KPI Roadmap Goal Bridge
  // =========================================================================
  test('TC-T3-06 (Pair 6): Unmet criteria identified by AI Gap Evaluation bridge into KPI Roadmap goals with source AI_GAP', async () => {
    // Step 1: Evaluate against Regulation 2 (Giảng viên Xuất sắc - 67% match, 1 missing criterion)
    const evalRes = await memberClient.evaluateStructured(REGULATIONS.giangvienxuatsac.id);

    assert.equal(evalRes.status, 200);
    assert.equal(evalRes.data.data.isSatisfied, false, 'Regulation 2 should have unmet criteria');
    const unmet = evalRes.data.data.criterionResults.filter((c) => !c.isSatisfied);
    assert.ok(unmet.length > 0, 'Must identify at least one unmet criterion');

    // Step 2: Bridge missing criteria to KPI Roadmap
    const missingPayload = unmet.map((c) => ({
      code: c.code,
      name: c.name,
      missingCount: c.missingCount || 1,
      unit: 'Bài báo',
    }));

    const kpiRes = await memberClient.createKpiFromAiGap(REGULATIONS.giangvienxuatsac.id, missingPayload);

    assert.equal(kpiRes.status, 201, 'KPI goal creation should return 201 Created');
    assert.equal(kpiRes.data.success, true);
    assert.ok(Array.isArray(kpiRes.data.data));
    assert.equal(kpiRes.data.data.length, missingPayload.length);

    // Step 3: Assert created KPI goals hold source = 'AI_GAP' and IN_PROGRESS status
    const createdGoal = kpiRes.data.data[0];
    assert.equal(createdGoal.source, 'AI_GAP', 'Goal source must strictly be AI_GAP');
    assert.equal(createdGoal.status, 'IN_PROGRESS', 'Goal status must be IN_PROGRESS');
    assert.ok(createdGoal.kpiGoalId > 0, 'Goal must have valid kpiGoalId');
    assert.ok(createdGoal.title.includes('Bổ sung'), 'Goal title denotes gap remediation');
  });

  // =========================================================================
  // Pair 7: KPI Goal from Gap -> Personal Calendar Deadline Reminder
  // =========================================================================
  test('TC-T3-07 (Pair 7): AI gap transfer integrates with Personal Calendar to schedule actionable deadline reminder event', async () => {
    const reminderPayload = {
      title: 'Hạn nộp hồ sơ xét tặng Giải thưởng Giảng viên Xuất sắc 2025',
      deadlineDate: '2025-11-30T17:00:00Z',
      regulationId: REGULATIONS.giangvienxuatsac.id,
      notes: 'Tạo tự động từ đề xuất nhắc nhở sau khi chuyển tiêu chí thiếu vào KPI',
    };

    const reminderRes = await memberClient.createCalendarReminder(reminderPayload);

    assert.equal(reminderRes.status, 201, 'Reminder creation should return 201 Created');
    assert.equal(reminderRes.data.success, true);
    assert.equal(reminderRes.data.data.status, 'SCHEDULED');
    assert.equal(reminderRes.data.data.regulationId, reminderPayload.regulationId);
    assert.equal(reminderRes.data.data.deadlineDate, reminderPayload.deadlineDate);
    assert.ok(reminderRes.data.data.reminderId > 0);
  });

  // =========================================================================
  // Pair 8: Achievement Vault -> Personal CV Profile inclusion
  // =========================================================================
  test('TC-T3-08 (Pair 8): Achievements stored in Vault are linked and reflected in personal CV profile configuration', async () => {
    // Step 1: Member updates CV profile and selects achievements 1, 2, 3
    const updatePayload = {
      slug: 'nguyen-van-an',
      headline: 'Phó Giáo sư, Tiến sĩ - Chuyên gia AI & Học máy',
      bio: 'Hơn 15 năm giảng dạy và công bố quốc tế chuẩn Scopus/ISI',
      templateId: 'Modern',
      isPublic: true,
      selectedAchievementIds: [1, 2, 3],
    };

    const updateRes = await memberClient.updateCv(updatePayload);
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.success, true);

    // Step 2: Fetch public view of CV and verify vault achievements are included
    const cvView = await memberClient.getPublicCv('nguyen-van-an');
    assert.equal(cvView.status, 200);
    assert.equal(cvView.data.success, true);
    assert.equal(cvView.data.data.isPublic, true);
    assert.ok(Array.isArray(cvView.data.data.achievements));
    assert.ok(cvView.data.data.achievements.length >= 3, 'CV must display active vault achievements');

    const achievementTitles = cvView.data.data.achievements.map((a) => a.title);
    assert.ok(achievementTitles.some((t) => t.includes('Deep Learning') || t.includes('nghiên cứu')));
  });

  // =========================================================================
  // Pair 9: Custom Slug -> Public CV View (/cv/:slug)
  // =========================================================================
  test('TC-T3-09 (Pair 9): Custom slug configuration allows anonymous public visitors to view verified academic CV', async () => {
    const customSlug = 'nguyen-van-an';

    // Access via unauthenticated public client
    const guestRes = await memberClient.getPublicCv(customSlug, { includeAuth: false });

    assert.equal(guestRes.status, 200, 'Public guest can read public CV with 200 OK');
    assert.equal(guestRes.data.success, true);
    assert.equal(guestRes.data.data.isPublic, true);
    assert.equal(guestRes.data.data.slug, customSlug);
    assert.ok(guestRes.data.data.headline, 'Must return headline');
    assert.ok(guestRes.data.data.bio, 'Must return biography');
    assert.equal(guestRes.data.data.templateId, 'Modern');
  });

  // =========================================================================
  // Pair 10: Custom Slug -> Unauthenticated Privacy Screen (is_public = 0)
  // =========================================================================
  test('TC-T3-10 (Pair 10): Setting is_public = 0 on custom slug presents privacy screen to guests without exposing achievements', async () => {
    // Step 1: Update CV to private mode
    const privateSlug = 'nguyen-van-an';
    await memberClient.updateCv({
      slug: privateSlug,
      isPublic: false,
      headline: 'Hồ sơ đang tạm khóa công khai',
    });

    // Step 2: Guest accesses the custom slug URL
    const guestRes = await memberClient.getPublicCv(privateSlug, { includeAuth: false });

    assert.equal(guestRes.status, 200, 'Returns 200 OK with privacy screen');
    assert.equal(guestRes.data.success, true);
    assert.equal(guestRes.data.data.isPublic, false, 'isPublic flag must be false');
    assert.match(guestRes.data.data.message, /riêng tư/i, 'Must present private status notice');
    assert.equal(guestRes.data.data.achievements, undefined, 'Must not expose sensitive achievements');

    // Restore public flag for subsequent tests
    await memberClient.updateCv({
      slug: privateSlug,
      isPublic: true,
      headline: 'Phó Giáo sư, Tiến sĩ - ĐH Lạc Hồng',
    });
  });

  // =========================================================================
  // Pair 11: Personal CV -> Word (.docx) Custom Template Export
  // =========================================================================
  test('TC-T3-11 (Pair 11): Personal CV configuration exports formatted Word .docx document stream matching Office OpenXML standards', async () => {
    const docxRes = await memberClient.exportCvDocx();

    assert.equal(docxRes.status, 200, 'Word export must return 200 OK');
    const contentType = docxRes.headers.get('content-type');
    assert.ok(
      contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      'Must return Word DOCX OpenXML MIME type'
    );
    const disposition = docxRes.headers.get('content-disposition');
    assert.ok(disposition.includes('attachment'), 'Must be attachment disposition');
    assert.ok(disposition.includes('.docx'), 'Filename must contain .docx extension');

    // Assert binary PK zip header
    assert.ok(docxRes.buffer, 'Must provide binary stream buffer');
    assert.equal(docxRes.buffer.readUInt16LE(0), 0x4b50, 'DOCX must be valid PK zip archive');
  });

  // =========================================================================
  // Pair 12: 3-Level Organization Hierarchy -> Department Head Unit AI Scan
  // =========================================================================
  test('TC-T3-12 (Pair 12): Department Head uses 3-level tree to identify department unit and executes Unit AI Scan for department members', async () => {
    // Step 1: Department Head queries organization tree
    const treeRes = await deptHeadClient.getOrganizationTree();
    assert.equal(treeRes.status, 200);
    assert.equal(treeRes.data.data.type, 'UNIVERSITY');

    // Find Department unit FIT_SE (unitId = 2) under Faculty FIT (unitId = 1)
    const faculty = treeRes.data.data.children.find((f) => f.unitId === 1);
    assert.ok(faculty, 'Must locate Faculty of IT');
    const department = faculty.children.find((d) => d.unitId === 2);
    assert.ok(department, 'Must locate Department of Software Engineering (unitId: 2)');

    // Step 2: Department Head initiates Unit AI Scan on unitId: 2
    const scanRes = await deptHeadClient.scanUnitWithAi(department.unitId, REGULATIONS.chienthithidua.id);

    assert.equal(scanRes.status, 200, 'Unit scan should return 200 OK');
    assert.equal(scanRes.data.success, true);
    assert.equal(scanRes.data.data.unitId, department.unitId);
    assert.ok(Array.isArray(scanRes.data.data.results), 'Scan results must be an array of evaluated members');
    assert.ok(scanRes.data.data.results.length >= 2, 'Department scan must evaluate all unit members');

    const memberResult = scanRes.data.data.results.find((m) => m.userId === USERS.member.userId);
    assert.ok(memberResult, 'Member An.NV must be included in department scan');
    assert.equal(memberResult.percentage, 100);
    assert.equal(memberResult.isEligible, true);
  });

  // =========================================================================
  // Pair 13: Faculty Lead -> Multi-Department Faculty Unit AI Scan
  // =========================================================================
  test('TC-T3-13 (Pair 13): Faculty Lead initiates Faculty-wide AI Scan across multiple subordinate departments without authorization barriers', async () => {
    const facultyUnitId = 1; // Faculty of IT (Khoa CNTT)

    const scanRes = await facultyLeadClient.scanUnitWithAi(facultyUnitId, REGULATIONS.chienthithidua.id);

    assert.equal(scanRes.status, 200, 'Faculty Lead has authority to scan entire faculty (unitId: 1)');
    assert.equal(scanRes.data.success, true);
    assert.equal(scanRes.data.data.unitId, facultyUnitId);
    assert.ok(Array.isArray(scanRes.data.data.results));
    assert.ok(scanRes.data.data.results.length > 0, 'Faculty scan results contain department members');
  });

  // =========================================================================
  // Pair 14: Member Vault -> Department Head Scan Visibility
  // =========================================================================
  test('TC-T3-14 (Pair 14): Member newly added active achievement in Vault immediately propagates to Department Head Unit Scan', async () => {
    // Step 1: Member creates a new active achievement in vault
    const newAchievement = {
      title: 'Bằng khen Đột phá Công nghệ Giáo dục Đại học 2025',
      recognitionYear: 2025,
      type: 'INNOVATION',
      category: 'INNOVATION',
      issuer: 'Hiệu trưởng Đại học Lạc Hồng',
    };
    const createRes = await memberClient.createAchievement(newAchievement);
    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.data.status, 'ACTIVE');

    // Step 2: Department Head executes Unit AI Scan immediately without admin intervention
    const scanRes = await deptHeadClient.scanUnitWithAi(2, REGULATIONS.chienthithidua.id);

    assert.equal(scanRes.status, 200);
    const memberScan = scanRes.data.data.results.find((r) => r.userId === USERS.member.userId);
    assert.ok(memberScan, 'Member must be evaluated in department scan');
    assert.equal(memberScan.isEligible, true, 'Member remains eligible with active vault items');
    assert.equal(memberScan.percentage, 100);
  });

  // =========================================================================
  // Pair 15: Role Permission Guard: MEMBER vs DEPARTMENT_HEAD scope restrictions
  // =========================================================================
  test('TC-T3-15 (Pair 15): Role permission guards enforce strict boundary between MEMBER, DEPARTMENT_HEAD, and FACULTY_LEAD scopes', async () => {
    // 1. MEMBER attempting Unit AI Scan -> 403 Forbidden
    const memberScanRes = await memberClient.scanUnitWithAi(2, REGULATIONS.chienthithidua.id);
    assert.equal(memberScanRes.status, 403, 'MEMBER cannot initiate unit AI scan');
    assert.equal(memberScanRes.data.success, false);
    assert.match(memberScanRes.data.message, /không có thẩm quyền/i);

    // 2. DEPARTMENT_HEAD attempting to scan Faculty unit 1 (outside their own department unit 2) -> 403 Forbidden
    const deptHeadFacultyScanRes = await deptHeadClient.scanUnitWithAi(1, REGULATIONS.chienthithidua.id);
    assert.equal(deptHeadFacultyScanRes.status, 403, 'DEPARTMENT_HEAD cannot scan faculty-level unit 1');
    assert.match(deptHeadFacultyScanRes.data.message, /bộ môn của mình/i);

    // 3. DEPARTMENT_HEAD scanning their own department unit 2 -> 200 OK
    const deptHeadOwnScanRes = await deptHeadClient.scanUnitWithAi(2, REGULATIONS.chienthithidua.id);
    assert.equal(deptHeadOwnScanRes.status, 200, 'DEPARTMENT_HEAD is permitted to scan their own unit 2');
    assert.equal(deptHeadOwnScanRes.data.success, true);

    // 4. FACULTY_LEAD scanning Faculty unit 1 -> 200 OK
    const facultyScanRes = await facultyLeadClient.scanUnitWithAi(1, REGULATIONS.chienthithidua.id);
    assert.equal(facultyScanRes.status, 200, 'FACULTY_LEAD has full access to faculty unit 1');
    assert.equal(facultyScanRes.data.success, true);
  });
});
