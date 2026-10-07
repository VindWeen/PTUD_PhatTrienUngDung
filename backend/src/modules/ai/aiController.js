import aiService from './aiService.js';
import * as ragRetrievalService from './rag/ragRetrievalService.js';
import * as ragExplanationService from './rag/ragExplanationService.js';
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
  forcedProvider: z.enum(['groq', 'openrouter', 'mock']).optional(),
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
        forcedProvider: payload.forcedProvider || payload.provider,
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

export async function indexRegulationChunks(req, res, next) {
  try {
    const result = await ragRetrievalService.indexConfirmedChunks();
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

const retrieveChunksSchema = z.object({
  queryText: z.string().trim().min(2),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetType: z.enum(['INDIVIDUAL', 'COLLECTIVE', 'BOTH']).optional(),
  versionId: z.coerce.number().int().positive().optional(),
  topK: z.coerce.number().int().positive().max(10).optional(),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
}).strict();

export async function retrieveChunks(req, res, next) {
  try {
    const payload = retrieveChunksSchema.parse(req.body);
    const result = await ragRetrievalService.retrieveRelevantChunks(payload);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

const explainSchema = z.object({
  criterionResult: z.object({
    criterionId: z.coerce.number().int().positive(),
    criterionCode: z.string().min(1),
    criterionName: z.string().min(1),
    isConfirmedByLhu: z.boolean(),
    isSimulation: z.boolean(),
    thresholdMetric: z.object({
      targetMin: z.number().nullable(),
      actualRecorded: z.number().nullable(),
      unitMetric: z.string().nullable().optional(),
      isSatisfied: z.union([z.boolean(), z.literal('UNCONFIRMED')]),
    }),
    aiAnalysis: z.string(),
    humanReviewRequired: z.boolean(),
  }),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  provider: z.enum(['groq', 'openrouter', 'mock']).optional(),
  model: z.string().optional(),
  runId: z.string().uuid().optional(),
}).strict();

export async function explainEvaluation(req, res, next) {
  try {
    const payload = explainSchema.parse(req.body);
    if (payload.runId) {
      await aiService.getEvaluationRun(payload.runId, req.user);
    }
    const result = await ragExplanationService.explainEvaluationResult({
      ...payload,
      forcedProvider: payload.provider,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function checkEvaluationStale(req, res, next) {
  try {
    const runId = req.params.runId;
    const result = await aiService.checkEvaluationStale(runId, req.user);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}


