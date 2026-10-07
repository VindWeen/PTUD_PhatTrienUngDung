import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import * as aiController from './aiController.js';

const router = Router();

router.use(authenticate);

// W3-Q3 endpoints
router.post('/ai/smoke-test', aiController.smokeTest);
router.post('/ai/evaluate-criterion', aiController.evaluateCriterion);

// W4-Q1 Structured Criteria Evaluation & History endpoints
router.post('/ai/evaluations/structured', aiController.evaluateStructured);
router.get('/ai/evaluations/:runId', aiController.getEvaluationRun);
router.get('/ai/evaluations', aiController.listEvaluationRuns);

// W4-Q2 RAG & Explanation with Citations endpoints
router.post('/ai/rag/index-chunks', aiController.indexRegulationChunks);
router.post('/ai/rag/retrieve', aiController.retrieveChunks);
router.post('/ai/rag/explain', aiController.explainEvaluation);

export default router;
