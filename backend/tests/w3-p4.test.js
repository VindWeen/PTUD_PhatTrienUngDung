import test from "node:test";
import assert from "node:assert/strict";
import {
  readJson,
  benchmark,
  fixture,
  materialize,
} from "../../scripts/w3-p4-eval.mjs";
import { evaluationRunSchema } from "../src/modules/ai/evaluationSchemas.js";
import { AiService } from "../src/modules/ai/aiService.js";
const dev = readJson("docs/ai/eval-dev/cases.dev.json");
test("development corpus has 12 labelled anonymous cases and required edge coverage", () => {
  assert.ok(dev.cases.length >= 12);
  assert.equal(benchmark().passed, dev.cases.length);
  const labels = new Set(dev.cases.flatMap((c) => c.expectedIssues));
  for (const label of [
    "MISSING_DATA",
    "YEAR_GAP",
    "DUPLICATE_YEAR",
    "REVOKED_SOURCE",
    "RULE_CHANGED",
    "UNAPPROVED_DOCUMENT",
    "UNAPPROVED_CRITERION",
    "SIMULATED_KPI",
  ])
    assert.ok(labels.has(label));
});
test("final split has no subject/group or case overlap; only integrity checked here", () => {
  const final = readJson("docs/ai/eval-final/cases.final.json");
  for (const c of final.cases)
    assert.ok(!dev.cases.some((d) => d.id === c.id || d.groupId === c.groupId));
  const subjects = dev.cases.map((c, i) => materialize(c, i).subject.subjectId);
  final.cases.forEach((c, i) =>
    assert.ok(!subjects.includes(materialize(c, i).subject.subjectId)),
  );
  // Do not run benchmark(final) in development tests.
});
test("EvaluationRun fixtures pass contract and forbid manufactured eligibility/award", () => {
  dev.cases.forEach((c, i) => {
    const item = fixture(c, i);
    assert.ok(evaluationRunSchema.safeParse(item.run).success);
    assert.equal(item.run.criterionResults[0].legalReferences.length, 0);
    assert.ok(item.basis.every((b) => /^[a-f0-9]{64}$/.test(b.sha256)));
    assert.equal(
      evaluationRunSchema.safeParse({
        ...item.run,
        automaticAwardGranted: true,
      }).success,
      false,
    );
    assert.equal(
      evaluationRunSchema.safeParse({
        ...item.run,
        overallConclusion: "ELIGIBLE",
      }).success,
      false,
    );
  });
});
const version = {
  is_confirmed: true,
  lhu_application_status: "CONFIRMED_LHU_POLICY",
  effective_from: "2020-01-01",
  effective_to: null,
};
const criterion = {
  criterion_code: "SYNTHETIC",
  name: "Synthetic test",
  is_confirmed: true,
  version_id: 1,
  target_type: "INDIVIDUAL",
};
test("source gates fail before provider for unapproved criteria, documents or revoked data", async () => {
  let calls = 0;
  const v = { ...version },
    c = { ...criterion },
    a = {
      achievementId: 1,
      subjectType: "LECTURER",
      status: "VERIFIED",
      title: "Synthetic",
      achievementTypeId: 1,
    };
  const s = new AiService({
    providerName: "mock",
    regulations: {
      findCriteriaVersionById: async () => c,
      findVersionById: async () => v,
    },
    readAchievement: async () => a,
  });
  s.completeWithRetry = async () => {
    calls++;
    return { content: "mock", isMock: true };
  };
  c.is_confirmed = false;
  await assert.rejects(
    s.evaluateCriterion({ criterionId: 1, achievementId: 1 }, { userId: 1 }),
    /chưa được xác nhận/,
  );
  c.is_confirmed = true;
  v.is_confirmed = false;
  await assert.rejects(
    s.evaluateCriterion({ criterionId: 1, achievementId: 1 }, { userId: 1 }),
    /Nguồn chưa/,
  );
  v.is_confirmed = true;
  a.status = "REVOKED";
  await assert.rejects(
    s.evaluateCriterion({ criterionId: 1, achievementId: 1 }, { userId: 1 }),
    /VERIFIED/,
  );
  assert.equal(calls, 0);
});
test("AI keeps authorization, rejects missing subject and expired version", async () => {
  const s = new AiService({
    providerName: "mock",
    readAchievement: async (user, id) => {
      assert.equal(user.userId, 1);
      assert.equal(id, 7);
      throw Object.assign(Error("forbidden"), { statusCode: 403 });
    },
  });
  await assert.rejects(
    s.evaluateCriterion({ criterionId: 1, achievementId: 7 }, { userId: 1 }),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    s.evaluateCriterion({ criterionId: 1 }, { userId: 1 }),
    /Thiếu achievementId/,
  );
  s.regulations = {
    findVersionById: async () => ({ ...version, effective_to: "2020-01-02" }),
  };
  await assert.rejects(s.assertConfirmedVersion(1), /hiệu lực/);
});
test("smoke rejects unconfirmed chunk parent before any provider call", async () => {
  const s = new AiService({
    providerName: "mock",
    regulations: {
      findChunkById: async () => ({ version_id: 1 }),
      findVersionById: async () => ({ ...version, is_confirmed: false }),
    },
  });
  s.completeWithRetry = async () => assert.fail("provider must not run");
  await assert.rejects(s.executeSmokeTest({ chunkId: 1 }), /Nguồn chưa/);
});
