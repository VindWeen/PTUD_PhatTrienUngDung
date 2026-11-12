import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';
const pool=new Pool(getDbPoolConfig());
const seed=fs.readFileSync(new URL('./seed.sql',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('./schema-manifest.json',import.meta.url),'utf8'));
async function isolated(name,work,{expectedError=null}={}) {
  const client=await pool.connect(); let caught=null;
  try {
    await client.query('BEGIN');
    await client.query(seed);
    try { await work(client); } catch(error) { caught=error; }
    if(expectedError) assert.ok(caught && expectedError.test(caught.message),`${name}: expected ${expectedError}, got ${caught?.message ?? 'success'}`);
    else if(caught) throw caught;
    console.log(`PASS ${name} (rolled back)`);
  } finally {
    try {await client.query('ROLLBACK');} catch { /* THROW under XACT_ABORT may already abort. */ }
    await client.release();
  }
}
try {
  const result=await pool.query(`SELECT t.name,c.name AS column_name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.columns c ON c.object_id=t.object_id WHERE s.name=N'app' ORDER BY t.name,c.column_id;`);
  for(const [table,columns] of Object.entries(manifest.tables)) {
    const actual=result.rows.filter(r=>r.name===table).map(r=>r.column_name);
    for(const column of columns) assert.ok(actual.includes(column),`Missing live column ${table}.${column}`);
  }
  const metadata=await pool.query(`SELECT
    (SELECT COUNT(*) FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'app' AND t.name<>N'_schema_migrations') AS tables,
    (SELECT COUNT(*) FROM sys.triggers WHERE parent_class=1 AND is_disabled=0 AND OBJECT_SCHEMA_NAME(object_id)=N'app') AS enabled_triggers,
    (SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1) AS invalid_foreign_keys;`);
  assert.equal(Number(metadata.rows[0].tables),53);
  assert.equal(Number(metadata.rows[0].enabled_triggers),5);
  assert.equal(Number(metadata.rows[0].invalid_foreign_keys),0);
  console.log('PASS live schema metadata',metadata.rows[0]);
  if(process.argv.includes('--seed-rollback')) {
    await isolated('guarded demo seed and Unicode',async c=>{
      const r=await c.query('SELECT display_name FROM app.users WHERE user_id=1;');
      assert.equal(r.rows[0].display_name,'PGS.TS. Nguyễn Văn An');
      const users=await c.query('SELECT COUNT(*) AS total FROM app.users;'); assert.equal(Number(users.rows[0].total),6);
    });
    await isolated('organization cycle rejected',c=>c.query('UPDATE app.organization_units SET parent_id=2 WHERE unit_id=1;'),{expectedError:/cycle/i});
    await isolated('assignment overlap rejected',c=>c.query(`INSERT app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by)
      VALUES(1,2,0,SYSUTCDATETIME(),3);`),{expectedError:/overlap/i});
    await isolated('representative overlap rejected',c=>c.query(`INSERT app.unit_representatives(user_id,unit_id,valid_from,valid_to,assigned_by)
      VALUES(4,2,'2026-01-01','2027-01-01',3);`),{expectedError:/overlap/i});
    await isolated('submitted application input immutable',async c=>{
      await c.query(`INSERT app.award_applications(award_period_id,lecturer_id,context_unit_id,created_by) VALUES(1,1,2,1);
        INSERT app.award_application_inputs(application_id,input_version,snapshot,submitted_by)
        SELECT MAX(application_id),1,N'{}',1 FROM app.award_applications;
        UPDATE app.award_application_inputs SET snapshot=N'{"changed":true}';`);
    },{expectedError:/immutable/i});
    await isolated('source-rule revision, invalidation and audit',async c=>{
      await c.query(`INSERT app.regulation_documents(document_code,title,document_type) VALUES(N'LIVE-ROLLBACK',N'Mô phỏng',N'GUIDELINE');
        INSERT app.regulation_document_versions(document_id,version_number,sha256_hash,effective_from,created_by)
        SELECT document_id,N'1',REPLICATE(N'a',64),'2026-01-01',3 FROM app.regulation_documents WHERE document_code=N'LIVE-ROLLBACK';
        INSERT app.award_criteria_versions(version_id,criterion_code,name,target_type,source_rules,source_rules_by,is_confirmed)
        SELECT version_id,N'ROLLBACK',N'Tiêu chí mô phỏng',N'BOTH',N'{"a":1}',3,1 FROM app.regulation_document_versions;
        UPDATE app.award_criteria_versions SET is_confirmed=1,confirmed_by=3,confirmed_at=SYSUTCDATETIME();
        UPDATE app.award_criteria_versions SET source_rules=N'{"a":2}';`);
      const r=await c.query('SELECT source_rules_revision,is_confirmed,confirmed_by,confirmed_at FROM app.award_criteria_versions;');
      assert.equal(Number(r.rows[0].source_rules_revision),2); assert.equal(Boolean(r.rows[0].is_confirmed),false);
      assert.equal(r.rows[0].confirmed_by,null);assert.equal(r.rows[0].confirmed_at,null);
      const h=await c.query('SELECT COUNT(*) AS total FROM app.criteria_source_rule_history;');assert.equal(Number(h.rows[0].total),2);
    });
    await isolated('seed refuses populated target',c=>c.query(seed),{expectedError:/empty/i});
    const users=await pool.query('SELECT COUNT(*) AS total FROM app.users;');assert.equal(Number(users.rows[0].total),0);
    console.log('PASS all isolated fixtures rolled back; target remains empty.');
  }
} finally { await pool.end(); }
