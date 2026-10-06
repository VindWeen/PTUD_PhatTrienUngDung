import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import service from "./applicationService.js";
const router = Router();
router.use(authenticate);
const handle =
  (fn, status = 200) =>
  async (req, res, next) => {
    try {
      res.status(status).json({ success: true, data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
router.get(
  "/award-cycles",
  handle((r) => service.cycles(r.user)),
);
router.post(
  "/award-cycles",
  handle((r) => service.createCycle(r.body, r.user), 201),
);
router.get(
  "/award-applications",
  handle((r) => service.list(r.query, r.user)),
);
router.post(
  "/award-applications",
  handle((r) => service.create(r.body, r.user), 201),
);
router.get(
  "/award-applications/:id",
  handle((r) => service.detail(r.params.id, r.user)),
);
router.post(
  "/award-applications/:id/submit",
  handle((r) => service.transition(r.params.id, r.body, r.user, "submit")),
);
router.post(
  "/award-applications/:id/forward",
  handle((r) => service.transition(r.params.id, r.body, r.user, "forward")),
);
export default router;
