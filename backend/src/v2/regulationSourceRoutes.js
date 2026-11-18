import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { authenticate } from './access.js';
import { authorizeRegulation, canReadVersion } from './regulationAccess.js';
import { query, withTransaction, one, id, route, ok, body } from './shared.js';
import { ForbiddenError, ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { MAX_SOURCE_BYTES, MAX_TEXT_CHARS, saveSource, discardSource, sourcePath, extractSourceText, proposeSourceCriteria } from './regulationSources.js';

const router = Router();
router.use(authenticate);
const multipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SOURCE_BYTES, files: 1, fields: 5, fieldSize: 4096 } }).single('file');
const upload = (req, res, next) => multipart(req, res, error => error ? next(new ValidationError(error.code === 'LIMIT_FILE_SIZE' ? 'Tệp nguồn vượt giới hạn 20 MB.' : 'Chỉ tải một tệp PDF/Word hợp lệ.')) : next());
async function editable(userId, versionId, db) {
  const version = await one('SELECT * FROM app.regulation_versions WITH(UPDLOCK,HOLDLOCK) WHERE id=$1', [versionId], db);
  await authorizeRegulation(userId, version.regulation_id, db);
  if (version.publication_status !== 'DRAFT') throw new ValidationError('Nguồn và kiểm tra AI chỉ được sửa ở phiên bản nháp.');
  return version;
}
async function readable(userId, versionId) { if (!await canReadVersion(userId, versionId)) throw new ForbiddenError(); }
const sourceView = f => ({ id: f.id, regulationVersionId: f.regulation_version_id, originalFilename: f.original_filename, mimeType: f.mime_type, byteSize: f.byte_size, sha256: Buffer.from(f.sha256).toString('hex'), sourceUrl: f.source_url, collectedAt: f.collected_at, issuingAuthority: f.issuing_authority, isDemo: Boolean(f.is_demo), extractionStatus: f.extraction_status, extractionMethod: f.extraction_method, extractionError: f.extraction_error, extractedText: f.extracted_text, createdAt: f.created_at });
const source = versionId => one('SELECT * FROM app.regulation_source_files WHERE regulation_version_id=$1', [versionId]);
async function readSource(file) {
  let bytes;
  try { bytes = await fs.readFile(sourcePath(file.storage_key)); } catch (error) { if (error.code === 'ENOENT') throw new NotFoundError('Tệp nguồn không còn trên kho lưu trữ.'); throw error; }
  if (bytes.length !== Number(file.byte_size) || !createHash('sha256').update(bytes).digest().equals(Buffer.from(file.sha256))) throw new ConflictError('Tệp nguồn sai mã toàn vẹn; cần khôi phục hoặc tải lại.');
  return bytes;
}
const base = '/regulations/versions/:id/source';
router.get(base, route(async (req, res) => { const key = id(req.params.id); await readable(req.user.userId, key); res.set('Cache-Control', 'no-store'); ok(res, sourceView(await source(key))); }));
router.post(base, route(async (req, res, next) => {
  await withTransaction(async ({ query: db }) => editable(req.user.userId, id(req.params.id), db)); next();
}), upload, route(async (req, res) => {
  const key = id(req.params.id);
  const metadata = body(z.object({ sourceUrl: z.string().url().max(2000).refine(value => /^https?:\/\//i.test(value)).optional(), collectedAt: z.string().datetime({ offset: true }).optional(), issuingAuthority: z.string().trim().min(1).max(300).optional(), isDemo: z.enum(['true','false']).optional() }).strict(), req);
  const saved = await saveSource(req.file); let oldKey;
  try {
    await withTransaction(async ({ query: db }) => {
      await editable(req.user.userId, key, db);
      const old = (await db('SELECT storage_key FROM app.regulation_source_files WHERE regulation_version_id=$1', [key])).rows[0];
      oldKey = old?.storage_key;
      await db('DELETE app.regulation_source_files WHERE regulation_version_id=$1', [key]);
      await db(`INSERT app.regulation_source_files(regulation_version_id,owner_user_id,storage_key,original_filename,mime_type,byte_size,sha256,source_url,collected_at,issuing_authority,is_demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [key, req.user.userId, saved.key, saved.name, saved.mime, saved.size, saved.hash, metadata.sourceUrl || null, metadata.collectedAt || null, metadata.issuingAuthority || null, metadata.isDemo === 'true' ? 1 : 0]);
      await db('UPDATE app.regulation_versions SET source_kind=$2,issuing_authority=$3,collected_at=$4,ai_reviewed_at=NULL,ai_reviewed_by_user_id=NULL WHERE id=$1', [key, metadata.isDemo === 'true' ? 'DEMO' : 'OFFICIAL', metadata.issuingAuthority || null, metadata.collectedAt || null]);
    });
  } catch (error) { await discardSource(saved.key); throw error; }
  if (oldKey) await discardSource(oldKey);
  ok(res, sourceView(await source(key)), 201);
}));
router.get(`${base}/download`, route(async (req, res) => {
  const key = id(req.params.id); await readable(req.user.userId, key);
  const file = await source(key), bytes = await readSource(file);
  res.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff').attachment(file.original_filename).type(file.mime_type).send(bytes);
}));
router.post(`${base}/extract`, route(async (req, res) => {
  const key = id(req.params.id);
  await withTransaction(async ({ query: db }) => editable(req.user.userId, key, db));
  const file = await source(key); let text, failure;
  try { text = await extractSourceText(await readSource(file), file.mime_type); }
  catch (error) { failure = error instanceof ValidationError || error instanceof ConflictError || error instanceof NotFoundError ? error.message : 'Không đọc được tệp nguồn; kiểm tra tệp hoặc nhập thủ công.'; }
  await withTransaction(async ({ query: db }) => {
    await editable(req.user.userId, key, db);
    const current = await one('SELECT id FROM app.regulation_source_files WHERE regulation_version_id=$1', [key], db);
    if (Number(current.id) !== Number(file.id)) throw new ConflictError('Nguồn đã thay đổi; hãy trích xuất lại.');
    await db("UPDATE app.regulation_source_files SET extracted_text=$2,extraction_status=$3,extraction_error=$4,extraction_method='AUTO' WHERE id=$1", [file.id, text || null, failure ? 'FAILED' : 'EXTRACTED', failure || null]);
    await db('UPDATE app.regulation_versions SET ai_reviewed_at=NULL,ai_reviewed_by_user_id=NULL WHERE id=$1', [key]);
  });
  if (failure) throw new ValidationError(failure);
  ok(res, sourceView(await source(key)));
}));
router.patch(`${base}/text`, route(async (req, res) => {
  const key = id(req.params.id);
  const data = body(z.object({ text: z.string().trim().min(1).max(MAX_TEXT_CHARS).refine(value => !value.includes('\u0000'), 'Văn bản không được chứa ký tự NUL.'), confirmed: z.literal(true) }).strict(), req);
  await withTransaction(async ({ query: db }) => {
    await editable(req.user.userId, key, db);
    const file = await one('SELECT id FROM app.regulation_source_files WHERE regulation_version_id=$1', [key], db);
    await db("UPDATE app.regulation_source_files SET extracted_text=$2,extraction_status='EXTRACTED',extraction_method='MANUAL',extraction_error=NULL WHERE id=$1", [file.id, data.text]);
    await db('UPDATE app.regulation_versions SET ai_reviewed_at=NULL,ai_reviewed_by_user_id=NULL WHERE id=$1', [key]);
  });
  ok(res, sourceView(await source(key)));
}));
router.post(`${base}/ai-propose`, route(async (req, res) => {
  const key = id(req.params.id);
  await withTransaction(async ({ query: db }) => editable(req.user.userId, key, db));
  const file = await source(key);
  if (file.extraction_status !== 'EXTRACTED') throw new ValidationError('Cần trích xuất thành công văn bản trước khi dùng AI.');
  const result = await proposeSourceCriteria(file.extracted_text);
  // Suggestions never create or modify criteria, applicability or publication.
  await withTransaction(async ({ query: db }) => {
    await editable(req.user.userId, key, db);
    const current = await one('SELECT id FROM app.regulation_source_files WHERE regulation_version_id=$1', [key], db);
    if (Number(current.id) !== Number(file.id)) throw new ConflictError('Nguồn đã thay đổi; hãy đề xuất lại.');
    await db('UPDATE app.regulation_versions SET ai_reviewed_at=NULL,ai_reviewed_by_user_id=NULL WHERE id=$1', [key]);
  });
  ok(res, { ...result, sourceFileId: file.id });
}));
router.post(`${base}/review`, route(async (req, res) => {
  const key = id(req.params.id);
  body(z.object({ confirmed: z.literal(true) }).strict(), req);
  await withTransaction(async ({ query: db }) => {
    await editable(req.user.userId, key, db);
    const file = await one('SELECT extraction_status FROM app.regulation_source_files WHERE regulation_version_id=$1', [key], db);
    if (file.extraction_status !== 'EXTRACTED') throw new ValidationError('Cần trích xuất và kiểm tra văn bản nguồn trước khi xác nhận.');
    await db('UPDATE app.regulation_versions SET ai_reviewed_at=SYSUTCDATETIME(),ai_reviewed_by_user_id=$2 WHERE id=$1', [key, req.user.userId]);
  });
  ok(res, { confirmed: true, regulationVersionId: key });
}));
export default router;
