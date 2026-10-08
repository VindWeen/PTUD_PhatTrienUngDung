// Real Express + PostgreSQL, committed isolated schema for genuine concurrent DB requests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';
import bcrypt from 'bcryptjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const schema = `w5p1_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^w5p1_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max:10, connectionTimeoutMillis:10000, statement_timeout:60000, query_timeout:90000 });
pool.on('error', () => {});
let server, created=false;
const result={ startedAt:new Date().toISOString(), mode:process.env.W5_P1_MODE||'full', synthetic:true, integration:'real Express + PostgreSQL via pg', concurrency:10,
 machine:{os:os.type(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,ramGiB:Math.round(os.totalmem()/2**30),node:process.version}, measurements:[] };
assert.ok(['full','load','reconcile','browser'].includes(result.mode),'Unknown W5_P1_MODE');
try {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  for(const name of (await fs.readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())
   await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8')));
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/w5-p1-seed.sql',import.meta.url),'utf8')));
  await client.query('COMMIT');created=true;
 } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
 const db=(sql,values)=>pool.query(rewrite(sql),values);
 setPool({query:db,connect:async()=>{const c=await pool.connect();return {query:(s,v)=>c.query(rewrite(s),v),release:()=>c.release()};}});
 await db(`ANALYZE app.achievements`);
 result.dataset=(await db(`SELECT (SELECT COUNT(*)::int FROM app.lecturers) lecturers,(SELECT COUNT(*)::int FROM app.organization_units) units,COUNT(*)::int achievements,COUNT(DISTINCT recognition_year)::int years FROM app.achievements`)).rows[0];
 assert.deepEqual(result.dataset,{lecturers:100,units:10,achievements:5000,years:7});
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api/v1`;
 const tokens=Object.fromEntries(Array.from({length:100},(_,i)=>[i+1,generateAccessToken({userId:i+1,roles:['ADMIN']})])); // forged claims must not widen DB scope
 async function call(path,user=1,status=200,csv=false){
  const r=await fetch(base+path,{headers:{Authorization:`Bearer ${tokens[user]}`},signal:AbortSignal.timeout(csv?120000:30000)});
  assert.equal(r.status,status,`${path} user=${user}`);return csv?await r.text():(await r.json()).data;
 }
 const first=(await call('/achievements?pageSize=20')).items;
 const second=(await call('/achievements?pageSize=20&page=2')).items;
 assert.equal(new Set([...first,...second].map(r=>r.achievementId)).size,40,'Equal timestamps must not duplicate IDs across pages');
 if(result.mode==='browser') {
  const require=createRequire(import.meta.url);
  const {chromium}=require(process.env.W5_PLAYWRIGHT_PATH||'playwright');
  const password=randomBytes(18).toString('hex');
  await db('UPDATE app.users SET password_hash=$1, must_change_password=FALSE',[await bcrypt.hash(password,10)]);
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  result.browser=[];
  try {
   for(const user of [1,2,3,4,6]) {
    const context=await browser.newContext({viewport:{width:user===3?390:1440,height:900}});
    try {
     const page=await context.newPage();page.setDefaultTimeout(60000);
     // Forward to the real isolated Express server. No fabricated API responses.
     await page.route('**/api/v1/**',async route=>{
      try {
       const url=new URL(route.request().url());
       const response=await route.fetch({url:base+url.pathname.replace('/api/v1','')+url.search,timeout:60000});
       await route.fulfill({response});
      }catch {await route.abort().catch(()=>{});}
     });
     await page.goto('http://localhost:5173/login');
     await page.getByLabel('Tên đăng nhập hoặc email',{exact:true}).fill(`w5-${user}`);
     await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
     await page.locator('button[type="submit"]').click();
     await page.waitForURL('**/me/dashboard');
     await page.locator('a[href="/reports"]:visible').first().click();
     await page.waitForURL('**/reports');
     const total=(await call('/reports',user)).total;
     if(total===0)await page.getByText('Không có bản ghi nào',{exact:true}).waitFor();
     else {await page.getByText('Tổng số:',{exact:false}).waitFor();assert.match(await page.getByText('Tổng số:',{exact:false}).innerText(),new RegExp(`\\b${total}\\b`));}
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     await fs.mkdir(new URL('../../output/w5-p1/browser/',import.meta.url),{recursive:true});
     await page.screenshot({path:fileURLToPath(new URL(`../../output/w5-p1/browser/user-${user}.png`,import.meta.url)),fullPage:true});
     result.browser.push({user,total,realLogin:true,realReport:true,horizontalOverflow:false});
     console.log('W5-P1 real browser PASS user',user);
     await page.unrouteAll({behavior:'wait'});
    }finally{await context.unrouteAll({behavior:'ignoreErrors'});await context.close();}
   }
  }finally{await browser.close();}
 }
 if(['full','reconcile'].includes(result.mode)) {
 for(const user of [1,2,3,4,5,6]) {
  const expected=Number((await db(`SELECT COUNT(*) FROM app.achievements WHERE $1=1 OR lecturer_id=$1 OR ($1 IN (2,4) AND context_unit_id=1) OR ($1=3 AND unit_id=1)`,[user])).rows[0].count);
  const report=await call('/reports',user);
  assert.equal(report.total,expected);
  assert.deepEqual((await call('/dashboard/summary',user)).summary,report.summary);
  assert.equal((await call('/reports?search=no-such-synthetic-title',user)).total,0);
 }
 await call('/reports/export.csv',6,403);await call('/reports?pageSize=101',1,400);
 // RFC4180 parser, including escaped quotes, BOM, commas and embedded CR/LF.
 const parseCsv=text=>{const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else if(c!=='\uFEFF')cell+=c;}return rows;};
 for(const filter of ['', '?subjectType=UNIT','?recognitionYear=2024','?status=VERIFIED']) {
  console.log('W5-P1 reconcile',filter||'all');
  const report=await call('/reports'+filter);
  const rows=parseCsv(await call('/reports/export.csv'+filter,1,200,true));const header=rows.shift();
  assert.equal(rows.length,report.total);
  for(const group of report.summary){const selected=rows.filter(r=>r[header.indexOf('subject_type')]===group.subject_type&&r[header.indexOf('is_valid')]==='true');assert.equal(selected.length,group.valid_count);assert.equal(new Set(selected.map(r=>r[header.indexOf('recognition_year')])).size,group.distinct_years);}
  const ids=[];for(let page=1;page<=Math.ceil(report.total/100);page++)ids.push(...(await call('/reports'+(filter?filter+'&':'?')+`pageSize=100&page=${page}`)).items.map(r=>r.id));
  assert.deepEqual(ids.sort(),rows.map(r=>r[header.indexOf('id')]).sort());
  if(!filter)assert.ok(rows.some(r=>r[header.indexOf('title')]==='\'=1+1, "mô phỏng"\nDòng 2'));
 }
 result.reconciliation='PASS: roles, totals, valid counts, distinct years, all paginated IDs, CSV escaping';
 }
 if(['full','load'].includes(result.mode)) for(const path of ['/achievements?pageSize=20','/dashboard/summary']) {
  console.log('W5-P1 load',path);
  // 10 separate users, one request at a time per user; warmup excluded.
  await Promise.all(Array.from({length:10},(_,i)=>call(path,i===0?1:i+1)));
  const samples=[];const start=performance.now();
  await Promise.all(Array.from({length:10},(_,i)=>(async()=>{for(let n=0;n<20;n++){const t=performance.now();await call(path,i+1);samples.push(performance.now()-t);}})()));
  samples.sort((a,b)=>a-b);const p95=samples[Math.ceil(samples.length*.95)-1];
  result.measurements.push({path,requests:samples.length,p50Ms:samples[99],p95Ms:p95,maxMs:samples.at(-1),elapsedMs:performance.now()-start,targetMet:p95<2000,samplesMs:samples});
 }
 result.status=result.measurements.every(m=>m.targetMet)?'PASS':'TARGET_NOT_MET';
 if(result.status==='TARGET_NOT_MET')process.exitCode=2;
 console.log(JSON.stringify({...result,measurements:result.measurements.map(({samplesMs,...m})=>m)},null,2));
} catch(e){result.status='FAILED';result.error={code:e.code||e.name,message:e.code==='ERR_ASSERTION'?e.message:(e.code?'Database/integration connection or SQL failed':e.message)};process.exitCode=1;console.error(result.error);}
finally {
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}setPool(null);
 if(created)await pool.query(`DROP SCHEMA ${schema} CASCADE`);
 await pool.end();
 await fs.mkdir(new URL('../../output/w5-p1/',import.meta.url),{recursive:true});
 result.finishedAt=new Date().toISOString();
 await fs.writeFile(new URL(`../../output/w5-p1/${result.mode}-result.json`,import.meta.url),JSON.stringify(result,null,2));
}
