import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLUG_REGEX,
  RESERVED_SLUGS,
  validateCvSlug,
  buildPublicCvUrl,
} from '../src/services/cvValidation.js';

test('valid custom slugs pass validation', () => {
  const validSlugs = [
    'nguyen-van-a',
    'ts-le-thi-hoa',
    'gv123',
    'le-van-tam-1985',
    'khoa-cntt-truong-khoa',
    'dean-2026',
    'prof-smith',
  ];

  for (const s of validSlugs) {
    const res = validateCvSlug(s);
    assert.equal(res.valid, true, `Expected "${s}" to be valid`);
    assert.equal(res.error, null);
    assert.equal(res.value, s);
  }
});

test('slug length boundaries: min 3, max 100 characters', () => {
  // Too short (< 3)
  assert.equal(validateCvSlug('a').valid, false);
  assert.equal(validateCvSlug('ab').valid, false);

  // Exact bounds (3 chars and 100 chars)
  assert.equal(validateCvSlug('abc').valid, true);
  const hundredChars = 'a'.repeat(50) + '-' + 'b'.repeat(49);
  assert.equal(hundredChars.length, 100);
  assert.equal(validateCvSlug(hundredChars).valid, true);

  // Too long (> 100)
  const hundredOneChars = 'a'.repeat(50) + '-' + 'b'.repeat(50);
  assert.equal(hundredOneChars.length, 101);
  assert.equal(validateCvSlug(hundredOneChars).valid, false);
});

test('slug syntax rules: no uppercase, no spaces, no special chars, no double hyphens', () => {
  // Invalid characters
  assert.equal(validateCvSlug('Nguyen-Van-A').valid, true); // normalized to lowercase
  assert.equal(validateCvSlug('nguyen van a').valid, false); // spaces
  assert.equal(validateCvSlug('nguyen_van_a').valid, false); // underscore
  assert.equal(validateCvSlug('nguyen.van.a').valid, false); // dot
  assert.equal(validateCvSlug('nguyen@lhu').valid, false); // @
  assert.equal(validateCvSlug('nguyen#1').valid, false); // #

  // Hyphen placements
  assert.equal(validateCvSlug('-nguyen-van-a').valid, false); // leading hyphen
  assert.equal(validateCvSlug('nguyen-van-a-').valid, false); // trailing hyphen
  assert.equal(validateCvSlug('nguyen--van-a').valid, false); // consecutive hyphens
});

test('reserved system slugs are strictly rejected', () => {
  const reserved = [
    'admin',
    'api',
    'auth',
    'system',
    'login',
    'settings',
    'help',
    'root',
    'me',
    'public',
    'export-docx',
    'download',
    'cv',
    'profile',
    'default',
  ];

  for (const word of reserved) {
    const res = validateCvSlug(word);
    assert.equal(res.valid, false, `Expected reserved slug "${word}" to be rejected`);
    assert.match(res.error, /từ khóa hệ thống/);
  }
});

test('empty slug gracefully falls back to profile UUID link', () => {
  const profileId = 'd83b5443-bf80-4cf9-b593-c46b539bbfa2';
  const baseUrl = 'https://lhu.edu.vn';

  // When slug is provided:
  const withSlug = buildPublicCvUrl('nguyen-van-an', profileId, baseUrl);
  assert.equal(withSlug, 'https://lhu.edu.vn/cv/nguyen-van-an');

  // When slug is empty or null:
  const withEmptySlug = buildPublicCvUrl('', profileId, baseUrl);
  assert.equal(withEmptySlug, `https://lhu.edu.vn/cv/${profileId}`);

  const withNullSlug = buildPublicCvUrl(null, profileId, baseUrl);
  assert.equal(withNullSlug, `https://lhu.edu.vn/cv/${profileId}`);

  const withWhitespaceSlug = buildPublicCvUrl('   ', profileId, baseUrl);
  assert.equal(withWhitespaceSlug, `https://lhu.edu.vn/cv/${profileId}`);
});
