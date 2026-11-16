import { z } from 'zod';
import { query, withTransaction } from '../utils/dbHelper.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
export { query, withTransaction };
export const route = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
export function id(value) {
  const parsed = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).safeParse(value);
  if (!parsed.success) throw new ValidationError('Mã định danh không hợp lệ.');
  return parsed.data;
}
export function body(schema, req) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ.', Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.'), issue.message])));
  return parsed.data;
}
export function parseJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}
export async function insertId(client, table, columns, values, params = []) {
  if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid static insert table.');
  const read = client ? client.query.bind(client) : query;
  const result = await read(`DECLARE @ids TABLE(id bigint); INSERT app.${table} (${columns}) OUTPUT INSERTED.id INTO @ids VALUES (${values}); SELECT id FROM @ids;`, params);
  return Number(result.rows[0].id);
}
export async function one(sql, params = [], read = query) {
  const row = (await read(sql, params)).rows[0];
  if (!row) throw new NotFoundError();
  return row;
}
export function pageParams(req) {
  const page = Math.max(1, Math.min(1000000, Number(req.query.page) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || req.query.limit) || 30));
  return { page: Math.floor(page), pageSize: Math.floor(pageSize), offset: (Math.floor(page) - 1) * Math.floor(pageSize) };
}
