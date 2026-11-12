// Older multipart uploads stored UTF-8 bytes as Latin-1 characters.
// Decode only a lossless, valid UTF-8 round trip; preserve normal Unicode names.
export function normalizeFileName(value) {
  if (typeof value !== 'string' || !/[\u00c2\u00c3\u00e1\u00e2\u00e4]/u.test(value)) return value;
  if ([...value].some(char => char.codePointAt(0) > 255)) return value;
  try {
    const bytes = Uint8Array.from(value, char => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}
