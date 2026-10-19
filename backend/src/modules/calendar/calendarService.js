import { z } from 'zod';
import { query } from '../../utils/dbHelper.js';
import { ConcurrencyConflictError, NotFoundError } from '../../utils/errors.js';

const idSchema = z.coerce.number().int().positive().safe();
const wallTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(value => {
  const date = new Date(`${value}:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value && value >= '1900' && value < '2200';
}, 'Ngày giờ không hợp lệ');
const fields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).default(''),
  location: z.string().trim().max(500).default(''),
  category: z.enum(['exam', 'competition', 'task', 'personal']),
  startsAt: wallTime,
  endsAt: wallTime,
  allDay: z.boolean(),
  completed: z.boolean().default(false),
};
const ordered = value => value.endsAt >= value.startsAt && (!value.allDay || (value.startsAt.endsWith('T00:00') && value.endsAt.endsWith('T00:00')));
export const createEventSchema = z.object(fields).strict().refine(ordered, 'Ngày kết thúc phải từ ngày bắt đầu; lịch cả ngày phải dùng 00:00');
export const updateEventSchema = z.object({ ...fields, version: idSchema }).strict().refine(ordered, 'Khoảng thời gian không hợp lệ');
const projection = `event_id::text AS id, title, description, location, category,
  to_char(starts_at, 'YYYY-MM-DD"T"HH24:MI') AS "startsAt",
  to_char(ends_at, 'YYYY-MM-DD"T"HH24:MI') AS "endsAt",
  all_day AS "allDay", completed, version`;

// Injecting a query function allows ownership/concurrency tests without a live database.
export function calendarService(run = query) {
  return {
    async list(user) {
      return (await run(`SELECT ${projection} FROM app.personal_calendar_events WHERE user_id=$1 ORDER BY starts_at,event_id`, [user.userId])).rows;
    },
    async create(user, raw) {
      const e = createEventSchema.parse(raw);
      return (await run(`INSERT INTO app.personal_calendar_events
        (user_id,title,description,location,category,starts_at,ends_at,all_day,completed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${projection}`,
      [user.userId,e.title,e.description,e.location,e.category,e.startsAt,e.endsAt,e.allDay,e.completed])).rows[0];
    },
    async update(user, rawId, raw) {
      const eventId = idSchema.parse(rawId);
      const e = updateEventSchema.parse(raw);
      const result = await run(`UPDATE app.personal_calendar_events SET title=$3,description=$4,location=$5,
        category=$6,starts_at=$7,ends_at=$8,all_day=$9,completed=$10,version=version+1,updated_at=NOW()
        WHERE user_id=$1 AND event_id=$2 AND version=$11 RETURNING ${projection}`,
      [user.userId,eventId,e.title,e.description,e.location,e.category,e.startsAt,e.endsAt,e.allDay,e.completed,e.version]);
      if (result.rows.length) return result.rows[0];
      await this.missing(user, eventId);
    },
    async remove(user, rawId, rawVersion) {
      const eventId = idSchema.parse(rawId);
      const version = idSchema.parse(rawVersion);
      const result = await run('DELETE FROM app.personal_calendar_events WHERE user_id=$1 AND event_id=$2 AND version=$3 RETURNING event_id', [user.userId,eventId,version]);
      if (!result.rows.length) await this.missing(user, eventId);
      return { deleted: true };
    },
    async missing(user, eventId) {
      const own = await run('SELECT event_id FROM app.personal_calendar_events WHERE user_id=$1 AND event_id=$2', [user.userId,eventId]);
      if (!own.rows.length) throw new NotFoundError('Không tìm thấy lịch cá nhân');
      throw new ConcurrencyConflictError('Lịch đã thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.');
    },
  };
}
