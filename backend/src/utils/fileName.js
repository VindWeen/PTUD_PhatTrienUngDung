// Multer may expose UTF-8 multipart filenames decoded as Latin-1.
export function normalizeFileName(value) {
  if (typeof value !== 'string' || !/[\u00c2\u00c3\u00e1\u00e2\u00e4]/u.test(value)) return value;
  if ([...value].some(char => char.codePointAt(0) > 255)) return value;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(value, 'latin1'));
  } catch {
    return value;
  }
}
