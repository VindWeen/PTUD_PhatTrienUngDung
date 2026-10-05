import { z } from 'zod';
import { query } from '../../utils/dbHelper.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

const id = z.coerce.number().int().positive().safe();
export const listSchema = z.object({
 page: id.default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
 unreadOnly: z.enum(['true','false']).optional(),
}).strict();
export const eventSchema = z.object({
 entityType: z.enum(['AWARD','ACHIEVEMENT']), entityId: id,
 version: id.refine(v => v > 1), fromStatus: z.string(), toStatus: z.string(),
}).strict();
const transitions = {
 AWARD: { DRAFT: ['RECORDED'], RECORDED: ['REVOKED'] },
 ACHIEVEMENT: { DRAFT: ['SUBMITTED','CANCELLED'], NEED_CORRECTION: ['SUBMITTED','CANCELLED'],
  SUBMITTED: ['NEED_CORRECTION','VERIFIED','REJECTED','CANCELLED'], VERIFIED: ['REVOKED'] },
};

// Used both when selecting recipients and reading the inbox: assignments can expire.
const activeRole = (uid, code) => `EXISTS (SELECT 1 FROM app.user_roles ur JOIN app.roles role USING(role_id)
 WHERE ur.user_id=${uid} AND role.code='${code}' AND role.is_active=TRUE
 AND ur.revoked_at IS NULL AND ur.valid_from<=NOW() AND (ur.valid_to IS NULL OR ur.valid_to>NOW()))`;
const subject = (a, uid) => `(EXISTS (SELECT 1 FROM app.lecturers l WHERE l.lecturer_id=${a}.lecturer_id AND l.user_id=${uid})
 OR (${a}.unit_id IS NOT NULL AND ${activeRole(uid,'UNIT_REPRESENTATIVE')}
 AND EXISTS (SELECT 1 FROM app.unit_representatives rep JOIN app.organization_units ou USING(unit_id)
 WHERE rep.unit_id=${a}.unit_id AND rep.user_id=${uid} AND ou.is_active=TRUE AND rep.revoked_at IS NULL
 AND rep.valid_from<=NOW() AND (rep.valid_to IS NULL OR rep.valid_to>NOW()))))`;
const manager = (a, uid) => `(${activeRole(uid,'MANAGER')} AND EXISTS (
 WITH RECURSIVE ancestors AS (
 SELECT unit_id,parent_id FROM app.organization_units WHERE unit_id=${a}.context_unit_id AND is_active=TRUE
 UNION ALL SELECT ou.unit_id,ou.parent_id FROM app.organization_units ou JOIN ancestors h ON h.parent_id=ou.unit_id WHERE ou.is_active=TRUE
 ) SELECT 1 FROM ancestors h JOIN app.user_unit_scopes s USING(unit_id) JOIN app.roles role USING(role_id)
 WHERE s.user_id=${uid} AND role.code='MANAGER' AND role.is_active=TRUE AND s.revoked_at IS NULL
 AND s.valid_from<=NOW() AND (s.valid_to IS NULL OR s.valid_to>NOW())
 AND (s.unit_id=${a}.context_unit_id OR s.include_descendants=TRUE))
 AND ${a}.created_by<>${uid} AND (${a}.submitted_by IS NULL OR ${a}.submitted_by<>${uid})
 AND NOT EXISTS (SELECT 1 FROM app.lecturers l WHERE l.lecturer_id=${a}.lecturer_id AND l.user_id=${uid}))`;
const visible = `n.user_id=$1 AND (
 (n.entity_type='AWARD' AND EXISTS (SELECT 1 FROM app.award_records a WHERE a.record_id=n.entity_id AND ${subject('a','$1')}))
 OR (n.entity_type='ACHIEVEMENT' AND EXISTS (SELECT 1 FROM app.achievements a WHERE a.achievement_id=n.entity_id
 AND ((n.audience='SUBJECT' AND ${subject('a','$1')}) OR (n.audience='MANAGER' AND ${manager('a','$1')})))))`;
const fields = `n.notification_id AS "notificationId", n.entity_type AS "entityType", n.entity_id AS "entityId",
 n.entity_version AS "version", n.from_status AS "fromStatus", n.to_status AS "toStatus",
 n.created_at AS "createdAt", n.read_at AS "readAt"`;

/** Caller validates rights/state and writes status/history first, then awaits this with the SAME pg client.
 * No commit, pool fallback, swallowed error, arbitrary recipients, or sensitive payload here.
 */
export async function notifyStatusChanged(client, rawEvent) {
 if (!client || typeof client.query !== 'function') throw new ValidationError('Cần pg client của transaction gọi');
 const e = eventSchema.parse(rawEvent);
 if (!transitions[e.entityType][e.fromStatus]?.includes(e.toStatus)) throw new ValidationError('Event chuyển trạng thái không hợp lệ');
 const award = e.entityType === 'AWARD';
 const table = award ? 'award_records' : 'achievements';
 const key = award ? 'record_id' : 'achievement_id';
 const a = (await client.query(`SELECT * FROM app.${table} WHERE ${key}=$1 FOR UPDATE`,[e.entityId])).rows[0];
 if (!a || a.status !== e.toStatus || String(a.version) !== String(e.version)) throw new ValidationError('Event không khớp trạng thái/phiên bản đã lưu');
 if (award) {
  const history = await client.query(`SELECT 1 FROM app.award_record_histories WHERE record_id=$1 AND from_status=$2 AND to_status=$3`,[e.entityId,e.fromStatus,e.toStatus]);
  if (!history.rows.length) throw new ValidationError('Thiếu lịch sử chuyển trạng thái');
 }
 const audience = !award && e.toStatus === 'SUBMITTED' ? 'MANAGER' : 'SUBJECT';
 const allowed = audience === 'MANAGER' ? manager('a','u.user_id') : subject('a','u.user_id');
 return (await client.query(`INSERT INTO app.notifications(user_id,entity_type,entity_id,entity_version,from_status,to_status,audience)
 SELECT u.user_id,$2,$1,$3,$4,$5,$6 FROM app.users u CROSS JOIN app.${table} a
 WHERE a.${key}=$1 AND u.status='ACTIVE' AND ${allowed}
 ON CONFLICT(user_id,entity_type,entity_id,entity_version) DO NOTHING RETURNING notification_id`,
 [e.entityId,e.entityType,e.version,e.fromStatus,e.toStatus,audience])).rows;
}

export async function listNotifications(user, rawQuery = {}) {
 const q = listSchema.parse(rawQuery);
 // One statement/snapshot for rows, total and unread count, including empty pages.
 const r = await query(`WITH inbox AS (SELECT ${fields} FROM app.notifications n WHERE ${visible}),
 filtered AS (SELECT * FROM inbox WHERE ($2::boolean=FALSE OR "readAt" IS NULL)),
 page AS (SELECT * FROM filtered ORDER BY "createdAt" DESC,"notificationId" DESC LIMIT $3 OFFSET $4)
 SELECT COALESCE((SELECT jsonb_agg(p ORDER BY p."createdAt" DESC,p."notificationId" DESC) FROM page p),'[]'::jsonb) AS items,
 (SELECT COUNT(*)::int FROM filtered) AS total,(SELECT COUNT(*)::int FROM inbox WHERE "readAt" IS NULL) AS "unreadCount"`,
 [id.parse(user.userId),q.unreadOnly === 'true',q.pageSize,(q.page-1)*q.pageSize]);
 return { ...r.rows[0],page:q.page,pageSize:q.pageSize };
}
export async function readNotification(user, rawId) {
 const r = await query(`UPDATE app.notifications n SET read_at=COALESCE(read_at,NOW()) WHERE ${visible}
 AND n.notification_id=$2 RETURNING ${fields}`,[id.parse(user.userId),id.parse(rawId)]);
 if (!r.rows.length) throw new NotFoundError();
 return r.rows[0];
}
