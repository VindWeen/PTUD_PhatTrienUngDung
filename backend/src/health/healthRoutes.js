import express from 'express';
import { getLiveness, getReadiness } from './healthController.js';

const router = express.Router();

router.get('/', getLiveness);
router.get('/readiness', getReadiness);

export default router;
