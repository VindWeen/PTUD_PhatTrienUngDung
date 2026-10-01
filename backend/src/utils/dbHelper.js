import { connectDB, getPool } from '../config/database.js';

/**
 * Chuẩn hóa câu lệnh SQL và tham số:
 * Hỗ trợ cả cú pháp PostgreSQL chuẩn ($1, $2, ...) lẫn named params dạng @paramName
 * Chống SQL Injection 100% qua prepared statement
 */
export function formatQuery(sqlText, params = []) {
  if (Array.isArray(params)) {
    return { text: sqlText, values: params };
  }

  if (params && typeof params === 'object') {
    const keys = Object.keys(params);
    let text = sqlText;
    const values = [];

    keys.forEach((key, index) => {
      const placeholder = `$${index + 1}`;
      const regex = new RegExp(`@${key}\\b`, 'g');
      text = text.replace(regex, placeholder);
      values.push(params[key] ?? null);
    });

    return { text, values };
  }

  return { text: sqlText, values: [] };
}

/**
 * Thực thi câu lệnh SQL tham số hóa (Parameterized Query) an toàn
 * @param {string} sqlText - Câu lệnh SQL (hỗ trợ $1, $2... hoặc @param)
 * @param {Array|Object} params - Danh sách hoặc đối tượng tham số
 * @param {object|null} customClient - pg.Client dùng khi ở trong Transaction
 */
export async function query(sqlText, params = [], customClient = null) {
  const { text, values } = formatQuery(sqlText, params);
  let result;

  if (customClient) {
    result = await customClient.query(text, values);
  } else {
    const pool = await connectDB();
    result = await pool.query(text, values);
  }

  const rows = result.rows || [];
  const rowCount = result.rowCount ?? rows.length;

  return {
    rows,
    recordset: rows, // Hỗ trợ tương thích ngược
    rowCount,
    rowsAffected: [rowCount],
  };
}

/**
 * Helper quản lý PostgreSQL Database Transaction dùng cùng pg client BEGIN/COMMIT/ROLLBACK
 * Tự động Rollback toàn diện khi gặp bất kỳ ngoại lệ nào
 * @param {Function} callback - Hàm thực thi nhận vào { client, query }
 */
export async function withTransaction(callback) {
  const pool = await connectDB();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const txQuery = (text, params = []) => query(text, params, client);

    const result = await callback({
      client,
      query: txQuery,
    });

    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Lỗi khi thực hiện ROLLBACK transaction PostgreSQL:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

export default { query, withTransaction, formatQuery };
