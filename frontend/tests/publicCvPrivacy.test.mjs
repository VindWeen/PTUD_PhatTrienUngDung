import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Logic helper under test: checks if a Public CV payload indicates a private profile.
 */
function isProfilePrivate(data) {
  if (!data) return false;
  if (data.isPublic === false) return true;
  if (data.is_public === false || data.is_public === 0 || data.is_public === '0') return true;
  return false;
}

/**
 * Template normalizer: returns 'academic', 'modern', or 'minimalist'.
 */
function resolveTemplateName(templateId) {
  const norm = (templateId || '').toLowerCase().trim();
  if (norm === 'academic') return 'academic';
  if (norm === 'modern') return 'modern';
  return 'minimalist';
}

/**
 * Route parameter resolver: supports /cv/:slug and /cv/:id.
 */
function resolveRouteIdentifier(params) {
  return params?.slug || params?.id || null;
}

test('isProfilePrivate correctly flags private profiles across multiple representations', () => {
  // Backend response when is_public = 0: { isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }
  assert.equal(isProfilePrivate({ isPublic: false }), true);
  assert.equal(isProfilePrivate({ is_public: 0 }), true);
  assert.equal(isProfilePrivate({ is_public: false }), true);
  assert.equal(isProfilePrivate({ is_public: '0' }), true);
  assert.equal(isProfilePrivate({ isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' }), true);
});

test('isProfilePrivate correctly identifies public profiles', () => {
  assert.equal(isProfilePrivate({ isPublic: true, headline: 'Giảng viên' }), false);
  assert.equal(isProfilePrivate({ is_public: 1 }), false);
  assert.equal(isProfilePrivate({ is_public: true }), false);
});

test('HTTP 403 Forbidden translates gracefully to private profile state', async () => {
  // Simulate mock fetch response for 403
  const mock403Response = {
    status: 403,
    ok: false,
    json: async () => ({ success: false, message: 'Hồ sơ đang ở chế độ riêng tư' }),
  };

  const handleResponse = async (res) => {
    if (res.status === 404) throw new Error('CV không tồn tại hoặc đã ngừng chia sẻ.');
    if (res.status === 403) return { isPublic: false, message: 'Hồ sơ đang ở chế độ riêng tư' };
    return res.json();
  };

  const parsed = await handleResponse(mock403Response);
  assert.equal(parsed.isPublic, false);
  assert.equal(isProfilePrivate(parsed), true);
});

test('template resolver maps all 3 supported templates accurately', () => {
  assert.equal(resolveTemplateName('Academic'), 'academic');
  assert.equal(resolveTemplateName('academic'), 'academic');

  assert.equal(resolveTemplateName('Modern'), 'modern');
  assert.equal(resolveTemplateName('modern'), 'modern');

  assert.equal(resolveTemplateName('Minimalist'), 'minimalist');
  assert.equal(resolveTemplateName('minimalist'), 'minimalist');
  assert.equal(resolveTemplateName('classic'), 'minimalist'); // Fallback
  assert.equal(resolveTemplateName(null), 'minimalist'); // Default
});

test('route identifier correctly falls back from slug to id parameter', () => {
  assert.equal(resolveRouteIdentifier({ slug: 'ts-nguyen-an' }), 'ts-nguyen-an');
  assert.equal(resolveRouteIdentifier({ id: 'd83b5443-bf80-4cf9-b593-c46b539bbfa2' }), 'd83b5443-bf80-4cf9-b593-c46b539bbfa2');
  assert.equal(resolveRouteIdentifier({ slug: 'ts-an', id: 'uuid-123' }), 'ts-an'); // slug takes precedence
  assert.equal(resolveRouteIdentifier({}), null);
});
