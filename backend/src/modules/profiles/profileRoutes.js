import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import controller from './profileController.js';

const router = express.Router();
router.use(authenticate);
router.get('/me/profile', controller.getMe);
router.patch('/me/profile', controller.updateMe);
router.get('/lecturers/:id', controller.getById);
router.patch('/lecturers/:id', controller.updateById);
export default router;
