import { z } from 'zod';
import { query, withTransaction } from '../../utils/dbHelper.js';
import { ConcurrencyConflictError, NotFoundError } from '../../utils/errors.js';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function isValidCalendarDate(val) {
  if (typeof val !== 'string') return false;
  const match = val.match(ISO_DATE_PATTERN);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Strict calendar day validation via UTC round-trip
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return false;
  }

  // Ensure full string parses to a finite date
  const parsed = new Date(val.includes('T') ? val : `${val}T00:00:00Z`);
  return Number.isFinite(parsed.getTime());
}

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

export const createReminderSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
  deadlineDate: z.string().refine(isValidCalendarDate, 'Hạn nộp không tồn tại hoặc ngoài khoảng 1990–2100'),
  regulationId: idSchema.optional().nullable(),
  awardPeriodId: idSchema.optional().nullable(),
  kpiGoalId: idSchema.optional().nullable(),
  description: z.string().trim().max(4000).optional(),
}).strict();

const projection = `CONVERT(varchar(20), event_id) AS id, title, description, location, category,
  CONVERT(varchar(16), starts_at, 126) AS "startsAt",
  CONVERT(varchar(16), ends_at, 126) AS "endsAt",
  all_day AS "allDay", completed, version`;

const outputProjection = projection.replace(/\b(event_id|title|description|location|category|starts_at|ends_at|all_day|completed|version)\b/g, 'INSERTED.$1');

// Injecting a query function allows ownership/concurrency tests without a live database.
export function calendarService(run = query, txRunner = null) {
  const executeTx = txRunner || (run === query ? withTransaction : async (cb) => cb({ query: run, client: null }));

  return {
    async list(user) {
      return (await run(`SELECT ${projection} FROM app.personal_calendar_events WHERE user_id=$1 ORDER BY starts_at,event_id`, [user.userId])).rows;
    },
    async listSystem() {
      const rows = (await run(`SELECT CONVERT(varchar(20), award_period_id) AS id, name, CONVERT(varchar(10), end_date, 23) AS end_date
        FROM app.award_periods WHERE status='OPEN' ORDER BY end_date,award_period_id`)).rows;
      return rows.map(row => ({
        id: `award-period-${row.id}`, title: `Hạn nộp hồ sơ: ${row.name}`,
        description: 'Ngày kết thúc kỳ đề nghị khen thưởng đang mở.', location: '',
        category: 'system', startsAt: `${row.end_date}T00:00`, endsAt: `${row.end_date}T00:00`,
        allDay: true, completed: false, readOnly: true,
      }));
    },
    async create(user, raw) {
      const e = createEventSchema.parse(raw);
      return (await run(`INSERT INTO app.personal_calendar_events
        (user_id,title,description,location,category,starts_at,ends_at,all_day,completed)
        OUTPUT ${outputProjection} VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [user.userId,e.title,e.description,e.location,e.category,new Date(`${e.startsAt}:00Z`),new Date(`${e.endsAt}:00Z`),e.allDay,e.completed])).rows[0];
    },
    async update(user, rawId, raw) {
      const eventId = idSchema.parse(rawId);
      const e = updateEventSchema.parse(raw);
      const result = await run(`UPDATE app.personal_calendar_events SET title=$3,description=$4,location=$5,
        category=$6,starts_at=$7,ends_at=$8,all_day=$9,completed=$10,version=version+1,updated_at=SYSUTCDATETIME()
        OUTPUT ${outputProjection} WHERE user_id=$1 AND event_id=$2 AND version=$11`,
      [user.userId,eventId,e.title,e.description,e.location,e.category,new Date(`${e.startsAt}:00Z`),new Date(`${e.endsAt}:00Z`),e.allDay,e.completed,e.version]);
      if (result.rows.length) return result.rows[0];
      await this.missing(user, eventId);
    },
    async remove(user, rawId, rawVersion) {
      const eventId = idSchema.parse(rawId);
      const version = idSchema.parse(rawVersion);
      const result = await run('DELETE FROM app.personal_calendar_events OUTPUT DELETED.event_id WHERE user_id=$1 AND event_id=$2 AND version=$3', [user.userId,eventId,version]);
      if (!result.rows.length) await this.missing(user, eventId);
      return { deleted: true };
    },
    
    async createReminder(user, raw) {
      const e = createReminderSchema.parse(raw);

      return executeTx(async ({ query: txQuery }) => {
        if (e.regulationId) {
          const reg = (await txQuery('SELECT document_id, title FROM app.regulation_documents WHERE document_id = $1', [e.regulationId])).rows[0];
          if (!reg) throw new NotFoundError('Không tìm thấy quy chế');
        }
        if (e.awardPeriodId) {
          const ap = (await txQuery('SELECT award_period_id, name FROM app.award_periods WHERE award_period_id = $1', [e.awardPeriodId])).rows[0];
          if (!ap) throw new NotFoundError('Không tìm thấy kỳ khen thưởng');
        }
        if (e.kpiGoalId) {
          const kg = (await txQuery('SELECT goal_id, title FROM app.kpi_goals WHERE goal_id = $1', [e.kpiGoalId])).rows[0];
          if (!kg) throw new NotFoundError('Không tìm thấy mục tiêu KPI');
        }

        let startsAt;
        let endsAt;
        if (e.deadlineDate.includes('T')) {
          startsAt = e.deadlineDate.slice(0, 16);
          endsAt = e.deadlineDate.slice(0, 16);
        } else {
          startsAt = `${e.deadlineDate}T09:00`;
          endsAt = `${e.deadlineDate}T10:00`;
        }

        const eventRes = await txQuery(
          `INSERT INTO app.personal_calendar_events
            (user_id, title, description, location, category, starts_at, ends_at, all_day, completed)
            OUTPUT ${outputProjection}
            VALUES ($1, $2, $3, $4, 'task', $5, $6, 0, 0)`,
          [
            user.userId,
            e.title.slice(0, 160),
            e.description || `Nhắc nhở hạn nộp: ${e.title}`,
            '',
            new Date(`${startsAt}:00Z`),
            new Date(`${endsAt}:00Z`),
          ]
        );
        const eventRow = eventRes.rows[0];
        const eventId = eventRow ? (eventRow.id || eventRow.event_id) : null;

        const reminderRes = await txQuery(
          `INSERT INTO app.calendar_reminders
            (user_id, title, deadline_date, regulation_id, award_period_id, kpi_goal_id, event_id, is_completed)
            OUTPUT INSERTED.reminder_id, INSERTED.created_at
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
          [
            user.userId,
            e.title,
            new Date(e.deadlineDate.includes('T') ? e.deadlineDate : `${e.deadlineDate}T00:00:00Z`),
            e.regulationId || null,
            e.awardPeriodId || null,
            e.kpiGoalId || null,
            eventId,
          ]
        );
        const reminderRow = reminderRes.rows[0] || {};

        return {
          reminderId: reminderRow.reminder_id,
          eventId,
          title: e.title,
          deadlineDate: e.deadlineDate,
          regulationId: e.regulationId || null,
          awardPeriodId: e.awardPeriodId || null,
          kpiGoalId: e.kpiGoalId || null,
          createdAt: reminderRow.created_at,
        };
      });
    },
    async listReminders(user) {
      const res = await run(
        `SELECT r.reminder_id AS "reminderId", r.user_id AS "userId", r.title,
                 CONVERT(varchar(19), r.deadline_date, 126) AS "deadlineDate",
                 r.regulation_id AS "regulationId", rd.title AS "regulationTitle",
                 r.award_period_id AS "awardPeriodId", ap.name AS "awardPeriodName",
                 r.kpi_goal_id AS "kpiGoalId", kg.title AS "kpiGoalTitle",
                 r.event_id AS "eventId", r.is_completed AS "isCompleted",
                 r.created_at AS "createdAt"
          FROM app.calendar_reminders r
          LEFT JOIN app.regulation_documents rd ON rd.document_id = r.regulation_id
          LEFT JOIN app.award_periods ap ON ap.award_period_id = r.award_period_id
          LEFT JOIN app.kpi_goals kg ON kg.goal_id = r.kpi_goal_id
          WHERE r.user_id = $1
          ORDER BY r.deadline_date ASC, r.created_at DESC`,
        [user.userId]
      );
      return res.rows;
    },

    async missing(user, eventId) {
      const own = await run('SELECT event_id FROM app.personal_calendar_events WHERE user_id=$1 AND event_id=$2', [user.userId,eventId]);
      if (!own.rows.length) throw new NotFoundError('Không tìm thấy lịch cá nhân');
      throw new ConcurrencyConflictError('Lịch đã thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.');
    },
  };
}
