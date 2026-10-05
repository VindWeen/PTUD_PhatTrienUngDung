import { query } from '../utils/dbHelper.js';
import { getActiveRoles, isUnitInUserScope } from '../modules/auth/authRepository.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { parseId } from '../modules/admin/adminSchemas.js';
// This endpoint returns an entire career, including historical aggregates.
// Partial scope must not expose the parts outside the reader's assignment.
export async function requireLecturerRead(req,res,next) {
  try {
    const lecturerId = parseId(req.params.id);
    const lecturer = (await query('SELECT user_id FROM app.lecturers WHERE lecturer_id=$1',[lecturerId])).rows[0];
    if (!lecturer) throw new NotFoundError();
    if (Number(lecturer.user_id) === Number(req.user.userId)) return next();
    const roles = (await getActiveRoles(req.user.userId)).map(v => v.Code);
    if (roles.includes('ADMIN')) return next();
    const units = (await query(`SELECT unit_id FROM app.lecturer_assignments WHERE lecturer_id=$1
      UNION SELECT context_unit_id AS unit_id FROM app.achievements WHERE lecturer_id=$1
      UNION SELECT unit_id FROM app.award_records WHERE lecturer_id=$1`,[lecturerId])).rows;
    if (!units.length || units.some(v => v.unit_id == null)) throw new ForbiddenError('Hồ sơ toàn bộ lịch sử cần phạm vi bao phủ đầy đủ');
    for (const unit of units) {
      let allowed = false;
      for (const role of ['MANAGER','RECORDS_OFFICER']) {
        if (roles.includes(role) && await isUnitInUserScope(req.user.userId,unit.unit_id,role)) { allowed = true; break; }
      }
      if (!allowed) throw new ForbiddenError('Hồ sơ có lịch sử nằm ngoài phạm vi hiện tại');
    }
    next();
  } catch(e) { next(e); }
}
