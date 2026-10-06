// Real Express/pg/Supabase with synthetic data and rollback. Provider forced MOCK.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { Pool, getDbPoolConfig, setPool } from "../src/config/database.js";
import { generateAccessToken } from "../src/utils/crypto.js";
import storage from "../src/modules/evidences/storage/localStorageAdapter.js";
import app from "../src/app.js";
const schema = `w3p4_test_${randomBytes(6).toString("hex")}`;
assert.match(schema, /^w3p4_test_[a-f0-9]{12}$/);
const rewrite = (sql) => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({
  ...getDbPoolConfig(),
  max: 1,
  connectionTimeoutMillis: 10000,
});
let client,
  server,
  passed = 0;
const physicalKeys = new Set(),
  save = storage.saveFile.bind(storage);
storage.saveFile = async (key, bytes) => {
  await save(key, bytes);
  physicalKeys.add(key);
};
const check = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  passed++;
};
const observations = [];
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout='25s'");
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
  const db = (sql, values) => client.query(rewrite(sql), values);
  let tx = 0;
  const adapted = async (sql, values) => {
    if (sql === "BEGIN") return client.query(`SAVEPOINT w3p4_mutation_${++tx}`);
    if (sql === "COMMIT")
      return client.query(`RELEASE SAVEPOINT w3p4_mutation_${tx}`);
    if (sql === "ROLLBACK")
      return client.query(`ROLLBACK TO SAVEPOINT w3p4_mutation_${tx}`);
    return db(sql, values);
  };
  setPool({
    query: adapted,
    connect: async () => ({ query: adapted, release() {} }),
  });
  const roles = {
    1: ["LECTURER"],
    2: ["MANAGER", "LECTURER"],
    3: ["ADMIN"],
    4: ["LECTURER", "UNIT_REPRESENTATIVE"],
    5: ["RECORDS_OFFICER"],
  };
  const tokens = Object.fromEntries(
    Object.entries(roles).map(([id, r]) => [
      id,
      generateAccessToken({ userId: Number(id), roles: r }),
    ]),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function call(method, path, body, user = 1, status = 200) {
    const res = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[user]}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    check(
      res.status,
      status,
      `${method} ${path}: ${JSON.stringify(json.error || {})}`,
    );
    return json.data;
  }
  async function upload(path, content) {
    const form = new FormData();
    form.append("title", "W3-P4 SYNTHETIC evidence");
    form.append(
      "file",
      new Blob([content], { type: "application/pdf" }),
      "w3-p4-synthetic.pdf",
    );
    const res = await fetch(base + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens[1]}` },
      body: form,
    });
    const json = await res.json();
    check(res.status, 201, "private upload");
    return json.data;
  }
  const goal = await call(
    "POST",
    "/kpi/goals",
    {
      code: "W3P4-SYNTHETIC",
      title: "KPI MO PHONG — W3-P4",
      measureUnit: "bản ghi mô phỏng",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      target: 2,
      plan: "Synthetic",
      sourceNote: "MO PHONG — không phải tiêu chí LHU",
    },
    1,
    201,
  );
  await call("POST", `/kpi/goals/${goal.goal_id}/accept`, { version: 1 });
  const result = await call(
    "POST",
    `/kpi/goals/${goal.goal_id}/result`,
    {
      actual: 2,
      sourceNote: "MO PHONG",
      evidenceNote: "SYNTHETIC — chưa được xác nhận",
    },
    1,
    201,
  );
  const linked = await call(
    "POST",
    `/kpi/goals/${goal.goal_id}/result/draft`,
    { version: Number(result.version), achievementTypeId: 1 },
    1,
    201,
  );
  const aid = Number(linked.achievement_id);
  check(
    (await call("GET", `/achievements/${aid}`)).status,
    "DRAFT",
    "KPI only creates DRAFT",
  );
  const bytes1 = "%PDF-1.7 W3-P4 SYNTHETIC version1",
    bytes2 = "%PDF-1.7 W3-P4 SYNTHETIC version2";
  const evidence = await upload(`/achievements/${aid}/evidences`, bytes1);
  await call("POST", `/achievements/${aid}/submit`, { version: 1 });
  const frozen1 = (
    await db(
      "SELECT * FROM app.achievement_submissions WHERE achievement_id=$1",
      [aid],
    )
  ).rows;
  const files1 = (
    await db(
      "SELECT f.* FROM app.submission_evidence_files s JOIN app.evidence_files f USING(evidence_file_id) JOIN app.achievement_submissions a USING(submission_id) WHERE a.achievement_id=$1",
      [aid],
    )
  ).rows;
  await call(
    "POST",
    `/achievements/${aid}/request-correction`,
    { version: 2, reason: "SYNTHETIC cần bản bổ sung" },
    2,
  );
  const newFile = await upload(
    `/evidences/${evidence.evidenceId}/versions`,
    bytes2,
  );
  check(newFile.versionNo, 2, "file v2");
  await call("POST", `/achievements/${aid}/resubmit`, { version: 3 });
  const frozen2 = (
    await db(
      "SELECT * FROM app.achievement_submissions WHERE achievement_id=$1 ORDER BY revision_no",
      [aid],
    )
  ).rows;
  check(frozen2[0], frozen1[0], "revision 1 is unchanged after resubmit");
  check(frozen2.length, 2, "two revisions");
  const refs = (
    await db(
      "SELECT a.revision_no,f.version_no FROM app.achievement_submissions a JOIN app.submission_evidence_files s USING(submission_id) JOIN app.evidence_files f USING(evidence_file_id) WHERE a.achievement_id=$1 ORDER BY a.revision_no",
      [aid],
    )
  ).rows;
  check(
    refs,
    [
      { revision_no: 1, version_no: 1 },
      { revision_no: 2, version_no: 2 },
    ],
    "frozen file references",
  );
  for (const [f, bytes] of [
    [files1[0], bytes1],
    [{ evidence_file_id: newFile.evidenceFileId }, bytes2],
  ]) {
    const res = await fetch(
      `${base}/evidence-files/${f.evidence_file_id}/download`,
      { headers: { Authorization: `Bearer ${tokens[1]}` } },
    );
    check(res.status, 200, "private download");
    check(await res.text(), bytes, "old/new bytes retained");
  }
  check(
    files1[0].sha256_hash,
    createHash("sha256").update(bytes1).digest("hex"),
    "SHA matches bytes",
  );
  await call("POST", `/achievements/${aid}/verify`, { version: 4 }, 2);
  await call(
    "PATCH",
    `/achievements/${aid}`,
    { version: 5, title: "Mutate VERIFIED" },
    1,
    409,
  );
  await call("DELETE", `/evidences/${evidence.evidenceId}`, null, 1, 409);
  await call("GET", `/achievements/${aid}/submissions`, null, 4, 403);
  // Real regulation APIs: the word confirmed here is only an isolated synthetic test flag.
  const doc = await call(
    "POST",
    "/regulations",
    {
      documentCode: "W3P4-SYNTHETIC",
      title: "W3-P4 SYNTHETIC — NOT LHU POLICY",
      documentType: "GUIDELINE",
      issuingAuthority: "Synthetic harness",
    },
    3,
    201,
  );
  const v1 = await call(
    "POST",
    `/regulations/${doc.document_id}/versions`,
    {
      versionNumber: "1",
      effectiveFrom: "2020-01-01",
      isOfficial: false,
      lhuApplicationStatus: "SIMULATION_ONLY",
      contentForHash: "W3-P4 synthetic source v1",
    },
    3,
    201,
  );
  const chunks = await call(
    "POST",
    `/regulations/versions/${v1.version_id}/chunks`,
    {
      chunks: [
        {
          articleNo: "TEST SECTION",
          clauseNo: "1",
          content: "SYNTHETIC software test; no eligibility rule",
        },
      ],
    },
    3,
    201,
  );
  const criterion = await call(
    "POST",
    `/regulations/versions/${v1.version_id}/criteria`,
    {
      criterionCode: "W3P4-SYNTHETIC",
      name: "Synthetic guard only",
      targetType: "INDIVIDUAL",
      minThreshold: 2,
      unitMetric: "synthetic",
    },
    3,
    201,
  );
  const evalBody = {
    criterionId: Number(criterion.criteria_version_id),
    achievementId: aid,
    provider: "mock",
  };
  await call("POST", "/ai/evaluate-criterion", evalBody, 4, 403);
  await call("POST", "/ai/evaluate-criterion", evalBody, 1, 400);
  await call(
    "POST",
    "/ai/smoke-test",
    { chunkId: Number(chunks[0].chunk_id), provider: "mock" },
    1,
    400,
  );
  await call(
    "PATCH",
    `/regulations/criteria/${criterion.criteria_version_id}/confirm`,
    {
      isConfirmed: true,
      notes: "SYNTHETIC DB flag only, not professional confirmation",
    },
    3,
  );
  await call("POST", "/ai/evaluate-criterion", evalBody, 1, 400); // child confirmed, parent unconfirmed
  await call(
    "PATCH",
    `/regulations/versions/${v1.version_id}/confirm`,
    {
      isConfirmed: true,
      lhuApplicationStatus: "CONFIRMED_LHU_POLICY",
      confirmationNotes: "SYNTHETIC isolated harness flag; NOT actual policy",
    },
    3,
  );
  const answer = await call("POST", "/ai/evaluate-criterion", evalBody);
  check(answer.isMock, true, "provider is forced mock");
  check(answer.automaticAward, false, "no auto award");
  check(
    answer.analysis.includes("không kết luận đủ điều kiện"),
    true,
    "mock does not manufacture eligibility",
  );
  const v2 = await call(
    "POST",
    `/regulations/${doc.document_id}/versions`,
    {
      versionNumber: "2",
      effectiveFrom: "2026-06-01",
      supersedesVersionId: Number(v1.version_id),
      isOfficial: false,
      lhuApplicationStatus: "SIMULATION_ONLY",
      contentForHash: "W3-P4 synthetic source v2",
    },
    3,
    201,
  );
  check(
    String(v2.supersedes_version_id),
    String(v1.version_id),
    "version chain",
  );
  const oldVersion = await call(
    "GET",
    `/regulations/versions/${v1.version_id}`,
  );
  check(oldVersion.sha256_hash, v1.sha256_hash, "old document hash retained");
  await call("POST", "/ai/evaluate-criterion", evalBody, 1, 400); // predecessor expired
  const boundary = await call("GET", "/regulations?asOfDate=2026-06-01");
  check(
    boundary.find((d) => d.document_code === "W3P4-SYNTHETIC").active_versions
      .length,
    2,
    "review: inclusive boundary returns both versions",
  );
  observations.push({
    id: "W3P4-R03",
    finding: "Both predecessor and successor returned at effective boundary",
    evidence: "2 active_versions at 2026-06-01",
  });
  await call(
    "POST",
    `/achievements/${aid}/revoke`,
    { version: 5, reason: "SYNTHETIC revoke review" },
    2,
  );
  check(
    (
      await db(
        "SELECT * FROM app.achievement_submissions WHERE achievement_id=$1 ORDER BY revision_no",
        [aid],
      )
    ).rows,
    frozen2,
    "revoke preserves snapshots",
  );
  await call("POST", "/ai/evaluate-criterion", evalBody, 1, 400);
  // Probe DB-level immutability with a savepoint; revert immediately, never alter shared data.
  await client.query("SAVEPOINT review_probe");
  await db(
    "UPDATE app.achievement_submissions SET snapshot_data='{}'::jsonb WHERE submission_id=$1",
    [frozen2[0].submission_id],
  );
  check(
    (
      await db(
        "SELECT snapshot_data FROM app.achievement_submissions WHERE submission_id=$1",
        [frozen2[0].submission_id],
      )
    ).rows[0].snapshot_data,
    {},
    "review: DB currently permits snapshot update",
  );
  await client.query("ROLLBACK TO SAVEPOINT review_probe");
  observations.push({
    id: "W3P4-R01",
    finding: "achievement_submissions has no DB update/delete guard",
    evidence: "UPDATE permitted in rolled-back schema",
  });
  await fs.writeFile(
    new URL(
      "../../docs/testing/week-3/W3_P4_INTEGRATION_RESULT.json",
      import.meta.url,
    ),
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        mode: "REAL_EXPRESS_SUPABASE_MOCK_PROVIDER",
        passed,
        observations,
        professionalConfirmation: false,
        automaticAwardGranted: false,
        sharedSchemaModified: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS W3-P4: ${passed} real HTTP/PostgreSQL checks; ${observations.length} review findings reproduced; outer rollback.`,
  );
} finally {
  if (server) await new Promise((r) => server.close(r));
  if (client) {
    await client.query("ROLLBACK");
    client.release();
  }
  await pool.end();
  for (const key of physicalKeys) await storage.deleteFile(key);
}
