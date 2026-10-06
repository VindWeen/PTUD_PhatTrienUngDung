// Deterministic fixture/guard benchmark; never an LLM or eligibility evaluator.
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
const root = new URL("../", import.meta.url);
export const readJson = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
export const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const rules = readJson("docs/ai/eval-dev/rules.json");
export const basisPaths = {
  "W3-Q1": "docs/api/WORKFLOW_W3_Q1.md",
  "W3-Q2": "docs/api/REGULATIONS_W3_Q2.md",
  "W3-P2": "docs/api/KPI_W3_P2.md",
  "W2-P2": "docs/api/AWARDS_W2_P2.md",
  "W1-P4": "docs/ai/BUSINESS_CONFIRMATION_W1_P4.md",
  "SIM-YEARS-v1": "docs/ai/eval-dev/rules.json",
  "SIM-YEARS-v2": "docs/ai/eval-dev/rules.json",
};
export function materialize(c, index = 0) {
  const subjectId = (c.id.startsWith("FINAL") ? 20000 : 10000) + index;
  return {
    subject: { subjectType: c.subjectType || "LECTURER", subjectId },
    sourceLabel: "SYNTHETIC — NOT LHU POLICY",
    ruleId: c.ruleId || "SIM-YEARS-v1",
    pinnedRuleId: c.pinnedRuleId || c.ruleId || "SIM-YEARS-v1",
    document: {
      id: `SYNTHETIC-${c.groupId}`,
      version: c.ruleId?.endsWith("v2") ? "2" : "1",
      isConfirmedForTest: c.documentConfirmedForTest !== false,
      professionalConfirmation: false,
      asOfDate: "2026-10-06",
      effectiveFrom: "2020-01-01",
      effectiveTo: c.outsideEffectiveWindow ? "2026-01-01" : null,
    },
    criterion: {
      isConfirmedForTest: c.criterionConfirmedForTest !== false,
      professionalConfirmation: false,
    },
    kpi: c.simulatedKpi
      ? {
          source: "MANUAL",
          sourceNote: "MO PHONG — synthetic KPI, not confirmed achievement",
          isSimulation: true,
        }
      : null,
    records: c.years.map((year, i) => {
      const bytes = `W3-P4 SYNTHETIC ${c.groupId} file ${i}`;
      return {
        id: subjectId * 10 + i,
        subjectId: c.wrongSubjectAt === i ? subjectId + 999 : subjectId,
        year,
        version: c.replacementAt === i ? 2 : 1,
        status: c.revokedAt === i ? "REVOKED" : i % 2 ? "RECORDED" : "VERIFIED",
        ...(c.replacementAt === i
          ? { replacesRecordId: subjectId * 10 + c.revokedAt }
          : {}),
        file:
          c.missingFileAt === i
            ? null
            : {
                id: subjectId * 10 + i,
                version: 1,
                sha256: c.tamperedHashAt === i ? "0".repeat(64) : hash(bytes),
                content: bytes,
              },
      };
    }),
  };
}
export function inspect(c, input = materialize(c)) {
  const issues = new Set();
  const active = [];
  for (const record of input.records) {
    if (record.subjectId !== input.subject.subjectId) {
      issues.add("WRONG_SUBJECT");
      continue;
    }
    if (record.status === "REVOKED") {
      issues.add("REVOKED_SOURCE");
      continue;
    }
    if (
      !["VERIFIED", "RECORDED"].includes(record.status) ||
      !Number.isInteger(record.year) ||
      !record.file ||
      record.file.sha256 !== hash(record.file.content)
    ) {
      issues.add("MISSING_DATA");
      continue;
    }
    active.push(record);
  }
  const years = [...new Set(active.map((r) => r.year))].sort((a, b) => a - b);
  if (years.length < active.length) issues.add("DUPLICATE_YEAR");
  if (years.some((y, i) => i > 0 && y !== years[i - 1] + 1))
    issues.add("YEAR_GAP");
  if (!input.document.isConfirmedForTest) issues.add("UNAPPROVED_DOCUMENT");
  if (!input.criterion.isConfirmedForTest) issues.add("UNAPPROVED_CRITERION");
  if (input.kpi?.isSimulation) issues.add("SIMULATED_KPI");
  if (
    input.document.asOfDate < input.document.effectiveFrom ||
    (input.document.effectiveTo &&
      input.document.asOfDate > input.document.effectiveTo)
  )
    issues.add("OUT_OF_EFFECTIVE_WINDOW");
  if (input.pinnedRuleId !== input.ruleId) issues.add("RULE_CHANGED");
  const rule = rules.rules.find((r) => r.id === input.ruleId);
  if (!rule) throw Error("Unknown synthetic rule");
  // Missing/revoked/wrong-subject sources demand review, not a negative eligibility judgment.
  if (
    years.length < rule.minimumDistinctYears &&
    !["MISSING_DATA", "REVOKED_SOURCE", "WRONG_SUBJECT"].some((s) =>
      issues.has(s),
    )
  )
    issues.add("BELOW_SIMULATED_THRESHOLD");
  return { issues: [...issues].sort(), distinctYears: years.length, rule };
}
export function fixture(c, index) {
  const input = materialize(c, index),
    result = inspect(c, input);
  const basis = c.basis.map((sourceId) => ({
    sourceId,
    path: basisPaths[sourceId],
    sha256: hash(fs.readFileSync(new URL(basisPaths[sourceId], root))),
    confirmation: "TECHNICAL_CONTRACT_OR_SYNTHETIC_SPEC_ONLY",
  }));
  const requiresReview = result.issues.length > 0;
  return {
    caseId: c.id,
    title: c.title,
    labelAuthority: "ENGINEERING_EXPECTATION_UNCONFIRMED_BY_DOMAIN_EXPERT",
    expectedIssues: c.expectedIssues,
    basis,
    input,
    run: {
      runId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      evaluationType: "BATCH_BENCHMARK",
      targetSubject: input.subject,
      providerInfo: {
        provider: "mock",
        model: "deterministic-fixture-guard-v1",
        isMock: true,
      },
      overallStatus: "FLAGGED_UNCONFIRMED",
      overallConclusion: requiresReview
        ? "NEEDS_HUMAN_REVIEW"
        : "SIMULATION_ONLY",
      automaticAwardGranted: false,
      usageMetrics: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        cached: false,
      },
      executedAt: "2026-10-06T00:00:00.000Z",
      criterionResults: [
        {
          criterionId: input.ruleId.endsWith("v2") ? 900002 : 900001,
          criterionCode: input.ruleId,
          criterionName: result.rule.content,
          isConfirmedByLhu: false,
          isSimulation: true,
          thresholdMetric: {
            targetMin: result.rule.minimumDistinctYears,
            actualRecorded: result.distinctYears,
            unitMetric: "năm MÔ PHỎNG",
            isSatisfied: "UNCONFIRMED",
          },
          legalReferences: [],
          aiAnalysis: `Fixture kỹ thuật, không phải output LLM. ${result.issues.length ? result.issues.join(", ") : "Input đủ theo đặc tả mô phỏng"}. Không kết luận đủ điều kiện khen thưởng.`,
          humanReviewRequired: true,
          warningNotice:
            "Nhãn chưa được chuyên môn xác nhận. Ngưỡng/chuỗi năm chỉ MÔ PHỎNG; chưa có quy chế LHU được xác nhận áp dụng.",
        },
      ],
    },
    observed: result,
  };
}
export function benchmark(split = "development") {
  const path =
    split === "final-test"
      ? "docs/ai/eval-final/cases.final.json"
      : "docs/ai/eval-dev/cases.dev.json";
  const dataset = readJson(path);
  const details = dataset.cases.map((c, index) => {
    const actual = inspect(c, materialize(c, index));
    return {
      caseId: c.id,
      pass:
        JSON.stringify(actual.issues) ===
          JSON.stringify([...c.expectedIssues].sort()) &&
        actual.distinctYears === c.expectedDistinctYears,
      expectedIssues: c.expectedIssues,
      actualIssues: actual.issues,
      actualDistinctYears: actual.distinctYears,
    };
  });
  return {
    split: dataset.split,
    kind: "DETERMINISTIC_GUARDS_NOT_LLM_ACCURACY",
    labelAuthority: dataset.labelAuthority,
    automaticAwardGranted: false,
    passed: details.filter((r) => r.pass).length,
    total: details.length,
    datasetSha256: hash(fs.readFileSync(new URL(path, root))),
    details,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const split = process.argv.includes("--final") ? "final-test" : "development";
  if (split === "final-test") {
    const manifest = readJson("docs/ai/eval-final/freeze-manifest.json");
    for (const [path, expected] of Object.entries(manifest.hashes)) {
      if (hash(fs.readFileSync(new URL(path, root))) !== expected)
        throw Error(
          `Frozen artifact changed: ${path}. Create a new benchmark version; do not tune against final labels.`,
        );
    }
  }
  const result = benchmark(split);
  if (split === "development") {
    const cases = readJson("docs/ai/eval-dev/cases.dev.json").cases;
    const fixtures = {
      schemaVersion: 1,
      source: "W3-P4 DEVELOPMENT FIXTURES ONLY",
      notice: rules.notice,
      fixtures: cases.map(fixture),
    };
    fs.writeFileSync(
      new URL("docs/ai/eval-dev/EvaluationRun.fixtures.json", root),
      JSON.stringify(fixtures, null, 2) + "\n",
    );
  }
  fs.writeFileSync(
    new URL(
      `docs/testing/week-3/W3_P4_${split === "final-test" ? "FINAL" : "DEV"}_RESULT.json`,
      root,
    ),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    `${result.split}: ${result.passed}/${result.total} deterministic guard checks. No LLM accuracy or domain confirmation claimed.`,
  );
  if (result.passed !== result.total) process.exitCode = 1;
}
