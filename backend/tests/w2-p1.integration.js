// Real Express + pg + Supabase tests in a temporary schema, entirely rolled back.
// No seed or migration is applied to the shared app schema.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

const schema = `w2p1_test_${randomBytes(6).toString('hex')}`;
assert.match(schema,/^w2p1_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g,schema);
const pool = new Pool({ ...getDbPoolConfig(),max:1,connectionTimeoutMillis:5000 });
let client, server;
let passed = 0;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='20s'");
  const files = (await fs.readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(v => v.endsWith('.sql')).sort();
  for (const name of files) await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8')));
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql',import.meta.url),'utf8')));
  const adapted = {
    query: async (sql,values) => {
      if (sql === 'BEGIN') return client.query('SAVEPOINT admin_mutation');
      if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT admin_mutation');
      if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT admin_mutation'); return client.query('RELEASE SAVEPOINT admin_mutation'); }
      return client.query(rewrite(sql),values);
    },
    release() {},
  };
  let queue = Promise.resolve();
  const serialized = (sql,values) => {
    const result = queue.then(() => adapted.query(sql,values));
    queue = result.catch(() => {});
    return result;
  };
  setPool({ query: serialized,connect: async () => ({ query:serialized,release() {} }) });
  server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const tokens = Object.fromEntries([1,2,3,4,5].map(id => [id,generateAccessToken({ userId:id })]));
  async function call(method,path,body,user=3,expected=200) {
    const response = await fetch(`${base}${path}`,{ method,headers:{ Authorization:`Bearer ${tokens[user]}`,'Content-Type':'application/json' },...(body ? { body:JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data.error || {})}`);
    passed++;
    return data.data;
  }
  await call('GET','/admin/users',null,1,403);
  await call('GET','/lecturers/2',null,1,403);
  await call('GET','/lecturers/1',null,1);
  await call('GET','/lecturers/1',null,2);
  await call('GET','/units/1/profile',null,1,403);
  await call('GET','/auth/verify-scope/2',null,3,403);
  await call('GET','/auth/verify-scope/2',null,2);
  await client.query(rewrite('UPDATE app.organization_units SET is_active=FALSE WHERE unit_id=1'));
  await call('GET','/auth/verify-scope/2',null,2,403);
  await client.query(rewrite('UPDATE app.organization_units SET is_active=TRUE WHERE unit_id=1'));
  const scopes = await call('GET','/admin/scopes');
  await call('DELETE',`/admin/scopes/${scopes.find(v => Number(v.user_id)===2).user_unit_scope_id}`);
  await call('GET','/auth/verify-scope/2',null,2,403);
  await call('GET','/units/1/profile',null,2,403);
  await call('GET','/lecturers/1',null,2,403);
  const period = { validFrom:'2026-01-01T00:00:00Z',validTo:null };
  const direct = await call('POST','/admin/scopes',{ userId:2,roleId:3,unitId:1,includeDescendants:false,...period });
  await call('GET','/auth/verify-scope/1',null,2);
  await call('GET','/auth/verify-scope/2',null,2,403);
  await call('DELETE',`/admin/scopes/${direct.id}`);
  const inherited = await call('POST','/admin/scopes',{ userId:2,roleId:3,unitId:1,includeDescendants:true,...period });
  await call('GET','/auth/verify-scope/2',null,2);
  await call('GET','/auth/verify-scope/4',null,2,403);
  const roleList = await call('GET','/admin/user-roles');
  await call('DELETE',`/admin/user-roles/${roleList.find(v => Number(v.user_id)===2 && Number(v.role_id)===3).user_role_id}`);
  await call('GET','/auth/verify-scope/1',null,2,403);
  await call('DELETE',`/admin/scopes/${inherited.id}`);
  await call('POST','/admin/scopes',{ userId:2,roleId:3,unitId:1,includeDescendants:true,...period },3,409);
  await call('POST','/admin/user-roles',{ userId:2,roleId:3,...period });
  await call('POST','/admin/scopes',{ userId:2,roleId:3,unitId:1,includeDescendants:true,...period,validTo:'2026-07-01T00:00:00Z' });
  await call('GET','/auth/verify-scope/2',null,2,403);
  await call('POST','/admin/scopes',{ userId:2,roleId:3,unitId:1,includeDescendants:true,validFrom:'2099-01-01T00:00:00Z',validTo:null });
  await call('GET','/auth/verify-scope/2',null,2,403);
  await call('POST','/admin/representatives',{ userId:4,unitId:4,validFrom:'2026-10-01T00:00:00Z',validTo:'2026-09-01T00:00:00Z' },3,400);
  const repPeriod = { ...period,validTo:'2099-01-01T00:00:00Z' };
  const rep = await call('POST','/admin/representatives',{ userId:4,unitId:4,...repPeriod });
  await call('GET','/units/4/profile',null,4);
  await call('POST','/admin/representatives',{ userId:4,unitId:4,...repPeriod },3,409);
  await call('DELETE',`/admin/representatives/${rep.id}`);
  await call('GET','/units/4/profile',null,4,403);
  await call('POST','/admin/representatives',{ userId:4,unitId:4,...repPeriod });
  const definitions = [
    ['academic-years',{ code:'TEST_YEAR',name:'Mô phỏng',startDate:'2026-09-01',endDate:'2027-08-31' }],
    ['achievement-types',{ code:'TEST_ACHIEVEMENT',name:'Mô phỏng' }],
    ['award-types',{ code:'TEST_AWARD',name:'Mô phỏng',category:'TITLE',level:'UNIVERSITY' }],
  ];
  for (const [name,body] of definitions) {
    const created = await call('POST',`/admin/${name}`,body);
    await call('POST',`/admin/${name}`,body,3,409);
    await call('POST',`/admin/${name}`,{ ...body,code:body.code.toLowerCase() },3,409);
    await call('PATCH',`/admin/${name}/${created.id}`,{ ...body,name:'Đã sửa' });
    await call('DELETE',`/admin/${name}/${created.id}`);
  }
  // Seeded catalog references survive deactivation.
  await client.query(rewrite(`INSERT INTO app.achievements (criterion_id,lecturer_id,context_unit_id,title,achievement_date,achievement_type_id)
    VALUES (1,1,2,'TEST SYNTHETIC ACHIEVEMENT',CURRENT_DATE,1)`));
  const referenced = (await client.query(rewrite('SELECT achievement_type_id FROM app.achievements WHERE achievement_type_id IS NOT NULL LIMIT 1'))).rows[0];
  assert.ok(referenced);
  await call('DELETE',`/admin/achievement-types/${referenced.achievement_type_id}`);
  assert.ok((await client.query(rewrite('SELECT 1 FROM app.achievements WHERE achievement_type_id=$1'),[referenced.achievement_type_id])).rowCount);
  await call('PATCH','/admin/award-types/1',{ code:'CSTĐ_CS',name:'Chiến sĩ thi đua cơ sở',category:'TITLE',level:'UNIVERSITY' });
  await call('GET','/admin/academic-years');
  const created = await call('POST','/admin/users',{ username:'test.synthetic',email:'synthetic@example.invalid',displayName:'Test',password:'TestDemo12345!' });
  for (const username of ['an.nv','bich.tt','duc.pm','cuong.lh','records.demo']) await call('POST','/auth/login',{ username,password:'demo1234' });
  const login = await call('POST','/auth/login',{ username:'test.synthetic',password:'TestDemo12345!' });
  tokens[created.id] = login.accessToken;
  await call('GET','/auth/me',null,created.id);
  await call('PATCH',`/admin/users/${created.id}`,{ email:created.email,displayName:'Test',version:Number(created.version),status:'INACTIVE' });
  await call('GET','/auth/me',null,created.id,401);
  await call('PATCH',`/admin/users/${created.id}`,{ email:created.email,displayName:'Test',version:Number(created.version),status:'ACTIVE' },3,409);
  const audit = await client.query(rewrite('SELECT new_values FROM app.audit_logs'));
  assert.ok(audit.rowCount > 0);
  assert.ok(audit.rows.every(v => !JSON.stringify(v).includes('password')));
  console.log(`PASS W2-P1: ${passed} HTTP assertions, real PostgreSQL migrations/seed, audit and FK retention. All test changes rolled back.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (client) { await client.query('ROLLBACK'); client.release(); }
  await pool.end();
}
