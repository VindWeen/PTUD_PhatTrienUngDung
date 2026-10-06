// Real Express/pg/Supabase. All migrations, seed and synthetic report fixtures are rolled back.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

const schema = `w3p1_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^w3p1_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max: 1, connectionTimeoutMillis: 5000 });
let client, server, passed = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); passed++; };
// A small RFC4180 reader so CSV reconciliation does not depend on exporter implementation.
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === ',') { row.push(cell); cell = ''; }
    else if (!quoted && c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  return rows;
}
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='20s'");
  const files = (await fs.readdir(new URL('../../supabase/migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort();
  for (const name of files) await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')));
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')));
  const adapted = {
    query: (sql, values) => client.query(rewrite(sql), values), release() {},
  };
  setPool({ query: adapted.query, connect: async () => adapted });
  const exec = (sql, params) => client.query(rewrite(sql), params);
  // Existing W2 subject/catalog conventions: lecturer 1, context 2, collective unit 2.
  const achievements = [
    [1, null, 2, 1, '=1+1, "fixture"\nDòng 2', 2025, 3, 'VERIFIED'],
    [1, null, 2, 1, 'Cùng năm', 2025, 3, 'VERIFIED'],
    [1, null, 2, 1, 'Năm trước', 2024, 2, 'VERIFIED'],
    [1, null, 2, 1, 'Đã thu hồi', 2023, 1, 'REVOKED'],
    [1, null, 2, 1, 'Đang chờ', 2026, 3, 'SUBMITTED'],
    [null, 2, 2, 2, 'Tập thể', 2025, 3, 'VERIFIED'],
    [4, null, 3, 3, 'Ngoài scope trực tiếp', 2026, 3, 'VERIFIED'],
  ];
  for (const a of achievements) await exec(`INSERT INTO app.achievements(lecturer_id,unit_id,context_unit_id,achievement_type_id,title,recognition_year,academic_year_id,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1)`, a);
  const decisions = [];
  for (let i = 0; i < 5; i++) decisions.push((await exec("INSERT INTO app.award_decisions(decision_number,decision_date,issuer,title,created_by) VALUES($1,'2026-01-01','Fixture W3-P1',$2,5) RETURNING decision_id", [`W3-P1-${i}`, i ? `Quyết định ${i}` : '@SUM(1)'])).rows[0].decision_id);
  const awards = [[1, null, 2, 1, 2025, 'RECORDED'], [1, null, 2, 1, 2025, 'RECORDED'], [1, null, 2, 1, 2024, 'REVOKED'], [null, 2, 2, 4, 2025, 'RECORDED'], [null, 2, 2, 4, 2026, 'DRAFT']];
  for (let i = 0; i < awards.length; i++) {
    const a = awards[i];
    await exec('INSERT INTO app.award_records(lecturer_id,unit_id,context_unit_id,award_type_id,recognition_year,status,decision_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,5)', [...a, decisions[i]]);
  }
  await exec("INSERT INTO app.award_records(award_period_id,lecturer_id,decision_number,decision_date,status) VALUES(1,1,'LEGACY-FIXTURE','2020-01-01','RECORDED')");
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function call(path, user = 2, status = 200, csv = false) {
    const response = await fetch(base + path, { headers: user ? { Authorization: `Bearer ${generateAccessToken({ userId: user, roles: ['ADMIN'] })}` } : {} });
    check(response.status, status);
    if (csv && status === 200) { check(response.headers.get('content-type').startsWith('text/csv'), true); return response.text(); }
    const body = await response.json(); return body.data;
  }
  const full = await call('/reports');
  check(full.total, 12);
  check(typeof full.items[0].id, 'string');
  check(typeof full.items[0].context_unit_id, 'string');
  check(full.summary, [
    { kind: 'ACHIEVEMENT', subject_type: 'LECTURER', total: 6, valid_count: 4, distinct_years: 3 },
    { kind: 'ACHIEVEMENT', subject_type: 'UNIT', total: 1, valid_count: 1, distinct_years: 1 },
    { kind: 'AWARD', subject_type: 'LECTURER', total: 3, valid_count: 2, distinct_years: 1 },
    { kind: 'AWARD', subject_type: 'UNIT', total: 2, valid_count: 1, distinct_years: 1 },
  ]);
  check((await call('/dashboard/summary')).summary, full.summary);
  check((await call('/reports/achievements?unitId=2')).total, 6);
  check((await call('/reports/awards')).total, 5);
  check(parseCsv(await call('/reports/export?type=awards&unitId=2', 2, 200, true)).length - 1, 5);
  await call('/reports/export?type=other', 2, 400);
  await call('/reports/achievements?kind=AWARD', 2, 400);
  const csv = parseCsv(await call('/reports/export.csv', 2, 200, true));
  const [header, ...rows] = csv;
  check(rows.length, full.total);
  const column = name => header.indexOf(name);
  check(rows.map(r => `${r[column('kind')]}:${r[column('id')]}`).sort(), full.items.map(r => `${r.kind}:${r.id}`).sort());
  for (const s of full.summary) {
    const valid = rows.filter(r => r[column('kind')] === s.kind && r[column('subject_type')] === s.subject_type && r[column('is_valid')] === 'true');
    check(valid.length, s.valid_count);
    check(new Set(valid.map(r => r[column('recognition_year')])).size, s.distinct_years);
  }
  check(rows.filter(r => r[column('is_valid')] === 'true').length, full.summary.reduce((n, s) => n + s.valid_count, 0));
  check(rows.some(r => r[column('title')] === '\'=1+1, "fixture"\nDòng 2'), true);
  check(rows.some(r => r[column('title')] === "'@SUM(1)"), true);
  const page1 = await call('/reports?pageSize=2');
  const page2 = await call('/reports?pageSize=2&page=2');
  check(page1.items.length, 2); check(page2.items.length, 2);
  check(page2.total, full.total); check(page2.summary, full.summary);
  check(new Set([...page1.items, ...page2.items].map(r => r.kind + r.id)).size, 4);
  for (const filter of ['kind=ACHIEVEMENT&status=VERIFIED&contextUnitId=2', 'kind=AWARD&subjectType=UNIT', 'recognitionYear=2025', 'academicYearId=3', 'kind=ACHIEVEMENT&typeId=1', 'status=REVOKED', 'search=Cùng']) {
    const result = await call(`/reports?${filter}`);
    check((await call(`/dashboard/summary?${filter}`)).summary, result.summary);
    const exported = parseCsv(await call(`/reports/export.csv?${filter}`, 2, 200, true)).slice(1);
    check(exported.length, result.total);
    check(exported.map(r => `${r[column('kind')]}:${r[column('id')]}`).sort(), result.items.map(r => `${r.kind}:${r.id}`).sort());
  }
  check((await call('/reports?search=%25')).total, 0);
  await call('/reports?kind=AWARD&academicYearId=3', 2, 400);
  await call('/reports?typeId=1', 2, 400);
  await call('/reports?pageSize=101', 2, 400);
  await call('/reports', null, 401);
  // Forged role claims in the JWT cannot widen lecturer scope or export permissions.
  check((await call('/reports', 1)).total, 8);
  await call('/reports/export.csv', 1, 403);
  check((await call('/reports?contextUnitId=3', 1)).total, 0);
  check((await call('/reports?subjectType=UNIT', 4)).total, 3);
  // Move the lecturer's current assignment, while stored historical context stays unchanged.
  await exec('UPDATE app.lecturer_assignments SET valid_to=NOW() WHERE lecturer_id=1 AND valid_to IS NULL');
  await exec('INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by) VALUES(1,3,TRUE,NOW(),3)');
  check((await call('/reports')).summary, full.summary);
  check((await call('/reports?contextUnitId=2', 1)).total, 8);
  check((await call('/reports?contextUnitId=3', 1)).total, 0);
  // Role-scoped recursion, expiration and active status are reevaluated on every request.
  await exec('UPDATE app.user_unit_scopes SET include_descendants=FALSE WHERE user_id=2');
  check((await call('/reports', 2)).total, 0);
  await exec('UPDATE app.user_unit_scopes SET include_descendants=TRUE,valid_to=NOW() WHERE user_id=2');
  check((await call('/reports', 2)).total, 0);
  check(parseCsv(await call('/reports/export.csv', 2, 200, true)).length, 1);
  await exec('UPDATE app.unit_representatives SET revoked_at=NOW() WHERE user_id=4');
  check((await call('/reports?subjectType=UNIT', 4)).total, 0);
  await exec('UPDATE app.user_roles SET revoked_at=NOW() WHERE user_id=5');
  await call('/reports', 5, 403);
  check((await call('/reports', 3)).total, 12);
  await exec("UPDATE app.users SET status='INACTIVE' WHERE user_id=3");
  await call('/reports', 3, 401);
  // Revocation changes valid totals without increasing/decreasing distinct years incorrectly.
  await exec("UPDATE app.achievements SET status='REVOKED' WHERE title='Cùng năm'");
  const after = await call('/reports', 1);
  check(after.summary[0].valid_count, 2); check(after.summary[0].distinct_years, 2);
  await exec("INSERT INTO app.achievements(lecturer_id,context_unit_id,title,recognition_year,status,created_by) VALUES(1,2,'Legacy thiếu loại',2025,'VERIFIED',1)");
  const legacy = await call('/reports?search=Legacy', 1);
  check(legacy.total, 1); check(legacy.items[0].type_id, null);
  check(legacy.summary[0].valid_count, 1);
  console.log(`W3-P1 integration: ${passed} assertions PASS (Express + Supabase, synthetic fixture, rollback)`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (client) { await client.query('ROLLBACK'); client.release(); }
  setPool(null);
  const remaining = await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema]);
  assert.equal(remaining.rowCount, 0, 'Temporary schema must be removed by rollback');
  await pool.end();
}
