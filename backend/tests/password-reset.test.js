import test from 'node:test';
import assert from 'node:assert/strict';
import { setPool } from '../src/config/database.js';
import { makeResetToken, readResetToken, resetPassword } from '../src/modules/auth/passwordResetService.js';
import { comparePassword } from '../src/utils/crypto.js';

test('reset links are signed, single-use, and revoke refresh sessions', async () => {
  const user = { user_id: '42', email: 'test@example.org', version: '1', status: 'ACTIVE' };
  let revoked = false, hash;
  const client = { release() {}, async query(sql, params) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (sql.includes('WITH (UPDLOCK, HOLDLOCK)')) return { rows: [{ ...user }] };
    if (sql.includes('UPDATE app.users')) { hash = params[0]; user.version = String(Number(user.version) + 1); return { rows: [], rowCount: 1 }; }
    if (sql.includes('UPDATE app.refresh_tokens')) { revoked = true; return { rows: [], rowCount: 1 }; }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  setPool({ connect: async () => client });
  const token = makeResetToken(user);
  assert.equal(readResetToken(token).sub, '42');
  assert.throws(() => readResetToken(token + 'tampered'));
  await resetPassword(token, 'new-password-123');
  assert.ok(await comparePassword('new-password-123', hash));
  assert.equal(revoked, true);
  await assert.rejects(resetPassword(token, 'another-password'), /không hợp lệ/);
});
