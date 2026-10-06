import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import * as regulationService from '../src/modules/regulations/regulationService.js';
import {
  createVersionSchema,
  confirmVersionSchema,
  queryCriteriaSchema,
} from '../src/modules/regulations/regulationSchemas.js';
import {
  ForbiddenError,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../src/utils/errors.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

test('1. [W3-Q2 Fail-Closed Gatekeeper] Tạo version mới không được tự ý gắn nhãn CONFIRMED_LHU_POLICY', () => {
  // 1. Thử tạo version với lhuApplicationStatus = CONFIRMED_LHU_POLICY trước khi duyệt
  assert.throws(
    () => {
      createVersionSchema.parse({
        versionNumber: 'v2.0',
        effectiveFrom: '2026-10-01',
        lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
      });
    },
    (err) => {
      return err.errors.some((e) =>
        e.message.includes('không được tự ý gắn nhãn CONFIRMED_LHU_POLICY')
      );
    }
  );

  // 2. Tạo version với trạng thái hợp lệ mặc định (INTERNAL_CRITERIA_UNCONFIRMED) -> pass
  const valid = createVersionSchema.parse({
    versionNumber: 'v1.0',
    effectiveFrom: '2026-10-01',
    lhuApplicationStatus: 'INTERNAL_CRITERIA_UNCONFIRMED',
  });
  assert.equal(valid.versionNumber, 'v1.0');
  assert.equal(valid.lhuApplicationStatus, 'INTERNAL_CRITERIA_UNCONFIRMED');
});

test('2. [W3-Q2 Gatekeeper] Phê duyệt version: Chặn gán nhãn CONFIRMED_LHU_POLICY nếu isConfirmed = false', () => {
  assert.throws(
    () => {
      confirmVersionSchema.parse({
        isConfirmed: false,
        lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
      });
    },
    (err) => {
      return err.errors.some((e) =>
        e.message.includes('Không thể gắn nhãn CONFIRMED_LHU_POLICY khi isConfirmed là false')
      );
    }
  );

  // Phê duyệt hợp lệ khi isConfirmed = true
  const validApproval = confirmVersionSchema.parse({
    isConfirmed: true,
    lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
    confirmationNotes: 'Hội đồng Khoa học & Đào tạo LHU đã thông qua',
  });
  assert.equal(validApproval.isConfirmed, true);
  assert.equal(validApproval.lhuApplicationStatus, 'CONFIRMED_LHU_POLICY');
});

test('3. [W3-Q2 RBAC Permissions] Giảng viên thông thường không có quyền tạo/xác nhận văn bản hoặc tiêu chí', async () => {
  const normalLecturer = { userId: 5, roles: ['LECTURER'] };

  // Thử tạo văn bản
  await assert.rejects(
    async () => regulationService.createDocument({ documentCode: 'TEST-01', title: 'Quy chế thử nghiệm', documentType: 'GUIDELINE' }, normalLecturer),
    (err) => err instanceof ForbiddenError
  );

  // Thử xác nhận văn bản
  await assert.rejects(
    async () => regulationService.confirmVersion(1, { isConfirmed: true, lhuApplicationStatus: 'CONFIRMED_LHU_POLICY' }, normalLecturer),
    (err) => err instanceof ForbiddenError
  );

  // Thử xác nhận tiêu chí
  await assert.rejects(
    async () => regulationService.confirmCriterion(1, { isConfirmed: true }, normalLecturer),
    (err) => err instanceof ForbiddenError
  );
});

test('4. [W3-Q2 Immutability & SHA-256] Mã băm SHA-256 đúng 64 ký tự hex và bất biến phiên bản', () => {
  const content = 'Nội dung quy định thi đua khen thưởng ban hành năm 2026';
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);

  // Schema kiểm tra đúng hash regex
  const parsed = createVersionSchema.parse({
    versionNumber: '2026.01',
    sha256Hash: hash,
    effectiveFrom: '2026-10-01',
  });
  assert.equal(parsed.sha256Hash, hash);

  // Sai định dạng hash (không phải 64 hex) phải bị từ chối
  assert.throws(
    () => {
      createVersionSchema.parse({
        versionNumber: '2026.02',
        sha256Hash: 'invalid-hash-not-64-bytes',
        effectiveFrom: '2026-10-01',
      });
    },
    (err) => err.errors.some((e) => e.message.includes('SHA-256 hash'))
  );
});

test('5. [W3-Q2 Criteria Gate] Mặc định chỉ lấy tiêu chí đã xác nhận (confirmedOnly = true)', () => {
  const defaultQuery = queryCriteriaSchema.parse({});
  assert.equal(defaultQuery.confirmedOnly, true, 'Mặc định query criteria phải bật confirmedOnly = true để ngăn AI/Evaluation dùng tiêu chí chưa duyệt');
});

test('6. [W3-Q2 Effective Date Order] Ngày hết hiệu lực phải sau hoặc bằng ngày bắt đầu', () => {
  assert.throws(
    () => {
      createVersionSchema.parse({
        versionNumber: 'v1.0',
        effectiveFrom: '2026-10-10',
        effectiveTo: '2026-10-01', // Ngày kết thúc trước ngày bắt đầu
      });
    },
    (err) => err.errors.some((e) => e.message.includes('Ngày hết hiệu lực (effectiveTo) phải sau hoặc bằng ngày bắt đầu hiệu lực'))
  );
});
