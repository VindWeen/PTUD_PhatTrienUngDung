// Real Express + pg + Supabase, synthetic fixtures in a random schema, outer rollback.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool, getDbPoolConfig, setPool } from "../src/config/database.js";
import { generateAccessToken } from "../src/utils/crypto.js";
import app from "../src/app.js";
import config from "../src/config/env.js";
const realProvider = process.env.W4_P1_REAL_PROVIDER === "1";
if (
  realProvider &&
  !(config.AI_PROVIDER === "groq"
    ? config.GROQ_API_KEY
    : config.AI_PROVIDER === "openrouter"
      ? config.OPENROUTER_API_KEY
      : false)
) {
  console.error(
    "BLOCKED: real-provider evidence requires configured server-only provider key. No real LLM call was made.",
  );
  process.exit(1);
}
const schema = `w4p1_test_${randomBytes(6).toString("hex")}`;
assert.match(schema, /^w4p1_test_[a-f0-9]{12}$/);
const rewrite = (sql) => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({
  ...getDbPoolConfig(),
  max: 1,
  connectionTimeoutMillis: 10000,
});
let client,
  server,
  passed = 0;
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
    if (response.status !== status)
      console.error("Unexpected test response", await response.clone().json());
    check(response.status, status);
    if (path === "/template.csv" && status === 200) return response.text();
    return (await response.json()).data;
  }
  const ai = (await import("../src/modules/ai/aiService.js")).default;
  const originalComplete = ai.completeWithRetry.bind(ai);
  const d = (
    await exec(
      "INSERT INTO app.regulation_documents(document_code,title,document_type) VALUES('TEST-W4-P1','MO PHONG integration only','GUIDELINE') RETURNING document_id",
    )
  ).rows[0];
  const v = (
    await exec(
      `INSERT INTO app.regulation_document_versions(document_id,version_number,sha256_hash,effective_from,is_confirmed,lhu_application_status,created_by)
    VALUES($1,'test', $2,'2020-01-01',true,'CONFIRMED_LHU_POLICY',1) RETURNING version_id`,
      [d.document_id, "a".repeat(64)],
    )
  ).rows[0];
  const c = (
    await exec(
      `INSERT INTO app.award_criteria_versions(version_id,criterion_code,name,target_type,min_threshold,unit_metric,legal_references,is_confirmed)
    VALUES($1,'TEST-ONLY','MO PHONG test criterion','INDIVIDUAL',3,'bài','MO PHONG clause',true) RETURNING *`,
      [v.version_id],
    )
  ).rows[0];
  const evaluation = await ai.evaluateStructured(
    {
      subjectType: "LECTURER",
      subjectId: 1,
      criteriaVersionIds: [Number(c.criteria_version_id)],
      asOfDate: "2026-10-07",
    },
    { userId: 1 },
    adapted,
  );
  const runId = evaluation.runId;
  await call("/recommendations", "POST", { runId }, null, 401);
  await call("/recommendations", "POST", { runId }, 3, 403);
  // Adapter response is stubbed for DB integration. This is NOT real-provider evidence.
  ai.completeWithRetry = async () => ({
    provider: "mock",
    isMock: true,
    content: "{}",
  });
  await call("/recommendations", "POST", { runId }, 1, 400);
  check((await exec("SELECT count(*)::int n FROM app.kpi_goals")).rows[0].n, 0);
  // W5-P2 fault injection is contract evidence only, never live-provider evidence.
  const recommendationsBefore=(await exec('SELECT count(*)::int n FROM app.kpi_recommendations')).rows[0].n;
  for (const content of ['{bad', '{"plan":"Trao thưởng theo Điều 9"}', '{"plan":"Chuẩn bị hồ sơ.","target":999}']) {
    ai.completeWithRetry=async()=>({provider:'groq',model:'STUB-NOT-REAL',content});
    await call('/recommendations','POST',{runId},1,400);
    check((await exec('SELECT count(*)::int n FROM app.kpi_recommendations')).rows[0].n,recommendationsBefore);
  }
  for (const [ErrorClass,status] of [[(await import('../src/modules/ai/aiErrors.js')).AiRateLimitError,429],[(await import('../src/modules/ai/aiErrors.js')).AiTimeoutError,504]]) {
    ai.completeWithRetry=async()=>{throw new ErrorClass(7);};
    await call('/recommendations','POST',{runId},1,status);
    check((await exec('SELECT count(*)::int n FROM app.kpi_recommendations')).rows[0].n,recommendationsBefore);
  }
  ai.completeWithRetry = realProvider
    ? originalComplete
    : async () => ({
        provider: "groq",
        model: "STUB-NOT-REAL",
        content: JSON.stringify({
          plan: "Chuẩn bị hồ sơ và rà soát minh chứng.",
        }),
        usage: { totalTokens: 0 },
        timestamp: new Date().toISOString(),
        latencyMs: 0,
      });
  const generated = await call("/recommendations", "POST", { runId }, 1, 201);
  check(generated.items.length, 1);
  const r = generated.items[0];
  if (realProvider) {
    check(r.provider_evidence.isMock, false);
    check(r.provider_evidence.cached, false);
    check(r.provider_evidence.modelReportedByProvider, true);
    assert.ok(r.provider_evidence.model);
  }
  check((await exec("SELECT count(*)::int n FROM app.kpi_goals")).rows[0].n, 0);
  await call(
    `/recommendations/${r.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept" },
    3,
    403,
  );
  await call(
    `/recommendations/${r.recommendation_id}/decision`,
    "POST",
    { version: 2, action: "reject" },
    1,
    409,
  );
  const edits = {
    plan: "Kế hoạch người dùng đã sửa",
    periodStart: "2026-10-07",
    periodEnd: "2026-12-31",
  };
  await call(
    `/recommendations/${r.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept", edits: { ...edits, target: 1 } },
    1,
    400,
  );
  const accepted = await call(
    `/recommendations/${r.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept", edits },
    1,
    200,
  );
  check(accepted.goal.status, "ACCEPTED");
  check(accepted.goal.target, "3");
  check(accepted.recommendation.run_id, runId);
  check(accepted.recommendation.goal_id, accepted.goal.goal_id);
  await call(
    `/recommendations/${r.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept", edits },
    1,
    409,
  );
  const rejected = (await call("/recommendations", "POST", { runId }, 1, 201))
    .items[0];
  await call(
    `/recommendations/${rejected.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "reject" },
    1,
    200,
  );
  check((await exec("SELECT count(*)::int n FROM app.kpi_goals")).rows[0].n, 1);
  await exec(
    "UPDATE app.award_criteria_versions SET unit_metric='năm' WHERE criteria_version_id=$1",
    [c.criteria_version_id],
  );
  const multiYearRun = await ai.evaluateStructured(
    {
      subjectType: "LECTURER",
      subjectId: 1,
      criteriaVersionIds: [Number(c.criteria_version_id)],
      asOfDate: "2026-10-07",
    },
    { userId: 1 },
    adapted,
  );
  const multi = (
    await call(
      "/recommendations",
      "POST",
      { runId: multiYearRun.runId },
      1,
      201,
    )
  ).items[0];
  await call(
    `/recommendations/${multi.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept", edits },
    1,
    400,
  );
  const multiAccepted = await call(
    `/recommendations/${multi.recommendation_id}/decision`,
    "POST",
    {
      version: 1,
      action: "accept",
      edits: { ...edits, periodStart: "2027-01-01", periodEnd: "2029-12-31" },
    },
    1,
    200,
  );
  check(multiAccepted.goal.target, "3");
  check((await exec("SELECT count(*)::int n FROM app.kpi_goals")).rows[0].n, 2);
  await exec(
    "UPDATE app.award_criteria_versions SET unit_metric='bài' WHERE criteria_version_id=$1",
    [c.criteria_version_id],
  );
  // Changes in source status, not just a stale flag, must block acceptance.
  const stale = (await call("/recommendations", "POST", { runId }, 1, 201))
    .items[0];
  await exec(
    "UPDATE app.award_criteria_versions SET is_confirmed=false WHERE criteria_version_id=$1",
    [c.criteria_version_id],
  );
  await call(
    `/recommendations/${stale.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept", edits },
    1,
    409,
  );
  await exec(
    "UPDATE app.award_criteria_versions SET is_confirmed=true WHERE criteria_version_id=$1",
    [c.criteria_version_id],
  );
  await exec("UPDATE app.evaluation_runs SET is_stale=true WHERE run_id=$1", [
    runId,
  ]);
  await call(
    `/recommendations/${stale.recommendation_id}/decision`,
    "POST",
    { version: 1, action: "accept", edits },
    1,
    409,
  );
  check((await exec("SELECT count(*)::int n FROM app.kpi_goals")).rows[0].n, 2);
  if (realProvider)
    await fs.writeFile(
      new URL(
        "../../docs/testing/W4_P1_REAL_PROVIDER_EVIDENCE.json",
        import.meta.url,
      ),
      JSON.stringify(
        {
          status: "PASS",
          dataLabel:
            "MO PHONG synthetic test only; confirmed flags only inside isolated rollback schema",
          providerEvidence: r.provider_evidence,
          acceptedGoalPersisted: true,
          goalLinkedToRun: true,
          assertions: passed,
          sharedDatabaseModified: false,
        },
        null,
        2,
      ),
    );
  ai.completeWithRetry = originalComplete;
  console.log(
    `W4-P1 DB integration: ${passed} assertions PASS; Supabase + Express; ${realProvider ? "REAL provider evidence" : "STUB provider; NOT real-provider evidence"}; isolated MO PHONG schema rollback`,
  );
} finally {
  if (server) await new Promise((r) => server.close(r));
  if (client) {
    await client.query("ROLLBACK");
    client.release();
  }
  setPool(null);
  await pool.end();
}
