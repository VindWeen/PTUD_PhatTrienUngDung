import express from 'express';
import { randomBytes } from 'node:crypto';
import { authenticate } from '../../middlewares/authenticate.js';
import { query } from '../../utils/dbHelper.js';
import { ConcurrencyConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import profileService from '../profiles/profileService.js';
import { cvSchema, emptyDraft, buildPublicCv, filterPublishedAchievements } from './cvSchemas.js';

const router = express.Router();
const handle = fn => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };
const respond = (res, data) => res.json({ success: true, data });
const achievementsFor = async id => (await query(`SELECT achievement_id AS "achievementId", title, recognition_year AS "recognitionYear" FROM app.achievements WHERE lecturer_id=$1 AND status='VERIFIED' ORDER BY recognition_year DESC, achievement_id DESC`, [id])).rows;
const own = async userId => {
  const profile = await profileService.getOwnProfile(userId);
  const [result, achievements] = await Promise.all([query('SELECT public_id, draft, published, version, published_at, draft IS DISTINCT FROM published_draft AS unpublished_changes FROM app.lecturer_cvs WHERE lecturer_id=$1', [profile.lecturerId]), achievementsFor(profile.lecturerId)]);
  return { profile, achievements, row: result.rows[0] };
};
router.get('/cv/:id', handle(async (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow'); res.set('Cache-Control', 'no-store');
  if (!/^[a-f0-9]{32}$/.test(req.params.id)) throw new NotFoundError('CV không tồn tại hoặc đã ngừng chia sẻ');
  const result = await query(`SELECT c.published, c.lecturer_id FROM app.lecturer_cvs c JOIN app.lecturers l ON l.lecturer_id=c.lecturer_id JOIN app.users u ON u.user_id=l.user_id WHERE c.public_id=$1 AND c.published IS NOT NULL AND l.is_active=TRUE AND u.status='ACTIVE'`, [req.params.id]);
  if (!result.rows[0]) throw new NotFoundError('CV không tồn tại hoặc đã ngừng chia sẻ');
  const cv = result.rows[0];
  respond(res, filterPublishedAchievements(cv.published, await achievementsFor(cv.lecturer_id)));
}));
router.get('/me/cv', authenticate, handle(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { profile, achievements, row } = await own(req.user.userId);
  const unavailableAchievements = (row?.draft?.achievementIds || []).filter(id => !achievements.some(item => Number(item.achievementId) === Number(id)));
  respond(res, { draft: row ? { ...row.draft, version: row.version } : emptyDraft, publicId: row?.public_id || null, isPublished: Boolean(row?.published), unpublishedChanges: Boolean(row?.published && row.unpublished_changes), publishedAt: row?.published_at || null, unavailableAchievements, profile, achievements });
}));
router.put('/me/cv', authenticate, handle(async (req, res) => {
  const v = cvSchema.parse(req.body); const { profile } = await own(req.user.userId);
  const { version, ...draft } = v;
  let result;
  if (version === 0) result = await query(`INSERT INTO app.lecturer_cvs (lecturer_id, public_id, draft) VALUES ($1,$2,$3::jsonb) ON CONFLICT (lecturer_id) DO NOTHING RETURNING version,public_id`, [profile.lecturerId, randomBytes(16).toString('hex'), JSON.stringify(draft)]);
  else result = await query(`UPDATE app.lecturer_cvs SET draft=$1::jsonb,version=version+1,updated_at=NOW() WHERE lecturer_id=$2 AND version=$3 RETURNING version,public_id`, [JSON.stringify(draft), profile.lecturerId, version]);
  if (!result.rowCount) throw new ConcurrencyConflictError();
  respond(res, { version: result.rows[0].version, publicId: result.rows[0].public_id });
}));
function parseVersion(body) {
  const version = body?.version;
  if (!Number.isSafeInteger(version) || version < 1 || Object.keys(body).length !== 1) throw new ValidationError('Phiên bản CV không hợp lệ.');
  return version;
}
router.post('/me/cv/publish', authenticate, handle(async (req, res) => {
  const version = parseVersion(req.body); const { profile, achievements, row } = await own(req.user.userId);
  if (!row || row.version !== version) throw new ConcurrencyConflictError();
  const draft = cvSchema.parse({ ...row.draft, version: row.version });
  if (draft.workHistoryIds.some(id => !profile.workHistory.some(item => Number(item.assignmentId) === id)) || draft.achievementIds.some(id => !achievements.some(item => Number(item.achievementId) === id))) throw new ValidationError('Danh sách đã chọn thay đổi. Hãy tải lại và chọn lại trước khi công khai.');
  const snapshot = buildPublicCv(draft, profile, achievements);
  const result = await query('UPDATE app.lecturer_cvs SET published=$1::jsonb,published_draft=draft,published_at=NOW(),version=version+1,updated_at=NOW() WHERE lecturer_id=$2 AND version=$3 RETURNING version,public_id,published_at', [JSON.stringify(snapshot), profile.lecturerId, version]);
  if (!result.rowCount) throw new ConcurrencyConflictError();
  respond(res, { version: result.rows[0].version, publicId: result.rows[0].public_id, publishedAt: result.rows[0].published_at });
}));
router.post('/me/cv/rotate-link', authenticate, handle(async (req, res) => {
  const version = parseVersion(req.body); const { profile } = await own(req.user.userId);
  const result = await query('UPDATE app.lecturer_cvs SET public_id=$1,version=version+1,updated_at=NOW() WHERE lecturer_id=$2 AND version=$3 AND published IS NOT NULL RETURNING version,public_id', [randomBytes(16).toString('hex'), profile.lecturerId, version]);
  if (!result.rowCount) throw new ConcurrencyConflictError('CV đã thay đổi hoặc chưa được chia sẻ. Hãy tải lại trang.');
  respond(res, { version: result.rows[0].version, publicId: result.rows[0].public_id });
}));
router.post('/me/cv/unpublish', authenticate, handle(async (req, res) => {
  const version = parseVersion(req.body); const { profile } = await own(req.user.userId);
  const result = await query('UPDATE app.lecturer_cvs SET published=NULL,version=version+1,updated_at=NOW() WHERE lecturer_id=$1 AND version=$2 RETURNING version', [profile.lecturerId, version]);
  if (!result.rowCount) throw new ConcurrencyConflictError();
  respond(res, { version: result.rows[0].version });
}));
export default router;
