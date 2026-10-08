// Real Express + pg + Supabase, synthetic fixtures in a random schema, outer rollback.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool, getDbPoolConfig, setPool } from "../src/config/database.js";
import { generateAccessToken } from "../src/utils/crypto.js";
import { createMockSource } from '../src/mock/kpiServer.js';
import { simulationRecord } from '../src/modules/kpi/externalContract.js';
import app from "../src/app.js";
const schema = `w4p2_test_${randomBytes(6).toString("hex")}`;
assert.match(schema, /^w4p2_test_[a-f0-9]{12}$/);
const rewrite = (sql) => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({
  ...getDbPoolConfig(),
  max: 1,
  connectionTimeoutMillis: 10000,
});
let client,
  server,
  passed = 0;
let mock;
const check = (a, b) => {
  assert.deepEqual(a, b);
  passed++;
};
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout='20s'");
  for (const name of (
    await fs.readdir(new URL("../../supabase/migrations/", import.meta.url))
  )
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await client.query(
      rewrite(
        await fs.readFile(
          new URL(`../../supabase/migrations/${name}`, import.meta.url),
          "utf8",
        ),
      ),
    );
  await client.query(
    rewrite(
      await fs.readFile(
        new URL("../../supabase/seed.sql", import.meta.url),
        "utf8",
      ),
    ),
  );
  const exec = (sql, values) => client.query(rewrite(sql), values);
  let tx = 0;
  const adapted = {
    query: (sql, values) => {
      if (sql === "BEGIN") return client.query(`SAVEPOINT kpi_tx_${++tx}`);
      if (sql === "COMMIT")
        return client.query(`RELEASE SAVEPOINT kpi_tx_${tx}`);
      if (sql === "ROLLBACK")
        return client.query(`ROLLBACK TO SAVEPOINT kpi_tx_${tx}`);
      return exec(sql, values);
    },
    release() {},
  };
  setPool({ query: adapted.query, connect: async () => adapted });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/kpi`;
  async function call(path, method = "GET", body, user = 1, status = 200) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(user
          ? {
              Authorization: `Bearer ${generateAccessToken({ userId: user, roles: ["ADMIN"] })}`,
            }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    check(response.status, status);
    if (path === "/template.csv" && status === 200) return response.text();
    return (await response.json()).data;
  }
  let rows = [{...simulationRecord}, {...simulationRecord,externalId:'SIM-UNKNOWN',employeeId:'UNKNOWN'}];
  mock = createMockSource({token:'synthetic-only-test',items:()=>rows}).listen(0,'127.0.0.1');
  await new Promise(r=>mock.once('listening',r));
  process.env.KPI_SOURCE_URL=`http://127.0.0.1:${mock.address().port}/kpi`;
  process.env.KPI_SOURCE_TOKEN='synthetic-only-test';
  await call('/external','GET',null,null,401);
  await call('/external/runs','POST',{},1,403);
  await call('/external/mappings','POST',{employeeId:'SIM-EMP-001',lecturerId:1},1,403);
  await call('/external/mappings','POST',{employeeId:'SIM-EMP-001',lecturerId:1},3,201);
  await call('/external/mappings','POST',{employeeId:'SIM-EMP-001',lecturerId:2},3,409);
  const run=await call('/external/runs','POST',{},3,201);
  check(run.summary,{imported:1,duplicates:0,quarantined:1,conflicts:0});
  const repeat=await call('/external/runs','POST',{retryOf:run.runId},3,201);
  check(repeat.summary.duplicates,1);
  check((await exec('SELECT count(*)::int n FROM app.external_kpi_records')).rows[0].n,2);
  check((await call('/external','GET',null,2)).records.length,0);
  const own=await call('/external');
  check(own.records.length,1);check(own.runs.length,0);
  const r=own.records[0];
  // W5-P2 reconcile the same labelled source values through the independent CSV path.
  const columns=['code','title','measureUnit','periodStart','periodEnd','target','plan','sourceNote','actual','evidenceNote'];
  const csvFor=(withResult=false)=>columns.join(',')+'\r\n'+columns.map(key=>{
    const value=key==='actual' ? (withResult ? simulationRecord.actual : '') :
      key==='evidenceNote' ? (withResult ? 'MO PHONG CSV reconciliation only' : '') : simulationRecord[key];
    return '"'+String(value).replaceAll('"','""')+'"';
  }).join(',')+'\r\n';
  const csv=csvFor();
  check((await call('/import/preview','POST',{csv})).rows[0].status,'READY_GOAL');
  check((await call('/import/commit','POST',{csv})).imported,1);
  check((await call('/import/commit','POST',{csv})).duplicates,1);
  const csvGoal=(await call('/goals')).items.find(g=>g.code===simulationRecord.code);
  await call(`/goals/${csvGoal.goal_id}/accept`,'POST',{version:csvGoal.version});
  check((await call('/import/commit','POST',{csv:csvFor(true)})).imported,1);
  const reconciled=(await exec('SELECT g.target,g.measure_unit,r.actual FROM app.kpi_goals g JOIN app.kpi_results r USING(goal_id) WHERE g.goal_id=$1',[csvGoal.goal_id])).rows[0];
  check(Number(reconciled.target),r.payload.target);check(Number(reconciled.actual),r.payload.actual);
  check(reconciled.measure_unit,r.payload.measureUnit);
  check((await exec('SELECT status FROM app.external_kpi_records WHERE record_id=$1',[r.record_id])).rows[0].status,'READY');
  await call(`/external/records/${r.record_id}/draft`,'POST',{version:999,achievementTypeId:1},1,409);
  await call(`/external/records/${r.record_id}/draft`,'POST',{version:r.version,achievementTypeId:1},2,403);
  const a=await call(`/external/records/${r.record_id}/draft`,'POST',{version:r.version,achievementTypeId:1},1,201);
  check(a.status,'DRAFT');
  await call(`/external/records/${r.record_id}/draft`,'POST',{version:r.version,achievementTypeId:1},1,409);
  await exec("UPDATE app.achievements SET status='VERIFIED' WHERE achievement_id=$1",[a.achievement_id]);
  const before=(await exec('SELECT * FROM app.achievements WHERE achievement_id=$1',[a.achievement_id])).rows[0];
  rows=[{...simulationRecord,version:2,actual:2}];
  check((await call('/external/runs','POST',{},3,201)).summary.imported,1);
  const next=(await call('/external')).records.find(x=>Number(x.source_version)===2);
  const a2=await call(`/external/records/${next.record_id}/draft`,'POST',{version:next.version,achievementTypeId:1},1,201);
  check(a2.status,'DRAFT');assert.notEqual(a2.achievement_id,a.achievement_id);
  check((await exec('SELECT * FROM app.achievements WHERE achievement_id=$1',[a.achievement_id])).rows[0],before);
  rows=[{...simulationRecord,version:2,actual:999}];
  check((await call('/external/runs','POST',{},3,201)).summary.conflicts,1);
  check(Number((await exec('SELECT payload FROM app.external_kpi_records WHERE record_id=$1',[next.record_id])).rows[0].payload.actual),2);
  rows=[{...simulationRecord,externalId:'SIM-UNKNOWN',employeeId:'UNKNOWN'}];
  await call('/external/mappings','POST',{employeeId:'UNKNOWN',lecturerId:1},3,201);
  check((await call('/external/runs','POST',{},3,201)).summary.imported,1);
  rows=[{...simulationRecord,externalId:'SIM-DRAFT',status:'DRAFT'}];
  check((await call('/external/runs','POST',{},3,201)).summary.quarantined,1);
  const q=(await call('/external')).records.find(x=>x.external_id==='SIM-DRAFT');
  await call(`/external/records/${q.record_id}/draft`,'POST',{version:q.version,achievementTypeId:1},1,409);
  const awardsBefore=(await exec('SELECT count(*)::int n FROM app.award_records')).rows[0].n;
  check(awardsBefore,0);
  // W5-P2: absence is not a deletion event in W4-P2-v1. Preserve all revisions.
  const recordsBefore=(await exec('SELECT * FROM app.external_kpi_records ORDER BY record_id')).rows;
  rows=[];
  check((await call('/external/runs','POST',{},3,201)).summary,{imported:0,duplicates:0,quarantined:0,conflicts:0});
  check((await exec('SELECT * FROM app.external_kpi_records ORDER BY record_id')).rows,recordsBefore);
  // Explicit deletion is unsupported: reject the entire batch, no partial import.
  rows=[{...simulationRecord,externalId:'SIM-MUST-NOT-IMPORT'}, {...simulationRecord,status:'DELETED',version:3}];
  const deletion=await call('/external/runs','POST',{},3,201);
  check(deletion.status,'FAILED');check(deletion.error,'SOURCE_CONTRACT_INVALID');
  check((await exec('SELECT * FROM app.external_kpi_records ORDER BY record_id')).rows,recordsBefore);
  // Duplicate entries within one upstream response keep one revision and two outcomes.
  rows=[{...simulationRecord,externalId:'SIM-BATCH-DUP'}, {...simulationRecord,externalId:'SIM-BATCH-DUP'}];
  check((await call('/external/runs','POST',{},3,201)).summary,{imported:1,duplicates:1,quarantined:0,conflicts:0});
  check((await exec("SELECT count(*)::int n FROM app.external_kpi_records WHERE external_id='SIM-BATCH-DUP'")).rows[0].n,1);
  await exec("UPDATE app.user_roles SET revoked_at=NOW() WHERE user_id=3");
  await call('/external/runs','POST',{},3,403);
  await exec("UPDATE app.user_roles SET revoked_at=NULL WHERE user_id=3");
  delete process.env.KPI_SOURCE_TOKEN;
  const failed=await call('/external/runs','POST',{},3,201);
  check(failed.status,'FAILED');check(failed.error,'SOURCE_NOT_CONFIGURED');
  check((await call('/external','GET',null,3)).runs.find(x=>x.run_id===failed.runId).status,'FAILED');
  console.log(`W4-P2 integration: ${passed} assertions PASS; real HTTP mock + Express + pg/Supabase; rollback`);
} finally {
  if(mock) await new Promise(r=>mock.close(r));
  if(server) await new Promise(r=>server.close(r));
  if(client) {await client.query('ROLLBACK');client.release();}
  setPool(null);
  try {assert.equal((await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount,0);}
  finally {await pool.end();}
}
