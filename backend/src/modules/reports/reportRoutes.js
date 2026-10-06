import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { report } from './reportService.js';
import { ValidationError } from '../../utils/errors.js';
const router = Router();
router.use(authenticate);
for (const path of ['/dashboard/summary', '/reports']) router.get(path, async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json({ success: true, data: await report(req.query, req.user) }); } catch (error) { next(error); }
});
// Preserve blueprint paths; unitId is an alias for the historical context, never current assignment.
function legacyFilters(raw, kind) {
  const { unitId, type, ...filters } = raw;
  if (unitId !== undefined) {
    if (filters.contextUnitId !== undefined && String(unitId) !== String(filters.contextUnitId)) throw new ValidationError('unitId và contextUnitId mâu thuẫn');
    filters.contextUnitId = unitId;
  }
  if (type !== undefined) {
    if (!['achievements', 'awards'].includes(type)) throw new ValidationError('type không hợp lệ');
    if (kind && kind !== (type === 'achievements' ? 'ACHIEVEMENT' : 'AWARD')) throw new ValidationError('type mâu thuẫn với nguồn đã chọn');
    kind = type === 'achievements' ? 'ACHIEVEMENT' : 'AWARD';
  }
  if (kind) {
    if (filters.kind && filters.kind !== kind) throw new ValidationError('kind mâu thuẫn với nguồn đã chọn');
    filters.kind = kind;
  }
  return filters;
}
for (const [path, kind] of [['/reports/achievements', 'ACHIEVEMENT'], ['/reports/awards', 'AWARD']]) router.get(path, async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json({ success: true, data: await report(legacyFilters(req.query, kind), req.user) }); } catch (error) { next(error); }
});
router.get(['/reports/export.csv', '/reports/export'], async (req, res, next) => {
  try {
    const csv = await report(req.path === '/reports/export' ? legacyFilters(req.query) : req.query, req.user, true);
    res.set('Cache-Control', 'no-store').attachment('W3-P1-reports.csv').type('text/csv; charset=utf-8').send(csv);
  } catch (error) { next(error); }
});
export default router;
