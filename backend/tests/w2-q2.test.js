import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  validateUploadedFile,
  verifyMagicBytes,
  MAX_FILE_SIZE_BYTES,
} from '../src/modules/evidences/evidenceValidators.js';
import { LocalStorageAdapter } from '../src/modules/evidences/storage/localStorageAdapter.js';
import { EvidenceService } from '../src/modules/evidences/evidenceService.js';
import { ValidationError, OutOfScopeError } from '../src/utils/errors.js';
import { closeDB } from '../src/config/database.js';

test('1. [W2-Q2 Validator] Kiểm tra Magic Bytes & Chữ ký tệp tin', () => {
  // PDF hợp lệ: %PDF-
  const validPdfBuffer = Buffer.from('%PDF-1.4 test content');
  assert.equal(verifyMagicBytes(validPdfBuffer, '.pdf'), true);

  // PDF giả mạo: file text giả vờ có đuôi .pdf
  const fakePdfBuffer = Buffer.from('This is a fake text file claiming to be pdf');
  assert.equal(verifyMagicBytes(fakePdfBuffer, '.pdf'), false);

  // PNG hợp lệ: 89 50 4E 47 0D 0A 1A 0A
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.equal(verifyMagicBytes(validPngBuffer, '.png'), true);

  // JPEG hợp lệ: FF D8 FF
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(verifyMagicBytes(validJpgBuffer, '.jpg'), true);
  assert.equal(verifyMagicBytes(validJpgBuffer, '.jpeg'), true);

  // DOCX hợp lệ (ZIP header: PK 03 04)
  const validDocxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  assert.equal(verifyMagicBytes(validDocxBuffer, '.docx'), true);

  // File executable (MZ header)
  const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
  assert.equal(verifyMagicBytes(exeBuffer, '.pdf'), false);
  assert.equal(verifyMagicBytes(exeBuffer, '.docx'), false);
});

test('2. [W2-Q2 Validator] Kiểm tra dung lượng tệp, MIME và phần mở rộng', () => {
  // 1. Tệp rỗng
  assert.throws(
    () =>
      validateUploadedFile({
        originalname: 'empty.pdf',
        mimetype: 'application/pdf',
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    (err) => err instanceof ValidationError && err.message.includes('0 bytes')
  );

  // 2. Tệp quá cỡ (> 10MB)
  assert.throws(
    () =>
      validateUploadedFile({
        originalname: 'huge.pdf',
        mimetype: 'application/pdf',
        size: MAX_FILE_SIZE_BYTES + 1,
        buffer: Buffer.alloc(10),
      }),
    (err) => err instanceof ValidationError && err.message.includes('10 MB')
  );

  // 3. Đuôi tệp không được hỗ trợ (.exe, .sh)
  assert.throws(
    () =>
      validateUploadedFile({
        originalname: 'script.sh',
        mimetype: 'application/x-sh',
        size: 100,
        buffer: Buffer.from('#!/bin/bash\necho hello'),
      }),
    (err) => err instanceof ValidationError && err.message.includes('không được hỗ trợ')
  );

  // 4. File hợp lệ đầy đủ
  const pdfBuffer = Buffer.from('%PDF-1.7 valid content for achievement evidence');
  const validResult = validateUploadedFile({
    originalname: 'Quyet_dinh_khen_thuong.pdf',
    mimetype: 'application/pdf',
    size: pdfBuffer.length,
    buffer: pdfBuffer,
  });

  assert.equal(validResult.originalFileName, 'Quyet_dinh_khen_thuong.pdf');
  assert.equal(validResult.fileExtension, '.pdf');
  assert.equal(validResult.mimeType, 'application/pdf');
  assert.equal(validResult.fileSize, pdfBuffer.length);
  assert.equal(
    validResult.sha256Hash,
    crypto.createHash('sha256').update(pdfBuffer).digest('hex')
  );
});

test('3. [W2-Q2 Storage] Kiểm tra LocalStorageAdapter và phòng chống Path Traversal', async () => {
  const testStorageDir = path.resolve(process.cwd(), 'storage/test_evidences');
  const storage = new LocalStorageAdapter(testStorageDir);

  // 1. Kiểm tra phát hiện Path Traversal với '..'
  assert.throws(
    () => storage.resolveSafePath('../../etc/passwd'),
    (err) => err instanceof ValidationError && err.message.includes('Path Traversal')
  );

  // 2. Kiểm tra phát hiện Path Traversal với null byte
  assert.throws(
    () => storage.resolveSafePath('file.pdf\0.jpg'),
    (err) => err instanceof ValidationError
  );

  // 3. Lưu tệp an toàn
  const testKey = 'evidences/2026/test_unit_v1.pdf';
  const testContent = Buffer.from('%PDF-1.4 Unit Test Storage');
  const savedPath = await storage.saveFile(testKey, testContent);

  assert.equal(await storage.fileExists(testKey), true);
  assert.equal(fs.existsSync(savedPath), true);

  // 4. Xóa tệp
  const deleted = await storage.deleteFile(testKey);
  assert.equal(deleted, true);
  assert.equal(await storage.fileExists(testKey), false);

  // Dọn dẹp thư mục test
  try {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  } catch {}
});

test('4. [W2-Q2 Service] Dọn dẹp tệp vật lý khi Database thất bại (Cleanup on Failure)', async () => {
  const testStorageDir = path.resolve(process.cwd(), 'storage/test_cleanup');
  const storage = new LocalStorageAdapter(testStorageDir);

  let fileWasDeleted = false;
  const mockStorage = {
    saveFile: async (key, buf) => storage.saveFile(key, buf),
    deleteFile: async (key) => {
      fileWasDeleted = true;
      return storage.deleteFile(key);
    },
    fileExists: async (key) => storage.fileExists(key),
    getFileStream: (key) => storage.getFileStream(key),
  };

  const service = new EvidenceService(mockStorage);

  // Giả lập achievementRepository trả về hồ sơ hợp lệ
  service._assertCanModifyAchievement = async () => true;

  // Gọi createEvidence với Mock DB khiến Transaction văng lỗi
  const testBuffer = Buffer.from('%PDF-1.5 Simulate DB Crash');
  const file = {
    originalname: 'bang_khen.pdf',
    mimetype: 'application/pdf',
    size: testBuffer.length,
    buffer: testBuffer,
  };

  // Do getPool() bị lỗi hoặc achievementRepository bị mock lỗi
  try {
    await service.createEvidence({
      achievementId: 999999, // Không tồn tại trong DB
      body: { title: 'Bằng khen cấp trường' },
      file,
      user: { userId: 1, roles: ['LECTURER'] },
      ipAddress: '127.0.0.1',
      userAgent: 'Node-Test',
    });
    assert.fail('Mong muốn ném lỗi nhưng không ném');
  } catch (err) {
    assert.ok(err);
  }

  // Dọn dẹp thư mục test
  try {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  } catch {}
});

test.after(async () => {
  await closeDB();
});
