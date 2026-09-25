import { isUnitInUserScope } from '../modules/auth/authRepository.js';
import { UnauthorizedError, OutOfScopeError, ValidationError } from '../utils/errors.js';

/**
 * Middleware kiểm tra phạm vi quản lý đơn vị (Unit Scope) bao gồm cả cây đơn vị con (CTE).
 *
 * Quy tắc cốt lõi của đề bài W1-Q3:
 * "Admin không tự có quyền xác nhận (ADMIN != MANAGER; Admin cannot bypass scope checks for approval/verification without explicit scope)"
 *
 * @param {(req: import('express').Request) => number | string | Promise<number | string>} getUnitIdFn - Hàm trích xuất UnitId cần kiểm tra từ Request
 * @param {Object} options
 * @param {string} [options.roleCode] - Mã vai trò yêu cầu phân công (ví dụ: 'MANAGER', 'UNIT_REP')
 * @param {string} [options.actionName='thao tác'] - Tên hành động để hiển thị thông báo lỗi rõ ràng
 */
export function requireScope(getUnitIdFn, options = {}) {
  const { roleCode = null, actionName = 'xác nhận / thẩm định' } = options;

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        throw new UnauthorizedError('Yêu cầu xác thực tài khoản trước khi kiểm tra phạm vi');
      }

      // Trích xuất UnitId mục tiêu
      const rawUnitId = typeof getUnitIdFn === 'function' ? await getUnitIdFn(req) : req.params.unitId || req.body.unitId;
      const targetUnitId = Number(rawUnitId);

      if (!targetUnitId || isNaN(targetUnitId)) {
        throw new ValidationError('Đơn vị mục tiêu (UnitId) không hợp lệ hoặc không được cung cấp');
      }

      // Kiểm tra trong DB: phân công trực tiếp hoặc qua cây đơn vị con (IncludeDescendants = 1 với CTE)
      // Lưu ý: Không có ngoại lệ bypass cho ADMIN. ADMIN muốn xác nhận/thẩm định phải được phân công scope rõ ràng.
      const hasScope = await isUnitInUserScope(req.user.userId, targetUnitId, roleCode);

      if (!hasScope) {
        throw new OutOfScopeError(
          `Bạn không có thẩm quyền thực hiện ${actionName} cho đơn vị mã #${targetUnitId}. Đơn vị này nằm ngoài phạm vi được phân công hiệu lực của bạn (ADMIN không tự có quyền duyệt nếu thiếu scope).`
        );
      }

      // Gắn thông tin phạm vi đã xác thực vào request
      req.verifiedUnitScope = { unitId: targetUnitId, roleCode };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default requireScope;
