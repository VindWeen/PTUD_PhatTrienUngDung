import test from "node:test";
import assert from "node:assert/strict";
import { ApplicationService } from "../src/modules/awards/applicationService.js";

test("Council requires active role, scope, assignment and prohibits individual/collective self-review", async () => {
  const row = {
    application_id: 1,
    context_unit_id: 2,
    lecturer_id: 1,
    created_by: 1,
  };
  const c = { query: async () => ({ rows: [] }) };
  const s = new ApplicationService({
    roles: async () => ["ADMIN"],
    scope: async () => true,
  });
  await assert.rejects(
    s.council({ userId: 2 }, row, c),
    (e) => e.statusCode === 403,
  );
  s.roles = async () => ["COUNCIL"];
  s.scope = async () => false;
  await assert.rejects(
    s.council({ userId: 2 }, row, c),
    (e) => e.statusCode === 403,
  );
  s.scope = async () => true;
  await assert.rejects(
    s.council({ userId: 1 }, row, c),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    s.council({ userId: 2 }, { ...row, lecturer_id: null, unit_id: 2 }, c),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    s.council({ userId: 2 }, row, c, true),
    (e) => e.statusCode === 403,
  );
  await s.council({ userId: 2 }, row, c);
});

test("stale versions, wrong states, notification/audit failures roll back; no AwardRecord writes", async () => {
  for (const failure of ["version", "state", "notification", "audit"]) {
    const calls = [];
    const c = {
      query: async (sql) => {
        calls.push(sql);
        return {
          rows: sql.startsWith("UPDATE")
            ? [{ application_id: 1, status: "RECOMMENDED", version: 3 }]
            : [],
        };
      },
      release() {},
    };
    const s = new ApplicationService({
      pool: () => ({ connect: async () => c }),
      audit: async () => {
        if (failure === "audit") throw Error("audit failed");
      },
    });
    s.get = async () => ({
      application_id: 1,
      version: 2,
      status: failure === "state" ? "SUBMITTED" : "UNDER_REVIEW",
    });
    s.council = async () => {};
    s.applicationNotice = async () => {
      if (failure === "notification") throw Error("notification failed");
    };
    await assert.rejects(
      s.review(
        1,
        { version: failure === "version" ? 1 : 2, reason: "Confirmed opinion" },
        { userId: 2 },
        "recommend",
      ),
    );
    assert.ok(calls.includes("ROLLBACK"));
    assert.ok(!calls.includes("COMMIT"));
    assert.ok(
      !calls.some(
        (sql) =>
          sql.includes("award_records") || sql.includes("award_decisions"),
      ),
    );
  }
});

test("review request rejects decision/status injection and short reasons", async () => {
  const s = new ApplicationService();
  for (const extra of [
    { decisionId: 1 },
    { status: "RECORDED" },
    { reason: "bad" },
  ]) {
    await assert.rejects(
      s.review(
        1,
        { version: 1, reason: "Confirmed opinion", ...extra },
        { userId: 2 },
        "recommend",
      ),
    );
  }
});
