import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { comparePassword } from '../src/utils/crypto.js';
import app from '../src/app.js';
const schema = `register_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^register_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max: 4, connectionTimeoutMillis: 10000 });
let server, created = false;
console.log('Isolated test schema:', schema);
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const name of (await fs.readdir(new URL('../../supabase/migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort())
      await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')));
    await client.query('COMMIT'); created = true;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const db = (sql, values) => pool.query(rewrite(sql), values);
  setPool({ query: db, connect: async () => { const c = await pool.connect(); return { query: (sql, values) => c.query(rewrite(sql), values), release: () => c.release() }; } });
  await db("INSERT INTO app.roles(code,name) VALUES ('LECTURER','Giảng viên') ON CONFLICT (code) DO NOTHING");
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
  const post = async (path, body) => { const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  assert.equal((await post('/register', { email: 'broken', fullName: 'Test', password: 'short' })).status, 400);
  assert.equal((await post('/register', { email: 'Person@Example.org', fullName: 'Test Person', password: 'password-123', role: 'ADMIN' })).status, 400);
  const input = { email: 'Person@Example.org', fullName: 'Test Person', password: 'password-123' };
  const registrations = await Promise.all([post('/register', input), post('/register', input)]);
  assert.deepEqual(registrations.map(x => x.status).sort(), [201, 409]);
  const data = await db(`SELECT u.user_id,u.email,u.password_hash,l.employee_code,r.code,
    (SELECT COUNT(*) FROM app.lecturer_assignments la WHERE la.lecturer_id=l.lecturer_id) assignments
    FROM app.users u JOIN app.lecturers l USING(user_id) JOIN app.user_roles ur USING(user_id) JOIN app.roles r USING(role_id)
    WHERE u.email=$1`, ['person@example.org']);
  assert.equal(data.rowCount, 1); assert.equal(data.rows[0].code, 'LECTURER'); assert.equal(Number(data.rows[0].assignments), 0);
  assert.ok(await comparePassword(input.password, data.rows[0].password_hash));
  const login = await post('/login', { username: 'Person@Example.org', password: input.password });
  assert.equal(login.status, 200); assert.equal(login.body.data.user.roles[0].code, 'LECTURER');
  console.log('Registration integration: PASS (validation, concurrent duplicates, role, profile, login)');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  // Drain asynchronous login audit/update queries before taking schema DDL locks.
  await pool.end();
  if (created) {
    const cleanup = new Pool({ ...getDbPoolConfig(), max: 1 });
    try { await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await cleanup.end(); }
  }
}
