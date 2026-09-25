import sql from 'mssql';
import { getPool } from '../config/database.js';

/**
 * Tự động xác định kiểu dữ liệu MSSQL dựa trên giá trị JS
 */
function inferSqlType(value) {
  if (value === null || value === undefined) return sql.NVarChar;
  if (typeof value === 'boolean') return sql.Bit;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? sql.BigInt : sql.Float;
  }
  if (value instanceof Date) return sql.DateTime2;
  if (Buffer.isBuffer(value)) return sql.VarBinary;
  return sql.NVarChar;
}

/**
 * Gán tham số an toàn vào SQL Request để chống SQL Injection 100%
 */
export function bindParams(request, params = {}) {
  if (!params || typeof params !== 'object') return;

  for (const [key, val] of Object.entries(params)) {
    if (val !== null && typeof val === 'object' && 'value' in val && 'type' in val) {
      // Trường hợp người dùng chỉ định rõ kiểu dữ liệu: { value: 123, type: sql.Int }
      request.input(key, val.type, val.value);
    } else {
      // Trường hợp tự động suy diễn kiểu
      const type = inferSqlType(val);
      request.input(key, type, val ?? null);
    }
  }
}

/**
 * Thực thi câu lệnh SQL tham số hóa (Parameterized Query)
 * @param {string} sqlText - Câu lệnh SQL có tham số dạng @paramName
 * @param {object} params - Đối tượng chứa các tham số
 * @param {sql.Request|null} customRequest - Dùng khi đang ở trong một Transaction
 */
export async function query(sqlText, params = {}, customRequest = null) {
  const request = customRequest || getPool().request();
  bindParams(request, params);
  const result = await request.query(sqlText);
  return {
    recordset: result.recordset || [],
    recordsets: result.recordsets || [],
    rowsAffected: result.rowsAffected || [0],
  };
}

/**
 * Helper quản lý Database Transaction với cơ chế tự động Rollback khi gặp lỗi
 * @param {Function} callback - Hàm thực thi nghiệp vụ nhận vào { tx, query, request }
 * @param {number} isolationLevel - Mức cô lập giao dịch (mặc định READ_COMMITTED)
 */
export async function withTransaction(callback, isolationLevel = sql.ISOLATION_LEVEL.READ_COMMITTED) {
  const pool = getPool();
  const tx = new sql.Transaction(pool);

  await tx.begin(isolationLevel);

  // Tạo hàm query gắn chặt với transaction này
  const txQuery = (sqlText, params = {}) => {
    const req = new sql.Request(tx);
    return query(sqlText, params, req);
  };

  try {
    const result = await callback({
      tx,
      query: txQuery,
      createRequest: () => new sql.Request(tx),
    });

    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch (rollbackError) {
      console.error('Lỗi khi thực hiện rollback transaction:', rollbackError.message);
    }
    throw error;
  }
}

export default { query, withTransaction, bindParams, sql };
