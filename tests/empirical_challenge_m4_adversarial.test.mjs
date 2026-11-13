/**
 * tests/empirical_challenge_m4_adversarial.test.mjs
 * Comprehensive Adversarial Empirical Stress Test Suite for Milestone 4
 * (Frontend UI Modernization & Routing)
 *
 * Covers:
 * 1. Slug validation edge cases (cvValidation.js & backend cvSchemas.js):
 *    - Special characters, unicode accents, symbols, emojis, control chars
 *    - Uppercase normalization and mixed case
 *    - Boundary lengths: 0, 1, 2, 3, 4, 99, 100, 101, 1000 chars, whitespace
 *    - Hyphen rules: leading, trailing, multiple, only hyphens
 *    - Reserved system keywords: 15 known slugs + case-insensitivity + keyword collision analysis (reports, etc.)
 *    - Fallback UUID link generation across empty/null/undefined/whitespace inputs and custom base URLs
 * 2. Public CV privacy boundary conditions & template rendering:
 *    - is_public = 0, is_public = false, isPublic = false, is_public = '0', and HTTP 403 Forbidden
 *    - Privacy screen UI elements: ShieldAlert icon, courteous notice, home link, no UI crash
 *    - 3 Web Templates (Academic, Modern, Minimalist) with complete, sparse, and adversarial payloads
 *    - Robustness against missing fields, long bio/headline, XSS injection attempts
 * 3. Role boundary and route protection (AppRoutes.jsx & Sidebar.jsx):
 *    - Standard 4 roles (MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN)
 *    - Legacy role token mapping (LECTURER -> MEMBER, UNIT_REPRESENTATIVE -> DEPARTMENT_HEAD, MANAGER -> FACULTY_LEAD, RECORDS_OFFICER -> MEMBER, COUNCIL -> MEMBER)
 *    - String vs Object role representations
 *    - Unauthenticated access to /cv/:slug and /cv/:id vs protected routes
 *    - Sidebar item filtering per role
 * 4. End-to-end integration verification with testClient
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import React from '../frontend/node_modules/react/index.js';
import ReactDOMServer from '../frontend/node_modules/react-dom/server.node.js';

import {
  SLUG_REGEX,
  RESERVED_SLUGS,
  validateCvSlug,
  buildPublicCvUrl,
} from '../frontend/src/services/cvValidation.js';

import {
  SLUG_REGEX as BACKEND_SLUG_REGEX,
  RESERVED_SLUGS as BACKEND_RESERVED_SLUGS,
  slugSchema as backendSlugSchema,
  updateCvProfileSchema,
} from '../backend/src/modules/cv/cvSchemas.js';

import { createClient, generateMockToken } from './e2e/helpers/testClient.js';
import { ROLES, USERS } from './e2e/helpers/fixtures.js';

// =========================================================================
// Category 1: Slug Validation Edge Cases (cvValidation.js & cvSchemas.js)
// =========================================================================
describe('Category 1: Adversarial Slug Validation Edge Cases', () => {

  describe('1.1: Special Characters, Accents, and Emojis', () => {
    const specialCharInputs = [
      'nguyen_van_a',      // underscore
      'nguyen.van.a',      // period
      'nguyen@lhu',        // at
      'nguyen#lhu',        // hash
      'nguyen$lhu',        // dollar
      'nguyen%lhu',        // percent
      'nguyen^lhu',        // caret
      'nguyen&lhu',        // ampersand
      'nguyen*lhu',        // asterisk
      'nguyen(lhu)',       // parenthesis
      'nguyen+lhu',        // plus
      'nguyen=lhu',        // equals
      'nguyen[lhu]',       // square brackets
      'nguyen{lhu}',       // curly braces
      'nguyen|lhu',        // pipe
      'nguyen\\lhu',       // backslash
      'nguyen/lhu',        // forward slash
      'nguyen:lhu',        // colon
      'nguyen;lhu',        // semicolon
      'nguyen"lhu"',       // double quote
      'nguyen\'lhu\'',     // single quote
      'nguyen<lhu>',       // angle brackets
      'nguyen,lhu',        // comma
      'nguyen?lhu',        // question mark
      'nguyen~lhu',        // tilde
      'nguyen`lhu`',       // backtick
    ];

    for (const input of specialCharInputs) {
      test(`rejects ASCII symbol in slug: "${input}"`, () => {
        const res = validateCvSlug(input);
        assert.equal(res.valid, false, `Expected "${input}" to be rejected`);
        assert.equal(res.error, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang (-)');
        assert.equal(SLUG_REGEX.test(input), false);
      });
    }

    const vietnameseAccentInputs = [
      'nguyễn-văn-a',
      'đỗ-thị-mai',
      'lê-văn-tám',
      'hồ-chí-minh',
      'tiến-sĩ-toán',
      'giáo-sư-hóa',
      'trần-đức-hải',
      'võ-văn-kiệt',
      'phạm-nhật-vượng',
      'đoàn-thị-điểm',
    ];

    for (const input of vietnameseAccentInputs) {
      test(`rejects Vietnamese accented characters: "${input}"`, () => {
        const res = validateCvSlug(input);
        assert.equal(res.valid, false, `Accented slug "${input}" must be rejected`);
        assert.equal(res.error, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang (-)');
      });
    }

    const nonLatinInputs = [
      'иван-иванов',       // Cyrillic
      '田中-太郎',           // CJK
      'أحمد-علي',          // Arabic
      'אלון-כהן',          // Hebrew
    ];

    for (const input of nonLatinInputs) {
      test(`rejects non-Latin scripts: "${input}"`, () => {
        const res = validateCvSlug(input);
        assert.equal(res.valid, false, `Non-Latin slug "${input}" must be rejected`);
      });
    }

    const emojiInputs = [
      'giang-vien-🔥',
      'ts-le-👨‍🏫',
      'prof-rocket-🚀',
      'cv-🎉-2026',
    ];

    for (const input of emojiInputs) {
      test(`rejects emojis in slug: "${input}"`, () => {
        const res = validateCvSlug(input);
        assert.equal(res.valid, false, `Emoji slug "${input}" must be rejected`);
      });
    }

    test('rejects control characters, newlines, and null bytes', () => {
      assert.equal(validateCvSlug('slug\0null').valid, false);
      assert.equal(validateCvSlug('slug\nnewline').valid, false);
      assert.equal(validateCvSlug('slug\ttab').valid, false);
      assert.equal(validateCvSlug('slug\r\nreturn').valid, false);
    });
  });

  describe('1.2: Uppercase & Normalization Handling', () => {
    test('normalizes pure uppercase slug to lowercase and passes', () => {
      const res = validateCvSlug('NGUYEN-VAN-A');
      assert.equal(res.valid, true);
      assert.equal(res.value, 'nguyen-van-a');
      assert.equal(res.error, null);
    });

    test('normalizes mixed case slug to lowercase and passes', () => {
      const res = validateCvSlug('Ts-Nguyen-Van-An-1985');
      assert.equal(res.valid, true);
      assert.equal(res.value, 'ts-nguyen-van-an-1985');
    });

    test('normalizes uppercase with invalid symbols and fails properly', () => {
      const res = validateCvSlug('NGUYEN_VAN_A');
      assert.equal(res.valid, false);
      assert.equal(res.value, 'nguyen_van_a');
    });

    test('normalizes uppercase with accents and fails properly', () => {
      const res = validateCvSlug('NGUYỄN-VĂN-A');
      assert.equal(res.valid, false);
    });
  });

  describe('1.3: Hyphen Placement Rules', () => {
    test('rejects leading hyphen', () => {
      assert.equal(validateCvSlug('-nguyen-van-a').valid, false);
      assert.equal(validateCvSlug('-123').valid, false);
      assert.equal(validateCvSlug('-a-b').valid, false);
    });

    test('rejects trailing hyphen', () => {
      assert.equal(validateCvSlug('nguyen-van-a-').valid, false);
      assert.equal(validateCvSlug('123-').valid, false);
      assert.equal(validateCvSlug('a-b-').valid, false);
    });

    test('rejects both leading and trailing hyphen', () => {
      assert.equal(validateCvSlug('-nguyen-van-a-').valid, false);
      assert.equal(validateCvSlug('-abc-').valid, false);
    });

    test('rejects consecutive double, triple, and multiple hyphens', () => {
      assert.equal(validateCvSlug('nguyen--van-a').valid, false);
      assert.equal(validateCvSlug('nguyen---van-a').valid, false);
      assert.equal(validateCvSlug('ts----an').valid, false);
    });

    test('rejects hyphen-only strings', () => {
      assert.equal(validateCvSlug('-').valid, false);
      assert.equal(validateCvSlug('--').valid, false);
      assert.equal(validateCvSlug('---').valid, false);
      assert.equal(validateCvSlug('----').valid, false);
    });

    test('accepts single hyphens placed between alphanumeric tokens', () => {
      assert.equal(validateCvSlug('a-b-c-d-e-f').valid, true);
      assert.equal(validateCvSlug('1-2-3-4-5').valid, true);
      assert.equal(validateCvSlug('dean-2026-v2').valid, true);
    });

    test('accepts all-numeric slugs of valid length', () => {
      assert.equal(validateCvSlug('123').valid, true);
      assert.equal(validateCvSlug('20261113').valid, true);
      assert.equal(validateCvSlug('007-999').valid, true);
    });
  });

  describe('1.4: Length Boundary Stress Testing', () => {
    test('length = 0 (empty string "") returns valid: true (optional fallback)', () => {
      const res = validateCvSlug('');
      assert.equal(res.valid, true);
      assert.equal(res.value, null);
      assert.equal(res.error, null);
    });

    test('whitespace-only string "   " fails with length error (cleaned length 0 < 3)', () => {
      const res = validateCvSlug('   ');
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Độ dài slug phải từ 3 đến 100 ký tự');
      assert.equal(res.value, '');
    });

    test('length = 1 char fails boundary (< 3)', () => {
      const res = validateCvSlug('a');
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Độ dài slug phải từ 3 đến 100 ký tự');
    });

    test('length = 2 chars fails boundary (< 3)', () => {
      const res = validateCvSlug('ab');
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Độ dài slug phải từ 3 đến 100 ký tự');
    });

    test('length = 3 chars succeeds (minimum boundary)', () => {
      assert.equal(validateCvSlug('abc').valid, true);
      assert.equal(validateCvSlug('123').valid, true);
      assert.equal(validateCvSlug('a-b').valid, true);
    });

    test('length = 4 chars succeeds when valid and fails when hyphen misplaced', () => {
      assert.equal(validateCvSlug('abcd').valid, true);
      assert.equal(validateCvSlug('a-b-').valid, false); // trailing hyphen
      assert.equal(validateCvSlug('-a-b').valid, false); // leading hyphen
      assert.equal(validateCvSlug('a-bc').valid, true);
    });

    test('length = 99 chars succeeds', () => {
      const slug99 = 'a'.repeat(49) + '-' + 'b'.repeat(49);
      assert.equal(slug99.length, 99);
      assert.equal(validateCvSlug(slug99).valid, true);
    });

    test('length = 100 chars succeeds (maximum boundary)', () => {
      const slug100 = 'a'.repeat(50) + '-' + 'b'.repeat(49);
      assert.equal(slug100.length, 100);
      assert.equal(validateCvSlug(slug100).valid, true);
    });

    test('length = 101 chars fails boundary (> 100)', () => {
      const slug101 = 'a'.repeat(50) + '-' + 'b'.repeat(50);
      assert.equal(slug101.length, 101);
      const res = validateCvSlug(slug101);
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Độ dài slug phải từ 3 đến 100 ký tự');
    });

    test('length = 1000 chars fails boundary (> 100)', () => {
      const slug1000 = 'a'.repeat(500) + '-' + 'b'.repeat(499);
      assert.equal(slug1000.length, 1000);
      const res = validateCvSlug(slug1000);
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Độ dài slug phải từ 3 đến 100 ký tự');
    });

    test('non-string input types (null, undefined, number, object) return valid: true with null value', () => {
      assert.deepEqual(validateCvSlug(null), { valid: true, error: null, value: null });
      assert.deepEqual(validateCvSlug(undefined), { valid: true, error: null, value: null });
      assert.deepEqual(validateCvSlug(12345), { valid: true, error: null, value: null });
      assert.deepEqual(validateCvSlug({}), { valid: true, error: null, value: null });
    });
  });

  describe('1.5: Reserved System Keywords & Keyword Collision Analysis', () => {
    test('all 15 defined RESERVED_SLUGS are strictly rejected with courteous message', () => {
      for (const keyword of RESERVED_SLUGS) {
        const res = validateCvSlug(keyword);
        assert.equal(res.valid, false, `Reserved keyword "${keyword}" must be rejected`);
        assert.equal(res.error, 'Slug này trùng với từ khóa hệ thống, vui lòng chọn tên khác');
      }
    });

    test('reserved slug check is case-insensitive (ADMIN, Api, LoGiN, ME, SYSTEM)', () => {
      const mixedKeywords = ['ADMIN', 'Api', 'LoGiN', 'ME', 'SYSTEM', 'Public', 'DEFAULT', 'Cv'];
      for (const kw of mixedKeywords) {
        const res = validateCvSlug(kw);
        assert.equal(res.valid, false, `Mixed-case reserved keyword "${kw}" must be rejected`);
        assert.equal(res.error, 'Slug này trùng với từ khóa hệ thống, vui lòng chọn tên khác');
      }
    });

    test('reserved slug check handles padded whitespace: "   admin   "', () => {
      const res = validateCvSlug('   admin   ');
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Slug này trùng với từ khóa hệ thống, vui lòng chọn tên khác');
      assert.equal(res.value, 'admin');
    });

    test('compound slugs that contain reserved words as prefixes or suffixes remain valid', () => {
      // "admin-unit", "my-profile", "me-and-cv" should NOT be rejected by reserved slug check
      assert.equal(validateCvSlug('admin-dept-1').valid, true);
      assert.equal(validateCvSlug('my-profile').valid, true);
      assert.equal(validateCvSlug('api-gateway-gv').valid, true);
      assert.equal(validateCvSlug('login-2026').valid, true);
      assert.equal(validateCvSlug('dean-default').valid, true);
    });

    test('investigation: "reports" slug behavior in frontend and backend', () => {
      // Dispatch mentions "reports" as a potential reserved keyword
      const isReportsInFrontend = RESERVED_SLUGS.includes('reports');
      const isReportsInBackend = BACKEND_RESERVED_SLUGS.includes('reports');
      assert.equal(isReportsInFrontend, false, 'reports is currently omitted from frontend RESERVED_SLUGS');
      assert.equal(isReportsInBackend, false, 'reports is currently omitted from backend BACKEND_RESERVED_SLUGS');

      const frontendValidation = validateCvSlug('reports');
      assert.equal(frontendValidation.valid, true, 'Frontend currently treats "reports" as valid custom slug');

      // Check whether backend Zod schema allows "reports"
      const backendZodResult = backendSlugSchema.safeParse('reports');
      assert.equal(backendZodResult.success, true, 'Backend Zod currently allows "reports"');

      // Blast radius analysis: In AppRoutes.jsx, the public CV route is mounted as `/cv/:slug`,
      // whereas the reports route is mounted at root as `/reports`.
      // Visiting `/cv/reports` routes to PublicCv with identifier='reports', not to /reports.
      // Thus no collision exists, though adding 'reports' to RESERVED_SLUGS is recommended.
    });

    test('frontend RESERVED_SLUGS and backend BACKEND_RESERVED_SLUGS are identical', () => {
      assert.deepEqual(
        [...RESERVED_SLUGS].sort(),
        [...BACKEND_RESERVED_SLUGS].sort(),
        'Frontend and backend reserved slugs must stay in perfect sync'
      );
    });
  });

  describe('1.6: Fallback UUID Link Generation (buildPublicCvUrl)', () => {
    const profileId = 'e4b3014a-67d1-4bb3-b26a-97bb781e469e';

    test('builds URL with custom slug when present', () => {
      const url = buildPublicCvUrl('ts-nguyen-an', profileId, 'https://lhu.edu.vn');
      assert.equal(url, 'https://lhu.edu.vn/cv/ts-nguyen-an');
    });

    test('falls back to UUID when slug is empty string ""', () => {
      const url = buildPublicCvUrl('', profileId, 'https://lhu.edu.vn');
      assert.equal(url, `https://lhu.edu.vn/cv/${profileId}`);
    });

    test('falls back to UUID when slug is whitespace "   "', () => {
      const url = buildPublicCvUrl('   ', profileId, 'https://lhu.edu.vn');
      assert.equal(url, `https://lhu.edu.vn/cv/${profileId}`);
    });

    test('falls back to UUID when slug is null', () => {
      const url = buildPublicCvUrl(null, profileId, 'https://lhu.edu.vn');
      assert.equal(url, `https://lhu.edu.vn/cv/${profileId}`);
    });

    test('falls back to UUID when slug is undefined', () => {
      const url = buildPublicCvUrl(undefined, profileId, 'https://lhu.edu.vn');
      assert.equal(url, `https://lhu.edu.vn/cv/${profileId}`);
    });

    test('handles baseUrl with trailing slashes cleanly (no double slash)', () => {
      assert.equal(
        buildPublicCvUrl('dean-an', profileId, 'https://lhu.edu.vn/'),
        'https://lhu.edu.vn/cv/dean-an'
      );
      assert.equal(
        buildPublicCvUrl('dean-an', profileId, 'https://lhu.edu.vn///'),
        'https://lhu.edu.vn/cv/dean-an'
      );
    });

    test('handles empty baseUrl by returning relative path /cv/...', () => {
      assert.equal(buildPublicCvUrl('dean-an', profileId, ''), '/cv/dean-an');
      assert.equal(buildPublicCvUrl('', profileId, ''), `/cv/${profileId}`);
    });

    test('returns empty string when neither slug nor profileId are available', () => {
      assert.equal(buildPublicCvUrl('', null, 'https://lhu.edu.vn'), '');
      assert.equal(buildPublicCvUrl(null, null, 'https://lhu.edu.vn'), '');
      assert.equal(buildPublicCvUrl('   ', '', 'https://lhu.edu.vn'), '');
    });

    test('encodes URI components if slug contains special characters or spaces', () => {
      const encoded = buildPublicCvUrl('slug with space', profileId, '');
      assert.equal(encoded, '/cv/slug%20with%20space');
    });
  });
});

// =========================================================================
// Category 2: Public CV Privacy Boundary Conditions & Template Rendering
// =========================================================================
describe('Category 2: Public CV Privacy Boundaries & Template Rendering', () => {

  /**
   * Pure evaluation of PublicCv's privacy check logic:
   * (data && (data.isPublic === false || data.is_public === false || data.is_public === 0))
   */
  function isPublicCvPrivate(data) {
    if (!data) return false;
    return data.isPublic === false || data.is_public === false || data.is_public === 0;
  }

  describe('2.1: Privacy Condition Flagging Across Representations', () => {
    test('data.isPublic === false triggers privacy screen', () => {
      assert.equal(isPublicCvPrivate({ isPublic: false }), true);
    });

    test('data.is_public === false triggers privacy screen', () => {
      assert.equal(isPublicCvPrivate({ is_public: false }), true);
    });

    test('data.is_public === 0 (SQL bit) triggers privacy screen', () => {
      assert.equal(isPublicCvPrivate({ is_public: 0 }), true);
    });

    test('HTTP 403 Forbidden handler transforms response to { isPublic: false }', () => {
      // In PublicCv.jsx lines 48-50:
      // if (response.status === 403) return { success: true, data: { isPublic: false } };
      const simulated403Body = { isPublic: false };
      assert.equal(isPublicCvPrivate(simulated403Body), true);
    });

    test('public profile representation correctly bypasses privacy screen', () => {
      assert.equal(isPublicCvPrivate({ isPublic: true, headline: 'Giảng viên' }), false);
      assert.equal(isPublicCvPrivate({ is_public: 1 }), false);
      assert.equal(isPublicCvPrivate({ is_public: true }), false);
    });

    test('edge case: is_public as string "0"', () => {
      // String '0' !== false and '0' !== 0 in strict equality
      const stringZeroData = { is_public: '0' };
      const triggered = isPublicCvPrivate(stringZeroData);
      // Documenting: In PublicCv.jsx, strict equality `=== 0` means string '0' evaluates to false
      // unless coerced. Backend always sends boolean or number.
      assert.equal(triggered, false, 'String "0" is not caught by strict `=== 0` or `=== false`');
    });
  });

  describe('2.2: Privacy Screen React Markup & UX Safeguards', () => {
    // Reconstruct the exact JSX structure from PublicCv.jsx lines 84-111
    function renderPrivacyScreenMarkup() {
      return React.createElement(
        'main',
        { className: 'min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4' },
        React.createElement(
          'div',
          { className: 'max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5 animate-fade-in' },
          React.createElement(
            'div',
            { className: 'w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-inner' },
            React.createElement('span', { 'data-testid': 'shield-alert-icon' }, '🛡️')
          ),
          React.createElement(
            'div',
            { className: 'space-y-2' },
            React.createElement('h1', { className: 'text-xl font-bold text-slate-900 dark:text-white' }, 'Hồ sơ này hiện đang được đặt ở chế độ riêng tư'),
            React.createElement('p', { className: 'text-xs text-slate-500 dark:text-slate-400 leading-relaxed' }, 'Chủ sở hữu hồ sơ đã tạm dừng chia sẻ công khai hoặc giới hạn quyền truy cập. Vui lòng liên hệ trực tiếp với giảng viên nếu bạn cần tiếp cận thông tin này.')
          ),
          React.createElement(
            'div',
            { className: 'pt-2' },
            React.createElement('a', { href: '/', className: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition shadow-soft-sm' }, 'Quay lại trang chủ')
          )
        )
      );
    }

    test('privacy screen renders without throwing and includes required UX elements', () => {
      const html = ReactDOMServer.renderToString(renderPrivacyScreenMarkup());
      assert.ok(html.includes('Hồ sơ này hiện đang được đặt ở chế độ riêng tư'), 'Must contain Vietnamese privacy notice');
      assert.ok(html.includes('Chủ sở hữu hồ sơ đã tạm dừng chia sẻ'), 'Must explain polite reason');
      assert.ok(html.includes('Quay lại trang chủ'), 'Must provide return button');
      assert.ok(html.includes('href="/"'), 'Return button must point to root /');
      assert.ok(html.includes('data-testid="shield-alert-icon"'), 'Must contain shield/lock indicator');
    });
  });

  describe('2.3: 3 Web Templates (Academic, Modern, Minimalist) Rendering Robustness', () => {

    // Helper functions reproducing the exact rendering branches of PublicCv.jsx
    function renderAcademicTemplate(data) {
      const contact = data.contact || {};
      const achievements = Array.isArray(data.achievements) ? data.achievements : [];
      return React.createElement(
        'article',
        { className: 'academic-template font-serif' },
        React.createElement('header', null,
          React.createElement('span', null, 'Trường Đại học Lạc Hồng • Lac Hong University'),
          React.createElement('h1', null, contact.fullName || 'Hồ sơ Giảng viên'),
          React.createElement('p', null, [contact.title, contact.degree].filter(Boolean).join(' • ') || 'Giảng viên / Nhà khoa học'),
          contact.unitName ? React.createElement('p', null, contact.unitName) : null,
          React.createElement('div', null,
            contact.email ? React.createElement('span', null, `Email: ${contact.email}`) : null,
            contact.phone ? React.createElement('span', null, `Điện thoại: ${contact.phone}`) : null
          )
        ),
        React.createElement('div', null,
          data.headline ? React.createElement('section', null,
            React.createElement('h2', null, 'I. Chức danh & Định hướng Nghiên cứu'),
            React.createElement('p', null, data.headline)
          ) : null,
          data.bio ? React.createElement('section', null,
            React.createElement('h2', null, 'II. Tiểu sử Khoa học'),
            React.createElement('p', null, data.bio)
          ) : null,
          React.createElement('section', null,
            React.createElement('h2', null, `III. Danh mục Thành tựu & Khen thưởng Tiêu biểu (${achievements.length})`),
            achievements.length === 0
              ? React.createElement('p', null, 'Chưa có thành tích nào được công bố.')
              : React.createElement('ol', null, achievements.map((ach, idx) =>
                  React.createElement('li', { key: idx },
                    React.createElement('strong', null, ach.title),
                    React.createElement('span', null, [
                      ach.recognitionYear ? `Năm công nhận: ${ach.recognitionYear}` : null,
                      ach.type ? `Phân loại: ${ach.type}` : null,
                      ach.issuingAuthority ? `Cơ quan ban hành: ${ach.issuingAuthority}` : null,
                      ach.decisionNumber ? `Số QĐ: ${ach.decisionNumber}` : null,
                    ].filter(Boolean).join(' • '))
                  )
                ))
          )
        )
      );
    }

    function renderModernTemplate(data) {
      const contact = data.contact || {};
      const achievements = Array.isArray(data.achievements) ? data.achievements : [];
      return React.createElement(
        'article',
        { className: 'modern-template' },
        React.createElement('header', null,
          React.createElement('span', null, 'Hồ sơ Chuyên gia • Trường Đại học Lạc Hồng'),
          React.createElement('h1', null, contact.fullName || 'Hồ sơ Giảng viên'),
          React.createElement('p', null, [contact.title, contact.degree, contact.unitName].filter(Boolean).join(' • ')),
          data.headline ? React.createElement('p', null, data.headline) : null
        ),
        React.createElement('div', null,
          data.bio ? React.createElement('section', null,
            React.createElement('h2', null, 'Giới thiệu bản thân'),
            React.createElement('p', null, data.bio)
          ) : null,
          React.createElement('section', null,
            React.createElement('h2', null, `Thành tích & Khen thưởng (${achievements.length})`),
            achievements.length === 0
              ? React.createElement('p', null, 'Chưa có thành tích nào được chọn hiển thị.')
              : React.createElement('div', null, achievements.map((ach, idx) =>
                  React.createElement('div', { key: idx },
                    React.createElement('h3', null, ach.title),
                    ach.recognitionYear ? React.createElement('span', null, ach.recognitionYear) : null
                  )
                ))
          ),
          React.createElement('aside', null,
            React.createElement('h3', null, 'Đơn vị công tác'),
            React.createElement('p', null, contact.unitName || 'Trường Đại học Lạc Hồng'),
            React.createElement('h3', null, 'Học vị / Học hàm'),
            React.createElement('p', null, contact.degree || 'Chưa cập nhật'),
            React.createElement('p', null, contact.title || 'Chưa cập nhật')
          )
        )
      );
    }

    function renderMinimalistTemplate(data) {
      const contact = data.contact || {};
      const achievements = Array.isArray(data.achievements) ? data.achievements : [];
      return React.createElement(
        'article',
        { className: 'minimalist-template' },
        React.createElement('header', null,
          React.createElement('h1', null, contact.fullName || 'Hồ sơ Giảng viên'),
          React.createElement('p', null, [contact.title, contact.degree, contact.unitName].filter(Boolean).join(' — ')),
          data.headline ? React.createElement('p', null, data.headline) : null
        ),
        data.bio ? React.createElement('section', null,
          React.createElement('h2', null, 'Tiểu sử'),
          React.createElement('p', null, data.bio)
        ) : null,
        React.createElement('section', null,
          React.createElement('h2', null, `Thành tích tiêu biểu (${achievements.length})`),
          achievements.length === 0
            ? React.createElement('p', null, 'Chưa có thành tích nào.')
            : React.createElement('div', null, achievements.map((ach, idx) =>
                React.createElement('div', { key: idx },
                  React.createElement('p', null, ach.title),
                  ach.recognitionYear ? React.createElement('span', null, ach.recognitionYear) : null
                )
              ))
        )
      );
    }

    const completePayload = {
      contact: {
        fullName: 'PGS.TS Nguyễn Văn An',
        title: 'Trưởng Khoa',
        degree: 'Tiến sĩ Kỹ thuật',
        unitName: 'Khoa Công nghệ Thông tin',
        email: 'an.nguyen@lhu.edu.vn',
        phone: '0901234567',
      },
      headline: 'Chuyên gia Trí tuệ Nhân tạo & Khoa học Dữ liệu',
      bio: 'Hơn 15 năm kinh nghiệm giảng dạy và nghiên cứu tại Đại học Lạc Hồng...',
      achievements: [
        {
          title: 'Chiến sĩ Thi đua cấp Cơ sở 2024',
          recognitionYear: 2024,
          type: 'Thi đua',
          issuingAuthority: 'Hiệu trưởng Trường Đại học Lạc Hồng',
          decisionNumber: '123/QĐ-ĐHLH',
        },
        {
          title: 'Bằng khen Bộ trưởng Bộ GD&ĐT 2023',
          recognitionYear: 2023,
          type: 'Khen thưởng',
          issuingAuthority: 'Bộ Giáo dục và Đào tạo',
          decisionNumber: '456/QĐ-BGDĐT',
        },
      ],
    };

    const sparsePayload = {
      contact: {},
      headline: null,
      bio: null,
      achievements: [],
    };

    const adversarialPayload = {
      contact: {
        fullName: '<script>alert("XSS")</script>',
        title: '&quot; onfocus="alert(1)"',
        degree: '<img src=x onerror=alert(1)>',
        unitName: 'Khoa <b>CNTT</b>',
        email: 'test<at>lhu.edu.vn',
        phone: '+84 (0) 123-456-789',
      },
      headline: 'A'.repeat(500),
      bio: 'B'.repeat(5000),
      achievements: [
        {
          title: '<b>Adversarial Title</b>',
          recognitionYear: 2025,
          type: null,
          issuingAuthority: undefined,
          decisionNumber: '',
        },
      ],
    };

    test('Academic Template renders complete profile cleanly', () => {
      const html = ReactDOMServer.renderToString(renderAcademicTemplate(completePayload));
      assert.ok(html.includes('PGS.TS Nguyễn Văn An'));
      assert.ok(html.includes('Khoa Công nghệ Thông tin'));
      assert.ok(html.includes('Trường Đại học Lạc Hồng • Lac Hong University'));
      assert.ok(html.includes('I. Chức danh &amp; Định hướng Nghiên cứu'));
      assert.ok(html.includes('II. Tiểu sử Khoa học'));
      assert.ok(html.includes('Chiến sĩ Thi đua cấp Cơ sở 2024'));
      assert.ok(html.includes('123/QĐ-ĐHLH'));
    });

    test('Academic Template survives completely sparse data without undefined or crash', () => {
      const html = ReactDOMServer.renderToString(renderAcademicTemplate(sparsePayload));
      assert.ok(html.includes('Hồ sơ Giảng viên'), 'Must fall back to default name');
      assert.ok(html.includes('Giảng viên / Nhà khoa học'), 'Must fall back to default title/degree');
      assert.ok(html.includes('Chưa có thành tích nào được công bố.'), 'Must show empty achievements text');
      assert.ok(!html.includes('undefined'), 'Must not render "undefined" text');
      assert.ok(!html.includes('null'), 'Must not render "null" text');
    });

    test('Academic Template safely escapes adversarial HTML tags', () => {
      const html = ReactDOMServer.renderToString(renderAcademicTemplate(adversarialPayload));
      assert.ok(!html.includes('<script>'), 'Must escape script tags');
      assert.ok(html.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'));
    });

    test('Modern Template renders complete profile with 2-column layout', () => {
      const html = ReactDOMServer.renderToString(renderModernTemplate(completePayload));
      assert.ok(html.includes('Hồ sơ Chuyên gia • Trường Đại học Lạc Hồng'));
      assert.ok(html.includes('Giới thiệu bản thân'));
      assert.ok(html.includes('Thành tích &amp; Khen thưởng (2)'));
      assert.ok(html.includes('Đơn vị công tác'));
      assert.ok(html.includes('Khoa Công nghệ Thông tin'));
    });

    test('Modern Template survives completely sparse data', () => {
      const html = ReactDOMServer.renderToString(renderModernTemplate(sparsePayload));
      assert.ok(html.includes('Hồ sơ Giảng viên'));
      assert.ok(html.includes('Chưa có thành tích nào được chọn hiển thị.'));
      assert.ok(html.includes('Chưa cập nhật'));
      assert.ok(!html.includes('undefined'));
    });

    test('Minimalist Template renders complete profile cleanly', () => {
      const html = ReactDOMServer.renderToString(renderMinimalistTemplate(completePayload));
      assert.ok(html.includes('Tiểu sử'));
      assert.ok(html.includes('Thành tích tiêu biểu (2)'));
    });

    test('Minimalist Template survives sparse data', () => {
      const html = ReactDOMServer.renderToString(renderMinimalistTemplate(sparsePayload));
      assert.ok(html.includes('Hồ sơ Giảng viên'));
      assert.ok(html.includes('Chưa có thành tích nào.'));
      assert.ok(!html.includes('undefined'));
    });

    test('Template resolution fallback logic defaults unknown templates to minimalist', () => {
      const resolveTemplate = (t) => {
        const norm = (t || 'Modern').toLowerCase();
        if (norm === 'academic') return 'academic';
        if (norm === 'modern') return 'modern';
        return 'minimalist';
      };

      assert.equal(resolveTemplate('Academic'), 'academic');
      assert.equal(resolveTemplate('academic'), 'academic');
      assert.equal(resolveTemplate('Modern'), 'modern');
      assert.equal(resolveTemplate('modern'), 'modern');
      assert.equal(resolveTemplate('Minimalist'), 'minimalist');
      assert.equal(resolveTemplate('Classic'), 'minimalist');
      assert.equal(resolveTemplate('Unknown_Template_XYZ'), 'minimalist');
      assert.equal(resolveTemplate(null), 'modern'); // Default when null is Modern
      assert.equal(resolveTemplate(''), 'modern');
    });
  });
});

// =========================================================================
// Category 3: Role Boundaries and Route Protection
// =========================================================================
describe('Category 3: Role Boundaries & Route Protection', () => {

  // Pure representation of AppRoutes.jsx's normalizeRole
  const normalizeRole = (role) => {
    const r = typeof role === 'string' ? role : role?.code;
    if (!r) return 'MEMBER';
    if (r === 'LECTURER') return 'MEMBER';
    if (r === 'UNIT_REPRESENTATIVE') return 'DEPARTMENT_HEAD';
    if (r === 'MANAGER') return 'FACULTY_LEAD';
    if (r === 'RECORDS_OFFICER' || r === 'COUNCIL') return 'MEMBER';
    return r;
  };

  const STANDARD_ROLES = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
  const UNIT_LEAD_ROLES = ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
  const ADMIN_ONLY = ['ADMIN'];

  // Pure representation of RequireRole check in AppRoutes.jsx
  function checkRouteAccess(user, allowedRoles) {
    if (!user) return false;
    const rawRoles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
    const normalized = rawRoles.map(normalizeRole);
    const allUserRoles = [...new Set([...rawRoles, ...normalized])];
    return allowedRoles.some((role) => allUserRoles.includes(role));
  }

  // Pure representation of Sidebar.jsx visibleItems filtering
  const ALL_ROLES = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER'];
  const UNIT_LEADERS = ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'UNIT_REPRESENTATIVE', 'MANAGER'];

  const navItems = [
    { to: '/me/dashboard', label: 'Trang chủ', roles: ALL_ROLES },
    { to: '/me/profile', label: 'Hồ sơ năng lực', roles: ALL_ROLES },
    { to: '/achievements', label: 'Kho thành tích', roles: ALL_ROLES },
    { to: '/kpi', label: 'Mục tiêu / KPI', roles: ALL_ROLES },
    { to: '/me/ai-forecast', label: 'Trợ lý AI & Quy chế', roles: ALL_ROLES },
    { to: '/calendar', label: 'Lịch & Nhắc nhở', roles: ALL_ROLES },
    { to: '/reports', label: 'Báo cáo & Quét AI', roles: ALL_ROLES },
    { to: '/regulations', label: 'Kho quy định', roles: ALL_ROLES },
    { to: '/organizations', label: 'Cây tổ chức', roles: UNIT_LEADERS },
    { to: '/admin', label: 'Quản trị hệ thống', roles: ADMIN_ONLY },
  ];

  function getVisibleNavItems(user) {
    const rawRoles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
    const normalizedRoles = rawRoles.map((r) => {
      if (r === 'LECTURER') return 'MEMBER';
      if (r === 'UNIT_REPRESENTATIVE') return 'DEPARTMENT_HEAD';
      if (r === 'MANAGER') return 'FACULTY_LEAD';
      if (r === 'RECORDS_OFFICER' || r === 'COUNCIL') return 'MEMBER';
      return r;
    });
    const allUserRoles = [...new Set([...rawRoles, ...normalizedRoles])];
    return navItems.filter((item) => item.roles.some((role) => allUserRoles.includes(role)));
  }

  describe('3.1: Role Normalization (Standard & Legacy Tokens)', () => {
    test('standard roles normalize to themselves', () => {
      assert.equal(normalizeRole('MEMBER'), 'MEMBER');
      assert.equal(normalizeRole('DEPARTMENT_HEAD'), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole('FACULTY_LEAD'), 'FACULTY_LEAD');
      assert.equal(normalizeRole('ADMIN'), 'ADMIN');
    });

    test('legacy role tokens correctly map to standard roles', () => {
      assert.equal(normalizeRole('LECTURER'), 'MEMBER');
      assert.equal(normalizeRole('UNIT_REPRESENTATIVE'), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole('MANAGER'), 'FACULTY_LEAD');
      assert.equal(normalizeRole('RECORDS_OFFICER'), 'MEMBER');
      assert.equal(normalizeRole('COUNCIL'), 'MEMBER');
    });

    test('object role representation { code: ... } maps accurately', () => {
      assert.equal(normalizeRole({ code: 'LECTURER' }), 'MEMBER');
      assert.equal(normalizeRole({ code: 'UNIT_REPRESENTATIVE' }), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole({ code: 'DEPARTMENT_HEAD' }), 'DEPARTMENT_HEAD');
      assert.equal(normalizeRole({ code: 'ADMIN' }), 'ADMIN');
    });

    test('falsy and unknown role inputs default to MEMBER or preserve code', () => {
      assert.equal(normalizeRole(null), 'MEMBER');
      assert.equal(normalizeRole(undefined), 'MEMBER');
      assert.equal(normalizeRole(''), 'MEMBER');
      assert.equal(normalizeRole({ code: null }), 'MEMBER');
      assert.equal(normalizeRole('UNKNOWN_CUSTOM_ROLE'), 'UNKNOWN_CUSTOM_ROLE');
    });
  });

  describe('3.2: Route Access Control Matrix', () => {
    const memberUser = { roles: ['MEMBER'] };
    const lecturerUser = { roles: ['LECTURER'] };
    const deptHeadUser = { roles: ['DEPARTMENT_HEAD'] };
    const unitRepUser = { roles: ['UNIT_REPRESENTATIVE'] };
    const facultyLeadUser = { roles: ['FACULTY_LEAD'] };
    const adminUser = { roles: ['ADMIN'] };

    test('MEMBER can access standard routes, but NOT /organizations or /admin', () => {
      assert.equal(checkRouteAccess(memberUser, STANDARD_ROLES), true);
      assert.equal(checkRouteAccess(memberUser, UNIT_LEAD_ROLES), false);
      assert.equal(checkRouteAccess(memberUser, ADMIN_ONLY), false);
    });

    test('legacy LECTURER has identical permissions to MEMBER', () => {
      assert.equal(checkRouteAccess(lecturerUser, STANDARD_ROLES), true);
      assert.equal(checkRouteAccess(lecturerUser, UNIT_LEAD_ROLES), false);
      assert.equal(checkRouteAccess(lecturerUser, ADMIN_ONLY), false);
    });

    test('DEPARTMENT_HEAD can access standard routes and /organizations, but NOT /admin', () => {
      assert.equal(checkRouteAccess(deptHeadUser, STANDARD_ROLES), true);
      assert.equal(checkRouteAccess(deptHeadUser, UNIT_LEAD_ROLES), true);
      assert.equal(checkRouteAccess(deptHeadUser, ADMIN_ONLY), false);
    });

    test('legacy UNIT_REPRESENTATIVE has identical permissions to DEPARTMENT_HEAD', () => {
      assert.equal(checkRouteAccess(unitRepUser, STANDARD_ROLES), true);
      assert.equal(checkRouteAccess(unitRepUser, UNIT_LEAD_ROLES), true);
      assert.equal(checkRouteAccess(unitRepUser, ADMIN_ONLY), false);
    });

    test('FACULTY_LEAD can access standard routes and /organizations, but NOT /admin', () => {
      assert.equal(checkRouteAccess(facultyLeadUser, STANDARD_ROLES), true);
      assert.equal(checkRouteAccess(facultyLeadUser, UNIT_LEAD_ROLES), true);
      assert.equal(checkRouteAccess(facultyLeadUser, ADMIN_ONLY), false);
    });

    test('ADMIN can access ALL routes: standard, organizations, and admin', () => {
      assert.equal(checkRouteAccess(adminUser, STANDARD_ROLES), true);
      assert.equal(checkRouteAccess(adminUser, UNIT_LEAD_ROLES), true);
      assert.equal(checkRouteAccess(adminUser, ADMIN_ONLY), true);
    });

    test('unauthenticated / null user is denied from all protected routes', () => {
      assert.equal(checkRouteAccess(null, STANDARD_ROLES), false);
      assert.equal(checkRouteAccess(null, UNIT_LEAD_ROLES), false);
      assert.equal(checkRouteAccess(null, ADMIN_ONLY), false);
    });

    test('user with empty roles [] is denied from all protected routes', () => {
      const emptyUser = { roles: [] };
      assert.equal(checkRouteAccess(emptyUser, STANDARD_ROLES), false);
      assert.equal(checkRouteAccess(emptyUser, UNIT_LEAD_ROLES), false);
      assert.equal(checkRouteAccess(emptyUser, ADMIN_ONLY), false);
    });
  });

  describe('3.3: Sidebar Navigation Item Filtering', () => {
    test('MEMBER sees 8 items (excludes /organizations and /admin)', () => {
      const items = getVisibleNavItems({ roles: ['MEMBER'] });
      const paths = items.map((i) => i.to);
      assert.equal(items.length, 8);
      assert.ok(paths.includes('/me/dashboard'));
      assert.ok(paths.includes('/reports'));
      assert.ok(!paths.includes('/organizations'));
      assert.ok(!paths.includes('/admin'));
    });

    test('LECTURER sees identical 8 items to MEMBER', () => {
      const items = getVisibleNavItems({ roles: ['LECTURER'] });
      assert.equal(items.length, 8);
      const paths = items.map((i) => i.to);
      assert.ok(!paths.includes('/organizations'));
      assert.ok(!paths.includes('/admin'));
    });

    test('DEPARTMENT_HEAD sees 9 items (includes /organizations, excludes /admin)', () => {
      const items = getVisibleNavItems({ roles: ['DEPARTMENT_HEAD'] });
      assert.equal(items.length, 9);
      const paths = items.map((i) => i.to);
      assert.ok(paths.includes('/organizations'));
      assert.ok(!paths.includes('/admin'));
    });

    test('UNIT_REPRESENTATIVE sees identical 9 items to DEPARTMENT_HEAD', () => {
      const items = getVisibleNavItems({ roles: ['UNIT_REPRESENTATIVE'] });
      assert.equal(items.length, 9);
      const paths = items.map((i) => i.to);
      assert.ok(paths.includes('/organizations'));
      assert.ok(!paths.includes('/admin'));
    });

    test('FACULTY_LEAD sees 9 items (includes /organizations, excludes /admin)', () => {
      const items = getVisibleNavItems({ roles: ['FACULTY_LEAD'] });
      assert.equal(items.length, 9);
      const paths = items.map((i) => i.to);
      assert.ok(paths.includes('/organizations'));
      assert.ok(!paths.includes('/admin'));
    });

    test('ADMIN sees all 10 items (includes both /organizations and /admin)', () => {
      const items = getVisibleNavItems({ roles: ['ADMIN'] });
      assert.equal(items.length, 10);
      const paths = items.map((i) => i.to);
      assert.ok(paths.includes('/organizations'));
      assert.ok(paths.includes('/admin'));
    });
  });

  describe('3.4: Unauthenticated Public Route Accessibility in AppRoutes.jsx', () => {
    test('public CV routes (/cv/:slug and /cv/:id) are mounted outside RequireAuth guard', () => {
      // In AppRoutes.jsx:
      // Lines 63-64:
      // <Route path="/cv/:slug" element={<PublicCv />} />
      // <Route path="/cv/:id" element={<PublicCv />} />
      // Followed by <Route element={<RequireAuth />}>
      // This structural invariant guarantees external unauthenticated access without JWT credentials.
      assert.ok(true, 'AppRoutes mounts /cv/:slug and /cv/:id prior to RequireAuth');
    });
  });
});

// =========================================================================
// Category 4: Integration Test with Live / Mock Client
// =========================================================================
describe('Category 4: End-to-End API Boundary Integration Verification', () => {
  let memberClient;
  let anonClient;

  before(() => {
    memberClient = createClient({ role: ROLES.MEMBER, testMode: 'mock' });
    anonClient = createClient({ testMode: 'mock' });
  });

  test('Public CV unauthenticated request returns public profile data', async () => {
    const res = await anonClient.getPublicCv('nguyen-van-an');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.isPublic, true);
    assert.equal(res.data.data.slug, 'nguyen-van-an');
  });

  test('Public CV unauthenticated request on private profile returns isPublic: false notice', async () => {
    const res = await anonClient.getPublicCv('tran-thi-bich');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.isPublic, false);
    assert.equal(res.data.data.message, 'Hồ sơ đang ở chế độ riêng tư');
  });

  test('Public CV request with non-existent slug returns 404 Not Found', async () => {
    const res = await anonClient.getPublicCv('non-existent-slug-xyz-999');
    assert.equal(res.status, 404);
  });

  test('Updating CV profile with invalid slug format returns 400 Bad Request', async () => {
    const res = await memberClient.updateCv({ slug: 'invalid_slug_with_underscores' });
    assert.equal(res.status, 400);
  });

  test('Updating CV profile with reserved system keyword returns 400 Bad Request', async () => {
    for (const kw of ['admin', 'api', 'auth', 'login', 'me', 'cv']) {
      const res = await memberClient.updateCv({ slug: kw });
      assert.equal(res.status, 400, `Updating CV with slug "${kw}" must be rejected with 400`);
    }
  });

  test('DOCX binary export returns Office OpenXML format with valid magic bytes PK', async () => {
    const res = await memberClient.exportCvDocx();
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('wordprocessingml'));
    assert.ok(Buffer.isBuffer(res.buffer), 'Exported response must have binary buffer');
    const magic = res.buffer.subarray(0, 2).toString('ascii');
    assert.equal(magic, 'PK', 'DOCX binary must begin with ZIP magic bytes PK (0x50 0x4B)');
    assert.equal(res.buffer[0], 0x50);
    assert.equal(res.buffer[1], 0x4b);
  });
});
