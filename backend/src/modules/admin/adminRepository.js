import { createHash } from 'node:crypto';
import { query, withTransaction } from '../../utils/dbHelper.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { catalogDefinitions } from './adminSchemas.js';

export async function list(resource) {
  const tables = { users: ['users', 'user_id'], roles: ['roles', 'role_id'], scopes: ['user_unit_scopes', 'user_unit_scope_id'], 'user-roles': ['user_roles', 'user_role_id'], representatives: ['unit_representatives', 'unit_representative_id'] };
  const def = catalogDefinitions[resource];
  const [table, key] = def ? [def.table, def.id] : tables[resource];
  const fields = resource === 'users' ? 'user_id, username, email, display_name, status, version'
    : resource === 'academic-years' ? 'academic_year_id,code,name,CONVERT(varchar(10), start_date, 23) AS start_date,CONVERT(varchar(10), end_date, 23) AS end_date,is_current,is_active,created_at,updated_at' : '*';
  return (await query(`SELECT TOP (500) ${fields} FROM app.${table} ORDER BY ${key}`)).rows;
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
    OUTPUT INSERTED.user_id AS id, INSERTED.username,INSERTED.email,INSERTED.display_name,INSERTED.status,INSERTED.version VALUES ($1,$2,$3,$4,1)`, [v.username, v.email, v.displayName, hash])).rows[0]);
}
export async function updateUser(actor, id, v) {
  return mutate(actor, 'users', async tx => {
    const result = await tx(`UPDATE app.users SET email=$1, display_name=$2, status=$3, version=version+1, updated_at=SYSUTCDATETIME()
      OUTPUT INSERTED.user_id AS id,INSERTED.email,INSERTED.display_name,INSERTED.status,INSERTED.version WHERE user_id=$4 AND version=$5`, [v.email,v.displayName,v.status,id,v.version]);
    if (!result.rowCount) throw new ConflictError('Tài khoản không tồn tại hoặc phiên bản đã thay đổi');
    if (v.status !== 'ACTIVE') await tx('UPDATE app.refresh_tokens SET revoked_at=SYSUTCDATETIME() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
    return result.rows[0];
  });
}
export async function assign(actor, resource, v) {
  return mutate(actor, resource, tx => assignInTransaction(actor, resource, v, tx));
}
async function assignInTransaction(actor, resource, v, tx) {
    const user = await tx("SELECT user_id FROM app.users WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1 AND status='ACTIVE'", [v.userId]);
    if (!user.rowCount) throw new ConflictError('Tài khoản không hoạt động');
    if (v.unitId) {
      const unit = await tx('SELECT unit_id FROM app.organization_units WITH (UPDLOCK, HOLDLOCK) WHERE unit_id=$1 AND is_active=1', [v.unitId]);
      if (!unit.rowCount) throw new ConflictError('Đơn vị không hoạt động');
    }
    if (resource === 'representatives') {
      const role = await tx(`SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.role_id=ur.role_id
        WHERE ur.user_id=$1 AND r.code='UNIT_REPRESENTATIVE' AND r.is_active=1 AND ur.revoked_at IS NULL
          AND ur.valid_from <= $2 AND (ur.valid_to IS NULL OR ur.valid_to >= $3)`, [v.userId,v.validFrom,v.validTo]);
      if (!role.rowCount) throw new ConflictError('Cần vai trò đại diện bao phủ thời hạn phân công');
      return (await tx(`DECLARE @changed TABLE (id bigint); INSERT INTO app.unit_representatives (user_id,unit_id,valid_from,valid_to,assigned_by)
        OUTPUT INSERTED.unit_representative_id INTO @changed VALUES ($1,$2,$3,$4,$5); SELECT resultRow.*,resultRow.unit_representative_id AS id FROM app.unit_representatives resultRow JOIN @changed changed ON changed.id=resultRow.unit_representative_id`, [v.userId,v.unitId,v.validFrom,v.validTo,actor])).rows[0];
    }
    const role = await tx('SELECT code FROM app.roles WHERE role_id=$1 AND is_active=1', [v.roleId]);
    if (!role.rowCount) throw new ConflictError('Vai trò không hoạt động');
    if (resource === 'user-roles') {
      if (role.rows[0].code !== 'LECTURER' && (v.unitId || v.employeeCode))
        throw new ConflictError('Mã giảng viên và đơn vị công tác chỉ dùng khi cấp vai trò Giảng viên');
      const grant = (await tx(`INSERT INTO app.user_roles (user_id,role_id,valid_from,valid_to)
        OUTPUT INSERTED.*,INSERTED.user_role_id AS id VALUES ($1,$2,$3,$4)`, [v.userId,v.roleId,v.validFrom,v.validTo])).rows[0];
      if (role.rows[0].code === 'LECTURER') {
        // Provision the profile in the same transaction as the role; never overwrite
        // an existing lecturer identity or silently transfer their employment.
        await tx(`INSERT INTO app.lecturers (user_id,employee_code,full_name,email)
          SELECT user_id,$2,display_name,email FROM app.users WHERE user_id=$1 AND NOT EXISTS (SELECT 1 FROM app.lecturers WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1)`, [v.userId,v.employeeCode || `ADMIN_${v.userId}`]);
        const lecturer = (await tx('SELECT lecturer_id,employee_code,is_active FROM app.lecturers WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1', [v.userId])).rows[0];
        if (!lecturer?.is_active) throw new ConflictError('Hồ sơ giảng viên đang ngừng hoạt động; cần khôi phục trước khi cấp vai trò');
        if (v.employeeCode && lecturer.employee_code !== v.employeeCode)
          throw new ConflictError('Tài khoản đã có mã giảng viên khác; không thể đổi danh tính khi cấp vai trò');
        if (v.unitId) {
          const assignments = (await tx(`SELECT unit_id,valid_from FROM app.lecturer_assignments WITH (UPDLOCK, HOLDLOCK)
            WHERE lecturer_id=$1 AND is_primary=1 AND (valid_to IS NULL OR valid_to>$2)`,
          [lecturer.lecturer_id,v.validFrom])).rows;
          if (assignments.length && !(assignments.length === 1 && String(assignments[0].unit_id) === String(v.unitId)
            && new Date(assignments[0].valid_from) <= new Date(v.validFrom)))
            throw new ConflictError('Giảng viên đã có công tác chính hoặc phân công tương lai; dùng trang Tổ chức để chuyển đơn vị');
          if (!assignments.length) await tx(`INSERT INTO app.lecturer_assignments
            (lecturer_id,unit_id,is_primary,valid_from,assigned_by) VALUES($1,$2,1,$3,$4)`,
          [lecturer.lecturer_id,v.unitId,v.validFrom,actor]);
        }
        grant.lecturerId = lecturer.lecturer_id;
      }
      return grant;
    }
    if (!['MANAGER','RECORDS_OFFICER','COUNCIL'].includes(role.rows[0].code)) throw new ConflictError('Scope chỉ dành cho Manager/RecordsOfficer/Council; đại diện dùng phân công đại diện');
    if (!v.unitId) throw new ConflictError('Thiếu đơn vị scope');
    const grant = await tx(`SELECT 1 FROM app.user_roles WHERE user_id=$1 AND role_id=$2 AND revoked_at IS NULL AND valid_from <= $3
      AND (valid_to IS NULL OR (CAST($4 AS datetime2) IS NOT NULL AND valid_to >= $4))`, [v.userId,v.roleId,v.validFrom,v.validTo]);
    if (!grant.rowCount) throw new ConflictError('Thời hạn scope phải nằm trong thời hạn vai trò');
    return (await tx(`INSERT INTO app.user_unit_scopes (user_id,role_id,unit_id,include_descendants,valid_from,valid_to)
      OUTPUT INSERTED.*,INSERTED.user_unit_scope_id AS id VALUES ($1,$2,$3,$4,$5,$6)`, [v.userId,v.roleId,v.unitId,v.includeDescendants,v.validFrom,v.validTo])).rows[0];
}
export async function revoke(actor, resource, id) {
  const defs = { scopes: ['user_unit_scopes','user_unit_scope_id'], 'user-roles': ['user_roles','user_role_id'], representatives: ['unit_representatives','unit_representative_id'] };
  const [table,key] = defs[resource];
  return mutate(actor, resource, async tx => {
    const owner = (await tx(`SELECT user_id FROM app.${table} WHERE ${key}=$1`, [id])).rows[0];
    if (!owner) throw new NotFoundError('Phân công không tồn tại hoặc đã thu hồi');
    await tx('SELECT user_id FROM app.users WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1', [owner.user_id]);
    // Future assignments are retained as cancelled history via revoked_at.
    const r = await tx(`DECLARE @changed TABLE (id bigint); UPDATE app.${table} SET revoked_at=SYSUTCDATETIME() OUTPUT INSERTED.${key} INTO @changed WHERE ${key}=$1 AND revoked_at IS NULL; SELECT resultRow.*,resultRow.${key} AS id FROM app.${table} resultRow JOIN @changed changed ON changed.id=resultRow.${key}`, [id]);
    if (!r.rowCount) throw new NotFoundError('Phân công không tồn tại hoặc đã thu hồi');
    return r.rows[0];
  });
}
export async function saveCatalog(actor, resource, id, v) {
  const d = catalogDefinitions[resource];
  const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const values = d.columns.map(c => v[camel(c)]);
  return mutate(actor, d.table, async tx => {
    const sql = id ? `UPDATE app.${d.table} SET ${d.columns.map((c,i) => `${c}=$${i+1}`).join(',')},updated_at=SYSUTCDATETIME() OUTPUT INSERTED.*,INSERTED.${d.id} AS id WHERE ${d.id}=$${values.length+1}`
      : `INSERT INTO app.${d.table} (${d.columns.join(',')}) OUTPUT INSERTED.*,INSERTED.${d.id} AS id VALUES (${values.map((_,i) => `$${i+1}`).join(',')})`;
    const r = await tx(sql, id ? [...values,id] : values);
    if (!r.rowCount) throw new NotFoundError();
    return r.rows[0];
  });
}
export async function deactivateCatalog(actor, resource, id) {
  const d = catalogDefinitions[resource];
  return mutate(actor, d.table, async tx => {
    const r = await tx(`UPDATE app.${d.table} SET is_active=0,updated_at=SYSUTCDATETIME()${resource === 'academic-years' ? ',is_current=0' : ''} OUTPUT INSERTED.*,INSERTED.${d.id} AS id WHERE ${d.id}=$1`, [id]);
    if (!r.rowCount) throw new NotFoundError();
    return r.rows[0];
  });
}

const permissionTables = {
  'user-roles': ['user_roles', 'user_role_id'],
  scopes: ['user_unit_scopes', 'user_unit_scope_id'],
  representatives: ['unit_representatives', 'unit_representative_id'],
};
async function permissionSnapshot(tx, userId) {
  const result = {};
  for (const [resource, [table, key]] of Object.entries(permissionTables)) {
    result[resource] = (await tx(`SELECT * FROM app.${table} WHERE user_id=$1 ORDER BY ${key}`, [userId])).rows;
  }
  return { ...result, revision: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
}
export async function getPermissions(userId) {
  return withTransaction(async ({ query: tx }) => {
    const user = (await tx('SELECT user_id FROM app.users WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1', [userId])).rows[0];
    if (!user) throw new NotFoundError('Tài khoản không tồn tại');
    const snapshot = await permissionSnapshot(tx, userId);
    const lecturer = (await tx(`SELECT l.employee_code, a.unit_id FROM app.lecturers l
      LEFT JOIN app.lecturer_assignments a ON a.lecturer_id=l.lecturer_id AND a.is_primary=1
        AND a.valid_from<=SYSUTCDATETIME() AND (a.valid_to IS NULL OR a.valid_to>SYSUTCDATETIME())
      WHERE l.user_id=$1`, [userId])).rows[0] || null;
    return { ...snapshot, lecturer };
  });
}
export async function savePermissions(actor, userId, values) {
  return mutate(actor, 'user_permissions', async tx => {
    // Same user lock as individual grants; never overwrite a stale permission editor.
    const user = (await tx('SELECT user_id,status FROM app.users WITH (UPDLOCK, HOLDLOCK) WHERE user_id=$1', [userId])).rows[0];
    if (!user || user.status !== 'ACTIVE') throw new ConflictError('Tài khoản không hoạt động');
    const snapshot = await permissionSnapshot(tx, userId);
    if (snapshot.revision !== values.revision) throw new ConflictError('Quyền đã thay đổi. Đóng và mở lại Quản lý quyền để tải dữ liệu mới.');
    const seen = new Set();
    for (const { resource, id } of values.revocations) {
      const [table, key] = permissionTables[resource];
      const signature = `${resource}:${id}`;
      if (seen.has(signature)) throw new ConflictError('Phân công thu hồi bị lặp');
      seen.add(signature);
      const row = snapshot[resource].find(r => String(r[key]) === String(id) && !r.revoked_at);
      if (!row) throw new ConflictError('Phân công không thuộc tài khoản hoặc đã thu hồi');
      await tx(`UPDATE app.${table} SET revoked_at=SYSUTCDATETIME() WHERE ${key}=$1 AND user_id=$2 AND revoked_at IS NULL`, [id, userId]);
    }
    // Roles must exist before their unit scopes / representative periods are validated.
    const additions = [...values.additions].sort((a, b) => Number(b.resource === 'user-roles') - Number(a.resource === 'user-roles'));
    const created = [];
    for (const addition of additions) {
      if (addition.values.userId !== userId) throw new ConflictError('Phân công phải thuộc tài khoản đang chỉnh sửa');
      created.push({ resource: addition.resource, assignment: await assignInTransaction(actor, addition.resource, addition.values, tx) });
    }
    // A role cannot be removed while a dependent, non-expired assignment remains.
    const remaining = await permissionSnapshot(tx, userId);
    const representativeRole = (await tx("SELECT role_id FROM app.roles WHERE code='UNIT_REPRESENTATIVE'", [])).rows[0]?.role_id;
    for (const [resource, roleId] of [['scopes', null], ['representatives', representativeRole]]) {
      for (const row of remaining[resource].filter(r => !r.revoked_at && (!r.valid_to || new Date(r.valid_to) > new Date()))) {
        const coveringRole = remaining['user-roles'].some(r => !r.revoked_at && String(r.role_id) === String(roleId ?? row.role_id)
          && new Date(r.valid_from) <= new Date(row.valid_from)
          && (!r.valid_to || (row.valid_to && new Date(r.valid_to) >= new Date(row.valid_to))));
        if (!coveringRole) throw new ConflictError('Cần thu hồi hoặc điều chỉnh phạm vi phụ thuộc khi thu hồi vai trò');
      }
    }
    return { id: userId, added: additions.length, revoked: values.revocations.length, additions: created, revocations: values.revocations };
  });
}
