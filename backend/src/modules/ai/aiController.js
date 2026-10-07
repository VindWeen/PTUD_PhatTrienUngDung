import aiService from './aiService.js';
import { z } from 'zod';

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...(data === undefined ? {} : { data }) });

const smokeTestSchema = z.object({
  chunkId: z.coerce.number().int().positive(),
  question: z.string().trim().min(3).max(1000).optional(),
  provider: z.enum(['groq', 'openrouter', 'mock']).optional(),
  model: z.string().optional(),
}).strict();

const evaluateCriterionSchema = z.object({
  criterionId: z.coerce.number().int().positive(),
  achievementId: z.coerce.number().int().positive().optional(),
  provider: z.enum(['groq', 'openrouter', 'mock']).optional(),
  model: z.string().optional(),
}).strict();

const evaluateStructuredSchema = z.object({
  subjectType: z.enum(['LECTURER', 'UNIT']).default('LECTURER'),
  subjectId: z.coerce.number().int().positive(),
  criteriaVersionIds: z.array(z.coerce.number().int().positive()).optional(),
  applicationId: z.coerce.number().int().positive().optional(),
  kpiGoalId: z.coerce.number().int().positive().optional(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  provider: z.enum(['groq', 'openrouter', 'mock']).optional(),
  model: z.string().optional(),
}).strict();

export async function smokeTest(req, res, next) {
  try {
    const payload = smokeTestSchema.parse(req.body);
    const result = await aiService.executeSmokeTest(payload);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function evaluateCriterion(req, res, next) {
  try {
    const payload = evaluateCriterionSchema.parse(req.body);
    const result = await aiService.evaluateCriterion({ ...payload, forcedProvider: payload.provider }, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function evaluateStructured(req, res, next) {
  try {
    const payload = evaluateStructuredSchema.parse(req.body);
    const result = await aiService.evaluateStructured(
      {
        ...payload,
        forcedProvider: payload.provider,
      },
      req.user
    );
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function getEvaluationRun(req, res, next) {
  try {
    const runId = req.params.runId;
    const result = await aiService.getEvaluationRun(runId, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listEvaluationRuns(req, res, next) {
  try {
    const { subjectType, subjectId, applicationId, limit, offset } = req.query;
    const result = await aiService.listEvaluations(
      {
        subjectType,
        subjectId: subjectId ? Number(subjectId) : undefined,
        applicationId: applicationId ? Number(applicationId) : undefined,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
      },
      req.user
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
