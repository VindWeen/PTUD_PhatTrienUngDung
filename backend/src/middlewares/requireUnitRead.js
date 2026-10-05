import { getActiveRoles, isUnitInUserScope } from '../modules/auth/authRepository.js';
import { OutOfScopeError } from '../utils/errors.js';
import { parseId } from '../modules/admin/adminSchemas.js';
// Administrative read never confers verification rights.
export async function requireUnitRead(req,res,next) {
  try {
    const unitId = parseId(req.params.id);
    const roles = (await getActiveRoles(req.user.userId)).map(r => r.Code);
    if (roles.includes('ADMIN')) return next();
    for (const role of ['MANAGER','RECORDS_OFFICER','UNIT_REPRESENTATIVE']) {
      if (roles.includes(role) && await isUnitInUserScope(req.user.userId,unitId,role)) return next();
    }
    throw new OutOfScopeError('Không có phân công còn hiệu lực để xem hồ sơ đơn vị');
  } catch(e) { next(e); }
}
