// Real Supabase smoke test; never seed or migrate the shared app schema.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import dotenv from 'dotenv';
if (process.env.W5_P3_ENV_FILE) dotenv.config({ path: process.env.W5_P3_ENV_FILE });
const id = randomBytes(6).toString('hex');
const schema = `w5p3_test_${id}`;
const restored = `w5p3_restore_${id}`;
const output = path.resolve('output/w5-p3', id);
process.env.STORAGE_DIR = path.join(output, 'private');
const { Pool, getDbPoolConfig, setPool } = await import('../src/config/database.js');
const { default: app } = await import('../src/app.js');
const { generateAccessToken } = await import('../src/utils/crypto.js');
const { default: storage } = await import('../src/modules/evidences/storage/localStorageAdapter.js');
const { migrateUp } = await import('../../database/scripts/migrate.js');
const { seedDatabase } = await import('../../database/scripts/seed.js');
const pool = new Pool({ ...getDbPoolConfig(), connectionTimeoutMillis:15000, statement_timeout:60000 });
pool.on('error', () => {});
let active = schema, server;
const rewrite = sql => sql.replace(/\bapp\b/g, active);
const wrapper = { query:(s,v)=>pool.query(rewrite(s),v), connect:async()=>{
  const c=await pool.connect(); return {query:(s,v)=>c.query(rewrite(s),v),release:()=>c.release()};
}};
const report = { startedAt:new Date().toISOString(), node:process.version, checks:[], status:'FAILED' };
try {
  await fs.mkdir(output,{recursive:true});
  await migrateUp(wrapper);
  await seedDatabase(wrapper);
  report.checks.push('migrateUp + seedDatabase on empty isolated Supabase schema');
  setPool(wrapper);
  server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  for (const username of ['an.nv','bich.tt','duc.pm','cuong.lh','records.demo']) {
    const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'demo1234'})});
    assert.equal(r.status,200,`seed login ${username}`);
    assert.ok((await r.json()).data.accessToken);
  }
  report.checks.push('5 real seed-account password logins');
  if(process.env.W5_P3_BACKUP_DIR) {
    const { runRestore }=await import('../../scripts/restore.mjs');
    const restore=await runRestore({backupDir:process.env.W5_P3_BACKUP_DIR,targetSchema:restored,targetStorageDir:path.join(output,'restored')});
    assert.equal(restore.success,true);
    active=restored; storage.baseDir=path.join(output,'restored');
    const rows=(await wrapper.query(`SELECT ef.evidence_file_id,ef.sha256_hash,ef.file_size,a.lecturer_id,l.user_id
      FROM app.evidence_files ef JOIN app.evidences e USING(evidence_id)
      JOIN app.achievements a USING(achievement_id) JOIN app.lecturers l ON l.lecturer_id=a.lecturer_id
      WHERE a.subject_type='LECTURER' AND e.is_removed=FALSE LIMIT 1`)).rows;
    assert.ok(rows.length,'Need backed-up personal evidence for HTTP permission checks');
    const f=rows[0];
    const url=base+`/evidence-files/${f.evidence_file_id}/download`;
    const owner=generateAccessToken({userId:Number(f.user_id)});
    const r=await fetch(url,{headers:{Authorization:`Bearer ${owner}`}});
    assert.equal(r.status,200);
    const bytes=Buffer.from(await r.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256_hash.trim());
    assert.equal(bytes.length,Number(f.file_size));
    assert.equal((await fetch(url)).status,401);
    const outsider=(await wrapper.query(`SELECT u.user_id FROM app.users u JOIN app.user_roles ur USING(user_id)
      JOIN app.roles r USING(role_id) WHERE r.code='LECTURER' AND u.user_id<>$1
      AND NOT EXISTS(SELECT 1 FROM app.user_roles x JOIN app.roles y USING(role_id) WHERE x.user_id=u.user_id AND y.code IN ('ADMIN','MANAGER','RECORDS_OFFICER','COUNCIL')) LIMIT 1`,[f.user_id])).rows[0];
    assert.ok(outsider,'Need unrelated lecturer');
    const denied=await fetch(url,{headers:{Authorization:`Bearer ${generateAccessToken({userId:Number(outsider.user_id)})}`}});
    assert.ok([403,404].includes(denied.status),`outside scope: ${denied.status}`);
    report.checks.push('Q3 restore + real HTTP download SHA256/size + anonymous 401 + outside-scope denial');
  } else report.restore='NOT_RUN: supply W5_P3_BACKUP_DIR for Q3 restore + HTTP proof';
  report.status=process.env.W5_P3_BACKUP_DIR?'PASS':'INSTALL_PASS_RESTORE_NOT_RUN';
} catch(e) { report.error={code:e.code||e.name,message:['ERR_ASSERTION','42703'].includes(e.code)?e.message:'Integration failed; inspect local console without publishing secrets'}; process.exitCode=1; console.error(report.error); }
finally {
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  setPool(null);
  for(const name of [schema,restored]) await pool.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`).catch(()=>{report.cleanup='FAILED; inspect generated schema '+name;process.exitCode=1;});
  await pool.end();
  report.finishedAt=new Date().toISOString();
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}

