import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { listNotifications, readNotification } from './notificationService.js';
const router = Router();
router.use(authenticate);
const handle = fn => async (req,res,next) => {
 try { res.json({ success:true,data:await fn(req) }); } catch(e) { next(e); }
};
router.get('/notifications',handle(r=>listNotifications(r.user,r.query)));
router.patch('/notifications/:id/read',handle(r=>readNotification(r.user,r.params.id)));
export default router;
