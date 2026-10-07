import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidate,
  validatePeriod,
} from "../src/modules/kpi/recommendationService.js";
import { evaluateStructuredCriterion } from "../src/modules/ai/criteriaEvaluator.js";
const criterion = {
  criterionId: 1,
  criterionCode: "DEMO",
  criterionName: "MO PHONG test only",
  isConfirmedByLhu: true,
  isSimulation: false,
  thresholdMetric: {
    targetMin: 3,
    actualRecorded: 1,
    unitMetric: "bài",
    isSatisfied: false,
  },
  legalReferences: [{ documentCode: "TEST" }],
};
test("exact confirmed threshold; planning deadline labelled as assumption", () => {
  const c = buildCandidate(criterion);
  assert.equal(c.target, 3);
  assert.match(c.periodEnd, /^\d{4}-12-31$/);
  assert.equal(c.actualRecorded, 1);
  assert.match(c.assumptions.join(" "), /giả định/);
});
test("unconfirmed, simulation, satisfied and missing evidence blocked", () => {
  for (const change of [
    { isConfirmedByLhu: false },
    { isSimulation: true },
    {
      thresholdMetric: {
        ...criterion.thresholdMetric,
        isSatisfied: "UNCONFIRMED",
      },
    },
    { thresholdMetric: { ...criterion.thresholdMetric, isSatisfied: true } },
    { legalReferences: [] },
  ])
    assert.equal(buildCandidate({ ...criterion, ...change }), null);
});
test("missing threshold/unit blocked instead of inventing defaults", () => {
  for (const change of [
    { targetMin: null },
    { unitMetric: null },
    { actualRecorded: null },
  ])
    assert.equal(
      buildCandidate({
        ...criterion,
        thresholdMetric: { ...criterion.thresholdMetric, ...change },
      }),
      null,
    );
});
test("multi-year requirement preserved and routed for human review", () => {
  const c = buildCandidate({
    ...criterion,
    thresholdMetric: {
      ...criterion.thresholdMetric,
      targetMin: 5,
      unitMetric: "năm",
    },
  });
  assert.equal(c.requiresYearReview, true);
  assert.equal(c.target, 5);
  assert.doesNotThrow(() => validatePeriod(c, c));
  assert.throws(() =>
    validatePeriod(c, { periodStart: "2026-01-01", periodEnd: "2026-12-31" }),
  );
  assert.throws(() =>
    validatePeriod(c, { periodStart: "2026-10-07", periodEnd: "2030-12-31" }),
  );
  assert.doesNotThrow(() =>
    validatePeriod(c, { periodStart: "2027-01-01", periodEnd: "2031-12-31" }),
  );
});
test("pg Date effective windows behave like ISO dates in integrated evaluator", () => {
  const input = {
    subject: { subjectId: 1 },
    criterion: {
      criteriaVersionId: 1,
      criterionCode: "TEST",
      isConfirmed: true,
      minThreshold: 3,
      unitMetric: "bài",
    },
    documentVersion: {
      isConfirmed: true,
      lhuApplicationStatus: "CONFIRMED_LHU_POLICY",
      effectiveFrom: new Date(2020, 0, 1),
      effectiveTo: new Date(2030, 11, 31),
    },
    records: [],
    asOfDate: "2026-10-07",
  };
  const r = evaluateStructuredCriterion(input);
  assert.equal(r.thresholdMetric.isSatisfied, false);
  assert.ok(!r.issues.includes("OUT_OF_EFFECTIVE_WINDOW"));
  assert.ok(!evaluateStructuredCriterion({...input,asOfDate:'2020-01-01'}).issues.includes('OUT_OF_EFFECTIVE_WINDOW'));
  assert.ok(evaluateStructuredCriterion({...input,asOfDate:'2019-12-31'}).issues.includes('OUT_OF_EFFECTIVE_WINDOW'));
  assert.ok(
    evaluateStructuredCriterion({
      ...input,
      asOfDate: "2031-01-01",
    }).issues.includes("OUT_OF_EFFECTIVE_WINDOW"),
  );
});
