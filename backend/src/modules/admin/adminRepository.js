import { query, withTransaction } from '../../utils/dbHelper.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { catalogDefinitions } from './adminSchemas.js';

export async function list(resource) {
  const tables = { users: ['users', 'user_id'], roles: ['roles', 'role_id'], scopes: ['user_unit_scopes', 'user_unit_scope_id'], 'user-roles': ['user_roles', 'user_role_id'], representatives: ['unit_representatives', 'unit_representative_id'] };
  const def = catalogDefinitions[resource];
  const [table, key] = def ? [def.table, def.id] : tables[resource];
  const fields = resource === 'users' ? 'user_id, username, email, display_name, status, version'
    : resource === 'academic-years' ? 'academic_year_id,code,name,start_date::text,end_date::text,is_current,is_active,created_at,updated_at' : '*';
  return (await query(`SELECT ${fields} FROM app.${table} ORDER BY ${key} LIMIT 500`)).rows;
}

// Every mutation and its audit share a transaction; password hashes never enter audit.
export async function mutate(actorId, entity, operation) {
  return withTransaction(async ({ query: tx }) => {
    const result = await operation(tx);
    const safe = { ...result };
    delete safe.password_hash;
    await tx(`INSERT INTO app.audit_logs (user_id, action, entity_name, entity_id, new_values)
      VALUES ($1, $2, $3, $4, $5)`, [actorId, 'ADMIN_CHANGE', entity, safe.id ?? null, JSON.stringify(safe)]);
    return safe;
  });
}

export async function createUser(actor, v, hash) {
  return mutate(actor, 'users', async tx => (await tx(`INSERT INTO app.users (username,email,display_name,password_hash,must_change_password)
    VALUES ($1,$2,$3,$4,TRUE) RETURNING user_id AS id, username,email,display_name,status,version`, [v.username, v.email, v.displayName, hash])).rows[0]);
}
export async function updateUser(actor, id, v) {
  return mutate(actor, 'users', async tx => {
    const result = await tx(`UPDATE app.users SET email=$1, display_name=$2, status=$3, version=version+1, updated_at=NOW()
      WHERE user_id=$4 AND version=$5 RETURNING user_id AS id,email,display_name,status,version`, [v.email,v.displayName,v.status,id,v.version]);
    if (!result.rowCount) throw new ConflictError('Tài khoản không tồn tại hoặc phiên bản đã thay đổi');
    if (v.status !== 'ACTIVE') await tx('UPDATE app.refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
    return result.rows[0];
  });
}
export async function assign(actor, resource, v) {
  return mutate(actor, resource, async tx => {
    const user = await tx("SELECT user_id FROM app.users WHERE user_id=$1 AND status='ACTIVE' FOR UPDATE", [v.userId]);
    if (!user.rowCount) throw new ConflictError('Tài khoản không hoạt động');
    if (v.unitId) {
      const unit = await tx('SELECT unit_id FROM app.organization_units WHERE unit_id=$1 AND is_active=TRUE FOR UPDATE', [v.unitId]);
      if (!unit.rowCount) throw new ConflictError('Đơn vị không hoạt động');
    }
    if (resource === 'representatives') {
      const role = await tx(`SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.role_id=ur.role_id
        WHERE ur.user_id=$1 AND r.code='UNIT_REPRESENTATIVE' AND r.is_active=TRUE AND ur.revoked_at IS NULL
          AND ur.valid_from <= $2 AND (ur.valid_to IS NULL OR ur.valid_to >= $3)`, [v.userId,v.validFrom,v.validTo]);
      if (!role.rowCount) throw new ConflictError('Cần vai trò đại diện bao phủ thời hạn phân công');
      return (await tx(`INSERT INTO app.unit_representatives (user_id,unit_id,valid_from,valid_to,assigned_by)
        VALUES ($1,$2,$3,$4,$5) RETURNING *,unit_representative_id AS id`, [v.userId,v.unitId,v.validFrom,v.validTo,actor])).rows[0];
    }
    const role = await tx('SELECT code FROM app.roles WHERE role_id=$1 AND is_active=TRUE', [v.roleId]);
    if (!role.rowCount) throw new ConflictError('Vai trò không hoạt động');
    if (resource === 'user-roles') return (await tx(`INSERT INTO app.user_roles (user_id,role_id,valid_from,valid_to)
      VALUES ($1,$2,$3,$4) RETURNING *,user_role_id AS id`, [v.userId,v.roleId,v.validFrom,v.validTo])).rows[0];
    if (!['MANAGER','RECORDS_OFFICER'].includes(role.rows[0].code)) throw new ConflictError('Scope chỉ dành cho Manager/RecordsOfficer; đại diện dùng phân công đại diện');
    if (!v.unitId) throw new ConflictError('Thiếu đơn vị scope');
    const grant = await tx(`SELECT 1 FROM app.user_roles WHERE user_id=$1 AND role_id=$2 AND revoked_at IS NULL AND valid_from <= $3
      AND (valid_to IS NULL OR ($4::timestamptz IS NOT NULL AND valid_to >= $4))`, [v.userId,v.roleId,v.validFrom,v.validTo]);
    if (!grant.rowCount) throw new ConflictError('Thời hạn scope phải nằm trong thời hạn vai trò');
    return (await tx(`INSERT INTO app.user_unit_scopes (user_id,role_id,unit_id,include_descendants,valid_from,valid_to)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *,user_unit_scope_id AS id`, [v.userId,v.roleId,v.unitId,v.includeDescendants,v.validFrom,v.validTo])).rows[0];
  });
}
export async function revoke(actor, resource, id) {
  const defs = { scopes: ['user_unit_scopes','user_unit_scope_id'], 'user-roles': ['user_roles','user_role_id'], representatives: ['unit_representatives','unit_representative_id'] };
  const [table,key] = defs[resource];
  return mutate(actor, resource, async tx => {
    // Future assignments are retained as cancelled history via revoked_at.
    const r = await tx(`UPDATE app.${table} SET revoked_at=NOW() WHERE ${key}=$1 AND revoked_at IS NULL RETURNING *,${key} AS id`, [id]);
    if (!r.rowCount) throw new NotFoundError('Phân công không tồn tại hoặc đã thu hồi');
    return r.rows[0];
  });
}
export async function saveCatalog(actor, resource, id, v) {
  const d = catalogDefinitions[resource];
  const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const values = d.columns.map(c => v[camel(c)]);
  return mutate(actor, d.table, async tx => {
    const sql = id ? `UPDATE app.${d.table} SET ${d.columns.map((c,i) => `${c}=$${i+1}`).join(',')},updated_at=NOW() WHERE ${d.id}=$${values.length+1} RETURNING *,${d.id} AS id`
      : `INSERT INTO app.${d.table} (${d.columns.join(',')}) VALUES (${values.map((_,i) => `$${i+1}`).join(',')}) RETURNING *,${d.id} AS id`;
    const r = await tx(sql, id ? [...values,id] : values);
    if (!r.rowCount) throw new NotFoundError();
    return r.rows[0];
  });
}
export async function deactivateCatalog(actor, resource, id) {
  const d = catalogDefinitions[resource];
  return mutate(actor, d.table, async tx => {
    const r = await tx(`UPDATE app.${d.table} SET is_active=FALSE,updated_at=NOW()${resource === 'academic-years' ? ',is_current=FALSE' : ''} WHERE ${d.id}=$1 RETURNING *,${d.id} AS id`, [id]);
    if (!r.rowCount) throw new NotFoundError();
    return r.rows[0];
  });
}
