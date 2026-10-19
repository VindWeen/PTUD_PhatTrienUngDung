/** Add the isolated password-test account AFTER SCN; preview is read-only/no connection. */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';
import { hashPassword } from '../../backend/src/utils/crypto.js';

export async function prepareUiTestAccounts({ tester, apply = false }) {
  if (![1, 2].includes(tester)) throw new Error('Chọn --tester=1 hoặc --tester=2');
  if (tester === 1) { console.log('T1 dùng 10 tài khoản SCN sẵn có; không cần tài khoản bổ sung.'); return; }
  if (!apply) {
    console.log('Preview: trên ENV-T2, --apply tạo/đặt lại ui.t2.password, role LECTURER, hồ sơ giảng viên và phân công KTPM; không xóa hồ sơ SCN.');
    return;
  }
  const pool = new Pool({ ...getDbPoolConfig(), max: 1, min: 0 });
  let client;
  try {
    client = await pool.connect(); await client.query('BEGIN');
    const unit = (await client.query("SELECT unit_id FROM app.organization_units WHERE code='FIT_SE' AND is_active=TRUE")).rows[0];
    const role = (await client.query("SELECT role_id FROM app.roles WHERE code='LECTURER' AND is_active=TRUE")).rows[0];
    const admin = (await client.query("SELECT user_id FROM app.users WHERE username='duc.pm' AND status='ACTIVE'")).rows[0];
    const scenario = (await client.query("SELECT 1 FROM app.achievements WHERE title LIKE 'SCN-A01%' LIMIT 1")).rows[0];
    if (!unit || !role || !admin || !scenario) throw new Error('Nạp SCN và dữ liệu nền trên ENV-T2 trước khi tạo tài khoản test.');
    const hash = await hashPassword('demo1234');
    const user = (await client.query(`INSERT INTO app.users(username,email,password_hash,display_name,status,must_change_password)
      VALUES('ui.t2.password','ui.t2.password@example.invalid',$1,'Giảng viên test đổi mật khẩu T2','ACTIVE',FALSE)
      ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='ACTIVE',must_change_password=FALSE RETURNING user_id`, [hash])).rows[0];
    for (const table of ['refresh_tokens','user_unit_scopes','unit_representatives','user_roles']) await client.query(`DELETE FROM app.${table} WHERE user_id=$1`, [user.user_id]);
    await client.query("INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES($1,$2,NOW()-INTERVAL '1 day')", [user.user_id,role.role_id]);
    const lecturer = (await client.query(`INSERT INTO app.lecturers(user_id,employee_code,full_name,email,is_active)
      VALUES($1,'UI-T2-PASSWORD','Giảng viên test đổi mật khẩu T2','ui.t2.password@example.invalid',TRUE)
      ON CONFLICT(user_id) DO UPDATE SET is_active=TRUE RETURNING lecturer_id`, [user.user_id])).rows[0];
    await client.query('DELETE FROM app.lecturer_assignments WHERE lecturer_id=$1', [lecturer.lecturer_id]);
    await client.query("INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by) VALUES($1,$2,TRUE,NOW()-INTERVAL '1 day',$3)", [lecturer.lecturer_id,unit.unit_id,admin.user_id]);
    await client.query('COMMIT');
    console.log('ENV-T2: ui.t2.password sẵn sàng, mật khẩu demo1234, role LECTURER và hồ sơ KTPM; không thay dữ liệu SCN.');
  } catch (error) { if (client) await client.query('ROLLBACK'); throw error; }
  finally { if (client) client.release(); await pool.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tester = Number(process.argv.find(arg => arg.startsWith('--tester='))?.split('=')[1]);
  prepareUiTestAccounts({ tester, apply: process.argv.includes('--apply') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
