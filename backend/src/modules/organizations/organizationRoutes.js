import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/requireRoles.js';
import controller from './organizationController.js';
import { requireUnitRead } from '../../middlewares/requireUnitRead.js';

const router = express.Router();
router.use(authenticate);
router.get('/organizations', controller.list);
router.get('/units/:id/profile', requireUnitRead, controller.profile);
router.post('/organizations', requireRoles('ADMIN'), controller.create);
router.patch('/organizations/:id', requireRoles('ADMIN'), controller.update);
router.delete('/organizations/:id', requireRoles('ADMIN'), controller.remove);
router.post('/organizations/:id/representative', requireRoles('ADMIN'), controller.appoint);
router.post('/lecturers/:id/assignments', requireRoles('ADMIN'), controller.transfer);
export default router;
