// W3-Q4 interchange schema. Validates structure, never decides eligibility.
import { z } from "zod";
const metric = z.number().finite().nullable();
export const criterionResultSchema = z
  .object({
    criterionId: z.number().int().positive(),
    criterionCode: z.string().min(1),
    criterionName: z.string().min(1),
    isConfirmedByLhu: z.boolean(),
    isSimulation: z.boolean(),
    thresholdMetric: z
      .object({
        targetMin: metric,
        actualRecorded: metric,
        unitMetric: z.string().nullable(),
        isSatisfied: z.union([z.boolean(), z.literal("UNCONFIRMED")]),
      })
      .strict(),
    legalReferences: z.array(
      z
        .object({
          documentCode: z.string(),
          versionNumber: z.string(),
          clauseReference: z.string(),
          chunkHash: z.string().regex(/^[a-f0-9]{64}$/i),
        })
        .strict(),
    ),
    aiAnalysis: z.string(),
    humanReviewRequired: z.boolean(),
    warningNotice: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (
      (r.isSimulation || !r.isConfirmedByLhu) &&
      (!r.humanReviewRequired ||
        r.thresholdMetric.isSatisfied !== "UNCONFIRMED")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Unconfirmed/simulation requires review and UNCONFIRMED metric",
      });
  });
export const evaluationRunSchema = z
  .object({
    runId: z.string().uuid(),
    evaluationType: z.enum([
      "CRITERION_ASSESSMENT",
      "KPI_VERIFICATION",
      "BATCH_BENCHMARK",
    ]),
    targetSubject: z
      .object({
        subjectType: z.enum(["LECTURER", "UNIT"]),
        subjectId: z.number().int().positive(),
        achievementId: z.number().int().positive().optional(),
        kpiGoalId: z.number().int().positive().optional(),
      })
      .strict(),
    providerInfo: z
      .object({
        provider: z.enum(["groq", "openrouter", "mock"]),
        model: z.string().min(1),
        isMock: z.boolean(),
      })
      .strict(),
    overallStatus: z.enum(["COMPLETED", "FLAGGED_UNCONFIRMED", "FAILED"]),
    overallConclusion: z.enum([
      "ELIGIBLE",
      "INELIGIBLE",
      "NEEDS_HUMAN_REVIEW",
      "SIMULATION_ONLY",
    ]),
    automaticAwardGranted: z.literal(false),
    usageMetrics: z
      .object({
        promptTokens: z.number().int().nonnegative(),
        completionTokens: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative(),
        latencyMs: z.number().nonnegative(),
        cached: z.boolean(),
      })
      .strict(),
    executedAt: z.string().datetime(),
    criterionResults: z.array(criterionResultSchema).min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (
      (r.providerInfo.isMock ||
        r.criterionResults.some(
          (c) => c.isSimulation || !c.isConfirmedByLhu,
        )) &&
      ["ELIGIBLE", "INELIGIBLE"].includes(r.overallConclusion)
    )
      ctx.addIssue({
        code: "custom",
        message: "Mock/unconfirmed runs cannot claim eligibility",
      });
    if (r.providerInfo.provider === "mock" && !r.providerInfo.isMock)
      ctx.addIssue({
        code: "custom",
        message: "Mock provider must be labelled",
      });
    if (
      r.usageMetrics.totalTokens !==
      r.usageMetrics.promptTokens + r.usageMetrics.completionTokens
    )
      ctx.addIssue({ code: "custom", message: "Token totals mismatch" });
  });
