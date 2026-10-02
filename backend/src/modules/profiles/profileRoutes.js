import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import controller from './profileController.js';
import { requireLecturerRead } from '../../middlewares/requireLecturerRead.js';

const router = express.Router();
router.use(authenticate);
router.get('/me/profile', controller.getMe);
router.patch('/me/profile', controller.updateMe);
router.get('/lecturers/:id', requireLecturerRead, controller.getById);
router.patch('/lecturers/:id', controller.updateById);
export default router;
