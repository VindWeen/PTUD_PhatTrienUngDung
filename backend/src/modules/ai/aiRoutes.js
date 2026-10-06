import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import * as aiController from './aiController.js';

const router = Router();

router.use(authenticate);

router.post('/ai/smoke-test', aiController.smokeTest);
router.post('/ai/evaluate-criterion', aiController.evaluateCriterion);

export default router;
