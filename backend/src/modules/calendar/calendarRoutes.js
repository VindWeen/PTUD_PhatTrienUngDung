import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { calendarService } from './calendarService.js';

const router = Router();
const service = calendarService();
router.use(authenticate);
const handle = (fn, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await fn(req) }); }
  catch (error) { next(error); }
};
router.get('/me/calendar', handle(req => service.list(req.user)));
router.post('/me/calendar', handle(req => service.create(req.user, req.body), 201));
router.put('/me/calendar/:id', handle(req => service.update(req.user, req.params.id, req.body)));
router.delete('/me/calendar/:id', handle(req => service.remove(req.user, req.params.id, req.body?.version)));
export default router;
