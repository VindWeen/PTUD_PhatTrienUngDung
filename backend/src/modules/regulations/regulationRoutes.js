import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import * as regulationController from './regulationController.js';

const router = Router();

router.use(authenticate);

// 1. Documents
router.get('/regulations', regulationController.listDocuments);
router.get('/regulations/:id(\\d+)', regulationController.getDocumentById);
router.post('/regulations', regulationController.createDocument);

// 2. Versions
router.get('/regulations/versions/:id(\\d+)', regulationController.getVersionById);
router.post('/regulations/:documentId(\\d+)/versions', regulationController.createVersion);
router.patch('/regulations/versions/:id(\\d+)/confirm', regulationController.confirmVersion);

// 3. Chunks
router.get('/regulations/versions/:versionId(\\d+)/chunks', regulationController.getChunks);
router.post('/regulations/versions/:versionId(\\d+)/chunks', regulationController.addChunks);

// 4. Criteria
router.get('/regulations/criteria', regulationController.listCriteria);
router.post('/regulations/versions/:versionId(\\d+)/criteria', regulationController.createCriteria);
router.patch('/regulations/criteria/:id(\\d+)/confirm', regulationController.confirmCriteria);

export default router;
