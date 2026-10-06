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
    const result = await aiService.evaluateCriterion(payload);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
