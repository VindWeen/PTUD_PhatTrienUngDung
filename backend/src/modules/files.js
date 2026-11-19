import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import multer from 'multer';
import PizZip from 'pizzip';
import config from '../config/env.js';
import { ValidationError } from '../utils/errors.js';

const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
const configured = config.STORAGE_DIR || 'storage/private/evidences';
export const storageRoot = path.isAbsolute(configured) ? path.resolve(configured) : path.resolve(backendRoot, configured);
const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_FILE_SIZE_BYTES, files: 1 } }).single('file');
export function upload(req, res, next) {
  uploader(req, res, error => error ? next(new ValidationError(error.code === 'LIMIT_FILE_SIZE' ? 'Tệp vượt quá dung lượng cho phép.' : 'Tệp tải lên không hợp lệ.')) : next());
}
export function filePath(key) {
  if (!/^[a-f0-9-]+\.(pdf|png|jpg|jpeg|docx)$/.test(key)) throw new ValidationError('Khóa tệp không hợp lệ.');
  return path.join(storageRoot, key);
}
export function validateFile(file) {
  if (!file?.buffer?.length) throw new ValidationError('Vui lòng chọn tệp minh chứng.');
  const name = path.basename(String(file.originalname).replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 260);
  const ext = path.extname(name).toLowerCase();
  const b = file.buffer;
  const match = {
    '.pdf': ['application/pdf', b.subarray(0, 5).toString() === '%PDF-'],
    '.png': ['image/png', b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))],
    '.jpg': ['image/jpeg', b.subarray(0, 3).equals(Buffer.from([255,216,255]))],
    '.jpeg': ['image/jpeg', b.subarray(0, 3).equals(Buffer.from([255,216,255]))],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', false],
  };
  if (ext === '.docx') {
    try { const zip = new PizZip(b); match[ext][1] = Boolean(zip.file('[Content_Types].xml') && zip.file('word/document.xml')); } catch { /* Invalid ZIP. */ }
  }
  if (!match[ext]?.[1]) throw new ValidationError('Chỉ nhận PDF, PNG, JPG hoặc DOCX có nội dung hợp lệ.');
  return { name, mime: match[ext][0], size: b.length, hash: createHash('sha256').update(b).digest(), key: `${randomUUID()}${ext}` };
}
export async function writeFile(file) {
  const metadata = validateFile(file);
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(filePath(metadata.key), file.buffer, { flag: 'wx' });
  return metadata;
}
export async function discardFile(key) { await fs.unlink(filePath(key)).catch(() => {}); }
