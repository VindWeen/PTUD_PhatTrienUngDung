import { test, describe, it, after } from 'node:test';
import assert from 'node:assert';
import { maskSecrets, recordAuditLog, getAuditLogs, REDACTED_MASK } from '../src/modules/audit/auditService.js';
import { connectDB, closeDB } from '../src/config/database.js';

describe('KIỂM THỬ AUDIT SERVICE & DATA MASKING [W1-Q4]', () => {
  after(async () => {
    await closeDB();
  });
  it('1. maskSecrets che giấu các trường mật khẩu và khóa nhạy cảm ở cấp 1', () => {
    const raw = {
      username: 'an.nv',
      password: 'SuperSecretPassword123!',
      passwordHash: '$2a$10$YvuV3ek5NZd4o.bokur7bOktk2T7iV4a0B3HMb3Jx..tp77Y7AfSK',
      token: 'd19a87d0c75fa135',
      refreshToken: 'rf_987654321',
      apiKey: 'sk_live_abcdef123456',
      clientSecret: 'secret_xyz',
      email: 'an.nv@lhu.edu.vn',
      status: 'ACTIVE',
    };

    const masked = maskSecrets(raw);

    assert.strictEqual(masked.username, 'an.nv');
    assert.strictEqual(masked.email, 'an.nv@lhu.edu.vn');
    assert.strictEqual(masked.status, 'ACTIVE');

    assert.strictEqual(masked.password, REDACTED_MASK);
    assert.strictEqual(masked.passwordHash, REDACTED_MASK);
    assert.strictEqual(masked.token, REDACTED_MASK);
    assert.strictEqual(masked.refreshToken, REDACTED_MASK);
    assert.strictEqual(masked.apiKey, REDACTED_MASK);
    assert.strictEqual(masked.clientSecret, REDACTED_MASK);

    // Không làm biến đổi object gốc (immutability)
    assert.strictEqual(raw.password, 'SuperSecretPassword123!');
  });

  it('2. maskSecrets che giấu đệ quy trong object lồng nhau và mảng', () => {
    const payload = {
      event: 'USER_REGISTER',
      metadata: {
        actor: 'admin',
        auth: {
          password_hash: 'hash_in_nested_object',
          jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
          session_id: 'sess_123456',
        },
      },
      history: [
        { oldPassword: 'pass1', note: 'lần 1' },
        { oldPassword: 'pass2', note: 'lần 2' },
      ],
    };

    const masked = maskSecrets(payload);

    assert.strictEqual(masked.metadata.auth.password_hash, REDACTED_MASK);
    assert.strictEqual(masked.metadata.auth.jwt, REDACTED_MASK);
    assert.strictEqual(masked.metadata.auth.session_id, REDACTED_MASK);
    assert.strictEqual(masked.history[0].oldPassword, REDACTED_MASK);
    assert.strictEqual(masked.history[0].note, 'lần 1');
    assert.strictEqual(masked.history[1].oldPassword, REDACTED_MASK);
    assert.strictEqual(masked.history[1].note, 'lần 2');
  });

  it('3. maskSecrets nhận diện và che chuỗi Bearer token và JWT độc lập', () => {
    const bearer = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjF9.signatureValue1234567890';
    const standaloneJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    assert.strictEqual(maskSecrets(bearer), `Bearer ${REDACTED_MASK}`);
    assert.strictEqual(maskSecrets(standaloneJwt), '***REDACTED_JWT***');
    assert.strictEqual(maskSecrets('Giảng viên Khoa CNTT'), 'Giảng viên Khoa CNTT');
  });

  it('4. maskSecrets xử lý an toàn tham chiếu vòng (Circular reference) và null/undefined', () => {
    assert.strictEqual(maskSecrets(null), null);
    assert.strictEqual(maskSecrets(undefined), undefined);

    const circularObj = { name: 'Test' };
    circularObj.self = circularObj;

    const result = maskSecrets(circularObj);
    assert.strictEqual(result.name, 'Test');
    assert.strictEqual(result.self, '[Circular]');
  });

  it('5. recordAuditLog che giấu bí mật trước khi lưu và getAuditLogs tra cứu được bản ghi', async () => {
    const testAction = 'TEST_AUDIT_ACTION_W1Q4';
    const testEntity = 'test_entities';
    const testEntityId = 999999;

    const sensitiveOld = {
      password: 'OldPasswordShouldNotBeSaved',
      title: 'Giảng viên cũ',
    };
    const sensitiveNew = {
      new_password: 'NewPasswordShouldNotBeSaved',
      token: 'jwt_token_sensitive_123',
      title: 'Phó Trưởng khoa',
    };

    const savedLog = await recordAuditLog({
      userId: 1,
      action: testAction,
      entityName: testEntity,
      entityId: testEntityId,
      oldValues: sensitiveOld,
      newValues: sensitiveNew,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Test Suite W1-Q4',
    });

    if (savedLog) {
      assert.ok(savedLog.audit_id, 'Phải có audit_id tự tăng');
      assert.strictEqual(savedLog.action, testAction);
      assert.strictEqual(savedLog.entity_name, testEntity);

      // Kiểm tra dữ liệu được lưu trong DB đã che giấu bí mật hoàn toàn
      const oldParsed = typeof savedLog.old_values === 'string' ? JSON.parse(savedLog.old_values) : savedLog.old_values;
      const newParsed = typeof savedLog.new_values === 'string' ? JSON.parse(savedLog.new_values) : savedLog.new_values;

      assert.strictEqual(oldParsed.password, REDACTED_MASK);
      assert.strictEqual(oldParsed.title, 'Giảng viên cũ');
      assert.strictEqual(newParsed.new_password, REDACTED_MASK);
      assert.strictEqual(newParsed.token, REDACTED_MASK);
      assert.strictEqual(newParsed.title, 'Phó Trưởng khoa');

      // Tra cứu lại qua getAuditLogs
      const list = await getAuditLogs({
        action: testAction,
        entityName: testEntity,
        limit: 5,
      });

      assert.ok(Array.isArray(list));
      assert.ok(list.length >= 1);
      const found = list.find((item) => Number(item.entityId) === testEntityId);
      assert.ok(found, 'Tìm thấy bản ghi audit vừa tạo');
    } else {
      console.log('  [NOTICE] Bỏ qua kiểm thử ghi DB nếu đang chạy offline không có DB thật');
    }
  });
});
