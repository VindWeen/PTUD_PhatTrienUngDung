import test from "node:test";
import assert from "node:assert/strict";
import {
  ApplicationService,
  applicationSchema,
  cycleSchema,
} from "../src/modules/awards/applicationService.js";
import { AwardService } from "../src/modules/awards/awardService.js";
test("strict application input prohibits award decision/state injection and duplicate IDs", () => {
  const b = {
    lecturerId: 1,
    cycleId: 1,
    targetAwardTypeId: 1,
    purpose: "Synthetic purpose",
    achievementIds: [1],
  };
  assert.ok(applicationSchema.safeParse(b).success);
  for (const extra of [
    { status: "RECORDED" },
    { decisionId: 1 },
    { organizationUnitId: 2 },
    { achievementIds: [1, 1] },
  ])
    assert.equal(
      applicationSchema.safeParse({ ...b, ...extra }).success,
      false,
    );
  assert.equal(
    cycleSchema.safeParse({
      code: "X",
      name: "X",
      startDate: "2026-02-30",
      endDate: "2026-03-01",
    }).success,
    false,
  );
});
test("applicant rights use active DB roles and current subject ownership", async () => {
  const s = new ApplicationService({
    roles: async () => ["LECTURER"],
    scope: async () => false,
  });
  await s.applicant(
    { userId: 1 },
    { lecturer_id: 1 },
    { query: async () => ({ rows: [{}] }) },
  );
  await assert.rejects(
    s.applicant(
      { userId: 1 },
      { lecturer_id: 2 },
      { query: async () => ({ rows: [] }) },
    ),
    (e) => e.statusCode === 403,
  );
  const awards = new AwardService({ roles: async () => ["LECTURER"] });
  await assert.rejects(
    awards.authorize({ userId: 1, roles: ["RECORDS_OFFICER"] }),
    (e) => e.statusCode === 403,
  );
});
test("submit requires sources, enforces current statuses and a revision", async () => {
  const s = new ApplicationService();
  s.validateTarget = async () => ({ cycle: {}, target: {} });
  const r = { lecturer_id: 1, achievement_ids: [], award_record_ids: [] };
  await assert.rejects(s.snapshot({}, r, { userId: 1 }), /VERIFIED/);
  r.achievement_ids = [1];
  await assert.rejects(
    s.snapshot(
      {
        query: async () => ({ rows: [{ lecturer_id: 1, status: "REVOKED" }] }),
      },
      r,
      { userId: 1 },
    ),
    /VERIFIED/,
  );
  const c = {
    query: async (sql) => ({
      rows: sql.includes("app.achievements")
        ? [{ lecturer_id: 1, status: "VERIFIED" }]
        : [],
    }),
  };
  await assert.rejects(s.snapshot(c, r, { userId: 1 }), /revision/);
});
test("stale version rolls back before snapshot; audit failure also rolls back", async () => {
  const calls = [];
  const c = {
    query: async (sql) => {
      calls.push(sql);
      return { rows: [] };
    },
    release() {},
  };
  const s = new ApplicationService({
    pool: () => ({ connect: async () => c }),
    audit: async () => {
      throw Error("audit failure");
    },
  });
  s.get = async () => ({ application_id: 1, version: 2 });
  await assert.rejects(
    s.transition(1, { version: 1 }, { userId: 1 }, "submit"),
    (e) => e.statusCode === 409,
  );
  assert.ok(calls.includes("ROLLBACK"));
  assert.ok(!calls.some((s) => s.includes("INSERT")));
  await assert.rejects(
    s.transaction({ userId: 1 }, "TEST", async () => ({ application_id: 1 })),
    /audit failure/,
  );
  assert.ok(!calls.includes("COMMIT"));
});
test("snapshot rejects missing private file and revoked award; strips storage keys", async () => {
  let exists = false,
    awardStatus = "REVOKED";
  const s = new ApplicationService({
    adapter: { fileExists: async () => exists },
  });
  s.validateTarget = async () => ({ cycle: {}, target: {} });
  const r = { lecturer_id: 1, achievement_ids: [1], award_record_ids: [1] };
  const c = {
    query: async (sql) => ({
      rows: sql.includes("app.achievements")
        ? [{ lecturer_id: 1, status: "VERIFIED", version: "3" }]
        : sql.includes("app.achievement_submissions")
          ? [{ submission_id: 1, revision_no: 1 }]
          : sql.includes("app.submission_evidence_files")
            ? [{ evidence_file_id: 1, version_no: 1, storage_key: "synthetic" }]
            : sql.includes("app.award_records")
              ? [{ lecturer_id: 1, status: awardStatus, decision_id: 1 }]
              : sql.includes("app.award_decision_files")
                ? [
                    {
                      decision_file_id: 1,
                      version_no: 1,
                      storage_key: "synthetic",
                    },
                  ]
                : [{}],
    }),
  };
  await assert.rejects(s.snapshot(c, r, { userId: 1 }), /file private/);
  exists = true;
  await assert.rejects(s.snapshot(c, r, { userId: 1 }), /RECORDED/);
  awardStatus = "RECORDED";
  const frozen = await s.snapshot(c, r, { userId: 1 });
  assert.equal(frozen.achievements[0].files[0].storage_key, undefined);
  assert.equal(frozen.awards[0].files[0].storage_key, undefined);
  assert.equal(frozen.criteriaEvaluation, null);
});
test("active representative scope is required; Manager cannot self-forward", async () => {
  const s = new ApplicationService({
    roles: async () => ["UNIT_REPRESENTATIVE", "MANAGER"],
    scope: async () => false,
  });
  await assert.rejects(
    s.applicant({ userId: 4 }, { unit_id: 3 }, {}),
    (e) => e.statusCode === 403,
  );
  s.scope = async () => true;
  await s.applicant({ userId: 4 }, { unit_id: 3 }, {});
  const c = { query: async () => ({ rows: [{}] }), release() {} };
  s.pool = () => ({ connect: async () => c });
  s.get = async () => ({
    application_id: 1,
    version: 2,
    status: "SUBMITTED",
    created_by: 4,
    context_unit_id: 3,
  });
  await assert.rejects(
    s.transition(
      1,
      { version: 2, reason: "Synthetic opinion" },
      { userId: 4 },
      "forward",
    ),
    (e) => e.statusCode === 403,
  );
});
