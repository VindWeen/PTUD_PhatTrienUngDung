import { query } from '../utils/dbHelper.js';
import { ForbiddenError } from '../utils/errors.js';
import { canAccessOrg, canAccessOrgDirectly, orgScopeIds } from './access.js';

export const regulationPermissions = ['REGULATIONS_CREATE','REGULATIONS_MANAGE','REGULATIONS_PUBLISH','REGULATIONS_SHARE','REGULATIONS_ADOPT','REGULATIONS_UPDATE'];

const retiredDemoCodes = new Set([
  'DEMO-TDKT-LUAT-2022',
  'DEMO-TDKT-LUAT-2026',
  'DEMO-TDKT-TT-2026',
  'DEMO-TDKT-CA-NHAN',
  'DEMO-TDKT-KHOA-A',
]);

export function isRetiredDemoRegulation(code) {
  return retiredDemoCodes.has(code);
}

async function activeUser(userId, db) {
  return (await db("SELECT id FROM app.users WHERE id=$1 AND account_status='ACTIVE'",[userId])).rows.length>0;
}

export async function canManageRegulation(userId, regulationId, db=query, permission='REGULATIONS_MANAGE') {
  if (!await activeUser(userId,db)) return false;
  const r=(await db('SELECT * FROM app.regulations WHERE id=$1',[regulationId])).rows[0];
  if (!r) return false;
  // A system role never opens another person's private vault.
  if (r.owner_type==='PERSONAL') return Number(r.owner_user_id??r.created_by_user_id)===Number(userId);
  return canAccessOrgDirectly(userId,r.owner_organization_id,permission,db);
}

export async function authorizeRegulation(userId, regulationId, db=query, permission='REGULATIONS_MANAGE') {
  if (!await canManageRegulation(userId,regulationId,db,permission)) throw new ForbiddenError();
  return true;
}

// Every row is one explicit selection context. Two organizations can pin different
// versions of the same document without either pin hiding or replacing the other.
export async function listAccessiblePinnedContexts(userId, db=query) {
  if (!await activeUser(userId,db)) return [];
  return (await db(`WITH member_ancestors AS (
    SELECT o.id,o.parent_id,m.organization_id AS member_organization_id FROM app.memberships m
    JOIN app.organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
    WHERE m.user_id=$1 AND m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME())
    UNION ALL SELECT o.id,o.parent_id,a.member_organization_id FROM app.organizations o JOIN member_ancestors a ON a.parent_id=o.id WHERE o.status='ACTIVE'
  )
  SELECT a.id AS adoption_id,a.regulation_id,a.regulation_version_id,a.source_type,
    a.organization_id,CAST(NULL AS bigint) AS member_organization_id,'PERSONAL' AS context_type,
    r.name,r.code,v.version_label,v.effective_from,v.effective_to
  FROM app.regulation_adoptions a JOIN app.regulations r ON r.id=a.regulation_id JOIN app.regulation_versions v ON v.id=a.regulation_version_id
  WHERE a.user_id=$1 AND v.publication_status='PUBLISHED'
  UNION
  SELECT a.id,a.regulation_id,a.regulation_version_id,a.source_type,a.organization_id,m.member_organization_id,'ORGANIZATION',
    r.name,r.code,v.version_label,v.effective_from,v.effective_to
  FROM member_ancestors m JOIN app.regulation_adoptions a ON a.organization_id=m.id
  JOIN app.regulations r ON r.id=a.regulation_id JOIN app.regulation_versions v ON v.id=a.regulation_version_id
  WHERE v.publication_status='PUBLISHED' AND
    (m.id=m.member_organization_id OR a.source_type<>'OWNED' OR r.is_internal=1 OR r.is_public=1)
  UNION
  SELECT CAST(NULL AS bigint),r.id,v.id,'OWNED',CAST(NULL AS bigint),CAST(NULL AS bigint),'OWNER',
    r.name,r.code,v.version_label,v.effective_from,v.effective_to
  FROM app.regulations r JOIN app.regulation_versions v ON v.regulation_id=r.id
  WHERE r.owner_type='PERSONAL' AND COALESCE(r.owner_user_id,r.created_by_user_id)=$1 AND v.publication_status='PUBLISHED'
    AND NOT EXISTS (SELECT 1 FROM app.regulation_personal_exclusions e WHERE e.user_id=$1 AND e.regulation_version_id=v.id)
    AND NOT EXISTS (SELECT 1 FROM app.regulation_adoptions a WHERE a.user_id=$1 AND a.regulation_version_id=v.id)
  OPTION(MAXRECURSION 32767)`,[userId])).rows;
}

export async function canUseVersion(userId, versionId, db=query, organizationId=null) {
  if (!await activeUser(userId,db)) return false;
  if (organizationId==null) return (await listAccessiblePinnedContexts(userId,db)).some(c=>Number(c.regulation_version_id)===Number(versionId));
  // Organization scans must use that organization's selected pin, even for an
  // owner or administrator. A personal adoption cannot supply an organization scan.
  const membership=(await db(`WITH ancestors AS (
   SELECT o.id,o.parent_id FROM app.memberships m JOIN app.organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
   WHERE m.user_id=$1 AND m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME())
   UNION ALL SELECT o.id,o.parent_id FROM app.organizations o JOIN ancestors a ON a.parent_id=o.id WHERE o.status='ACTIVE'
  ) SELECT TOP(1) id FROM ancestors WHERE id=$2 OPTION(MAXRECURSION 32767)`,[userId,organizationId])).rows.length>0;
  if (!membership && !await canAccessOrg(userId,organizationId,'ASSESSMENTS_RUN',db)) return false;
  const directScan=!membership && await canAccessOrgDirectly(userId,organizationId,'ASSESSMENTS_RUN',db);
  return (await db(`WITH ancestors AS (
   SELECT id,parent_id FROM app.organizations WHERE id=$1 AND status='ACTIVE'
   UNION ALL SELECT o.id,o.parent_id FROM app.organizations o JOIN ancestors a ON a.parent_id=o.id WHERE o.status='ACTIVE'
  ) SELECT a.organization_id,a.source_type,r.is_internal,r.is_public
  FROM ancestors o JOIN app.regulation_adoptions a ON a.organization_id=o.id
  JOIN app.regulations r ON r.id=a.regulation_id
  JOIN app.regulation_versions v ON v.id=a.regulation_version_id WHERE v.id=$2 AND v.publication_status='PUBLISHED'
  OPTION(MAXRECURSION 32767)`,[organizationId,versionId])).rows.some(pin =>
    (Number(pin.organization_id)===Number(organizationId) || pin.source_type!=='OWNED' || pin.is_internal || pin.is_public)
    && (membership || Number(pin.organization_id)!==Number(organizationId) || pin.source_type!=='OWNED'
      || pin.is_public || directScan));
}

export async function canReadVersion(userId, versionId, db=query) {
  if (!await activeUser(userId,db)) return false;
  const v=(await db(`SELECT v.id,v.regulation_id,v.publication_status,r.owner_type,r.owner_organization_id,r.is_internal,r.is_public
    FROM app.regulation_versions v JOIN app.regulations r ON r.id=v.regulation_id WHERE v.id=$1`,[versionId])).rows[0];
  if (!v) return false;
  if (await canManageRegulation(userId,v.regulation_id,db)) return true;
  // Split duties may publish/share without the general editing grant.
  if (v.owner_type==='ORGANIZATION') for (const p of ['REGULATIONS_PUBLISH','REGULATIONS_SHARE']) {
    if (await canAccessOrgDirectly(userId,v.owner_organization_id,p,db)) return true;
  }
  if (v.publication_status!=='PUBLISHED') return false;
  if (v.is_public) return true;
  if ((await db("SELECT id FROM app.regulation_shares WHERE regulation_version_id=$1 AND recipient_user_id=$2 AND status='ACCEPTED'",[versionId,userId])).rows.length) return true;
  if (await canUseVersion(userId,versionId,db)) return true;
  if (v.is_internal && (await db(`WITH ancestors AS (
    SELECT o.id,o.parent_id FROM app.memberships m JOIN app.organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
    WHERE m.user_id=$1 AND m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME())
    UNION ALL SELECT o.id,o.parent_id FROM app.organizations o JOIN ancestors a ON a.parent_id=o.id WHERE o.status='ACTIVE'
   ) SELECT TOP(1) id FROM ancestors WHERE id=$2 OPTION(MAXRECURSION 32767)`,[userId,v.owner_organization_id])).rows.length) return true;
  const shares=(await db("SELECT recipient_user_id,recipient_organization_id FROM app.regulation_shares WHERE regulation_version_id=$1 AND status='PENDING'",[versionId])).rows;
  for (const s of shares) {
    if (s.recipient_user_id!=null && Number(s.recipient_user_id)===Number(userId)) return true;
    if (s.recipient_organization_id!=null && await canAccessOrgDirectly(userId,s.recipient_organization_id,'REGULATIONS_ADOPT',db)) return true;
  }
  // Grant holders may inspect the organization's inherited pin without joining
  // the organization as members. Expired grants cannot confer this access.
  const pins=(await db('SELECT organization_id FROM app.regulation_adoptions WHERE regulation_version_id=$1 AND organization_id IS NOT NULL',[versionId])).rows;
  for (const p of pins) for (const permission of ['ASSESSMENTS_RUN','REGULATIONS_ADOPT','REGULATIONS_UPDATE']) {
    if (await canAccessOrgDirectly(userId,p.organization_id,permission,db)) return true;
  }
  if(pins.length)for(const orgId of await orgScopeIds(userId,'ASSESSMENTS_RUN',db)){
    if(await canUseVersion(userId,versionId,db,orgId))return true;
  }
  return false;
}

export const accessiblePinnedContexts = listAccessiblePinnedContexts;
