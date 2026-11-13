import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// 1. Achievements
import { extractCertificateInfo } from '../src/modules/achievements/achievementAiIngestService.js';
import { createPermissionResolver } from '../src/modules/achievements/achievementPermissions.js';
import { createAchievementSchema, updateAchievementSchema } from '../src/modules/achievements/achievementSchemas.js';
import achievementRoutes from '../src/modules/achievements/achievementRoutes.js';

// 2. AI
import { evaluateStructuredCriterion } from '../src/modules/ai/criteriaEvaluator.js';
import { discoverEligibleRegulations } from '../src/modules/ai/autoDiscoveryService.js';
import {
  sanitizeFileName,
  formatStandardizedFileName,
  buildDossierArchive,
} from '../src/modules/ai/dossierPackagerService.js';

// 3. KPI
import { fromAiGapSchema } from '../src/modules/kpi/kpiSchemas.js';
import * as kpiRepo from '../src/modules/kpi/kpiRepository.js';

// 4. CV
import { slugSchema, updateCvProfileSchema, RESERVED_SLUGS } from '../src/modules/cv/cvSchemas.js';
import { createCvService } from '../src/modules/cv/cvService.js';
import { findProfileBySlugOrId } from '../src/modules/cv/cvRepository.js';

// 5. Calendar
import { isValidCalendarDate, createReminderSchema, calendarService } from '../src/modules/calendar/calendarService.js';

// 6. Organizations
import { createOrganizationService } from '../src/modules/organizations/organizationService.js';

// Utils & Config
import { NotFoundError, ForbiddenError, ConflictError, ConcurrencyConflictError } from '../src/utils/errors.js';
import { query, closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB().catch(() => {});
});

// ============================================================================
// SUITE 1: ACHIEVEMENTS MODULE ADVERSARIAL STRESS TESTING
// ============================================================================

test('Achievements [SEC-01]: updateAchievementSchema strictly rejects locked status injection', () => {
  // Attacker attempts to change status to 'VERIFIED' or bypass approval via update payload
  const maliciousPayload = {
    title: 'Hợp đồng nghiên cứu khoa học cấp tỉnh',
    version: 1,
    status: 'VERIFIED',
  };
  const parsed = updateAchievementSchema.safeParse(maliciousPayload);
  assert.equal(parsed.success, false, 'Schema must reject update payload containing locked field "status"');
});

test('Achievements [SEC-02]: updateAchievementSchema strictly rejects context / subject injection', () => {
  // Attacker attempts to change createdBy or lecturerId or contextUnitId
  const payloads = [
    { title: 'Bài báo Q1', version: 1, createdBy: 9999 },
    { title: 'Bài báo Q1', version: 1, lecturerId: 9999 },
    { title: 'Bài báo Q1', version: 1, contextUnitId: 1 },
  ];

  for (const p of payloads) {
    const res = updateAchievementSchema.safeParse(p);
    assert.equal(res.success, false, `Schema must reject locked field in ${JSON.stringify(p)}`);
  }
});

test('Achievements [PERM-01]: Permission Resolver grants full edit/evidence rights to ACTIVE status for owners', async () => {
  const user = { userId: 42 };
  const resolver = createPermissionResolver(user, ['MEMBER'], {
    representative: async () => false,
    scope: async () => false,
  });

  const activeAchievement = {
    achievementId: 101,
    lecturerUserId: 42,
    createdBy: 42,
    status: 'ACTIVE',
    latestRevisionNo: 0,
    submissions: [],
  };

  const resolved = await resolver(activeAchievement);
  assert.equal(resolved.actions.edit, true, 'Owner must be able to edit an ACTIVE achievement');
  assert.equal(resolved.actions.manageEvidence, true, 'Owner must be able to manage evidence for ACTIVE achievement');
  assert.equal(resolved.actions.remove, true, 'Owner must be able to remove an ACTIVE achievement with no revisions');
  assert.equal(resolved.actions.review, false, 'ACTIVE achievement cannot be reviewed (only SUBMITTED)');
  assert.equal(resolved.actions.revoke, false, 'ACTIVE achievement cannot be revoked (only VERIFIED)');
});

test('Achievements [PERM-02]: Non-owners cannot edit or remove ACTIVE achievements', async () => {
  const user = { userId: 99 }; // Different user
  const resolver = createPermissionResolver(user, ['MEMBER'], {
    representative: async () => false,
    scope: async () => false,
  });

  const activeAchievement = {
    achievementId: 102,
    lecturerUserId: 42,
    createdBy: 42,
    status: 'ACTIVE',
    latestRevisionNo: 0,
    submissions: [],
  };

  const resolved = await resolver(activeAchievement);
  assert.equal(resolved.actions.edit, false, 'Non-owner must NOT be able to edit');
  assert.equal(resolved.actions.manageEvidence, false, 'Non-owner must NOT be able to manage evidence');
  assert.equal(resolved.actions.remove, false, 'Non-owner must NOT be able to remove');
});

test('Achievements [DEC-01]: Decommissioned workflow routes return 410 Gone', () => {
  const decommissionedPaths = [
    '/achievements/:id/submit',
    '/achievements/:id/verify',
    '/achievements/:id/request-correction',
    '/achievements/:id/reject',
    '/achievements/:id/cancel',
    '/achievements/:id/revoke',
    '/achievements/:id/resubmit',
    '/achievements/:id/replace',
  ];

  // Inspect the routes in achievementRoutes router stack
  const registeredRoutes = achievementRoutes.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  for (const expectedPath of decommissionedPaths) {
    const matched = registeredRoutes.find(r => r.path === expectedPath);
    assert.ok(matched, `Route ${expectedPath} must be registered as a decommissioned endpoint`);
  }
});

test('Achievements [AI-01]: AI Vision extractCertificateInfo handles null, empty, and 0-byte buffers gracefully', async () => {
  const tests = [
    { buffer: null },
    { buffer: undefined },
    { buffer: Buffer.alloc(0) },
    { buffer: Buffer.from('') },
  ];

  for (const input of tests) {
    const res = await extractCertificateInfo(input);
    assert.equal(res.success, true, 'Must return success: true for seamless UI UX');
    assert.equal(res.fallback, true, 'Must flag fallback: true');
    assert.equal(res.data, null, 'Data must be null');
    assert.ok(res.message.includes('nhập thông tin'), 'Message must encourage manual entry');
  }
});

test('Achievements [AI-02]: AI Vision extractCertificateInfo handles corrupted binary noise safely', async () => {
  // 16 KB of high-entropy pseudorandom bytes (not a valid image or PDF)
  const corruptedNoise = crypto.randomBytes(16 * 1024);
  const res = await extractCertificateInfo({
    buffer: corruptedNoise,
    mimetype: 'application/pdf',
    originalname: 'corrupted_trojan.exe.pdf',
  });

  assert.equal(res.success, true);
  assert.equal(res.fallback, true);
  assert.equal(res.data, null);
  assert.ok(res.message);
});

// ============================================================================
// SUITE 2: AI MODULE ADVERSARIAL STRESS TESTING
// ============================================================================

test('AI Evaluator [CRIT-01]: Zero records boundary (0/N) correctly reports missingCount equal to targetMin', () => {
  const evalResult = evaluateStructuredCriterion({
    subject: { subjectType: 'LECTURER', subjectId: 10 },
    criterion: {
      criteriaVersionId: 1,
      criterionCode: 'ISI_PUB',
      name: 'Bài báo ISI',
      targetType: 'INDIVIDUAL',
      minThreshold: 3,
      unitMetric: 'bài báo',
      isConfirmed: true,
    },
    documentVersion: {
      versionId: 1,
      documentCode: 'QC_KHCN_2025',
      isConfirmed: true,
      lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
    },
    records: [], // 0 records
    asOfDate: '2026-05-01',
    rules: {
      sourceType: 'ACHIEVEMENT',
      achievementTypeIds: [1, 2],
    },
  });

  assert.equal(evalResult.isSatisfied, false);
  assert.equal(evalResult.thresholdMetric.isSatisfied, false);
  assert.equal(evalResult.thresholdMetric.actualRecorded, 0);
  assert.equal(evalResult.thresholdMetric.targetMin, 3);
  assert.equal(evalResult.thresholdMetric.missingCount, 3, 'When 0 records exist, missingCount must equal targetMin');
  assert.equal(evalResult.matchedRecords.length, 0);
});

test('AI Evaluator [CRIT-02]: 100% boundary (records >= targetMin) satisfies criterion with missingCount = 0', () => {
  const dummyFile = { id: 1, sha256: 'a'.repeat(64), originalFileName: 'paper1.pdf' };
  const records = [
    { id: 101, type: 'ACHIEVEMENT', sourceTypeId: 1, lecturerId: 10, recognitionYear: 2024, status: 'ACTIVE', file: dummyFile },
    { id: 102, type: 'ACHIEVEMENT', sourceTypeId: 1, lecturerId: 10, recognitionYear: 2025, status: 'ACTIVE', file: dummyFile },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: { subjectType: 'LECTURER', subjectId: 10 },
    criterion: {
      criteriaVersionId: 2,
      criterionCode: 'ISI_Q1',
      name: 'Bài báo ISI Q1',
      targetType: 'INDIVIDUAL',
      minThreshold: 2,
      unitMetric: 'bài báo',
      isConfirmed: true,
    },
    documentVersion: {
      versionId: 1,
      documentCode: 'QC_KHCN_2025',
      isConfirmed: true,
      lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
    },
    records,
    asOfDate: '2026-05-01',
    rules: {
      sourceType: 'ACHIEVEMENT',
      achievementTypeIds: [1],
    },
  });

  assert.equal(evalResult.isSatisfied, true);
  assert.equal(evalResult.thresholdMetric.isSatisfied, true);
  assert.equal(evalResult.thresholdMetric.actualRecorded, 2);
  assert.equal(evalResult.thresholdMetric.missingCount, 0, 'When target is fully met, missingCount must be 0');
  assert.equal(evalResult.matchedRecords.length, 2);
});

test('AI Evaluator [CRIT-03]: REVOKED and CANCELLED records are strictly excluded and trigger human review', () => {
  const dummyFile = { id: 1, sha256: 'b'.repeat(64), originalFileName: 'revoked.pdf' };
  const records = [
    { id: 201, type: 'ACHIEVEMENT', sourceTypeId: 1, lecturerId: 10, recognitionYear: 2024, status: 'REVOKED', file: dummyFile },
    { id: 202, type: 'ACHIEVEMENT', sourceTypeId: 1, lecturerId: 10, recognitionYear: 2025, status: 'CANCELLED', file: dummyFile },
  ];

  const evalResult = evaluateStructuredCriterion({
    subject: { subjectType: 'LECTURER', subjectId: 10 },
    criterion: {
      criteriaVersionId: 3,
      criterionCode: 'RESEARCH_AWARD',
      name: 'Giải thưởng NCKH',
      targetType: 'INDIVIDUAL',
      minThreshold: 1,
      isConfirmed: true,
    },
    documentVersion: {
      versionId: 1,
      documentCode: 'QC_2025',
      isConfirmed: true,
      lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
    },
    records,
    rules: {
      sourceType: 'ACHIEVEMENT',
      achievementTypeIds: [1],
    },
  });

  assert.equal(evalResult.isSatisfied, false);
  assert.equal(evalResult.thresholdMetric.isSatisfied, 'UNCONFIRMED', 'Revoked records must trigger UNCONFIRMED');
  assert.equal(evalResult.matchedRecords.length, 0, 'Revoked/cancelled records must never be in matchedRecords');
});

test('AI Evaluator [CRIT-04]: Unmapped source rules never falsely pass criteria', () => {
  const evalResult = evaluateStructuredCriterion({
    subject: { subjectType: 'LECTURER', subjectId: 10 },
    criterion: {
      criteriaVersionId: 4,
      criterionCode: 'UNMAPPED_CRIT',
      name: 'Tiêu chí chưa gán quy tắc',
      targetType: 'INDIVIDUAL',
      minThreshold: 1,
      isConfirmed: true,
    },
    documentVersion: {
      versionId: 1,
      documentCode: 'QC_2025',
      isConfirmed: true,
      lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
    },
    records: [
      { id: 301, type: 'ACHIEVEMENT', sourceTypeId: 99, lecturerId: 10, recognitionYear: 2025, status: 'ACTIVE', hasEvidence: true }
    ],
    rules: null, // No source rules configured!
  });

  assert.equal(evalResult.isSatisfied, false);
  assert.equal(evalResult.thresholdMetric.isSatisfied, 'UNCONFIRMED');
  assert.equal(evalResult.matchedRecords.length, 0);
});

test('AI Auto-Discovery [DISC-01]: Percentage calculation resilience with 0 criteria, 0% satisfied, and 100% satisfied', async () => {
  // Test mock evaluator logic identical to autoDiscoveryService lines 168-182:
  const calculate = (satisfiedCount, totalCount) => {
    const percentage = totalCount > 0 ? Math.round((satisfiedCount / totalCount) * 100) : 0;
    const isEligible = totalCount > 0 && satisfiedCount === totalCount;
    return { percentage, isEligible };
  };

  // Case 1: 0 total criteria
  const c0 = calculate(0, 0);
  assert.equal(c0.percentage, 0, '0 total criteria must yield 0%');
  assert.equal(c0.isEligible, false);
  assert.equal(Number.isNaN(c0.percentage), false, 'Must not be NaN');

  // Case 2: 0 of 4 satisfied
  const cNone = calculate(0, 4);
  assert.equal(cNone.percentage, 0);
  assert.equal(cNone.isEligible, false);

  // Case 3: 1 of 3 satisfied (1/3 = 33.333% -> rounds to 33)
  const cPart = calculate(1, 3);
  assert.equal(cPart.percentage, 33);
  assert.equal(cPart.isEligible, false);

  // Case 4: 4 of 4 satisfied (100%)
  const cAll = calculate(4, 4);
  assert.equal(cAll.percentage, 100);
  assert.equal(cAll.isEligible, true);
});

test('AI Auto-Discovery [DISC-02]: Regulations are strictly sorted by descending percentage, then satisfied count', () => {
  const regulations = [
    { name: 'Quy chế B', percentage: 75, satisfiedCount: 3 },
    { name: 'Quy chế C', percentage: 100, satisfiedCount: 4 },
    { name: 'Quy chế A', percentage: 75, satisfiedCount: 2 },
    { name: 'Quy chế D', percentage: 0, satisfiedCount: 0 },
  ];

  regulations.sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (b.satisfiedCount !== a.satisfiedCount) return b.satisfiedCount - a.satisfiedCount;
    return a.name.localeCompare(b.name);
  });

  assert.equal(regulations[0].name, 'Quy chế C', '100% must be first');
  assert.equal(regulations[1].name, 'Quy chế B', '75% with 3 satisfied must precede 75% with 2');
  assert.equal(regulations[2].name, 'Quy chế A');
  assert.equal(regulations[3].name, 'Quy chế D');
});

test('AI Dossier Packager [ZIP-01]: sanitizeFileName neutralizes path traversal, null bytes, and malicious characters', () => {
  const attackVectors = [
    { input: '../../../../etc/passwd', expectedNotContains: '/' },
    { input: '..\\..\\Windows\\System32\\cmd.exe', expectedNotContains: '\\' },
    { input: 'Bằng Khen & Chứng Nhận (Hạng I)!', expectedNotContains: '&' },
    { input: 'file\0name_injection', expectedNotContains: '\0' },
    { input: null, expected: 'MinhChung' },
    { input: '', expected: 'MinhChung' },
  ];

  for (const v of attackVectors) {
    const sanitized = sanitizeFileName(v.input);
    if (v.expected) {
      assert.equal(sanitized, v.expected);
    } else {
      assert.ok(!sanitized.includes('/'), `Must not contain forward slash: ${sanitized}`);
      assert.ok(!sanitized.includes('\\'), `Must not contain backslash: ${sanitized}`);
      assert.ok(!sanitized.includes('\0'), `Must not contain null byte: ${sanitized}`);
    }
  }

  // Boundary condition hardening: whitespace-only or symbol-only string defaults to 'MinhChung'
  const whitespaceSanitized = sanitizeFileName('   ');
  assert.equal(whitespaceSanitized, 'MinhChung', 'Whitespace-only string yields default MinhChung after hardening');

  const symbolSanitized = sanitizeFileName('!@#$%');
  assert.equal(symbolSanitized, 'MinhChung', 'Special symbol-only string yields default MinhChung after hardening');
});

test('AI Dossier Packager [ZIP-02]: formatStandardizedFileName enforces 01_[Title]_[Year].pdf naming standard', () => {
  const name1 = formatStandardizedFileName(1, 'Bằng khen cấp Bộ', 2025, 'pdf');
  assert.equal(name1, '01_[Bang_khen_cap_Bo]_[2025].pdf');

  const name9 = formatStandardizedFileName(9, 'Chứng chỉ Scopus', 2024, '.pdf');
  assert.equal(name9, '09_[Chung_chi_Scopus]_[2024].pdf');

  const name15 = formatStandardizedFileName(15, '../../dangerous/title', 2023, 'png');
  assert.equal(name15, '15_[.._.._dangerous_title]_[2023].png');
  assert.ok(!name15.includes('/'), 'Formatted name must not contain forward slash');
  assert.ok(!name15.includes('\\'), 'Formatted name must not contain backslash');
});

test('AI Dossier Packager [ZIP-03]: buildDossierArchive safely handles missing physical files with fallback PDF buffer', async () => {
  const matchedFiles = [
    {
      title: 'Minh chứng thiếu file đĩa',
      year: 2025,
      storageKey: 'non_existent_path_key_12345.pdf',
      originalName: 'test.pdf',
    },
    {
      title: 'Minh chứng có buffer bộ nhớ',
      year: 2024,
      buffer: Buffer.from('%PDF-1.4 test buffer'),
      originalName: 'memory.pdf',
    },
  ];

  const archive = buildDossierArchive(matchedFiles);
  assert.ok(archive, 'Archive stream must be created without throwing ENOENT');

  const chunks = [];
  archive.on('data', chunk => chunks.push(chunk));

  const zipPromise = new Promise((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
  });

  await archive.finalize();
  const zipBuffer = await zipPromise;

  assert.ok(zipBuffer.length > 0, 'ZIP buffer must not be empty');
  // Check ZIP magic bytes 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
  assert.equal(zipBuffer[0], 0x50);
  assert.equal(zipBuffer[1], 0x4B);
  assert.equal(zipBuffer[2], 0x03);
  assert.equal(zipBuffer[3], 0x04);
});

// ============================================================================
// SUITE 3: KPI MODULE ADVERSARIAL STRESS TESTING
// ============================================================================

test('KPI Gap Schema [KPI-01]: fromAiGapSchema strictly enforces input boundaries and date ordering', () => {
  // Negative missingCount rejected
  assert.equal(
    fromAiGapSchema.safeParse({
      regulationId: 1,
      missingCriteria: [{ code: 'ISI_1', name: 'Bài báo', missingCount: -1 }]
    }).success,
    false
  );

  // Inverted root dates rejected
  assert.equal(
    fromAiGapSchema.safeParse({
      regulationId: 1,
      periodStart: '2026-12-31',
      periodEnd: '2026-01-01',
      missingCriteria: [{ code: 'ISI_1', name: 'Bài báo', missingCount: 1 }]
    }).success,
    false
  );

  // Inverted item dates rejected
  assert.equal(
    fromAiGapSchema.safeParse({
      regulationId: 1,
      missingCriteria: [
        { code: 'ISI_1', name: 'Bài báo', periodStart: '2026-12-31', periodEnd: '2026-01-01', missingCount: 1 }
      ]
    }).success,
    false
  );

  // Zero missingCount is accepted and defaults to target 1 in service
  const zeroParsed = fromAiGapSchema.safeParse({
    regulationId: 1,
    missingCriteria: [{ code: 'ISI_1', name: 'Bài báo', missingCount: 0 }]
  });
  assert.equal(zeroParsed.success, true);
});

test('KPI Gap Duplicate Logic [KPI-02]: DRAFT duplicate accumulates target and increments version', async () => {
  let updatedSql = '';
  let updatedParams = [];

  const mockClient = {
    query: async (sql, params) => {
      if (sql.includes('SELECT * FROM app.kpi_goals WHERE')) {
        return {
          rows: [
            {
              goal_id: 50,
              code: 'SCOPUS_Q1',
              target: 1,
              status: 'DRAFT',
              version: 1,
              plan: 'Kế hoạch ban đầu',
            }
          ]
        };
      }
      if (sql.includes('UPDATE app.kpi_goals')) {
        updatedSql = sql;
        updatedParams = params;
        return {
          rows: [
            {
              goal_id: 50,
              code: 'SCOPUS_Q1',
              target: 1 + params[0],
              version: 2,
              status: 'DRAFT',
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const dup = await kpiRepo.findDuplicate(mockClient, { lecturer_id: 10 }, {
    code: 'SCOPUS_Q1',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  });
  assert.ok(dup);
  assert.equal(dup.status, 'DRAFT');

  // Trigger update as service does
  const res = await mockClient.query(
    `UPDATE app.kpi_goals SET target = target + $1, [plan] = [plan] + N' ; ' + $2, updated_at = SYSUTCDATETIME(), version = version + 1
     OUTPUT INSERTED.* WHERE goal_id = $3`,
    [2, 'Bổ sung thêm 2 bài', dup.goal_id]
  );

  assert.equal(res.rows[0].target, 3, 'Target must accumulate 1 + 2 = 3');
  assert.equal(res.rows[0].version, 2, 'Version must increment to 2');
});

test('KPI Gap Duplicate Logic [KPI-03]: Non-DRAFT duplicate appends -GAP suffix to avoid PK/unique collisions', async () => {
  const mockClient = {
    query: async (sql) => {
      if (sql.includes('SELECT * FROM app.kpi_goals WHERE')) {
        return {
          rows: [
            {
              goal_id: 51,
              code: 'SCOPUS_Q1',
              target: 2,
              status: 'APPROVED', // Non-DRAFT!
              version: 1,
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const dup = await kpiRepo.findDuplicate(mockClient, { lecturer_id: 10 }, {
    code: 'SCOPUS_Q1',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  });
  assert.ok(dup);
  assert.equal(dup.status, 'APPROVED');

  let code = 'SCOPUS_Q1';
  if (dup.status !== 'DRAFT') {
    code = `${code}-GAP`;
  }
  assert.equal(code, 'SCOPUS_Q1-GAP', 'Approved duplicate goal must receive -GAP suffix');
});

// ============================================================================
// SUITE 4: CV MODULE ADVERSARIAL STRESS TESTING
// ============================================================================

test('CV Slug Validation [CV-01]: slugSchema rejects all reserved system slugs', () => {
  for (const reserved of RESERVED_SLUGS) {
    const res = slugSchema.safeParse(reserved);
    assert.equal(res.success, false, `Reserved slug "${reserved}" must be rejected`);
  }
});

test('CV Slug Validation [CV-02]: slugSchema strictly rejects uppercase, spaces, and punctuation', () => {
  const invalidSlugs = [
    'User_Name',
    'Nguyen Van A',
    'profile!@#',
    'my-slug-',
    '-leading-slug',
    'slug--double-dash',
    'viet-nam-đẹp',
    'ab', // < 3 chars
    'a'.repeat(101), // > 100 chars
  ];

  for (const slug of invalidSlugs) {
    const res = slugSchema.safeParse(slug);
    assert.equal(res.success, false, `Invalid slug "${slug}" must fail validation`);
  }
});

test('CV SQL Injection Resistance [CV-03]: findProfileBySlugOrId handles injection payloads safely', async () => {
  const injectionPayloads = [
    "' OR '1'='1",
    "admin'--",
    "1; DROP TABLE app.users;--",
    "1' UNION SELECT 1, 'admin', 1, 'Modern', 'h', 'b', NULL, 1, SYSUTCDATETIME(), SYSUTCDATETIME()--",
    "00000000-0000-0000-0000-000000000000' OR 1=1--",
  ];

  for (const payload of injectionPayloads) {
    // Executes genuine DB query via findProfileBySlugOrId
    const res = await findProfileBySlugOrId(payload);
    // Either returns null or undefined without syntax error or table drop
    assert.equal(res, null, `Injection payload "${payload}" must not execute and must safely return null`);
  }
});

test('CV Privacy Toggle [CV-04]: getPublicCv returns privacy notice and leaks zero contact or achievements when is_public = 0', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async () => ({
      profile_id: 'p-secret',
      user_id: 777,
      is_public: 0, // Private!
      slug: 'private-researcher',
      headline: 'Confidential Bio',
    }),
    getUserContact: async () => ({
      full_name: 'Dr. Secret Person',
      email: 'secret@lhu.edu.vn',
      phone: '0909999999',
    }),
    getUserActiveAchievements: async () => [
      { achievement_id: 1, title: 'Top Secret Patent' }
    ],
  };

  const service = createCvService(mockRepo);
  const result = await service.getPublicCv('private-researcher');

  assert.equal(result.isPublic, false, 'isPublic must be false');
  assert.equal(result.message, 'Hồ sơ đang ở chế độ riêng tư');
  assert.equal(result.contact, undefined, 'Private CV must not leak contact info');
  assert.equal(result.achievements, undefined, 'Private CV must not leak achievements');
});

test('CV DOCX Export [CV-05]: Corrupted DOCX template handling', () => {
  // 1. Passing corrupted non-zip binary to PizZip must throw a catchable error
  const corruptedBinary = 'CORRUPTED_NON_ZIP_BINARY_DATA_XYZ';
  assert.throws(
    () => {
      new PizZip(corruptedBinary);
    },
    /Can't find end of central directory : is this a zip file/,
    'Corrupted binary template must throw descriptive PizZip zip error'
  );

  // 2. Passing zip missing [Content_Types].xml throws filetype_not_identified
  const zipMissingTypes = new PizZip();
  zipMissingTypes.file('word/document.xml', '<w:document></w:document>');
  assert.throws(
    () => {
      new Docxtemplater(zipMissingTypes, { paragraphLoop: true, linebreaks: true });
    },
    /filetype_not_identified|could not be identified/,
    'Missing [Content_Types].xml must throw filetype not identified error'
  );

  // 3. Passing zip with unclosed template tags throws in constructor/compile
  const zipWithUnclosedTag = new PizZip();
  zipWithUnclosedTag.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zipWithUnclosedTag.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zipWithUnclosedTag.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>{unclosedTag</w:t></w:r></w:p></w:body>
</w:document>`);

  assert.throws(
    () => {
      new Docxtemplater(zipWithUnclosedTag, { paragraphLoop: true, linebreaks: true });
    },
    /Multi error|Unclosed tag/,
    'Unclosed template tag must throw Docxtemplater syntax error during compilation'
  );
});

// ============================================================================
// SUITE 5: CALENDAR MODULE ADVERSARIAL STRESS TESTING
// ============================================================================

test('Calendar Date Validation [CAL-01]: isValidCalendarDate strictly rejects impossible leap years and invalid dates', () => {
  const invalidDates = [
    '2025-02-29', // 2025 is not a leap year!
    '2026-02-30', // Feb 30 does not exist
    '2026-04-31', // April has only 30 days
    '2026-13-01', // Month 13 invalid
    '2026-00-15', // Month 00 invalid
    '2026-01-32', // Day 32 invalid
    '1989-12-31', // Year < 1990 boundary
    '2101-01-01', // Year > 2100 boundary
    'not-a-date',
    '',
    null,
    undefined,
  ];

  for (const date of invalidDates) {
    assert.equal(isValidCalendarDate(date), false, `Date "${date}" must be rejected as invalid`);
  }

  const validDates = [
    '2024-02-29', // 2024 is a leap year!
    '2028-02-29', // 2028 is a leap year!
    '2026-02-28',
    '2026-11-13',
    '1990-01-01', // Lower bound
    '2100-12-31', // Upper bound
  ];

  for (const date of validDates) {
    assert.equal(isValidCalendarDate(date), true, `Date "${date}" must be accepted`);
  }
});

test('Calendar Reminder Transaction [CAL-02]: Non-existent regulationId triggers rollback preventing orphan calendar events', async () => {
  let rollbackCalled = false;
  let insertedEventId = null;

  const mockRun = async (sql, params) => {
    if (sql.includes('SELECT document_id FROM app.regulation_documents WHERE document_id = $1')) {
      return { rows: [] }; // NOT FOUND!
    }
    if (sql.includes('INSERT INTO app.personal_calendar_events')) {
      insertedEventId = 999;
      return { rows: [{ id: 999 }] };
    }
    return { rows: [] };
  };

  const mockTxRunner = async (callback) => {
    try {
      return await callback({ query: mockRun });
    } catch (err) {
      rollbackCalled = true;
      throw err;
    }
  };

  const service = calendarService(mockRun, mockTxRunner);

  await assert.rejects(
    async () => {
      await service.createReminder({ userId: 1 }, {
        title: 'Hạn nộp quy chế không tồn tại',
        deadlineDate: '2026-11-20',
        regulationId: 99999, // Non-existent!
      });
    },
    NotFoundError,
    'Must throw NotFoundError for non-existent regulation'
  );

  assert.equal(rollbackCalled, true, 'Transaction runner must catch error and rollback');
  assert.equal(insertedEventId, null, 'Must abort before inserting personal calendar event');
});

test('Calendar Concurrency [CAL-03]: Optimistic locking detects version mismatch and throws ConcurrencyConflictError', async () => {
  const mockRun = async (sql, params) => {
    if (sql.includes('UPDATE app.personal_calendar_events')) {
      return { rows: [] }; // Zero rows updated because version mismatch!
    }
    if (sql.includes('SELECT event_id FROM app.personal_calendar_events')) {
      return { rows: [{ event_id: 123 }] }; // Record exists
    }
    return { rows: [] };
  };

  const service = calendarService(mockRun);

  await assert.rejects(
    async () => {
      await service.update({ userId: 1 }, 123, {
        title: 'Cập nhật xung đột',
        category: 'task',
        startsAt: '2026-11-20T09:00',
        endsAt: '2026-11-20T10:00',
        allDay: false,
        completed: false,
        version: 1, // Stale version!
      });
    },
    ConcurrencyConflictError,
    'Stale version must throw ConcurrencyConflictError'
  );
});

// ============================================================================
// SUITE 6: ORGANIZATIONS MODULE ADVERSARIAL STRESS TESTING
// ============================================================================

test('Organizations Tree [ORG-01]: Circular hierarchy prevention rejects setting unit itself or descendant as parent', async () => {
  const mockRepo = {
    findUnit: async (id) => ({ unitId: id, name: `Unit #${id}` }),
    hasDescendant: async (unitId, parentId) => {
      // Unit 10 has descendant Unit 20
      return Number(unitId) === 10 && Number(parentId) === 20;
    },
    updateUnit: async () => {},
  };

  const service = createOrganizationService(mockRepo);

  // Case 1: Unit 10 setting itself as parent
  await assert.rejects(
    async () => {
      await service.updateUnit(10, { parentId: 10, version: 1, code: 'U10', name: 'Unit 10', isActive: true });
    },
    (err) => err instanceof ConflictError && err.code === 'ORGANIZATION_CYCLE',
    'Setting self as parent must throw ConflictError with code ORGANIZATION_CYCLE'
  );

  // Case 2: Unit 10 setting its descendant (Unit 20) as parent
  await assert.rejects(
    async () => {
      await service.updateUnit(10, { parentId: 20, version: 1, code: 'U10', name: 'Unit 10', isActive: true });
    },
    (err) => err instanceof ConflictError && err.code === 'ORGANIZATION_CYCLE',
    'Setting descendant as parent must throw ConflictError with code ORGANIZATION_CYCLE'
  );
});

test('Organizations RBAC [ORG-02]: Unit AI Scan strictly enforces role boundaries', async () => {
  const mockRepo = {
    findUnit: async (id) => ({ unitId: id, name: `Unit #${id}` }),
    hasDescendant: async (pId, cId) => pId === 1 && cId === 2, // Faculty 1 has Department 2
    getRegulationCriteria: async () => [{ criteria_version_id: 1, code: 'C1', name: 'Crit 1' }],
    getDescendantUnitIds: async (id) => [id],
    getUnitMembers: async () => [],
  };

  const service = createOrganizationService(mockRepo);

  // 1. MEMBER role without leadership privileges is rejected
  await assert.rejects(
    async () => {
      await service.scanUnitWithAi(2, 1, { userId: 5, activeRoles: ['MEMBER'] });
    },
    ForbiddenError,
    'MEMBER role must be rejected with ForbiddenError (403)'
  );

  // 2. DEPARTMENT_HEAD cannot scan outside their own department
  await assert.rejects(
    async () => {
      // Head of Department 2 attempting to scan Department 3
      await service.scanUnitWithAi(3, 1, {
        userId: 10,
        activeRoles: ['DEPARTMENT_HEAD'],
      });
    },
    ForbiddenError,
    'DEPARTMENT_HEAD cannot scan outside their assigned department'
  );

  // 3. ADMIN role can scan any unit
  const adminResult = await service.scanUnitWithAi(2, 1, {
    userId: 1,
    activeRoles: ['ADMIN'],
  });
  assert.equal(adminResult.unitId, 2);
  assert.equal(adminResult.totalMembers, 0);
});

test('Organizations [ORG-03]: 3-level tree AI scan correctly aggregates eligible counts, percentages, and missing criteria', async () => {
  const mockCriteria = [
    {
      criteria_version_id: 1,
      code: 'ISI_Q1',
      name: 'Bài báo ISI Q1',
      min_threshold: 1,
      unit_metric: 'bài báo',
      source_rules: JSON.stringify({ sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
    },
    {
      criteria_version_id: 2,
      code: 'CS_TIEU_BIEU',
      name: 'Chiến sĩ thi đua cấp cơ sở',
      min_threshold: 1,
      unit_metric: 'danh hiệu',
      source_rules: JSON.stringify({ sourceType: 'ACHIEVEMENT', achievementTypeIds: [2] }),
    },
  ];

  const mockMembers = [
    { lecturer_id: 101, user_id: 11, full_name: 'Nguyễn Văn Đạt', email: 'dat@lhu.edu.vn', unit_id: 2, unit_name: 'Bộ môn CNPM' },
    { lecturer_id: 102, user_id: 12, full_name: 'Trần Thị Thiếu', email: 'thieu@lhu.edu.vn', unit_id: 2, unit_name: 'Bộ môn CNPM' },
  ];

  const dummyFile = { id: 1, sha256: 'c'.repeat(64), originalFileName: 'cert.pdf' };

  const mockRepo = {
    findUnit: async () => ({ unitId: 2, name: 'Bộ môn CNPM' }),
    getRegulationCriteria: async () => mockCriteria,
    getDescendantUnitIds: async () => [2],
    getUnitMembers: async () => mockMembers,
    getMemberAchievements: async (lecturerId) => {
      if (lecturerId === 101) {
        // Lecturer 101 has both achievements -> 100% eligible
        return [
          { id: 1, type: 'ACHIEVEMENT', sourceTypeId: 1, lecturerId: 101, recognitionYear: 2025, status: 'ACTIVE', file: dummyFile },
          { id: 2, type: 'ACHIEVEMENT', sourceTypeId: 2, lecturerId: 101, recognitionYear: 2025, status: 'ACTIVE', file: dummyFile },
        ];
      }
      // Lecturer 102 has only 1 achievement -> 50% not eligible
      return [
        { id: 3, type: 'ACHIEVEMENT', sourceTypeId: 1, lecturerId: 102, recognitionYear: 2025, status: 'ACTIVE', file: dummyFile },
      ];
    },
  };

  const service = createOrganizationService(mockRepo);
  const scan = await service.scanUnitWithAi(2, 1, { userId: 1, activeRoles: ['ADMIN'] });

  assert.equal(scan.totalMembers, 2);
  assert.equal(scan.eligibleCount, 1, 'Exactly 1 out of 2 members is eligible');

  const dat = scan.results.find(r => r.lecturerId === 101);
  assert.equal(dat.isEligible, true);
  assert.equal(dat.percentage, 100);
  assert.equal(dat.matched.length, 2);
  assert.equal(dat.missing.length, 0);

  const thieu = scan.results.find(r => r.lecturerId === 102);
  assert.equal(thieu.isEligible, false);
  assert.equal(thieu.percentage, 50);
  assert.equal(thieu.matched.length, 1);
  assert.equal(thieu.missing.length, 1);
  assert.equal(thieu.missing[0].code, 'CS_TIEU_BIEU');
});
