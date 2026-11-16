import { query } from '../utils/dbHelper.js';
import { verifyAccessToken } from '../utils/crypto.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export const permissions = ['MEMBERS_VIEW','ASSESSMENTS_VIEW','ASSESSMENTS_RUN','MEMBERS_NOTIFY','MEMBERS_MANAGE','STRUCTURE_MANAGE','ACCESS_MANAGE','REGULATIONS_CREATE','REGULATIONS_MANAGE','REGULATIONS_PUBLISH','REGULATIONS_SHARE','REGULATIONS_ADOPT','REGULATIONS_UPDATE'];
export async function hasGlobalRole(userId, roleCode, db = query) {
  return (await db(`SELECT TOP (1) g.id FROM app.global_role_grants g JOIN app.users u ON u.id=g.user_id WHERE u.account_status='ACTIVE' AND g.user_id=$1 AND g.role_code=$2 AND g.valid_from<=SYSUTCDATETIME() AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME())`, [userId, roleCode])).rows.length > 0;
}
export async function canAccessOrg(userId, orgId, permission, db = query, requireDescendants = false) {
  if (await hasGlobalRole(userId, 'SYSTEM_ADMIN', db)) return true;
  const rows = await db(`WITH ancestors AS (
    SELECT id,parent_id,0 AS depth FROM app.organizations WHERE id=$1 AND status='ACTIVE'
    UNION ALL SELECT o.id,o.parent_id,a.depth+1 FROM app.organizations o JOIN ancestors a ON a.parent_id=o.id WHERE o.status='ACTIVE'
  ) SELECT TOP (1) g.id FROM ancestors a JOIN app.org_access_grants g ON g.organization_id=a.id
  WHERE g.user_id=$2 AND EXISTS(SELECT 1 FROM app.users u WHERE u.id=g.user_id AND u.account_status='ACTIVE') AND g.permission_code=$3 AND g.valid_from<=SYSUTCDATETIME()
  AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME()) AND (a.depth=0 OR g.include_descendants=1)
  AND ($4=0 OR g.include_descendants=1) OPTION(MAXRECURSION 32767)`, [orgId,userId,permission,requireDescendants ? 1 : 0]);
  return rows.rows.length > 0;
}
export async function authorizeOrg(userId, orgId, permission, db = query, requireDescendants = false) {
  if (!await canAccessOrg(userId,orgId,permission,db,requireDescendants)) throw new ForbiddenError();
  return true;
}
export async function orgScopeIds(userId, permission, db = query) {
  if (await hasGlobalRole(userId,'SYSTEM_ADMIN',db)) return (await db("SELECT id FROM app.organizations WHERE status='ACTIVE'")).rows.map(x=>x.id);
  return (await db(`WITH scope AS (
    SELECT o.id,g.include_descendants FROM app.organizations o JOIN app.org_access_grants g ON g.organization_id=o.id
    WHERE o.status='ACTIVE' AND g.user_id=$1 AND EXISTS(SELECT 1 FROM app.users u WHERE u.id=g.user_id AND u.account_status='ACTIVE') AND g.permission_code=$2 AND g.valid_from<=SYSUTCDATETIME() AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME())
    UNION ALL SELECT o.id,s.include_descendants FROM app.organizations o JOIN scope s ON o.parent_id=s.id WHERE s.include_descendants=1 AND o.status='ACTIVE'
  ) SELECT DISTINCT id FROM scope OPTION(MAXRECURSION 32767)`,[userId,permission])).rows.map(x=>x.id);
}
export async function authenticate(req,res,next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new UnauthorizedError();
    let payload;
    try { payload=verifyAccessToken(token); } catch { throw new UnauthorizedError(); }
    if (!/^\d+$/.test(String(payload.userId)) || !/^\d+$/.test(String(payload.sessionId))) throw new UnauthorizedError();
    const session=(await query(`SELECT u.id FROM app.users u JOIN app.auth_sessions s ON s.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND u.account_status='ACTIVE' AND s.revoked_at IS NULL AND s.expires_at>SYSUTCDATETIME()`,[payload.userId,payload.sessionId])).rows[0];
    if (!session) throw new UnauthorizedError();
    const roles=(await query(`SELECT DISTINCT role_code FROM app.global_role_grants WHERE user_id=$1 AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[payload.userId])).rows.map(x=>x.role_code);
    req.user={userId:session.id,sessionId:payload.sessionId,roles:['MEMBER',...roles],roleCodes:['MEMBER',...roles]};
    next();
  } catch(error) { next(error); }
}
