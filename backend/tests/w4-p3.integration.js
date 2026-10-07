// Real Express + pg + Supabase tests in a temporary schema, entirely rolled back.
// No seed or migration is applied to the shared app schema.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool, getDbPoolConfig, setPool } from "../src/config/database.js";
import { generateAccessToken } from "../src/utils/crypto.js";
import app from "../src/app.js";

const schema = `w4p3_test_${randomBytes(6).toString("hex")}`;
assert.match(schema, /^w4p3_test_[a-f0-9]{12}$/);
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

  if (process.argv.includes("--admin-only")) {
    const grant = {
      userId: 2,
      roleId: 4,
      validFrom: "2026-01-01T00:00:00Z",
      validTo: null,
    };
    await call("POST", "/admin/user-roles", grant, 3);
    await call(
      "POST",
      "/admin/scopes",
      { ...grant, unitId: 1, includeDescendants: true },
      3,
    );
    await call("GET", "/award-applications?contextUnitId=2", null, 2);
    console.log(
      "PASS W4-P3 admin: Council role/scope granted through real Admin HTTP API; descendant queue accessible. Isolated schema rolled back.",
    );
  } else {
    const cycle = await call(
      "POST",
      "/award-cycles",
      {
        code: "SYNTHETIC-W4-P3",
        name: "SYNTHETIC council cycle",
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
        lecturerId: 1,
        achievementTypeId: 1,
        title: "SYNTHETIC individual",
        description: "SYNTHETIC evidence for council workflow",
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
      new Blob(["%PDF-1.7 synthetic individual"], { type: "application/pdf" }),
      "synthetic.pdf",
    );
    const er = await fetch(base + "/achievements/" + aid + "/evidences", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokens[1] },
      body: ev,
    });
    assert.equal(er.status, 201);
    await call("POST", "/achievements/" + aid + "/submit", { version: 1 }, 1);
    await call("POST", "/achievements/" + aid + "/verify", { version: 2 }, 2);
    const application = await call(
      "POST",
      "/award-applications",
      {
        lecturerId: 1,
        cycleId: Number(cycle.award_period_id),
        targetAwardTypeId: 1,
        purpose: "SYNTHETIC council proposal",
        achievementIds: [Number(aid)],
      },
      1,
      201,
    );
    await call(
      "POST",
      "/award-applications/" + application.application_id + "/submit",
      { version: 1 },
      1,
    );
    await call(
      "POST",
      "/award-applications/" + application.application_id + "/forward",
      { version: 2, reason: "SYNTHETIC unit opinion" },
      2,
    );
    const frozen = await call(
      "GET",
      "/award-applications/" + application.application_id,
      null,
      1,
    );
    const recordedCount = (
      await client.query(
        rewrite("SELECT COUNT(*)::int n FROM app.award_records"),
      )
    ).rows[0].n;
    // W4-P3: real roles/scopes, reviewer assignment, correction and recommendation.
    for (const userId of [2,1,4]) {
      const grant={userId,roleId:4,validFrom:'2026-01-01T00:00:00Z',validTo:null};
      await call('POST','/admin/user-roles',grant,3);
      await call('POST','/admin/scopes',{...grant,unitId:1,includeDescendants:true},3);
    }
    await call(
      "POST",
      "/award-decisions",
      {
        decisionNumber: "SYNTHETIC-DENIED",
        decisionDate: "2026-10-07",
        issuer: "SYNTHETIC",
        title: "SYNTHETIC",
      },
      2,
      403,
    );
    await call(
      "POST",
      "/award-records",
      { lecturerId: 1, awardTypeId: 1, decisionId: 1, recognitionYear: 2026 },
      2,
      403,
    );
    await call("GET", "/award-applications?contextUnitId=99999", null, 2, 403);
    const path = "/award-applications/" + application.application_id;
    const post = (action, version, user = 2, extra = {}, expected = 200) =>
      call(
        "POST",
        path + "/" + action,
        { version, reason: "SYNTHETIC council opinion", ...extra },
        user,
        expected,
      );
    await post("comment", 3, 2, {}, 403); // unassigned
    await post("assign", 3, 2, { reviewerId: 1 }, 403); // subject cannot review
    await post("assign", 3, 3, { reviewerId: 2 }, 403); // Admin is not Council
    await post("assign", 3, 2, { reviewerId: 2 });
    await post("comment", 3, 2, {}, 409);
    await post("comment", 4);
    // Inject real DB write failures and verify atomic rollback through HTTP.
    const beforeFailure = await call("GET", path, null, 2);
    for (const table of ["notifications", "audit_logs"]) {
      await client.query(
        rewrite(
          "CREATE OR REPLACE FUNCTION app.w4p3_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic transaction failure'; END; $$",
        ),
      );
      await client.query(
        rewrite(
          "CREATE TRIGGER w4p3_fail BEFORE INSERT ON app." +
            table +
            " FOR EACH ROW EXECUTE FUNCTION app.w4p3_test_failure()",
        ),
      );
      await post("request-correction", 5, 2, {}, 500);
      const retained = await call("GET", path, null, 2);
      assert.equal(retained.version, beforeFailure.version);
      assert.deepEqual(retained.comments, beforeFailure.comments);
      assert.deepEqual(retained.histories, beforeFailure.histories);
      await client.query(rewrite("DROP TRIGGER w4p3_fail ON app." + table));
    }
    await post("request-correction", 5);
    await post("recommend", 6, 2, {}, 409);
    await post("resubmit", 6, 1);
    await call(
      "POST",
      path + "/forward",
      { version: 7, reason: "SYNTHETIC unit recheck" },
      2,
    );
    await post("recommend", 8);
    const completed = await call("GET", path, null, 2);
    assert.equal(completed.status, "RECOMMENDED");
    assert.deepEqual(completed.input, frozen.input);
    await post("recommend", 9, 2, {}, 409);
    const inbox = await call("GET", "/notifications", null, 2);
    assert.ok(inbox.items.some((n) => n.entityType === "APPLICATION"));
    assert.equal(
      (
        await client.query(
          rewrite("SELECT COUNT(*)::int n FROM app.award_records"),
        )
      ).rows[0].n,
      recordedCount,
    );
    // A collective goes through real submit + unit forwarding + Council as well.
    const ca = await call(
      "POST",
      "/achievements",
      {
        subjectType: 'UNIT',
        organizationUnitId: 2,
        achievementTypeId: 2,
        title: "SYNTHETIC collective",
        description: "SYNTHETIC evidence for collective",
        recognitionYear: 2026,
      },
      4,
      201,
    );
    const collectiveAid = { achievement_id: ca.achievementId };
    const ce = new FormData();
    ce.append("title", "SYNTHETIC evidence");
    ce.append(
      "file",
      new Blob(["%PDF-1.7 synthetic collective"], { type: "application/pdf" }),
      "synthetic.pdf",
    );
    const cr = await fetch(
      base + "/achievements/" + ca.achievementId + "/evidences",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + tokens[4] },
        body: ce,
      },
    );
    assert.equal(cr.status, 201);
    await call(
      "POST",
      "/achievements/" + ca.achievementId + "/submit",
      { version: 1 },
      4,
    );
    await call(
      "POST",
      "/achievements/" + ca.achievementId + "/verify",
      { version: 2 },
      2,
    );
    const collectiveApp = await call(
      "POST",
      "/award-applications",
      {
        organizationUnitId: 2,
        cycleId: Number(cycle.award_period_id),
        targetAwardTypeId: 4,
        purpose: "SYNTHETIC collective council",
        achievementIds: [Number(collectiveAid.achievement_id)],
      },
      4,
      201,
    );
    const cp = "/award-applications/" + collectiveApp.application_id;
    await call("POST", cp + "/submit", { version: 1 }, 4);
    await call(
      "POST",
      cp + "/forward",
      { version: 2, reason: "SYNTHETIC unit opinion" },
      2,
    );
    await call(
      "POST",
      cp + "/assign",
      { version: 3, reason: "SYNTHETIC assignment", reviewerId: 4 },
      2,
      403,
    );
    await call(
      "POST",
      cp + "/assign",
      { version: 3, reason: "SYNTHETIC assignment", reviewerId: 2 },
      2,
    );
    await call(
      "POST",
      cp + "/not-recommend",
      { version: 4, reason: "SYNTHETIC insufficient grounds" },
      2,
    );
    await client.query(
      rewrite(
        "UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL '1 second' WHERE user_id=2 AND role_id IN(3,4)",
      ),
    );
    await call("GET", path, null, 2, 403);
    const expiredInbox = await call("GET", "/notifications", null, 2);
    assert.ok(expiredInbox.items.every((n) => n.entityType !== "APPLICATION"));
    assert.equal(
      (
        await client.query(
          rewrite("SELECT COUNT(*)::int n FROM app.award_records"),
        )
      ).rows[0].n,
      recordedCount,
    );

    console.log(
      `PASS W4-P3: ${passed} real HTTP checks plus PostgreSQL invariants. Isolated schema rolled back.`,
    );
  }
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
