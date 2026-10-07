import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import * as service from "./kpiService.js";
import * as recommendations from './recommendationService.js';
import { csvTemplate } from "./kpiSchemas.js";
const router = Router();
router.use("/kpi", authenticate);
const handle =
  (fn, status = 200) =>
  async (req, res, next) => {
    try {
      res
        .set("Cache-Control", "no-store")
        .status(status)
        .json({ success: true, data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
router.get("/kpi/template.csv", (req, res) =>
  res
    .set("Cache-Control", "no-store")
    .attachment("W3-P2-kpi.csv")
    .type("text/csv")
    .send("\uFEFF" + csvTemplate),
);
router.post('/kpi/recommendations', handle(req => recommendations.generate(req.user, req.body), 201));
router.get('/kpi/recommendations', handle(req => recommendations.list(req.user, req.query.runId)));
router.post('/kpi/recommendations/:id/decision', handle(req => recommendations.decide(req.user, req.params.id, req.body)));
router.get(
  "/kpi/catalogs",
  handle((req) => service.catalogs(req.user)),
);
router.post(
  "/kpi/import/preview",
  handle((req) => service.importCsv(req.user, req.body)),
);
router.post(
  "/kpi/import/commit",
  handle((req) => service.importCsv(req.user, req.body, true)),
);
router.get(
  "/kpi/goals",
  handle((req) => service.list(req.user, req.query)),
);
router.post(
  "/kpi/goals",
  handle((req) => service.create(req.user, req.body), 201),
);
router.patch(
  "/kpi/goals/:id",
  handle((req) =>
    service.mutateGoal(req.user, req.params.id, "update", req.body),
  ),
);
router.delete(
  "/kpi/goals/:id",
  handle((req) =>
    service.mutateGoal(req.user, req.params.id, "delete", req.body),
  ),
);
router.post(
  "/kpi/goals/:id/accept",
  handle((req) =>
    service.mutateGoal(req.user, req.params.id, "accept", req.body),
  ),
);
router.post(
  "/kpi/goals/:id/result",
  handle(
    (req) => service.result(req.user, req.params.id, "create", req.body),
    201,
  ),
);
router.patch(
  "/kpi/goals/:id/result",
  handle((req) => service.result(req.user, req.params.id, "update", req.body)),
);
router.delete(
  "/kpi/goals/:id/result",
  handle((req) => service.result(req.user, req.params.id, "delete", req.body)),
);
router.post(
  "/kpi/goals/:id/result/draft",
  handle(
    (req) => service.result(req.user, req.params.id, "draft", req.body),
    201,
  ),
);
export default router;
