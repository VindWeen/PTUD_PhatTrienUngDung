import { query } from '../../utils/dbHelper.js';

export async function findProfileByUserId(userId, client = null) {
  const db = client ? client.query.bind(client) : query;
  const res = await db(
    `SELECT TOP 1 * FROM app.cv_profiles WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );
  return res.rows[0] || null;
}

export async function findProfileBySlug(slug, client = null) {
  const db = client ? client.query.bind(client) : query;
  const res = await db(
    `SELECT TOP 1 * FROM app.cv_profiles WHERE slug = $1`,
    [slug]
  );
  return res.rows[0] || null;
}

export async function findProfileBySlugOrId(slugOrId, client = null) {
  const db = client ? client.query.bind(client) : query;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  if (isUuid) {
    const res = await db(
      `SELECT TOP 1 * FROM app.cv_profiles WHERE profile_id = $1`,
      [slugOrId]
    );
    if (res.rows[0]) return res.rows[0];
  }

  const isNumeric = /^\d+$/.test(slugOrId);
  if (isNumeric) {
    const res = await db(
      `SELECT TOP 1 * FROM app.cv_profiles WHERE user_id = $1 OR slug = $1`,
      [slugOrId]
    );
    if (res.rows[0]) return res.rows[0];
  }

  const res = await db(
    `SELECT TOP 1 * FROM app.cv_profiles WHERE slug = $1`,
    [slugOrId]
  );
  return res.rows[0] || null;
}

export async function upsertProfile(userId, data, client = null) {
  const db = client ? client.query.bind(client) : query;
  const existing = await findProfileByUserId(userId, client);

  const selectedIdsJson = Array.isArray(data.selectedAchievementIds)
    ? JSON.stringify(data.selectedAchievementIds)
    : (data.selectedAchievementIds || null);

  if (existing) {
    const res = await db(
      `UPDATE app.cv_profiles
       SET slug = COALESCE($2, slug),
           is_public = COALESCE($3, is_public),
           template_id = COALESCE($4, template_id),
           headline = COALESCE($5, headline),
           bio = COALESCE($6, bio),
           selected_achievement_ids = COALESCE($7, selected_achievement_ids),
           version = version + 1,
           updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE profile_id = $1`,
      [
        existing.profile_id,
        data.slug !== undefined ? data.slug : null,
        data.isPublic !== undefined ? (data.isPublic ? 1 : 0) : null,
        data.templateId !== undefined ? data.templateId : null,
        data.headline !== undefined ? data.headline : null,
        data.bio !== undefined ? data.bio : null,
        selectedIdsJson,
      ]
    );
    return res.rows[0];
  }

  const res = await db(
    `INSERT INTO app.cv_profiles
      (user_id, slug, is_public, template_id, headline, bio, selected_achievement_ids, version)
     OUTPUT INSERTED.*
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [
      userId,
      data.slug || null,
      data.isPublic ? 1 : 0,
      data.templateId || 'Modern',
      data.headline || null,
      data.bio || null,
      selectedIdsJson,
    ]
  );
  return res.rows[0];
}

export async function getUserActiveAchievements(userId, selectedIds = null, client = null) {
  const db = client ? client.query.bind(client) : query;
  const res = await db(
    `SELECT a.achievement_id, a.title, a.status, a.recognition_year, a.achievement_date,
            NULL AS decision_number, NULL AS issuing_authority, at.name AS achievement_type_name
     FROM app.achievements a
     LEFT JOIN app.achievement_types at ON at.achievement_type_id = a.achievement_type_id
     WHERE (a.created_by = $1 OR a.lecturer_id = (SELECT TOP 1 lecturer_id FROM app.lecturers WHERE user_id = $1))
       AND a.status = 'ACTIVE'
       AND a.deleted_at IS NULL
     ORDER BY a.recognition_year DESC, a.achievement_id DESC`,
    [userId]
  );
  let achievements = res.rows;
  if (Array.isArray(selectedIds) && selectedIds.length > 0) {
    const idSet = new Set(selectedIds.map(Number));
    achievements = achievements.filter(a => idSet.has(Number(a.achievement_id)));
  }
  return achievements;
}

export async function getUserContact(userId, client = null) {
  const db = client ? client.query.bind(client) : query;
  const res = await db(
    `SELECT u.user_id, u.display_name, COALESCE(l.full_name, u.display_name) AS full_name, u.email,
            l.employee_code, l.title, l.degree, COALESCE(l.phone, '') AS phone,
            ou.name AS unit_name
     FROM app.users u
     LEFT JOIN app.lecturers l ON l.user_id = u.user_id AND l.is_active = 1
     LEFT JOIN app.lecturer_assignments la ON la.lecturer_id = l.lecturer_id AND la.is_primary = 1
     LEFT JOIN app.organization_units ou ON ou.unit_id = la.unit_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return res.rows[0] || {
    user_id: userId,
    full_name: 'Người dùng',
    email: '',
    phone: '',
    title: '',
    degree: '',
  };
}

export default {
  findProfileByUserId,
  findProfileBySlug,
  findProfileBySlugOrId,
  upsertProfile,
  getUserActiveAchievements,
  getUserContact,
};
