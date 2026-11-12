/** Add the isolated password-test account AFTER SCN; preview is read-only/no connection. */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';
import { hashPassword } from '../../backend/src/utils/crypto.js';

export async function prepareUiTestAccounts({ tester, apply = false, demoDb = null }) {
  if (![1, 2].includes(tester)) throw new Error('Chọn --tester=1 hoặc --tester=2');
  if (tester === 1) { console.log('T1 dùng 10 tài khoản SCN sẵn có; không cần tài khoản bổ sung.'); return; }
  if (!apply) {
    console.log('Preview: trên DB demo/test ENV-T2, --apply --demo-db=EXACT_DATABASE_NAME tạo/đặt lại ui.t2.password, role LECTURER, hồ sơ giảng viên và phân công KTPM; không xóa hồ sơ SCN.');
    return;
  }
  if (!demoDb || demoDb !== getDbPoolConfig().database || !/(demo|test|sandbox)/i.test(demoDb)) throw new Error('Account reset requires --demo-db matching an isolated demo/test/sandbox database.');
  const pool = new Pool({ ...getDbPoolConfig(), pool: { ...getDbPoolConfig().pool, max: 1, min: 0 } });
  let client;
  try {
    client = await pool.connect(); await client.query('BEGIN');
    const unit = (await client.query("SELECT unit_id FROM app.organization_units WHERE code='FIT_SE' AND is_active=1")).rows[0];
    const role = (await client.query("SELECT role_id FROM app.roles WHERE code='LECTURER' AND is_active=1")).rows[0];
    const admin = (await client.query("SELECT user_id FROM app.users WHERE username='duc.pm' AND status='ACTIVE'")).rows[0];
    const scenario = (await client.query("SELECT TOP (1) 1 FROM app.achievements WHERE title LIKE 'SCN-A01%'")).rows[0];
    if (!unit || !role || !admin || !scenario) throw new Error('Nạp SCN và dữ liệu nền trên ENV-T2 trước khi tạo tài khoản test.');
    const hash = await hashPassword('demo1234');
    const user = (await client.query(`IF EXISTS(SELECT 1 FROM app.users WITH(UPDLOCK,HOLDLOCK) WHERE username='ui.t2.password')
      UPDATE app.users SET password_hash=$1,status='ACTIVE',must_change_password=0 OUTPUT INSERTED.user_id WHERE username='ui.t2.password';
      ELSE INSERT INTO app.users(username,email,password_hash,display_name,status,must_change_password)
      OUTPUT INSERTED.user_id VALUES('ui.t2.password','ui.t2.password@example.invalid',$1,'Giảng viên test đổi mật khẩu T2','ACTIVE',0);`, [hash])).rows[0];
    for (const table of ['refresh_tokens','user_unit_scopes','unit_representatives','user_roles']) await client.query(`DELETE FROM app.${table} WHERE user_id=$1`, [user.user_id]);
    await client.query("INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES($1,$2,DATEADD(day,-1,SYSUTCDATETIME()))", [user.user_id,role.role_id]);
    const lecturer = (await client.query(`IF EXISTS(SELECT 1 FROM app.lecturers WITH(UPDLOCK,HOLDLOCK) WHERE user_id=$1)
      UPDATE app.lecturers SET is_active=1 OUTPUT INSERTED.lecturer_id WHERE user_id=$1;
      ELSE INSERT INTO app.lecturers(user_id,employee_code,full_name,email,is_active)
      OUTPUT INSERTED.lecturer_id VALUES($1,'UI-T2-PASSWORD','Giảng viên test đổi mật khẩu T2','ui.t2.password@example.invalid',1);`, [user.user_id])).rows[0];
    await client.query('DELETE FROM app.lecturer_assignments WHERE lecturer_id=$1', [lecturer.lecturer_id]);
    await client.query("INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by) VALUES($1,$2,1,DATEADD(day,-1,SYSUTCDATETIME()),$3)", [lecturer.lecturer_id,unit.unit_id,admin.user_id]);
    await client.query('COMMIT');
    console.log('ENV-T2: ui.t2.password sẵn sàng, mật khẩu demo1234, role LECTURER và hồ sơ KTPM; không thay dữ liệu SCN.');
  } catch (error) { if (client) await client.query('ROLLBACK'); throw error; }
  finally { if (client) client.release(); await pool.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tester = Number(process.argv.find(arg => arg.startsWith('--tester='))?.split('=')[1]);
  prepareUiTestAccounts({ tester, apply: process.argv.includes('--apply'), demoDb: process.argv.find(arg => arg.startsWith('--demo-db='))?.slice(10) }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
