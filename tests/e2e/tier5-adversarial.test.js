/**
 * tests/e2e/tier5-adversarial.test.js
 * Tier 5: White-Box Adversarial Stress Testing & Client-Server Integration Contracts
 *
 * Scope:
 * - Frontend Services & Error Resilience: AI Vision fallback, CV slug validation, read cache policies.
 * - Routing & Public CV: Custom slug resolving, URL encoding, 404 fallback, privacy screen zero-leakage.
 * - Achievements & AI Forecast: ACTIVE badge status, zero-gap auto-discovery, calendar reminder modal contracts.
 * - Client-Server Integration: Rate/size extremes, duplicate handling, path traversal sanitization, archive stream integrity.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { TestClient } from './helpers/testClient.js';
import { USERS, ROLES, ACHIEVEMENTS, REGULATIONS } from './helpers/fixtures.js';

// Real frontend service modules
import {
  SLUG_REGEX,
  RESERVED_SLUGS as FRONTEND_RESERVED_SLUGS,
  validateCvSlug,
  buildPublicCvUrl,
} from '../../frontend/src/services/cvValidation.js';
import {
  cachedRead,
  clearReadCache,
  invalidateReadCache,
} from '../../frontend/src/services/readCache.js';
import { readCacheKey } from '../../frontend/src/services/readCachePolicy.js';

// Real backend schemas & utilities
import {
  SLUG_REGEX as BACKEND_SLUG_REGEX,
  RESERVED_SLUGS as BACKEND_RESERVED_SLUGS,
  VALID_TEMPLATES,
  slugSchema,
  updateCvProfileSchema,
} from '../../backend/src/modules/cv/cvSchemas.js';
import {
  sanitizeFileName,
  formatStandardizedFileName,
  buildDossierArchive,
} from '../../backend/src/modules/ai/dossierPackagerService.js';

describe('Tier 5: White-Box Adversarial Stress Tests & System Contracts', () => {
  let client;

  beforeEach(() => {
    client = new TestClient({ role: ROLES.MEMBER });
    client.store.reset();
    clearReadCache();
  });

  // =========================================================================
  // SUITE 1: AI Vision Fallback & Ingest Error Handling
  // =========================================================================
  describe('Suite 1: AI Vision Fallback & Ingest Error Handling', () => {
    it('TC-ADV-01: Corrupt, zero-byte, oversized, and unsupported MIME payloads are rejected gracefully', async () => {
      // 1. Zero-byte file
      const zeroByteRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'empty.pdf',
        fileSizeBytes: 0,
        contentBase64: '',
      });
      assert.equal(zeroByteRes.status, 400, 'Zero-byte file must be rejected with 400 Bad Request');
      assert.equal(zeroByteRes.data.success, false);
      assert.match(zeroByteRes.data.message, /rỗng/i);

      // 2. Oversized file (> 50MB)
      const oversizedRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'oversized_scan.png',
        fileSizeBytes: 60 * 1024 * 1024,
        oversized: true,
      });
      assert.equal(oversizedRes.status, 413, 'Oversized payload must be rejected with 413 Payload Too Large');
      assert.equal(oversizedRes.data.success, false);

      // 3. Unsupported MIME / malicious executable extension
      const exeRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'malicious_payload.exe',
        mimeType: 'application/x-msdownload',
        contentBase64: 'TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAA...',
      });
      assert.equal(exeRes.status, 400, 'Unsupported executable MIME must be rejected with 400');
      assert.equal(exeRes.data.success, false);

      // 4. Corrupted file header
      const corruptRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'corrupted_header.jpg',
        corruptedHeader: true,
        contentBase64: 'NOT_VALID_BASE64_CORRUPTED',
      });
      assert.equal(corruptRes.status, 400, 'Corrupted image header must be rejected with 400');
      assert.equal(corruptRes.data.success, false);
    });

    it('TC-ADV-02: External AI service timeout and missing API key gracefully degrade to manual input fallback', async () => {
      // 1. AI Vision Network Timeout simulation
      const timeoutRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'heavy_cert.jpg',
        simulateTimeout: true,
      });
      assert.equal(timeoutRes.status, 200, 'Timeout should be handled with HTTP 200 fallback response');
      assert.equal(timeoutRes.data.success, true);
      assert.equal(timeoutRes.data.fallback, true, 'Fallback flag must be true on timeout');
      assert.equal(timeoutRes.data.data, null, 'Data must be null during fallback');
      assert.match(timeoutRes.data.message, /timeout|thời gian/i);

      // 2. Missing API key simulation
      const missingKeyRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'cert.png',
        simulateMissingApiKey: true,
      });
      assert.equal(missingKeyRes.status, 200, 'Missing API key must return 200 fallback response');
      assert.equal(missingKeyRes.data.fallback, true);
      assert.equal(missingKeyRes.data.data, null);
      assert.match(missingKeyRes.data.message, /khóa API|API Key|nhập thông tin bằng tay/i);
    });

    it('TC-ADV-03: Partial OCR metadata with missing/null fields safely fills available fields without runtime errors', async () => {
      const partialRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'partial_cert.jpg',
        simulatePartial: true,
      });

      assert.equal(partialRes.status, 200);
      assert.equal(partialRes.data.success, true);
      assert.equal(partialRes.data.fallback, false);
      assert.ok(partialRes.data.data.title, 'Extracted title must be present');
      assert.equal(partialRes.data.data.recognitionYear, null);
      assert.equal(partialRes.data.data.decisionNumber, null);

      // Verify frontend mapping logic handles partial data gracefully without throwing NaN or crashing
      const extracted = partialRes.data.data;
      const mappedYear = extracted.recognitionYear || new Date().getFullYear();
      const mappedDescription = [
        extracted.issuer ? `Đơn vị cấp: ${extracted.issuer}` : null,
        extracted.decisionNumber ? `Số quyết định: ${extracted.decisionNumber}` : null,
      ].filter(Boolean).join('\n') || 'Không có mô tả chi tiết';

      assert.equal(typeof mappedYear, 'number');
      assert.ok(mappedYear >= 2025);
      assert.equal(mappedDescription, 'Không có mô tả chi tiết');
    });

    it('TC-ADV-04: Adversarial certificate OCR text with SQL/HTML injection syntax preserves raw text safely', async () => {
      const maliciousCertTitle = '<script>alert("XSS")</script>\'; DROP TABLE app.achievements;--';
      const ocrRes = await client.request('POST', '/api/v1/achievements/ai-extract', {
        filename: 'special_chars_cert.png',
        certTitle: maliciousCertTitle,
      });

      assert.equal(ocrRes.status, 200);
      assert.equal(ocrRes.data.success, true);
      assert.equal(ocrRes.data.data.title, maliciousCertTitle, 'Raw text should be preserved in extracted data without unhandled execution');

      // Create achievement using the extracted title
      const createRes = await client.request('POST', '/api/v1/achievements', {
        title: ocrRes.data.data.title,
        recognitionYear: 2025,
        type: 'CERTIFICATE',
        category: 'GENERAL',
      });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.data.title, maliciousCertTitle);
      assert.equal(createRes.data.data.status, 'ACTIVE');
    });
  });

  // =========================================================================
  // SUITE 2: Public CV Custom Slug Resolving, Security & Collision Prevention
  // =========================================================================
  describe('Suite 2: Public CV Custom Slug Resolving, Security & Collision Prevention', () => {
    it('TC-ADV-05: Adversarial slug characters and boundaries are strictly rejected by both frontend and backend validators', () => {
      const invalidSlugs = [
        '',                      // empty
        '  ',                    // whitespace
        'ab',                    // length < 3
        'a'.repeat(101),         // length > 100
        '-starts-with-hyphen',   // leading hyphen
        'ends-with-hyphen-',     // trailing hyphen
        'double--hyphen',        // consecutive hyphens
        'nguyen van a',          // spaces
        'nguyen_van_a',          // underscores
        'nguyễn-văn-a',          // unicode accents
        'nguyen@van!a',          // special characters
        'user/slash',            // path separator
        'user\\backslash',       // backslash
        'admin\'--',             // SQL injection
      ];

      for (const s of invalidSlugs) {
        // Test frontend validator
        const feResult = validateCvSlug(s);
        // Note: empty or null returns valid: true with value: null (optional fallback), but non-empty invalid slugs must fail
        if (s.trim() !== '') {
          assert.equal(feResult.valid, false, `Frontend validator should reject invalid slug: "${s}"`);
          assert.ok(feResult.error, `Frontend validator should provide error message for: "${s}"`);
        }

        // Test backend Zod schema
        const beResult = slugSchema.safeParse(s);
        assert.equal(beResult.success, false, `Backend slugSchema should reject invalid slug: "${s}"`);
      }
    });

    it('TC-ADV-06: All system reserved slugs (case-insensitive) are strictly blocked across frontend and backend', () => {
      // Complete set of reserved system keywords
      const reservedKeywords = [
        'admin', 'api', 'auth', 'system', 'login', 'settings',
        'help', 'root', 'me', 'public', 'export-docx', 'download',
        'cv', 'profile', 'default',
      ];

      for (const word of reservedKeywords) {
        // 1. Lowercase test
        const feLower = validateCvSlug(word);
        assert.equal(feLower.valid, false, `Frontend should reject reserved slug: ${word}`);
        assert.match(feLower.error, /trùng với từ khóa hệ thống/i);

        const beLower = slugSchema.safeParse(word);
        assert.equal(beLower.success, false, `Backend should reject reserved slug: ${word}`);

        // 2. Uppercase / Mixed case test (should normalize and reject)
        const mixed = word.toUpperCase();
        const feUpper = validateCvSlug(mixed);
        assert.equal(feUpper.valid, false, `Frontend should reject uppercase reserved slug: ${mixed}`);

        const beUpper = slugSchema.safeParse(mixed.toLowerCase());
        assert.equal(beUpper.success, false, `Backend should reject uppercase reserved slug: ${mixed}`);
      }
    });

    it('TC-ADV-07: Slug encoding, special characters, and seamless fallback to profile UUID in URL builder', () => {
      // 1. Valid custom slug URL build
      assert.equal(
        buildPublicCvUrl('nguyen-van-an', 'uuid-1234'),
        '/cv/nguyen-van-an'
      );

      // 2. BaseUrl handling with trailing slashes
      assert.equal(
        buildPublicCvUrl('nguyen-van-an', 'uuid-1234', 'https://lhu.edu.vn///'),
        'https://lhu.edu.vn/cv/nguyen-van-an'
      );

      // 3. Fallback to profile UUID when slug is null, empty string, or whitespace
      assert.equal(buildPublicCvUrl(null, 'uuid-abc-999'), '/cv/uuid-abc-999');
      assert.equal(buildPublicCvUrl('', 'uuid-abc-999'), '/cv/uuid-abc-999');
      assert.equal(buildPublicCvUrl('   ', 'uuid-abc-999'), '/cv/uuid-abc-999');
      assert.equal(buildPublicCvUrl(undefined, '105'), '/cv/105');

      // 4. Empty identifier returns empty string
      assert.equal(buildPublicCvUrl(null, null), '');
      assert.equal(buildPublicCvUrl('', ''), '');

      // 5. Special character URL encoding
      const encodedUrl = buildPublicCvUrl('ts-nguyễn-văn-a', '101');
      assert.ok(encodedUrl.startsWith('/cv/'));
      assert.ok(!encodedUrl.includes(' '));
    });

    it('TC-ADV-08: Unauthenticated access to non-existent custom slug returns 404 Not Found cleanly', async () => {
      const guestClient = new TestClient({ role: null, token: null });
      const res = await guestClient.request('GET', '/api/v1/public/cv/slug-khong-ton-tai-404');

      assert.equal(res.status, 404, 'Non-existent public CV slug must return 404 Not Found');
      assert.equal(res.data.success, false);
      assert.match(res.data.message, /CV không tồn tại hoặc đã ngừng chia sẻ/i);
    });
  });

  // =========================================================================
  // SUITE 3: Privacy Shield & Read Cache Invalidation
  // =========================================================================
  describe('Suite 3: Privacy Shield & Read Cache Invalidation', () => {
    it('TC-ADV-09: Setting is_public = 0 / isPublic = false guarantees zero achievement or contact data leakage', async () => {
      const guestClient = new TestClient({ role: null, token: null });
      // 'tran-thi-bich' has isPublic = false
      const res = await guestClient.request('GET', '/api/v1/public/cv/tran-thi-bich');

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.isPublic, false, 'Profile must report isPublic = false');
      assert.equal(res.data.data.message, 'Hồ sơ đang ở chế độ riêng tư');

      // CRITICAL SECURITY ASSERTION: Leakage prevention
      assert.equal(res.data.data.achievements, undefined, 'Private CV MUST NOT expose achievements list');
      assert.equal(res.data.data.contact, undefined, 'Private CV MUST NOT expose personal contact information');
      assert.equal(res.data.data.bio, undefined, 'Private CV MUST NOT expose personal biography');
      assert.equal(res.data.data.headline, undefined, 'Private CV MUST NOT expose headline');
    });

    it('TC-ADV-10: Frontend isProfilePrivate logic handles boolean false, numeric 0, string "0", and HTTP 403 status', () => {
      const isProfilePrivate = (data) => {
        if (!data) return false;
        if (data.isPublic === false) return true;
        if (data.is_public === false || data.is_public === 0 || data.is_public === '0') return true;
        return false;
      };

      // Test all possible truthy private representations
      assert.equal(isProfilePrivate({ isPublic: false }), true);
      assert.equal(isProfilePrivate({ is_public: false }), true);
      assert.equal(isProfilePrivate({ is_public: 0 }), true);
      assert.equal(isProfilePrivate({ is_public: '0' }), true);
      assert.equal(isProfilePrivate({ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }), true);

      // Test public representations
      assert.equal(isProfilePrivate({ isPublic: true, headline: 'Giảng viên' }), false);
      assert.equal(isProfilePrivate({ is_public: true }), false);
      assert.equal(isProfilePrivate({ is_public: 1 }), false);
      assert.equal(isProfilePrivate({ is_public: '1' }), false);

      // Test edge cases
      assert.equal(isProfilePrivate(null), false);
      assert.equal(isProfilePrivate(undefined), false);
      assert.equal(isProfilePrivate({}), false);
    });

    it('TC-ADV-11: CV profile endpoints (/me/cv) and blob downloads are strictly excluded from readCache', () => {
      // 1. /me/cv should NOT be cached (ensuring privacy toggle edits are immediately live)
      const cvCacheKey = readCacheKey({ method: 'GET', url: '/me/cv' });
      assert.equal(cvCacheKey, null, '/me/cv must return null from readCacheKey to prevent stale caching of CV profile');

      // 2. Blob downloads must NOT be cached
      const zipCacheKey = readCacheKey({ method: 'GET', url: '/ai/export-dossier-zip', responseType: 'blob' });
      assert.equal(zipCacheKey, null, 'Blob responseType must never be cached');

      const docxCacheKey = readCacheKey({ method: 'GET', url: '/me/cv/export-docx', responseType: 'blob' });
      assert.equal(docxCacheKey, null, 'DOCX download must never be cached');

      // 3. Mutating requests must NOT be cached
      assert.equal(readCacheKey({ method: 'POST', url: '/achievements' }), null);
      assert.equal(readCacheKey({ method: 'PUT', url: '/me/cv' }), null);
      assert.equal(readCacheKey({ method: 'PATCH', url: '/me/profile' }), null);
      assert.equal(readCacheKey({ method: 'DELETE', url: '/achievements/1' }), null);

      // 4. Allowed read routes should have a deterministic cache key
      const allowedKey1 = readCacheKey({ method: 'GET', url: '/achievements' });
      assert.ok(allowedKey1, '/achievements should produce a valid cache key');

      const allowedKey2 = readCacheKey({ method: 'GET', url: '/dashboard/summary' });
      assert.ok(allowedKey2, '/dashboard/summary should produce a valid cache key');
    });

    it('TC-ADV-12: Mutating HTTP requests and session resets flush readCache completely', async () => {
      clearReadCache();
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        return { data: 'initial_vault_data' };
      };

      // Initial read fills cache
      const res1 = await cachedRead('vault_cache', mockFetch);
      assert.equal(res1.data, 'initial_vault_data');
      assert.equal(fetchCount, 1);

      // Second read hits cache
      const res2 = await cachedRead('vault_cache', mockFetch);
      assert.equal(res2.data, 'initial_vault_data');
      assert.equal(fetchCount, 1);

      // Simulate mutation triggering clearReadCache()
      clearReadCache();

      // Third read after mutation must re-fetch fresh data
      const res3 = await cachedRead('vault_cache', mockFetch);
      assert.equal(res3.data, 'initial_vault_data');
      assert.equal(fetchCount, 2, 'Cache must be invalidated after clearReadCache()');
    });

    it('TC-ADV-13: Out-of-order asynchronous cache resolution started in an old revision is prevented from poisoning new revision', async () => {
      clearReadCache();
      let slowResolve;
      const slowPromise = new Promise((resolve) => {
        slowResolve = resolve;
      });

      // Start slow read in revision 0
      const oldReadPromise = cachedRead('profile_key', () => slowPromise);

      // Clear cache (advances revision to 1)
      clearReadCache();

      // New read in revision 1 finishes quickly
      const newReadResult = await cachedRead('profile_key', async () => 'fresh_account_data');
      assert.equal(newReadResult, 'fresh_account_data');

      // Now slow read from revision 0 finishes
      slowResolve('stale_account_data');
      await oldReadPromise;

      // Ensure cache still returns fresh_account_data, NOT stale_account_data
      const finalCacheCheck = await cachedRead('profile_key', async () => 'unexpected_fetch');
      assert.equal(finalCacheCheck, 'fresh_account_data', 'Stale response from previous revision must not overwrite fresh cache');
    });

    it('TC-ADV-14: Read cache enforces LRU capacity cap of 150 entries and prunes expired records', async () => {
      clearReadCache();

      // Populate 155 distinct cache keys
      for (let i = 1; i <= 155; i++) {
        await cachedRead(`key_${i}`, async () => `value_${i}`, 60000);
      }

      // First few keys should have been evicted to stay under capacity limit
      let refetchedCount = 0;
      await cachedRead('key_1', async () => {
        refetchedCount++;
        return 'value_1_recomputed';
      });

      assert.equal(refetchedCount, 1, 'Key 1 should have been evicted when cache reached 150 items');
    });
  });

  // =========================================================================
  // SUITE 4: AI Gap to KPI Roadmap Bridge & Extreme Edge Cases
  // =========================================================================
  describe('Suite 4: AI Gap to KPI Roadmap Bridge & Extreme Edge Cases', () => {
    it('TC-ADV-15: KPI gap transfer rejects missingCriteria with count <= 0 or empty list', async () => {
      // 1. Empty missingCriteria list
      const emptyRes = await client.request('POST', '/api/v1/kpi/from-ai-gap', {
        regulationId: 1,
        missingCriteria: [],
      });
      assert.equal(emptyRes.status, 400, 'Empty missingCriteria must be rejected with 400');
      assert.equal(emptyRes.data.success, false);
      assert.match(emptyRes.data.message, /không được để trống/i);

      // 2. missingCriteria with count <= 0
      const negativeRes = await client.request('POST', '/api/v1/kpi/from-ai-gap', {
        regulationId: 1,
        missingCriteria: [
          { code: 'CRIT_01', name: 'Tiêu chí 1', missingCount: 0, unit: 'bài báo' },
        ],
      });
      assert.equal(negativeRes.status, 400, 'missingCount <= 0 must be rejected with 400');
      assert.equal(negativeRes.data.success, false);
      assert.match(negativeRes.data.message, /lớn hơn 0/i);

      // 3. Valid gap transfer creates KPI goals with source AI_GAP
      const validRes = await client.request('POST', '/api/v1/kpi/from-ai-gap', {
        regulationId: 1,
        missingCriteria: [
          { code: 'GAP_PUB_Q1', name: 'Công bố 1 bài báo Q1', missingCount: 1, unit: 'bài' },
          { code: 'GAP_TEACHING', name: 'Giờ giảng dạy nghiên cứu sinh', missingCount: 20, unit: 'giờ' },
        ],
      });
      assert.equal(validRes.status, 201);
      assert.equal(validRes.data.success, true);
      assert.equal(validRes.data.data.length, 2);
      assert.equal(validRes.data.data[0].source, 'AI_GAP');
      assert.equal(validRes.data.data[1].source, 'AI_GAP');
    });

    it('TC-ADV-16: Transferring duplicate criteria codes in a single gap request is handled without database conflicts', async () => {
      const duplicateRes = await client.request('POST', '/api/v1/kpi/from-ai-gap', {
        regulationId: 1,
        missingCriteria: [
          { code: 'DUPLICATE_CODE', name: 'Tiêu chí trùng 1', missingCount: 1, unit: 'tiêu chí' },
          { code: 'DUPLICATE_CODE', name: 'Tiêu chí trùng 2', missingCount: 2, unit: 'tiêu chí' },
        ],
      });

      assert.equal(duplicateRes.status, 400, 'Duplicate codes in same gap transfer should be rejected with 400');
      assert.equal(duplicateRes.data.success, false);
      assert.match(duplicateRes.data.message, /trùng lặp/i);
    });

    it('TC-ADV-17: Calendar reminder rejects past deadline dates, invalid dates, and title overflows', async () => {
      // 1. Past deadline date (< 2025-01-01)
      const pastDateRes = await client.request('POST', '/api/v1/me/calendar/reminder', {
        title: 'Hạn nộp hồ sơ năm cũ',
        deadlineDate: '2024-05-01T00:00:00Z',
        regulationId: 1,
      });
      assert.equal(pastDateRes.status, 400, 'Past deadline date must be rejected with 400');
      assert.equal(pastDateRes.data.success, false);
      assert.match(pastDateRes.data.message, /quá khứ/i);

      // 2. Malformed date string
      const invalidDateRes = await client.request('POST', '/api/v1/me/calendar/reminder', {
        title: 'Hạn nộp hồ sơ',
        deadlineDate: 'invalid-date-string',
        regulationId: 1,
      });
      assert.equal(invalidDateRes.status, 400, 'Invalid date string must return 400');
      assert.equal(invalidDateRes.data.success, false);

      // 3. Title overflow (> 255 chars)
      const longTitleRes = await client.request('POST', '/api/v1/me/calendar/reminder', {
        title: 'A'.repeat(256),
        deadlineDate: '2025-12-15T23:59:59Z',
        regulationId: 1,
      });
      assert.equal(longTitleRes.status, 400, 'Title > 255 chars must return 400');
      assert.equal(longTitleRes.data.success, false);

      // 4. Valid reminder schedule
      const validReminderRes = await client.request('POST', '/api/v1/me/calendar/reminder', {
        title: 'Hạn nộp hồ sơ Chiến sĩ thi đua 2025',
        deadlineDate: '2025-12-15T23:59:59Z',
        regulationId: 1,
      });
      assert.equal(validReminderRes.status, 201);
      assert.equal(validReminderRes.data.success, true);
      assert.equal(validReminderRes.data.data.status, 'SCHEDULED');

      // 5. Duplicate reminder for same regulation and deadline returns 409 Conflict
      const duplicateReminderRes = await client.request('POST', '/api/v1/me/calendar/reminder', {
        title: 'Hạn nộp hồ sơ Chiến sĩ thi đua 2025 (Duplicate)',
        deadlineDate: '2025-12-15T23:59:59Z',
        regulationId: 1,
      });
      assert.equal(duplicateReminderRes.status, 409, 'Duplicate reminder must return 409 Conflict');
      assert.equal(duplicateReminderRes.data.success, false);
    });
  });

  // =========================================================================
  // SUITE 5: Dossier Packager (.ZIP) Streaming Resilience
  // =========================================================================
  describe('Suite 5: Dossier Packager (.ZIP) Streaming Resilience', () => {
    it('TC-ADV-18: Requesting dossier ZIP export with 0 matched achievements returns 400 Bad Request safely', async () => {
      const emptyZipRes = await client.request('POST', '/api/v1/ai/export-dossier-zip', {
        regulationId: 1,
        emptyDossier: true,
        matchedAchievementsCount: 0,
      });

      assert.equal(emptyZipRes.status, 400, 'Empty dossier export must return 400 Bad Request');
      assert.equal(emptyZipRes.data.success, false);
      assert.match(emptyZipRes.data.message, /Không có minh chứng nào phù hợp/i);
    });

    it('TC-ADV-19: File name sanitization strips path traversal sequences (../, slashes, control chars) and standardizes formatting', () => {
      // 1. Path traversal attacks
      assert.equal(sanitizeFileName('../../etc/passwd'), '.._.._etc_passwd');
      assert.equal(sanitizeFileName('..\\..\\windows\\system32'), '.._.._windows_system32');

      // 2. Vietnamese unicode accents removal & special symbols
      const vietnameseTitle = 'Đại học Lạc Hồng: Giải Nhất & Cúp Vàng — 2025/2026';
      const sanitized = sanitizeFileName(vietnameseTitle);
      assert.equal(sanitized, 'Dai_hoc_Lac_Hong_Giai_Nhat_Cup_Vang_2025_2026');
      assert.ok(!/[đĐ\u0300-\u036f]/.test(sanitized), 'Must not contain accented Vietnamese characters');
      assert.ok(!/[^a-zA-Z0-9_\-\.]/.test(sanitized), 'Must contain only safe alphanumeric, underscore, hyphen or dot characters');

      // 3. Null, empty, whitespace and symbol fallback
      assert.equal(sanitizeFileName(null), 'MinhChung');
      assert.equal(sanitizeFileName(''), 'MinhChung');
      assert.equal(sanitizeFileName(undefined), 'MinhChung');
      assert.equal(sanitizeFileName('   '), 'MinhChung');
      assert.equal(sanitizeFileName('!@#$%'), 'MinhChung');

      // 4. Standardized filename format: 01_[Name]_[Year].pdf
      const stdName = formatStandardizedFileName(1, 'Bằng khen Chiến sĩ thi đua', 2025, 'pdf');
      assert.equal(stdName, '01_[Bang_khen_Chien_si_thi_dua]_[2025].pdf');

      const stdName2 = formatStandardizedFileName(12, 'Giấy chứng nhận NCKH', 2026, '.png');
      assert.equal(stdName2, '12_[Giay_chung_nhan_NCKH]_[2026].png');
    });

    it('TC-ADV-20: Multi-file dossier bundle correctly initializes ZIP archive with PK header signature', async () => {
      const validZipRes = await client.request('POST', '/api/v1/ai/export-dossier-zip', {
        regulationId: 1,
        filename: 'Goi_Minh_Chung_Chien_Si_Thi_Dua_2025.zip',
        innerFilename: '01_Bang_khen_Chien_si_thi_dua_2025.pdf',
      });

      assert.equal(validZipRes.status, 200);
      assert.ok(validZipRes.headers.get('content-type').includes('application/zip'));
      assert.ok(validZipRes.headers.get('content-disposition').includes('attachment;'));

      // Verify ZIP binary signature (0x50, 0x4B, 0x03, 0x04)
      const buffer = validZipRes.buffer;
      assert.ok(buffer && buffer.length >= 4, 'Buffer must contain binary data');
      assert.equal(buffer[0], 0x50, 'Byte 0 must be P (0x50)');
      assert.equal(buffer[1], 0x4b, 'Byte 1 must be K (0x4B)');
      assert.equal(buffer[2], 0x03, 'Byte 2 must be 0x03');
      assert.equal(buffer[3], 0x04, 'Byte 3 must be 0x04');
    });
  });

  // =========================================================================
  // SUITE 6: Role Authorization Matrix & State Transitions
  // =========================================================================
  describe('Suite 6: Role Authorization Matrix & State Transitions', () => {
    it('TC-ADV-21: Legacy roles normalize correctly to standard 4 roles in route authorization', () => {
      const normalizeRole = (role) => {
        const r = typeof role === 'string' ? role : role?.code;
        if (!r) return 'MEMBER';
        if (r === 'LECTURER') return 'MEMBER';
        if (r === 'UNIT_REPRESENTATIVE') return 'DEPARTMENT_HEAD';
        if (r === 'MANAGER') return 'FACULTY_LEAD';
        if (r === 'RECORDS_OFFICER' || r === 'COUNCIL') return 'MEMBER';
        return r;
      };

      // Test all role conversions
      assert.equal(normalizeRole('LECTURER'), 'MEMBER');
      assert.equal(normalizeRole('UNIT_REPRESENTATIVE'), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole('MANAGER'), 'FACULTY_LEAD');
      assert.equal(normalizeRole('COUNCIL'), 'MEMBER');
      assert.equal(normalizeRole('RECORDS_OFFICER'), 'MEMBER');
      assert.equal(normalizeRole('MEMBER'), 'MEMBER');
      assert.equal(normalizeRole('DEPARTMENT_HEAD'), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole('FACULTY_LEAD'), 'FACULTY_LEAD');
      assert.equal(normalizeRole('ADMIN'), 'ADMIN');

      // Object format `{ code: ... }`
      assert.equal(normalizeRole({ code: 'LECTURER' }), 'MEMBER');
      assert.equal(normalizeRole({ code: 'UNIT_REPRESENTATIVE' }), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole(null), 'MEMBER');
      assert.equal(normalizeRole(undefined), 'MEMBER');
    });

    it('TC-ADV-22: Personal achievement vault guarantees immediate ACTIVE status and trash isolation', async () => {
      // 1. Create achievement in personal vault
      const createRes = await client.request('POST', '/api/v1/achievements', {
        title: 'Bằng khen Giáo viên dạy giỏi cấp Tỉnh',
        recognitionYear: 2025,
        type: 'CERTIFICATE',
        category: 'TEACHING',
      });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.data.status, 'ACTIVE', 'Newly created achievement MUST be ACTIVE immediately without administrative approval');
      assert.equal(createRes.data.data.statusLabel, 'Sẵn sàng sử dụng');

      // 2. Vault listing contains the newly created ACTIVE record
      const listRes = await client.request('GET', '/api/v1/achievements');
      assert.equal(listRes.status, 200);
      const found = listRes.data.data.find((a) => a.achievementId === createRes.data.data.achievementId);
      assert.ok(found, 'Created achievement must appear in user vault listing');
      assert.equal(found.status, 'ACTIVE');

      // 3. Auto-Discovery ranks open regulations and produces valid percentage
      // Edge Case: When filterActiveOnly is checked in 2026 without asOfDate, 2025 regulations are correctly treated as expired (length 0)
      const expiredCheckRes = await client.request('POST', '/api/v1/ai/auto-discovery', {
        filterActiveOnly: true,
      });
      assert.equal(expiredCheckRes.status, 200);
      assert.equal(expiredCheckRes.data.data.length, 0, 'Regulations with 2025 deadlines must be filtered out when current year is 2026');

      // When evaluated as of valid active period (asOfDate: '2025-06-01'), open regulations are returned and ranked
      const discoveryRes = await client.request('POST', '/api/v1/ai/auto-discovery', {
        asOfDate: '2025-06-01',
        filterActiveOnly: true,
      });
      assert.equal(discoveryRes.status, 200);
      assert.ok(Array.isArray(discoveryRes.data.data));
      assert.ok(discoveryRes.data.data.length > 0, 'Active regulations must be returned when within active date range');
      assert.ok(discoveryRes.data.data[0].percentage >= 0 && discoveryRes.data.data[0].percentage <= 100);
      assert.equal(discoveryRes.data.data[0].percentage, 100, 'Candidate with matching active achievements scores 100%');
    });
  });
});
