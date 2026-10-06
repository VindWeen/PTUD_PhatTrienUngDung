// Real Express + pg + Supabase tests in a temporary schema, entirely rolled back.
// No seed or migration is applied to the shared app schema.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool, getDbPoolConfig, setPool } from "../src/config/database.js";
import { generateAccessToken } from "../src/utils/crypto.js";
import app from "../src/app.js";

const schema = `w3p3_test_${randomBytes(6).toString("hex")}`;
assert.match(schema, /^w3p3_test_[a-f0-9]{12}$/);
const rewrite = (sql) => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({
  ...getDbPoolConfig(),
  max: 1,
  connectionTimeoutMillis: 5000,
});
let client, server;
let passed = 0;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout='20s'");
  const files = (
    await fs.readdir(new URL("../../supabase/migrations/", import.meta.url))
  )
    .filter((v) => v.endsWith(".sql"))
    .sort();
  for (const name of files)
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
  const adapted = {
    query: async (sql, values) => {
      if (sql === "BEGIN") return client.query("SAVEPOINT admin_mutation");
      if (sql === "COMMIT")
        return client.query("RELEASE SAVEPOINT admin_mutation");
      if (sql === "ROLLBACK") {
        await client.query("ROLLBACK TO SAVEPOINT admin_mutation");
        return client.query("RELEASE SAVEPOINT admin_mutation");
      }
      return client.query(rewrite(sql), values);
    },
    release() {},
  };
  let queue = Promise.resolve();
  const serialized = (sql, values) => {
    const result = queue.then(() => adapted.query(sql, values));
    queue = result.catch(() => {});
    return result;
  };
  setPool({
    query: serialized,
    connect: async () => ({ query: serialized, release() {} }),
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const tokens = Object.fromEntries(
    [1, 2, 3, 4, 5].map((id) => [id, generateAccessToken({ userId: id })]),
  );
  async function call(method, path, body, user = 3, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[user]}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(data.error || {})}`,
    );
    passed++;
    return data.data;
  }
  const decision = await call(
    "POST",
    "/award-decisions",
    {
      decisionNumber: "SYNTHETIC-W2-P2",
      decisionDate: "2026-10-05",
      issuer: "Synthetic test",
      title: "Synthetic decision",
    },
    5,
    201,
  );
  const body = {
    lecturerId: 1,
    awardTypeId: 1,
    decisionId: Number(decision.decision_id),
    recognitionYear: 2026,
  };
  await call("POST", "/award-records", body, 3, 403);
  const r = await call("POST", "/award-records", body, 5, 201);
  await call(
    "POST",
    `/award-records/${r.record_id}/record`,
    { version: 1 },
    5,
    400,
  );
  const form = new FormData();
  form.append(
    "file",
    new Blob(["%PDF-1.7 synthetic"], { type: "application/pdf" }),
    "synthetic.pdf",
  );
  const upload = await fetch(
    `${base}/award-decisions/${decision.decision_id}/files`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens[5]}` },
      body: form,
    },
  );
  assert.equal(upload.status, 201, JSON.stringify(await upload.json()));
  passed++;
  await call("POST", `/award-records/${r.record_id}/record`, { version: 1 }, 5);
  await call(
    "POST",
    `/award-records/${r.record_id}/record`,
    { version: 1 },
    5,
    409,
  );
  const dup = await call("POST", "/award-records", body, 5, 201);
  await call(
    "POST",
    `/award-records/${dup.record_id}/record`,
    { version: 1 },
    5,
    409,
  );
  const other = await call(
    "POST",
    "/award-records",
    { ...body, lecturerId: 2 },
    5,
    201,
  );
  await call(
    "POST",
    `/award-records/${other.record_id}/record`,
    { version: 1 },
    5,
  );
  const collective = await call(
    "POST",
    "/award-records",
    {
      organizationUnitId: 2,
      awardTypeId: 4,
      decisionId: Number(decision.decision_id),
      recognitionYear: 2026,
    },
    5,
    201,
  );
  await call(
    "POST",
    `/award-records/${collective.record_id}/record`,
    { version: 1 },
    5,
  );
  const duplicateCollective = await call(
    "POST",
    "/award-records",
    {
      organizationUnitId: 2,
      awardTypeId: 4,
      decisionId: Number(decision.decision_id),
      recognitionYear: 2026,
    },
    5,
    201,
  );
  await call(
    "POST",
    `/award-records/${duplicateCollective.record_id}/record`,
    { version: 1 },
    5,
    409,
  );
  const lockedUpload = await fetch(
    `${base}/award-decisions/${decision.decision_id}/files`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens[5]}` },
      body: form,
    },
  );
  assert.equal(lockedUpload.status, 409);
  passed++;
  const detail = await call("GET", `/award-records/${r.record_id}`, null, 5);
  const download = await fetch(
    `${base}/award-decision-files/${detail.files[0].decision_file_id}/download`,
    { headers: { Authorization: `Bearer ${tokens[5]}` } },
  );
  assert.equal(download.status, 200);
  assert.equal(await download.text(), "%PDF-1.7 synthetic");
  passed++;
  // W3-P3 integrates the actual W2-P2 awards and W3-Q1 submissions.
  await call("POST", "/award-records", body, 1, 403);
  await call(
    "POST",
    "/award-cycles",
    {
      code: "SYNTHETIC-CYCLE",
      name: "Synthetic cycle",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
    },
    1,
    403,
  );
  const cycle = await call(
    "POST",
    "/award-cycles",
    {
      code: "SYNTHETIC-CYCLE",
      name: "Synthetic cycle",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
    },
    5,
    201,
  );
  const ach = await call(
    "POST",
    "/achievements",
    {
      subjectType: "LECTURER",
      achievementTypeId: 1,
      title: "W3-P3 SYNTHETIC achievement",
      recognitionYear: 2026,
    },
    1,
    201,
  );
  const aid = ach.achievementId;
  const ev = new FormData();
  ev.append("title", "SYNTHETIC evidence");
  ev.append(
    "file",
    new Blob(["%PDF-1.7 W3-P3 synthetic evidence"], {
      type: "application/pdf",
    }),
    "w3p3-synthetic.pdf",
  );
  const evResponse = await fetch(`${base}/achievements/${aid}/evidences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens[1]}` },
    body: ev,
  });
  assert.equal(evResponse.status, 201, JSON.stringify(await evResponse.json()));
  passed++;
  const applicationBody = {
    lecturerId: 1,
    cycleId: Number(cycle.award_period_id),
    targetAwardTypeId: 1,
    purpose: "SYNTHETIC proposal",
    achievementIds: [aid],
    awardRecordIds: [Number(r.record_id)],
  };
  await call(
    "POST",
    "/award-applications",
    { ...applicationBody, lecturerId: 2 },
    1,
    403,
  );
  await call(
    "POST",
    "/award-applications",
    { ...applicationBody, status: "RECORDED" },
    1,
    400,
  );
  const empty = await call(
    "POST",
    "/award-applications",
    { ...applicationBody, achievementIds: [] },
    1,
    201,
  );
  await call(
    "POST",
    `/award-applications/${empty.application_id}/submit`,
    { version: 1 },
    1,
    400,
  );
  const application = await call(
    "POST",
    "/award-applications",
    applicationBody,
    1,
    201,
  );
  await call(
    "POST",
    `/award-applications/${application.application_id}/submit`,
    { version: 1 },
    1,
    400,
  );
  await call("POST", `/achievements/${aid}/submit`, { version: 1 }, 1);
  await call("POST", `/achievements/${aid}/verify`, { version: 2 }, 2);
  const recordedCount = (
    await client.query(rewrite("SELECT COUNT(*)::int n FROM app.award_records"))
  ).rows[0].n;
  await call(
    "POST",
    `/award-applications/${application.application_id}/submit`,
    { version: 1 },
    2,
    403,
  );
  await call(
    "POST",
    `/award-applications/${application.application_id}/submit`,
    { version: 1 },
    1,
  );
  await call(
    "POST",
    `/award-applications/${application.application_id}/submit`,
    { version: 1 },
    1,
    409,
  );
  assert.equal(
    (
      await client.query(
        rewrite("SELECT COUNT(*)::int n FROM app.award_records"),
      )
    ).rows[0].n,
    recordedCount,
  );
  passed++;
  const frozen = await call(
    "GET",
    `/award-applications/${application.application_id}`,
    null,
    1,
  );
  assert.equal(frozen.input.input_version, 1);
  assert.equal(frozen.input.snapshot.achievements[0].submission.revision_no, 1);
  assert.equal(frozen.input.snapshot.achievements[0].files.length, 1);
  assert.equal(frozen.input.snapshot.awards[0].record.status, "RECORDED");
  passed++;
  await call(
    "GET",
    `/award-applications/${application.application_id}`,
    null,
    4,
    403,
  );
  await call("GET", "/award-applications?contextUnitId=2", null, 1, 403);
  assert.ok(
    (
      await call("GET", "/award-applications?contextUnitId=2", null, 2)
    ).items.some((a) => a.application_id === application.application_id),
  );
  passed++;
  await call(
    "POST",
    `/award-applications/${application.application_id}/forward`,
    { version: 2, reason: "Synthetic opinion" },
    1,
    403,
  );
  await call(
    "POST",
    `/award-applications/${application.application_id}/forward`,
    { version: 2 },
    2,
    400,
  );
  await call(
    "POST",
    `/award-applications/${application.application_id}/forward`,
    { version: 2, reason: "Synthetic unit opinion" },
    2,
  );
  assert.equal(
    (
      await call(
        "GET",
        `/award-applications/${application.application_id}`,
        null,
        1,
      )
    ).status,
    "COUNCIL_PENDING",
  );
  passed++;
  await call(
    "POST",
    `/achievements/${aid}/revoke`,
    { version: 3, reason: "Synthetic correction" },
    2,
  );
  await call(
    "POST",
    `/award-records/${r.record_id}/revoke`,
    { version: 2 },
    5,
    400,
  );
  await call(
    "POST",
    `/award-records/${r.record_id}/revoke`,
    { version: 2, reason: "Synthetic correction" },
    5,
  );
  assert.deepEqual(
    (
      await call(
        "GET",
        `/award-applications/${application.application_id}`,
        null,
        1,
      )
    ).input,
    frozen.input,
  );
  passed++;
  const stale = await call(
    "POST",
    "/award-applications",
    applicationBody,
    1,
    201,
  );
  await call(
    "POST",
    `/award-applications/${stale.application_id}/submit`,
    { version: 1 },
    1,
    400,
  );
  await client.query("SAVEPOINT immutable_snapshot");
  await assert.rejects(
    client.query(
      rewrite("UPDATE app.award_application_inputs SET input_version=1"),
    ),
    /immutable/,
  );
  await client.query("ROLLBACK TO SAVEPOINT immutable_snapshot");
  passed++;
  const replacement = await call(
    "POST",
    "/award-records",
    { ...body, replacesAwardRecordId: Number(r.record_id) },
    5,
    201,
  );
  assert.equal(
    String(replacement.replaces_award_record_id),
    String(r.record_id),
  );
  passed++;
  await call(
    "POST",
    "/award-records",
    { ...body, lecturerId: 2, replacesAwardRecordId: Number(r.record_id) },
    5,
    400,
  );
  await call(
    "POST",
    `/award-records/${replacement.record_id}/record`,
    { version: 1 },
    5,
  );
  const oldDetail = await call("GET", `/award-records/${r.record_id}`, null, 5);
  assert.deepEqual(oldDetail.files, detail.files);
  assert.equal(oldDetail.histories.length, 3);
  assert.equal(oldDetail.status, "REVOKED");
  passed++;
  const retained = await fetch(
    `${base}/award-decision-files/${detail.files[0].decision_file_id}/download`,
    { headers: { Authorization: `Bearer ${tokens[5]}` } },
  );
  assert.equal(retained.status, 200);
  assert.equal(await retained.text(), "%PDF-1.7 synthetic");
  passed++;
  // Revoke replacement to allow the existing duplicate fixture to be recorded below.
  await call(
    "POST",
    `/award-records/${replacement.record_id}/revoke`,
    { version: 2, reason: "Synthetic cleanup correction" },
    5,
  );
  const { getTitlesAndHonors } =
    await import("../src/modules/profiles/profileRepository.js");
  assert.ok(
    (await getTitlesAndHonors(1)).some(
      (a) => String(a.awardRecordId) === String(r.record_id),
    ),
  );
  passed++;
  await call(
    "POST",
    `/award-records/${dup.record_id}/record`,
    { version: 1 },
    5,
  );
  assert.equal(
    (await call("GET", `/award-records/${r.record_id}`, null, 5)).histories
      .length,
    3,
  );
  await client.query(
    rewrite(
      "UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL '1 second' WHERE user_id=5",
    ),
  );
  await call("GET", `/award-records/${r.record_id}`, null, 5, 403);
  await call("GET", "/award-records?contextUnitId=2", null, 5, 403);
  const forbiddenDownload = await fetch(
    `${base}/award-decision-files/${detail.files[0].decision_file_id}/download`,
    { headers: { Authorization: `Bearer ${tokens[5]}` } },
  );
  assert.equal(forbiddenDownload.status, 403);
  passed++;
  console.log(
    `PASS W3-P3: ${passed} real HTTP/PostgreSQL assertions. Isolated schema rolled back.`,
  );
} finally {
  if (client) {
    const files = await client
      .query(
        rewrite(
          "SELECT storage_key FROM app.award_decision_files UNION ALL SELECT storage_key FROM app.evidence_files",
        ),
      )
      .catch(() => ({ rows: [] }));
    const { default: storage } =
      await import("../src/modules/evidences/storage/localStorageAdapter.js");
    for (const f of files.rows) await storage.deleteFile(f.storage_key);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (client) {
    await client.query("ROLLBACK");
    client.release();
  }
  await pool.end();
}
