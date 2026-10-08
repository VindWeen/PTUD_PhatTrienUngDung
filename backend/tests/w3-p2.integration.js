// Real Express + pg + Supabase, synthetic fixtures in a random schema, outer rollback.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool, getDbPoolConfig, setPool } from "../src/config/database.js";
import { generateAccessToken } from "../src/utils/crypto.js";
import app from "../src/app.js";
const schema = `w3p2_test_${randomBytes(6).toString("hex")}`;
assert.match(schema, /^w3p2_test_[a-f0-9]{12}$/);
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
    check(response.status, status);
    if (path === "/template.csv" && status === 200) return response.text();
    return (await response.json()).data;
  }
  const goal = {
    code: "DEMO-PAPER",
    title: "KPI MO PHONG - không phải tiêu chí",
    measureUnit: "bài",
    periodStart: "2026-01-01",
    periodEnd: "2027-01-01",
    target: 2,
    plan: "Kế hoạch do người dùng nhập",
    sourceNote: "MO PHONG",
  };
  await call("/goals", "GET", null, null, 401);
  await call("/goals", "GET", null, 3, 403); // ADMIN claims do not give ownership.
  check(
    (await call("/catalogs")).types.some((t) => t.achievement_type_id === "1"),
    true,
  );
  check((await call("/catalogs", "GET", null, 4)).units[0].unit_id, "2");
  let g = await call("/goals", "POST", goal, 1, 201);
  check(g.source, "MANUAL");
  check(g.status, "DRAFT");
  check(g.period_start, goal.periodStart);
  check(g.period_end, goal.periodEnd);
  const path = `/goals/${g.goal_id}`;
  await call("/goals", "POST", { ...goal, code: "demo-paper" }, 1, 409);
  await call(path, "PATCH", { ...goal, version: g.version }, 2, 403);
  await call(
    path + "/result",
    "POST",
    { actual: 3, sourceNote: "MO PHONG", evidenceNote: "Tham chiếu mô phỏng" },
    1,
    409,
  );
  await call(
    path,
    "PATCH",
    { ...goal, version: g.version, status: "VERIFIED" },
    1,
    400,
  );
  await call(path + "/accept", "POST", { version: 999 }, 1, 409);
  g = await call(path, "PATCH", {
    ...goal,
    title: "KPI MO PHONG cập nhật",
    version: g.version,
  });
  check(g.version, "2");
  g = await call(path + "/accept", "POST", { version: g.version });
  check(g.status, "ACCEPTED");
  check(g.accepted_by, "1");
  await call(path, "PATCH", { ...goal, version: g.version }, 1, 409);
  await call(path, "DELETE", { version: g.version }, 1, 409);
  let r = await call(
    path + "/result",
    "POST",
    {
      actual: 3,
      sourceNote: "MO PHONG",
      evidenceNote: "Minh chứng do người dùng nhập",
    },
    1,
    201,
  );
  check(r.source, "MANUAL");
  await call(
    path + "/result",
    "POST",
    { actual: 3, sourceNote: "MO PHONG", evidenceNote: "Minh chứng" },
    1,
    409,
  );
  await call(
    path + "/result",
    "PATCH",
    {
      actual: 4,
      sourceNote: "MO PHONG",
      evidenceNote: "Sửa minh chứng",
      version: r.version,
    },
    4,
    403,
  );
  await call(
    path + "/result",
    "PATCH",
    {
      actual: 4,
      sourceNote: "MO PHONG",
      evidenceNote: "Sửa minh chứng",
      version: 999,
    },
    1,
    409,
  );
  r = await call(path + "/result", "PATCH", {
    actual: 4,
    sourceNote: "MO PHONG",
    evidenceNote: "Sửa minh chứng",
    version: r.version,
  });
  await call(
    path + "/result/draft",
    "POST",
    { version: r.version, achievementTypeId: 99999 },
    1,
    400,
  );
  r = await call(
    path + "/result/draft",
    "POST",
    { version: r.version, achievementTypeId: 1 },
    1,
    201,
  );
  const a = (
    await exec("SELECT * FROM app.achievements WHERE achievement_id=$1", [
      r.achievement_id,
    ])
  ).rows[0];
  check(a.status, "DRAFT");
  check(a.context_unit_id, g.context_unit_id);
  check(a.description.includes("MANUAL"), true);
  check(a.verified_by, null);
  check(a.recognition_year, 2027);
  check(
    (await call("/goals")).items.find((x) => x.goal_id === g.goal_id).result
      .version,
    r.version,
  );
  await call(
    path + "/result/draft",
    "POST",
    { version: r.version, achievementTypeId: 1 },
    1,
    409,
  );
  await call(path + "/result", "DELETE", { version: r.version }, 1, 409);
  const unit = await call(
    "/goals",
    "POST",
    { ...goal, subjectType: "UNIT", organizationUnitId: 2 },
    4,
    201,
  );
  check(
    (await call("/goals?subjectType=UNIT&organizationUnitId=2", "GET", null, 4))
      .items.length,
    1,
  );
  await call(
    `/goals/${unit.goal_id}/accept`,
    "POST",
    { version: unit.version },
    1,
    403,
  );
  const ug = await call(
    `/goals/${unit.goal_id}/accept`,
    "POST",
    { version: unit.version },
    4,
  );
  const ur = await call(
    `/goals/${unit.goal_id}/result`,
    "POST",
    {
      actual: 2,
      sourceNote: "MO PHONG",
      evidenceNote: "Minh chứng tập thể mô phỏng",
    },
    4,
    201,
  );
  await call(
    `/goals/${unit.goal_id}/result/draft`,
    "POST",
    { version: ur.version, achievementTypeId: 1 },
    4,
    400,
  );
  const ut = (
    await exec(
      "SELECT achievement_type_id FROM app.achievement_types WHERE applicable_subject_type IN ('UNIT','BOTH') AND is_active LIMIT 1",
    )
  ).rows[0];
  const ud = await call(
    `/goals/${unit.goal_id}/result/draft`,
    "POST",
    { version: ur.version, achievementTypeId: Number(ut.achievement_type_id) },
    4,
    201,
  );
  check(
    (
      await exec(
        "SELECT context_unit_id,status FROM app.achievements WHERE achievement_id=$1",
        [ud.achievement_id],
      )
    ).rows[0],
    { context_unit_id: ug.context_unit_id, status: "DRAFT" },
  );
  await exec(
    "UPDATE app.unit_representatives SET revoked_at=NOW() WHERE user_id=4",
  );
  await call(
    `/goals/${unit.goal_id}/accept`,
    "POST",
    { version: unit.version },
    4,
    403,
  );
  await exec(
    "UPDATE app.unit_representatives SET revoked_at=NULL,valid_to=NOW()-INTERVAL '1 second' WHERE user_id=4",
  );
  await call(
    "/goals?subjectType=UNIT&organizationUnitId=2",
    "GET",
    null,
    4,
    403,
  );
  const template = await call("/template.csv");
  check(template.includes("MO PHONG"), true);
  const csv =
    "code,title,measureUnit,periodStart,periodEnd,target,plan,sourceNote,actual,evidenceNote\r\nCSV-KPI,KPI MO PHONG,bai,2026-01-01,2026-12-31,2,Ke hoach,MO PHONG,,\r\n";
  check(
    (await call("/import/preview", "POST", { csv })).rows[0].status,
    "READY_GOAL",
  );
  check((await call("/import/commit", "POST", { csv })).imported, 1);
  check((await call("/import/commit", "POST", { csv })).duplicates, 1);
  // W5-P2: same identity with changed content is a conflict, not a silent duplicate.
  const changedCsv = csv.replace(',2,Ke hoach', ',3,Ke hoach');
  check((await call('/import/preview','POST',{csv:changedCsv})).rows[0].status,'INVALID');
  await call('/import/commit','POST',{csv:changedCsv},1,400);
  const mixedCsv = csv.replace('CSV-KPI','W5-ATOMIC') + changedCsv.split('\r\n')[1] + '\r\n';
  await call('/import/commit','POST',{csv:mixedCsv},1,400);
  check((await exec("SELECT count(*)::int n FROM app.kpi_goals WHERE code='W5-ATOMIC'")).rows[0].n,0);
  const sameBatchConflict = csv.replace('CSV-KPI','W5-INBATCH') + csv.split('\r\n')[1].replace('CSV-KPI','W5-INBATCH').replace(',2,Ke hoach',',3,Ke hoach') + '\r\n';
  await call('/import/commit','POST',{csv:sameBatchConflict},1,400);
  const repeated = csv + csv.split("\r\n")[1] + "\r\n";
  check(
    (await call("/import/preview", "POST", { csv: repeated })).duplicates,
    2,
  );
  let cg = (await call("/goals")).items.find((x) => x.code === "CSV-KPI");
  check(cg.source, "CSV");
  const resultCsv = csv.replace("MO PHONG,,", "MO PHONG,4,Tham chieu MO PHONG");
  check(
    (await call("/import/preview", "POST", { csv: resultCsv })).rows[0].status,
    "INVALID",
  );
  await call("/import/commit", "POST", { csv: resultCsv }, 1, 400);
  cg = await call(`/goals/${cg.goal_id}/accept`, "POST", {
    version: cg.version,
  });
  check(
    (await call("/import/preview", "POST", { csv: resultCsv })).rows[0].status,
    "READY_RESULT",
  );
  check((await call("/import/commit", "POST", { csv: resultCsv })).imported, 1);
  check(
    (await call("/import/commit", "POST", { csv: resultCsv })).duplicates,
    1,
  );
  const changedResult = resultCsv.replace('MO PHONG,4,','MO PHONG,5,');
  check((await call('/import/preview','POST',{csv:changedResult})).rows[0].status,'INVALID');
  await call('/import/commit','POST',{csv:changedResult},1,400);
  check(Number((await exec('SELECT actual FROM app.kpi_results WHERE goal_id=$1',[cg.goal_id])).rows[0].actual),4);
  check(
    (await call("/goals")).items.find((x) => x.goal_id === cg.goal_id).result
      .source,
    "CSV",
  );
  const bad = csv.replace("CSV-KPI", "NEW-KPI") + "bad,row\r\n";
  await call("/import/commit", "POST", { csv: bad }, 1, 400);
  check(
    (
      await exec(
        "SELECT count(*)::int n FROM app.kpi_goals WHERE code='NEW-KPI'",
      )
    ).rows[0].n,
    0,
  );
  // Inject audit failure to prove atomic mutation rollback, never affecting schema app.
  await exec(
    `CREATE FUNCTION app.fail_kpi_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='KPI_CREATE' THEN RAISE EXCEPTION 'W3-P2 injected audit failure'; END IF; RETURN NEW; END $$`,
  );
  await exec(
    "CREATE TRIGGER fail_kpi_audit BEFORE INSERT ON app.audit_logs FOR EACH ROW EXECUTE FUNCTION app.fail_kpi_audit()",
  );
  await call("/goals", "POST", { ...goal, code: "ROLLBACK" }, 1, 500);
  check(
    (
      await exec(
        "SELECT count(*)::int n FROM app.kpi_goals WHERE code='ROLLBACK'",
      )
    ).rows[0].n,
    0,
  );
  await exec("DROP TRIGGER fail_kpi_audit ON app.audit_logs");
  let deletion = await call(
    "/goals",
    "POST",
    { ...goal, code: "DELETE" },
    1,
    201,
  );
  await call(`/goals/${deletion.goal_id}`, "DELETE", {
    version: deletion.version,
  });
  let dr = await call(`/goals/${cg.goal_id}/result`, "DELETE", { version: 1 });
  check(dr.source, "CSV");
  await exec("UPDATE app.user_roles SET revoked_at=NOW() WHERE user_id=1");
  await call("/goals", "GET", null, 1, 403);
  await call(
    path + "/result",
    "POST",
    { actual: 1, sourceNote: "x", evidenceNote: "x" },
    1,
    403,
  );
  check(
    (
      await exec(
        "SELECT count(*)::int n FROM app.award_records WHERE created_by=1",
      )
    ).rows[0].n,
    0,
  );
  console.log(
    `W3-P2 integration: ${passed} assertions PASS; real Express/pg/Supabase; isolated synthetic schema, rollback; injected 500 expected`,
  );
} finally {
  if (server) await new Promise((r) => server.close(r));
  if (client) {
    await client.query("ROLLBACK");
    client.release();
  }
  setPool(null);
  try {
    check(
      (
        await pool.query("SELECT 1 FROM pg_namespace WHERE nspname=$1", [
          schema,
        ])
      ).rowCount,
      0,
    );
  } finally {
    await pool.end();
  }
}
