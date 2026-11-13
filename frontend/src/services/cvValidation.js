export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SLUGS = [
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

export function validateCvSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return { valid: true, error: null, value: null };
  }
  const cleaned = slug.trim().toLowerCase();
  if (RESERVED_SLUGS.includes(cleaned)) {
    return { valid: false, error: 'Slug này trùng với từ khóa hệ thống, vui lòng chọn tên khác', value: cleaned };
  }
  if (cleaned.length < 3 || cleaned.length > 100) {
    return { valid: false, error: 'Độ dài slug phải từ 3 đến 100 ký tự', value: cleaned };
  }
  if (!SLUG_REGEX.test(cleaned)) {
    return { valid: false, error: 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang (-)', value: cleaned };
  }
  return { valid: true, error: null, value: cleaned };
}

export function buildPublicCvUrl(slug, profileId, baseUrl = '') {
  const identifier = slug?.trim() || profileId;
  if (!identifier) return '';
  const prefix = baseUrl ? `${baseUrl.replace(/\/+$/, '')}` : '';
  return `${prefix}/cv/${encodeURIComponent(identifier)}`;
}
